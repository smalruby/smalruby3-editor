// 段 2（クラスの課題とレッスン・EPIC #1592）の通し（#1604）。stg の classroom API を使う。
// 先生 1・生徒 3（別々のブラウザのコンテキスト）で:
//   先生: クラス + 課題 2 つを作る（課題 1 = レッスンだけ・課題 2 = 作品も提出する）
//         → 説明タブでコース・レッスン・チャレンジ・★・「n つ」・作品の提出を選んで保存
//   生徒 A: 端末に課題の前の記録あり → 本人の確認「わたしの記録です」（前として送る）→「はじめる」
//           → 課題のチャレンジだけのレッスン表と課題の帯 → チャレンジを UI で解く → 課題クリア！ → メニューバーの ✓
//   生徒 B: 端末に記録あり → 「ちがう」→ 2 つめの確認 → 「消す」→「はじめる」→ 1 つできた（フック）→ 1/2・★ あと 1
//   生徒 C: 課題 2 → できた（フック）→ 課題クリア！ →［課題を提出する］→ 提出 → ✓ + 提出の印
//   先生: 座席の色・「クリア N / 参加 N」・「進み具合」タブ・席の詳細・進み具合 CSV・提出状況.csv・
//         いまの課題の状況パネル・［授業］の行・採点のレッスンの列
//   1300×600 で生徒の画面がスクロールしないこと・先生の画面（R6）を測り、ja-Hira / en でも撮る
//   最後に作った課題とクラスをアーカイブする。
//
//   BASE=https://preview.smalruby.app/<slug>/ node verify-lessons-stage2-e2e.mjs
// 前提: .env に DEV_BYPASS_TOKEN（ログに出さない）。BASE は stg の API を見るブランチプレビュー
// （または stg を向けた dev server）。
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SHOT_DIR = resolve(process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp', 'verify-lessons-stage2-e2e'));
mkdirSync(SHOT_DIR, { recursive: true });
const envText = readFileSync(resolve(REPO_ROOT, '.env'), 'utf8');
const DEV_TOKEN = (envText.match(/^DEV_BYPASS_TOKEN=(.+)$/m) || [])[1]?.trim().replace(/^"|"$/g, '');
if (!DEV_TOKEN) throw new Error('DEV_BYPASS_TOKEN missing in .env');

const BASE = (process.env.BASE || process.env.BASE_URL || 'http://localhost:8601/').replace(/\/?$/, '/');
const HEADLESS = process.env.HEADLESS !== 'false';
const VIEWPORT = { width: 1300, height: 600 };
const COURSE = 'kyou-kara-programmer';
const LESSON1 = 'blocks-l1';
// 課題 1: レッスン 1 から「くりかえし」を外した 3 つ・★ = ネコをクリック・条件 2 つ・提出しない
const A1 = ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say'];
const A1_REQUIRED = 'blocks-l1-click-say';
// 課題 2: 1 つだけ・条件は全部・作品も提出する
const A2 = ['blocks-l1-key-sound'];

const log = (...a) => console.log('[e2e]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (step, ok, detail = '') => {
    results.push({ step, ok: !!ok, detail: String(detail).replace(/\s+/g, ' ').slice(0, 300) });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ` — ${String(detail).replace(/\s+/g, ' ').slice(0, 300)}` : ''}`);
};
const tid = (id) => `[data-testid="${id}"]`;

const browser = await chromium.launch({ headless: HEADLESS });
const pages = {};
const created = { groupId: null, assignments: [] };

// 端末の記録（課題の前にできていた「キーで音」）を入れておく。1 回だけ（記録を消したあとに戻さない）
const seedPriorRecord = () => {
    if (localStorage.getItem('e2e:seeded')) return;
    localStorage.setItem('e2e:seeded', '1');
    localStorage.setItem(
        'smalruby:lessonProgress',
        JSON.stringify({
            version: 1,
            challenges: {
                'blocks-l1-key-sound': {
                    completedAt: '2026-11-01T01:00:00.000Z',
                    courseId: 'kyou-kara-programmer',
                    lessonId: 'blocks-l1',
                },
            },
        }),
    );
};

const open = async (name, url, { seed = false, locale = 'ja-JP' } = {}) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT, locale, acceptDownloads: true });
    if (seed) await ctx.addInitScript(seedPriorRecord);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[${name}:pageerror]`, e.message.slice(0, 200)));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 120000 });
    await sleep(1500);
    pages[name] = page;
    return page;
};
const shot = (page, name) => page.screenshot({ path: resolve(SHOT_DIR, `${name}.png`) }).catch(() => {});
const text = async (page, id) => ((await page.$(tid(id))) ? (await page.$eval(tid(id), (el) => el.textContent)).trim() : null);
const exists = async (page, id) => !!(await page.$(tid(id)));
const clickTid = (page, id) => page.$eval(tid(id), (el) => el.click());

// ページ（document）と、あればモーダルの本文がスクロールしないか
const scrollInfo = (page, bodySel = null) =>
    page.evaluate((sel) => {
        const se = document.scrollingElement;
        const body = sel ? document.querySelector(sel) : null;
        // はみ出し: 見えている要素で、横に切れている文字（scrollWidth > clientWidth かつ overflow が hidden/clip）
        const clipped = [];
        for (const el of document.querySelectorAll('[data-testid^="classroom"], [data-testid^="lesson"]')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1) clipped.push(`${el.dataset.testid}:out`);
        }
        return {
            page: `${se.scrollHeight}/${se.clientHeight}`,
            pageOk: se.scrollHeight <= se.clientHeight && se.scrollWidth <= se.clientWidth,
            body: body ? `${body.scrollHeight}/${body.clientHeight}` : '-',
            bodyOk: body ? body.scrollHeight <= body.clientHeight : true,
            clipped: clipped.slice(0, 8),
        };
    }, bodySel);

