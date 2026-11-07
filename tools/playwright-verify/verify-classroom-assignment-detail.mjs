// Assignment detail (［メンバー］［説明］) and the "create an assignment"
// screen (#1303: D1〜D3・E1〜E3・C1) at the lesson PC size (1300x600). The
// classroom API is stubbed with page.route, so no login or stg data is
// needed — only the dev server.
//
// Measures (R6): the bottom of the main button of each screen and that the
// page does not scroll. Takes the docs screenshots with DOCS_SHOTS=1.
//
//   node verify-classroom-assignment-detail.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-assignment-detail.mjs    # + docs/classroom/screenshots
//   BASE=http://localhost:8621 node verify-classroom-assignment-detail.mjs
//   PREFIX=before node verify-classroom-assignment-detail.mjs   # name the tmp/ shots
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_DIR = resolve(REPO_ROOT, 'docs/classroom/screenshots');
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
const PREFIX = process.env.PREFIX || 'after';
const VIEWPORT = { width: 1300, height: 600 };
mkdirSync(SHOT_DIR, { recursive: true });

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const assignment = (over) => ({
    className: '技術',
    studentCount: 40,
    googleClassroomCourseId: null,
    coTeacherEmails: [],
    groupId: 'g1',
    topic: null,
    hasAssignment: true,
    status: 'active',
    role: 'owner',
    createdAt: iso(now - 10 * DAY),
    expiresAt: iso(now + 80 * DAY),
    meshGroupLimit: 6,
    ...over,
});
const classrooms = [
    assignment({ classroomId: 'c1', assignmentName: 'ねこを動かそう', joinCode: 'abc234', sortDate: iso(now - 2 * DAY) }),
    assignment({
        classroomId: 'c2',
        assignmentName: 'チャットアプリを作ろう',
        joinCode: 'kx7p2m',
        sortDate: iso(now - 9 * DAY),
        expiresAt: iso(now + 5 * DAY),
    }),
    assignment({ classroomId: 'c3', assignmentName: 'まだ書いていない課題', joinCode: 'q8wz3e', sortDate: iso(now - 20 * DAY), hasAssignment: false }),
];
const members = Array.from({ length: 24 }, (_, i) => ({
    memberId: `seat-${String(i + 1).padStart(2, '0')}`,
    lastActiveAt: i % 3 === 0 ? iso(now - 60 * 1000) : iso(now - 2 * 60 * 60 * 1000),
}));
const submissions = members
    .filter((_, i) => i % 2 === 0)
    .map((m, i) => ({ submissionId: `s${i}`, memberId: m.memberId, status: 'submitted', submittedAt: iso(now) }));
const pagesFor = (id) =>
    id === 'c3'
        ? []
        : [
              { text: 'ねこが 10 歩ずつ動くようにしよう。\nできたら、はしで跳ね返るようにしよう。' },
              { text: '2 ページ目: 音を鳴らしてみよう。' },
          ];

const results = [];
const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false', args: ['--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
await page.route('**/kick-requests/pending', (r) => r.fulfill({ json: { requests: [] } }));
await page.route(/\/kick-requests/, (r) => r.fulfill({ json: { requests: [] } }));
await page.route('**/classroom-groups', (r) =>
    r.fulfill({
        json: {
            groups: [{ groupId: 'g1', name: '技術', year: 2026, section: '2年1組', status: 'active', schemaVersion: 2, topics: [] }],
        },
    }),
);
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms } }));
await page.route(/\/classrooms\/c\d$/, (r) => {
    const id = r.request().url().match(/\/classrooms\/(c\d)$/)[1];
    return r.fulfill({ json: classrooms.find((c) => c.classroomId === id) });
});
await page.route(/\/classrooms\/c\d\/members$/, (r) => r.fulfill({ json: { members } }));
await page.route(/\/classrooms\/c\d\/submissions$/, (r) => r.fulfill({ json: { submissions } }));
await page.route(/\/classrooms\/c\d\/assignment$/, (r) => {
    const id = r.request().url().match(/\/classrooms\/(c\d)\/assignment$/)[1];
    return r.fulfill({ json: { assignment: { pages: pagesFor(id) } } });
});

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name, docsName) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `issue-1303-${PREFIX}-${name}.png`) });
    if (DOCS_SHOTS && docsName) await page.screenshot({ path: resolve(DOCS_DIR, docsName) });
};
// The bottom of `button` and whether the page / the modal body scroll.
const measure = (button, body) =>
    page.evaluate(
        ([buttonSel, bodySel]) => {
            const btn = document.querySelector(buttonSel);
            const se = document.scrollingElement;
            const el = document.querySelector(bodySel);
            const grid = document.querySelector('[data-testid="classroom-members-grid"]');
            const pages = document.querySelector('[data-testid="classroom-assignment-pages"]');
            return {
                grid: grid ? `${grid.scrollHeight}/${grid.clientHeight}` : '-',
                pages: pages ? `${pages.scrollHeight}/${pages.clientHeight}` : '-',
                bottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
                vh: window.innerHeight,
                pageOk: se.scrollHeight <= se.clientHeight,
                bodyOk: el ? el.scrollHeight <= el.clientHeight : false,
                body: el ? `${el.scrollHeight}/${el.clientHeight}` : '-',
            };
        },
        [button, body],
    );
