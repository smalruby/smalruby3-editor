/**
 * 共有推奨 (EPIC #1106) のリグレッション確認。
 *
 * classroom API を route interception でスタブするので stg デプロイ不要
 * （dev server 8601 だけが前提）。確認する流れ:
 *   1. share_suggestion 通知 (link.kind='classroom') をクリック → 該当課題の
 *      詳細へジャンプ
 *   2. 詳細に「この課題、みんなの課題に共有しませんか？」バナー
 *   3. バナーの CTA → ボードへ戻って共有ステップ (share-step) が開く
 *   4. ボード行に「共有おすすめ」マーク
 *
 *   node verify-share-suggestion.mjs                     # コンテナ内 (headless)
 *   HEADLESS=false CHANNEL=chrome node verify-share-suggestion.mjs
 */
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADLESS = process.env.HEADLESS !== 'false';
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const results = [];
const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
};

const classroomSummary = {
    classroomId: 'c1',
    className: '技術',
    assignmentName: 'ねこ迷路ゲーム',
    joinCode: 'abc234',
    studentCount: 30,
    googleClassroomCourseId: null,
    googleClassroomAlternateLink: null,
    createdAt: '2026-07-10T00:00:00.000Z',
    expiresAt: '2026-10-10T00:00:00.000Z',
    coTeacherEmails: [],
    groupId: 'g1',
    topic: null,
    sortDate: '2026-07-10T00:00:00.000Z',
    hasAssignment: true,
    recommendedForSharing: true,
    status: 'active',
    role: 'owner',
};

const notification = {
    notificationId: '2026-07-25T03:00:00.000Z#n1',
    type: 'share_suggestion',
    title: 'この課題、みんなの課題に共有しませんか？',
    body: '「ねこ迷路ゲーム」が内容の充実した課題として運営のおすすめに選ばれました。課題一覧の「共有」から、全国の先生に共有できます。',
    link: { kind: 'classroom', classroomId: 'c1' },
    readAt: null,
    createdAt: '2026-07-25T03:00:00.000Z',
};

const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [notification], unreadCount: 1 } }));
await page.route('**/notifications/mark-read', (r) => r.fulfill({ json: { updated: 1 } }));
await page.route('**/classroom-groups', (r) => r.fulfill({
    json: { groups: [{ groupId: 'g1', name: '技術', year: 2026, status: 'active', schemaVersion: 2, topics: [] }] },
}));
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: [classroomSummary] } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: [classroomSummary] } }));
await page.route('**/classrooms/c1', (r) => r.fulfill({ json: classroomSummary }));
await page.route('**/classrooms/c1/members', (r) => r.fulfill({ json: { members: [] } }));
await page.route('**/classrooms/c1/kick-requests', (r) => r.fulfill({ json: { requests: [] } }));
await page.route('**/classrooms/c1/submissions', (r) => r.fulfill({ json: { submissions: [] } }));
await page.route('**/classrooms/c1/assignment', (r) => r.fulfill({
    json: { pages: [{ text: 'ページ1', imageUrl: null }], starterUrl: null },
}));

await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
await page.waitForTimeout(3000);

await page.locator('[data-testid="settings-menu"]').click();
await page.locator('[data-testid="settings-classroom-management"]').click();
await page.waitForTimeout(2000);

// 1. 通知からのジャンプ。
await page.locator('[data-testid="classroom-notifications-button"]').click();
await page.waitForTimeout(500);
const item = page.locator(`[data-testid="classroom-notification-item-${notification.notificationId}"]`);
check('share_suggestion notice rendered', await item.isVisible().catch(() => false));
await item.click();
await page.waitForTimeout(2500);

// 2. 詳細バナー。
const banner = page.locator('[data-testid="classroom-share-suggestion-banner"]');
check('banner on assignment detail', await banner.isVisible().catch(() => false));
await page.screenshot({ path: resolve(REPO_ROOT, 'tmp', 'share-suggestion-banner.png') });

// 3. CTA → 共有ステップ。
await page.locator('[data-testid="classroom-share-suggestion-open"]').click();
await page.waitForTimeout(1500);
check('share step opens', await page.locator('[data-testid="classroom-phase-share-step"]').isVisible().catch(() => false));
await page.screenshot({ path: resolve(REPO_ROOT, 'tmp', 'share-suggestion-share-step.png') });

// 4. ボード行のマーク（共有ステップを閉じてボードへ）。
await page.locator('[data-testid="classroom-breadcrumb-assignments"]').click();
await page.waitForTimeout(1000);
check('board row mark', await page.locator('[data-testid="classroom-board-share-suggested-c1"]').isVisible().catch(() => false));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
