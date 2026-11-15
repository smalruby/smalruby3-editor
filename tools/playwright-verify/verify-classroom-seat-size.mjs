// The size of the teacher's seat tiles (#1925 C13). At the lesson PC size
// (1300x600) 40 seats = 4 rows of 10 must fit in the members grid frame
// without scrolling, for an ordinary assignment and a lesson assignment.
// On the iPad sizes (1024x768, 768x1024) the 10 columns must fit the frame's
// width (no sideways scroll). The classroom API is stubbed with page.route
// (dev server only).
//
// Prints, per viewport and assignment kind: tile width x height, rows x
// columns, the grid frame's scrollHeight / clientHeight and scrollWidth /
// clientWidth, the last tile's bottom vs the frame's bottom, whether the
// page / modal body scroll (R6, checked at 1300x600 only), content that
// leaves a tile and「★ あと N」overlapping the submission badge.
//
//   node verify-classroom-seat-size.mjs                 # headless, ja
//   LOCALE=ja-Hira node verify-classroom-seat-size.mjs
//   BASE=http://localhost:8625 node verify-classroom-seat-size.mjs
//   VIEWPORTS=1300x600 node verify-classroom-seat-size.mjs   # default: 1300x600,1024x768,768x1024
//   MAX_TILE=58 node verify-classroom-seat-size.mjs     # the upper bound to check (px)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "http://localhost:8601";
const LOCALE = process.env.LOCALE || "ja";
const MAX_TILE = Number(process.env.MAX_TILE || 58);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, "tmp");
const VIEWPORTS = (process.env.VIEWPORTS || "1300x600,1024x768,768x1024")
    .split(",")
    .map((v) => {
        const [width, height] = v.split("x").map(Number);
        return { width, height, name: v, lessonPc: v === "1300x600" };
    });
const SEATS = 40;
mkdirSync(SHOT_DIR, { recursive: true });

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const assignment = (over) => ({
    className: "技術",
    studentCount: SEATS,
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
        assignmentName: "ねこを動かそう",
        joinCode: "abc234",
    }),
    assignment({
        classroomId: "c2",
        assignmentName: "レッスンをやろう",
        joinCode: "def567",
        hasLesson: true,
        sortDate: iso(now - 3 * DAY),
    }),
];
const CH = [
    "blocks-l1-key-sound",
    "blocks-l1-arrow-move",
    "blocks-l1-click-say",
    "blocks-l1-repeat",
];
const lesson = {
    courseId: "kyou-kara-programmer",
    challengeIds: CH,
    requiredChallengeIds: ["blocks-l1-click-say"],
    completion: { type: "count", count: 3 },
    submitWork: true,
    scoring: null,
};
// Every seat is joined so each tile shows its longest content.
const members = Array.from({ length: SEATS }, (_, i) => ({
    memberId: `seat-${String(i + 1).padStart(2, "0")}`,
    displayName: `生徒${i + 1}`,
    joinedAt: iso(now - 40 * MIN),
    lastActiveAt: iso(now - (i % 7) * MIN),
}));
const submissions = members
    .filter((_, i) => i % 3 === 0)
    .map((m, i) => ({
        submissionId: `s${i}`,
        memberId: m.memberId,
        status: "submitted",
        submittedAt: iso(now - 3 * MIN),
    }));
const progress = members.map((m, i) => {
    const done = i % (CH.length + 1);
    const challenges = {};
    for (let c = 0; c < done; c++)
        challenges[CH[c]] = { completedAt: iso(now - (30 - c) * MIN) };
    return {
        memberId: m.memberId,
        seatNumber: i + 1,
        challenges,
        current:
            done < CH.length
                ? {
                      challengeId: CH[done],
                      openedAt: iso(now - (i % 4 === 0 ? 14 : 2) * MIN),
                  }
                : null,
        updatedAt: iso(now - MIN),
    };
});

const results = [];
const tid = (id) => `[data-testid="${id}"]`;
const GRID = tid("classroom-members-grid");
const BODY = '[data-testid="classroom-teacher-modal"] main';

const browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false",
    args: ["--disable-dev-shm-usage"],
});
let page;

/**
 * Opens a context at one viewport with the stubbed classroom API.
 * @param {object} vp - viewport ({width, height})
 * @returns {Promise<import('playwright').BrowserContext>} the context
 */
