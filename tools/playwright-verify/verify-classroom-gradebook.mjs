/**
 * 採点簿と課題ごとの採点 (EPIC #2421 / #2424) を 1300×600 で開いて確かめる。
 *
 * 採点簿 → 列の見出しで課題の採点 → 提出を読み込む → 基準をつくる（入口）→ 全員を採点 → 確定 →
 * 採点簿に戻る、を通して、
 *   - いまの手順のボタン (aria-current="step") が正しいか・その下端が 600 以下か (R6)
 *   - 画面 ([data-testid="classroom-phase-teacher-evaluation"]) とページがスクロールしないか
 *     (40 人の一覧は例外: 採点簿の表の枠 / 席の一覧の枠の中だけスクロール可)
 *   - 採点が PUT /grading に保存され、確定のあと採点簿の列が「確定」になり、点線の AI の案が消えるか
 *   - セルを押すと、その席を選んで課題の採点（［生徒］）を開くか
 * を一覧で出す。1 つでも外れたら exit 1。
 *
 * classroom API は route interception でスタブするので stg デプロイ不要 (dev server だけが前提)。
 * スクショは tmp/classroom-gradebook-*.png。
 *
 *   node verify-classroom-gradebook.mjs                    # コンテナ内 (headless)
 *   BASE=http://localhost:8624 node verify-classroom-gradebook.mjs
 *   DOCS_SHOTS=1 node verify-classroom-gradebook.mjs       # docs/classroom/screenshots も撮り直す
 *   LOCALE=ja-Hira node verify-classroom-gradebook.mjs     # ひらがなで測る (DOCS_SHOTS は ja のときだけ)
 */
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

