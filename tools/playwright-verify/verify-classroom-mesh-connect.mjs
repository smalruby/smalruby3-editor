// クラスで読み込んだメッシュ作品の接続モーダル自動表示 (#1251) の通し確認。
//
// stg の classroom API が必要。dev server は stg を向けて起動する（BASE_URL で変更可。8601 以外の
// ポートでは stg の CORS に弾かれるので DISABLE_WEB_SECURITY=1 を付ける）。
//
//   先生: クラス + 課題1（説明ページ + メッシュのブロックを使うスターター）を作る
//   生徒(席1): 課題1 に参加 →「スターターから始める」→ クラスのモーダルが閉じ、
//              メッシュの接続モーダル（ホストになる / 参加する）が開く。ドメインは参加コード
//              → 接続モーダルを閉じても再表示しない
//   生徒(席1):「課題を見る」→「スタータープロジェクトを開く」→ パネルが開いている間は出さない
//              → パネルを閉じたら開く（重ならない）
//   生徒(席1): 作品を変えてから同じ操作 → 上書き確認をキャンセル → 出さない
//   先生: 課題2（メッシュを使わないスターター）を作る
//   生徒(席2): 課題2 に参加 →「スターターから始める」→ 出さない
//
// 画面は授業 PC の 1300×600。スクショは tmp/verify-classroom-mesh-connect/。
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[mesh-connect]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOTS = resolve(REPO_ROOT, 'tmp', 'verify-classroom-mesh-connect');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const DEV_TOKEN = (envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m)?.[1] || '').trim().replace(/^"|"$/g, '');
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);
// stg の CORS は localhost:8601 だけを許す。別ポートの dev server で試すときは 1 にする
if (process.env.DISABLE_WEB_SECURITY === '1') launchOpts.args = ['--disable-web-security'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now().toString().slice(-6);
const CLASS_NAME = `メッシュ接続検証-${stamp}`;
const VIEWPORT = { width: 1300, height: 600 };

let shotNo = 0;
const shot = async (page, name) => {
    shotNo += 1;
    const file = resolve(SHOTS, `${String(shotNo).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    log(`  shot: ${file}`);
};
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

const modalState = (page) =>
    page.evaluate(() => {
        const s = window.__store.getState().scratchGui;
        return {
            connection: !!s.modals.connectionModal,
            extensionId: s.connectionModal.extensionId,
            classroom: !!s.classroom.modalVisible,
            pending: !!s.classroom.meshConnectPending,
        };
    });
const waitConnectionModal = (page) =>
    // クラス参加中の生徒は「出席番号でつながる」が出て、従来の 2 つはたたまれている
    page.waitForSelector('[data-testid="meshV2-seat-connect-entry"], [data-testid="meshV2-create-group"]', {
        state: 'visible',
        timeout: 20000,
    });
const closeConnectionModal = (page) =>
    page.evaluate(() =>
        window.__store.dispatch({ type: 'scratch-gui/modals/CLOSE_MODAL', modal: 'connectionModal' }),
    );

// 先生のいまの作品の先頭スプライトにメッシュのブロックを足す / 外す（スターターの元にする）
const addMeshBlock = (page) =>
    page.evaluate(async () => {
        const vm = window.__store.getState().scratchGui.vm;
        await vm.extensionManager.loadExtensionURL('meshV2');
        const target = vm.runtime.targets.find((t) => !t.isStage);
        target.blocks.createBlock({
            id: 'mesh-connect-check',
            opcode: 'meshV2_getSensorValue',
            inputs: {},
            fields: {},
            next: null,
            parent: null,
            topLevel: true,
            shadow: false,
            x: 0,
            y: 0,
        });
    });
const removeMeshBlock = (page) =>
    page.evaluate(() => {
        const vm = window.__store.getState().scratchGui.vm;
        const target = vm.runtime.targets.find((t) => !t.isStage);
        target.blocks.deleteBlock('mesh-connect-check');
    });

const browser = await chromium.launch(launchOpts);
let ok = false;
let teacher;
const students = [];

const openStudent = async (joinCode, seat, label) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => log(`[${label} pageerror]`, e.message));
    students.push(ctx);
    await page.goto(`${BASE_URL}/?no_beforeunload=1&classcode=${joinCode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 90000 });
    await prepareStore(page);
    await page.click(`[data-testid="classroom-seat-${seat}"]`);
    await page.click('[data-testid="classroom-confirm-seat"]');
    await page.waitForSelector('[data-testid="classroom-continue-starter"]', { timeout: 30000 });
    return page;
};

const createAssignment = async (name, { mesh }) => {
    await teacher.click('[data-testid="classroom-breadcrumb-assignments"]');
    await teacher.waitForSelector('[data-testid="classroom-board"]', { timeout: 20000 });
    await teacher.click('[data-testid="classroom-board-create"]');
    await teacher.fill('[data-testid="classroom-board-create-name"]', name);
    await teacher.press('[data-testid="classroom-board-create-name"]', 'Enter');
    const row = teacher.locator('[data-testid^="classroom-board-row-"]', { hasText: name });
    await row.waitFor({ timeout: 30000 });
    await row.locator('[data-testid^="classroom-board-open-"]').click();
    return setupAssignment(mesh, name);
};

const setupAssignment = async (mesh, name) => {
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    const code = (await teacher.textContent('[data-testid="classroom-detail-join-code"]')).trim();
    assert(/^[a-z0-9]{6}$/.test(code), `assignment "${name}" join code ${code}`);
    if (mesh) await addMeshBlock(teacher);
    else await removeMeshBlock(teacher);
    await teacher.click('[data-testid="classroom-tab-description"]');
    await teacher.waitForSelector('[data-testid="classroom-assignment-starter-current"]', { timeout: 20000 });
    await teacher.click('[data-testid="classroom-assignment-starter-current"]');
    await teacher.fill('[data-testid="classroom-assignment-page-text-0"]', `${name} の説明`);
    await teacher.click('[data-testid="classroom-assignment-save"]');
    await sleep(4000);
    return code;
};

try {
    // ---- 先生: クラス + 課題1（メッシュのスターター）----
    teacher = await browser.newPage({ viewport: VIEWPORT, locale: 'ja-JP' });
    teacher.on('pageerror', (e) => log('[teacher pageerror]', e.message));
    teacher.on('dialog', (d) => d.accept());
    log('teacher: login + create class with a mesh starter');
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
    const code1 = await setupAssignment(true, `メッシュ-${stamp}`);

    // ---- 生徒(席1): スターターから始める → 接続モーダル ----
    log('student seat1: start from the mesh starter');
    const s1 = await openStudent(code1, 1, 's1');
    let dialogAction = 'accept';
    s1.on('dialog', (d) => (dialogAction === 'accept' ? d.accept() : d.dismiss()));
    await shot(s1, 'seat1-choice');
    await s1.click('[data-testid="classroom-continue-starter"]');
    await waitConnectionModal(s1);
    let st = await modalState(s1);
    assert(st.connection && st.extensionId === 'meshV2', 'mesh connection modal opened');
    assert(!st.classroom, 'classroom modal is closed (no overlap)');
    const domain = await s1.inputValue('[data-testid="meshV2-domain-input"]').catch(() => null);
    log(`  domain input: ${domain}`);
    assert(domain === null || domain.toLowerCase() === code1, 'domain is the join code');
    await shot(s1, 'seat1-connection-modal');

    await closeConnectionModal(s1);
    await sleep(2500);
    st = await modalState(s1);
    assert(!st.connection && !st.pending, 'closing the connection modal does not bring it back');

    // ---- 課題パネルの「スタータープロジェクトを開く」: パネルを閉じたら出す ----
    log('student seat1: reopen the starter from the assignment panel');
    await s1.click('[data-testid="classroom-menu-button"]');
    await s1.waitForSelector('[data-testid="classroom-view-assignment-button"]', { timeout: 20000 });
    await s1.click('[data-testid="classroom-view-assignment-button"]');
    await s1.waitForSelector('[data-testid="classroom-assignment-reload-starter"]', { timeout: 20000 });
    await s1.click('[data-testid="classroom-assignment-reload-starter"]');
    await s1.waitForFunction(() => window.__store.getState().scratchGui.classroom.meshConnectPending, null, {
        timeout: 20000,
    });
    await sleep(1000);
    st = await modalState(s1);
    assert(st.classroom && !st.connection, 'while the panel stays open the connection modal waits');
    await shot(s1, 'seat1-panel-open-waiting');
    await s1.click('[data-testid="classroom-assignment-close"]');
    await waitConnectionModal(s1);
    st = await modalState(s1);
    assert(st.connection && !st.classroom, 'connection modal opened after closing the panel');
    await shot(s1, 'seat1-connection-modal-after-panel');
    await closeConnectionModal(s1);

    // ---- 上書き確認をキャンセル → 出さない ----
    log('student seat1: cancel the overwrite confirm');
    await s1.evaluate(() => {
        const vm = window.__store.getState().scratchGui.vm;
        const target = vm.runtime.targets.find((t) => !t.isStage);
        vm.renameSprite(target.id, 'かえた名前');
        window.__store.dispatch({ type: 'scratch-gui/project-changed/SET_PROJECT_CHANGED', changed: true });
    });
    dialogAction = 'dismiss';
    await s1.click('[data-testid="classroom-menu-button"]');
    await s1.waitForSelector('[data-testid="classroom-view-assignment-button"]', { timeout: 20000 });
    await s1.click('[data-testid="classroom-view-assignment-button"]');
    await s1.waitForSelector('[data-testid="classroom-assignment-reload-starter"]', { timeout: 20000 });
    await s1.click('[data-testid="classroom-assignment-reload-starter"]');
    await sleep(3000);
    await s1.click('[data-testid="classroom-assignment-close"]');
    await sleep(2500);
    st = await modalState(s1);
    assert(!st.connection && !st.pending, 'cancelled overwrite: no connection modal');

    // ---- 先生: 課題2（メッシュを使わないスターター）→ 生徒(席2) ----
    log('teacher: create assignment 2 with a starter without mesh');
    const code2 = await createAssignment(`メッシュなし-${stamp}`, { mesh: false });
    const s2 = await openStudent(code2, 2, 's2');
    await s2.click('[data-testid="classroom-continue-starter"]');
    await s2.waitForFunction(() => !window.__store.getState().scratchGui.classroom.modalVisible, null, {
        timeout: 30000,
    });
    await sleep(2500);
    st = await modalState(s2);
    assert(!st.connection && !st.pending, 'a starter without mesh does not open the connection modal');
    await shot(s2, 'seat2-no-mesh');

    ok = true;
    log('PASS');
} catch (e) {
    log('ERROR:', e.message);
    try {
        await teacher?.screenshot({ path: resolve(SHOTS, 'error-teacher.png') });
        for (const [i, ctx] of students.entries()) {
            const [p] = ctx.pages();
            await p?.screenshot({ path: resolve(SHOTS, `error-student-${i}.png`) });
        }
    } catch {
        /* ignore */
    }
} finally {
    if (process.env.KEEP_OPEN === '1') {
        log('KEEP_OPEN=1 — leaving browser open.');
        await new Promise(() => {});
    }
    await browser.close();
    process.exit(ok ? 0 : 1);
}