const openContext = async (vp) => {
    const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        locale: "ja-JP",
    });
    page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("[pageerror]", e.message));
    await page.route("**/notifications", (r) =>
        r.fulfill({ json: { notifications: [], unreadCount: 0 } }),
    );
    await page.route(/\/kick-requests/, (r) =>
        r.fulfill({ json: { requests: [] } }),
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
    await page.route(/\/classrooms$/, (r) =>
        r.fulfill({ json: { classrooms } }),
    );
    await page.route(/\/classrooms\/c\d$/, (r) => {
        const id = r
            .request()
            .url()
            .match(/\/classrooms\/(c\d)$/)[1];
        return r.fulfill({
            json: classrooms.find((c) => c.classroomId === id),
        });
    });
    await page.route(/\/classrooms\/c\d\/members$/, (r) =>
        r.fulfill({ json: { members } }),
    );
    await page.route(/\/classrooms\/c\d\/submissions$/, (r) =>
        r.fulfill({ json: { submissions } }),
    );
    await page.route(/\/classrooms\/c\d\/lesson-progress$/, (r) =>
        r.fulfill({ json: { lesson, progress } }),
    );
    await page.route(/\/classrooms\/c\d\/assignment$/, (r) => {
        const isLesson = r.request().url().includes("/c2/");
        return r.fulfill({
            json: {
                assignment: { pages: [{ text: "説明" }] },
                ...(isLesson ? { lesson } : {}),
            },
        });
    });
    return ctx;
};

const measure = () =>
    page.evaluate(
        ([gridSel, bodySel]) => {
            const se = document.scrollingElement;
            const grid = document.querySelector(gridSel);
            const body = document.querySelector(bodySel);
            const tiles = [
                ...grid.querySelectorAll(
                    '[data-testid^="classroom-member-seat-"]',
                ),
            ].filter((el) =>
                /^classroom-member-seat-\d+$/.test(
                    el.getAttribute("data-testid"),
                ),
            );
            const rects = tiles.map((el) => el.getBoundingClientRect());
            const tops = [...new Set(rects.map((r) => Math.round(r.top)))];
            const lefts = [...new Set(rects.map((r) => Math.round(r.left)))];
            const g = grid.getBoundingClientRect();
            const last = rects[rects.length - 1];
            // Content that leaves its tile (the「!」badge sits on the corner on
            // purpose) or「★ あと N」under the submission badge.
            let outside = 0;
            let underBadge = 0;
            for (const tile of tiles) {
                const c = tile.getBoundingClientRect();
                for (const el of tile.querySelectorAll("span")) {
                    if (String(el.className).includes("stuck")) continue;
                    const r = el.getBoundingClientRect();
                    if (!r.width) continue;
                    if (
                        r.bottom > c.bottom + 0.5 ||
                        r.right > c.right + 0.5 ||
                        r.top < c.top - 0.5 ||
                        r.left < c.left - 0.5
                    ) {
                        outside += 1;
                    }
                }
                const req = tile.querySelector(
                    '[data-testid^="classroom-lesson-seat-required-"]',
                );
                const sub = tile.querySelector(
                    'span[class*="lesson-seat-submission"]',
                );
                if (req && sub) {
                    const a = req.getBoundingClientRect();
                    const b = sub.getBoundingClientRect();
                    if (
                        a.right > b.left &&
                        a.left < b.right &&
                        a.bottom > b.top &&
                        a.top < b.bottom
                    ) {
                        underBadge += 1;
                    }
                }
            }
            return {
                outside,
                underBadge,
                tiles: tiles.length,
                tileW: Math.round(rects[0].width * 10) / 10,
                tileH: Math.round(rects[0].height * 10) / 10,
                rows: tops.length,
                cols: lefts.length,
                grid: `${grid.scrollHeight}/${grid.clientHeight}`,
                gridX: `${grid.scrollWidth}/${grid.clientWidth}`,
                gridXOk: grid.scrollWidth <= grid.clientWidth,
                pageXOk: se.scrollWidth <= se.clientWidth,
                gridOk: grid.scrollHeight <= grid.clientHeight,
                gridBottom: Math.round(g.bottom),
                lastBottom: Math.round(last.bottom),
                body: body ? `${body.scrollHeight}/${body.clientHeight}` : "-",
                bodyOk: body ? body.scrollHeight <= body.clientHeight : false,
                pageOk: se.scrollHeight <= se.clientHeight,
                vh: window.innerHeight,
            };
        },
        [GRID, BODY],
    );

