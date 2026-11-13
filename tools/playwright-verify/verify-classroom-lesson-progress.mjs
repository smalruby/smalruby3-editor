// The teacher's lesson progress (EPIC #1592 / #1602) at the lesson PC size
// (1300x600): seat colours of the members tab and the「進み具合」tab table.
// The classroom API is stubbed with page.route, so no login or stg data is
// needed — only the dev server.
//
// Checks: seat colours / count / ★ / 「!」 / unjoined seats, 「クリア N / 参加 N」,
// the table (fixed header incl. the「できた人」row, fixed seat column, only the
// frame scrolls), sort orders, the CSV in「…」, and R6 (the page and the modal
// body do not scroll; the seat grid / table frame scroll inside).
//
//   node verify-classroom-lesson-progress.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-lesson-progress.mjs    # + docs/classroom/screenshots
//   BASE=http://localhost:8611 node verify-classroom-lesson-progress.mjs
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
    sortDate: iso(now - 2 * DAY),
    meshGroupLimit: 6,
    ...over,
});
const classrooms = [
    assignment({ classroomId: 'c1', assignmentName: 'レッスンをやろう', joinCode: 'abc234', hasLesson: true }),
];
// All 11 challenges of the course, ★ on 2, condition: 8.
const CH = [
    'blocks-l1-key-sound',
    'blocks-l1-arrow-move',
    'blocks-l1-click-say',
    'blocks-l1-repeat',
    'blocks-l1-if',
    'blocks-l1-ask-answer',
    'blocks-l1-quiz',
    'blocks-l1-count',
    'blocks-l1-broadcast',
    'blocks-l1-speak',
    'blocks-l1-message-list',
];
const lesson = {
    courseId: 'kyou-kara-programmer',
    challengeIds: CH,
    requiredChallengeIds: ['blocks-l1-click-say', 'blocks-l1-ask-answer'],
    completion: { type: 'count', count: 8 },
    submitWork: true,
    scoring: null,
};
const MIN = 60 * 1000;
const JOINED = 34;
const members = [];
const progress = [];
for (let seat = 1; seat <= JOINED; seat++) {
    const memberId = `seat-${String(seat).padStart(2, '0')}`;
    members.push({ memberId, displayName: `生徒${seat}`, joinedAt: iso(now - 40 * MIN), lastActiveAt: iso(now - 5 * MIN) });
    // seat % 5 == 0 → nothing yet, otherwise a varying number done
    const doneCount = seat % 5 === 0 ? 0 : seat % 12;
    const challenges = {};
    for (let i = 0; i < doneCount; i++) challenges[CH[i]] = { completedAt: iso(now - (30 - i) * MIN), before: i === 0 && seat % 3 === 0 };
    const cur = doneCount < CH.length ? CH[doneCount] : null;
    progress.push({
        memberId,
        seatNumber: seat,
        challenges,
        current: cur ? { challengeId: cur, openedAt: iso(now - (seat % 4 === 0 ? 14 : 2) * MIN) } : null,
        updatedAt: iso(now - MIN),
    });
}
const submissions = [{ memberId: 'seat-11', submissionId: 's11', submittedAt: iso(now - MIN), status: 'submitted' }];

const results = [];
const record = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false', args: ['--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
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
let progressGets = 0;
await page.route(/\/classrooms\/c\d\/lesson-progress$/, (r) => {
    progressGets += 1;
    return r.fulfill({ json: { lesson, progress } });
});
await page.route(/\/classrooms\/c\d\/assignment$/, (r) =>
    r.fulfill({ json: { assignment: { pages: [{ text: 'レッスンを進めよう。' }] }, lesson } }),
);

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name, docsName) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `issue-1602-${name}.png`) });
    if (DOCS_SHOTS && docsName) await page.screenshot({ path: resolve(DOCS_DIR, docsName) });
};
const BODY = '[data-testid="classroom-teacher-modal"] main';
const measure = (frameSel, mainSel) =>
    page.evaluate(
        ([bodySel, fSel, mSel]) => {
            const se = document.scrollingElement;
            const el = document.querySelector(bodySel);
            const frame = document.querySelector(fSel);
            const main = mSel ? document.querySelector(mSel) : null;
            return {
                vh: window.innerHeight,
                pageOk: se.scrollHeight <= se.clientHeight,
                bodyOk: el ? el.scrollHeight <= el.clientHeight : false,
                body: el ? `${el.scrollHeight}/${el.clientHeight}` : '-',
                frame: frame ? `${frame.scrollHeight}/${frame.clientHeight}` : '-',
                frameBottom: frame ? Math.round(frame.getBoundingClientRect().bottom) : null,
                mainBottom: main ? Math.round(main.getBoundingClientRect().bottom) : null,
            };
        },
        [BODY, frameSel, mainSel],
    );
const describe = (m, frameSel, mainSel) =>
    `page=${m.pageOk ? 'no scroll' : 'SCROLLS'} body(${BODY})=${m.body} frame(${frameSel})=${m.frame} ` +
    `frame.bottom=${m.frameBottom}` +
    (mainSel ? ` main(${mainSel}).bottom=${m.mainBottom}/${m.vh}` : '');
const r6 = (m) => m.pageOk && m.bodyOk && m.frameBottom <= m.vh && (m.mainBottom === null || m.mainBottom <= m.vh);
const attr = (id, name) => page.$eval(tid(id), (el, n) => el.getAttribute(n), name);
const text = (id) => page.$eval(tid(id), (el) => el.textContent);

