// 生徒のクラスのセッションに関する「セッションが無効になりました」アラートが、
// 不要な場面で出ないこと・必要な場面では出ることの確認（EPIC #1195 第 2 弾の DoD）。
//
// stg の classroom API が必要（dev server は stg を向けて起動）。先生は ?devlogin= で入る。
//
//   準備: 先生がクラス + 課題A・課題B を作る
//   1. 生徒が課題A に URL（?classcode=A）で参加
//   2. 同じブラウザで URL（?classcode=B）を開く → 課題B の座席画面。アラートは出ない
//      （古い課題A のセッションを確かめると、席を空ける処理と競合して 401 になっていた）
//   3. 課題B に参加 → そのまま待ってもアラートは出ない
//   4. 同じ課題B の URL をもう一度開く → 状況画面。アラートは出ない
//   5. 普通に開き直して「クラス」メニュー → 状況画面。アラートは出ない
//   6. セッションを無効にして（壊したトークン）、課題B の URL を開く → 座席画面に戻るだけ。アラートは出ない
//   7. セッションを無効にして、URL なしで「クラス」メニュー → アラートが出る（本当に切れたことを知らせる）
//   後片付け: クラスのアーカイブはしない（stg の検証用クラスとして残る）
//
// スクショは tmp/verify-classroom-session-alerts/。
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[session-alerts]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOTS = resolve(REPO_ROOT, 'tmp', 'verify-classroom-session-alerts');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const DEV_TOKEN = (envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m)?.[1] || '').trim().replace(/^"|"$/g, '');
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:8601').replace(/\/$/, '');
const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now().toString().slice(-6);
const EXPIRED_TEXT = 'セッションが無効になりました';

let shotNo = 0;
const shot = async (page, name) => {
    shotNo += 1;
    await page.screenshot({ path: resolve(SHOTS, `${String(shotNo).padStart(2, '0')}-${name}.png`) });
};
const results = [];
const check = (cond, label) => {
    results.push({ ok: !!cond, label });
    log(`  ${cond ? 'ok' : 'NG'}: ${label}`);
};

const hasExpiredAlert = (page) => page.evaluate((t) => document.body.innerText.includes(t), EXPIRED_TEXT);
const phaseOf = (page) =>
    page.evaluate(
        () =>
            [...document.querySelectorAll('[data-testid^="classroom-phase-"]')].map((e) => e.dataset.testid).join(',') ||
            '(modal closed)',
    );
