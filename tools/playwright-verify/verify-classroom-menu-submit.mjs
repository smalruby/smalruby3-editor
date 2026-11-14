/**
 * メニューバーの「提出する」(#1795) の収まりと提出の流れの確認。
 *
 *   1. 参加中のメニューバー（PC・iPad）とサイドレール（スマホ）に「提出する」/「提出済み ✓」/
 *      「返却済み ✓」が出て、ほかの項目と重ならず、画面からはみ出さないか（3 言語）
 *   2. 1300×600 で「提出する」→ 提出確認 → 「提出できました ✓」、「提出済み ✓」→ 再提出、
 *      「返却済み ✓」→ 先生のコメントつきの再提出、がスクロールなしで収まるか
 *   3. 作品を提出しないレッスンの課題では出さないか
 *
 * classroom API は route interception でスタブするので stg デプロイ不要（dev server だけが前提）。
 * スクショは tmp/classroom-menu-submit-*.png。
 *
 *   node verify-classroom-menu-submit.mjs                     # コンテナ内 (headless)
 *   BASE=http://localhost:8631 node verify-classroom-menu-submit.mjs
 *   DOCS_SHOTS=1 node verify-classroom-menu-submit.mjs        # docs/classroom/screenshots も撮り直す
 */
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADLESS = process.env.HEADLESS !== 'false';
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
const DOCS_DIR = resolve(REPO_ROOT, 'docs', 'classroom', 'screenshots');

const LONG_CLASS = '3年2組 技術・家庭科（情報の技術）プログラミング応用クラス';
const LONG_ASSIGNMENT = 'ねこが迷路を抜けてゴールまで進むゲームを作ろう（センサーと条件分岐の応用編）';
const LONG_COMMENT =
    'よくできています。条件分岐の使い方がとても上手です。次は、ゴールに着いたときに音を鳴らしたり、' +
    'タイムを表示したりして、遊ぶ人がもっと楽しくなる工夫を考えてみましょう。変数の名前もわかりやすくしましょう。';

const VIEWPORTS = [
    { name: 'pc-1300x600', width: 1300, height: 600 },
    { name: 'ipad-landscape-1024x768', width: 1024, height: 768 },
    { name: 'ipad-portrait-768x1024', width: 768, height: 1024 },
    { name: 'ipad-mini-744x1133', width: 744, height: 1133 },
    // スマホ（メニューバーが無い）はドロワーのいちばん上。低い横向きも測る（レビュー M2）。
    { name: 'phone-844x390', width: 844, height: 390, phone: true },
    { name: 'phone-667x375', width: 667, height: 375, phone: true },
    { name: 'phone-740x360', width: 740, height: 360, phone: true },
];
const LOCALES = ['ja', 'ja-Hira', 'en'];
const KINDS = [
    { kind: 'submit', status: null },
    { kind: 'submitted', status: 'submitted' },
    { kind: 'returned', status: 'returned' },
];

