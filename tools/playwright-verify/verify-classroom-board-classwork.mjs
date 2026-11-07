// Classwork tab of a class (#1301: B3・B4・B6・B7) at the lesson PC size
// (1300x600). The classroom API is stubbed with page.route, so no login or
// stg data is needed — only the dev server.
//
// Measures (R6): the bottom of the main button ［＋ 作成 ▾］ and that the page
// does not scroll. Takes the docs screenshots with DOCS_SHOTS=1.
//
//   node verify-classroom-board-classwork.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-board-classwork.mjs    # + docs/classroom/screenshots
//   BASE=http://localhost:8621 node verify-classroom-board-classwork.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_DIR = resolve(REPO_ROOT, 'docs/classroom/screenshots');
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
const VIEWPORT = { width: 1300, height: 600 };
mkdirSync(SHOT_DIR, { recursive: true });

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const assignment = (over) => ({
    className: '技術',
    studentCount: 30,
    googleClassroomCourseId: null,
    coTeacherEmails: [],
    groupId: 'g1',
    topic: null,
    hasAssignment: true,
    status: 'active',
    role: 'owner',
    createdAt: iso(now - 10 * DAY),
    expiresAt: iso(now + 80 * DAY),
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
    assignment({ classroomId: 'c3', assignmentName: 'アニメーション', joinCode: 'q8wz3e', topic: '第1回 アニメーション', sortDate: iso(now - 20 * DAY) }),
    assignment({ classroomId: 'c4', assignmentName: 'ふりかえり', joinCode: 'h2nd5r', topic: '第1回 アニメーション', sortDate: iso(now - 21 * DAY), hasAssignment: false }),
];
const members = Array.from({ length: 24 }, (_, i) => ({ memberId: `seat-${String(i + 1).padStart(2, '0')}` }));
const submissions = members.filter((_, i) => i % 2 === 0).map((m, i) => ({ submissionId: `s${i}`, memberId: m.memberId, status: 'submitted', submittedAt: iso(now) }));

const results = [];
const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
await page.route('**/kick-requests/pending', (r) => r.fulfill({ json: { requests: [] } }));
await page.route('**/classroom-groups', (r) =>
    r.fulfill({
        json: {
            groups: [
                { groupId: 'g1', name: '技術', year: 2026, section: '2年1組', status: 'active', schemaVersion: 2, topics: ['第1回 アニメーション', '第2回 チャット'] },
            ],
        },
    }),
);
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms } }));
await page.route(/\/classrooms\/c\d\/members$/, (r) => r.fulfill({ json: { members } }));
await page.route(/\/classrooms\/c\d\/submissions$/, (r) => r.fulfill({ json: { submissions } }));
await page.route(/\/classrooms\/c\d\/assignment$/, (r) =>
    r.fulfill({ json: { assignment: { pages: [{ text: 'ねこが 10 歩ずつ動くようにしよう。\n2 ページ目に続く' }] } } }),
);

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name, docsName) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `issue-1301-${name}.png`) });
    if (DOCS_SHOTS && docsName) await page.screenshot({ path: resolve(DOCS_DIR, docsName) });
};
const measure = () =>
    page.evaluate(() => {
        const btn = document.querySelector('[data-testid="classroom-board-create-menu"]');
        const se = document.scrollingElement;
        const body = document.querySelector('[data-testid="classroom-board"]');
        const list = document.querySelector('[data-testid="classroom-board-list"]');
        return {
            list: list ? `${list.scrollHeight}/${list.clientHeight}` : '-',
            bodyOk: body ? body.scrollHeight <= body.clientHeight : false,
            bottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
            vh: window.innerHeight,
            pageOk: se.scrollHeight <= se.clientHeight,
            body: body ? `${body.scrollHeight}/${body.clientHeight}` : '-',
        };
    });

try {
    await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    // The dev server's warning overlay would swallow the clicks.
    await page.addStyleTag({ content: '#webpack-dev-server-client-overlay { display: none !important; }' });
    // The teacher menu (menu bar) opens the class list.
    await page.$eval(tid('classroom-teacher-menu-button'), (el) => el.click());
    await page.waitForTimeout(300);
    await page.$eval(tid('classroom-teacher-menu-class-list'), (el) => el.click());
    await page.locator(tid('classroom-class-open-g1')).click();
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    await page.waitForTimeout(800);

    let m = await measure();
    record('classwork tab (closed rows)', m.bottom !== null && m.bottom <= m.vh && m.pageOk && m.bodyOk, `create-menu bottom=${m.bottom}/${m.vh} page=${m.pageOk ? 'no scroll' : 'SCROLLS'} board=${m.body} list=${m.list}`);
    await shot('classwork', '0211-teacher-assignment-board.png');

    await page.locator(tid('classroom-board-create-menu')).click();
    await page.waitForTimeout(300);
    const items = await page.$$eval('[data-testid="classroom-board-create-menu-list"] [role="menuitem"]', (els) =>
        els.map((e) => e.textContent.trim()),
    );
    record('create menu items', items.length === 5, items.join(' / '));
    await shot('create-menu', '0224-board-create-menu.png');

    await page.locator(tid('classroom-board-create-topic')).click();
    await page.waitForSelector(tid('classroom-topic-add-dialog'));
    const dlg = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="classroom-topic-add"]').getBoundingClientRect();
        const bg = getComputedStyle(document.querySelector('[data-testid="classroom-topic-add-dialog"]')).backgroundColor;
        return { bottom: Math.round(b.bottom), bg };
    });
    record('add-topic dialog', dlg.bottom <= VIEWPORT.height && dlg.bg !== 'rgba(0, 0, 0, 0)', `add bottom=${dlg.bottom} bg=${dlg.bg}`);
    await shot('topic-dialog', '0225-board-topic-dialog.png');
    await page.locator(tid('classroom-topic-add-cancel')).click();

    await page.locator(tid('classroom-board-row-toggle-c2')).click();
    await page.waitForFunction(() => /24/.test(document.querySelector('[data-testid="classroom-board-row-counts-c2"]')?.textContent || ''));
    m = await measure();
    const open = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="classroom-board-open-c2"]').getBoundingClientRect();
        return { bottom: Math.round(b.bottom), red: !!document.querySelector('[data-testid="classroom-board-expiry-c2"]') };
    });
    record('opened row (7 days left)', open.red && m.bottom <= m.vh && m.pageOk && m.bodyOk, `open-button bottom=${open.bottom} create-menu bottom=${m.bottom} page=${m.pageOk ? 'no scroll' : 'SCROLLS'} board=${m.body} list=${m.list}`);
    await shot('row-open-urgent', '0213-board-expiry-badge-download.png');

    await page.locator(tid('classroom-board-row-toggle-c1')).click();
    await page.waitForFunction(() => /24/.test(document.querySelector('[data-testid="classroom-board-row-counts-c1"]')?.textContent || ''));
    const grey = await page.textContent(tid('classroom-board-retention-c1'));
    record('opened row (far deadline is grey)', !!grey && !(await page.$(tid('classroom-board-expiry-c1'))), grey);
    await shot('row-open');

    await page.locator(tid('classroom-board-tab-stream')).click();
    await page.waitForTimeout(300);
    record('stream tab placeholder', !!(await page.$(tid('classroom-board-stream'))), '');
    await shot('stream');
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed at ${VIEWPORT.width}x${VIEWPORT.height}`);
process.exit(failed.length ? 1 : 0);
