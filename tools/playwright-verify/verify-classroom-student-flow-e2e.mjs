// 段 2.5（生徒の参加から提出まで・EPIC #1790）の通し（#1797）。stg の classroom API を使う。
// 先生 1・生徒 3（別々のブラウザのコンテキスト）+ 言語・スマホの確認用の生徒、1300×600 で:
//   課題 1（ふつう）: 参加 → 番号 → はじめる → つくる → メニューバーの「提出する」→ 提出できました ✓
//                     → 提出済み ✓ → 再提出 → 先生が返却 → 返却済み ✓・先生のコメント
//                     → 入り直し（おかえりなさい → つづける）
//   課題 2（スターターあり・前回から OFF）: 前回の番号が光る（自動では選ばない）→ 前回の作品から続ける
//                     / スターターから始める → 作品を読み込み直す（この課題・前回・スターター）
//                     → クラスから出る（確認）→ 共用の PC で別の生徒 → 出席番号がちがう（前回の番号を忘れる）
//   課題 3（前回から ON）: 前回の番号が使用中 → すぐ案内 → 退室依頼 → 先生が承認 → その席で参加
//                     / 30 秒たつと案内の枠と光る使用中の席 / 先生のおすすめのお知らせ
//   課題 4（レッスン）: 「はじめる」でレッスン表・条件を満たすまで「提出する」が出ない
//   en / ja-Hira: 番号 → 参加完了 → 提出確認 → 提出できました がスクロールしない
//   スマホ（667×375）: ☰ のドロワーのいちばん上に「提出する」
//   最後に作った課題とクラスをアーカイブする。
//
//   BASE=https://preview.smalruby.app/<slug>/ node verify-classroom-student-flow-e2e.mjs
//   SKIP_IDLE=1 で 30 秒待つ確認を飛ばす。
// 前提: .env に DEV_BYPASS_TOKEN（ログに出さない）。BASE は stg の API を見るブランチプレビュー
// （または stg を向けた dev server）。ブラウザは 1 つだけ起動し、コンテキストを分けて使う
// （メモリを使い過ぎないよう、使い終わったコンテキストは閉じる）。
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOT_DIR = resolve(process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp', 'verify-classroom-student-flow-e2e'));
mkdirSync(SHOT_DIR, { recursive: true });
const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const DEV_TOKEN = (envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m) || [])[1]?.trim().replace(/^"|"$/g, '');
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE = (process.env.BASE || process.env.BASE_URL || 'http://localhost:8601/').replace(/\/?$/, '/');
const HEADLESS = process.env.HEADLESS !== 'false';
const SKIP_IDLE = process.env.SKIP_IDLE === '1';
const VIEWPORT = { width: 1300, height: 600 };
const PHONE = { width: 667, height: 375 };
const CLASS_PREFIX = '段2.5検証-';
const stamp = Date.now().toString().slice(-6);
const MARKER = `前回の作品-${stamp}`;
const STARTER_MARKER = `スターター-${stamp}`;

const log = (...a) => console.log('[e2e]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (step, ok, detail = '') => {
    const d = String(detail).replace(/\s+/g, ' ').slice(0, 300);
    results.push({ step, ok: !!ok, detail: d });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${d ? ` — ${d}` : ''}`);
};
const tid = (id) => `[data-testid="${id}"]`;

const browser = await chromium.launch({ headless: HEADLESS });
const pages = {};
const created = { groupId: null, assignments: [] };

// React の Fiber から Redux store を掘り出して window.__store に置き、先生のチュートリアルを既読にする
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

const newContext = async (name, { viewport = VIEWPORT, locale = 'ja-JP' } = {}) => {
    const ctx = await browser.newContext({ viewport, locale });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[${name}:pageerror]`, e.message.slice(0, 200)));
    page.dialogs = [];
    page.on('dialog', (d) => {
        page.dialogs.push(d.message());
        d.accept().catch(() => {});
    });
    pages[name] = page;
    return page;
};
const goto = async (page, url) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 120000 });
    await sleep(1500);
    await prepareStore(page);
};
const studentUrl = (code, locale) =>
    `${BASE}?no_beforeunload=1&classcode=${code.toLowerCase()}${locale ? `&locale=${locale}` : ''}`;
const shot = (page, name) => page.screenshot({ path: resolve(SHOT_DIR, `${name}.png`) }).catch(() => {});
const text = async (page, id) => ((await page.$(tid(id))) ? (await page.$eval(tid(id), (el) => el.textContent)).trim() : null);
const exists = async (page, id) => !!(await page.$(tid(id)));
const attr = async (page, id, a) => ((await page.$(tid(id))) ? page.$eval(tid(id), (el, x) => el.getAttribute(x), a) : null);
const clickTid = (page, id) => page.$eval(tid(id), (el) => el.click());
const waitTid = (page, id, timeout = 20000) => page.waitForSelector(tid(id), { timeout });

// ページ（document）とモーダルの本文がスクロールしないか・画面の外にはみ出していないか
const scrollInfo = (page) =>
    page.evaluate(() => {
        const se = document.scrollingElement;
        const body = document.querySelector('[data-testid="classroom-modal"] [class*="modal_modal-content"]') ||
            document.querySelector('[data-testid="classroom-modal"]');
        const out = [];
        for (const el of document.querySelectorAll('[data-testid^="classroom"]')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1) out.push(el.dataset.testid);
        }
        // 課題のページの本文の枠（max-height で枠の中だけスクロールする作り）は除く
        const inner = [...document.querySelectorAll('[data-testid="classroom-modal"] *')].filter(
            (el) =>
                el.dataset.testid !== 'classroom-assignment-view-page' &&
                el.scrollHeight > el.clientHeight + 1 &&
                /(auto|scroll)/.test(getComputedStyle(el).overflowY),
        );
        return {
            page: `${se.scrollHeight}/${se.clientHeight}`,
            pageOk: se.scrollHeight <= se.clientHeight && se.scrollWidth <= se.clientWidth,
            body: body ? `${body.scrollHeight}/${body.clientHeight}` : '-',
            innerScroll: inner.map((el) => el.dataset.testid || el.className.slice(0, 40)).slice(0, 4),
            out: out.slice(0, 6),
        };
    });
