/**
 * 授業 PC の画面 (1300×600) に「クラス」が収まるかの測定 (#1221)。
 *
 * 生徒の各フェーズを「一番長くなる状態」(40 席・各種バナー・エラー・長い名前) で開き、
 *   - モーダル ([data-testid="classroom-modal"] とその枠) がビューポートに収まるか
 *   - 本文と document.scrollingElement が scrollHeight <= clientHeight か
 * を一覧で出す。生徒は 1 つでも超えたら exit 1。
 * 先生のクラス管理は「モーダルがはみ出さない・見出しが見える」だけを見る (本文の中の
 * スクロールは可)。
 *
 * classroom API は route interception でスタブするので stg デプロイ不要
 * （dev server だけが前提）。スクショは tmp/classroom-viewport-*.png。
 *
 *   node verify-classroom-viewport.mjs                     # コンテナ内 (headless)
 *   BASE=http://localhost:8621 node verify-classroom-viewport.mjs
 *   SKIP_IDLE=1 node verify-classroom-viewport.mjs          # 30 秒待ちの強調表示を省く
 *   HEADLESS=false CHANNEL=chrome node verify-classroom-viewport.mjs
 *   DOCS_SHOTS=1 node verify-classroom-viewport.mjs        # docs/classroom/screenshots の生徒画面も撮り直す
 */
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADLESS = process.env.HEADLESS !== 'false';
const CHANNEL = process.env.CHANNEL || undefined;
const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const SKIP_IDLE = process.env.SKIP_IDLE === '1';
// VIEWPORT=WxH で別サイズ (iPad / スマホ) の見た目確認にも使える。判定は 1300x600 向け。
const [VW, VH] = (process.env.VIEWPORT || '1300x600').split('x').map(Number);
const VIEWPORT = { width: VW, height: VH };
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
// 測定した画面 → docs/classroom/screenshots の撮り直し先 (ファイル名は変えない)。
const DOC_SHOT_NAMES = {
    'student-join': ['0301-student-join.png'],
    'student-seat-pending': ['0308-student-kick-request-pending.png', '0315-student-seat-confirm.png'],
    'student-seat-rejected': ['0307-student-kicked-banner.png', '0309-student-kick-request-rejected.png'],
    'student-joined': ['0303-student-joined.png'],
    'student-status': ['0304-student-status.png'],
    'student-submit-confirm': ['0306-student-submit-confirm.png'],
};

const LONG_CLASS = '3年2組 技術・家庭科（情報の技術）プログラミング応用クラス';
const LONG_ASSIGNMENT = 'ねこが迷路を抜けてゴールまで進むゲームを作ろう（センサーと条件分岐の応用編）';
const LONG_COMMENT =
    'よくできています。条件分岐の使い方がとても上手です。次は、ゴールに着いたときに音を鳴らしたり、' +
    'タイムを表示したりして、遊ぶ人がもっと楽しくなる工夫を考えてみましょう。変数の名前もわかりやすくしましょう。';
const SEATS = 40;
const TAKEN = [1, 2, 4, 5, 8, 9, 12, 15, 16, 20, 21, 23, 27, 30, 33, 38];

const rows = [];
const record = (row) => {
    rows.push(row);
    const status = row.ok ? 'PASS' : 'FAIL';
    console.log(
        `${status} [${row.who}] ${row.name} — modal ${row.modal} body ${row.body} page ${row.page}` +
            (row.note ? ` (${row.note})` : ''),
    );
};

/**
 * モーダル枠・本文・ページのはみ出し / スクロールを測る。
 * @param {import('playwright').Page} page - 対象ページ
 * @param {string} bodySelector - 本文 (スクロールしうる要素) のセレクタ
 * @returns {Promise<object>} 測定値
 */
const measure = (page, bodySelector) =>
    page.evaluate((sel) => {
        const body = document.querySelector(sel);
        if (!body) return { missing: true };
        // 共有 Modal の外枠 (ReactModal content) まで上がって外形を測る。
        let frame = body;
        while (frame.parentElement && !String(frame.parentElement.className).includes('ReactModal__Overlay')) {
            frame = frame.parentElement;
        }
        const r = frame.getBoundingClientRect();
        const se = document.scrollingElement;
        return {
            frame: { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) },
            vw: window.innerWidth,
            vh: window.innerHeight,
            bodyScroll: body.scrollHeight,
            bodyClient: body.clientHeight,
            pageScroll: se.scrollHeight,
            pageClient: se.clientHeight,
        };
    }, bodySelector);

