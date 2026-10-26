// 提出物から続ける（EPIC #1195 課題 C: #1201 生徒側 / #1202 課題設定）の通し確認。
//
// stg の classroom API（`GET /classrooms/{id}/continuable-submissions` と課題の
// `startFromPrevious`）が必要。dev server は stg を向けて起動する（プレビュー URL は本番 API）。
//
// 参加しただけでは何も読み込まない。生徒が選択肢を押したときだけ 1 回読み込み、上書き確認
// （window.confirm）も出ない — を各場面で確かめる。
//
//   先生: クラス + 課題1 を作る
//   生徒(席1): 課題1 に参加 → スプライト名を目印に変えて提出 → 名前を変える →
//              「クラス」メニューの「提出した作品を読み込む」で、この課題の提出物（current）に戻る
//   先生: 同じクラスに課題2（設定 OFF・スターターあり）を作る
//   生徒(席1): 課題2 に参加 → 何も読み込まれず、スターター / 前回 / いまのまま の選択肢 →
//              「前回の提出物から続ける」を押すと目印のスプライトが読み込まれる
//   生徒(席2): 課題2 に参加 → スターター / いまのまま の選択肢（「はじめる！」は出ない）→
//              スターターを押すとスターターが読み込まれる
//   先生: 課題3 を作り「前回の提出物から始めさせる」を ON にして保存
//   生徒(席1): 課題3 に参加 → 何も読み込まれず、前回の提出物が「おすすめ」→ 押すと読み込まれる
//   生徒(席2): 課題3 に参加 → 前回が無い旨の案内と「はじめる」
//
// 生徒の画面は授業 PC の 1300×600。スクショは tmp/verify-continue-from-submission/。
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = (...a) => console.log('[continue]', ...a);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOTS = resolve(REPO_ROOT, 'tmp', 'verify-continue-from-submission');
mkdirSync(SHOTS, { recursive: true });

const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const DEV_TOKEN = (envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m)?.[1] || '').trim().replace(/^"|"$/g, '');
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const HEADLESS = process.env.HEADLESS !== 'false';
const launchOpts = { headless: HEADLESS };
if (process.env.CHANNEL) launchOpts.channel = process.env.CHANNEL;
if (process.env.SLOWMO) launchOpts.slowMo = Number(process.env.SLOWMO);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now().toString().slice(-6);
const CLASS_NAME = `続き検証-${stamp}`;
const MARKER = `前回の作品-${stamp}`;
const STARTER_MARKER = `スターター-${stamp}`;
const dialogs = new Map();
const STUDENT_VIEWPORT = { width: 1300, height: 600 };

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

const spriteNames = (page) =>
    page.evaluate(() =>
        window.__store
            .getState()
            .scratchGui.vm.runtime.targets.filter((t) => !t.isStage && t.isOriginal)
            .map((t) => t.sprite.name),
    );
const renameFirstSprite = (page, name) =>
    page.evaluate((n) => {
        const vm = window.__store.getState().scratchGui.vm;
        const target = vm.runtime.targets.find((t) => !t.isStage);
        vm.renameSprite(target.id, n);
    }, name);
const waitSprite = (page, name, timeout = 30000) =>
    page.waitForFunction(
        (n) =>
            window.__store
                ?.getState()
                .scratchGui.vm.runtime.targets.some((t) => !t.isStage && t.sprite.name === n),
        name,
        { timeout },
    );

const browser = await chromium.launch(launchOpts);
let ok = false;
let teacher;
const students = [];