const fits = (m) => m.pageOk && m.out.length === 0 && m.innerScroll.length === 0;
const checkFit = async (page, label) => {
    const m = await scrollInfo(page);
    record(`${label} 1300×600 でスクロールなし`, fits(m), JSON.stringify(m));
};

// 帯: いまの段と、全部すんだか
const band = (page) =>
    page.evaluate(() => {
        const b = document.querySelector('[data-testid="classroom-step-band"]');
        if (!b) return null;
        const steps = {};
        for (const s of ['join', 'seat', 'start', 'make', 'submit']) {
            steps[s] = document.querySelector(`[data-testid="classroom-step-band-${s}"]`)?.dataset.state;
        }
        return { complete: b.dataset.complete, now: Object.keys(steps).find((k) => steps[k] === 'now') || null, steps };
    });
const checkBand = async (page, label, expectNow) => {
    const b = await band(page);
    const ok = expectNow === 'complete' ? b?.complete === 'true' && !b.now : b?.now === expectNow;
    record(`${label}: 帯 ${expectNow}`, ok, JSON.stringify(b));
};
// 主ボタンは 1 つ（StudentMainButton = CSS Modules の main-button クラス）
const mainButtons = (page) =>
    page.evaluate(
        () =>
            [...document.querySelectorAll('[data-testid="classroom-modal"] button[class*="main-button"]')].filter(
                (b) => b.getBoundingClientRect().width > 0 && !/main-button-note/.test(b.className),
            ).length,
    );

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
    page
        .waitForFunction(
            (n) => window.__store?.getState().scratchGui.vm.runtime.targets.some((t) => !t.isStage && t.sprite.name === n),
            name,
            { timeout },
        )
        .then(() => true)
        .catch(() => false);
const closeModal = async (page) => {
    if (!(await exists(page, 'classroom-modal'))) return;
    await page.keyboard.press('Escape');
    await sleep(300);
    if (await exists(page, 'classroom-modal')) {
        await page.evaluate(() => document.querySelector('[data-testid="classroom-modal"] [class*="close-button"]')?.click());
        await sleep(300);
    }
};
const openStatus = async (page) => {
    await clickTid(page, 'classroom-menu-button');
    await waitTid(page, 'classroom-phase-student-status');
    await sleep(1500);
};
const menuSubmit = async (page) => {
    const el = await page.$(`${tid('classroom-menu-submit')}`);
    if (!el) return null;
    return { kind: await el.getAttribute('data-kind'), text: (await el.textContent()).trim() };
};

// 番号を押して参加する（確認の［参加する］まで）
const pickSeat = async (page, seat, label) => {
    await waitTid(page, `classroom-seat-${seat}`, 30000);
    await clickTid(page, `classroom-seat-${seat}`);
    await waitTid(page, 'classroom-seat-confirm');
    if (label) {
        await checkBand(page, `${label} 番号の確認`, 'seat');
        await shot(page, `${label}-seat-confirm`);
    }
    await clickTid(page, 'classroom-confirm-seat');
    await page.waitForSelector(tid('classroom-start-main'), { state: 'attached', timeout: 30000 });
    await sleep(2500); // continuable-submissions を待つ
};

// 提出: メニューバーの「提出する」→ 確認 → 提出できました
const submitFromMenu = async (page, label, { resubmit = false } = {}) => {
    await clickTid(page, 'classroom-menu-submit');
    await waitTid(page, 'classroom-submit-confirm', 30000);
    await sleep(600);
    const confirmText = await page.$eval(tid('classroom-phase-submit-confirm'), (el) => el.textContent);
    await checkBand(page, `${label} 提出確認`, 'submit');
    record(
        `${label}: 提出確認の文言（${resubmit ? '再提出' : 'はじめて'}）`,
        resubmit ? /もう一度提出/.test(confirmText) : /作品を提出します/.test(confirmText) && !/もう一度/.test(confirmText),
        confirmText.slice(0, 120),
    );
    await checkFit(page, `${label} 提出確認`);
    await shot(page, `${label}-submit-confirm`);
    await clickTid(page, 'classroom-submit-confirm');
    await waitTid(page, 'classroom-phase-submit-done', 90000);
    await sleep(500);
    record(`${label}: 提出できました ✓`, /提出できました/.test((await text(page, 'classroom-submit-done-title')) || ''), await text(page, 'classroom-submit-done-title'));
    await checkBand(page, `${label} 提出できました`, 'complete');
    record(`${label}: 提出できましたの主ボタンは 1 つ`, (await mainButtons(page)) === 1, `main=${await mainButtons(page)}`);
    await checkFit(page, `${label} 提出できました`);
    await shot(page, `${label}-submit-done`);
    const ms = await menuSubmit(page);
    record(`${label}: メニューバーが「提出済み ✓」`, ms?.kind === 'submitted' && /提出済み/.test(ms.text), JSON.stringify(ms));
    await clickTid(page, 'classroom-submit-done-continue');
    await sleep(500);
    record(`${label}: 「つづける」でクラスの画面を閉じる`, !(await exists(page, 'classroom-modal')));
};