const rows = [];
const record = (ok, name, note = '') => {
    rows.push({ ok, name });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` — ${note}` : ''}`);
};

const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });

const session = (submissionStatus) => ({
    role: 'student',
    classroomId: 'c1',
    className: LONG_CLASS,
    assignmentName: LONG_ASSIGNMENT,
    joinCode: 'abc234',
    seatNumber: 7,
    memberId: 'seat-07',
    sessionToken: 'stub',
    joinedAt: new Date().toISOString(),
    submissionStatus,
    lastSubmittedAt: submissionStatus ? '2026-11-14T01:00:00.000Z' : null,
});

/**
 * 参加中の生徒のページを作る。verify-session は submission を返し、提出の API もスタブする。
 * @param {object} opts - options
 * @param {object} opts.viewport - { width, height }
 * @param {string} opts.locale - 表示の言語
 * @param {?string} opts.status - 提出状況（null = 未提出）
 * @param {?object} [opts.lesson] - レッスンの課題の設定（null = ふつうの課題）
 * @param {number} [opts.verifyDelay] - verify-session を返すまでの ms（遅い Wi-Fi の再現）
 * @param {number} [opts.submitDelay] - 提出の API を返すまでの ms（送信中の操作の確認）
 * @returns {Promise<{ctx: object, page: import('playwright').Page, submits: Array}>} context と page
 */
const studentPage = async ({ viewport, locale, status, lesson = null, verifyDelay = 0, submitDelay = 0 }) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const submits = [];
    const submission = status
        ? { status, submittedAt: '2026-11-14T01:00:00.000Z', teacherComment: status === 'returned' ? LONG_COMMENT : null }
        : null;
    const later = (ms) => new Promise((done) => setTimeout(done, ms));
    await page.route('**/classrooms/verify-session', async (r) => {
        if (verifyDelay) await later(verifyDelay);
        await r.fulfill({ json: { valid: true, hasAssignment: false, submission } }).catch(() => {});
    });
    await page.route('**/continuable-submissions', (r) => r.fulfill({ json: {} }));
    await page.route('**/classrooms/c1/assignment', (r) => r.fulfill({ json: { assignment: null, lesson } }));
    await page.route('**/lesson-progress', (r) => r.fulfill({ json: { challenges: {}, current: null, updatedAt: null } }));
    await page.route('**/classrooms/c1/submissions', async (r) => {
        submits.push(r.request().method());
        if (submitDelay) await later(submitDelay);
        return r.fulfill({
            json: {
                uploadUrl: 'https://upload.invalid/project',
                thumbnailUploadUrl: 'https://upload.invalid/thumb',
                screenshotUploadUrls: Array.from({ length: 10 }, (_, i) => `https://upload.invalid/shot${i}`),
                submittedAt: new Date().toISOString(),
            },
        });
    });
    await page.route('https://upload.invalid/**', (r) => r.fulfill({ status: 200, body: '' }));
    const stored = { ...session(status), ...(lesson ? { studentLesson: lesson } : {}) };
    await page.addInitScript((s) => {
        if (window.sessionStorage.getItem('__seeded')) return;
        window.sessionStorage.setItem('__seeded', '1');
        window.localStorage.setItem('smalruby:classroom', JSON.stringify(s));
        // スマホモードの一度きりの案内・ようこその吹き出しは測定の邪魔なので出さない。
        window.localStorage.setItem('smalruby:mobileModeNoticeDismissed', 'true');
    }, stored);
    await page.goto(`${BASE}/?no_beforeunload=1&locale=${locale}`, { waitUntil: 'load' });
    await page
        .locator('[data-testid="classroom-menu-button"]:visible, [data-testid="mobile-side-rail-menu"]:visible')
        .first()
        .waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(800);
    return { ctx, page, submits };
};

/**
 * 「提出する」のボタンが、画面の中にあって、ほかの見えている項目と重ならないかを測る。
 * PC・iPad はメニューバーの項目、スマホはドロワーのほかの項目と比べ、スマホでは押せる大きさ
 * （44×44px 以上）と、サイドレール（バックパック）がはみ出さないことも見る。
 * @param {import('playwright').Page} page - 対象ページ
 * @returns {Promise<object>} 測定値
 */
