/**
 * 課題ごとの採点 (EPIC #2421) のうち、verify-classroom-gradebook.mjs が見ていない部分を 1300×600 で確かめる。
 *
 *   A. 以前の採点結果 CSV の取り込み (#2431): 採点結果でないファイルを断る → プレビュー（照らし合わせた課題・
 *      見つからない課題）→［取り込む］で先生の評価として確定で PUT /grading → 採点簿の列が「確定」
 *   B. ［基準］タブ (#2425): ほかの課題から説明と基準をコピー（説明は 2-1 の下書き。先生が保存を決める・#2456）→
 *      つくり直す（説明があっても AI に作り直してもらえる・#2456）。縦のステッパー（2-1 説明 → 2-2 代表 →
 *      2-3 フェア → 2-4 基準の文・#2455）で、いまの小手順だけ開く。各小手順の上部の「AI に相談」（代表すべての
 *      AI の案・フェアの確認・基準の文の案）は一度実行したら押せない →［基準を保存］で PUT /grading の rubric →
 *      全員を採点で AI に基準の文が渡り、観点は送らない
 *   C. 確定と取り消し: 確定 → 評価を 1 つ変えると確定を取り消す（confirmedAt: null を保存・知らせが出る）→ もう一度確定
 *   D. 総合評価 (#2426): 確定していない課題があると注意とリンク・CSV を書き出せない → リンクで課題の採点を開く →
 *      確定すると書き出せる → CSV の中身（課題の列・平均・総合）
 *   E. 処理中・結果の表示: コメントを返却しているところ・返却した結果・AI の採点が失敗したとき
 * 各段で、いまの手順のボタン (aria-current="step") とその下端が 600 以下か、画面とページがスクロールしないか
 * (一覧の枠の中は可) も測る。1 つでも外れたら exit 1。
 *
 * 採点簿の並び・セル・提出の読み込み・全員を採点・コメントの下書き・離れる確認は verify-classroom-gradebook.mjs が見る。
 * classroom API は route interception でスタブするので stg デプロイ不要 (dev server だけが前提)。
 * スクショは tmp/classroom-grading-*.png。
 *
 *   node verify-classroom-grading.mjs                    # コンテナ内 (headless)
 *   BASE=http://localhost:8624 node verify-classroom-grading.mjs
 *   DOCS_SHOTS=1 node verify-classroom-grading.mjs       # docs/classroom/screenshots の 0350〜0352・0358〜0362・0364・0365 も撮り直す
 *   LOCALE=ja-Hira node verify-classroom-grading.mjs     # ひらがなで測る (DOCS_SHOTS は ja のときだけ)
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");

const HEADLESS = process.env.HEADLESS !== "false";
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || "http://localhost:8601";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, "tmp");
const LOCALE = process.env.LOCALE || "ja";
const DOCS_SHOTS = process.env.DOCS_SHOTS === "1" && LOCALE === "ja";
const VIEWPORT = { width: 1300, height: 600 };
const SEATS = 40;
const ROOT = '[data-testid="classroom-phase-teacher-evaluation"]';

// 撮った画面 → docs/classroom/screenshots (ファイル名は変えない)。ほかの採点の画面は gradebook 側が撮る。
const DOC_SHOT_NAMES = {
    returning: "0350-teacher-grading-returning.png",
    returned: "0351-teacher-grading-returned-result.png",
    "grade-failed": "0352-teacher-grading-failed-result.png",
    "rubric-proposed": "0358-teacher-grading-rubric-steps.png",
    "rubric-fairness": "0359-teacher-grading-rubric-fairness.png",
    "rubric-drafted": "0360-teacher-grading-rubric-sentences.png",
    "rubric-copy": "0361-teacher-grading-rubric-copy.png",
    "rubric-copied-description":
        "0362-teacher-grading-rubric-copied-description.png",
    "rubric-saved": "0364-teacher-grading-rubric-no-s-example.png",
    "grade-inconsistent": "0365-teacher-grading-inconsistent-result.png",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

const LONG_CLASS = "3年2組 技術・家庭科（情報の技術）";
// 新しい課題が左。OLDEST は以前の CSV から取り込む課題（新しい画面ではまだ採点していない）。
const OLDEST = {
    classroomId: "c0",
    assignmentName: "01_ねこ",
    createdAt: "2026-09-10T00:00:00.000Z",
    // 説明も基準も無い（コピーの画面で「説明も基準もありません」）。
    description: "",
};
const OLD = {
    classroomId: "c1",
    assignmentName: "02_LED",
    createdAt: "2026-10-10T00:00:00.000Z",
    // コピー元の説明（#2456）。下書きとして c2 の 2-1 に入る。
    description:
        "モーターとサーボを動かし、話す台本で状態を知らせる（ほかのクラスの説明）",
};
const NEW = {
    classroomId: "c2",
    assignmentName: "04_モーター",
    createdAt: "2026-11-10T00:00:00.000Z",
};
const LESSONS = [OLDEST, OLD, NEW];
const seatId = (n) => `seat-${String(n).padStart(2, "0")}`;
const submittedSeats = Array.from({ length: SEATS }, (_, i) => i + 1).filter(
    (n) => n % 9 !== 0,
);

const summary = (lesson) => ({
    classroomId: lesson.classroomId,
    className: LONG_CLASS,
    assignmentName: lesson.assignmentName,
    joinCode: "abc234",
    studentCount: SEATS,
    googleClassroomCourseId: null,
    googleClassroomAlternateLink: null,
    createdAt: lesson.createdAt,
    expiresAt: "2027-01-10T00:00:00.000Z",
    coTeacherEmails: [],
    groupId: "g1",
    topic: null,
    sortDate: lesson.createdAt,
    hasAssignment: true,
    status: "active",
    role: "owner",
});

const OLD_LEVELS = [
    {
        grade: "S",
        text: "課題を満たしたうえで、ほかの人が使っていないブロックで工夫している",
    },
    { grade: "A", text: "明るさで LED を点ける・消すを切りかえている" },
    { grade: "B", text: "LED を動かしているが、明るさで切りかえていない" },
    { grade: "C", text: "動く台本を足していない" },
];
const DRAFT_LEVELS = [
    {
        grade: "S",
        text: "モーターとサーボの両方を動かし、話す台本で状態を知らせている",
    },
    { grade: "A", text: "モーターを動かし、話す台本で状態を知らせている" },
    { grade: "B", text: "モーターを動かしているが、知らせる台本が無い" },
    { grade: "C", text: "動く台本を足していない" },
];

// 保存した採点（サーバーの代わり）。02_LED は確定済み、ほかはまだ無い。
const gradings = {
    c0: null,
    c1: {
        rubric: {
            levels: OLD_LEVELS,
            examples: [],
            updatedAt: "2026-11-20T00:00:00.000Z",
        },
        grades: Object.fromEntries(
            submittedSeats.map((n) => [
                String(n),
                {
                    grade: n % 11 === 0 ? "S" : n % 7 === 0 ? "B" : "A",
                    reason: "",
                    source: "teacher",
                },
            ]),
        ),
        confirmedAt: "2026-11-20T00:00:00.000Z",
        updatedAt: "2026-11-20T00:00:00.000Z",
    },
    c2: null,
};
const puts = [];
const assignmentPuts = [];
const evaluates = [];
const patches = [];
let failNextGrade = false;

// 以前の採点の画面が書き出した CSV（buildEvaluationCsv の形）。02 番の根拠は式よけの ' 付き。
const LEGACY_GRADES = Object.fromEntries(
    submittedSeats.map((n) => [n, n % 5 === 0 ? "S" : n % 3 === 0 ? "B" : "A"]),
);
const legacyCsv = () => {
    const header = [
        "出席番号",
        "01_ねこ:提出",
        "01_ねこ:評価",
        "01_ねこ:評価理由",
        "99_ない課題:提出",
        "99_ない課題:評価",
        "99_ない課題:評価理由",
        "総合評価",
    ];
    const lines = [header.join(",")];
    for (let n = 1; n <= SEATS; n++) {
        const sub = submittedSeats.includes(n);
        const reason =
            n === 2 ? "'=ねこを 2 回動かしている" : sub ? "旗で動く" : "";
        lines.push(
            [
                n,
                sub ? "○" : "",
                sub ? LEGACY_GRADES[n] : "",
                `"${reason}"`,
                "○",
                "A",
                "",
                sub ? "A" : "",
            ].join(","),
        );
    }
    return `﻿${lines.join("\r\n")}\r\n`;
};

// 2 種類の作品（奇数の席 = 動くだけ / 偶数の席 = 動いて話す）。まとまりが 2 つに分かれ、代表が出る。
const makeSb3 = async (withSay) => {
    const zip = new JSZip();
    const blocks = {
        a: {
            opcode: "event_whenflagclicked",
            next: "b",
            parent: null,
            inputs: {},
            fields: {},
            topLevel: true,
        },
        b: {
            opcode: "motion_movesteps",
            next: withSay ? "c" : null,
            parent: "a",
            inputs: { STEPS: [1, [4, "10"]] },
            fields: {},
            topLevel: false,
        },
    };
    if (withSay) {
        blocks.c = {
            opcode: "looks_say",
            next: null,
            parent: "b",
            inputs: { MESSAGE: [1, [10, "動いたよ"]] },
            fields: {},
            topLevel: false,
        };
    }
    zip.file(
        "project.json",
        JSON.stringify({
            targets: [
                {
                    isStage: true,
                    name: "Stage",
                    blocks: {},
                    variables: {},
                    lists: {},
                    costumes: [],
                    sounds: [],
                },
                {
                    isStage: false,
                    name: "ねこ",
                    variables: {},
                    lists: {},
                    costumes: [],
                    sounds: [],
                    blocks,
                },
            ],
            meta: { semver: "3.0.0" },
        }),
    );
    return zip.generateAsync({ type: "nodebuffer" });
};

const rows = [];
const record = (row) => {
    rows.push(row);
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name} — ${row.detail}`);
};

const measure = (page) =>
    page.evaluate((root) => {
        const el = document.querySelector(root);
        // The footer's steps only: the inner stepper of the［基準］tab has its own current step (#2455).
        const current = document.querySelector(
            '[data-testid="classroom-eval-steps"] [aria-current="step"]',
        );
        const primary =
            current ||
            document.querySelector(
                '[data-testid="classroom-evaluation-cancel"]',
            );
        const se = document.scrollingElement;
        return {
            current: current ? current.getAttribute("data-testid") : null,
            primaryBottom: primary
                ? Math.round(primary.getBoundingClientRect().bottom)
                : null,
            rootScroll: el ? el.scrollHeight : null,
            rootClient: el ? el.clientHeight : null,
            pageScroll: se.scrollHeight,
            pageClient: se.clientHeight,
            pageScrollW: se.scrollWidth,
            pageClientW: se.clientWidth,
            vh: window.innerHeight,
        };
    }, ROOT);

const shoot = async (page, shot) => {
    await page.screenshot({
        path: resolve(
            SHOT_DIR,
            `classroom-grading-${shot}${LOCALE === "ja" ? "" : `-${LOCALE}`}.png`,
        ),
    });
    if (DOCS_SHOTS && DOC_SHOT_NAMES[shot]) {
        await page.screenshot({
            path: resolve(
                REPO_ROOT,
                "docs",
                "classroom",
                "screenshots",
                DOC_SHOT_NAMES[shot],
            ),
        });
    }
};

/** 画面が 1300×600 に収まるか（いまの手順のボタン・画面とページのスクロール）を測って撮る。 */
const judge = async (page, { name, expected, shot }) => {
    const m = await measure(page);
    const rootOk = m.rootScroll !== null && m.rootScroll <= m.rootClient;
    const pageOk =
        m.pageScroll <= m.pageClient && m.pageScrollW <= m.pageClientW;
    const currentOk = expected === null ? true : m.current === expected;
    const bottomOk = m.primaryBottom !== null && m.primaryBottom <= m.vh;
    record({
        name: `fit: ${name}`,
        ok: rootOk && pageOk && currentOk && bottomOk,
        detail:
            `current ${m.current} (expected ${expected}) primary bottom ${m.primaryBottom}/${m.vh}` +
            ` · screen ${m.rootScroll}/${m.rootClient}` +
            ` · page ${m.pageScroll}/${m.pageClient} w ${m.pageScrollW}/${m.pageClientW}`,
    });
    if (shot) await shoot(page, shot);
};