// 本人の確認が出ていれば答える（出ていなければ何もしない）
const answerConsent = async (page, answer, name) => {
    const shown = await page
        .waitForSelector(tid('lesson-progress-confirm'), { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
    if (!shown) return false;
    await sleep(400);
    const list = await page.$$eval(`${tid('lesson-progress-confirm-list')} li`, (els) => els.map((e) => e.textContent.trim()));
    const m = await scrollInfo(page);
    record(`${name}: 本人の確認が出る（記録の一覧）`, list.length === 1, `${list.join(' / ')} page=${m.page}`);
    record(`${name}: 本人の確認 1300×600 でスクロールなし`, m.pageOk && m.clipped.length === 0, JSON.stringify(m));
    await shot(page, `${name}-consent-1`);
    if (answer === 'mine') {
        await clickTid(page, 'lesson-progress-confirm-mine');
    } else {
        await clickTid(page, 'lesson-progress-confirm-not-mine');
        await page.waitForSelector(tid('lesson-progress-confirm-clear'), { timeout: 5000 });
        const second = await page.$eval(tid('lesson-progress-confirm'), (el) => el.textContent);
        record(`${name}: 「ちがう」で 2 つめの確認`, /自分のパソコン/.test(second) && /みんなで使うパソコン/.test(second), second.slice(0, 120));
        await shot(page, `${name}-consent-2`);
        await clickTid(page, 'lesson-progress-confirm-clear');
    }
    await page.waitForSelector(tid('lesson-progress-confirm'), { state: 'detached', timeout: 5000 }).catch(() => {});
    return true;
};

const markTutorialSeen = (page) =>
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
    });

// --- 先生: 課題の説明タブでレッスンを選んで保存する ---
const configureLesson = async (teacher, { keep, required, count, submitWork, name }) => {
    await teacher.locator(tid('classroom-tab-description')).click();
    await teacher.waitForSelector(tid('classroom-lesson-settings'), { timeout: 15000 });
    await sleep(500);
    await teacher.locator(tid('classroom-lesson-toggle')).click();
    await teacher.selectOption(tid('classroom-lesson-course'), COURSE);
    await sleep(200);
    await teacher.locator(tid(`classroom-lesson-lesson-${LESSON1}`)).click();
    const all = await teacher.$$eval('[data-testid^="classroom-lesson-challenge-"]', (els) =>
        els.filter((e) => e.checked).map((e) => e.value),
    );
    for (const id of all) if (!keep.includes(id)) await teacher.locator(tid(`classroom-lesson-challenge-${id}`)).click();
    for (const id of required) await teacher.locator(tid(`classroom-lesson-required-${id}`)).click();
    if (count) {
        await teacher.locator(tid('classroom-lesson-completion-count')).click();
        await teacher.fill(tid('classroom-lesson-completion-count-value'), String(count));
        await teacher.press(tid('classroom-lesson-completion-count-value'), 'Enter');
    }
    if (submitWork) await teacher.locator(tid('classroom-lesson-submit-yes')).click();
    await sleep(300);
    const sentence = await text(teacher, 'classroom-lesson-sentence');
    const m = await scrollInfo(teacher, '[data-testid="classroom-teacher-modal"] main');
    record(`先生 ${name}: レッスン欄を開いて選ぶ（R6）`, m.pageOk && m.bodyOk, `sentence=${sentence} page=${m.page} body=${m.body}`);
    await shot(teacher, `teacher-${name}-lesson-panel`);
    await teacher.keyboard.press('Escape');
    await sleep(200);
    if (required.length) {
        await teacher.locator(tid('classroom-assignment-advanced-toggle')).click();
        await sleep(200);
        record(`先生 ${name}: 採点の点（既定）`, true, await text(teacher, 'classroom-lesson-scoring-each'));
        await teacher.keyboard.press('Escape');
    }
    const putDone = teacher.waitForResponse((r) => /\/assignment$/.test(r.url()) && r.request().method() === 'PUT', {
        timeout: 20000,
    });
    await teacher.locator(tid('classroom-assignment-save')).click();
    const res = await putDone.catch(() => null);
    const body = res ? res.request().postDataJSON() : null;
    record(
        `先生 ${name}: 保存で lesson を送る`,
        res && res.ok() && body?.lesson?.challengeIds?.join() === keep.join() && !!body.lesson.submitWork === !!submitWork,
        `status=${res?.status()} lesson=${JSON.stringify(body?.lesson)}`,
    );
    await sleep(800);
    record(`先生 ${name}: 要約`, true, await text(teacher, 'classroom-lesson-summary'));
};

