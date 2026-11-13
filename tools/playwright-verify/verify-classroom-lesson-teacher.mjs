// The lesson parts of the teacher's other screens (EPIC #1592 / #1603) at the
// lesson PC size (1300x600): the class screen row (「レッスン」 mark and
// 「課題クリア N」), the seat detail on the right (per-challenge rows), the
// 「いまの課題の状況」 floating panel (40 seats, cleared / stuck counts,
// per-challenge bars) and the grading screen (「レッスン」 column).
// The classroom API is stubbed with page.route, so no login or stg data is
// needed — only the dev server.
//
//   node verify-classroom-lesson-teacher.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-lesson-teacher.mjs    # + docs/classroom/screenshots
//   BASE=http://localhost:8611 node verify-classroom-lesson-teacher.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "http://localhost:8601";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, "tmp");
const DOCS_DIR = resolve(REPO_ROOT, "docs/classroom/screenshots");
const DOCS_SHOTS = process.env.DOCS_SHOTS === "1";
const VIEWPORT = { width: 1300, height: 600 };
mkdirSync(SHOT_DIR, { recursive: true });

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const assignment = (over) => ({
    className: "技術",
    studentCount: 40,
    googleClassroomCourseId: null,
    coTeacherEmails: [],
    groupId: "g1",
    topic: null,
    hasAssignment: true,
    status: "active",
    role: "owner",
    createdAt: iso(now - 10 * DAY),
    expiresAt: iso(now + 80 * DAY),
    sortDate: iso(now - 2 * DAY),
    meshGroupLimit: 6,
    ...over,
});
const classrooms = [
    assignment({
        classroomId: "c1",
        assignmentName: "レッスンをやろう",
        joinCode: "abc234",
        hasLesson: true,
    }),
];
// All 11 challenges of the course, ★ on 2, condition: 8.
const CH = [
    "blocks-l1-key-sound",
    "blocks-l1-arrow-move",
    "blocks-l1-click-say",
    "blocks-l1-repeat",
    "blocks-l1-if",
    "blocks-l1-ask-answer",
    "blocks-l1-quiz",
    "blocks-l1-count",
    "blocks-l1-broadcast",
    "blocks-l1-speak",
    "blocks-l1-message-list",
];
const lesson = {
    courseId: "kyou-kara-programmer",
    challengeIds: CH,
    requiredChallengeIds: ["blocks-l1-click-say", "blocks-l1-ask-answer"],
    completion: { type: "count", count: 8 },
    submitWork: true,
    scoring: null,
};
const MIN = 60 * 1000;
const JOINED = 34;
const members = [];
const progress = [];
for (let seat = 1; seat <= JOINED; seat++) {
    const memberId = `seat-${String(seat).padStart(2, "0")}`;
    members.push({
        memberId,
        displayName: `生徒${seat}`,
        joinedAt: iso(now - 40 * MIN),
        lastActiveAt: iso(now - 5 * MIN),
    });
    // seat % 5 == 0 → nothing yet, otherwise a varying number done
    const doneCount = seat % 5 === 0 ? 0 : seat % 12;
    const challenges = {};
    for (let i = 0; i < doneCount; i++)
        challenges[CH[i]] = {
            completedAt: iso(now - (30 - i) * MIN),
            before: i === 0 && seat % 3 === 0,
        };
    const cur = doneCount < CH.length ? CH[doneCount] : null;
    progress.push({
        memberId,
        seatNumber: seat,
        challenges,
        current: cur
            ? {
                  challengeId: cur,
                  openedAt: iso(now - (seat % 4 === 0 ? 14 : 2) * MIN),
              }
            : null,
        updatedAt: iso(now - MIN),
    });
}
const submissions = [
    {
        memberId: "seat-11",
        submissionId: "s11",
        submittedAt: iso(now - MIN),
        status: "submitted",
        projectName: "さくひん",
        projectUrl: "https://example.invalid/p.sb3",
    },
];

const results = [];
const record = (name, ok, detail = "") => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
};

const browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false",
    args: ["--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "ja-JP" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.route("**/notifications", (r) =>
    r.fulfill({ json: { notifications: [], unreadCount: 0 } }),
);
await page.route(/\/kick-requests/, (r) =>
    r.fulfill({ json: { requests: [], activeAssignmentCount: 1 } }),
);
await page.route("https://example.invalid/**", (r) =>
    r.fulfill({ status: 404, body: "" }),
);
await page.route("**/classroom-groups", (r) =>
    r.fulfill({
        json: {
            groups: [
                {
                    groupId: "g1",
                    name: "技術",
                    year: 2026,
                    section: "2年1組",
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
    r.fulfill({ json: { classrooms } }),
);
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms } }));
await page.route(/\/classrooms\/c\d$/, (r) => {
    const id = r
        .request()
        .url()
        .match(/\/classrooms\/(c\d)$/)[1];
    return r.fulfill({ json: classrooms.find((c) => c.classroomId === id) });
});
await page.route(/\/classrooms\/c\d\/members$/, (r) =>
    r.fulfill({ json: { members } }),
);
await page.route(/\/classrooms\/c\d\/submissions$/, (r) =>
    r.fulfill({ json: { submissions } }),
);
let progressGets = 0;
await page.route(/\/classrooms\/c\d\/lesson-progress$/, (r) => {
    progressGets += 1;
    return r.fulfill({ json: { lesson, progress } });
});
await page.route(/\/classrooms\/c\d\/assignment$/, (r) =>
    r.fulfill({
        json: {
            assignment: { pages: [{ text: "レッスンを進めよう。" }] },
            lesson,
        },
    }),
);

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name, docsName) => {
    await page.screenshot({
        path: resolve(SHOT_DIR, `issue-1603-${name}.png`),
    });
    if (DOCS_SHOTS && docsName)
        await page.screenshot({ path: resolve(DOCS_DIR, docsName) });
};
const text = (id) => page.$eval(tid(id), (el) => el.textContent);
const BODY = '[data-testid="classroom-teacher-modal"] main';
const box = (sel) =>
    page.$eval(sel, (el) => {
        const r = el.getBoundingClientRect();
        return {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            left: Math.round(r.left),
            right: Math.round(r.right),
            sh: el.scrollHeight,
            ch: el.clientHeight,
        };
    });
const pageScrolls = () =>
    page.evaluate(
        () =>
            document.scrollingElement.scrollHeight >
            document.scrollingElement.clientHeight,
    );