const measureButton = (page) =>
    page.evaluate(() => {
        const btn = [...document.querySelectorAll('[data-testid="classroom-menu-submit"]')].find(
            (el) => el.getClientRects().length > 0,
        );
        if (!btn) return { missing: true };
        const r = btn.getBoundingClientRect();
        const box = (x) => ({ l: Math.round(x.left), r: Math.round(x.right), t: Math.round(x.top), b: Math.round(x.bottom) });
        const overlaps = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const drawer = btn.closest('[data-testid="mobile-drawer"]');
        const rail = document.querySelector('[data-testid="mobile-side-rail"]');
        let neighbours;
        if (drawer) {
            neighbours = [...drawer.querySelectorAll('button')].filter((el) => el !== btn);
        } else {
            // メニューバーの段（btn の親）に並ぶ兄弟と、そのほかの段の項目
            const bar = btn.closest('[class*="menu-bar_menu-bar"]') || btn.parentElement;
            neighbours = [...bar.querySelectorAll('[class*="menu-bar_menu-bar-item"], [data-testid]')].filter(
                (el) => el !== btn && !el.contains(btn) && !btn.contains(el),
            );
        }
        const hits = neighbours
            .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
            .filter((el) => overlaps(r, el.getBoundingClientRect()))
            .map((el) => el.getAttribute('data-testid') || String(el.className).slice(0, 40));
        const se = document.scrollingElement;
        return {
            box: box(r),
            inView: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
            hits,
            kind: btn.getAttribute('data-kind'),
            text: btn.textContent,
            lines: Math.round(r.height / parseFloat(getComputedStyle(btn).lineHeight || '12')),
            pageScrollX: se.scrollWidth > se.clientWidth,
            pageScrollY: se.scrollHeight > se.clientHeight,
            bg: getComputedStyle(btn).backgroundColor,
            inDrawer: !!drawer,
            touchOk: !drawer || (r.height >= 44 && r.width >= 44),
            size: `${Math.round(r.width)}x${Math.round(r.height)}`,
            // スマホのレールは縦の余りが少ない。下のバックパックが画面から出ていないか。
            railOverflow: rail && rail.getClientRects().length > 0 ? rail.scrollHeight > rail.clientHeight : false,
        };
    });

// ---------- 1. 収まり ----------
for (const vp of VIEWPORTS) {
    for (const locale of LOCALES) {
        for (const { kind, status } of KINDS) {
            const { ctx, page } = await studentPage({ viewport: vp, locale, status });
            if (vp.phone) {
                await page.locator('[data-testid="mobile-side-rail-menu"]').click();
                await page.locator('[data-testid="mobile-drawer"][data-state="open"]').waitFor({ timeout: 10000 });
                await page.waitForTimeout(400);
            }
            const m = await measureButton(page);
            const name = `${vp.name} ${locale} ${kind}`;
            if (m.missing) {
                record(false, name, 'button not found');
            } else {
                const ok =
                    m.inView &&
                    m.hits.length === 0 &&
                    m.kind === kind &&
                    !m.pageScrollX &&
                    !m.pageScrollY &&
                    !m.railOverflow &&
                    m.touchOk &&
                    m.inDrawer === !!vp.phone;
                record(
                    ok,
                    name,
                    `"${m.text}" ${m.size} ${JSON.stringify(m.box)} bg ${m.bg}` +
                        (m.touchOk ? '' : ' smaller than 44x44') +
                        (m.hits.length ? ` overlaps ${m.hits.join(',')}` : '') +
                        (m.pageScrollX || m.pageScrollY ? ' page scrolls' : '') +
                        (m.railOverflow ? ' side rail overflows' : ''),
                );
            }
            if (locale === 'ja') {
                await page.screenshot({ path: resolve(SHOT_DIR, `classroom-menu-submit-${vp.name}-${kind}.png`) });
            }
            await ctx.close();
        }
    }
}

// ---------- 2. 提出の流れ (1300×600) ----------
const PC = VIEWPORTS[0];

/**
 * モーダルが 1300×600 でスクロールなしに収まるか。
 * @param {import('playwright').Page} page - 対象ページ
 * @param {string} name - 行の名前
 */
const judgeModal = async (page, name) => {
    const m = await page.evaluate(() => {
        const body = document.querySelector('[data-testid="classroom-modal"]');
        let frame = body;
        while (frame.parentElement && !String(frame.parentElement.className).includes('ReactModal__Overlay')) {
            frame = frame.parentElement;
        }
        const r = frame.getBoundingClientRect();
        const se = document.scrollingElement;
        return {
            fits: r.top >= 0 && r.bottom <= window.innerHeight,
            bodyOk: body.scrollHeight <= body.clientHeight,
            pageOk: se.scrollHeight <= se.clientHeight,
            frame: `${Math.round(r.top)}-${Math.round(r.bottom)}/${window.innerHeight}`,
        };
    });
    record(m.fits && m.bodyOk && m.pageOk, `${name} (1300×600 no scroll)`, `frame ${m.frame}`);
};