// The scrolling area of the teacher modal (everything under the title bar).
const BODY = '[data-testid="classroom-teacher-modal"] main';
const MODAL_BODY = BODY;
const describe = (m) =>
    `bottom=${m.bottom}/${m.vh} page=${m.pageOk ? 'no scroll' : 'SCROLLS'} body=${m.body} seats=${m.grid} pages=${m.pages}`;

const openBoard = async () => {
    await page.$eval(tid('classroom-teacher-menu-button'), (el) => el.click());
    await page.waitForTimeout(300);
    await page.$eval(tid('classroom-teacher-menu-class-list'), (el) => el.click());
    await page.locator(tid('classroom-class-open-g1')).click();
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    await page.waitForTimeout(500);
};
const openDetail = async (id) => {
    await page.locator(tid(`classroom-board-row-toggle-${id}`)).click();
    await page.locator(tid(`classroom-board-open-${id}`)).click();
    await page.waitForSelector(tid('classroom-phase-teacher-detail'), { timeout: 20000 });
    await page.waitForTimeout(1200);
};
const backToBoard = async () => {
    await page.locator(tid('classroom-breadcrumb-assignments')).click();
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    await page.waitForTimeout(500);
};

try {
    await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    // The dev server's warning overlay would swallow the clicks.
    await page.addStyleTag({ content: '#webpack-dev-server-client-overlay { display: none !important; }' });
    await openBoard();

    // C1: the create screen asks only the name.
    await page.locator(tid('classroom-board-create-menu')).click();
    await page.locator(tid('classroom-board-create')).click();
    await page.waitForSelector(tid('classroom-board-create-view'));
    let m = await measure(tid('classroom-board-create-submit'), MODAL_BODY);
    const meshAsked = !!(await page.$(tid('classroom-board-create-mesh-group-limit')));
    record('create screen (C1)', !meshAsked && m.bottom !== null && m.bottom <= m.vh && m.pageOk && m.bodyOk, `${describe(m)} meshField=${meshAsked}`);
    await shot('create', '0226-board-create-assignment.png');
    await page.locator(tid('classroom-board-create-cancel')).click();
    await page.waitForTimeout(300);

    // Members tab (D1・D2・D3), far deadline.
    await openDetail('c1');
    m = await measure(tid('classroom-detail-more-menu'), BODY);
    const red = await page.$(tid('classroom-retention-banner'));
    record('members tab (D1〜D3)', !red && m.bottom !== null && m.bottom <= m.vh && m.pageOk && m.bodyOk, `more-menu ${describe(m)} redBanner=${!!red}`);
    await shot('members', '0204-teacher-detail.png');
    if (await page.$(tid('classroom-detail-more-menu'))) {
        await page.locator(tid('classroom-detail-more-menu')).click();
        await page.waitForTimeout(300);
        await shot('more-menu', '0227-detail-more-menu.png');
        // Escape would also close the modal, so toggle the menu shut.
        await page.locator(tid('classroom-detail-more-menu')).click();
    }

    // Description tab (E1・E2): the save button is on the first screen.
    await page.locator(tid('classroom-tab-description')).click();
    await page.waitForTimeout(800);
    m = await measure(tid('classroom-assignment-save'), BODY);
    record('description tab (E1・E2)', m.bottom !== null && m.bottom <= m.vh && m.pageOk && m.bodyOk, `save ${describe(m)}`);
    await shot('description', '0212-teacher-detail-description.png');
    if (await page.$(tid('classroom-assignment-advanced-toggle'))) {
        await page.locator(tid('classroom-assignment-advanced-toggle')).click();
        await page.waitForTimeout(300);
        m = await measure(tid('classroom-assignment-save'), BODY);
        record('description tab, advanced open', m.bottom !== null && m.bottom <= m.vh && m.pageOk && m.bodyOk, `save ${describe(m)}`);
        await shot('description-advanced', '0228-detail-advanced-settings.png');
    }

    // Near deadline: red only within 7 days (D1 / R4).
    await backToBoard();
    await openDetail('c2');
    const urgent = await page.$(tid('classroom-retention-banner'));
    record('near deadline is red (D1)', !!urgent, '');
    await shot('members-urgent', '0214-detail-retention-banner.png');

    // Empty description (E3).
    await backToBoard();
    await openDetail('c3');
    await page.locator(tid('classroom-tab-description')).click();
    await page.waitForTimeout(800);
    const empty = await page.$(tid('classroom-description-preview-empty'));
    m = await measure(tid('classroom-assignment-save'), BODY);
    record('empty description preview (E3)', !!empty && m.bottom !== null && m.bottom <= m.vh && m.pageOk && m.bodyOk, `save ${describe(m)}`);
    await shot('description-empty', '0233-detail-description-empty.png');
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed at ${VIEWPORT.width}x${VIEWPORT.height}`);
process.exit(failed.length ? 1 : 0);