const openStudent = async (joinCode, seat, label) => {
    const ctx = await browser.newContext({ viewport: STUDENT_VIEWPORT, locale: 'ja-JP' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => log(`[${label} pageerror]`, e.message));
    dialogs.set(page, []);
    page.on('dialog', (d) => {
        dialogs.get(page).push(d.message());
        d.accept();
    });
    students.push(ctx);
    await page.goto(`${BASE_URL}/?no_beforeunload=1&classcode=${joinCode}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="classroom-phase-student-seat"]', { timeout: 90000 });
    await prepareStore(page);
    await page.click(`[data-testid="classroom-seat-${seat}"]`);
    await page.click('[data-testid="classroom-confirm-seat"]');
    // 参加後は参加確認画面か、課題のページがあれば課題の画面になる。
    // 席選択の画面が消えるのを待ち、どの画面に着いたかを記録する。
    await page.waitForFunction(() => !document.querySelector('[data-testid="classroom-phase-student-seat"]'), null, {
        timeout: 30000,
    });
    // continuable-submissions の取得を待つ（ここで何かが読み込まれてしまわないことも後で見る）
    await sleep(3000);
    const phase = await page.evaluate(
        () => [...document.querySelectorAll('[data-testid^="classroom-phase-"]')].map((e) => e.dataset.testid).join(',') || '(modal closed)',
    );
    log(`  ${label} landed on: ${phase}`);
    return page;
};

// 選択肢を押すとモーダルは自動で閉じる（開始ボタンとして振る舞う）ので、残っているときだけ閉じる
const closeJoined = async (page) => {
    const close = await page.$('[data-testid="classroom-joined-close"]');
    if (close) await close.click();
    await sleep(500);
};

const noAutoLoad = async (page, label) => {
    const names = await spriteNames(page);
    assert(
        !names.includes(MARKER) && !names.includes(STARTER_MARKER),
        `${label}: nothing loaded by joining (sprites: ${names})`,
    );
};
const noDialog = (page, label) => assert(dialogs.get(page).length === 0, `${label}: no overwrite confirm`);

const openStatus = async (page) => {
    await page.click('[data-testid="classroom-menu-button"]');
    await page.waitForSelector('[data-testid="classroom-phase-student-status"]', { timeout: 20000 });
    await sleep(2000);
};

const createAssignmentInClass = async (name) => {
    await teacher.click('[data-testid="classroom-breadcrumb-assignments"]');
    await teacher.waitForSelector('[data-testid="classroom-board"]', { timeout: 20000 });
    await teacher.click('[data-testid="classroom-board-create"]');
    await teacher.fill('[data-testid="classroom-board-create-name"]', name);
    await teacher.press('[data-testid="classroom-board-create-name"]', 'Enter');
    const row = teacher.locator('[data-testid^="classroom-board-row-"]', { hasText: name });
    await row.waitFor({ timeout: 30000 });
    await row.locator('[data-testid^="classroom-board-open-"]').click();
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    const code = (await teacher.textContent('[data-testid="classroom-detail-join-code"]')).trim();
    assert(/^[a-z0-9]{6}$/.test(code), `assignment "${name}" join code ${code}`);
    return code;
};

try {
    // ---- 先生: クラス + 課題1 ----
    teacher = await browser.newPage({ viewport: { width: 1300, height: 600 }, locale: 'ja-JP' });
    teacher.on('pageerror', (e) => log('[teacher pageerror]', e.message));
    teacher.on('dialog', (d) => d.accept());
    log('teacher: login + create class with assignment 1');
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
    await teacher.fill('[data-testid="classroom-class-create-assignment"]', `第1回-${stamp}`);
    await teacher.click('[data-testid="classroom-class-create-submit"]');
    await teacher.waitForSelector('[data-testid="classroom-board"]', { timeout: 30000 });
    await sleep(500);
    await teacher.locator('[data-testid^="classroom-board-open-"]').first().click();
    await teacher.waitForSelector('[data-testid="classroom-phase-teacher-detail"]', { timeout: 20000 });
    const code1 = (await teacher.textContent('[data-testid="classroom-detail-join-code"]')).trim();
    assert(/^[a-z0-9]{6}$/.test(code1), `assignment 1 join code ${code1}`);

    // ---- 生徒(席1): 課題1 に参加 → 提出 ----
    log('student seat1: join assignment 1 and submit');
    const s1a = await openStudent(code1, 1, 's1-a1');
    assert(
        !(await s1a.$('[data-testid="classroom-continue-choice"]')),
        'first lesson: no continue choice (nothing submitted yet)',
    );
    await shot(s1a, 'a1-seat1-joined');
    await closeJoined(s1a);
    await renameFirstSprite(s1a, MARKER);
    await openStatus(s1a);
    await s1a.click('[data-testid="classroom-submit-button"]');
    await s1a.waitForSelector('[data-testid="classroom-submit-confirm"]', { timeout: 20000 });
    await s1a.click('[data-testid="classroom-submit-confirm"]');
    await s1a.waitForSelector('[data-testid="classroom-submit-status"]', { timeout: 60000 });
    assert(true, 'seat 1 submitted assignment 1');
    await shot(s1a, 'a1-seat1-submitted');

    // この課題の提出物を開き直す（current）
    log('student seat1: reopen this assignment\'s submission from the status view');
    await s1a.keyboard.press('Escape');
    await sleep(500);
    await renameFirstSprite(s1a, 'あとで変えた名前');
    if (await s1a.$('[data-testid="classroom-phase-student-status"]')) {
        await s1a.click('[data-testid="classroom-student-refresh"]').catch(() => {});
    } else {
        await openStatus(s1a);
    }
    await s1a.waitForSelector('[data-testid="classroom-continue-current"]', { timeout: 20000 });
    await shot(s1a, 'a1-seat1-status-open-submitted');
    await s1a.click('[data-testid="classroom-continue-current"]');
    await waitSprite(s1a, MARKER);
    assert(true, `current submission reloaded (sprite "${MARKER}")`);

    // ---- 先生: 課題2（設定 OFF）----
    log('teacher: create assignment 2 (setting off, with a starter)');
    const code2 = await createAssignmentInClass(`第2回-${stamp}`);
    // 先生の開いているプロジェクトに目印を付けてスターターにする
    await renameFirstSprite(teacher, STARTER_MARKER);
    await teacher.click('[data-testid="classroom-tab-description"]');
    await teacher.waitForSelector('[data-testid="classroom-assignment-starter-current"]', { timeout: 20000 });
    await teacher.click('[data-testid="classroom-assignment-starter-current"]');
    await teacher.fill('[data-testid="classroom-assignment-page-text-0"]', '第2回の説明');
    await teacher.click('[data-testid="classroom-assignment-save"]');
    await sleep(4000);
    await shot(teacher, 'a2-teacher-starter-saved');

    log('student seat1: join assignment 2 → choose to continue from previous');
    const s1b = await openStudent(code2, 1, 's1-a2');
    await s1b.waitForSelector('[data-testid="classroom-continue-previous"]', { timeout: 20000 });
    assert(await s1b.$('[data-testid="classroom-continue-starter"]'), 'assignment 2: the starter is a choice');
    assert(await s1b.$('[data-testid="classroom-continue-keep"]'), 'assignment 2: "as it is" is a choice');
    assert(
        !(await s1b.$('[data-testid="classroom-continue-current"]')),
        'assignment 2: no "this assignment" choice before submitting',
    );
    assert(
        !(await s1b.$('[data-testid="classroom-assignment-reload-starter"]')) &&
            !(await s1b.$('[data-testid="classroom-assignment-close"]')),
        'assignment 2: no separate open-starter / start buttons',
    );
    await noAutoLoad(s1b, 'seat 1');
    await shot(s1b, 'a2-seat1-choice');
    await s1b.click('[data-testid="classroom-continue-previous"]');
    await waitSprite(s1b, MARKER);
    assert(true, 'previous submission loaded into assignment 2');
    noDialog(s1b, 'seat 1');
    assert(
        !(await s1b.$('[data-testid^="classroom-phase-student-"]')),
        'modal closed after choosing (lands in the editor)',
    );
    await shot(s1b, 'a2-seat1-previous-loaded');

    log('student seat2: join assignment 2 → starter or as it is');
    const s2b = await openStudent(code2, 2, 's2-a2');
    await s2b.waitForSelector('[data-testid="classroom-continue-starter"]', { timeout: 20000 });
    assert(!(await s2b.$('[data-testid="classroom-continue-previous"]')), 'seat 2: no previous choice');
    assert(!(await s2b.$('[data-testid="classroom-continue-notice"]')), 'seat 2: no notice (setting off)');
    assert(!(await s2b.$('[data-testid="classroom-assignment-close"]')), 'seat 2: no separate start button');
    await noAutoLoad(s2b, 'seat 2');
    await shot(s2b, 'a2-seat2-choice');
    await s2b.click('[data-testid="classroom-continue-starter"]');
    await waitSprite(s2b, STARTER_MARKER);
    assert(true, 'starter loaded when pressed');
    noDialog(s2b, 'seat 2');
    assert(!(await spriteNames(s2b)).includes(MARKER), "seat 2 does not get seat 1's project");
    await shot(s2b, 'a2-seat2-starter-loaded');

    // ---- 先生: 課題3（設定 ON）----
    log('teacher: create assignment 3 and turn on "start from previous"');
    const code3 = await createAssignmentInClass(`第3回-${stamp}`);
    await teacher.click('[data-testid="classroom-tab-description"]');
    await teacher.waitForSelector('[data-testid="classroom-assignment-start-from-previous"]', { timeout: 20000 });
    await teacher.check('[data-testid="classroom-assignment-start-from-previous"]');
    await shot(teacher, 'a3-teacher-setting-on');
    await teacher.click('[data-testid="classroom-assignment-save"]');
    await sleep(3000);
    // 開き直して保存されたことを確かめる
    await teacher.click('[data-testid="classroom-tab-members"]');
    await sleep(500);
    await teacher.click('[data-testid="classroom-tab-description"]');
    await sleep(2000);
    assert(
        await teacher.isChecked('[data-testid="classroom-assignment-start-from-previous"]'),
        'setting persisted after save',
    );
    await shot(teacher, 'a3-teacher-setting-saved');

    log('student seat1: join assignment 3 → previous is recommended (not loaded)');
    const s1c = await openStudent(code3, 1, 's1-a3');
    await s1c.waitForSelector('[data-testid="classroom-continue-previous-recommended"]', { timeout: 20000 });
    assert(!(await s1c.$('[data-testid="classroom-continue-starter"]')), 'setting on: no starter choice');
    await noAutoLoad(s1c, 'seat 1 (setting on)');
    log('  notice:', (await s1c.textContent('[data-testid="classroom-continue-notice"]')).trim());
    await shot(s1c, 'a3-seat1-recommended');
    await s1c.click('[data-testid="classroom-continue-previous"]');
    await waitSprite(s1c, MARKER);
    assert(true, 'recommended previous submission loaded when pressed');
    noDialog(s1c, 'seat 1 (setting on)');
    await shot(s1c, 'a3-seat1-previous-loaded');

    log('student seat2: join assignment 3 → told there is no previous');
    const s2c = await openStudent(code3, 2, 's2-a3');
    await s2c.waitForSelector('[data-testid="classroom-continue-notice"]', { timeout: 10000 });
    log('  notice:', (await s2c.textContent('[data-testid="classroom-continue-notice"]')).trim());
    assert(!(await spriteNames(s2c)).includes(MARKER), "seat 2 does not get seat 1's project");
    noDialog(s2c, 'seat 2 (setting on)');
    await shot(s2c, 'a3-seat2-no-previous');

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