const createAssignment = async (teacher, name) => {
    await teacher.click(tid('classroom-board-create-menu'));
    await teacher.click(tid('classroom-board-create'));
    await teacher.fill(tid('classroom-board-create-name'), name);
    await teacher.click(tid('classroom-board-create-submit'));
    await teacher.waitForFunction(
        (label) =>
            [...document.querySelectorAll('[data-testid^="classroom-board-row-toggle-"]')].some((el) =>
                el.textContent.includes(label),
            ),
        name,
        { timeout: 30000 },
    );
    const classroomId = await teacher.evaluate(
        (label) =>
            [...document.querySelectorAll('[data-testid^="classroom-board-row-toggle-"]')]
                .find((el) => el.textContent.includes(label))
                .dataset.testid.replace('classroom-board-row-toggle-', ''),
        name,
    );
    created.assignments.push(classroomId);
    return classroomId;
};
const openAssignment = async (teacher, classroomId) => {
    if (!(await exists(teacher, `classroom-board-open-${classroomId}`))) {
        await teacher.locator(tid(`classroom-board-row-toggle-${classroomId}`)).click();
    }
    await teacher.locator(tid(`classroom-board-open-${classroomId}`)).click();
    await teacher.waitForSelector(tid('classroom-phase-teacher-detail'), { timeout: 20000 });
    await teacher.waitForSelector(tid('classroom-detail-join-code'), { timeout: 20000 });
    await sleep(800);
};
const backToBoard = async (teacher) => {
    await teacher.locator(tid('classroom-breadcrumb-assignments')).click();
    await teacher.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    if (await exists(teacher, 'classroom-board-tab-classwork')) await teacher.locator(tid('classroom-board-tab-classwork')).click();
    await sleep(600);
};
const closeTeacherModal = (teacher) =>
    teacher.evaluate(() => {
        window.__store.dispatch({ type: 'scratch-gui/modals/CLOSE_MODAL', modal: 'teacherClassroomModal' });
        window.__store.dispatch({ type: 'scratch-gui/classroom/CLOSE_TEACHER_MODAL' });
    });

// --- 生徒 ---
const joinSeat = async (name, code, seat, opts) => {
    const page = await open(name, `${BASE}?no_beforeunload=1&classcode=${code.toLowerCase()}`, opts);
    await page.waitForSelector(tid(`classroom-seat-${seat}`), { timeout: 30000 });
    await page.click(tid(`classroom-seat-${seat}`));
    await page.click(tid('classroom-confirm-seat'));
    // 課題のページがある課題は課題パネル、無ければ参加完了。どちらにも「はじめる」が出る。
    // 本人の確認がその上に重なることがあるので、attached で待つ
    await page.waitForSelector(tid('classroom-start-main'), { state: 'attached', timeout: 30000 });
    await sleep(800);
    return page;
};
const studentJoinedChecks = async (page, name, submitWork) => {
    // 課題のページがある課題では課題パネル（classroom-joined-lesson-notice ではない場所）に同じ説明が出る
    const next =
        (await text(page, 'classroom-joined-lesson-notice')) ||
        (await page.$eval(tid('classroom-modal'), (el) => el.textContent).catch(() => null));
    const m = await scrollInfo(page);
    record(
        `${name}: 参加完了にレッスンの課題の説明と「はじめる」`,
        (await exists(page, 'classroom-start-main')) &&
            /レッスンの課題/.test(next || '') &&
            (submitWork ? /作品を提出/.test(next) : /課題クリア/.test(next)),
        `${(next || '').match(/この課題はレッスンの課題[^。]*。?[^。]*/)?.[0] || next} page=${m.page}`,
    );
    record(`${name}: 参加完了 1300×600 でスクロールなし`, m.pageOk && m.clipped.length === 0, JSON.stringify(m));
    await shot(page, `${name}-joined`);
};
const startLesson = async (page, name, expected) => {
    await clickTid(page, 'classroom-start-main');
    await page.waitForSelector(tid('lessons-library'), { timeout: 15000 });
    await sleep(800);
    const ids = await page.$$eval('[data-testid^="lessons-library-challenge-blocks"]', (els) =>
        els.map((e) => e.dataset.testid.replace('lessons-library-challenge-', '')),
    );
    const band = await text(page, 'lesson-assignment-band');
    const m = await scrollInfo(page);
    record(`${name}: 「はじめる」で課題のチャレンジだけのレッスン表`, ids.join() === expected.join(), ids.join());
    record(`${name}: 課題の帯`, !!band, `${band} page=${m.page}`);
    record(`${name}: レッスン表 1300×600 でページがスクロールしない`, m.pageOk, JSON.stringify(m));
    await shot(page, `${name}-library`);
};
const openChallengeFromLibrary = async (page, id) => {
    if (!(await exists(page, 'lessons-library'))) {
        await clickTid(page, 'menu-bar-lessons');
        await page.waitForSelector(tid('lessons-library'), { timeout: 10000 });
    }
    await clickTid(page, `lessons-library-challenge-${id}`);
    await page.waitForSelector(tid('lesson-task-bar'), { timeout: 15000 });
    await sleep(1200);
};
const waitToast = (page) => page.waitForSelector(tid('lesson-completed-toast'), { timeout: 25000 });
const menuMark = async (page) => {
    const el = await page.$(tid('classroom-menu-lesson-mark'));
    if (!el) return null;
    return { kind: await el.getAttribute('data-kind'), text: (await el.textContent()).trim() };
};
const openStudentStatus = async (page) => {
    await clickTid(page, 'classroom-menu-button');
    await page.waitForSelector(tid('classroom-phase-student-status'), { timeout: 20000 });
    await sleep(1500);
};
const closeStudentModal = async (page) => {
    await page.keyboard.press('Escape');
    await sleep(300);
    if (await exists(page, 'classroom-modal')) {
        await page.evaluate(() => {
            const b = document.querySelector('[data-testid="classroom-modal"] [class*="close-button"]');
            if (b) b.click();
        });
        await sleep(300);
    }
};