const waitIdle = (page) =>
    page.waitForFunction(
        () =>
            !document.querySelector(
                '[data-testid="classroom-eval-progress"]',
            ) &&
            !document.querySelector('[data-testid="grading-rubric-running"]') &&
            // The AI of the［基準］tab shows that it runs on its own button (#2455).
            !document.querySelector(
                '[data-testid="grading-rubric"] [aria-busy="true"]',
            ),
        null,
        { timeout: 30000 },
    );
const waitSaved = (page) =>
    page.waitForFunction(
        () =>
            document
                .querySelector('[data-testid="classroom-eval-save-state"]')
                ?.getAttribute("data-state") !== "pending",
        null,
        { timeout: 10000 },
    );
const text = (page, id) =>
    page.evaluate(
        (sel) => document.querySelector(sel)?.textContent ?? null,
        tid(id),
    );

const sb3Move = await makeSb3(false);
const sb3Say = await makeSb3(true);
const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const ctx = await browser.newContext({
    viewport: VIEWPORT,
    locale: "ja-JP",
    acceptDownloads: true,
});
const page = await ctx.newPage();

await page.route("**/notifications", (r) =>
    r.fulfill({ json: { notifications: [], unreadCount: 0 } }),
);
await page.route("**/kick-requests/pending**", (r) =>
    r.fulfill({ json: { requests: [], activeAssignmentCount: 3 } }),
);
await page.route("**/classroom-groups", (r) =>
    r.fulfill({
        json: {
            groups: [
                {
                    groupId: "g1",
                    name: LONG_CLASS,
                    year: 2026,
                    status: "active",
                    schemaVersion: 2,
                    topics: [],
                },
            ],
        },
    }),
);
await page.route("**/classroom-groups/migrate", (r) =>
    r.fulfill({ json: { migrated: 0 } }),
);
await page.route("**/classrooms?**", (r) =>
    r.fulfill({ json: { classrooms: LESSONS.map(summary) } }),
);
await page.route(/\/classrooms$/, (r) =>
    r.fulfill({ json: { classrooms: LESSONS.map(summary) } }),
);
for (const lesson of LESSONS) {
    const id = lesson.classroomId;
    await page.route(`**/classrooms/${id}/grading`, async (r) => {
        if (r.request().method() === "PUT") {
            const updates = JSON.parse(r.request().postData() || "{}");
            puts.push({ id, updates });
            gradings[id] = {
                rubric: null,
                grades: {},
                confirmedAt: null,
                ...(gradings[id] || {}),
                ...updates,
            };
        }
        await r.fulfill({ json: { grading: gradings[id] } });
    });
    await page.route(`**/classrooms/${id}/members`, (r) =>
        r.fulfill({
            json: {
                members: Array.from({ length: SEATS }, (_, i) => ({
                    memberId: seatId(i + 1),
                    seatNumber: i + 1,
                })),
            },
        }),
    );
    await page.route(`**/classrooms/${id}/assignment`, (r) => {
        if (r.request().method() === "PUT") {
            const body = JSON.parse(r.request().postData() || "{}");
            assignmentPuts.push({ id, body });
            lesson.description =
                (body.pages && body.pages[0] && body.pages[0].text) || "";
            return r.fulfill({ json: {} });
        }
        return r.fulfill({
            json: {
                assignment: {
                    pages: [
                        {
                            text:
                                typeof lesson.description === "string"
                                    ? lesson.description
                                    : "モーターを動かし、動いたことを話す台本で知らせる",
                        },
                    ],
                },
                lesson: null,
                startFromPrevious: false,
                peerView: "none",
            },
        });
    });
    await page.route(`**/classrooms/${id}/submissions`, (r) =>
        r.fulfill({
            json: {
                submissions: submittedSeats.map((n) => ({
                    submissionId: `${id}-s${n}`,
                    memberId: seatId(n),
                    status: "submitted",
                    submittedAt: "2026-11-12T03:00:00.000Z",
                    projectUrl: `https://example.invalid/${id}/${n}.sb3`,
                })),
            },
        }),
    );
    await page.route(`**/classrooms/${id}/submissions/*`, async (r) => {
        patches.push({
            id,
            url: r.request().url(),
            body: JSON.parse(r.request().postData() || "{}"),
        });
        await sleep(250); // long enough to see the returning state
        await r.fulfill({ json: { ok: true } });
    });
    await page.route(`**/classrooms/${id}/evaluate`, async (r) => {
        const body = JSON.parse(r.request().postData() || "{}");
        evaluates.push({ id, body });
        await sleep(500);
        if (body.mode === "grade" && failNextGrade) {
            await r.fulfill({
                status: 500,
                json: { error: "AI の採点を続けられませんでした。" },
            });
            return;
        }
        if (body.mode === "fairness") {
            const other = body.groups
                .flatMap((g) => g.submissions)
                .map((s) => s.seatNumber)[0];
            await r.fulfill({
                json: {
                    checks: other
                        ? [
                              {
                                  question: `${other} 番は代表と同じ評価でよいですか？`,
                                  options: ["A のまま", "B にする"],
                                  seatNumbers: [other],
                              },
                          ]
                        : [],
                },
            });
            return;
        }
        if (body.mode === "describe") {
            await r.fulfill({
                json: {
                    description:
                        "モーターを動かし、話す台本で知らせる（AI の案）",
                },
            });
            return;
        }
        if (body.mode === "rubric") {
            await r.fulfill({ json: { levels: DRAFT_LEVELS } });
            return;
        }
        const results = (body.submissions || []).map((s, i) =>
            body.mode === "grade"
                ? {
                      seatNumber: s.seatNumber,
                      grade: ["S", "A", "B", "C"][i % 4],
                      reason: "旗で動く",
                      needsReview: i % 7 === 0,
                  }
                : {
                      seatNumber: s.seatNumber,
                      comment: "モーターを動かせています。",
                  },
        );
        await r.fulfill({ json: { results } });
    });
}
await page.route("https://example.invalid/**", (r) => {
    const seat = Number(
        (r
            .request()
            .url()
            .match(/\/(\d+)\.sb3$/) || [])[1],
    );
    return r.fulfill({
        status: 200,
        body: seat % 2 === 0 ? sb3Say : sb3Move,
        headers: { "content-type": "application/octet-stream" },
    });
});

