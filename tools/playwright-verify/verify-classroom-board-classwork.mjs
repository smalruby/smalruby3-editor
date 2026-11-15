// Stream and Classwork tabs of a class (#1301: B3・B4・B6・B7, #1302: B5) at
// the lesson PC size (1300x600). The classroom API is stubbed with page.route,
// so no login or stg data is needed — only the dev server.
//
// Measures (R6): the bottom of the main button ［＋ 作成 ▾］ and that the page
// does not scroll; on the stream (no main button) that only the stream frame
// scrolls. Takes the docs screenshots with DOCS_SHOTS=1.
//
//   node verify-classroom-board-classwork.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-board-classwork.mjs    # + docs/classroom/screenshots
//   LOCALE=ja-Hira node verify-classroom-board-classwork.mjs  # ひらがなで測る (既定は ja。DOCS_SHOTS は ja のときだけ)
//   BASE=http://localhost:8621 node verify-classroom-board-classwork.mjs
//   LONG=1 node verify-classroom-board-classwork.mjs           # 長いクラス名・課題名でヘッダーがはみ出さないか (#1958)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_DIR = resolve(REPO_ROOT, 'docs/classroom/screenshots');
const LOCALE = process.env.LOCALE || 'ja';
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1' && LOCALE === 'ja';
const VIEWPORT = { width: 1300, height: 600 };
// LONG=1: a long class name and assignment name, to see the header path cut with「…」 (#1958).
const LONG = process.env.LONG === '1';
const CLASS_NAME = LONG ? '技術・家庭科（情報の技術）プログラミングによる問題の解決と双方向性のあるコンテンツ' : '技術';
const CLASS_SECTION = LONG ? '2年1組 A コース（火曜 3・4 時間目）' : '2年1組';
const C1_NAME = LONG
    ? 'ねこを動かそう — 順次・反復・分岐を使ってステージの端まで歩いて戻るアニメーションを作る'
    : 'ねこを動かそう';
mkdirSync(SHOT_DIR, { recursive: true });

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const assignment = (over) => ({
    className: '技術',
    studentCount: 30,
    googleClassroomCourseId: null,
    coTeacherEmails: [],
    groupId: 'g1',
    topic: null,
    hasAssignment: true,
    status: 'active',
    role: 'owner',
    createdAt: iso(now - 10 * DAY),
    expiresAt: iso(now + 80 * DAY),
    ...over,
});
const classrooms = [
    assignment({ classroomId: 'c1', assignmentName: C1_NAME, joinCode: 'abc234', sortDate: iso(now - 2 * DAY) }),
    assignment({
        classroomId: 'c2',
        assignmentName: 'チャットアプリを作ろう',
        joinCode: 'kx7p2m',
        sortDate: iso(now - 9 * DAY),
        expiresAt: iso(now + 5 * DAY),
    }),
    assignment({ classroomId: 'c3', assignmentName: 'アニメーション', joinCode: 'q8wz3e', topic: '第1回 アニメーション', sortDate: iso(now - 20 * DAY) }),
    assignment({ classroomId: 'c4', assignmentName: 'ふりかえり', joinCode: 'h2nd5r', topic: '第1回 アニメーション', sortDate: iso(now - 21 * DAY), hasAssignment: false }),
];
// Archived assignment (only in the includeArchived=1 response): the stream
// shows its archiving, and its entry opens the archived section.
const archived = [
    assignment({
        classroomId: 'c9',
        assignmentName: 'うごきのれんしゅう',
        joinCode: 'z9y8x7',
        status: 'archived',
        createdAt: iso(now - 40 * DAY),
        archivedAt: iso(now - 5 * DAY),
        sortDate: iso(now - 40 * DAY),
        expiresAt: iso(now + 50 * DAY),
    }),
];
const members = Array.from({ length: 24 }, (_, i) => ({ memberId: `seat-${String(i + 1).padStart(2, '0')}` }));
const submissions = members.filter((_, i) => i % 2 === 0).map((m, i) => ({ submissionId: `s${i}`, memberId: m.memberId, status: 'submitted', submittedAt: iso(now) }));