// コスチュームを足し、ヒントを最後まで進めて「正解のプログラムを確認する」→「はい」→ ネコを押す（「押したら話そう」を解く）
const solveClickSayByUi = async (page) => {
    // ゴールの 1 つ「コスチュームを 1 つ足す」（コスチュームタブで足したのと同じ VM の状態・integration テストと同じ）
    await page.evaluate(() => window.smalruby.vm.duplicateCostume(0));
    if ((await page.$$(tid('lesson-hint'))).length === 0) await clickTid(page, 'lesson-task-bar-hint');
    await page.waitForSelector(tid('lesson-hint'), { timeout: 10000 });
    for (let i = 0; i < 12 && !(await exists(page, 'lesson-hint-insert-code')); i++) {
        await clickTid(page, 'lesson-hint-next');
        await sleep(200);
    }
    await clickTid(page, 'lesson-hint-insert-code');
    await page.waitForSelector(tid('lesson-hint-insert-code-yes'), { timeout: 5000 });
    await clickTid(page, 'lesson-hint-insert-code-yes');
    await page.waitForFunction(
        () =>
            Object.values(window.smalruby.vm.editingTarget.blocks._blocks).some(
                (b) => b.opcode === 'event_whenthisspriteclicked',
            ),
        null,
        { timeout: 20000 },
    );
    await sleep(800);
    // 吹き出しを閉じてからネコ（ステージの真ん中）を押す
    if (await exists(page, 'lesson-hint-close')) await clickTid(page, 'lesson-hint-close');
    const box = await page.$eval('[class*="stage_stage-wrapper_"] canvas', (c) => {
        const r = c.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(box.x, box.y);
};

const downloadText = async (page, trigger, label) => {
    const dl = page.waitForEvent('download', { timeout: 60000 });
    await trigger();
    const d = await dl;
    const path = resolve(SHOT_DIR, `${label}-${d.suggestedFilename()}`);
    await d.saveAs(path);
    return { path, name: d.suggestedFilename() };
};

let teacher;
try {
    // === 先生: devlogin → クラス + 課題 2 つ ===
    teacher = await open('teacher', `${BASE}?no_beforeunload=1&locale=ja&devlogin=${encodeURIComponent(DEV_TOKEN)}`);
    await teacher.click(tid('settings-menu'));
    await sleep(300);
    await teacher.click(tid('settings-classroom-management'));
    await teacher.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 30000 });
    await markTutorialSeen(teacher);
    const stamp = Date.now().toString().slice(-6);
    await teacher.click(tid('classroom-class-create'));
    await teacher.fill(tid('classroom-class-create-name'), `段2検証-${stamp}`);
    await teacher.fill(tid('classroom-class-create-count'), '5');
    await teacher.click(tid('classroom-class-create-submit'));
    await teacher.waitForSelector(tid('classroom-board'), { timeout: 30000 });
    // クラスの id はクラス一覧のカードから読む（作ったクラスの名前で探す）
    await teacher.locator(tid('classroom-breadcrumb-class-list')).click();
    await teacher.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 20000 });
    created.groupId = await teacher.waitForFunction(
        (label) => {
            const card = [...document.querySelectorAll('[data-testid^="classroom-class-card-"]')].find((el) =>
                el.textContent.includes(label),
            );
            return card ? card.dataset.testid.replace('classroom-class-card-', '') : null;
        },
        `段2検証-${stamp}`,
        { timeout: 20000 },
    ).then((h) => h.jsonValue());
    log('class', created.groupId);
    await teacher.locator(tid(`classroom-class-open-${created.groupId}`)).click();
    await teacher.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    if (await exists(teacher, 'classroom-board-tab-classwork')) await teacher.locator(tid('classroom-board-tab-classwork')).click();
    const c1 = await createAssignment(teacher, `レッスン課題-${stamp}`);
    const c2 = await createAssignment(teacher, `提出あり課題-${stamp}`);
    log('assignments', c1, c2);

    await openAssignment(teacher, c1);
    await configureLesson(teacher, { keep: A1, required: [A1_REQUIRED], count: 2, submitWork: false, name: '課題1' });
    const code1 = (await teacher.textContent(tid('classroom-detail-join-code'))).replace(/[^A-Za-z0-9]/g, '');
    await backToBoard(teacher);
    await openAssignment(teacher, c2);
    await configureLesson(teacher, { keep: A2, required: [], count: null, submitWork: true, name: '課題2' });
    const code2 = (await teacher.textContent(tid('classroom-detail-join-code'))).replace(/[^A-Za-z0-9]/g, '');
    await backToBoard(teacher);
    log('codes ready');

    // === 生徒 A: 課題 1・席 1・記録あり →「わたしの記録です」 ===
    const sa = await joinSeat('studentA', code1, 1, { seed: true });
    await studentJoinedChecks(sa, 'studentA', false);
    const putsA = [];
    sa.on('request', (r) => {
        if (/lesson-progress$/.test(r.url()) && r.method() === 'PUT') putsA.push(r.postDataJSON());
    });
    let consentA = await answerConsent(sa, 'mine', 'studentA');
    await startLesson(sa, 'studentA', A1);
    if (!consentA) consentA = await answerConsent(sa, 'mine', 'studentA');
    record('studentA: 本人の確認が出た', consentA);
    await openChallengeFromLibrary(sa, A1_REQUIRED);
    if (!consentA) consentA = await answerConsent(sa, 'mine', 'studentA');
    let solvedByUi = true;
    try {
        await solveClickSayByUi(sa);
        await waitToast(sa);
    } catch (e) {
        solvedByUi = false;
        await shot(sa, 'studentA-ui-solve-failed');
        log('UI solve failed, falling back to the hook:', e.message.slice(0, 120));
        await sa.evaluate((id) => window.smalruby.lessonGoal.markCompleted(id), A1_REQUIRED);
        await waitToast(sa);
    }
    await sleep(800);
    const titleA = await text(sa, 'lesson-completed-toast-title');
    record(`studentA: ${solvedByUi ? 'UI で解いて' : 'フックで'}「課題クリア！」（前の記録 + ★）`, /課題クリア/.test(titleA || ''), titleA);
    let m = await scrollInfo(sa);
    record('studentA: 課題クリア！ 1300×600 でスクロールなし', m.pageOk && m.clipped.length === 0, JSON.stringify(m));
    await shot(sa, 'studentA-cleared-toast');
    record('studentA: 課題クリア！に［課題を提出する］が無い（提出しない課題）', !(await exists(sa, 'lesson-completed-toast-submit')));
    await clickTid(sa, 'lesson-completed-toast-close').catch(() => {});
    await sleep(2500);
    const markA = await menuMark(sa);
    record('studentA: メニューバーの印 ✓', markA?.kind === 'cleared', JSON.stringify(markA));
    const before = putsA.find((p) => JSON.stringify(p).includes('before'));
    record('studentA: 「わたしの記録です」で before を送る', !!before, JSON.stringify(putsA.at(-1) || {}).slice(0, 250));
    await openStudentStatus(sa);
    const rowA = await text(sa, 'classroom-status-lesson-progress');
    m = await scrollInfo(sa);
    record('studentA: クラスの画面の進み具合（✓ 課題クリア）', /課題クリア/.test(rowA || ''), `${rowA} page=${m.page}`);
    record('studentA: クラスの画面 1300×600 でスクロールなし', m.pageOk && m.clipped.length === 0, JSON.stringify(m));
    record('studentA: 提出しない課題に［課題を提出する］が無い', !(await exists(sa, 'classroom-submit-button')));
    await shot(sa, 'studentA-status');
    await closeStudentModal(sa);

    // === 生徒 B: 課題 1・席 2・記録あり →「ちがう」→「消す」 ===
    const sb = await joinSeat('studentB', code1, 2, { seed: true });
    const putsB = [];
    sb.on('request', (r) => {
        if (/lesson-progress$/.test(r.url()) && r.method() === 'PUT') putsB.push(r.postDataJSON());
    });
    let consentB = await answerConsent(sb, 'not-mine', 'studentB');
    await startLesson(sb, 'studentB', A1);
    if (!consentB) consentB = await answerConsent(sb, 'not-mine', 'studentB');
    record('studentB: 本人の確認が出た', consentB);
    const storedB = await sb.evaluate(() => localStorage.getItem('smalruby:lessonProgress'));
    record('studentB: 「消す」で端末のレッスンの記録が空', !storedB || !storedB.includes('key-sound'), storedB);
    await openChallengeFromLibrary(sb, 'blocks-l1-arrow-move');
    await sb.evaluate(() => window.smalruby.lessonGoal.markCompleted('blocks-l1-arrow-move'));
    await waitToast(sb);
    const titleB = await text(sb, 'lesson-completed-toast-title');
    record('studentB: フックで 1 つできた →「できた！」（課題クリアではない）', !/課題クリア/.test(titleB || ''), titleB);
    await shot(sb, 'studentB-done-toast');
    await clickTid(sb, 'lesson-completed-toast-close').catch(() => {});
    // いまやっている（▶）を作る: 「キーで音」を開いておく
    await openChallengeFromLibrary(sb, 'blocks-l1-key-sound');
    await sleep(2500);
    const markB = await menuMark(sb);
    record('studentB: メニューバーの印 1/2', markB?.kind === 'inProgress' && markB.text.includes('1/2'), JSON.stringify(markB));
    record(
        'studentB: 送った進み具合に before が無い',
        putsB.length > 0 && !putsB.some((p) => JSON.stringify(p).includes('"before":true')),
        `puts=${putsB.length} last=${JSON.stringify(putsB.at(-1) || {}).slice(0, 200)}`,
    );
    await openStudentStatus(sb);
    const rowB = await text(sb, 'classroom-status-lesson-progress');
    record('studentB: 進み具合の行（★ あと 1・あと 1 つ）', /★/.test(rowB || '') && /あと/.test(rowB || ''), rowB);
    await shot(sb, 'studentB-status');
    await closeStudentModal(sb);

    // === 生徒 C: 課題 2（作品も提出する）→ 課題クリア！ →［課題を提出する］ ===
    const sc = await joinSeat('studentC', code2, 1);
    await studentJoinedChecks(sc, 'studentC', true);
    await answerConsent(sc, 'mine', 'studentC');
    await startLesson(sc, 'studentC', A2);
    await openChallengeFromLibrary(sc, A2[0]);
    await sc.evaluate((id) => window.smalruby.lessonGoal.markCompleted(id), A2[0]);
    await waitToast(sc);
    await sleep(600);
    record('studentC: 課題クリア！に［課題を提出する］', /課題クリア/.test((await text(sc, 'lesson-completed-toast-title')) || '') && (await exists(sc, 'lesson-completed-toast-submit')));
    await shot(sc, 'studentC-cleared-toast');
    await clickTid(sc, 'lesson-completed-toast-submit');
    await sc.waitForSelector(tid('classroom-submit-confirm'), { timeout: 30000 });
    m = await scrollInfo(sc);
    record('studentC: 提出の確認 1300×600 でスクロールなし', m.pageOk, JSON.stringify(m));
    await shot(sc, 'studentC-submit-confirm');
    await sc.locator(tid('classroom-submit-confirm')).click();
    await sc.waitForSelector(tid('classroom-phase-student-status'), { timeout: 60000 });
    await sleep(2500);
    record('studentC: 提出した', /提出/.test((await text(sc, 'classroom-submit-status')) || ''), await text(sc, 'classroom-submit-status'));
    await shot(sc, 'studentC-status-submitted');
    await closeStudentModal(sc);
    await sleep(500);
    const markC = await menuMark(sc);
    const submittedIcon = await sc.$(`[data-testid="classroom-menu-button"] ${tid('classroom-status-icon-submitted')}`);
    record('studentC: メニューバー ✓ + 提出の印', markC?.kind === 'cleared' && !!submittedIcon, JSON.stringify(markC));

    // ja-Hira / en で生徒の画面（クラスの画面・レッスン表）
    for (const loc of ['ja-Hira', 'en']) {
        await sc.goto(`${BASE}?no_beforeunload=1&locale=${loc}`, { waitUntil: 'domcontentloaded' });
        await sc.waitForSelector('[class*="gui_editor-wrapper"]', { timeout: 120000 });
        await sleep(2500);
        await openStudentStatus(sc);
        m = await scrollInfo(sc);
        record(`studentC ${loc}: クラスの画面 1300×600 でスクロールなし`, m.pageOk && m.clipped.length === 0, JSON.stringify(m));
        await shot(sc, `studentC-status-${loc}`);
        await closeStudentModal(sc);
        await clickTid(sc, 'menu-bar-lessons');
        await sc.waitForSelector(tid('lessons-library'), { timeout: 10000 });
        await sleep(800);
        m = await scrollInfo(sc);
        record(`studentC ${loc}: レッスン表（帯）1300×600`, m.pageOk, `${(await text(sc, 'lesson-assignment-band')) || ''} ${JSON.stringify(m)}`);
        await shot(sc, `studentC-library-${loc}`);
        await sc.keyboard.press('Escape');
    }
    await sb.evaluate(() => {}).catch(() => {});

    // === 先生: 課題 1 の座席・進み具合タブ・詳細・CSV ===
    const BODY = '[data-testid="classroom-teacher-modal"] main';
    await openAssignment(teacher, c1);
    await teacher.locator(tid('classroom-tab-members')).click().catch(() => {});
    await teacher.waitForSelector(tid('classroom-lesson-seat-legend'), { timeout: 30000 });
    await teacher.waitForFunction(() => !document.querySelector('[data-testid="classroom-lesson-progress-loading"]'), null, { timeout: 30000 });
    await sleep(1000);
    const states = await teacher.$$eval('[data-testid^="classroom-member-"][data-lesson-state]', (els) =>
        els.map((e) => `${e.textContent.trim().slice(0, 12)}=${e.dataset.lessonState}`),
    );
    const summary = await text(teacher, 'classroom-lesson-cleared-summary');
    m = await scrollInfo(teacher, BODY);
    record(
        '先生: 座席の色（席 1 = 課題クリア・席 2 = とちゅう）',
        states[0]?.endsWith('=cleared') && states[1]?.endsWith('=inProgress'),
        states.join(' '),
    );
    record('先生: 「クリア 1 / 参加 2」', /クリア\s*1\s*\/\s*参加\s*2/.test(summary || ''), summary);
    record('先生: メンバータブ R6', m.pageOk && m.bodyOk, JSON.stringify(m));
    record('先生: 席 2 の「★ あと 1」', /あと\s*1/.test((await text(teacher, 'classroom-lesson-seat-required-2')) || ''), await text(teacher, 'classroom-lesson-seat-required-2'));
    await shot(teacher, 'teacher-members');

    await teacher.locator(tid('classroom-tab-progress')).click();
    await teacher.waitForSelector(tid('classroom-lesson-progress-frame'), { timeout: 20000 });
    await sleep(1200);
    const cells = await teacher.$$eval('[data-testid^="classroom-lesson-progress-cell-"]', (els) =>
        els.map((e) => `${e.dataset.testid.replace('classroom-lesson-progress-cell-', '').slice(-28)}=${e.dataset.kind}`),
    );
    const kindsOf = (seatRowIdx) => cells;
    record(
        '先生: 進み具合の表（前・✓・▶）',
        cells.some((c) => c.endsWith('key-sound=before')) &&
            cells.some((c) => c.endsWith('click-say=done')) &&
            cells.some((c) => c.endsWith('arrow-move=done')) &&
            cells.some((c) => c.endsWith('key-sound=current')),
        cells.join(' '),
    );
    const totals = await teacher.$$eval('[data-testid^="classroom-lesson-progress-total-"]', (els) => els.map((e) => e.textContent.trim()));
    record('先生: 「できた人」の行', totals.length === A1.length, totals.join(','));
    m = await scrollInfo(teacher, BODY);
    record('先生: 進み具合タブ R6（表の枠だけスクロール）', m.pageOk && m.bodyOk, JSON.stringify(m));
    await shot(teacher, 'teacher-progress-tab');
    const seatBtn = await teacher.$('[data-testid^="classroom-lesson-progress-seat-"]');
    await seatBtn.click();
    await teacher.waitForSelector(tid('classroom-member-lesson-detail'), { timeout: 10000 });
    await sleep(500);
    const detailKinds = await teacher.$$eval('[data-testid^="classroom-member-lesson-detail-blocks"]', (els) =>
        els.map((e) => e.dataset.kind),
    );
    record('先生: 席の詳細（チャレンジごと）', detailKinds.length === A1.length, `${await text(teacher, 'classroom-member-lesson-detail-count')} ${detailKinds.join(',')}`);
    m = await scrollInfo(teacher, BODY);
    record('先生: 席の詳細 R6', m.pageOk && m.bodyOk, JSON.stringify(m));
    await shot(teacher, 'teacher-member-detail');

    // 進み具合 CSV
    await clickTid(teacher, 'classroom-detail-more-menu');
    await sleep(300);
    const pcsv = await downloadText(teacher, () => clickTid(teacher, 'classroom-lesson-progress-csv'), 'progress');
    const pcsvText = readFileSync(pcsv.path, 'utf8');
    writeFileSync(resolve(SHOT_DIR, 'progress.csv.txt'), pcsvText);
    record('先生: 進み具合 CSV', /課題クリア/.test(pcsvText) && pcsvText.split('\n').length >= 3, `${pcsv.name} ${pcsvText.split('\n').slice(0, 3).join(' | ').slice(0, 280)}`);
    // 提出状況.csv（全作品ダウンロードの zip）
    await teacher.locator(tid('classroom-tab-members')).click();
    await sleep(800);
    await clickTid(teacher, 'classroom-detail-more-menu');
    await sleep(300);
    const zip = await downloadText(teacher, () => clickTid(teacher, 'classroom-download-all'), 'all');
    let statusCsv = '';
    try {
        const listing = execFileSync('unzip', ['-Z1', zip.path], { encoding: 'utf8' });
        const entry = listing.split('\n').find((l) => l.endsWith('.csv'));
        statusCsv = execFileSync('unzip', ['-p', zip.path, entry], { encoding: 'utf8' });
        writeFileSync(resolve(SHOT_DIR, 'status.csv.txt'), statusCsv);
        record('先生: 提出状況.csv にレッスンの列', /課題クリア/.test(statusCsv) && /できた数/.test(statusCsv), `${entry} ${statusCsv.split('\n').slice(0, 3).join(' | ').slice(0, 280)}`);
    } catch (e) {
        record('先生: 提出状況.csv にレッスンの列', false, e.message);
    }

    // いまの課題の状況パネル
    await closeTeacherModal(teacher);
    await sleep(800);
    await clickTid(teacher, 'classroom-teacher-menu-button');
    await sleep(300);
    await clickTid(teacher, 'classroom-teacher-menu-status-panel');
    await teacher.waitForSelector(tid('classroom-teacher-panel'), { timeout: 15000 });
    await teacher.selectOption(tid('classroom-teacher-panel-assignment'), c1).catch(() => {});
    await teacher.waitForSelector(tid('classroom-teacher-panel-lesson-bars'), { timeout: 30000 });
    await sleep(1000);
    const panelBox = await teacher.$eval(tid('classroom-teacher-panel'), (el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
    });
    record(
        '先生: パネルの課題クリア / 横棒',
        /課題クリア\s*1\s*\/\s*2/.test((await text(teacher, 'classroom-teacher-panel-lesson-cleared')) || '') &&
            (await teacher.$$('[data-testid^="classroom-teacher-panel-bar-blocks"]')).length === A1.length,
        `${await text(teacher, 'classroom-teacher-panel-lesson-cleared')} box=${JSON.stringify(panelBox)}`,
    );
    record('先生: パネルが 600px に収まる', panelBox.top >= 0 && panelBox.bottom <= VIEWPORT.height, JSON.stringify(panelBox));
    await shot(teacher, 'teacher-panel');
    await clickTid(teacher, 'classroom-teacher-panel-close');

    // ［授業］の行・採点
    await clickTid(teacher, 'classroom-teacher-menu-button');
    await sleep(300);
    await clickTid(teacher, 'classroom-teacher-menu-class-list');
    await teacher.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 20000 });
    await teacher.locator(tid(`classroom-class-open-${created.groupId}`)).click();
    await teacher.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    if (await exists(teacher, 'classroom-board-tab-classwork')) await teacher.locator(tid('classroom-board-tab-classwork')).click();
    await sleep(800);
    record('先生: ［授業］の行の「レッスン」の印', (await text(teacher, `classroom-board-lesson-mark-${c1}`)) === 'レッスン');
    await teacher.locator(tid(`classroom-board-row-toggle-${c1}`)).click();
    await teacher.waitForSelector(tid(`classroom-board-row-lesson-cleared-${c1}`), { timeout: 15000 });
    record('先生: ［授業］の行の「課題クリア 1」', /課題クリア\s*1/.test(await text(teacher, `classroom-board-row-lesson-cleared-${c1}`)), await text(teacher, `classroom-board-row-lesson-cleared-${c1}`));
    m = await scrollInfo(teacher, BODY);
    record('先生: ［授業］ R6', m.pageOk && m.bodyOk, JSON.stringify(m));
    await shot(teacher, 'teacher-board');
    await teacher.locator(tid('classroom-breadcrumb-class-list')).click();
    await sleep(600);
    await teacher.locator(tid(`classroom-class-evaluate-${created.groupId}`)).click();
    await teacher.waitForSelector(tid('classroom-eval-load'), { timeout: 15000 });
    await teacher.locator(tid('classroom-eval-load')).click();
    await teacher.waitForSelector(tid(`classroom-eval-lesson-head-${c1}`), { timeout: 60000 });
    await sleep(800);
    const s1 = await text(teacher, `classroom-eval-lesson-score-1-${c1}`);
    const s2 = await text(teacher, `classroom-eval-lesson-score-2-${c1}`);
    // 満点 100・必須 70: ★ 1 つ = 70、ほか 2 つ = 15 ずつ → 席 1 = 前 15 + ★ 70 = 85、席 2 = 15
    record('先生: 採点のレッスンの列（席 1 = 85・席 2 = 15）', s1 === '85' && s2 === '15', `seat1=${s1} seat2=${s2}`);
    m = await scrollInfo(teacher, BODY);
    record('先生: 採点 R6', m.pageOk && m.bodyOk, JSON.stringify(m));
    await shot(teacher, 'teacher-grading');

    // en / ja-Hira の先生の進み具合タブ（はみ出しの目視用）
    for (const loc of ['en', 'ja-Hira']) {
        const t2 = await open(`teacher-${loc}`, `${BASE}?no_beforeunload=1&locale=${loc}&devlogin=${encodeURIComponent(DEV_TOKEN)}`);
        await t2.click(tid('settings-menu'));
        await sleep(300);
        await t2.click(tid('settings-classroom-management'));
        await t2.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 30000 });
        await markTutorialSeen(t2);
        await t2.locator(tid(`classroom-class-open-${created.groupId}`)).click();
        await t2.waitForSelector(tid('classroom-board'), { timeout: 20000 });
        if (await exists(t2, 'classroom-board-tab-classwork')) await t2.locator(tid('classroom-board-tab-classwork')).click();
        await sleep(600);
        await openAssignment(t2, c1);
        await t2.locator(tid('classroom-tab-progress')).click();
        await t2.waitForSelector(tid('classroom-lesson-progress-frame'), { timeout: 20000 });
        await sleep(1200);
        m = await scrollInfo(t2, BODY);
        record(`先生 ${loc}: 進み具合タブ R6`, m.pageOk && m.bodyOk, JSON.stringify(m));
        await shot(t2, `teacher-progress-${loc}`);
        await t2.locator(tid('classroom-tab-members')).click();
        await sleep(1200);
        await shot(t2, `teacher-members-${loc}`);
        await t2.context().close();
    }
} catch (e) {
    record('script', false, e.stack);
    for (const [n, p] of Object.entries(pages)) await shot(p, `FAIL-${n}`);
} finally {
    // 片付け: 作った課題とクラスをアーカイブする（先生のタブで UI から）
    try {
        if (teacher && created.groupId) {
            await teacher.evaluate(() =>
                window.__store.dispatch({ type: 'scratch-gui/classroom/OPEN_TEACHER_MODAL' }),
            ).catch(() => {});
            await clickTid(teacher, 'classroom-teacher-menu-button').catch(() => {});
            await sleep(300);
            await clickTid(teacher, 'classroom-teacher-menu-class-list').catch(() => {});
            await teacher.waitForSelector(tid('classroom-phase-teacher-class-list'), { timeout: 20000 });
            for (const id of created.assignments) {
                await teacher.locator(tid(`classroom-class-open-${created.groupId}`)).click();
                await teacher.waitForSelector(tid('classroom-board'), { timeout: 20000 });
                if (await exists(teacher, 'classroom-board-tab-classwork')) await teacher.locator(tid('classroom-board-tab-classwork')).click();
                await sleep(600);
                await openAssignment(teacher, id);
                await clickTid(teacher, 'classroom-detail-more-menu');
                await sleep(300);
                await clickTid(teacher, 'classroom-delete-classroom');
                await teacher.waitForSelector(tid('classroom-delete-confirm'), { timeout: 5000 });
                await clickTid(teacher, 'classroom-delete-confirm');
                await sleep(2500);
                if (!(await exists(teacher, 'classroom-phase-teacher-class-list'))) {
                    await teacher.locator(tid('classroom-breadcrumb-class-list')).click().catch(() => {});
                    await sleep(800);
                }
                log('archived assignment', id);
            }
            await teacher.waitForSelector(tid(`classroom-class-settings-open-${created.groupId}`), { timeout: 15000 });
            // この実行のクラスと、前に失敗した実行で残った「段2検証-」のクラスをアーカイブする
            const leftovers = await teacher.$$eval('[data-testid^="classroom-class-card-"]', (els) =>
                els.filter((el) => el.textContent.includes('段2検証-')).map((el) => el.dataset.testid.replace('classroom-class-card-', '')),
            );
            for (const gid of new Set([created.groupId, ...leftovers])) {
                await teacher.locator(tid(`classroom-class-settings-open-${gid}`)).click();
                await teacher.waitForSelector(tid('classroom-class-settings-archive'), { timeout: 5000 });
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