await page.goto(
    `${BASE}/?no_beforeunload=1&locale=${LOCALE}&devlogin=stub-token`,
    { waitUntil: "load" },
);
await page.waitForTimeout(3000);
await page.locator(tid("settings-menu")).click();
await page.locator(tid("settings-classroom-management")).click();
await page.waitForSelector(tid("classroom-class-evaluate-g1"), {
    timeout: 20000,
});
await page.locator(tid("classroom-class-evaluate-g1")).click();
await page.waitForSelector(tid("classroom-gradebook"), { timeout: 20000 });
await waitIdle(page);
await page.waitForTimeout(300);

// ---- A. 以前の採点結果 CSV の取り込み ----
const fileInput = page.locator(tid("classroom-legacy-import-file"));
await fileInput.setInputFiles({
    name: "メモ.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("名前,点\nねこ,10\n"),
});
await page.waitForSelector(tid("classroom-legacy-import-preview"));
const bad = await page.evaluate(
    (sel) => ({
        text: document.querySelector(sel)?.textContent,
        run: !!document.querySelector(
            '[data-testid="classroom-legacy-import-run"]',
        ),
    }),
    tid("classroom-legacy-import-preview"),
);
record({
    name: "import: a CSV that is not a grading result is refused (no [取り込む])",
    ok: !bad.run && /採点結果|さいてんけっか/.test(bad.text || ""),
    detail: JSON.stringify(bad),
});
await page.click(tid("classroom-legacy-import-cancel"));