// --- 先生 ---
let teacher;
const createAssignment = async (name) => {
    await teacher.click(tid('classroom-breadcrumb-assignments')).catch(() => {});
    await waitTid(teacher, 'classroom-board');
    if (await exists(teacher, 'classroom-board-tab-classwork')) await clickTid(teacher, 'classroom-board-tab-classwork');
    await sleep(500);
    await teacher.click(tid('classroom-board-create-menu'));
    await teacher.click(tid('classroom-board-create'));
    await teacher.fill(tid('classroom-board-create-name'), name);
    await teacher.click(tid('classroom-board-create-submit'));
    const row = teacher.locator('[data-testid^="classroom-board-row-toggle-"]', { hasText: name });
    await row.waitFor({ timeout: 30000 });
    const id = (await row.getAttribute('data-testid')).replace('classroom-board-row-toggle-', '');
    created.assignments.push(id);
    await openAssignment(id);
    const code = (await teacher.textContent(tid('classroom-detail-join-code'))).replace(/[^A-Za-z0-9]/g, '');
    return { id, code };
};
const openAssignment = async (id) => {
    if (!(await exists(teacher, `classroom-board-open-${id}`))) await teacher.locator(tid(`classroom-board-row-toggle-${id}`)).click();
    await teacher.locator(tid(`classroom-board-open-${id}`)).click();
    await waitTid(teacher, 'classroom-phase-teacher-detail');
    await waitTid(teacher, 'classroom-detail-join-code');
    await sleep(800);
};
const saveAssignment = async () => {
    const putDone = teacher.waitForResponse((r) => /\/assignment$/.test(r.url()) && r.request().method() === 'PUT', {
        timeout: 30000,
    });
    await teacher.locator(tid('classroom-assignment-save')).click();
    const res = await putDone.catch(() => null);
    await sleep(1500);
    return res?.ok();
};
const reopenTeacherModal = async () => {
    if (await exists(teacher, 'classroom-phase-teacher-detail')) return;
    await clickTid(teacher, 'classroom-teacher-menu-button');
    await sleep(300);
    await clickTid(teacher, 'classroom-teacher-menu-class-list');
    await waitTid(teacher, 'classroom-phase-teacher-class-list');
    await teacher.locator(tid(`classroom-class-open-${created.groupId}`)).click();
    await waitTid(teacher, 'classroom-board');
};

