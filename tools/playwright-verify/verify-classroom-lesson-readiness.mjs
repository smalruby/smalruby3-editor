// The teacher's「進み具合」tab with the seat notes (#2301) at the lesson PC
// size (1300x600): 「じゅんび ✓」/「じゅんび △ <names> ほか N」 from the
// readiness check result and 「おさらい中: <challenge>」 for a review challenge.
// The classroom API is stubbed with page.route, so no login or stg data is
// needed — only the dev server.
//
//   node verify-classroom-lesson-readiness.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-lesson-readiness.mjs    # + docs/classroom/screenshots
//   BASE=http://localhost:8611 node verify-classroom-lesson-readiness.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
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
const MIN = 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const classrooms = [
    {
        classroomId: 'c1',
        assignmentName: 'チャットをつくろう',
        joinCode: 'abc234',
        hasLesson: true,
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
    },
];
// Lessons 1 and 2 of the chat course.
const CH = [
    'chat-l1-sequence',
    'chat-l1-repeat',
    'chat-l1-branch',
    'chat-l1-read-diagram',
    'chat-l2-omikuji',
    'chat-l2-timer',
    'chat-l2-janken',
];
const lesson = {
    courseId: 'chat-wo-tsukurou',
    challengeIds: CH,
    requiredChallengeIds: [],
    completion: { type: 'all' },
    submitWork: false,
    scoring: null,
};
const BASE_CHALLENGES = ['blocks-l0-where', 'blocks-l1-ask-answer', 'blocks-l1-count', 'blocks-l1-broadcast'];
const JOINED = 20;
const members = [];
const progress = [];
for (let seat = 1; seat <= JOINED; seat++) {
    const memberId = `seat-${String(seat).padStart(2, '0')}`;
    members.push({ memberId, displayName: `生徒${seat}`, joinedAt: iso(now - 40 * MIN), lastActiveAt: iso(now - 2 * MIN) });
    const doneCount = seat % 6 === 0 ? 0 : seat % CH.length;
    const challenges = {};
    for (let i = 0; i < doneCount; i++) challenges[CH[i]] = { completedAt: iso(now - (30 - i) * MIN), before: false };
    // seat % 4: 0 = no result, 1 = all right, 2 = one missing, 3 = three missing
    const missing = [null, [], ['blocks-l1-count'], BASE_CHALLENGES.slice(0, 3)][seat % 4];
    const review = seat % 5 === 2;
    const cur = review ? 'blocks-l1-count' : doneCount < CH.length ? CH[doneCount] : null;
    progress.push({
        memberId,
        seatNumber: seat,
        challenges,
        current: cur ? { challengeId: cur, openedAt: iso(now - 3 * MIN), ...(review ? { review: true } : {}) } : null,
        readiness: missing ? { checkedAt: iso(now - 35 * MIN), missing } : null,
        updatedAt: iso(now - MIN),
    });
}

const results = [];
const record = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false', args: ['--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP', acceptDownloads: true });
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
await page.route(/\/classrooms\/c\d$/, (r) => r.fulfill({ json: classrooms[0] }));
await page.route(/\/classrooms\/c\d\/members$/, (r) => r.fulfill({ json: { members } }));
await page.route(/\/classrooms\/c\d\/submissions$/, (r) => r.fulfill({ json: { submissions: [] } }));
await page.route(/\/classrooms\/c\d\/lesson-progress$/, (r) => r.fulfill({ json: { lesson, progress } }));
await page.route(/\/classrooms\/c\d\/assignment$/, (r) =>
    r.fulfill({ json: { assignment: { pages: [{ text: 'チャットをつくろう。' }] }, lesson } }),
);

const tid = (id) => `[data-testid="${id}"]`;
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
    await page.locator(tid('classroom-tab-progress')).click();
    await page.waitForSelector(tid('classroom-lesson-progress'), { timeout: 10000 });
    await page.waitForTimeout(600);

    record('じゅんび ✓ (seat 1)', (await text('classroom-lesson-progress-readiness-seat-01')) === 'じゅんび ✓');
    record(
        'じゅんび △ one name (seat 2)',
        (await text('classroom-lesson-progress-readiness-seat-02')) === 'じゅんび △ 数えよう',
    );
    record(
        'じゅんび △ two names + ほか 1 (seat 3)',
        (await text('classroom-lesson-progress-readiness-seat-03')) === 'じゅんび △ どこでしょう？・聞いて答えよう ほか 1',
    );
    record('no note without a result (seat 4)', !(await page.$(tid('classroom-lesson-progress-readiness-seat-04'))));
    record('おさらい中 (seat 2)', (await text('classroom-lesson-progress-review-seat-02')) === 'おさらい中: 数えよう');
    const fit = await page.$eval(tid('classroom-lesson-progress-frame'), (frame) => ({
        frameRight: Math.round(frame.getBoundingClientRect().right),
        tableWidth: Math.round(frame.querySelector('table').getBoundingClientRect().width),
        frameWidth: Math.round(frame.clientWidth),
        page: document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth,
    }));
    record('the page does not scroll sideways at 1300x600', fit.page, JSON.stringify(fit));
    await page.screenshot({ path: resolve(SHOT_DIR, 'issue-2301-progress-notes.png') });
    if (DOCS_SHOTS) await page.screenshot({ path: resolve(DOCS_DIR, '0264-detail-lesson-progress-readiness.png') });

    // The CSV has no readiness / review column.
    await page.locator(tid('classroom-detail-more-menu')).click();
    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }),
        page.locator(tid('classroom-lesson-progress-csv')).click(),
    ]);
    const csvPath = resolve(SHOT_DIR, 'issue-2301-progress.csv');
    await download.saveAs(csvPath);
    const csv = readFileSync(csvPath, 'utf8');
    record('CSV has no readiness / review', !/じゅんび|おさらい/.test(csv), csv.split('\r\n')[0]);
} catch (e) {
    record('script', false, e.stack);
    await page.screenshot({ path: resolve(SHOT_DIR, 'issue-2301-error.png') });
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