const judge = async (page, { who, name, body = '[data-testid="classroom-modal"]', shot }) => {
    const m = await measure(page, body);
    if (m.missing) {
        record({ who, name, ok: false, modal: '-', body: '-', page: '-', note: `${body} not found` });
        return;
    }
    const fits = m.frame.top >= 0 && m.frame.left >= 0 && m.frame.bottom <= m.vh && m.frame.right <= m.vw;
    const bodyOk = m.bodyScroll <= m.bodyClient;
    const pageOk = m.pageScroll <= m.pageClient;
    // 生徒: 3 つとも必須。先生: 枠がはみ出さず、ページがスクロールしないこと (本文の中は可)。
    const ok = who === 'student' ? fits && bodyOk && pageOk : fits && pageOk;
    record({
        who,
        name,
        ok,
        modal: `${fits ? 'OK' : 'NG'} ${m.frame.top}-${m.frame.bottom}/${m.vh}`,
        body: `${bodyOk ? 'OK' : 'NG'} ${m.bodyScroll}/${m.bodyClient}`,
        page: `${pageOk ? 'OK' : 'NG'} ${m.pageScroll}/${m.pageClient}`,
    });
    await page.screenshot({ path: resolve(SHOT_DIR, `classroom-viewport-${process.env.VIEWPORT ? `${process.env.VIEWPORT}-` : ''}${shot}.png`) });
    if (DOCS_SHOTS) {
        const names = [...(DOC_SHOT_NAMES[shot] || [])];
        if (shot === 'student-seat-rejected' && !SKIP_IDLE) names.push('0317-student-seat-guide-idle.png');
        for (const n of names) {
            await page.screenshot({ path: resolve(REPO_ROOT, 'docs', 'classroom', 'screenshots', n) });
        }
    }
};

const browser = await chromium.launch({ headless: HEADLESS, channel: CHANNEL });

const session = (extra = {}) => ({
    role: 'student',
    classroomId: 'c1',
    className: LONG_CLASS,
    assignmentName: LONG_ASSIGNMENT,
    joinCode: 'abc234',
    seatNumber: 7,
    memberId: 'seat-07',
    sessionToken: 'stub',
    joinedAt: new Date().toISOString(),
    ...extra,
});

const lookup = (activeKickRequestIds = []) => ({
    className: LONG_CLASS,
    assignmentName: LONG_ASSIGNMENT,
    studentCount: SEATS,
    takenSeats: TAKEN,
    activeKickRequestIds,
    expiresAt: null,
});

/**
 * 生徒用のページを作る。
 * @param {object} opts - options
 * @param {object} [opts.storage] - localStorage に入れる key → value
 * @param {Function} [opts.routes] - 追加の route 設定
 * @returns {Promise<{ctx: object, page: import('playwright').Page}>} context と page
 */
const studentPage = async ({ storage = {}, routes } = {}) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await page.route('**/classrooms/lookup', (r) => r.fulfill({ json: lookup() }));
    if (routes) await routes(page);
    await page.addInitScript((s) => {
        if (window.sessionStorage.getItem('__seeded')) return;
        window.sessionStorage.setItem('__seeded', '1');
        for (const [k, v] of Object.entries(s)) window.localStorage.setItem(k, JSON.stringify(v));
    }, storage);
    await page.goto(`${BASE}/?no_beforeunload=1&locale=ja`, { waitUntil: 'load' });
    // PC はメニューバーの「クラス」、スマホ (MobileGui) はサイドレール ☰ のドロワーから開く。
    await page
        .locator('[data-testid="classroom-menu-button"]:visible, [data-testid="mobile-side-rail-menu"]:visible')
        .first()
        .waitFor({ state: 'visible', timeout: 30000 });
    return { ctx, page };
};

