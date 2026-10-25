/**
 * 着席・提出などの状態アイコン (#1196) のリグレッション確認。
 *
 * classroom API を route interception でスタブするので stg デプロイ不要
 * （dev server だけが前提）。確認する画面:
 *   1. 先生の課題詳細 → メンバータブ: 凡例 + セルごとの着席系/提出系アイコン + 退室依頼アイコン
 *   2. メンバー詳細: 着席/未提出アイコン
 *   3. 生徒の座席選択: 使用中の席に「使用中」アイコン
 *   4. メニューバーの生徒表示: 自分の提出状態アイコン
 *
 *   node verify-classroom-status-icons.mjs                     # コンテナ内 (headless)
 *   HEADLESS=false CHANNEL=chrome node verify-classroom-status-icons.mjs
 *   DOCS_SHOTS=1 node verify-classroom-status-icons.mjs        # docs/classroom/screenshots も撮り直す
 */
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADLESS = process.env.HEADLESS !== 'false';
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
// docs のスクショは既存と同じ 1470x784 の全画面で揃える。
const VIEWPORT = { width: 1470, height: 784 };
const docShot = async (p, name) => {
    if (DOCS_SHOTS) await p.screenshot({ path: resolve(REPO_ROOT, 'docs', 'classroom', 'screenshots', name) });
};

const results = [];
const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
};

const now = Date.now();
const minutesAgo = (m) => new Date(now - m * 60 * 1000).toISOString();

const classroomSummary = {
    classroomId: 'c1',
    className: '技術',
    assignmentName: 'ねこ迷路ゲーム',
    joinCode: 'abc234',
    studentCount: 10,
    googleClassroomCourseId: null,
    googleClassroomAlternateLink: null,
    createdAt: '2026-10-10T00:00:00.000Z',
    expiresAt: '2027-01-10T00:00:00.000Z',
    coTeacherEmails: [],
    groupId: 'g1',
    topic: null,
    sortDate: '2026-10-10T00:00:00.000Z',
    hasAssignment: true,
    status: 'active',
    role: 'owner',
};

const members = [
    { memberId: 'seat-01', displayName: '01', lastActiveAt: minutesAgo(1) },
    { memberId: 'seat-02', displayName: '02', lastActiveAt: minutesAgo(3) },
    { memberId: 'seat-03', displayName: '03', lastActiveAt: minutesAgo(5) },
    { memberId: 'seat-04', displayName: '04', lastActiveAt: minutesAgo(180) },
    { memberId: 'seat-05', displayName: '05', lastActiveAt: minutesAgo(240) },
];
const submissions = [
    { submissionId: 's2', memberId: 'seat-02', status: 'submitted', submittedAt: minutesAgo(2) },
    { submissionId: 's3', memberId: 'seat-03', status: 'returned', submittedAt: minutesAgo(20) },
    { submissionId: 's5', memberId: 'seat-05', status: 'submitted', submittedAt: minutesAgo(200) },
];
const kickRequests = [{ requestId: 'k1', seatNumber: 4, reason: '席を間違えました', createdAt: minutesAgo(1) }];

const notification = {
    notificationId: '2026-10-25T03:00:00.000Z#n1',
    type: 'share_suggestion',
    title: '課題を開く',
    body: 'stub',
    link: { kind: 'classroom', classroomId: 'c1' },
    readAt: null,
    createdAt: '2026-10-25T03:00:00.000Z',
};

const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });

// ---------- 1-2. Teacher ----------
const page = await browser.newPage({ viewport: VIEWPORT });
await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [notification], unreadCount: 1 } }));
await page.route('**/notifications/mark-read', (r) => r.fulfill({ json: { updated: 1 } }));
await page.route('**/classroom-groups', (r) =>
    r.fulfill({ json: { groups: [{ groupId: 'g1', name: '技術', year: 2026, status: 'active', schemaVersion: 2, topics: [] }] } }),
);
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: [classroomSummary] } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: [classroomSummary] } }));
await page.route('**/classrooms/c1', (r) => r.fulfill({ json: classroomSummary }));
await page.route('**/classrooms/c1/members', (r) => r.fulfill({ json: { members } }));
await page.route('**/classrooms/c1/kick-requests', (r) => r.fulfill({ json: { requests: kickRequests } }));
await page.route('**/classrooms/c1/submissions', (r) => r.fulfill({ json: { submissions } }));
await page.route('**/classrooms/c1/assignment', (r) =>
    r.fulfill({ json: { pages: [{ text: 'ページ1', imageUrl: null }], starterUrl: null } }),
);

await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
await page.locator('[data-testid="settings-menu"]').click();
await page.locator('[data-testid="settings-classroom-management"]').click();
await page.waitForTimeout(2000);
await page.locator('[data-testid="classroom-notifications-button"]').click();
await page.waitForTimeout(500);
await page.locator(`[data-testid="classroom-notification-item-${notification.notificationId}"]`).click();
await page.waitForTimeout(2500);
await page.locator('[data-testid="classroom-tab-members"]').click();
await page.waitForTimeout(800);

