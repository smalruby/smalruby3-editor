/**
 * Admin 推薦 → 全体公開への発展 (EPIC #1110) のリグレッション確認。
 *
 * classroom API を route interception でスタブするので stg デプロイ不要
 * （dev server 8601 だけが前提）。確認する流れ:
 *   1. 推薦通知 (link.kind='shared-mine') をクリック → みんなの課題の
 *      「自分の投稿」へジャンプ（クラス未選択でも先頭クラスを開いて表示）
 *   2. カードに 限定公開 / 推薦 バッジ
 *   3. 詳細の「みんなの課題に公開する」→ 編集モードの公開フォーム
 *      （既存メタデータが初期値・CC BY 同意は改めて必須）
 *   4. 送信で PATCH /shared-assignments/{id} に visibility='public' +
 *      licenseConsent が飛ぶ
 *
 *   node verify-shared-recommendation.mjs                     # コンテナ内 (headless)
 *   HEADLESS=false CHANNEL=chrome node verify-shared-recommendation.mjs
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

const sharedItem = {
    sharedId: 's1',
    title: 'ねこあつめ入門',
    summary: 'はじめてのゲームづくり',
    schoolLevel: 'junior-high',
    grades: [1, 2],
    subject: '技術・家庭（技術分野）',
    tags: ['甲子園'],
    lessonCount: 3,
    supplementUrl: null,
    authorName: 'るびお',
    authorAffiliation: '島根県',
    pageCount: 2,
    hasStarter: true,
    reuseCount: 0,
    visibility: 'limited',
    recommended: true,
    status: 'published',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    passcode: 'abc234',
};

const notification = {
    notificationId: '2026-07-25T02:00:00.000Z#n1',
    type: 'shared_recommended',
    title: 'あなたの課題が推薦されました',
    body: '「ねこあつめ入門」が運営の推薦を受けました。みんなの課題への全体公開を検討してみませんか？',
    link: { kind: 'shared-mine', sharedId: 's1' },
    readAt: null,
    createdAt: '2026-07-25T02:00:00.000Z',
};

const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

let patchBody = null;
await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [notification], unreadCount: 1 } }));
await page.route('**/notifications/mark-read', (r) => r.fulfill({ json: { updated: 1 } }));
await page.route('**/classroom-groups', (r) => r.fulfill({
    json: { groups: [{ groupId: 'g1', name: '技術', year: 2026, status: 'active', schemaVersion: 2, topics: [] }] },
}));
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: [] } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: [] } }));
await page.route('**/shared-assignments?**', (r) => r.fulfill({ json: { items: [sharedItem], cursor: null } }));
await page.route('**/shared-assignments/s1', (r) => {
    if (r.request().method() === 'PATCH') {
        patchBody = r.request().postDataJSON();
        r.fulfill({ json: { ...sharedItem, visibility: 'public', passcode: undefined } });
        return;
    }
    r.fulfill({
        json: {
            ...sharedItem,
            pages: [{ text: 'ページ1', imageUrl: null }, { text: 'ページ2', imageUrl: null }],
            starterUrl: 'https://signed.example/starter',
            isMine: true,
        },
    });
});

await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
await page.waitForTimeout(3000);

// 設定メニュー → クラス管理。
await page.locator('[data-testid="settings-menu"]').click();
await page.locator('[data-testid="settings-classroom-management"]').click();
await page.waitForTimeout(2000);

// 1. 推薦通知からのジャンプ。
await page.locator('[data-testid="classroom-notifications-button"]').click();
await page.waitForTimeout(500);
const item = page.locator(`[data-testid="classroom-notification-item-${notification.notificationId}"]`);
check('recommendation notice rendered', await item.isVisible().catch(() => false));
await item.click();
await page.waitForTimeout(2000);

const catalog = page.locator('[data-testid="shared-catalog"]');
check('jump opens みんなの課題', await catalog.isVisible().catch(() => false));
const mineTabClass = await page.locator('[data-testid="shared-catalog-tab-mine"]').getAttribute('class');
check('mine tab active', /active/i.test(mineTabClass || ''));

// 2. バッジ。
check('limited badge on card', await page.locator('[data-testid="shared-card-limited-badge"]').isVisible().catch(() => false));
check('recommended badge on card', await page.locator('[data-testid="shared-card-recommended-badge"]').isVisible().catch(() => false));
await page.screenshot({ path: resolve(REPO_ROOT, 'tmp', 'shared-recommendation-mine.png') });

// 3. 詳細 → 全体公開フォーム。
await page.locator('[data-testid="shared-catalog-open-s1"]').click();
await page.waitForTimeout(1000);
check('recommended note on detail', await page.locator('[data-testid="shared-detail-recommended-note"]').isVisible().catch(() => false));
await page.locator('[data-testid="shared-detail-broaden"]').click();
await page.waitForTimeout(500);
check('broaden form prefilled', (await page.locator('[data-testid="shared-form-title"]').inputValue()) === 'ねこあつめ入門');
check('submit disabled before consent', await page.locator('[data-testid="shared-form-submit"]').isDisabled());
await page.screenshot({ path: resolve(REPO_ROOT, 'tmp', 'shared-recommendation-broaden.png') });

// 4. 同意して送信 → PATCH。
await page.locator('[data-testid="shared-form-consent"]').check();
await page.locator('[data-testid="shared-form-submit"]').click();
await page.waitForTimeout(1500);
check('PATCH sent with visibility=public', patchBody && patchBody.visibility === 'public');
check('PATCH carries licenseConsent', patchBody && patchBody.licenseConsent === true);
check('PATCH has no classroomId', patchBody && patchBody.classroomId === undefined);
check('success note shown', await page.locator('[data-testid="shared-broaden-done"]').isVisible().catch(() => false));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