// 撮った画面 → docs/classroom/screenshots。
const DOC_SHOT_NAMES = {
    gradebook: "0353-teacher-gradebook.png",
    "assignment-before-load": "0233-teacher-grading-load.png",
    "assignment-loaded": "0234-teacher-grading-loaded.png",
    "student-tab": "0354-teacher-grading-student.png",
    confirmed: "0355-teacher-grading-confirmed.png",
    "gradebook-after-confirm": "0356-teacher-gradebook-confirmed.png",
    overall: "0357-teacher-grading-overall.png",
    loading: "0348-teacher-grading-loading.png",
    "ai-grading": "0349-teacher-grading-ai-grading.png",
    "hint-open": "0237-teacher-grading-hint-detail.png",
    "export-menu": "0236-teacher-grading-export-menu.png",
    "leave-confirm": "0259-teacher-grading-leave-confirm.png",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LONG_CLASS = "3年2組 技術・家庭科（情報の技術）";
const OLD = {
    classroomId: "c1",
    assignmentName: "02_LED",
    createdAt: "2026-10-10T00:00:00.000Z",
};
const NEW = {
    classroomId: "c2",
    assignmentName: "04_モーター",
    createdAt: "2026-11-10T00:00:00.000Z",
};
const LESSONS = [OLD, NEW];
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

// 保存した採点（サーバーの代わり）。古い課題は確定済み、新しい課題はまだ無い。
const gradings = {
    c1: {
        rubric: {
            levels: [
                {
                    grade: "S",
                    text: "課題を満たしたうえで、ほかの人が使っていないブロックで工夫している",
                },
                {
                    grade: "A",
                    text: "明るさで LED を点ける・消すを切りかえている",
                },
                {
                    grade: "B",
                    text: "LED を動かしているが、明るさで切りかえていない",
                },
                { grade: "C", text: "動く台本を足していない" },
            ],
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

const makeSb3 = async () => {
    const zip = new JSZip();
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
                    blocks: {
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
                            next: null,
                            parent: "a",
                            inputs: { STEPS: [1, [4, "10"]] },
                            fields: {},
                            topLevel: false,
                        },
                    },
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
        const frame =
            document.querySelector('[data-testid="classroom-eval-seat-list"]')
                ?.parentElement ||
            document.querySelector('[data-testid="classroom-gradebook"]')
                ?.parentElement ||
            null;
        const se = document.scrollingElement;
        const steps = document.querySelector(
            '[data-testid="classroom-eval-steps"]',
        );
        return {
            current: current ? current.getAttribute("data-testid") : null,
            primaryBottom: primary
                ? Math.round(primary.getBoundingClientRect().bottom)
                : null,
            rootScroll: el.scrollHeight,
            rootClient: el.clientHeight,
            frameScroll: frame ? frame.scrollHeight : null,
            frameClient: frame ? frame.clientHeight : null,
            pageScroll: se.scrollHeight,
            pageClient: se.clientHeight,
            pageScrollW: se.scrollWidth,
            pageClientW: se.clientWidth,
            stepsRight: steps
                ? Math.round(steps.getBoundingClientRect().right)
                : null,
            vh: window.innerHeight,
            vw: window.innerWidth,
        };
    }, ROOT);

const shoot = async (page, shot) => {
    await page.screenshot({
        path: resolve(
            SHOT_DIR,
            `classroom-gradebook-${shot}${LOCALE === "ja" ? "" : `-${LOCALE}`}.png`,
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

const judge = async (page, { name, expected, shot }) => {
    const m = await measure(page);
    const rootOk = m.rootScroll <= m.rootClient;
    const pageOk =
        m.pageScroll <= m.pageClient && m.pageScrollW <= m.pageClientW;
    const currentOk = expected === null ? true : m.current === expected;
    const bottomOk = m.primaryBottom !== null && m.primaryBottom <= m.vh;
    const stepsOk = m.stepsRight === null || m.stepsRight <= m.vw;
    record({
        name,
        ok: rootOk && pageOk && currentOk && bottomOk && stepsOk,
        detail:
            `current ${m.current} (expected ${expected}) primary bottom ${m.primaryBottom}/${m.vh}` +
            ` · screen ${rootOk ? "OK" : "NG"} ${m.rootScroll}/${m.rootClient}` +
            ` · page ${pageOk ? "OK" : "NG"} ${m.pageScroll}/${m.pageClient} w ${m.pageScrollW}/${m.pageClientW}` +
            ` · steps right ${m.stepsRight}/${m.vw}` +
            (m.frameScroll === null
                ? ""
                : ` · list frame ${m.frameScroll}/${m.frameClient}`),
    });
    await shoot(page, shot);
};

const waitIdle = (page) =>
    page.waitForFunction(
        () =>
            !document.querySelector('[data-testid="classroom-eval-progress"]'),
        null,
        {
            timeout: 30000,
        },
    );

const sb3 = await makeSb3();
const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "ja-JP" });
const page = await ctx.newPage();

await page.route("**/notifications", (r) =>
    r.fulfill({ json: { notifications: [], unreadCount: 0 } }),
);
await page.route("**/kick-requests/pending**", (r) =>
    r.fulfill({ json: { requests: [], activeAssignmentCount: 2 } }),
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
    await page.route(`**/classrooms/${id}/assignment`, (r) =>
        r.fulfill({
            json: {
                assignment: {
                    pages: [
                        {
                            text: "モーターとサーボモーターを動かし、本物のスイッチを ON / OFF できるか試す",
                        },
                    ],
                },
                lesson: null,
                startFromPrevious: false,
                peerView: "none",
            },
        }),
    );
    await page.route(`**/classrooms/${id}/submissions`, async (r) => {
        await sleep(1500); // long enough to see the loading state
        await r.fulfill({
            json: {
                submissions: submittedSeats.map((n) => ({
                    submissionId: `${id}-s${n}`,
                    memberId: seatId(n),
                    status: "submitted",
                    submittedAt: "2026-11-12T03:00:00.000Z",
                    projectUrl: `https://example.invalid/${id}/${n}.sb3`,
                })),
            },
        });
    });
    await page.route(`**/classrooms/${id}/evaluate`, async (r) => {
        const body = JSON.parse(r.request().postData() || "{}");
        lesson.lastEvaluate = body;
        await sleep(700);
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
await page.route("https://example.invalid/**", (r) =>
    r.fulfill({
        status: 200,
        body: sb3,
        headers: { "content-type": "application/octet-stream" },
    }),
);

await page.goto(
    `${BASE}/?no_beforeunload=1&locale=${LOCALE}&devlogin=stub-token`,
    { waitUntil: "load" },
);
await page.waitForTimeout(3000);
await page.locator('[data-testid="settings-menu"]').click();
await page.locator('[data-testid="settings-classroom-management"]').click();
await page.waitForSelector('[data-testid="classroom-class-evaluate-g1"]', {
    timeout: 20000,
});
await page.locator('[data-testid="classroom-class-evaluate-g1"]').click();
await page.waitForSelector('[data-testid="classroom-gradebook"]', {
    timeout: 20000,
});
await waitIdle(page);
await page.waitForTimeout(300);

// 1 採点簿: 新しい課題が左、上の行は S/A/B/C の人数、確定した課題の点はふつうの線。
const book1 = await page.evaluate(() => {
    const heads = [
        ...document.querySelectorAll(
            '[data-testid^="classroom-gradebook-col-"]',
        ),
    ].map((th) => th.getAttribute("data-testid"));
    return {
        heads,
        counts: document.querySelector(
            '[data-testid="classroom-gradebook-counts-c1"]',
        )?.textContent,
        rows: document.querySelectorAll(
            '[data-testid="classroom-gradebook"] tbody tr',
        ).length,
        drafts: document.querySelectorAll(
            '[data-testid="classroom-gradebook"] [data-draft="true"]',
        ).length,
    };
});
record({
    name: "gradebook: newest assignment on the left, counts row, 35 seat rows, no drafts",
    ok:
        book1.heads[0] === "classroom-gradebook-col-c2" &&
        book1.heads[1] === "classroom-gradebook-col-c1" &&
        /S\d+ A\d+ B\d+ C\d+/.test(book1.counts || "") &&
        book1.rows === submittedSeats.length + 1 &&
        book1.drafts === 0,
    detail: JSON.stringify(book1),
});
await judge(page, { name: "0 gradebook", expected: null, shot: "gradebook" });

await page.click('[data-testid="classroom-gradebook-switch-overall"]');
await page.waitForSelector('[data-testid="classroom-gradebook-overall"]');
await shoot(page, "overall");
await page.click('[data-testid="classroom-gradebook-switch-book"]');

// 2 列の見出しで課題の採点を開く
await page.click('[data-testid="classroom-gradebook-open-c2"]');
await page.waitForSelector('[data-testid="classroom-eval-steps"]');
await page.waitForTimeout(500);
// The ［基準］ tab of #2425 shows the description in grading-rubric-description; with a description,
// inner step 2-1 is done and folded into its one line (#2455).
const desc = await page.textContent(
    '[data-testid="classroom-eval-description"], [data-testid="grading-rubric-description"], ' +
        '[data-testid="grading-rubric-steps-summary-describe"]',
);
record({
    name: "assignment: the description is shown",
    ok: /モーター/.test(desc || ""),
    detail: desc,
});
await judge(page, {
    name: "1 assignment before loading",
    expected: "classroom-eval-load",
    shot: "assignment-before-load",
});

await page.click('[data-testid="classroom-eval-load"]');
await page.waitForSelector('[data-testid="classroom-eval-progress"]');
await shoot(page, "loading");
await page.waitForSelector('[data-testid="classroom-eval-seat-list"] li');
await waitIdle(page);
await page.waitForTimeout(300);
const seatCount = await page
    .locator('[data-testid="classroom-eval-seat-list"] li')
    .count();
record({
    name: "assignment: every member is listed (not submitted too)",
    ok: seatCount === SEATS,
    detail: `${seatCount}`,
});
await judge(page, {
    name: "2 loaded (40 seats)",
    expected: "classroom-eval-rubric",
    shot: "assignment-loaded",
});

await page.click('[data-testid="classroom-eval-rubric"]');
await page.waitForTimeout(200);
await judge(page, {
    name: "2 rubric looked at",
    expected: "classroom-eval-run-grade",
    shot: "rubric-tab",
});
await page.click('[data-testid="classroom-eval-hint-toggle"]');
await page.waitForTimeout(200);
await judge(page, {
    name: "2 hint opened",
    expected: "classroom-eval-run-grade",
    shot: "hint-open",
});
await page.click('[data-testid="classroom-eval-hint-toggle"]');
// #2455 F2: the criteria and the strictness are not on the screen any more.
record({
    name: "2 no grading criteria / strictness on the screen",
    ok: await page.evaluate(
        () =>
            !document.querySelector(
                '[data-testid="classroom-eval-settings-summary"], [data-testid="classroom-eval-strictness"]',
            ),
    ),
    detail: "",
});

await page.click('[data-testid="classroom-eval-run-grade"]');
await page.waitForSelector('[data-testid="classroom-eval-run-grade-running"]');
await shoot(page, "ai-grading");
await waitIdle(page);
await page.waitForTimeout(1500); // the delayed save (0.8 s)
record({
    name: "grade: the AI got the description, and the grades were saved as the AI's",
    ok:
        /モーター/.test(NEW.lastEvaluate?.assignmentText || "") &&
        puts.some(
            (p) =>
                p.id === "c2" &&
                Object.values(p.updates.grades || {}).every(
                    (g) => g.source === "ai",
                ),
        ),
    detail: `assignmentText=${JSON.stringify(NEW.lastEvaluate?.assignmentText)} puts=${puts.length}`,
});
// No rubric yet: the screen sends the fixed criteria with the standard strictness (#2455 F2).
record({
    name: "grade: without a rubric, the fixed criteria are sent",
    ok:
        JSON.stringify(
            (NEW.lastEvaluate?.rubricAxes || []).map((a) => a.name),
        ) === JSON.stringify(["動くこと", "課題の要件", "工夫"]) &&
        NEW.lastEvaluate?.strictness === "standard",
    detail: JSON.stringify(NEW.lastEvaluate?.rubricAxes?.map((a) => a.name)),
});
await judge(page, {
    name: "3 graded",
    expected: "classroom-eval-confirm",
    shot: "graded",
});

await page.click('[data-testid="classroom-eval-cell-button-4-c2"]');
await page.waitForTimeout(200);
const student = await page.evaluate(() => ({
    tab: document
        .querySelector('[data-testid="classroom-eval-tab-student"]')
        ?.getAttribute("aria-selected"),
    title: document.querySelector('[data-testid="classroom-eval-detail-title"]')
        ?.textContent,
}));
record({
    name: "student tab shows seat 04",
    ok: student.tab === "true" && /04/.test(student.title || ""),
    detail: JSON.stringify(student),
});
await judge(page, {
    name: "3 seat 04 chosen",
    expected: "classroom-eval-confirm",
    shot: "student-tab",
});

await page.click('[data-testid="classroom-eval-confirm"]');
await waitIdle(page);
await page.waitForTimeout(300);
const confirmPut = puts.filter(
    (p) => p.id === "c2" && typeof p.updates.confirmedAt === "string",
).length;
record({
    name: "confirm: confirmedAt was saved",
    ok: confirmPut === 1,
    detail: `${confirmPut}`,
});
await judge(page, {
    name: "4 confirmed",
    expected: "classroom-eval-run-comment",
    shot: "confirmed",
});

await page.click('[data-testid="classroom-eval-run-comment"]');
await waitIdle(page);
await page.waitForTimeout(300);
await judge(page, {
    name: "5 comments drafted",
    expected: "classroom-eval-return-comments",
    shot: "comments",
});
await page.click('[data-testid="classroom-eval-export-menu"]');
await page.waitForTimeout(200);
const menu = await page.evaluate(() =>
    [...document.querySelectorAll('[role="menuitem"]')].map((e) =>
        Math.round(e.getBoundingClientRect().bottom),
    ),
);
record({
    name: "export menu open inside the screen",
    ok: menu.length === 2 && menu.every((b) => b <= 600),
    detail: `${menu}`,
});
await shoot(page, "export-menu");
await page.click('[data-testid="classroom-eval-export-menu"]');

// 5 採点簿に戻る: 列は「確定」、点線は無い
await page.click('[data-testid="classroom-eval-back-to-book"]');
await page.waitForSelector('[data-testid="classroom-gradebook"]');
await page.waitForTimeout(300);
const book2 = await page.evaluate(() => ({
    state: document.querySelector('[data-testid="classroom-gradebook-col-c2"]')
        ?.textContent,
    drafts: document.querySelectorAll(
        '[data-testid="classroom-gradebook"] [data-draft="true"]',
    ).length,
    cell: document.querySelector(
        '[data-testid="classroom-gradebook-cell-1-c2"]',
    )?.textContent,
}));
record({
    name: "gradebook after confirming: the column is confirmed and has no drafts",
    ok:
        /確定|かくてい/.test(book2.state || "") &&
        book2.drafts === 0 &&
        /[SABC]/.test(book2.cell || ""),
    detail: JSON.stringify(book2),
});
await judge(page, {
    name: "5 back to the gradebook",
    expected: null,
    shot: "gradebook-after-confirm",
});

// 離れる確認: 返却していないコメントがあるので、キャンセルで確かめる（採点は保存してあるので数えない）。
await page.click('[data-testid="classroom-evaluation-cancel"]');
await page.waitForSelector(
    '[data-testid="classroom-eval-leave-confirm-message"]',
);
const leave = await page.evaluate(() => {
    const msg = document.querySelector(
        '[data-testid="classroom-eval-leave-confirm-message"]',
    );
    const yes = document.querySelector(
        '[data-testid="classroom-eval-leave-confirm"]',
    );
    return {
        lost: msg.getAttribute("data-lost"),
        text: msg.textContent,
        yesBottom: Math.round(yes.getBoundingClientRect().bottom),
    };
});
record({
    name: "leave confirm: only the comments are lost, [戻る] is visible",
    ok: leave.lost === "comments" && leave.yesBottom <= 600,
    detail: JSON.stringify(leave),
});
await shoot(page, "leave-confirm");
await page.click('[data-testid="classroom-eval-leave-cancel"]');

// 6 セルを押すと、その席を選んで開く
await page.click('[data-testid="classroom-gradebook-cell-5-c1"] button');
await page.waitForSelector('[data-testid="classroom-eval-steps"]');
const opened = await page.evaluate(() => ({
    title: document.querySelector(
        '[data-testid="classroom-eval-assignment-title"]',
    )?.textContent,
    pressed: document
        .querySelector('[data-testid="classroom-eval-cell-button-5-c1"]')
        ?.getAttribute("aria-pressed"),
    tab: document
        .querySelector('[data-testid="classroom-eval-tab-student"]')
        ?.getAttribute("aria-selected"),
}));
record({
    name: "a gradebook cell opens the assignment with that seat chosen",
    ok:
        /02_LED/.test(opened.title || "") &&
        opened.pressed === "true" &&
        opened.tab === "true",
    detail: JSON.stringify(opened),
});

await browser.close();
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
process.exit(failed.length ? 1 : 0);
