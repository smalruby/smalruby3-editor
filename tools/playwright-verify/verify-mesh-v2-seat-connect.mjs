// 「出席番号でつながる」の通し確認（生徒 3 タブ、うち選んだ 1 人は欠席）。
//
// stg の classroom / mesh API が必要。dev server は stg を向けて起動する（BASE_URL で変更可。8601 以外の
// ポートでは stg の CORS に弾かれるので DISABLE_WEB_SECURITY=1 を付ける）。
//
//   先生: 5 人のクラス + 課題を作る（新しい課題の人数の上限は 6 人）
//   生徒(席1・席2・席4): クラスに参加する。席3 は参加しない（欠席）
//   席2: 1・2・3番を選ぶ →「ホストの 1番さんを待っています」（1番はクラスにいるので待つ）
//   席1: 2・3番を選ぶ → ホストとして「1・2・3番のグループ」を作る → 席2 が自動で入る
//        → 3番は「欠席のため待ちません」→ 両方「そろいました」で自動で閉じる
//   席4: 従来の「メッシュに参加する」→ 一覧に「1・2・3番のグループ」→ 選ばれていない確認 → 入る
//   席1: 接続モーダルを開き直す → 接続済み画面に「そろい具合」の 1 行
//
// 画面は授業 PC の 1300×600。スクショは tmp/verify-mesh-v2-seat-connect/。
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[seat-connect]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOTS = resolve(REPO_ROOT, 'tmp', 'verify-mesh-v2-seat-connect');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const DEV_TOKEN = (envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m)?.[1] || '').trim().replace(/^"|"$/g, '');
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.DISABLE_WEB_SECURITY === '1') launchOpts.args = ['--disable-web-security'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now().toString().slice(-6);
const CLASS_NAME = `出席番号接続-${stamp}`;
const VIEWPORT = { width: 1300, height: 600 };

let shotNo = 0;
// SAVE_DOCS=1 で docs/mesh-v2/screenshots/ の画像も撮り直す
const DOCS_SHOTS = resolve(REPO_ROOT, 'docs', 'mesh-v2', 'screenshots');
const shot = async (page, name, docName) => {
    shotNo += 1;
    const file = resolve(SHOTS, `${String(shotNo).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    log(`  shot: ${file}`);
    if (docName && process.env.SAVE_DOCS === '1') await page.screenshot({ path: resolve(DOCS_SHOTS, docName) });
};
// 授業 PC（高さ 600px）でモーダルの下端が画面に収まっているか
const modalFits = (page) =>
    page.evaluate(() => {
        const el = document.querySelector('.ReactModal__Content');
        return !!el && el.getBoundingClientRect().bottom <= window.innerHeight;
    });
const assert = (cond, label) => {
    if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
    log(`  ok: ${label}`);
};

// React の Fiber から Redux store を掘り出して window.__store に置き、チュートリアルを既読にする。
const prepareStore = (page) =>
    page.evaluate(() => {
        const all = [document.body, ...document.body.querySelectorAll('*')];
        let root = null;
        for (const el of all) {
            const k = Object.keys(el).find((x) => x.startsWith('__reactContainer'));
            if (k) {
                root = el[k];
                break;
            }
        }
        const stack = [root?.stateNode?.current];
        const seen = new WeakSet();
        while (stack.length && !window.__store) {
            const f = stack.pop();
            if (!f || seen.has(f)) continue;
            seen.add(f);
            const p = f.memoizedProps;
            if (p?.store?.dispatch) window.__store = p.store;
            else if (p?.value?.store?.dispatch) window.__store = p.value.store;
            if (f.child) stack.push(f.child);
            if (f.sibling) stack.push(f.sibling);
        }
        for (const name of ['classCreation', 'classDetail', 'inviteStudents']) {
            window.__store?.dispatch({ type: 'scratch-gui/classroom-tutorial/MARK_SEEN', name });
        }
        return !!window.__store;
    });

const openMeshModal = async (page) => {
    await page.evaluate(async () => {
        if (!window.__seatObserver) {
            window.__seatEvents = [];
            window.__seatObserver = new MutationObserver(() => {
                const t = Date.now() % 100000;
                if (document.querySelector('[data-testid="meshV2-seat-all-arrived"]')) window.__seatEvents.push(`arrived@${t}`);
                if (document.querySelector('[data-testid="meshV2-seat-error"]')) window.__seatEvents.push(`error@${t}`);
            });
            window.__seatObserver.observe(document.body, { childList: true, subtree: true });
        }
        const vm = window.__store.getState().scratchGui.vm;
        if (!vm.extensionManager.isExtensionLoaded('meshV2')) await vm.extensionManager.loadExtensionURL('meshV2');
        window.__store.dispatch({ type: 'scratch-gui/connection-modal/setId', extensionId: 'meshV2' });
        window.__store.dispatch({ type: 'scratch-gui/modals/OPEN_MODAL', modal: 'connectionModal' });
    });
};
const connectionModalOpen = (page) => page.evaluate(() => !!window.__store.getState().scratchGui.modals.connectionModal);
const groupIdOf = (page) =>
    page.evaluate(() => {
        const ext = window.__store.getState().scratchGui.vm.runtime.peripheralExtensions.meshV2;
        return ext ? ext.getConnectedGroupId() : null;
    });
const pickSeats = async (page, seats) => {
    await page.waitForSelector('[data-testid="meshV2-seat-pick"]', { timeout: 20000 });
    await page.waitForSelector('[data-testid="meshV2-seat-5"]', { timeout: 20000 });
    for (const seat of seats) await page.click(`[data-testid="meshV2-seat-${seat}"]`);
};
const disconnect = (page) =>
    page.evaluate(() => window.__store.getState().scratchGui.vm.disconnectPeripheral('meshV2')).catch(() => {});

const browser = await chromium.launch(launchOpts);
let ok = false;
const pages = [];

const openStudent = async (joinCode, seat) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => log(`[seat${seat} pageerror]`, e.message));
    page.on('dialog', (d) => d.accept());
    pages.push(page);
    await page.goto(`${BASE_URL}/?no_beforeunload=1&classcode=${joinCode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 90000 });
    await prepareStore(page);
    await page.click(`[data-testid="classroom-seat-${seat}"]`);
    await page.click('[data-testid="classroom-confirm-seat"]');
    // 課題にスターターが無いので「はじめる」（または出てきた続けかた）で始める
    const choice = page
        .locator(
            '[data-testid="classroom-continue-starter"], [data-testid="classroom-continue-current"], ' +
                '[data-testid="classroom-continue-keep"], [data-testid="classroom-joined-close"]',
        )
        .first();
    await choice.waitFor({ timeout: 30000 });
    await choice.click();
    await sleep(1500);
    return page;
};

try {
    // ---- 先生: クラス + 課題 ----
    const teacher = await browser.newPage({ viewport: VIEWPORT, locale: 'ja-JP' });
    teacher.on('pageerror', (e) => log('[teacher pageerror]', e.message));
    teacher.on('dialog', (d) => d.accept());
    log('teacher: login + create a class of 5');
    await teacher.goto(`${BASE_URL}/?no_beforeunload=1&devlogin=${encodeURIComponent(DEV_TOKEN)}`, {
        waitUntil: 'domcontentloaded',
    });
    await teacher.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 90000 });
    await sleep(1500);
    await prepareStore(teacher);
    await teacher.click('[data-testid="settings-menu"]');
    await sleep(300);
    await teacher.click('[data-testid="settings-classroom-management"]');
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-class-list"]', { timeout: 60000 });
    await teacher.click('[data-testid="classroom-class-create"]');
    await teacher.fill('[data-testid="classroom-class-create-name"]', CLASS_NAME);
    await teacher.fill('[data-testid="classroom-class-create-count"]', '5');
    await teacher.fill('[data-testid="classroom-class-create-assignment"]', `メッシュ-${stamp}`);
    await teacher.click('[data-testid="classroom-class-create-submit"]');
    await teacher.waitForSelector('[data-testid="classroom-board"]', { timeout: 30000 });
    await sleep(500);
    await teacher.locator('[data-testid^="classroom-board-open-"]').first().click();
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    const code = (await teacher.textContent('[data-testid="classroom-detail-join-code"]')).trim();
    assert(/^[a-z0-9]{6}$/.test(code), `join code ${code}`);

    // ---- 生徒: 席1・席2・席4 が参加（席3 は欠席）----
    log('students: seats 1, 2 and 4 join the class (seat 3 stays absent)');
    const s1 = await openStudent(code, 1);
    const s2 = await openStudent(code, 2);
    const s4 = await openStudent(code, 4);

    // ---- 席2: 1・2・3番を選んで待つ ----
    log('seat 2: choose 1, 2, 3 and wait for the host (seat 1)');
    await openMeshModal(s2);
    await s2.waitForSelector('[data-testid="meshV2-seat-connect-entry"]', { timeout: 20000 });
    await s2.click('[data-testid="meshV2-seat-connect-entry"]');
    await pickSeats(s2, [1, 3]);
    await shot(s2, 'seat2-pick');
    assert(await modalFits(s2), 'seat picker fits in 600px');
    await s2.click('[data-testid="meshV2-seat-connect"]');
    await s2.waitForSelector('[data-testid="meshV2-seat-wait"]', { timeout: 10000 });
    await sleep(1500);
    const note2 = await s2.textContent('[data-testid="meshV2-seat-wait-note"]');
    assert(note2.includes('ホストの 1番さんを待っています'), `seat 2 waits for the host: ${note2}`);
    const absent3 = await s2.getAttribute('[data-testid="meshV2-seat-status-3"]', 'data-status');
    assert(absent3 === 'absent', 'seat 3 is shown as absent');
    await shot(s2, 'seat2-waiting-host', '0105-seat-waiting-host-1300x600.png');
    assert(await modalFits(s2), 'waiting screen fits in 600px');
    assert((await groupIdOf(s2)) === null, 'seat 2 does not create a group');

    // ---- 席1: 画面 1 → 2・3番を選んでホストになる ----
    log('seat 1: first screen, then choose 2, 3 and host');
    await openMeshModal(s1);
    await s1.waitForSelector('[data-testid="meshV2-seat-connect-entry"]', { timeout: 20000 });
    const classNote = await s1.textContent('[data-testid="meshV2-seat-class-note"]');
    assert(classNote.includes('出席番号 1番'), `first screen shows the seat: ${classNote}`);
    await shot(s1, 'seat1-initial', '0103-seat-entry-1300x600.png');
    assert(await modalFits(s1), 'first screen fits in 600px');
    await s1.click('[data-testid="meshV2-seat-connect-entry"]');
    await pickSeats(s1, [2, 3]);
    const summary = await s1.textContent('[data-testid="meshV2-seat-summary"]');
    assert(summary.includes('ホスト: 1番'), `summary shows the host: ${summary}`);
    await shot(s1, 'seat1-pick', '0104-seat-pick-1300x600.png');
    await s1.click('[data-testid="meshV2-seat-connect"]');

    // 両方の画面で「そろいました」→ 自動で閉じる
    // 「そろいました」は 2 秒で消える。裏のタブは rAF が間引かれて見逃すので、
    // MutationObserver の記録（openMeshModal で仕掛けた）を一定間隔で見る
    const arrived = (page) =>
        page.waitForFunction(() => (window.__seatEvents || []).some((e) => e.startsWith('arrived')), null, {
            timeout: 30000,
            polling: 200,
        });
    await arrived(s1);
    if (await s1.$('[data-testid="meshV2-seat-all-arrived"]')) {
        await shot(s1, 'seat1-all-arrived', '0106-seat-all-arrived-1300x600.png');
    }
    await arrived(s2);
    await sleep(3000);
    assert(!(await connectionModalOpen(s1)), 'seat 1 modal closed by itself');
    assert(!(await connectionModalOpen(s2)), 'seat 2 modal closed by itself');
    const g1 = await groupIdOf(s1);
    const g2 = await groupIdOf(s2);
    assert(g1 && g1 === g2, `seats 1 and 2 are in the same group (${g1})`);

    // ---- 席4: 従来の「メッシュに参加する」と混ぜる ----
    log('seat 4: join the seat group from the classic list');
    await openMeshModal(s4);
    await s4.waitForSelector('[data-testid="meshV2-join-group"]', { timeout: 20000 });
    await s4.click('[data-testid="meshV2-join-group"]');
    const tile = s4.locator('[class*="peripheral-tile"]', { hasText: '1・2・3番のグループ' });
    await tile.first().waitFor({ timeout: 30000 });
    await shot(s4, 'seat4-classic-list', '0108-seat-group-in-classic-list-1300x600.png');
    await tile.first().locator('button').click();
    await s4.waitForFunction(
        () => !!window.__store.getState().scratchGui.vm.runtime.peripheralExtensions.meshV2.getConnectedGroupId(),
        null,
        { timeout: 30000 },
    );
    assert((await groupIdOf(s4)) === g1, 'seat 4 joined the same group from the classic list');

    // ---- 席1: 接続済み画面のそろい具合 ----
    log('seat 1: reopen the modal and see who is here');
    await openMeshModal(s1);
    await s1.waitForSelector('[data-testid="meshV2-seat-progress"]', { timeout: 20000 });
    const progress = await s1.textContent('[data-testid="meshV2-seat-progress"]');
    assert(progress.includes('3 欠席'), `progress line shows seat 3 absent: ${progress}`);
    await shot(s1, 'seat1-connected-progress', '0107-seat-connected-progress-1300x600.png');

    ok = true;
} catch (e) {
    log('FAILED:', e.message);
    for (const [i, p] of pages.entries()) {
        const info = await p
            .evaluate(() => {
                const ext = window.__store.getState().scratchGui.vm.runtime.peripheralExtensions.meshV2;
                return {
                    group: ext && ext.getConnectedGroupId(),
                    host: ext && ext.isConnectedAsHost(),
                    name: ext && ext.meshService && ext.meshService.groupName,
                    seen: window.__seatEvents || [],
                };
            })
            .catch((err) => err.message);
        log(`  page ${i}:`, JSON.stringify(info));
    }
    for (const [i, p] of pages.entries()) await p.screenshot({ path: resolve(SHOTS, `fail-${i}.png`) }).catch(() => {});
} finally {
    for (const p of pages.slice().reverse()) await disconnect(p);
    await sleep(1500);
    await browser.close();
}
log(ok ? 'ALL OK' : 'NG');
process.exit(ok ? 0 : 1);