const shotBoth = async (page, tmpName, docName) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `classroom-menu-submit-${tmpName}.png`) });
    if (DOCS_SHOTS && docName) await page.screenshot({ path: resolve(DOCS_DIR, docName) });
};

// 未提出: メニューバー → 提出確認 → 提出できました ✓ → つづける → メニューバーは「提出済み ✓」
{
    const { ctx, page, submits } = await studentPage({ viewport: PC, locale: 'ja', status: null });
    await shotBoth(page, 'flow-menu-submit', '0103-menu-bar-joined.png');
    await page.locator('[data-testid="classroom-menu-submit"]').click();
    await page.locator('[data-testid="classroom-phase-submit-confirm"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(1500);
    const confirmText = await page.locator('[data-testid="classroom-phase-submit-confirm"]').textContent();
    record(/作品を提出します/.test(confirmText), 'confirm: 「作品を提出します」', confirmText.slice(0, 40));
    await judgeModal(page, 'submit-confirm');
    await shotBoth(page, 'flow-confirm', '0306-student-submit-confirm.png');
    await page.locator('[data-testid="classroom-submit-confirm"]').click();
    await page.locator('[data-testid="classroom-phase-submit-done"]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    record(submits.includes('POST'), 'done: submission POSTed');
    const doneText = await page.locator('[data-testid="classroom-submit-done-title"]').textContent();
    record(/提出できました ✓/.test(doneText), 'done: 「提出できました ✓」', doneText);
    const band = await page.locator('[data-testid="classroom-step-band"]').getAttribute('data-complete');
    record(band === 'true', 'done: step band all green');
    await judgeModal(page, 'submit-done');
    await shotBoth(page, 'flow-done', '0340-student-submit-done.png');
    await page.locator('[data-testid="classroom-submit-done-continue"]').click();
    await page.locator('[data-testid="classroom-modal"]').waitFor({ state: 'detached', timeout: 10000 });
    const kind = await page.locator('[data-testid="classroom-menu-submit"]').getAttribute('data-kind');
    record(kind === 'submitted', 'after continue: menu bar is 「提出済み ✓」', kind);
    await shotBoth(page, 'flow-menu-submitted', '0341-menu-bar-submitted.png');
    await ctx.close();
}

// 遅い Wi-Fi (verify-session が 2.5 秒): 確かめ中は「提出中...」も見出しも出さず、
// 確かめ終わったら見出しが切りかわらずに「もう一度提出します」で出る（レビュー M1）。
{
    const { ctx, page } = await studentPage({ viewport: PC, locale: 'ja', status: 'submitted', verifyDelay: 2500 });
    await page.locator('[data-testid="classroom-menu-submit"]').click();
    await page.locator('[data-testid="classroom-phase-submit-confirm"]').waitFor({ timeout: 10000 });
    const during = await page.locator('[data-testid="classroom-phase-submit-confirm"]').textContent();
    const checking = await page.locator('[data-testid="classroom-submit-checking"]').count();
    record(checking === 1 && !/提出中/.test(during) && !/提出します/.test(during), 'slow verify: quiet checking line only', during);
    await shotBoth(page, 'flow-checking', null);
    await page.locator('[data-testid="classroom-submit-confirm"]').waitFor({ timeout: 10000 });
    const after = await page.locator('[data-testid="classroom-phase-submit-confirm"]').textContent();
    const enabled = await page.locator('[data-testid="classroom-submit-confirm"]').isEnabled();
    record(/もう一度提出します/.test(after) && enabled && !/提出中/.test(after), 'slow verify: then the resubmit confirmation', after.slice(0, 40));
    await ctx.close();
}

// 送信中は閉じられず (Escape・×・外)、メニューバーのボタンも押せない（レビュー Q1）。
{
    const { ctx, page, submits } = await studentPage({ viewport: PC, locale: 'ja', status: null, submitDelay: 3000 });
    await page.locator('[data-testid="classroom-menu-submit"]').click();
    await page.locator('[data-testid="classroom-submit-confirm"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.locator('[data-testid="classroom-submit-confirm"]').click();
    await page.waitForFunction(() => {
        const b = document.querySelector('[data-testid="classroom-menu-submit"]');
        return b && b.disabled;
    }, null, { timeout: 10000 });
    record(true, 'submitting: menu bar button disabled');
    await page.keyboard.press('Escape');
    await page.mouse.click(5, 590);
    await page.waitForTimeout(300);
    record((await page.locator('[data-testid="classroom-modal"]').count()) === 1, 'submitting: Escape / outside click do not close');
    await page.locator('[data-testid="classroom-phase-submit-done"]').waitFor({ timeout: 60000 });
    record(submits.filter((m) => m === 'POST').length === 1, 'submitting: one submission only');
    await ctx.close();
}

// スマホ: ドロワーの「提出する」→ 提出確認（レビュー M2）
{
    const { ctx, page } = await studentPage({ viewport: VIEWPORTS.find((v) => v.name === 'phone-667x375'), locale: 'ja', status: null });
    await page.locator('[data-testid="mobile-side-rail-menu"]').click();
    await page.locator('[data-testid="mobile-drawer"][data-state="open"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    await shotBoth(page, 'phone-drawer', '0344-mobile-drawer-submit.png');
    await page.locator('[data-testid="mobile-drawer"] [data-testid="classroom-menu-submit"]').click();
    await page.locator('[data-testid="classroom-submit-confirm"]').waitFor({ timeout: 10000 });
    record((await page.locator('[data-testid="mobile-drawer"][data-state="closed"]').count()) === 1, 'phone: drawer closes and the confirmation opens');
    await ctx.close();
}

// 「やめる」はモーダルを閉じる
{
    const { ctx, page, submits } = await studentPage({ viewport: PC, locale: 'ja', status: null });
    await page.locator('[data-testid="classroom-menu-submit"]').click();
    await page.locator('[data-testid="classroom-phase-submit-confirm"]').waitFor({ timeout: 10000 });
    await page.locator('[data-testid="classroom-submit-cancel"]').click();
    await page.locator('[data-testid="classroom-modal"]').waitFor({ state: 'detached', timeout: 10000 });
    record(!submits.includes('POST'), 'cancel: closes the modal without submitting');
    await ctx.close();
}

// 提出済み → 再提出、返却済み → コメントつきの再提出
for (const [status, docName] of [
    ['submitted', '0342-student-resubmit-confirm.png'],
    ['returned', '0343-student-resubmit-returned.png'],
]) {
    const { ctx, page } = await studentPage({ viewport: PC, locale: 'ja', status });
    await page.locator('[data-testid="classroom-menu-submit"]').click();
    await page.locator('[data-testid="classroom-phase-submit-confirm"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(1500);
    const text = await page.locator('[data-testid="classroom-phase-submit-confirm"]').textContent();
    record(/もう一度提出します/.test(text) && /置きかわります/.test(text), `${status}: resubmit wording`);
    const comment = await page.locator('[data-testid="classroom-submit-teacher-comment"]').count();
    record(status === 'returned' ? comment === 1 : comment === 0, `${status}: teacher comment ${comment ? 'shown' : 'hidden'}`);
    await judgeModal(page, `${status}: resubmit confirm`);
    await shotBoth(page, `flow-resubmit-${status}`, docName);
    await ctx.close();
}

// ---------- docs: 提出サムネイルの事前設定（0310〜0313）----------
// ステージ右上の行だけを切り出す（未参加はボタンなし・参加中は ✓ アイコンのボタン）。
// 0313 は「大きいネコを左上」で事前設定し、そのあと「小さいネコを右下」へ動かしてから提出確認を開く。
if (DOCS_SHOTS) {
    const stageRow = '[class*="stage-header_stage-size-row"]';
    // React の Fiber から VM を取り出してスプライトを動かす（Ruby タブを開かずに済ませる）
    const moveSprite = (page, x, y, size) =>
        page.evaluate(
            ([px, py, ps]) => {
                const all = [document.body, ...document.body.querySelectorAll('*')];
                let fiber = null;
                for (const el of all) {
                    const k = Object.keys(el).find((key) => key.startsWith('__reactContainer'));
                    if (k) {
                        fiber = el[k].stateNode.current;
                        break;
                    }
                }
                const stack = [fiber];
                let store = null;
                while (stack.length && !store) {
                    const f = stack.pop();
                    if (!f) continue;
                    const pr = f.memoizedProps;
                    if (pr?.store?.getState) store = pr.store;
                    else if (pr?.value?.store?.getState) store = pr.value.store;
                    if (f.child) stack.push(f.child);
                    if (f.sibling) stack.push(f.sibling);
                }
                const t = store?.getState().scratchGui.vm.runtime.targets.find((tg) => !tg.isStage);
                if (t) {
                    t.setXY(px, py);
                    t.setSize(ps);
                }
                return !!t;
            },
            [x, y, size],
        );
    const thumbButton = `${stageRow} [title="提出サムネイルを設定"], ${stageRow} img[alt="提出サムネイルを設定"]`;
    {
        const ctx = await browser.newContext({ viewport: PC });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/?no_beforeunload=1&locale=ja`, { waitUntil: 'load' });
        await page.locator(stageRow).waitFor({ timeout: 60000 });
        await page.waitForTimeout(800);
        await page.locator(stageRow).screenshot({ path: resolve(DOCS_DIR, '0310-submission-thumbnail-button-hidden.png') });
        record((await page.locator(thumbButton).count()) === 0, 'thumbnail: no button before joining');
        await ctx.close();
    }
    {
        const { ctx, page } = await studentPage({ viewport: PC, locale: 'ja', status: null });
        await page.locator(stageRow).waitFor({ timeout: 60000 });
        record((await page.locator(thumbButton).count()) > 0, 'thumbnail: button while joined');
        await page.locator(stageRow).screenshot({ path: resolve(DOCS_DIR, '0311-submission-thumbnail-button.png') });
        // 大きいネコを左上にして、事前設定する
        await moveSprite(page, -150, 110, 180);
        await page.waitForTimeout(400);
        await page.locator(thumbButton).first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: resolve(DOCS_DIR, '0312-submission-thumbnail-confirm.png') });
        await page.locator('[class*="confirmation-prompt"] button').last().click();
        await page.waitForTimeout(1500);
        await moveSprite(page, 170, -120, 60);
        await page.waitForTimeout(400);
        await page.locator('[data-testid="classroom-menu-submit"]').click();
        await page.locator('[data-testid="classroom-submit-confirm"]').waitFor({ timeout: 10000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: resolve(DOCS_DIR, '0313-submission-thumbnail-used-on-submit.png') });
        await ctx.close();
    }
}

// ---------- 3. 作品を提出しないレッスンの課題では出さない ----------
{
    const lesson = {
        courseId: 'kyou-kara-programmer',
        challengeIds: ['blocks-l1-key-sound'],
        requiredChallengeIds: [],
        completion: { type: 'all', count: 1 },
        submitWork: false,
        scoring: null,
    };
    const { ctx, page } = await studentPage({ viewport: PC, locale: 'ja', status: null, lesson });
    const count = await page.locator('[data-testid="classroom-menu-submit"]').count();
    record(count === 0, 'lesson without work submission: no submit button');
    await ctx.close();
}

await browser.close();
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
if (failed.length) process.exit(1);