try {
    // === 先生: devlogin → クラス（5 席）+ 課題 1 ===
    teacher = await newContext('teacher');
    await goto(teacher, `${BASE}?no_beforeunload=1&locale=ja&devlogin=${encodeURIComponent(DEV_TOKEN)}`);
    await teacher.click(tid('settings-menu'));
    await sleep(300);
    await teacher.click(tid('settings-classroom-management'));
    await waitTid(teacher, 'classroom-phase-teacher-class-list', 30000);
    await prepareStore(teacher);
    await teacher.click(tid('classroom-class-create'));
    await teacher.fill(tid('classroom-class-create-name'), `${CLASS_PREFIX}${stamp}`);
    await teacher.fill(tid('classroom-class-create-count'), '5');
    await teacher.click(tid('classroom-class-create-submit'));
    await waitTid(teacher, 'classroom-board', 30000);
    await teacher.locator(tid('classroom-breadcrumb-class-list')).click();
    await waitTid(teacher, 'classroom-phase-teacher-class-list');
    created.groupId = await teacher
        .waitForFunction(
            (label) => {
                const card = [...document.querySelectorAll('[data-testid^="classroom-class-card-"]')].find((el) =>
                    el.textContent.includes(label),
                );
                return card ? card.dataset.testid.replace('classroom-class-card-', '') : null;
            },
            `${CLASS_PREFIX}${stamp}`,
            { timeout: 20000 },
        )
        .then((h) => h.jsonValue());
    log('class', created.groupId);
    await teacher.locator(tid(`classroom-class-open-${created.groupId}`)).click();
    await waitTid(teacher, 'classroom-board');
    const a1 = await createAssignment(`第1回-${stamp}`);
    log('assignment 1', a1.id);

    // === 生徒 1: 課題 1 に参加 → 番号 → はじめる → つくる → 提出 ===
    const s1 = await newContext('s1');
    await goto(s1, studentUrl(a1.code));
    await waitTid(s1, 'classroom-phase-student-seat', 30000);
    await checkBand(s1, 's1 番号選び', 'seat');
    record('s1: 番号選びに前回の番号が無い（はじめての PC）', !(await exists(s1, 'classroom-seat-previous')));
    record('s1: 番号選びの上に長い案内が無い', !(await exists(s1, 'classroom-seat-idle-guide')));
    await checkFit(s1, 's1 番号選び');
    await shot(s1, 's1-seat');
    await pickSeat(s1, 1, 's1');
    await checkBand(s1, 's1 参加完了', 'start');
    record('s1: 始め方は「はじめる」（いまの作品のまま）', (await attr(s1, 'classroom-start-method', 'data-main')) === 'keep', await text(s1, 'classroom-start-main'));
    record('s1: ほかの始め方が無い（使えるものが無い）', !(await exists(s1, 'classroom-start-others-toggle')));
    record('s1: 参加完了の主ボタンは 1 つ', (await mainButtons(s1)) === 1, `main=${await mainButtons(s1)}`);
    await checkFit(s1, 's1 参加完了');
    await shot(s1, 's1-joined');
    let ms = await menuSubmit(s1);
    record('s1: 参加中はメニューバーに「提出する」', ms?.kind === 'submit' && /提出する/.test(ms.text), JSON.stringify(ms));
    await clickTid(s1, 'classroom-start-main');
    await sleep(600);
    record('s1: 「はじめる」でクラスの画面を閉じる', !(await exists(s1, 'classroom-modal')));
    await renameFirstSprite(s1, MARKER);
    // 開き直すと「おかえりなさい」（未提出・④ つくる）
    await openStatus(s1);
    await checkBand(s1, 's1 おかえりなさい（未提出）', 'make');
    record('s1: おかえりなさいに提出のボタンが無い', !(await s1.$(`${tid('classroom-modal')} ${tid('classroom-menu-submit')}`)) && !(await exists(s1, 'classroom-submit-confirm')));
    await checkFit(s1, 's1 おかえりなさい');
    await closeModal(s1);
    await submitFromMenu(s1, 's1');

    // 再提出
    await submitFromMenu(s1, 's1 再提出', { resubmit: true });

    // 先生が返却する
    // 先生は課題 1 の詳細を開いたまま（課題を作ると詳細が開く）
    if (!(await exists(teacher, 'classroom-phase-teacher-detail'))) {
        await reopenTeacherModal();
        await openAssignment(a1.id);
    }
    await teacher.locator(tid('classroom-tab-members')).click().catch(() => {});
    await sleep(1500);
    await clickTid(teacher, 'classroom-refresh').catch(() => {});
    await sleep(1500);
    await teacher.waitForSelector('[data-testid="classroom-member-seat-01"], [data-testid="classroom-member-seat-1"]', { timeout: 20000 });
    await teacher.click('[data-testid="classroom-member-seat-01"], [data-testid="classroom-member-seat-1"]');
    await waitTid(teacher, 'classroom-member-detail-return', 20000);
    await teacher.fill(tid('classroom-member-detail-comment'), `よくできました-${stamp}`);
    await clickTid(teacher, 'classroom-member-detail-return');
    await sleep(3000);
    record('先生: 席 1 を返却', /返却/.test(await teacher.$eval(tid('classroom-member-detail'), (el) => el.textContent)));
    await shot(teacher, 'teacher-returned');

    // 生徒 1: 入り直し（同じ参加 URL）→ 番号選びを飛ばしておかえりなさい・返却済み
    await goto(s1, studentUrl(a1.code));
    const rejoined = await waitTid(s1, 'classroom-phase-student-status', 30000).then(() => true).catch(() => false);
    await sleep(2000);
    record('s1: 入り直すと番号選びを飛ばして「おかえりなさい」', rejoined && !(await exists(s1, 'classroom-phase-student-seat')), await text(s1, 'classroom-status-title'));
    record('s1: 1 行の情報が「返却済み」', /返却済み/.test((await text(s1, 'classroom-submit-status')) || ''), await text(s1, 'classroom-status-info'));
    record('s1: 先生のコメント', ((await text(s1, 'classroom-status-teacher-comment')) || '').includes(`よくできました-${stamp}`), await text(s1, 'classroom-status-teacher-comment'));
    await checkBand(s1, 's1 おかえりなさい（返却済み）', 'complete');
    record('s1: おかえりなさいの主ボタンは「つづける」1 つ', (await mainButtons(s1)) === 1 && (await exists(s1, 'classroom-status-continue')), `main=${await mainButtons(s1)}`);
    await checkFit(s1, 's1 おかえりなさい（返却済み）');
    await shot(s1, 's1-welcome-returned');
    // 作品を読み込み直す（この課題で出した作品だけ）
    await clickTid(s1, 'classroom-status-reload-toggle');
    await sleep(400);
    const kinds1 = await s1.$$eval('[data-testid^="classroom-status-reload-"]', (els) =>
        els.map((e) => e.dataset.testid.replace('classroom-status-reload-', '')).filter((k) => !['toggle', 'options'].includes(k)),
    );
    record('s1: 作品を読み込み直す = この課題の作品だけ（課題 1）', kinds1.join() === 'current', kinds1.join());
    await clickTid(s1, 'classroom-status-continue');
    await sleep(500);
    record('s1: 「つづける」で閉じる', !(await exists(s1, 'classroom-modal')));
    ms = await menuSubmit(s1);
    record('s1: メニューバーが「返却済み ✓」', ms?.kind === 'returned' && /返却済み/.test(ms.text), JSON.stringify(ms));
    await clickTid(s1, 'classroom-menu-submit');
    await waitTid(s1, 'classroom-submit-confirm', 30000);
    await sleep(500);
    record(
        's1: 返却済みから再提出の確認（先生のコメントつき）',
        /もう一度提出/.test(await s1.$eval(tid('classroom-phase-submit-confirm'), (el) => el.textContent)) &&
            (await exists(s1, 'classroom-submit-teacher-comment')),
        await text(s1, 'classroom-submit-teacher-comment'),
    );
    await checkFit(s1, 's1 返却済みの再提出確認');
    await shot(s1, 's1-resubmit-returned');
    await clickTid(s1, 'classroom-submit-cancel');
    await sleep(400);

    // === 言語: en / ja-Hira（課題 1・席 2 / 3）===
    for (const [loc, seat] of [['en', 2], ['ja-Hira', 3]]) {
        const p = await newContext(`s-${loc}`, { locale: loc === 'en' ? 'en-US' : 'ja-JP' });
        await goto(p, studentUrl(a1.code, loc));
        await waitTid(p, 'classroom-phase-student-seat', 30000);
        await checkFit(p, `${loc} 番号選び`);
        await shot(p, `${loc}-seat`);
        await pickSeat(p, seat, loc);
        await checkFit(p, `${loc} 参加完了`);
        record(`${loc}: 参加完了の主ボタン`, true, await text(p, 'classroom-start-main'));
        await shot(p, `${loc}-joined`);
        await clickTid(p, 'classroom-start-main');
        await sleep(500);
        ms = await menuSubmit(p);
        record(`${loc}: メニューバーの提出ボタン`, ms?.kind === 'submit', JSON.stringify(ms));
        await shot(p, `${loc}-menu-bar`);
        await clickTid(p, 'classroom-menu-submit');
        await waitTid(p, 'classroom-submit-confirm', 30000);
        await sleep(500);
        await checkFit(p, `${loc} 提出確認`);
        await shot(p, `${loc}-submit-confirm`);
        await clickTid(p, 'classroom-submit-confirm');
        await waitTid(p, 'classroom-phase-submit-done', 90000);
        await sleep(500);
        await checkFit(p, `${loc} 提出できました`);
        record(`${loc}: 提出できました`, true, await text(p, 'classroom-submit-done-title'));
        await shot(p, `${loc}-submit-done`);
        await clickTid(p, 'classroom-submit-done-continue');
        await sleep(400);
        ms = await menuSubmit(p);
        record(`${loc}: メニューバーが提出済み`, ms?.kind === 'submitted', JSON.stringify(ms));
        await openStatus(p);
        await checkFit(p, `${loc} おかえりなさい（提出済み）`);
        await shot(p, `${loc}-welcome`);
        await p.context().close();
    }

    // === スマホ（667×375）: ☰ のドロワーのいちばん上に「提出する」（課題 1・席 5）===
    {
        const p = await newContext('s-phone', { viewport: PHONE });
        await goto(p, studentUrl(a1.code));
        await pickSeat(p, 5);
        await clickTid(p, 'classroom-start-main');
        await sleep(600);
        await clickTid(p, 'mobile-side-rail-menu');
        await p.waitForSelector('[data-testid="mobile-drawer"][data-state="open"]', { timeout: 10000 });
        await sleep(400);
        const first = await p.evaluate(() => {
            const d = document.querySelector('[data-testid="mobile-drawer"]');
            const b = d?.querySelector('[data-testid="classroom-menu-submit"]');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            const others = [...d.querySelectorAll('button')].filter((x) => x !== b && x.getBoundingClientRect().height > 0 && !/close/.test(x.dataset.testid || ''));
            return { h: Math.round(r.height), top: Math.round(r.top), firstOther: others[0] ? Math.round(others[0].getBoundingClientRect().top) : null, placement: b.dataset.placement };
        });
        record('スマホ: ドロワーのいちばん上に「提出する」（高さ 48px）', first && first.h >= 44 && (first.firstOther === null || first.top < first.firstOther) && first.placement === 'drawer', JSON.stringify(first));
        await shot(p, 'phone-drawer');
        await p.click('[data-testid="mobile-drawer"] [data-testid="classroom-menu-submit"]');
        const opened = await waitTid(p, 'classroom-submit-confirm', 20000).then(() => true).catch(() => false);
        record('スマホ: 押すとドロワーを閉じて提出確認', opened && (await p.$('[data-testid="mobile-drawer"][data-state="closed"]')) !== null);
        await shot(p, 'phone-submit-confirm');
        await p.context().close();
    }

    // === 課題 2（スターターあり・前回から OFF）===
    await reopenTeacherModal().catch(() => {});
    await renameFirstSprite(teacher, STARTER_MARKER);
    const a2 = await createAssignment(`第2回-${stamp}`);
    await teacher.click(tid('classroom-tab-description'));
    await waitTid(teacher, 'classroom-assignment-starter-current');
    await teacher.click(tid('classroom-assignment-starter-current'));
    record('先生: 課題 2 にスターターを入れて保存', await saveAssignment());
    log('assignment 2', a2.id);

    // 生徒 1: 課題 2 → 前回の番号が光る（選ばれない）→ 前回の作品から続ける
    await renameFirstSprite(s1, 'あとで変えた名前');
    await goto(s1, studentUrl(a2.code));
    await waitTid(s1, 'classroom-phase-student-seat', 30000);
    await sleep(800);
    record('s1: 前回は 01 番でした', /01/.test((await text(s1, 'classroom-seat-previous')) || ''), await text(s1, 'classroom-seat-previous'));
    record('s1: 前回の番号は光るだけ（自動では選ばない）', (await attr(s1, 'classroom-seat-1', 'data-previous')) === '1' && !(await exists(s1, 'classroom-seat-confirm')));
    await checkFit(s1, 's1 番号選び（前回の番号）');
    await shot(s1, 's1-a2-seat-previous');
    await pickSeat(s1, 1);
    record('s1 課題 2: 主ボタンは「前回の作品から続ける」', (await attr(s1, 'classroom-start-method', 'data-main')) === 'previous', await text(s1, 'classroom-start-main'));
    record('s1 課題 2: 先生の設定が OFF なのでお知らせなし', !(await exists(s1, 'classroom-start-notice')));
    await clickTid(s1, 'classroom-start-others-toggle');
    await sleep(300);
    const others = await s1.$$eval('[data-testid^="classroom-start-other-"]', (els) => els.map((e) => e.dataset.testid.replace('classroom-start-other-', '')).filter((k) => k !== 's'));
    record('s1 課題 2: ほかの始め方 = スターター・いまのまま', others.includes('starter') && others.includes('keep') && !others.includes('current'), others.join());
    await checkFit(s1, 's1 課題 2 参加完了（ほかの始め方）');
    await shot(s1, 's1-a2-joined-others');
    record('s1 課題 2: 参加しただけでは読み込まない', !(await spriteNames(s1)).includes(MARKER));
    await clickTid(s1, 'classroom-start-main');
    record('s1 課題 2: 前回の作品が読み込まれる', await waitSprite(s1, MARKER));

    // 生徒 2: 課題 2・席 5（課題 1 で提出していない席）→ スターターから始める
    const s2 = await newContext('s2');
    await goto(s2, studentUrl(a2.code));
    await pickSeat(s2, 5);
    record('s2 課題 2: 主ボタンは「スターターから始める」', (await attr(s2, 'classroom-start-method', 'data-main')) === 'starter', await text(s2, 'classroom-start-main'));
    await clickTid(s2, 'classroom-start-main');
    record('s2 課題 2: スターターが読み込まれる', await waitSprite(s2, STARTER_MARKER));

    // 生徒 1: 課題 2 で提出 → 作品を読み込み直す（この課題・前回・スターター）→ スターター
    await closeModal(s1);
    await submitFromMenu(s1, 's1 課題 2');
    await openStatus(s1);
    await clickTid(s1, 'classroom-status-reload-toggle');
    await sleep(500);
    const kinds2 = await s1.$$eval('[data-testid^="classroom-status-reload-"]', (els) =>
        els.map((e) => e.dataset.testid.replace('classroom-status-reload-', '')).filter((k) => !['toggle', 'options'].includes(k)),
    );
    record('s1 課題 2: 作品を読み込み直す = この課題・前回・スターターの順', kinds2.join() === 'current,previous,starter', kinds2.join());
    await checkFit(s1, 's1 作品を読み込み直す');
    await shot(s1, 's1-a2-reload');
    await clickTid(s1, 'classroom-status-reload-starter');
    record('s1 課題 2: スターターを読み込み直せる', await waitSprite(s1, STARTER_MARKER));
    record('s1 課題 2: 読み込むとクラスの画面を閉じる', !(await exists(s1, 'classroom-modal')));
    // クラスから出る（確認）
    await openStatus(s1);
    await clickTid(s1, 'classroom-leave');
    await waitTid(s1, 'classroom-leave-dialog', 5000);
    await sleep(300);
    record('s1: クラスから出るの確認（フォーカスは「出る」）', await s1.evaluate(() => document.activeElement?.dataset.testid === 'classroom-leave-confirm'), await text(s1, 'classroom-leave-dialog'));
    await checkFit(s1, 's1 クラスから出るの確認');
    await shot(s1, 's1-leave-confirm');
    await s1.keyboard.press('Escape');
    await sleep(300);
    record('s1: 確認の Escape は確認だけを閉じる', (await exists(s1, 'classroom-modal')) && !(await exists(s1, 'classroom-leave-dialog')));
    await clickTid(s1, 'classroom-leave');
    await waitTid(s1, 'classroom-leave-cancel', 5000);
    await clickTid(s1, 'classroom-leave-cancel');
    await sleep(300);
    record('s1: 「やめる」で戻る', (await exists(s1, 'classroom-leave')) && !(await exists(s1, 'classroom-leave-dialog')));
    await clickTid(s1, 'classroom-leave');
    await waitTid(s1, 'classroom-leave-confirm', 5000);
    await clickTid(s1, 'classroom-leave-confirm');
    const left = await waitTid(s1, 'classroom-phase-student-join', 20000).then(() => true).catch(() => false);
    record('s1: 「出る」で参加コードの画面へ', left);
    await sleep(500);
    record('s1: 出たらメニューバーの「提出する」が消える', !(await menuSubmit(s1)));
    await closeModal(s1);

    // 共用の PC: 同じブラウザで別の生徒が課題 2 を開く → 前回は 01 番（自動では選ばない）→ 席 3 で参加
    // （席 3 は課題 1 で ja-Hira の生徒が提出した席。席番号は匿名なので、その作品が前回になる）
    await goto(s1, studentUrl(a2.code));
    await waitTid(s1, 'classroom-phase-student-seat', 30000);
    await sleep(800);
    record(
        '共用の PC: 別の生徒にも「前回は 01 番でした」が出るが自動では選ばない',
        /01/.test((await text(s1, 'classroom-seat-previous')) || '') && !(await exists(s1, 'classroom-seat-confirm')),
        await text(s1, 'classroom-seat-previous'),
    );
    await pickSeat(s1, 3);
    record('共用の PC: 席 3 は前回（課題 1 の席 3）から', (await attr(s1, 'classroom-start-method', 'data-main')) === 'previous', await text(s1, 'classroom-start-main'));
    await clickTid(s1, 'classroom-start-main');
    await sleep(800);

    // 出席番号がちがう（s2: 前の人の参加の情報が残っていた）→ 番号選びへ・空けた番号は「前回」に残さない
    await goto(s2, studentUrl(a2.code));
    await waitTid(s2, 'classroom-phase-student-status', 30000);
    await sleep(1500);
    await clickTid(s2, 'classroom-status-wrong-seat');
    const wrong = await waitTid(s2, 'classroom-phase-student-seat', 20000).then(() => true).catch(() => false);
    await sleep(1000);
    record('出席番号がちがう: 同じ課題の番号選びへ（参加コードは入れ直さない）', wrong);
    record(
        '出席番号がちがう: 空けた番号（05）を前回の番号として光らせない',
        !(await exists(s2, 'classroom-seat-previous')) && (await attr(s2, 'classroom-seat-5', 'data-previous')) !== '1',
        await text(s2, 'classroom-seat-previous'),
    );
    record('出席番号がちがう: 空けた席 5 は空席', (await attr(s2, 'classroom-seat-5', 'data-occupied')) !== '1');
    await shot(s2, 's2-wrong-seat');
    await pickSeat(s2, 4);
    await clickTid(s2, 'classroom-start-main');
    await sleep(600);

    // === 課題 3（前回から ON）===
    const a3 = await createAssignment(`第3回-${stamp}`);
    await teacher.click(tid('classroom-tab-description'));
    await teacher.click(tid('classroom-assignment-advanced-toggle'));
    await waitTid(teacher, 'classroom-assignment-start-from-previous');
    await teacher.check(tid('classroom-assignment-start-from-previous'));
    await teacher.keyboard.press('Escape');
    record('先生: 課題 3 で「前回の提出物から始めさせる」を ON にして保存', await saveAssignment());
    log('assignment 3', a3.id);

    // 生徒 3: 課題 3 の席 4 を先に取る（s2 の前回の番号）
    const s3 = await newContext('s3');
    await goto(s3, studentUrl(a3.code));
    await pickSeat(s3, 4);
    await clickTid(s3, 'classroom-start-main');
    await sleep(600);

    // 生徒 2: 課題 3 → 前回の番号（04）が使用中 → すぐ案内 → 押して退室依頼
    await goto(s2, studentUrl(a3.code));
    await waitTid(s2, 'classroom-phase-student-seat', 30000);
    await sleep(1500);
    record(
        '使用中: 前回の番号が使用中なら、待たずにすぐ案内（previousTaken）',
        (await attr(s2, 'classroom-seat-idle-guide', 'data-variant')) === 'previousTaken' &&
            (await attr(s2, 'classroom-seat-4', 'data-occupied')) === '1' &&
            (await attr(s2, 'classroom-seat-4', 'data-previous')) === '1',
        `${await text(s2, 'classroom-seat-previous')} / ${await text(s2, 'classroom-seat-idle-guide')}`,
    );
    await checkFit(s2, 's2 前回の番号が使用中');
    await shot(s2, 's2-previous-taken');
    await clickTid(s2, 'classroom-seat-4');
    await waitTid(s2, 'kick-request-confirm-dialog', 10000);
    await sleep(300);
    record('使用中: 押すと退室依頼ダイアログ', /04|4/.test(await text(s2, 'kick-request-confirm-dialog')), (await text(s2, 'kick-request-confirm-dialog')).slice(0, 80));
    await checkFit(s2, 's2 退室依頼ダイアログ');
    await shot(s2, 's2-kick-dialog');
    await clickTid(s2, 'kick-request-submit');
    const pending = await waitTid(s2, 'kick-request-pending-banner', 20000).then(() => true).catch(() => false);
    record('使用中: 依頼中の案内', pending, await text(s2, 'kick-request-pending-note'));
    await shot(s2, 's2-kick-pending');
    // 先生: トーストで承認
    const toast = await waitTid(teacher, 'classroom-teacher-kick-toast-approve', 60000).then(() => true).catch(() => false);
    record('先生: 退室依頼のトースト', toast, await text(teacher, 'classroom-teacher-kick-toast'));
    if (toast) {
        await clickTid(teacher, 'classroom-teacher-kick-toast-approve');
        const auto = await s2.waitForSelector(tid('classroom-start-main'), { state: 'attached', timeout: 60000 }).then(() => true).catch(() => false);
        await sleep(2500);
        record('使用中: 承認されると、その席で自動で参加', auto && /04/.test((await text(s2, 'classroom-menu-seat-number')) || ''), await text(s2, 'classroom-menu-label'));
        record(
            '課題 3（ON）: 前回の提出物が無い席 4 →「前回の提出物が見つかりませんでした」',
            /見つかりません/.test((await text(s2, 'classroom-start-notice')) || ''),
            `${await attr(s2, 'classroom-start-method', 'data-main')} / ${await text(s2, 'classroom-start-notice')}`,
        );
        await shot(s2, 's2-a3-joined');
        await closeModal(s2);
    }
    // 生徒 3 側: 退室させられた（次にクラスの画面を開いたとき）。途中の画面も記録する
    await sleep(3000);
    const verifyStatus = [];
    s3.on('response', (r) => {
        if (/verify-session$/.test(r.url())) verifyStatus.push(r.status());
    });
    await clickTid(s3, 'classroom-menu-button').catch(() => {});
    const transient = [];
    for (let i = 0; i < 20 && !(await exists(s3, 'classroom-kicked-banner')); i++) {
        transient.push(await s3.evaluate(() => {
            const ph = [...document.querySelectorAll('[data-testid^="classroom-phase-"]')].map((e) => e.dataset.testid.replace('classroom-phase-', '')).join(',');
            const seat = document.querySelector('[data-testid="classroom-status-seat-number"]')?.textContent || '';
            return `${ph}${seat ? `(${seat})` : ''}`;
        }));
        await sleep(500);
    }
    record('生徒 3: 席を空けられたことが番号選びのバナーでわかる', await exists(s3, 'classroom-kicked-banner'), [...new Set(transient)].join(' → '));
    record('生徒 3: 途中で「出席番号null」の画面を出さない', !transient.some((t) => /null/.test(t)), `${[...new Set(transient)].join(' → ')} verify=${verifyStatus.join(',')}`);
    await shot(s3, 's3-kicked');
    await s3.context().close();

    // 生徒 1（共用の PC・前回は席 3）: 課題 3 → 30 秒で案内の枠・使用中の席が光る → 席 1 →（ON）先生のおすすめ
    await goto(s1, studentUrl(a3.code));
    await waitTid(s1, 'classroom-phase-student-seat', 30000);
    await sleep(1000);
    record('30 秒前: 案内の枠は出ない', !(await exists(s1, 'classroom-seat-idle-guide')));
    if (!SKIP_IDLE) {
        await s1.waitForSelector(tid('classroom-seat-idle-guide'), { timeout: 40000 }).catch(() => {});
        await sleep(500);
        record(
            '30 秒たつ: 案内の枠（idle）と使用中の席が光る',
            (await attr(s1, 'classroom-seat-idle-guide', 'data-variant')) === 'idle' && (await attr(s1, 'classroom-seat-4', 'data-flash')) === '1',
            await text(s1, 'classroom-seat-idle-guide'),
        );
        await checkFit(s1, 's1 30 秒の案内');
        await shot(s1, 's1-seat-idle');
    }
    await pickSeat(s1, 1);
    record(
        '課題 3（ON）: 前回の提出物がある席 1 → 主ボタン「前回の作品から続ける」+ 先生のおすすめ',
        (await attr(s1, 'classroom-start-method', 'data-main')) === 'previous' && /おすすめ/.test((await text(s1, 'classroom-start-notice')) || ''),
        `${await text(s1, 'classroom-start-main')} / ${await text(s1, 'classroom-start-notice')}`,
    );
    await checkFit(s1, 's1 課題 3 参加完了（ON）');
    await shot(s1, 's1-a3-joined-recommended');
    await clickTid(s1, 'classroom-start-main');
    record('課題 3（ON）: 押すと前回の作品（席 1 の課題 2 の提出）が読み込まれる', await waitSprite(s1, MARKER));

    // === 課題 4（レッスン・作品も提出する）===
    await s2.context().close();
    const a4 = await createAssignment(`レッスン課題-${stamp}`);
    await teacher.locator(tid('classroom-tab-description')).click();
    await waitTid(teacher, 'classroom-lesson-settings', 15000);
    await sleep(500);
    await teacher.locator(tid('classroom-lesson-toggle')).click();
    await teacher.selectOption(tid('classroom-lesson-course'), 'kyou-kara-programmer');
    await sleep(200);
    await teacher.locator(tid('classroom-lesson-lesson-blocks-l1')).click();
    const all = await teacher.$$eval('[data-testid^="classroom-lesson-challenge-"]', (els) => els.filter((e) => e.checked).map((e) => e.value));
    for (const id of all) if (id !== 'blocks-l1-key-sound') await teacher.locator(tid(`classroom-lesson-challenge-${id}`)).click();
    await teacher.locator(tid('classroom-lesson-submit-yes')).click();
    await teacher.keyboard.press('Escape');
    record('先生: 課題 4 にレッスン（1 つ・作品も提出する）を入れて保存', await saveAssignment());
    const s4 = await newContext('s4');
    await goto(s4, studentUrl(a4.code));
    await pickSeat(s4, 1);
    // 本人の確認が出たら「消す」側（記録は無いはずなので出ない）
    record('レッスン: 主ボタンは「はじめる」（レッスン表）', (await attr(s4, 'classroom-start-method', 'data-main')) === 'lesson', await text(s4, 'classroom-start-main'));
    record('レッスン: 条件を満たすまでメニューバーに「提出する」が出ない', !(await menuSubmit(s4)), JSON.stringify(await menuSubmit(s4)));
    await checkFit(s4, 'レッスン 参加完了');
    await shot(s4, 's4-lesson-joined');
    await clickTid(s4, 'classroom-start-main');
    const lib = await waitTid(s4, 'lessons-library', 15000).then(() => true).catch(() => false);
    await sleep(800);
    const ids = await s4.$$eval('[data-testid^="lessons-library-challenge-blocks"]', (els) => els.map((e) => e.dataset.testid.replace('lessons-library-challenge-', '')));
    record('レッスン: 「はじめる」で課題のチャレンジだけのレッスン表', lib && ids.join() === 'blocks-l1-key-sound', ids.join());
    await shot(s4, 's4-lessons-library');
    await s4.context().close();
} catch (e) {
    record('script', false, e.stack);
    for (const [n, p] of Object.entries(pages)) if (!p.isClosed()) await shot(p, `FAIL-${n}`);
} finally {
    // 片付け: 作った課題とクラス（と、前に失敗した実行で残った同じ接頭辞のクラス）をアーカイブする
    try {
        if (teacher && created.groupId) {
            await teacher.keyboard.press('Escape').catch(() => {});
            await teacher.evaluate(() => window.__store.dispatch({ type: 'scratch-gui/classroom/OPEN_TEACHER_MODAL' })).catch(() => {});
            await clickTid(teacher, 'classroom-teacher-menu-button').catch(() => {});
            await sleep(300);
            await clickTid(teacher, 'classroom-teacher-menu-class-list').catch(() => {});
            await waitTid(teacher, 'classroom-phase-teacher-class-list');
            for (const id of created.assignments) {
                await teacher.locator(tid(`classroom-class-open-${created.groupId}`)).click();
                await waitTid(teacher, 'classroom-board');
                if (await exists(teacher, 'classroom-board-tab-classwork')) await clickTid(teacher, 'classroom-board-tab-classwork');
                await sleep(600);
                await openAssignment(id);
                await clickTid(teacher, 'classroom-detail-more-menu');
                await sleep(300);
                await clickTid(teacher, 'classroom-delete-classroom');
                await waitTid(teacher, 'classroom-delete-confirm', 5000);
                await clickTid(teacher, 'classroom-delete-confirm');
                await sleep(2500);
                if (!(await exists(teacher, 'classroom-phase-teacher-class-list'))) {
                    await teacher.locator(tid('classroom-breadcrumb-class-list')).click().catch(() => {});
                    await sleep(800);
                }
                log('archived assignment', id);
            }
            await waitTid(teacher, `classroom-class-settings-open-${created.groupId}`, 15000);
            const leftovers = await teacher.$$eval(
                '[data-testid^="classroom-class-card-"]',
                (els, prefix) => els.filter((el) => el.textContent.includes(prefix)).map((el) => el.dataset.testid.replace('classroom-class-card-', '')),
                CLASS_PREFIX,
            );
            for (const gid of new Set([created.groupId, ...leftovers])) {
                await teacher.locator(tid(`classroom-class-settings-open-${gid}`)).click();
                await waitTid(teacher, 'classroom-class-settings-archive', 5000);
                await clickTid(teacher, 'classroom-class-settings-archive');
                await sleep(300);
                await clickTid(teacher, 'classroom-class-settings-archive');
                await sleep(2500);
                log('archived class', gid);
            }
            record('片付け: 課題とクラスをアーカイブ', true, `${created.assignments.join(',')} / ${created.groupId}`);
        }
    } catch (e) {
        record('片付け: 課題とクラスをアーカイブ', false, e.message);
        await shot(teacher, 'FAIL-cleanup');
    }
    await browser.close();
}
writeFileSync(resolve(SHOT_DIR, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