const results = [];
const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
await page.route('**/kick-requests/pending', (r) => r.fulfill({ json: { requests: [] } }));
await page.route('**/classroom-groups', (r) =>
    r.fulfill({
        json: {
            groups: [
                { groupId: 'g1', name: CLASS_NAME, year: 2026, section: CLASS_SECTION, status: 'active', schemaVersion: 2, topics: ['第1回 アニメーション', '第2回 チャット'] },
            ],
        },
    }),
);
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms: [...classrooms, ...archived] } }));
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms } }));
await page.route(/\/classrooms\/c\d$/, (r) => {
    const id = r.request().url().match(/classrooms\/(c\d)$/)[1];
    return r.fulfill({ json: classrooms.find((c) => c.classroomId === id) || {} });
});
await page.route(/\/kick-requests/, (r) => r.fulfill({ json: { requests: [] } }));
await page.route(/\/classrooms\/c\d\/members$/, (r) => r.fulfill({ json: { members } }));
await page.route(/\/classrooms\/c\d\/submissions$/, (r) => r.fulfill({ json: { submissions } }));
await page.route(/\/classrooms\/c\d\/assignment$/, (r) =>
    r.fulfill({ json: { assignment: { pages: [{ text: 'ねこが 10 歩ずつ動くようにしよう。\n2 ページ目に続く' }] } } }),
);

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name, docsName) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `issue-1301-${name}${LOCALE === 'ja' ? '' : `-${LOCALE}`}.png`) });
    if (DOCS_SHOTS && docsName) await page.screenshot({ path: resolve(DOCS_DIR, docsName) });
};
// The header stays one line inside the window: the path is cut with「…」, the bell and the
// avatar stay at the right end (#1958).
const measureHeader = () =>
    page.evaluate(() => {
        const header = document.querySelector('[data-testid="classroom-teacher-header"]');
        const avatar = document.querySelector('[data-testid="classroom-avatar-button"]');
        const back = document.querySelector('[data-testid="classroom-teacher-back-to-editor"]');
        const r = header.getBoundingClientRect();
        return {
            fits: header.scrollWidth <= header.clientWidth && r.height <= 51,
            size: `${header.scrollWidth}/${header.clientWidth} h=${Math.round(r.height)}`,
            avatarRight: avatar ? Math.round(avatar.getBoundingClientRect().right) : null,
            backVisible: back ? back.getBoundingClientRect().width > 0 : false,
            path: document.querySelector('[data-testid="classroom-teacher-header"] [data-testid="classroom-breadcrumbs"]')?.textContent,
        };
    });
const headerOk = (h) => h.fits && h.backVisible && h.avatarRight !== null && h.avatarRight <= VIEWPORT.width;
const measureStream = () =>
    page.evaluate(() => {
        const se = document.scrollingElement;
        const body = document.querySelector('[data-testid="classroom-board"]');
        const frame = document.querySelector('[data-testid="classroom-board-stream"]');
        const items = Array.from(document.querySelectorAll('[data-testid^="classroom-board-stream-item-"]'));
        return {
            selected: document.querySelector('[data-testid="classroom-board-tab-stream"]')?.getAttribute('aria-selected'),
            keys: items.map((e) => e.getAttribute('data-testid').replace('classroom-board-stream-item-', '')),
            lastBottom: items.length ? Math.round(items[items.length - 1].getBoundingClientRect().bottom) : null,
            frame: frame ? `${frame.scrollHeight}/${frame.clientHeight}` : '-',
            bodyOk: body ? body.scrollHeight <= body.clientHeight : false,
            body: body ? `${body.scrollHeight}/${body.clientHeight}` : '-',
            pageOk: se.scrollHeight <= se.clientHeight,
        };
    });
const measure = () =>
    page.evaluate(() => {
        const btn = document.querySelector('[data-testid="classroom-board-create-menu"]');
        const se = document.scrollingElement;
        const body = document.querySelector('[data-testid="classroom-board"]');
        const list = document.querySelector('[data-testid="classroom-board-list"]');
        return {
            list: list ? `${list.scrollHeight}/${list.clientHeight}` : '-',
            bodyOk: body ? body.scrollHeight <= body.clientHeight : false,
            bottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
            vh: window.innerHeight,
            pageOk: se.scrollHeight <= se.clientHeight,
            body: body ? `${body.scrollHeight}/${body.clientHeight}` : '-',
        };
    });

