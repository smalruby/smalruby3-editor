/**
 * お知らせセンター (EPIC #1111) のリグレッション確認。
 *
 * classroom API を route interception でスタブするので stg デプロイ不要
 * （dev server 8601 だけが前提）。教師モーダル右上の 🔔 + 未読バッジ +
 * 一覧パネル + 開いた時点の mark-read + クリックでパネルが閉じることを
 * 確認する。
 *
 *   node verify-notification-center.mjs                     # コンテナ内 (headless)
 *   HEADLESS=false CHANNEL=chrome node verify-notification-center.mjs  # ホストで目視
 */
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADLESS = process.env.HEADLESS !== 'false';
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || 'http://localhost:8601';

// スクショは repo ルートの tmp/ へ（cwd 非依存）。
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const results = [];
const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
};

const notifications = [
    {
        notificationId: '2026-07-25T02:00:00.000Z#n2',
        type: 'admin_message',
        title: '運営からのお知らせ',
        body: 'この課題、みんなの課題に共有しませんか？',
        link: { kind: 'classroom', classroomId: 'cls-1' },
        readAt: null,
        createdAt: '2026-07-25T02:00:00.000Z',
    },
    {
        notificationId: '2026-07-24T02:00:00.000Z#n1',
        type: 'admin_message',
        title: '既読のお知らせ',
        body: '以前のお知らせです。',
        link: null,
        readAt: '2026-07-24T03:00:00.000Z',
        createdAt: '2026-07-24T02:00:00.000Z',
    },
];

const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

let markReadCalled = false;
await page.route('**/notifications', (route) => {
    route.fulfill({ json: { notifications, unreadCount: 1 } });
});
await page.route('**/notifications/mark-read', (route) => {
    markReadCalled = true;
    route.fulfill({ json: { updated: 1 } });
});
// 教師 API の残りもスタブして、stg なしでダッシュボードを開けるようにする。
await page.route('**/classroom-groups', (route) => route.fulfill({ json: { groups: [] } }));
await page.route('**/classroom-groups/migrate', (route) => route.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (route) => route.fulfill({ json: { classrooms: [] } }));
await page.route(/\/classrooms$/, (route) => route.fulfill({ json: { classrooms: [] } }));

await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
await page.waitForTimeout(3000);

// 設定メニュー → クラス管理 で教師モーダルを開く。
const settingsMenu = page.locator('[data-testid="settings-menu"]');
await settingsMenu.waitFor({ state: 'visible', timeout: 15000 });
await settingsMenu.click();
await page.waitForTimeout(500);
const manageItem = page.locator('[data-testid="settings-classroom-management"]');
await manageItem.waitFor({ state: 'visible', timeout: 5000 });
await manageItem.click();
await page.waitForTimeout(2000);

check('teacher modal opens', await page.locator('[data-testid="classroom-teacher-modal"]').isVisible().catch(() => false));

const bell = page.locator('[data-testid="classroom-notifications-button"]');
check('bell button rendered', await bell.isVisible().catch(() => false));

const badge = page.locator('[data-testid="classroom-notifications-badge"]');
check('unread badge shows 1', (await badge.textContent().catch(() => '')) === '1');

await bell.click();
await page.waitForTimeout(800);
const panel = page.locator('[data-testid="classroom-notifications-panel"]');
check('panel opens', await panel.isVisible().catch(() => false));
check('mark-read called on open', markReadCalled);
check('badge cleared after open', !(await badge.isVisible().catch(() => false)));

const item = page.locator('[data-testid="classroom-notification-item-2026-07-25T02:00:00.000Z#n2"]');
check('unread item rendered', await item.isVisible().catch(() => false));
const dots = await page.locator('[data-testid="classroom-notification-unread-dot"]').count();
check('exactly one unread dot', dots === 1, `dots=${dots}`);

await page.screenshot({ path: resolve(REPO_ROOT, 'tmp', 'notification-center-panel.png') });

// お知らせクリックでパネルが閉じる（リンク先ロードはスタブ環境では失敗して
// よい — クローズはクライアント側の挙動）。
await item.click();
await page.waitForTimeout(800);
check('panel closes on item click', !(await panel.isVisible().catch(() => false)));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