await fileInput.setInputFiles({
    name: "3年2組_採点結果.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(legacyCsv()),
});
await page.waitForSelector(tid("classroom-legacy-import-run"));
const preview = await text(page, "classroom-legacy-import-preview");
record({
    name: "import preview: 01_ねこ is matched with its grade count, 99_ない課題 is not found",
    ok:
        preview.includes("01_ねこ") &&
        preview.includes(String(submittedSeats.length)) &&
        /99_ない課題/.test(preview) &&
        !/02_LED/.test(preview),
    detail: preview,
});
await judge(page, {
    name: "A import preview",
    expected: null,
    shot: "import-preview",
});
await page.click(tid("classroom-legacy-import-run"));
await page.waitForSelector(tid("classroom-legacy-import-result"));
const importPut = puts.find((p) => p.id === "c0");
const importGrades = Object.entries(importPut?.updates.grades || {});
record({
    name: "import: saved as the teacher's grades and confirmed, the formula guard is undone",
    ok:
        !!importPut &&
        typeof importPut.updates.confirmedAt === "string" &&
        importGrades.length === submittedSeats.length &&
        importGrades.every(
            ([seat, g]) =>
                g.source === "teacher" && g.grade === LEGACY_GRADES[seat],
        ) &&
        importPut.updates.grades["2"]?.reason === "=ねこを 2 回動かしている" &&
        !puts.some((p) => p.id !== "c0"),
    detail: `puts=${puts.length} grades=${importGrades.length} confirmedAt=${importPut?.updates.confirmedAt} seat2=${JSON.stringify(importPut?.updates.grades["2"])}`,
});
await page.waitForTimeout(300);
const afterImport = await page.evaluate(() => ({
    result: document.querySelector(
        '[data-testid="classroom-legacy-import-result"]',
    )?.textContent,
    col: document.querySelector('[data-testid="classroom-gradebook-col-c0"]')
        ?.textContent,
    cell: document.querySelector(
        '[data-testid="classroom-gradebook-cell-5-c0"]',
    )?.textContent,
    drafts: document.querySelectorAll(
        '[data-testid="classroom-gradebook-cell-5-c0"] [data-draft="true"]',
    ).length,
}));
record({
    name: "import: the result is shown and the column is confirmed in the gradebook",
    ok:
        /1/.test(afterImport.result || "") &&
        /確定|かくてい/.test(afterImport.col || "") &&
        (afterImport.cell || "").includes(LEGACY_GRADES[5]) &&
        afterImport.drafts === 0,
    detail: JSON.stringify(afterImport),
});
await judge(page, {
    name: "A imported",
    expected: null,
    shot: "import-done",
});

// ---- B. ［基準］タブ ----
await page.click(tid("classroom-gradebook-open-c2"));
await page.waitForSelector(tid("classroom-eval-steps"));
await page.click(tid("classroom-eval-load"));
await page.waitForSelector(`${tid("classroom-eval-seat-list")} li`);
await waitIdle(page);
await page.waitForTimeout(300);
await page.click(tid("classroom-eval-rubric"));
await page.waitForSelector(tid("grading-rubric"));
const rubric0 = await page.evaluate(() => ({
    tab: document
        .querySelector('[data-testid="classroom-eval-tab-rubric"]')
        ?.getAttribute("aria-selected"),
    // With a description, 2-1 is done and folded into its one line (#2455).
    description: document.querySelector(
        '[data-testid="grading-rubric-description-text"], [data-testid="grading-rubric-steps-summary-describe"]',
    )?.textContent,
    saved: !!document.querySelector('[data-testid="grading-rubric-saved"]'),
    builder: !!document.querySelector('[data-testid="grading-rubric-steps"]'),
}));
record({
    name: "rubric tab: opens with the description, and the builder when there is no rubric",
    ok:
        rubric0.tab === "true" &&
        /モーター/.test(rubric0.description || "") &&
        !rubric0.saved &&
        rubric0.builder,
    detail: JSON.stringify(rubric0),
});
await judge(page, {
    name: "B rubric tab (no rubric yet)",
    expected: "classroom-eval-run-grade",
    shot: "rubric-empty",
});