try {
    await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    await page.addStyleTag({ content: '#webpack-dev-server-client-overlay { display: none !important; }' });
    await page.$eval(tid('classroom-teacher-menu-button'), (el) => el.click());
    await page.waitForTimeout(300);
    await page.$eval(tid('classroom-teacher-menu-class-list'), (el) => el.click());
    await page.locator(tid('classroom-class-open-g1')).click();
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    await page.locator(tid('classroom-board-tab-classwork')).click();
    await page.waitForTimeout(500);
    await page.locator(tid('classroom-board-row-toggle-c1')).click();
    await page.locator(tid('classroom-board-open-c1')).click();
    await page.waitForSelector(tid('classroom-phase-teacher-detail'), { timeout: 20000 });
    await page.waitForSelector(tid('classroom-lesson-seat-legend'), { timeout: 10000 });
    await page.waitForTimeout(800);

    // 1. Members tab: seat colours by progress.
    const GRID = '[data-testid="classroom-members-grid"]';
    let m = await measure(GRID);
    record('members tab: R6', r6(m), describe(m, GRID));
    const states = await page.$$eval('[data-testid^="classroom-member-seat-"]', (els) =>
        els.map((el) => el.getAttribute('data-lesson-state')),
    );
    record(
        'seat states (5 = not started, 11 = cleared? / 35+ = not joined)',
        states[4] === 'notStarted' && states[34] === 'notJoined' && states[0] === 'inProgress',
        states.slice(0, 12).join(',') + ' … ' + states[34],
    );
    record('cleared summary', (await text('classroom-lesson-cleared-summary')).includes(`参加 ${JOINED}`), await text('classroom-lesson-cleared-summary'));
    record('「!」on seat 4 (14 min)', !!(await page.$(tid('classroom-lesson-seat-stuck-4'))));
    record('count capped at the condition (seat 11: 11 done → 8 / 8)', (await text('classroom-lesson-seat-count-11')) === '8 / 8');
    await shot('members', '0247-detail-lesson-members.png');

    // 2. Progress tab.
    const FRAME = '[data-testid="classroom-lesson-progress-frame"]';
    await page.locator(tid('classroom-tab-progress')).click();
    await page.waitForSelector(tid('classroom-lesson-progress'), { timeout: 10000 });
    await page.waitForTimeout(600);
    m = await measure(FRAME);
    const frameScrolls = await page.$eval(FRAME, (el) => el.scrollHeight > el.clientHeight);
    record('progress tab: R6 (only the table frame scrolls)', r6(m) && frameScrolls, describe(m, FRAME));
    const header = await page.$eval(`${FRAME} thead`, (el) => Math.round(el.getBoundingClientRect().height));
    record('fixed header height', header <= 150, `thead=${header}px`);
    await shot('progress', '0248-detail-lesson-progress.png');
    // Scroll the frame: header and the「できた人」row stay.
    const before = await page.$eval(tid('classroom-lesson-progress-totals'), (el) => Math.round(el.getBoundingClientRect().top));
    await page.$eval(FRAME, (el) => {
        el.scrollTop = 300;
    });
    await page.waitForTimeout(200);
    const after = await page.$eval(tid('classroom-lesson-progress-totals'), (el) => Math.round(el.getBoundingClientRect().top));
    record('「できた人」row stays fixed while the rows scroll', before === after, `top ${before} → ${after}`);
    await shot('progress-scrolled');
    await page.$eval(FRAME, (el) => {
        el.scrollTop = 0;
    });
    record('cell kinds', (await attr('classroom-lesson-progress-cell-seat-04-blocks-l1-if', 'data-kind')) === 'stuck');

    // 3. Sort orders.
    await page.selectOption(tid('classroom-lesson-progress-sort'), 'progress');
    await page.waitForTimeout(200);
    const firstProgress = await page.$eval('[data-testid^="classroom-lesson-progress-row-"]', (el) => el.dataset.testid);
    record('sort: most done first', firstProgress.endsWith('seat-11'), firstProgress);
    await page.selectOption(tid('classroom-lesson-progress-sort'), 'stuck');
    await page.waitForTimeout(200);
    const firstStuck = await page.$eval('[data-testid^="classroom-lesson-progress-row-"]', (el) => el.dataset.testid);
    record('sort: longest on a challenge first', firstStuck.endsWith('seat-04'), firstStuck);

    // 4. CSV in「…」.
    await page.locator(tid('classroom-detail-more-menu')).click();
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }),
        page.locator(tid('classroom-lesson-progress-csv')).click(),
    ]);
    const csvPath = resolve(SHOT_DIR, 'issue-1602-progress.csv');
    await download.saveAs(csvPath);
    const csv = (await import('node:fs')).readFileSync(csvPath, 'utf8').replace(/^﻿/, '').split('\r\n');
    record('CSV header and rows', csv[0].startsWith('出席番号,名前,課題クリア,できた数,') && csv[0].endsWith(',得点') && csv.length === JOINED + 1, `${download.suggestedFilename()} ${csv[0]}`);

    // 5. Seat click → member detail on the right (#1603 hook).
    await page.locator(tid('classroom-lesson-progress-seat-seat-03')).click();
    await page.waitForTimeout(300);
    record('seat click selects the member', !!(await page.$(tid('classroom-member-detail'))));
    record('progress fetched while visible', progressGets >= 2, `GETs=${progressGets}`);
} catch (e) {
    record('script', false, e.stack);
    await shot('error');
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
