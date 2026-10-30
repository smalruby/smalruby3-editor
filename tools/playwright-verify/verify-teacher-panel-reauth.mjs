// 先生の「いまの課題の状況」パネルのログイン期限切れ（#1250）を 1300×600 で確かめる。
// classroom API はスタブ（page.route）。トークンが 'expired.token.stub' のとき 401 を返す。
// - window.smalruby.forceTeacherPanel401() → 期限切れの文言と「再認証する」リンクが出て、
//   401 を撃ち続けない（ポーリング停止）
// - 再認証に失敗（?devlogin= はプロバイダの再認証が無い）→ クラス管理が開く
// - クラス管理を閉じる → 有効なトークンで取り直し、エラーが消える
// 成功する経路（プロバイダの再認証）は headless では通らないので unit テストで確かめる。
// 前提: dev server（BASE_URL、既定 localhost:8601）・リポジトリ直下の .env に CLASSROOM_API_ENDPOINT。
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[verify]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOT_DIR = resolve(process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp', 'verify-teacher-panel-reauth'));
mkdirSync(SHOT_DIR, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const API = (envText.match(/^CLASSROOM_API_ENDPOINT=(.+)$/m) || [])[1]?.trim().replace(/^"|"$/g, '').replace(/\/$/, '');
if (!API) throw new Error('CLASSROOM_API_ENDPOINT missing in .env');

const BASE = process.env.BASE_URL || 'http://localhost:8601/';
const HEADLESS = process.env.HEADLESS !== 'false';
const VIEWPORT = { width: 1300, height: 600 };
const EXPIRED = 'expired.token.stub';

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const classrooms = [
    { classroomId: 'c1', className: '1年1組', assignmentName: 'じゃんけんゲーム', studentCount: 40, groupId: 'g1', status: 'active', sortDate: iso(now), joinCode: 'abcd' },
];
const members = Array.from({ length: 36 }, (_, i) => ({
    memberId: `seat-${String(i + 1).padStart(2, '0')}`,
    seatNumber: i + 1,
    nickname: `せいと${i + 1}`,
    lastActiveAt: iso(now - 60000),
}));
const calls = [];
// The class management modal's own login is simulated by accepting the token from then on.
let acceptExpired = false;

const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[page:err]', e.message));
await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const path = req.url().slice(API.length).split('?')[0];
    const method = req.method();
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (method === 'OPTIONS') {
        return route.fulfill({
            status: 204,
            headers: { ...cors, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' },
        });
    }
    const auth = req.headers().authorization || '';
    calls.push({ path, expired: auth.includes(EXPIRED) });
    const json = (body, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (auth.includes(EXPIRED) && !acceptExpired) return json({ error: 'Unauthorized' }, 401);
    if (path === '/classrooms') return json({ classrooms });
    if (path === '/kick-requests/pending') return json({ requests: [], activeAssignmentCount: 1 });
    if (/^\/classrooms\/c1\/members$/.test(path)) return json({ members });
    if (/^\/classrooms\/c1\/submissions$/.test(path)) return json({ submissions: [] });
    if (path === '/notifications') return json({ notifications: [] });
    return json({});
});

const shot = (name) => page.screenshot({ path: resolve(SHOT_DIR, `${name}.png`) });
const fail = async (msg) => {
    await shot('FAIL').catch(() => {});
    console.error('[verify] FAIL:', msg);
    await browser.close();
    process.exit(1);
};
const check = (cond, msg) => (cond ? log('OK', msg) : fail(msg));

await page.goto(`${BASE}?no_beforeunload=1&devlogin=stub-token`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 180000 });
await page.waitForSelector('[data-testid="classroom-teacher-menu-button"]', { timeout: 30000 });
await sleep(1000);

await page.click('[data-testid="classroom-teacher-menu-button"]');
await page.click('[data-testid="classroom-teacher-menu-status-panel"]');
await page.waitForSelector('[data-testid="classroom-teacher-panel"]');
await page.selectOption('[data-testid="classroom-teacher-panel-assignment"]', 'c1');
await page.waitForSelector('[data-testid="classroom-teacher-panel-seat-40"]');
await sleep(500);

// 期限切れを再現して手動更新（↻）
await page.evaluate(() => window.smalruby.forceTeacherPanel401());
await page.click('[data-testid="classroom-teacher-panel-refresh"]');
await page.waitForSelector('[data-testid="classroom-teacher-panel-reauth"]', { timeout: 10000 });
const errText = await page.textContent('[data-testid="classroom-teacher-panel-error"]');
await check(errText.includes('ログインの有効期限が切れました。') && errText.includes('再認証する'), `expiry message: ${errText}`);
await check(!errText.includes('自動で再試行します'), 'not the generic retry message');
const rect = await page.$eval('[data-testid="classroom-teacher-panel"]', (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
});
log('panel rect', JSON.stringify(rect));
await check(rect.top >= 0 && rect.left >= 0 && rect.bottom <= VIEWPORT.height && rect.right <= VIEWPORT.width,
    `panel with the expiry message fits in ${VIEWPORT.width}x${VIEWPORT.height}`);
await page.locator('[data-testid="classroom-teacher-panel-error"]').scrollIntoViewIfNeeded();
await shot('01-expired-1300x600');

// ポーリング停止: 35 秒待っても 401 を撃たない
const expiredCalls = () => calls.filter((c) => c.expired && /members|submissions/.test(c.path)).length;
const n = expiredCalls();
await sleep(35000);
await check(expiredCalls() === n, `no more 401 polls while expired (${n} -> ${expiredCalls()})`);

// 再認証に失敗（devlogin）→ クラス管理が開く。クラス管理での再認証は成功した体にする
// （スタブがこのトークンを受け付ける。失敗ならクラス管理がログイン画面に戻す＝既存の経路）
acceptExpired = true;
await page.click('[data-testid="classroom-teacher-panel-reauth"]');
await page.waitForSelector('[data-testid="classroom-teacher-modal"], [class*="classroom-teacher-modal"]', { timeout: 10000 });
log('OK class management opened after a failed re-auth');
await shot('02-fallback-modal');

// クラス管理を閉じる → パネルが取り直す
await page.keyboard.press('Escape');
await sleep(500);
if (await page.$('[data-testid="classroom-teacher-modal"]')) {
    await page.click('#classroomTeacherModal [class*="close-button"], [class*="modal_close-button"]');
}
await page.waitForSelector('[data-testid="classroom-teacher-modal"]', { state: 'detached', timeout: 10000 });
await page.waitForSelector('[data-testid="classroom-teacher-panel-error"]', { state: 'detached', timeout: 10000 });
log('OK panel reloaded after class management closed (error cleared)');
await page.waitForSelector('[data-testid="classroom-teacher-panel-seat-40"]', { timeout: 5000 });
await shot('03-after-modal-closed');

log('PASS');
await browser.close();