// ほかの課題から説明と基準をコピー（#2456）
const copyLabel = await text(page, "grading-rubric-copy");
await page.click(tid("grading-rubric-copy"));
await page.waitForSelector(tid("grading-rubric-copy-dialog"));
const copyOptions = await page.evaluate(() =>
    [
        ...document.querySelectorAll(
            '[data-testid="grading-rubric-copy-class"] option',
        ),
    ].map((o) => o.value),
);
await page.selectOption(tid("grading-rubric-copy-class"), "g1");
const assignmentOptions = await page.evaluate(() =>
    [
        ...document.querySelectorAll(
            '[data-testid="grading-rubric-copy-assignment"] option',
        ),
    ].map((o) => o.value),
);
await page.selectOption(tid("grading-rubric-copy-assignment"), "c0");
await page.waitForSelector(tid("grading-rubric-copy-none"));
await page.selectOption(tid("grading-rubric-copy-assignment"), "c1");
await page.waitForSelector(tid("grading-rubric-copy-levels"));
const copyPreview = await text(page, "grading-rubric-copy-levels");
const copyDescription = await text(page, "grading-rubric-copy-description");
record({
    name: "copy: the other assignments of the class are listed (not this one), the description and rubric are previewed",
    ok:
        /説明と基準/.test(copyLabel || "") &&
        /ほかのクラスの説明/.test(copyDescription || "") &&
        copyOptions.includes("g1") &&
        assignmentOptions.includes("c1") &&
        !assignmentOptions.includes("c2") &&
        copyPreview.includes(OLD_LEVELS[1].text),
    detail: `classes=${copyOptions} assignments=${assignmentOptions}`,
});
// 02_LED の基準には正解の例が無い: S の注意と、すべての段に「正解の例が無い」
const has = (id) => page.evaluate((s) => !!document.querySelector(s), tid(id));
const copyWarn = {
    noS: await has("grading-rubric-copy-no-s-example"),
    marks: await page.evaluate(
        () =>
            document.querySelectorAll(
                '[data-testid^="grading-rubric-copy-levels-no-example-"]',
            ).length,
    ),
};
record({
    name: "copy: a rubric without an S example warns, and every level without an example is marked",
    ok: copyWarn.noS && copyWarn.marks === 4,
    detail: JSON.stringify(copyWarn),
});
// 撮る前に、コピーの小さな画面の中身（説明と基準）を枠の中で見えるところへ出す。
await page.evaluate(() =>
    document
        .querySelector('[data-testid="grading-rubric-copy-preview"]')
        ?.scrollIntoView({ block: "start" }),
);
await shoot(page, "rubric-copy");
await page.click(tid("grading-rubric-copy-do"));
await page.waitForSelector(tid("grading-rubric-saved"));
const copyPut = puts.filter((p) => p.id === "c2" && p.updates.rubric).at(-1);
record({
    name: "copy: the rubric is saved to this assignment (PUT /grading rubric)",
    ok:
        !!copyPut &&
        JSON.stringify(copyPut.updates.rubric.levels.map((l) => l.text)) ===
            JSON.stringify(OLD_LEVELS.map((l) => l.text)),
    detail: JSON.stringify(
        copyPut?.updates.rubric?.levels?.map((l) => l.grade),
    ),
});
// コピーした説明は下書き: 課題（生徒に見せる説明）にはまだ保存しない。
await page.waitForSelector(tid("grading-rubric-describe-copied"));
const copiedDraft = await page.evaluate(
    () =>
        document.querySelector('[data-testid="grading-rubric-describe-text"]')
            ?.value,
);
record({
    name: "copy: the description is a draft in 2-1, not saved into the assignment yet",
    ok:
        /ほかのクラスの説明/.test(copiedDraft || "") &&
        assignmentPuts.length === 0,
    detail: JSON.stringify({
        copiedDraft,
        assignmentPuts: assignmentPuts.length,
    }),
});
await page.evaluate(() =>
    document
        .querySelector('[data-testid="grading-rubric-describe-copied"]')
        ?.scrollIntoView({ block: "start" }),
);
await judge(page, {
    name: "B copied description (draft)",
    expected: "classroom-eval-run-grade",
    shot: "rubric-copied-description",
});
// 先生が［合っている（課題に保存）］で反映を決める（2-1 と同じ操作）。
await page.click(tid("grading-rubric-describe-ok"));
await page.waitForSelector(tid("grading-rubric-describe-copied"), {
    state: "detached",
});
await waitIdle(page);
const copiedPut = assignmentPuts.filter((p) => p.id === "c2").at(-1);
record({
    name: "copy: the teacher saves the copied description into the assignment (PUT /assignment)",
    ok:
        !!copiedPut &&
        /ほかのクラスの説明/.test(copiedPut.body.pages?.[0]?.text || ""),
    detail: JSON.stringify(copiedPut?.body?.pages?.[0]),
});
record({
    name: "saved rubric: no S example → the warning above the sentences and the marks",
    ok:
        (await has("grading-rubric-no-s-example")) &&
        (await has("classroom-eval-rubric-levels-no-example-S")) &&
        (await has("classroom-eval-rubric-levels-no-example-A")),
});

// つくり直す: 代表 → AI の案 → 正解 → フェアの確認 → AI に基準の文 → 保存
await page.click(tid("grading-rubric-edit"));
await page.waitForSelector(tid("grading-rubric-propose-ai-button"));
// 説明があっても、2-1 を開けば AI に作り直してもらえる（#2456）。押すのは先生が望んだときだけ。
await page.click(tid("grading-rubric-steps-head-describe"));
await page.waitForSelector(tid("grading-rubric-describe-ai-button"));
const rewrite = await page.evaluate(() => {
    const b = document.querySelector(
        '[data-testid="grading-rubric-describe-ai-button"]',
    );
    return { label: b?.textContent, disabled: b?.disabled };
});
record({
    name: "2-1: a written description can be rewritten by the AI (the button is there and can be pressed)",
    ok: /作り直/.test(rewrite.label || "") && rewrite.disabled === false,
    detail: JSON.stringify(rewrite),
});
await page.click(tid("grading-rubric-steps-head-examples"));
await page.waitForSelector(tid("grading-rubric-propose-ai-button"));
const stepStates = () =>
    page.evaluate(() =>
        Object.fromEntries(
            ["describe", "examples", "fairness", "sentences"].map((id) => [
                id,
                document
                    .querySelector(
                        `[data-testid="grading-rubric-steps-step-${id}"]`,
                    )
                    ?.getAttribute("data-state"),
            ]),
        ),
    );
const aiButtonAt = (id) =>
    page.evaluate((sel) => {
        const section = document.querySelector(sel);
        const box = section?.firstElementChild;
        const button = box?.querySelector("button");
        return {
            top: box?.getAttribute("data-testid") || null,
            disabled: button ? button.disabled : null,
        };
    }, tid(id));
