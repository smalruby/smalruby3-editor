// Lesson scoring on the grading screen (#1778) at the lesson PC size
// (1300x600): two lesson assignments without work are selected, so the AI is
// not used (① 進み具合を読み込む → ② 点を確かめる → ③ 書き出す) and the
// 「レッスンの点」 field is shown for each.
//   - c1: 8 challenges, condition 6, ★ 6 (r = n) — doing the 6 required ones
//     gives 100 (it used to be 70), and the required points field is not used.
//   - c2: 6 challenges, 「全部」, ★ 2 — changing the required points saves the
//     assignment (the pages are sent back) and the table changes at once.
// The classroom API is stubbed with page.route, so no login or stg data is
// needed — only the dev server.
//
//   node verify-classroom-lesson-scoring.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-lesson-scoring.mjs    # + docs/classroom/screenshots
//   BASE=http://localhost:8611 node verify-classroom-lesson-scoring.mjs
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
const MIN = 60 * 1000;
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
    hasLesson: true,
    ...over,
});
const classrooms = [
    assignment({
        classroomId: "c1",
        assignmentName: "レッスン1",
        joinCode: "abc234",
    }),
    assignment({
        classroomId: "c2",
        assignmentName: "レッスン2",
        joinCode: "def567",
    }),
];
const CH = [
    "blocks-l1-key-sound",
    "blocks-l1-arrow-move",
    "blocks-l1-click-say",
    "blocks-l1-repeat",
    "blocks-l1-if",
    "blocks-l1-ask-answer",
    "blocks-l1-quiz",
    "blocks-l1-count",
];
const lessons = {
    c1: {
        courseId: "kyou-kara-programmer",
        challengeIds: CH,
        requiredChallengeIds: CH.slice(0, 6),
        completion: { type: "count", count: 6 },
        submitWork: false,
        // Saved before #1778 with the default required points.
        scoring: { total: 100, requiredPoints: 70, optionalPoints: 30 },
    },
    c2: {
        courseId: "kyou-kara-programmer",
        challengeIds: CH.slice(0, 6),
        requiredChallengeIds: [CH[0], CH[3]],
        completion: { type: "all" },
        submitWork: false,
        scoring: null,
    },
};
const progressOf = (classroomId) => {
    const progress = [];
    for (let seat = 1; seat <= 6; seat++) {
        // seat 1: the 6 required ones (c1) / ★ 2 only (c2); others vary
        const ids =
            seat === 1
                ? classroomId === "c1"
                    ? CH.slice(0, 6)
                    : [CH[0], CH[3]]
                : CH.slice(0, seat - 1);
        const challenges = {};
        ids.forEach((id, i) => {
            challenges[id] = {
                completedAt: iso(now - (30 - i) * MIN),
                before: false,
            };
        });
        progress.push({
            memberId: `seat-${String(seat).padStart(2, "0")}`,
            seatNumber: seat,
            challenges,
            current: null,
            updatedAt: iso(now - MIN),
        });
    }
    return progress;
};

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
await page.route(/\/classrooms\/c\d\/submissions$/, (r) =>
    r.fulfill({ json: { submissions: [] } }),
);
let submissionLists = 0;
page.on("request", (req) => {
    if (/\/submissions$/.test(req.url())) submissionLists += 1;
});
await page.route(/\/classrooms\/c\d\/lesson-progress$/, (r) => {
    const id = r
        .request()
        .url()
        .match(/\/classrooms\/(c\d)\//)[1];
    return r.fulfill({
        json: { lesson: lessons[id], progress: progressOf(id) },
    });
});
const puts = [];
await page.route(/\/classrooms\/c\d\/assignment$/, (r) => {
    const id = r
        .request()
        .url()
        .match(/\/classrooms\/(c\d)\//)[1];
    if (r.request().method() === "PUT") {
        const body = JSON.parse(r.request().postData());
        puts.push({ id, body });
        lessons[id] = body.lesson;
        return r.fulfill({
            json: { assignment: { pages: body.pages }, lesson: body.lesson },
        });
    }
    return r.fulfill({
        json: {
            assignment: {
                pages: [
                    {
                        text: "レッスンを進めよう。",
                        imageKey: `${id}/assignment/image-1.png`,
                        imageUrl: null,
                    },
                ],
                starterKey: `${id}/assignment/starter-1.sb3`,
            },
            lesson: lessons[id],
        },
    });
});

const tid = (id) => `[data-testid="${id}"]`;
const text = (id) => page.$eval(tid(id), (el) => el.textContent);
const BODY = '[data-testid="classroom-phase-teacher-evaluation"]';
const box = (sel) =>
    page.$eval(sel, (el) => {
        const r = el.getBoundingClientRect();
        return {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
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
    await page.locator(tid("settings-menu")).click();
    await page.locator(tid("settings-classroom-management")).click();
    await page.waitForSelector(tid("classroom-class-evaluate-g1"), {
        timeout: 20000,
    });
    await page.locator(tid("classroom-class-evaluate-g1")).click();
    await page.waitForSelector(tid("classroom-eval-lesson-only-hint"), {
        timeout: 20000,
    });
    record(
        "lesson only: no AI settings, three steps, load is current",
        (await page.$(tid("classroom-eval-settings-summary"))) === null &&
            (await page.$(tid("classroom-eval-run-grade"))) === null &&
            (await page.getAttribute(
                tid("classroom-eval-load"),
                "aria-current",
            )) === "step",
        await text("classroom-eval-lesson-only-hint"),
    );
    record(
        "c1 (r = n): the required points field is not used",
        (await page.$(
            `${tid("classroom-eval-lesson-scoring-c1")} ${tid("classroom-lesson-scoring-required-unused")}`,
        )) !== null,
        await page.$eval(
            `${tid("classroom-eval-lesson-scoring-c1")} ${tid("classroom-lesson-scoring-each")}`,
            (el) => el.textContent,
        ),
    );

    await page.locator(tid("classroom-eval-load")).click();
    await page.waitForSelector(tid("classroom-eval-matrix"), {
        timeout: 20000,
    });
    await page.waitForTimeout(400);
    record(
        "load: submissions of lesson-only assignments are not fetched",
        submissionLists === 0,
        `lists=${submissionLists}`,
    );
    record(
        "c1: the 6 required ones (condition 6, ★ 6) give 100",
        (await text("classroom-eval-lesson-score-1-c1")) === "100",
        await text("classroom-eval-lesson-score-1-c1"),
    );
    record(
        "c2: ★ 2 only gives the required points 70",
        (await text("classroom-eval-lesson-score-1-c2")) === "70",
        await text("classroom-eval-lesson-score-1-c2"),
    );
    record(
        "header says the lesson column is automatic",
        (await text("classroom-eval-lesson-head-c1")) === "レッスン1（レッスン・自動）",
        await text("classroom-eval-lesson-head-c1"),
    );
    record(
        "after loading, ② check points is current",
        (await page.getAttribute(
            tid("classroom-eval-check-points"),
            "aria-current",
        )) === "step",
    );

    // Change the required points of c2 to 50: saved, and the table changes.
    const required = page.locator(
        `${tid("classroom-eval-lesson-scoring-c2")} ${tid("classroom-lesson-scoring-required")}`,
    );
    await required.fill("50");
    await required.press("Enter");
    await page.waitForTimeout(800);
    const put = puts.find((p) => p.id === "c2");
    record(
        "c2: changing the required points saves the assignment with its pages and starter",
        !!put &&
            put.body.lesson.scoring.requiredPoints === 50 &&
            put.body.pages.length === 1 &&
            put.body.pages[0].imageKey === "c2/assignment/image-1.png" &&
            put.body.keepStarter === true,
        put
            ? JSON.stringify({
                  pages: put.body.pages,
                  keepStarter: put.body.keepStarter,
                  scoring: put.body.lesson.scoring,
              })
            : "no PUT",
    );
    record(
        "c2: the table changes at once (★ 2 only → 50)",
        (await text("classroom-eval-lesson-score-1-c2")) === "50",
        await text("classroom-eval-lesson-score-1-c2"),
    );
    record(
        "③ export is current after the points were changed",
        (await page.getAttribute(
            tid("classroom-eval-export-lesson"),
            "aria-current",
        )) === "step",
    );

    const step = await box(tid("classroom-eval-export-lesson"));
    const body = await box(BODY);
    const matrix = await box(`${tid("classroom-eval-matrix")}`);
    const scroller = await page.$eval(tid("classroom-eval-matrix"), (el) => {
        const p = el.parentElement;
        return { sh: p.scrollHeight, ch: p.clientHeight };
    });
    record(
        "R6: the step button is visible and the page does not scroll",
        step.bottom <= VIEWPORT.height && !(await pageScrolls()),
        `step(${tid("classroom-eval-export-lesson")}).bottom=${step.bottom}/${VIEWPORT.height} ` +
            `body(${BODY}) ${body.sh}/${body.ch} matrix-frame ${scroller.sh}/${scroller.ch} matrix.bottom=${matrix.bottom}`,
    );
    await page.screenshot({
        path: resolve(SHOT_DIR, "issue-1778-grading-lesson-only.png"),
    });
    if (DOCS_SHOTS)
        await page.screenshot({
            path: resolve(DOCS_DIR, "0252-teacher-grading-lesson-only.png"),
        });
} catch (e) {
    record("script", false, e.stack);
    await page.screenshot({ path: resolve(SHOT_DIR, "issue-1778-error.png") });
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