const openAssignment = async (id) => {
    await page.$eval(tid("classroom-teacher-menu-button"), (el) => el.click());
    await page.waitForTimeout(300);
    await page.$eval(tid("classroom-teacher-menu-class-list"), (el) =>
        el.click(),
    );
    await page.locator(tid("classroom-class-open-g1")).click();
    await page.waitForSelector(tid("classroom-board"), { timeout: 20000 });
    await page.locator(tid("classroom-board-tab-classwork")).click();
    await page.waitForTimeout(500);
    await page.locator(tid(`classroom-board-row-toggle-${id}`)).click();
    await page.locator(tid(`classroom-board-open-${id}`)).click();
    await page.waitForSelector(tid("classroom-phase-teacher-detail"), {
        timeout: 20000,
    });
    await page.locator(tid("classroom-tab-members")).click();
    await page.waitForSelector(tid("classroom-member-seat-40"), {
        timeout: 10000,
    });
    await page.waitForTimeout(1000);
};

try {
    for (const vp of VIEWPORTS) {
        const ctx = await openContext(vp);
        await page.goto(
            `${BASE}/?no_beforeunload=1&locale=${LOCALE}&devlogin=stub-token`,
            { waitUntil: "load" },
        );
        await page.waitForTimeout(3000);
        await page.addStyleTag({
            content:
                "#webpack-dev-server-client-overlay { display: none !important; }",
        });
        for (const [kind, id] of [
            ["assignment", "c1"],
            ["lesson", "c2"],
        ]) {
            await openAssignment(id);
            if (kind === "lesson")
                await page.waitForSelector(
                    tid("classroom-lesson-seat-legend"),
                    {
                        timeout: 10000,
                    },
                );
            const m = await measure();
            // Everywhere: 10 columns, no sideways scroll. At 1300x600 and the
            // iPad landscape also「★ あと N」clear of the submission badge; at
            // 1300x600 also 4 rows fit the frame, the body and page do not
            // scroll (R6) and nothing leaves a tile. On the iPad portrait the
            // seat pane is about 280-420px wide (the 380px detail pane stays on
            // the right), too narrow for a tile's content: reported, not failed.
            const ok =
                m.tiles === SEATS &&
                m.cols === 10 &&
                m.tileW <= MAX_TILE + 0.5 &&
                m.tileH <= MAX_TILE + 0.5 &&
                m.gridXOk &&
                m.pageXOk &&
                (vp.width < 1024 || m.underBadge === 0) &&
                (!vp.lessonPc ||
                    (m.rows === 4 &&
                        m.gridOk &&
                        m.lastBottom <= m.gridBottom &&
                        m.bodyOk &&
                        m.pageOk &&
                        m.outside === 0));
            results.push({ vp: vp.name, kind, ok, ...m });
            console.log(
                `${ok ? "PASS" : "FAIL"} [${LOCALE} ${vp.name}] ${kind}`,
                JSON.stringify(m),
            );
            const name = `issue-1925-seats-${kind}-${LOCALE}-${vp.name}`;
            await page.screenshot({ path: resolve(SHOT_DIR, `${name}.png`) });
            // The grid alone (2x) to check the text in the tiles by eye.
            const grid = await page.$(GRID);
            await grid.screenshot({
                path: resolve(SHOT_DIR, `${name}-grid.png`),
            });
            await page.keyboard.press("Escape");
            await page.waitForTimeout(500);
            // Close the modal before opening the next assignment from the menu.
            const close = await page.$(tid("classroom-teacher-modal-close"));
            if (close) await close.click();
            await page.waitForTimeout(500);
        }
        await ctx.close();
    }
} finally {
    await browser.close();
}

console.log(
    `\n| locale | viewport | kind | tile (w×h) | rows×cols | grid ${GRID} scroll/client (height) | (width) | last tile bottom / grid bottom | body ${BODY} | page | content outside / under badge | result |`,
);
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of results) {
    console.log(
        `| ${LOCALE} | ${r.vp} | ${r.kind} | ${r.tileW}×${r.tileH} | ${r.rows}×${r.cols} | ${r.grid} | ${r.gridX} | ${r.lastBottom} / ${r.gridBottom} | ${r.body} | ${r.pageOk ? "no scroll" : "scrolls"}${r.pageXOk ? "" : " SIDEWAYS"} | ${r.outside} / ${r.underBadge} | ${r.ok ? "PASS" : "FAIL"} |`,
    );
}
process.exit(
    results.length === VIEWPORTS.length * 2 && results.every((r) => r.ok)
        ? 0
        : 1,
);