const states0 = await stepStates();
const proposeAt = await aiButtonAt("grading-rubric-reps");
record({
    name: "steps: the description is there, so 2-1 is done (one line) and 2-2 is open with its AI on top",
    ok:
        states0.describe === "done" &&
        states0.examples === "now" &&
        states0.fairness === "todo" &&
        // The copied rubric is saved, so 2-4 shows done until the sentences are edited.
        states0.sentences === "done" &&
        /モーター/.test(
            (await text(page, "grading-rubric-steps-summary-describe")) || "",
        ) &&
        proposeAt.top === "grading-rubric-propose-ai" &&
        proposeAt.disabled === false,
    detail: JSON.stringify({ states0, proposeAt }),
});
const reps = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="grading-rubric-rep-"]')]
        .map((e) => e.getAttribute("data-testid"))
        .filter((t) => /^grading-rubric-rep-\d+$/.test(t))
        .map((t) => Number(t.replace("grading-rubric-rep-", ""))),
);
record({
    name: "rebuild: a representative per group of works (2 kinds of works → 2 or more)",
    ok: reps.length >= 2,
    detail: `${reps}`,
});
await page.click(tid("grading-rubric-propose-ai-button"));
await waitIdle(page);
const proposeCall = evaluates.filter((e) => e.body.mode === "grade").at(-1);
record({
    name: "propose: the AI grades only the representatives",
    ok:
        !!proposeCall &&
        proposeCall.body.submissions.length === reps.length &&
        proposeCall.body.submissions.every((s) => reps.includes(s.seatNumber)),
    detail: `${proposeCall?.body.submissions.map((s) => s.seatNumber)}`,
});
record({
    name: "propose: one button for every representative, and it cannot be pressed again",
    ok:
        (await page
            .locator(tid("grading-rubric-propose-ai-button"))
            .count()) === 1 &&
        (await page.isDisabled(tid("grading-rubric-propose-ai-button"))),
    detail: "",
});
const rep = reps[0];
// #2521: when the AI is done, a notice tells the next move, the first representative opens,
// and a short「正解を選ぶ」tip sits by its grade buttons.
const afterPropose = await page.evaluate(
    (seat) => ({
        notice:
            document.querySelector(
                '[data-testid="grading-rubric-proposed-notice"]',
            )?.textContent || "",
        open:
            document
                .querySelector(`[data-testid="grading-rubric-rep-${seat}"]`)
                ?.getAttribute("aria-expanded") === "true",
        hint: !!document.querySelector(
            `[data-testid="grading-rubric-rep-hint-${seat}"]`,
        ),
    }),
    rep,
);
record({
    name: "propose done: the notice, the first representative open, the「正解を選ぶ」tip (#2521)",
    ok:
        /正解を選んで|せいかいをえらんで/.test(afterPropose.notice) &&
        afterPropose.open &&
        afterPropose.hint,
    detail: JSON.stringify(afterPropose),
});
await judge(page, {
    name: "B rubric 2-2 with the AI proposals",
    expected: "classroom-eval-run-grade",
    shot: "rubric-proposed",
});
await page.waitForSelector(tid(`grading-rubric-rep-grade-${rep}-A`));
await page.click(tid(`grading-rubric-rep-grade-${rep}-A`));
await page.fill(
    tid(`grading-rubric-rep-reason-${rep}`),
    "話す台本で知らせている",
);
// Only some representatives have the right grade: 2-3 is not the current step yet, open it by its head.
await page.click(tid("grading-rubric-steps-head-fairness"));
const fairnessAt = await aiButtonAt("grading-rubric-fairness");
await page.click(tid("grading-rubric-fairness-ai-button"));
await waitIdle(page);
await page.waitForSelector(tid("grading-rubric-check-0"));
record({
    name: "fairness: the AI is on top of 2-3, and it cannot be pressed again",
    ok:
        fairnessAt.top === "grading-rubric-fairness-ai" &&
        fairnessAt.disabled === false &&
        (await page.isDisabled(tid("grading-rubric-fairness-ai-button"))),
    detail: JSON.stringify(fairnessAt),
});
// Show the open inner step from its head (the pane scrolls inside its frame, R6).
await page.evaluate(
    (sel) => document.querySelector(sel)?.scrollIntoView({ block: "start" }),
    tid("grading-rubric-steps-step-fairness"),
);
await judge(page, {
    name: "B rubric 2-3 fairness questions",
    expected: "classroom-eval-run-grade",
    shot: "rubric-fairness",
});
await page.click(tid("grading-rubric-check-0-option-1"));
await page.click(tid("grading-rubric-steps-head-sentences"));
// 先生の正解は A と B だけ: 文を書いてもらう前に S の注意
record({
    name: "builder: the teacher's answers have no S → the warning before drafting",
    ok: await has("grading-rubric-draft-no-s-example"),
});
await page
    .locator(tid("grading-rubric-draft-no-s-example"))
    .scrollIntoViewIfNeeded();
await judge(page, {
    name: "B rubric builder with the no-S warning",
    expected: "classroom-eval-run-grade",
    shot: "rubric-no-s",
});
const draftAt = await aiButtonAt("grading-rubric-sentences");
await page.click(tid("grading-rubric-draft-ai-button"));
await waitIdle(page);
record({
    name: "draft: the AI is on top of 2-4, and it cannot be pressed again",
    ok:
        draftAt.top === "grading-rubric-draft-ai" &&
        draftAt.disabled === false &&
        (await page.isDisabled(tid("grading-rubric-draft-ai-button"))),
    detail: JSON.stringify(draftAt),
});
const rubricCall = evaluates.filter((e) => e.body.mode === "rubric").at(-1);
const levelS = await page.inputValue(tid("grading-rubric-level-S"));
record({
    name: "draft: the AI gets the teacher's answer and the fairness answer, the sentences are filled",
    ok:
        !!rubricCall &&
        rubricCall.body.examples.some(
            (e) => e.seatNumber === rep && e.grade === "A",
        ) &&
        rubricCall.body.examples.some((e) => e.grade === "B") &&
        /B にする/.test(rubricCall.body.assignmentText) &&
        levelS === DRAFT_LEVELS[0].text,
    detail: `examples=${JSON.stringify(rubricCall?.body.examples.map((e) => [e.seatNumber, e.grade]))} S=${levelS}`,
});
await judge(page, {
    name: "B rubric sentences drafted",
    expected: "classroom-eval-run-grade",
    shot: "rubric-drafted",
});
await page.fill(tid("grading-rubric-level-C"), "旗で動く台本を足していない");
await page.click(tid("grading-rubric-save"));
await page.waitForSelector(tid("grading-rubric-saved"));
const savePut = puts.filter((p) => p.id === "c2" && p.updates.rubric).at(-1);
record({
    name: "save: the sentences (with the teacher's edit) and the examples are saved",
    ok:
        savePut !== copyPut &&
        savePut.updates.rubric.levels.find((l) => l.grade === "C")?.text ===
            "旗で動く台本を足していない" &&
        (savePut.updates.rubric.examples || []).length >= 2,
    detail: JSON.stringify({
        levels: savePut?.updates.rubric.levels.map((l) => l.grade),
        examples: savePut?.updates.rubric.examples?.length,
    }),
});
await page
    .locator(tid("grading-rubric-saved"))
    .evaluate((e) => e.scrollIntoView({ block: "start" }));
await judge(page, {
    name: "B rubric saved",
    expected: "classroom-eval-run-grade",
    shot: "rubric-saved",
});