const cellStatuses = (seat) =>
    page.$$eval(`[data-testid="classroom-member-seat-${String(seat).padStart(2, '0')}"] [role="img"]`, (els) =>
        els.map((e) => e.dataset.status),
    );
check('legend shows 7 icons', (await page.locator('[data-testid="classroom-status-legend"] [role="img"]').count()) === 7);
check('seat 1 seated+notSubmitted', JSON.stringify(await cellStatuses(1)) === '["seated","notSubmitted"]');
check('seat 2 seated+submitted', JSON.stringify(await cellStatuses(2)) === '["seated","submitted"]');
check('seat 3 seated+returned', JSON.stringify(await cellStatuses(3)) === '["seated","returned"]');
check(
    'seat 4 notSeated+notSubmitted+kickRequested',
    JSON.stringify(await cellStatuses(4)) === '["notSeated","notSubmitted","kickRequested"]',
);
check('seat 6 notJoined', JSON.stringify(await cellStatuses(6)) === '["notJoined"]');
check(
    'icons have aria-label',
    (await page.getAttribute('[data-testid="classroom-member-seat-01"] [role="img"]', 'aria-label')) === '着席中',
);
await page.locator('[data-testid="classroom-phase-teacher-detail"]').screenshot({ path: resolve(SHOT_DIR, 'status-icons-teacher-grid.png') });
await docShot(page, '0205-teacher-detail-submitted.png');

await page.locator('[data-testid="classroom-member-seat-04"]').click();
await page.waitForTimeout(500);
check(
    'member detail shows notSeated icon',
    await page.locator('[data-testid="classroom-member-detail-seated"] [data-status="notSeated"]').isVisible(),
);
check(
    'member detail shows notSubmitted icon',
    await page.locator('[data-testid="classroom-member-detail-not-submitted"] [data-status="notSubmitted"]').isVisible(),
);
await page.locator('[data-testid="classroom-member-detail"]').screenshot({ path: resolve(SHOT_DIR, 'status-icons-member-detail.png') });
await docShot(page, '0206-teacher-member-detail.png');

// ---------- 3. Student seat selector ----------
const student = await browser.newPage({ viewport: VIEWPORT });
await student.route('**/classrooms/lookup', (r) =>
    r.fulfill({
        json: { className: '技術', assignmentName: 'ねこ迷路ゲーム', studentCount: 10, takenSeats: [1, 2, 3, 4, 5], expiresAt: null },
    }),
);
await student.goto(`${BASE}/?no_beforeunload=1&locale=ja&classcode=abc234`, { waitUntil: 'load' });
await student.locator('[data-testid="classroom-seat-grid"]').waitFor({ state: 'visible', timeout: 20000 });
check('taken seat shows occupied icon', await student.locator('[data-testid="classroom-seat-1"] [data-status="occupied"]').isVisible());
check('free seat has no icon', (await student.locator('[data-testid="classroom-seat-6"] [role="img"]').count()) === 0);
await student.locator('[data-testid="classroom-phase-student-seat"]').screenshot({ path: resolve(SHOT_DIR, 'status-icons-student-seat.png') });
await docShot(student, '0302-student-seat.png');

// ---------- 4. Menu bar ----------
for (const [status, expected] of [
    [null, 'notSubmitted'],
    ['submitted', 'submitted'],
    ['returned', 'returned'],
]) {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const p = await ctx.newPage();
    await p.route('**/classrooms/verify-session', (r) => r.fulfill({ json: { valid: true } }));
    await p.addInitScript((s) => {
        window.localStorage.setItem(
            'smalruby:classroom',
            JSON.stringify({
                classroomId: 'c1',
                className: '技術',
                assignmentName: 'ねこ迷路ゲーム',
                seatNumber: 7,
                memberId: 'seat-07',
                sessionToken: 'stub',
                joinedAt: new Date().toISOString(),
                submissionStatus: s,
            }),
        );
    }, status);
    await p.goto(`${BASE}/?no_beforeunload=1&locale=ja`, { waitUntil: 'load' });
    await p.locator('[data-testid="classroom-menu-submission-status"]').waitFor({ state: 'visible', timeout: 20000 });
    check(
        `menu bar shows ${expected}`,
        await p.locator(`[data-testid="classroom-menu-submission-status"] [data-status="${expected}"]`).isVisible(),
    );
    await p.locator('[data-testid="classroom-menu-button"]').screenshot({ path: resolve(SHOT_DIR, `status-icons-menu-${expected}.png`) });
    if (expected === 'submitted') await docShot(p, '0103-menu-bar-joined.png');
    await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