try {
    await page.goto(`${BASE}/?no_beforeunload=1&locale=${LOCALE}&devlogin=stub-token`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    // The dev server's warning overlay would swallow the clicks.
    await page.addStyleTag({ content: '#webpack-dev-server-client-overlay { display: none !important; }' });
    // The teacher menu (menu bar) opens the class list.
    await page.$eval(tid('classroom-teacher-menu-button'), (el) => el.click());
    await page.waitForTimeout(300);
    await page.$eval(tid('classroom-teacher-menu-class-list'), (el) => el.click());
    await page.waitForSelector(tid('classroom-class-open-g1'), { timeout: 20000 });
    await page.waitForTimeout(500);
    // The class list (#1958): the header says only 「クラス管理」 and the main button is visible.
    const landing = await page.evaluate(() => {
        const se = document.scrollingElement;
        const main = document.querySelector('[data-testid="classroom-teacher-modal"] main');
        const btn = document.querySelector('[data-testid="classroom-class-create"]');
        const frame = document.querySelector('[data-testid="classroom-class-list-scroll"]');
        return {
            path: document.querySelector('[data-testid="classroom-teacher-header"] [data-testid="classroom-breadcrumbs"]')?.textContent,
            bottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
            mainOk: main ? main.scrollHeight <= main.clientHeight : false,
            main: main ? `${main.scrollHeight}/${main.clientHeight}` : '-',
            frame: frame ? `${frame.scrollHeight}/${frame.clientHeight}` : '-',
            pageOk: se.scrollHeight <= se.clientHeight,
        };
    });
    record(
        'class list (header path)',
        landing.bottom !== null && landing.bottom <= VIEWPORT.height && landing.mainOk && landing.pageOk && landing.path === (LOCALE === 'ja' ? 'クラス管理' : 'クラスかんり'),
        `path=${landing.path} create bottom=${landing.bottom}/${VIEWPORT.height} page=${landing.pageOk ? 'no scroll' : 'SCROLLS'} main=${landing.main} list=${landing.frame}`,
    );
    await shot('class-list', '0210-teacher-class-list.png');
    await page.locator(tid('classroom-class-open-g1')).click();
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    await page.waitForTimeout(800);

    // B5: a class opens on the stream.
    const st = await measureStream();
    const expectedKeys = ['expiring-c2', 'archived-c9', 'created-c1', 'created-c2', 'created-c3', 'created-c4', 'created-c9'];
    record(
        'stream is the default tab',
        st.selected === 'true' && st.keys.join() === expectedKeys.join() && st.pageOk && st.bodyOk,
        `entries=${st.keys.join(',')} last-entry bottom=${st.lastBottom}/${VIEWPORT.height} page=${st.pageOk ? 'no scroll' : 'SCROLLS'} board=${st.body} stream=${st.frame}`,
    );
    await shot('stream', '0226-board-stream.png');

    await page.locator(tid('classroom-board-tab-classwork')).click();
    await page.waitForTimeout(300);
    let m = await measure();
    record('classwork tab (closed rows)', m.bottom !== null && m.bottom <= m.vh && m.pageOk && m.bodyOk, `create-menu bottom=${m.bottom}/${m.vh} page=${m.pageOk ? 'no scroll' : 'SCROLLS'} board=${m.body} list=${m.list}`);
    await shot('classwork', '0211-teacher-assignment-board.png');

    await page.locator(tid('classroom-board-create-menu')).click();
    await page.waitForTimeout(300);
    // 並びは data-testid で比べる (言葉は LOCALE で変わるので、表示の文字は報告にだけ出す)。
    const items = await page.$$eval('[data-testid="classroom-board-create-menu-list"] [role="menuitem"]', (els) =>
        els.map((e) => ({ id: e.getAttribute('data-testid'), text: e.textContent.trim() })),
    );
    const CREATE_MENU = [
        'classroom-board-create',
        'classroom-board-create-lesson',
        'classroom-board-reuse',
        'classroom-board-shared-catalog',
        'classroom-board-passcode-import',
        'classroom-board-create-topic',
    ];
    record(
        'create menu items',
        items.length === CREATE_MENU.length && CREATE_MENU.every((id, i) => items[i].id === id),
        items.map((item) => `${item.text} (${item.id})`).join(' / '),
    );
    await shot('create-menu', '0224-board-create-menu.png');

    await page.locator(tid('classroom-board-create-topic')).click();
    await page.waitForSelector(tid('classroom-topic-add-dialog'));
    const dlg = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="classroom-topic-add"]').getBoundingClientRect();
        const bg = getComputedStyle(document.querySelector('[data-testid="classroom-topic-add-dialog"]')).backgroundColor;
        return { bottom: Math.round(b.bottom), bg };
    });
    record('add-topic dialog', dlg.bottom <= VIEWPORT.height && dlg.bg !== 'rgba(0, 0, 0, 0)', `add bottom=${dlg.bottom} bg=${dlg.bg}`);
    await shot('topic-dialog', '0225-board-topic-dialog.png');
    await page.locator(tid('classroom-topic-add-cancel')).click();

    await page.locator(tid('classroom-board-row-toggle-c2')).click();
    await page.waitForFunction(() => /24/.test(document.querySelector('[data-testid="classroom-board-row-counts-c2"]')?.textContent || ''));
    m = await measure();
    const open = await page.evaluate(() => {
        const b = document.querySelector('[data-testid="classroom-board-open-c2"]').getBoundingClientRect();
        return { bottom: Math.round(b.bottom), red: !!document.querySelector('[data-testid="classroom-board-expiry-c2"]') };
    });
    record('opened row (7 days left)', open.red && m.bottom <= m.vh && m.pageOk && m.bodyOk, `open-button bottom=${open.bottom} create-menu bottom=${m.bottom} page=${m.pageOk ? 'no scroll' : 'SCROLLS'} board=${m.body} list=${m.list}`);
    await shot('row-open-urgent', '0213-board-expiry-badge-download.png');

    await page.locator(tid('classroom-board-row-toggle-c1')).click();
    await page.waitForFunction(() => /24/.test(document.querySelector('[data-testid="classroom-board-row-counts-c1"]')?.textContent || ''));
    const grey = await page.textContent(tid('classroom-board-retention-c1'));
    record('opened row (far deadline is grey)', !!grey && !(await page.$(tid('classroom-board-expiry-c1'))), grey);
    await shot('row-open');

    // Stream entries open their assignment on［授業］.
    await page.locator(tid('classroom-board-tab-stream')).click();
    await page.locator(tid('classroom-board-stream-item-created-c3')).click();
    await page.waitForSelector(tid('classroom-board-open-c3'));
    record(
        'stream entry opens the assignment',
        (await page.getAttribute(tid('classroom-board-tab-classwork'), 'aria-selected')) === 'true',
        'row c3 opened on the classwork tab',
    );
    await page.locator(tid('classroom-board-tab-stream')).click();
    await page.locator(tid('classroom-board-stream-item-archived-c9')).click();
    await page.waitForSelector(tid('classroom-board-restore-c9'));
    record('archived entry opens the restore row', true, 'archived section expanded with［復元］');
    await shot('stream-archived-open');

    // The header path and the tabs (#1958): 「クラス管理 › クラス名」, then［⚙ クラスの設定］
    // opens the settings inside the class, and［採点］opens the grading screen.
    const inClass = await measureHeader();
    record('header path in a class', headerOk(inClass) && inClass.path.includes(`›${CLASS_NAME} 2026年度`), `${inClass.path} header=${inClass.size} avatar right=${inClass.avatarRight}`);
    await page.locator(tid('classroom-board-class-settings')).click();
    await page.waitForSelector(tid('classroom-board-settings-view'));
    const settings = await page.evaluate(() => {
        const se = document.scrollingElement;
        const main = document.querySelector('[data-testid="classroom-teacher-modal"] main');
        const save = document.querySelector('[data-testid="classroom-class-settings-save"]');
        return {
            path: document.querySelector('[data-testid="classroom-breadcrumbs"]')?.textContent,
            bottom: save ? Math.round(save.getBoundingClientRect().bottom) : null,
            mainOk: main ? main.scrollHeight <= main.clientHeight : false,
            main: main ? `${main.scrollHeight}/${main.clientHeight}` : '-',
            pageOk: se.scrollHeight <= se.clientHeight,
        };
    });
    record(
        'class settings from the tab row',
        settings.bottom !== null && settings.bottom <= VIEWPORT.height && settings.mainOk && settings.pageOk,
        `path=${settings.path} save bottom=${settings.bottom}/${VIEWPORT.height} page=${settings.pageOk ? 'no scroll' : 'SCROLLS'} main=${settings.main}`,
    );
    await shot('class-settings');
    await page.locator(tid('classroom-class-settings-cancel')).click();
    await page.locator(tid('classroom-board-tab-grading')).click();
    await page.waitForSelector(tid('classroom-phase-teacher-evaluation'), { timeout: 10000 });
    record(
        'grading tab opens the grading screen',
        (await page.getAttribute(tid('classroom-board-tab-grading'), 'aria-selected')) === 'true',
        '［採点］selected on the grading screen',
    );
    // Back to the class on［授業］ (nothing loaded, so no question).
    await page.locator(tid('classroom-board-tab-classwork')).click();
    await page.waitForSelector(tid('classroom-board-create-menu'), { timeout: 10000 });
    record('classwork tab from the grading screen', true, 'board on［授業］');

    // The assignment detail: 「クラス管理 › クラス名 › 課題名」 still on one line.
    await page.locator(tid('classroom-board-row-toggle-c1')).click();
    await page.locator(tid('classroom-board-open-c1')).click();
    await page.waitForSelector(tid('classroom-breadcrumb-assignment-name'), { timeout: 10000 });
    await page.waitForTimeout(500);
    const inDetail = await measureHeader();
    record('header path in an assignment', headerOk(inDetail) && inDetail.path.endsWith(C1_NAME), `${inDetail.path} header=${inDetail.size} avatar right=${inDetail.avatarRight}`);
    if (LONG) await shot('long-names-detail');
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed at ${VIEWPORT.width}x${VIEWPORT.height} (${LOCALE})`);
process.exit(failed.length ? 1 : 0);