try {
    await page.goto(
        `${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`,
        { waitUntil: "load" },
    );
    await page.waitForTimeout(3000);
    await page.addStyleTag({
        content:
            "#webpack-dev-server-client-overlay { display: none !important; }",
    });

    // 1. The「いまの課題の状況」panel: 40 seats + 11 challenges in 600px.
    await page.click(tid("classroom-teacher-menu-button"));
    await page.click(tid("classroom-teacher-menu-status-panel"));
    await page.waitForSelector(tid("classroom-teacher-panel"));
    await page
        .selectOption(tid("classroom-teacher-panel-assignment"), "c1")
        .catch(() => {});
    await page.waitForSelector(tid("classroom-teacher-panel-lesson-bars"), {
        timeout: 20000,
    });
    await page.waitForTimeout(800);
    const panel = await box(tid("classroom-teacher-panel"));
    const panelBody = await box(tid("classroom-teacher-panel-body"));
    const barList = await page.$eval(
        `${tid("classroom-teacher-panel-lesson-bars")} > div:last-child`,
        (el) => `${el.scrollHeight}/${el.clientHeight}`,
    );
    record(
        "panel: the 11 bars fit without scrolling their frame",
        barList.split("/")[0] === barList.split("/")[1],
        `bars frame ${barList}`,
    );
    record(
        "panel: 40 seats + 11 bars fit in 1300x600 without scrolling the body",
        panel.top >= 0 &&
            panel.bottom <= VIEWPORT.height &&
            panelBody.sh <= panelBody.ch,
        `panel(${tid("classroom-teacher-panel")}) top=${panel.top} bottom=${panel.bottom}/${VIEWPORT.height} ` +
            `body(${tid("classroom-teacher-panel-body")}) ${panelBody.sh}/${panelBody.ch}`,
    );
    record(
        "panel: cleared / stuck",
        /課題クリア \d+ \/ 34/.test(
            await text("classroom-teacher-panel-lesson-cleared"),
        ),
        `${await text("classroom-teacher-panel-lesson-cleared")} · ${await text("classroom-teacher-panel-lesson-stuck")}`,
    );
    record(
        "panel: seat 4 has「!」",
        !!(await page.$(tid("classroom-teacher-panel-seat-stuck-4"))),
    );
    record(
        "panel: no「!」on cleared seat 8",
        !(await page.$(tid("classroom-teacher-panel-seat-stuck-8"))),
    );
    const bars = await page.$$eval(
        '[data-testid^="classroom-teacher-panel-bar-blocks"]',
        (els) => els.length,
    );
    record("panel: one bar per challenge", bars === CH.length, `bars=${bars}`);
    await shot("panel", "0249-teacher-status-panel-lesson.png");
    await page.$eval(tid("classroom-teacher-panel-close"), (el) => el.click());

    // 2. Board row: lesson mark + 課題クリア N.
    await page.$eval(tid("classroom-teacher-menu-button"), (el) => el.click());
    await page.waitForTimeout(300);
    await page.$eval(tid("classroom-teacher-menu-class-list"), (el) =>
        el.click(),
    );
    await page.locator(tid("classroom-class-open-g1")).click();
    await page.waitForSelector(tid("classroom-board"), { timeout: 20000 });
    await page.locator(tid("classroom-board-tab-classwork")).click();
    await page.waitForTimeout(500);
    record(
        "board: lesson mark on the closed row",
        (await text("classroom-board-lesson-mark-c1")) === "レッスン",
    );
    await page.locator(tid("classroom-board-row-toggle-c1")).click();
    await page.waitForSelector(tid("classroom-board-row-lesson-cleared-c1"), {
        timeout: 10000,
    });
    record(
        "board: 課題クリア N in the opened row",
        /課題クリア \d+/.test(
            await text("classroom-board-row-lesson-cleared-c1"),
        ),
        await text("classroom-board-row-lesson-cleared-c1"),
    );
    const openBtn = await box(tid("classroom-board-open-c1"));
    record(
        "board: R6 (open button visible, page does not scroll)",
        openBtn.bottom <= VIEWPORT.height && !(await pageScrolls()),
        `open(${tid("classroom-board-open-c1")}).bottom=${openBtn.bottom}`,
    );
    await shot("board-row");

    // 3. Seat detail on the right.
    await page.locator(tid("classroom-board-open-c1")).click();
    await page.waitForSelector(tid("classroom-phase-teacher-detail"), {
        timeout: 20000,
    });
    await page.waitForSelector(tid("classroom-lesson-seat-legend"), {
        timeout: 10000,
    });
    await page.locator(tid("classroom-member-seat-11")).click();
    await page.waitForSelector(tid("classroom-member-lesson-detail"), {
        timeout: 10000,
    });
    await page.waitForTimeout(400);
    const list = await box(tid("classroom-member-lesson-detail-list"));
    const ret = await box(tid("classroom-member-detail-return"));
    const main = await box(BODY);
    const pane = await box(tid("classroom-member-detail"));
    record(
        "seat detail: inside the 1300px width",
        pane.right <= VIEWPORT.width,
        `member-detail.right=${pane.right}`,
    );
    record(
        "seat detail (work too): R6 — only the challenge list scrolls, the return button is visible",
        !(await pageScrolls()) &&
            main.sh <= main.ch &&
            ret.bottom <= VIEWPORT.height &&
            list.bottom <= VIEWPORT.height,
        `body(${BODY}) ${main.sh}/${main.ch} list(${tid("classroom-member-lesson-detail-list")}) ${list.sh}/${list.ch} ` +
            `bottom=${list.bottom} return(${tid("classroom-member-detail-return")}).bottom=${ret.bottom}/${VIEWPORT.height}`,
    );
    await page.locator(tid("classroom-member-seat-04")).click();
    await page.waitForTimeout(300);
    const kinds = await page.$$eval(
        '[data-testid^="classroom-member-lesson-detail-blocks"]',
        (els) => els.map((e) => e.dataset.kind),
    );
    record(
        "seat detail: kinds (seat 4: 4 done, 5th stuck)",
        kinds[4] === "stuck" && kinds[0] !== "todo",
        kinds.join(","),
    );
    await shot("member-detail", "0250-detail-lesson-member-detail.png");

    // 4. Grading: the「レッスン」column next to the work.
    await page.locator(tid("classroom-breadcrumb-class-list")).click();
    await page.waitForTimeout(500);
    await page.locator(tid("classroom-class-evaluate-g1")).click();
    await page.waitForSelector(tid("classroom-eval-load"), { timeout: 10000 });
    await page.locator(tid("classroom-eval-load")).click();
    await page.waitForSelector(tid("classroom-eval-lesson-head-c1"), {
        timeout: 20000,
    });
    await page.waitForTimeout(400);
    record(
        "grading: lesson column",
        (await text("classroom-eval-lesson-head-c1")) === "レッスン（自動）",
    );
    record(
        "grading: score of seat 11 (all done)",
        (await text("classroom-eval-lesson-score-11-c1")) === "100",
        await text("classroom-eval-lesson-score-11-c1"),
    );
    const step = await box(tid("classroom-eval-run-grade"));
    record(
        "grading: R6 (step button visible, page does not scroll)",
        step.bottom <= VIEWPORT.height && !(await pageScrolls()),
        `step(${tid("classroom-eval-run-grade")}).bottom=${step.bottom}/${VIEWPORT.height}`,
    );
    await shot("grading", "0251-teacher-grading-lesson.png");
} catch (e) {
    record("script", false, e.stack);
    await shot("error");
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