const openModal = async (page) => {
    // 狭い幅ではメニューバーの他の項目が重なるので DOM から直接押す。
    if (await page.locator('[data-testid="classroom-menu-button"]').isVisible()) {
        await page.$eval('[data-testid="classroom-menu-button"]', (el) => el.click());
    } else {
        await page.locator('[data-testid="mobile-side-rail-menu"]').click();
        await page.locator('[data-testid="mobile-drawer-classroom"]').click();
    }
    await page.locator('[data-testid="classroom-modal"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);
};

const history = Array.from({ length: 5 }, (_, i) => ({
    joinCode: `abc23${i}`,
    className: `${LONG_CLASS} ${i + 1}`,
    assignmentName: LONG_ASSIGNMENT,
    usedAt: new Date().toISOString(),
    expiresAt: null,
}));

// ---------- student-join (履歴 5 件 + エラー) ----------
{
    const { ctx, page } = await studentPage({
        storage: { 'smalruby:joinCodeHistory': history },
        routes: (p) =>
            p.route('**/classrooms/lookup', (r) => r.fulfill({ status: 404, json: { error: 'Classroom not found' } })),
    });
    await openModal(page);
    await page.locator('[data-testid="classroom-join-code-input"]').fill('zzz999');
    await page.locator('[data-testid="classroom-join-submit"]').click();
    await page.waitForTimeout(800);
    await judge(page, { who: 'student', name: 'student-join (history 5 + error)', shot: 'student-join' });
    await ctx.close();
}

// ---------- student-seat: kicked + 退室依頼待ち + 選択中 + エラー ----------
const kickedRoutes = (activeIds) => async (p) => {
    await p.route('**/classrooms/verify-session', (r) =>
        r.fulfill({
            status: 410,
            json: { error: 'kicked', reason: 'kicked', joinCode: 'abc234', className: LONG_CLASS, seatNumber: 7 },
        }),
    );
    await p.route('**/classrooms/lookup', (r) => r.fulfill({ json: lookup(activeIds) }));
    // 参加の失敗は一番長いエラー文 (ネットワーク到達不可・API のホスト名入り) で測る。
    await p.route('**/classrooms/join', (r) => r.abort('failed'));
};
{
    const { ctx, page } = await studentPage({
        storage: {
            'smalruby:classroom': session(),
            'smalruby:classroom:kickRequest': {
                requestId: 'kr1',
                joinCode: 'abc234',
                seatNumber: 12,
                reason: '席を間違えました',
                createdAt: new Date().toISOString(),
            },
        },
        routes: kickedRoutes(['kr1']),
    });
    await openModal(page);
    await page.locator('[data-testid="classroom-seat-grid"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="classroom-seat-3"]').click();
    await page.locator('[data-testid="classroom-confirm-seat"]').click();
    await page.waitForTimeout(800);
    await judge(page, { who: 'student', name: 'student-seat (kicked + pending + selected + error)', shot: 'student-seat-pending' });
    await ctx.close();
}

// ---------- student-seat: kicked + 却下バナー + 30 秒後の強調 + 番号エラー ----------
{
    const { ctx, page } = await studentPage({
        storage: {
            'smalruby:classroom': session(),
            'smalruby:classroom:kickRequest': {
                requestId: 'kr-old',
                joinCode: 'abc234',
                seatNumber: 12,
                reason: null,
                createdAt: new Date().toISOString(),
            },
        },
        routes: kickedRoutes([]),
    });
    await openModal(page);
    await page.locator('[data-testid="classroom-seat-grid"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="classroom-seat-number-input"]').fill('99');
    await page.locator('[data-testid="classroom-seat-number-submit"]').click();
    if (!SKIP_IDLE) {
        await page.locator('[data-testid="classroom-seat-guide"][data-idle="1"]').waitFor({ timeout: 40000 });
    }
    await page.waitForTimeout(500);
    await judge(page, { who: 'student', name: 'student-seat (kicked + rejected + idle + input error)', shot: 'student-seat-rejected' });
    await ctx.close();
}

// ---------- 退室依頼ダイアログ (エラー付き) ----------
{
    const { ctx, page } = await studentPage({
        routes: (p) =>
            p.route('**/classrooms/lookup/kick-request', (r) => r.fulfill({ status: 500, json: { error: 'Internal error' } })),
    });
    await openModal(page);
    await page.locator('[data-testid="classroom-join-code-input"]').fill('abc234');
    await page.locator('[data-testid="classroom-join-submit"]').click();
    await page.locator('[data-testid="classroom-seat-1"]').click();
    // ダイアログが出なければ座席画面を測って誤って PASS しないよう、ここで失敗させる。
    await page.locator('[data-testid="kick-request-confirm-dialog"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="kick-request-reason-input"]').fill('きのうと同じ席にすわっています。番号をまちがえたかもしれません。');
    await page.locator('[data-testid="kick-request-submit"]').click();
    await page.waitForTimeout(600);
    await judge(page, { who: 'student', name: 'kick-request dialog (+ error)', shot: 'student-kick-dialog' });
    await ctx.close();
}

// ---------- student-joined (長い名前 + 前回のコメント) ----------
{
    const { ctx, page } = await studentPage({
        routes: (p) =>
            p.route('**/classrooms/join', (r) =>
                r.fulfill({
                    json: {
                        classroomId: 'c1',
                        className: LONG_CLASS,
                        classYear: 2026,
                        assignmentName: LONG_ASSIGNMENT,
                        seatNumber: 3,
                        memberId: 'seat-03',
                        sessionToken: 'stub',
                        hasAssignment: false,
                        previousComment: { teacherComment: LONG_COMMENT, status: 'returned' },
                    },
                }),
            ),
    });
    await openModal(page);
    await page.locator('[data-testid="classroom-join-code-input"]').fill('abc234');
    await page.locator('[data-testid="classroom-join-submit"]').click();
    await page.locator('[data-testid="classroom-seat-3"]').click();
    await page.locator('[data-testid="classroom-confirm-seat"]').click();
    await page.locator('[data-testid="classroom-phase-student-joined"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    await judge(page, { who: 'student', name: 'student-joined (long names + previous comment)', shot: 'student-joined' });
    await ctx.close();
}

// ---------- student-status (返却済み + 長いコメント) → submit-confirm ----------
{
    const { ctx, page } = await studentPage({
        storage: { 'smalruby:classroom': session({ submissionStatus: 'returned' }) },
        routes: (p) =>
            p.route('**/classrooms/verify-session', (r) =>
                r.fulfill({
                    json: {
                        valid: true,
                        hasAssignment: true,
                        submission: { status: 'returned', submittedAt: new Date().toISOString(), teacherComment: LONG_COMMENT },
                    },
                }),
            ),
    });
    await openModal(page);
    await page.locator('[data-testid="classroom-phase-student-status"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    await judge(page, { who: 'student', name: 'student-status (returned + long comment)', shot: 'student-status' });
    await page.locator('[data-testid="classroom-submit-button"]').click();
    await page.locator('[data-testid="classroom-phase-submit-confirm"]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await judge(page, { who: 'student', name: 'submit-confirm', shot: 'student-submit-confirm' });
    await ctx.close();
}

// ---------- メニューバー (参加中) ----------
{
    const { ctx, page } = await studentPage({
        storage: { 'smalruby:classroom': session({ submissionStatus: 'submitted' }) },
        routes: (p) => p.route('**/classrooms/verify-session', (r) => r.fulfill({ json: { valid: true } })),
    });
    const ok = await page.evaluate(() => {
        const el =
            document.querySelector('[data-testid="classroom-menu-button"]') ||
            document.querySelector('[data-testid="mobile-side-rail-menu"]');
        const r = el.getBoundingClientRect();
        const se = document.scrollingElement;
        return { ok: r.bottom <= window.innerHeight && se.scrollHeight <= se.clientHeight, b: Math.round(r.bottom) };
    });
    record({ who: 'student', name: 'menu bar (joined)', ok: ok.ok, modal: '-', body: '-', page: ok.ok ? 'OK' : 'NG' });
    await page.screenshot({ path: resolve(SHOT_DIR, 'classroom-viewport-menu-bar.png') });
    await ctx.close();
}

// ---------- 先生のクラス管理 (本文の中のスクロールは可) ----------
{
    const now = Date.now();
    const ago = (m) => new Date(now - m * 60 * 1000).toISOString();
    const summary = {
        classroomId: 'c1',
        className: LONG_CLASS,
        assignmentName: LONG_ASSIGNMENT,
        joinCode: 'abc234',
        studentCount: SEATS,
        googleClassroomCourseId: null,
        googleClassroomAlternateLink: null,
        createdAt: '2026-10-10T00:00:00.000Z',
        expiresAt: '2027-01-10T00:00:00.000Z',
        coTeacherEmails: [],
        groupId: 'g1',
        topic: null,
        sortDate: '2026-10-10T00:00:00.000Z',
        hasAssignment: true,
        status: 'active',
        role: 'owner',
    };
    const members = Array.from({ length: SEATS }, (_, i) => ({
        memberId: `seat-${String(i + 1).padStart(2, '0')}`,
        displayName: String(i + 1).padStart(2, '0'),
        lastActiveAt: ago(i % 7),
    }));
    const submissions = members
        .filter((_, i) => i % 3 === 0)
        .map((m, i) => ({ submissionId: `s${i}`, memberId: m.memberId, status: 'submitted', submittedAt: ago(3) }));
    const kickRequests = [{ requestId: 'k1', seatNumber: 4, reason: '席を間違えました', createdAt: ago(1) }];
    const notification = {
        notificationId: '2026-10-25T03:00:00.000Z#n1',
        type: 'share_suggestion',
        title: '課題を開く',
        body: 'stub',
        link: { kind: 'classroom', classroomId: 'c1' },
        readAt: null,
        createdAt: '2026-10-25T03:00:00.000Z',
    };
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [notification], unreadCount: 1 } }));
    await page.route('**/notifications/mark-read', (r) => r.fulfill({ json: { updated: 1 } }));
    await page.route('**/kick-requests/pending', (r) =>
        r.fulfill({ json: { requests: kickRequests.map((k) => ({ ...k, classroomId: 'c1', className: LONG_CLASS })) } }),
    );
    await page.route('**/classroom-groups', (r) =>
        r.fulfill({ json: { groups: [{ groupId: 'g1', name: '技術', year: 2026, status: 'active', schemaVersion: 2, topics: [] }] } }),
    );
    await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
    await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: [summary] } }));
    await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms: [summary] } }));
    await page.route('**/classrooms/c1', (r) => r.fulfill({ json: summary }));
    await page.route('**/classrooms/c1/members', (r) => r.fulfill({ json: { members } }));
    await page.route('**/classrooms/c1/kick-requests', (r) => r.fulfill({ json: { requests: kickRequests } }));
    await page.route('**/classrooms/c1/submissions', (r) => r.fulfill({ json: { submissions } }));
    await page.route('**/classrooms/c1/assignment', (r) =>
        r.fulfill({ json: { pages: [{ text: LONG_COMMENT.repeat(4), imageUrl: null }], starterUrl: null } }),
    );
    await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);

    // 先生メニュー (メニューバー)
    await page.$eval('[data-testid="classroom-teacher-menu-button"]', (el) => el.click());
    await page.waitForTimeout(400);
    const menu = await page.evaluate(() => {
        const items = [...document.querySelectorAll('[data-testid^="classroom-teacher-menu-"]')];
        const bottom = Math.max(0, ...items.map((e) => e.getBoundingClientRect().bottom));
        const se = document.scrollingElement;
        return { bottom: Math.round(bottom), vh: window.innerHeight, pageOk: se.scrollHeight <= se.clientHeight };
    });
    const menuOk = menu.bottom <= menu.vh && menu.pageOk;
    record({ who: 'teacher', name: 'teacher menu (open)', ok: menuOk, modal: `${menu.bottom}/${menu.vh}`, body: '-', page: menu.pageOk ? 'OK' : 'NG' });
    await page.screenshot({ path: resolve(SHOT_DIR, 'classroom-viewport-teacher-menu.png') });
    await page.keyboard.press('Escape');
    await page.mouse.click(650, 300);

    await page.locator('[data-testid="settings-menu"]').click();
    await page.locator('[data-testid="settings-classroom-management"]').click();
    await page.waitForTimeout(2000);
    await judge(page, { who: 'teacher', name: 'teacher class list', body: '[data-testid="classroom-class-list"]', shot: 'teacher-class-list' });

    await page.locator('[data-testid="classroom-notifications-button"]').click();
    await page.waitForTimeout(500);
    await page.locator(`[data-testid="classroom-notification-item-${notification.notificationId}"]`).click();
    await page.waitForTimeout(2500);
    await judge(page, { who: 'teacher', name: 'assignment detail (description)', body: '[data-testid="classroom-phase-teacher-detail"]', shot: 'teacher-detail' });
    await page.locator('[data-testid="classroom-tab-members"]').click();
    await page.waitForTimeout(800);
    await judge(page, { who: 'teacher', name: 'assignment detail (members 40)', body: '[data-testid="classroom-phase-teacher-detail"]', shot: 'teacher-members' });
    await page.locator('[data-testid="classroom-member-seat-04"]').click();
    await page.waitForTimeout(600);
    await judge(page, { who: 'teacher', name: 'member detail', body: '[data-testid="classroom-member-detail"]', shot: 'teacher-member-detail' });
    await ctx.close();
}

await browser.close();

console.log('\n| who | screen | modal (top-bottom/vh) | body (scroll/client) | page (scroll/client) | result |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) {
    console.log(`| ${r.who} | ${r.name} | ${r.modal} | ${r.body} | ${r.page} | ${r.ok ? 'PASS' : 'FAIL'} |`);
}
const failed = rows.filter((r) => !r.ok);
console.log(`\n${rows.length - failed.length}/${rows.length} screens fit in ${VIEWPORT.width}x${VIEWPORT.height}`);
process.exit(failed.length ? 1 : 0);