// 全員を採点: 保存した基準の文と例が AI に渡る
await page.click(tid("classroom-eval-run-grade"));
await waitIdle(page);
await page.waitForTimeout(1500); // the delayed save (0.8 s)
const gradeCall = evaluates.filter((e) => e.body.mode === "grade").at(-1);
record({
    name: "grade everyone: the AI gets the saved rubric sentences and examples",
    ok:
        gradeCall !== proposeCall &&
        gradeCall.body.rubricLevels?.some(
            (l) => l.text === "旗で動く台本を足していない",
        ) &&
        (gradeCall.body.examples || []).length >= 2 &&
        // The sentences grade: no criteria are sent (#2455 F2).
        (gradeCall.body.rubricAxes || []).length === 0,
    detail: `levels=${gradeCall?.body.rubricLevels?.length} examples=${gradeCall?.body.examples?.length} axes=${gradeCall?.body.rubricAxes?.length}`,
});
// 10 人ずつのまとまりの間: 前のまとまりの新しい形の作品が例に足され、同じ形で評価が違えば要確認
const gradeCalls = evaluates
    .slice(evaluates.indexOf(proposeCall) + 1)
    .filter((e) => e.body.mode === "grade");
const exampleCounts = gradeCalls.map((e) => (e.body.examples || []).length);
const teacherExamples = savePut.updates.rubric.examples.length;
record({
    name: "grade everyone: the examples carry one work per new shape to the next chunks (after the teacher's)",
    ok:
        gradeCalls.length >= 2 &&
        exampleCounts[0] === teacherExamples &&
        exampleCounts[1] > teacherExamples &&
        gradeCalls[1].body.examples
            .slice(0, teacherExamples)
            .every(
                (e, i) =>
                    e.seatNumber ===
                    savePut.updates.rubric.examples[i].seatNumber,
            ),
    detail: `examples per chunk=${exampleCounts} teacher=${teacherExamples}`,
});
const inconsistentText = await text(page, "classroom-eval-result");
record({
    name: "grade everyone: works of the same shape with different grades are 「要確認」 and the result says so",
    ok:
        /同じ形なのに評価が違う作品が \d+ 件あります（要確認）/.test(
            inconsistentText,
        ) ||
        (LOCALE === "ja-Hira" && /ようかくにん/.test(inconsistentText)),
    detail: inconsistentText,
});
await judge(page, {
    name: "grade everyone with inconsistent shapes",
    expected: "classroom-eval-confirm",
    shot: "grade-inconsistent",
});

// ---- C. 確定と取り消し ----
await page.click(tid("classroom-eval-confirm"));
await waitIdle(page);
await page.waitForSelector(tid("classroom-eval-confirmed"));
const confirmPuts = () =>
    puts.filter((p) => p.id === "c2" && "confirmedAt" in p.updates);
record({
    name: "confirm: confirmedAt is saved and 「確定」 is shown",
    ok: typeof confirmPuts().at(-1)?.updates.confirmedAt === "string",
    detail: JSON.stringify(confirmPuts().map((p) => p.updates.confirmedAt)),
});
await judge(page, {
    name: "C confirmed",
    expected: "classroom-eval-run-comment",
    shot: "confirmed",
});

// 評価の分布 (#2457): S の人数は、評価を変えるとすぐ変わる
const distS = () =>
    page.evaluate(() =>
        Number(
            document.querySelector(
                '[data-testid="classroom-eval-dist-grade-S"] b',
            )?.textContent,
        ),
    );
const distBefore = await page.evaluate(() => ({
    sa: document.querySelector('[data-testid="classroom-eval-dist-sa"]')
        ?.textContent,
    s: document.querySelector('[data-testid="classroom-eval-dist-s"]')
        ?.textContent,
    base: document.querySelector('[data-testid="classroom-eval-dist-base"]')
        ?.textContent,
}));
const sBefore = await distS();
await page.click(tid("classroom-eval-cell-button-4-c2"));
await page.waitForSelector(tid("classroom-eval-grade-4-c2"));
const before4 = await page.inputValue(tid("classroom-eval-grade-4-c2"));
await page.selectOption(
    tid("classroom-eval-grade-4-c2"),
    before4 === "S" ? "A" : "S",
);
await page.waitForSelector(tid("classroom-eval-unconfirmed"));
const sAfter = await distS();
record({
    name: "distribution: S/A/B/C, S+A and S with %, and S changes with a grade",
    ok:
        /S\+A.*%/.test(distBefore.sa || "") &&
        /%/.test(distBefore.s || "") &&
        !!distBefore.base &&
        sAfter === sBefore + (before4 === "S" ? -1 : 1),
    detail: JSON.stringify({ ...distBefore, sBefore, sAfter }),
});
if (await page.locator(tid("grading-group-prompt-no")).count()) {
    await page.click(tid("grading-group-prompt-no"));
}
await page.waitForTimeout(1500); // the delayed save
await waitSaved(page);
const unconfirmPut = confirmPuts().at(-1);
const unconfirmState = await page.evaluate(() => ({
    note: document.querySelector('[data-testid="classroom-eval-unconfirmed"]')
        ?.textContent,
    confirmed: !!document.querySelector(
        '[data-testid="classroom-eval-confirmed"]',
    ),
}));
record({
    name: "unconfirm: changing a grade after confirming saves confirmedAt null and says so",
    ok:
        unconfirmPut?.updates.confirmedAt === null &&
        unconfirmPut.updates.grades?.["4"]?.source === "teacher" &&
        !unconfirmState.confirmed &&
        /確定|かくてい/.test(unconfirmState.note || ""),
    detail: JSON.stringify({
        put: unconfirmPut?.updates.confirmedAt,
        ...unconfirmState,
    }),
});
await judge(page, {
    name: "C unconfirmed by an edit",
    expected: "classroom-eval-confirm",
    shot: "unconfirmed",
});