const openEditor = async (page, query = '') => {
    await page.goto(`${BASE_URL}/?no_beforeunload=1${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
};
// 確認やアラートの API 往復を待つ（アラートは非同期に出るので、出ないことは少し待ってから見る）
const settle = () => sleep(6000);

const browser = await chromium.launch(launchOpts);
let teacher;
try {
    // ---- 準備: 先生がクラス + 課題A・B ----
    teacher = await browser.newPage({ viewport: { width: 1300, height: 600 }, locale: 'ja-JP' });
    await openEditor(teacher, `&devlogin=${encodeURIComponent(DEV_TOKEN)}`);
    await sleep(1500);
    await teacher.click('[data-testid="settings-menu"]');
    await sleep(300);
    await teacher.click('[data-testid="settings-classroom-management"]');
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 60000 });
    await teacher.click('[data-testid="classroom-class-create"]');
    await teacher.fill('[data-testid="classroom-class-create-name"]', `セッション検証-${stamp}`);
    await teacher.fill('[data-testid="classroom-class-create-count"]', '5');
    await teacher.fill('[data-testid="classroom-class-create-assignment"]', `課題A-${stamp}`);
    await teacher.click('[data-testid="classroom-class-create-submit"]');
    await teacher.waitForSelector('[data-testid="classroom-board"]', { timeout: 30000 });
    await sleep(500);
    await teacher.locator('[data-testid^="classroom-board-open-"]').first().click();
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    const codeA = (await teacher.textContent('[data-testid="classroom-detail-join-code"]')).trim();
    await teacher.click('[data-testid="classroom-breadcrumb-assignments"]');
    await teacher.waitForSelector('[data-testid="classroom-board"]', { timeout: 20000 });
    await teacher.click('[data-testid="classroom-board-create"]');
    await teacher.fill('[data-testid="classroom-board-create-name"]', `課題B-${stamp}`);
    await teacher.press('[data-testid="classroom-board-create-name"]', 'Enter');
    const rowB = teacher.locator('[data-testid^="classroom-board-row-"]', { hasText: `課題B-${stamp}` });
    await rowB.waitFor({ timeout: 30000 });
    await rowB.locator('[data-testid^="classroom-board-open-"]').click();
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    const codeB = (await teacher.textContent('[data-testid="classroom-detail-join-code"]')).trim();
    log(`codes: A=${codeA} B=${codeB}`);

    // ---- 生徒（同じブラウザ = 同じ localStorage を使い続ける）----
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 600 }, locale: 'ja-JP' });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    const joinSeat = async (seat) => {
        await page.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 60000 });
        await page.click(`[data-testid="classroom-seat-${seat}"]`);
        await page.click('[data-testid="classroom-confirm-seat"]');
        await page.waitForFunction(
            () => !document.querySelector('[data-testid="classroom-phase-student-seat"]'),
            null,
            { timeout: 30000 },
        );
    };

    log('1. join assignment A via URL');
    await openEditor(page, `&classcode=${codeA}`);
    await joinSeat(1);
    await settle();
    check(!(await hasExpiredAlert(page)), '1: no alert after joining A');

    log('2. open assignment B URL in the same browser (switch class)');
    await openEditor(page, `&classcode=${codeB}`);
    await page.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 60000 });
    await settle();
    check(!(await hasExpiredAlert(page)), '2: no alert when switching to B by URL');
    await shot(page, 'switch-to-b-seat');

    log('3. join B');
    await page.click('[data-testid="classroom-seat-1"]');
    await page.click('[data-testid="classroom-confirm-seat"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="classroom-phase-student-seat"]'), null, {
        timeout: 30000,
    });
    await settle();
    check(!(await hasExpiredAlert(page)), '3: no alert after joining B');
    await shot(page, 'joined-b');

    log('4. open the same B URL again');
    await openEditor(page, `&classcode=${codeB}`);
    await settle();
    const phase4 = await phaseOf(page);
    check(phase4.includes('classroom-phase-student-status'), `4: status view for the same class (${phase4})`);
    check(!(await hasExpiredAlert(page)), '4: no alert for the same class URL');
    await shot(page, 'same-b-status');

    log('5. reopen normally and open the class menu');
    await openEditor(page);
    await sleep(1500);
    await page.click('[data-testid="classroom-menu-button"]');
    await settle();
    check(!(await hasExpiredAlert(page)), '5: no alert for a valid session');

    const breakSession = () =>
        page.evaluate(() => {
            const raw = window.localStorage.getItem('smalruby:classroom');
            const s = JSON.parse(raw);
            s.sessionToken = 'broken-token-for-verify';
            window.localStorage.setItem('smalruby:classroom', JSON.stringify(s));
        });

    log('6. dead session + the same B URL');
    await breakSession();
    await openEditor(page, `&classcode=${codeB}`);
    await settle();
    const phase6 = await phaseOf(page);
    check(phase6.includes('classroom-phase-student-seat'), `6: back to B's seat selection (${phase6})`);
    check(!(await hasExpiredAlert(page)), '6: no alert (the URL says where to go)');
    await shot(page, 'dead-session-same-url');

    log('7. dead session without a URL → the alert is shown');
    await page.click('[data-testid="classroom-seat-2"]');
    await page.click('[data-testid="classroom-confirm-seat"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="classroom-phase-student-seat"]'), null, {
        timeout: 30000,
    });
    await sleep(1500);
    await breakSession();
    await openEditor(page);
    await sleep(1500);
    await page.click('[data-testid="classroom-menu-button"]');
    await settle();
    check(await hasExpiredAlert(page), '7: alert shown when the session really expired (no URL)');
    await shot(page, 'dead-session-menu');
} catch (e) {
    log('ERROR:', e.message);
    results.push({ ok: false, label: `error: ${e.message}` });
} finally {
    await browser.close();
    const failed = results.filter((r) => !r.ok);
    log(failed.length ? `FAIL (${failed.length}/${results.length})` : `PASS (${results.length} checks)`);
    process.exit(failed.length ? 1 : 0);
}