// ---- D. 総合評価 ----
await page.click(tid("classroom-eval-back-to-book"));
await page.waitForSelector(tid("classroom-gradebook"));
await page.click(tid("classroom-gradebook-switch-overall"));
await page.waitForSelector(tid("classroom-overall-table"));
const overall1 = await page.evaluate(() => ({
    warn: document.querySelector(
        '[data-testid="classroom-overall-unconfirmed"]',
    )?.textContent,
    link: !!document.querySelector('[data-testid="classroom-overall-open-c2"]'),
    exportDisabled: document.querySelector(
        '[data-testid="classroom-overall-export"]',
    )?.disabled,
    included: ["c0", "c1", "c2"].map(
        (id) =>
            document.querySelector(
                `[data-testid="classroom-overall-include-${id}"]`,
            )?.checked,
    ),
}));
record({
    name: "overall: an unconfirmed assignment is warned with a link, and the CSV cannot be exported",
    ok:
        !!overall1.warn &&
        overall1.link &&
        overall1.exportDisabled === true &&
        overall1.included.every(Boolean),
    detail: JSON.stringify(overall1),
});
await judge(page, {
    name: "D overall with an unconfirmed assignment",
    expected: null,
    shot: "overall-unconfirmed",
});
await page.click(tid("classroom-overall-open-c2"));
await page.waitForSelector(tid("classroom-eval-steps"));
const reopened = await text(page, "classroom-eval-assignment-title");
record({
    name: "overall: the link opens the grading of that assignment",
    ok: /04_モーター/.test(reopened || ""),
    detail: reopened,
});
if (await page.locator(`${tid("classroom-eval-confirm")}:disabled`).count()) {
    await page.click(tid("classroom-eval-load"));
    await waitIdle(page);
}
await page.click(tid("classroom-eval-confirm"));
await waitIdle(page);
await page.waitForSelector(tid("classroom-eval-confirmed"));
await page.click(tid("classroom-eval-back-to-book"));
await page.waitForSelector(tid("classroom-gradebook"));
await page.click(tid("classroom-gradebook-switch-overall"));
await page.waitForSelector(tid("classroom-overall-table"));
await page.waitForFunction(
    () =>
        document.querySelector('[data-testid="classroom-overall-export"]')
            ?.disabled === false,
    null,
    { timeout: 10000 },
);
// 1 番の平均と総合: 既定の点 (S4 A3 B2 C1 未提出0)・区切り (S3.5 A2.5 B1.5)・重み 1。
const points = { S: 4, A: 3, B: 2, C: 1 };
const g2 = gradings.c2.grades["1"]?.grade;
const expectedAvg =
    (points[LEGACY_GRADES[1]] +
        points[gradings.c1.grades["1"].grade] +
        points[g2]) /
    3;
const overall2 = await page.evaluate(() => ({
    warn: !!document.querySelector(
        '[data-testid="classroom-overall-unconfirmed"]',
    ),
    avg: document.querySelector('[data-testid="classroom-overall-average-1"]')
        ?.textContent,
    grade: document.querySelector('[data-testid="classroom-overall-grade-1"]')
        ?.textContent,
}));
const expectedGrade =
    expectedAvg >= 3.5
        ? "S"
        : expectedAvg >= 2.5
          ? "A"
          : expectedAvg >= 1.5
            ? "B"
            : "C";
record({
    name: "overall: after confirming, no warning; seat 1's average and grade follow the default points",
    ok:
        !overall2.warn &&
        overall2.avg === expectedAvg.toFixed(2) &&
        overall2.grade === expectedGrade,
    detail: `${JSON.stringify(overall2)} expected ${expectedAvg.toFixed(2)} ${expectedGrade}`,
});
const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click(tid("classroom-overall-export")),
]);
const csv = (await readFile(await download.path(), "utf8")).replace(/^﻿/, "");
const csvLines = csv.trim().split(/\r?\n/);
record({
    name: "overall CSV: the file has the 3 assignments, the average and the overall grade",
    ok:
        /総合評価|そうごうひょうか/.test(download.suggestedFilename()) &&
        ["01_ねこ", "02_LED", "04_モーター"].every((n) =>
            csvLines[0].includes(n),
        ) &&
        csvLines.length - 1 === submittedSeats.length &&
        csvLines.some((l) => l.startsWith("1,") && l.includes(expectedGrade)),
    detail: `${download.suggestedFilename()} · ${csvLines[0]} · rows ${csvLines.length - 1}`,
});
await judge(page, {
    name: "D overall all confirmed",
    expected: null,
    shot: "overall",
});

// ---- E. 処理中・結果の表示（コメントの返却・AI の失敗） ----
await page.click(tid("classroom-gradebook-switch-book"));
await page.click(tid("classroom-gradebook-open-c2"));
await page.waitForSelector(tid("classroom-eval-steps"));
if (
    await page.locator(`${tid("classroom-eval-run-comment")}:disabled`).count()
) {
    await page.click(tid("classroom-eval-load"));
    await waitIdle(page);
}
await page.click(tid("classroom-eval-run-comment"));
await waitIdle(page);
await page.waitForTimeout(300);
await page.click(tid("classroom-eval-return-comments"));
await page.waitForSelector(tid("classroom-eval-return-comments-running"));
await page.waitForFunction(
    () =>
        /\(\d+\/\d+\)|（\d+\/\d+）/.test(
            document.querySelector(
                '[data-testid="classroom-eval-progress-text"]',
            )?.textContent || "",
        ),
    null,
    { timeout: 10000 },
);
await page.waitForTimeout(1200);
await judge(page, {
    name: "E returning comments",
    expected: "classroom-eval-return-comments",
    shot: "returning",
});
await waitIdle(page);
await page.waitForSelector(tid("classroom-eval-result"));
const returned = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="classroom-eval-result"]');
    return { text: el?.textContent, failed: el?.getAttribute("data-failed") };
});
record({
    name: "return: every comment is returned (PATCH status returned) and the result is shown",
    ok:
        patches.length === submittedSeats.length &&
        patches.every(
            (p) => p.body.status === "returned" && p.body.teacherComment,
        ) &&
        returned.failed !== "true" &&
        returned.text.includes(String(submittedSeats.length)),
    detail: `patches=${patches.length} ${JSON.stringify(returned)}`,
});
await judge(page, {
    name: "E returned",
    expected: null,
    shot: "returned",
});

failNextGrade = true;
await page.click(tid("classroom-eval-run-grade"));
await page.waitForSelector(
    `${tid("classroom-eval-result")}[data-failed="true"]`,
    {
        timeout: 20000,
    },
);
await waitIdle(page);
await page.waitForTimeout(300);
const failed = await text(page, "classroom-eval-result");
record({
    name: "grade failed: the red result says the AI grading stopped",
    ok: /AI/.test(failed || ""),
    detail: failed,
});
await judge(page, {
    name: "E AI grading failed",
    expected: null,
    shot: "grade-failed",
});

await browser.close();
const failedRows = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failedRows.length}/${rows.length} passed`);
process.exit(failedRows.length ? 1 : 0);
