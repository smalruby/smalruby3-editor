// ［＋ 作成 ▾］→「レッスン」and the lesson description in the assignment page (#1780)
// at the lesson PC size (1300x600). The classroom API is stubbed with page.route,
// so no login or stg data is needed — only the dev server.
//
// Checks: the menu item right below「課題」, creating opens the new assignment with
// the lesson panel open and the first lesson chosen, the description in the empty
// page (and following the lesson), the in-page overwrite question on a page the
// teacher wrote (no confirm()), the PUT payload, and R6 (the save button bottom
// ≤ 600, the page and the modal body do not scroll).
//
//   node verify-classroom-lesson-create.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-lesson-create.mjs    # + docs/classroom/screenshots
//   BASE=http://localhost:8611 node verify-classroom-lesson-create.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8601';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || resolve(REPO_ROOT, 'tmp');
const DOCS_DIR = resolve(REPO_ROOT, 'docs/classroom/screenshots');
const DOCS_SHOTS = process.env.DOCS_SHOTS === '1';
const VIEWPORT = { width: 1300, height: 600 };
mkdirSync(SHOT_DIR, { recursive: true });

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const assignment = (over) => ({
    className: '技術',
    studentCount: 40,
    googleClassroomCourseId: null,
    coTeacherEmails: [],
    groupId: 'g1',
    topic: null,
    hasAssignment: true,
    status: 'active',
    role: 'owner',
    createdAt: iso(now - 10 * DAY),
    expiresAt: iso(now + 80 * DAY),
    sortDate: iso(now - 2 * DAY),
    meshGroupLimit: 6,
    ...over,
});
const classrooms = [assignment({ classroomId: 'c1', assignmentName: '自分で書いた課題', joinCode: 'abc234' })];
const pagesById = { c1: [{ text: 'きょうは自由にプログラムを作ろう。' }] };
const savedLessons = { c1: null };
const puts = [];
const posts = [];

const results = [];
const record = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false', args: ['--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('dialog', (d) => {
    record('no confirm() dialog', false, d.message());
    d.dismiss();
});
await page.route('**/notifications', (r) => r.fulfill({ json: { notifications: [], unreadCount: 0 } }));
await page.route(/\/kick-requests/, (r) => r.fulfill({ json: { requests: [] } }));
await page.route('**/classroom-groups', (r) =>
    r.fulfill({
        json: {
            groups: [{ groupId: 'g1', name: '技術', year: 2026, section: '2年1組', status: 'active', schemaVersion: 2, topics: [] }],
        },
    }),
);
await page.route('**/classroom-groups/migrate', (r) => r.fulfill({ json: { migrated: 0 } }));
await page.route('**/classrooms?**', (r) => r.fulfill({ json: { classrooms } }));
await page.route(/\/classrooms$/, (r) => {
    if (r.request().method() === 'POST') {
        const body = r.request().postDataJSON();
        posts.push(body);
        const created = assignment({
            classroomId: 'c9',
            assignmentName: body.assignmentName,
            joinCode: 'new9zz',
            hasAssignment: false,
            createdAt: iso(now),
            sortDate: iso(now),
        });
        classrooms.push(created);
        pagesById.c9 = [];
        savedLessons.c9 = null;
        return r.fulfill({ json: created });
    }
    return r.fulfill({ json: { classrooms } });
});
await page.route(/\/classrooms\/c\d$/, (r) => {
    const id = r.request().url().match(/\/classrooms\/(c\d)$/)[1];
    return r.fulfill({ json: classrooms.find((c) => c.classroomId === id) });
});
await page.route(/\/classrooms\/c\d\/members$/, (r) => r.fulfill({ json: { members: [] } }));
await page.route(/\/classrooms\/c\d\/submissions$/, (r) => r.fulfill({ json: { submissions: [] } }));
await page.route(/\/classrooms\/c\d\/lesson-progress$/, (r) => r.fulfill({ json: { progress: [] } }));
await page.route(/\/classrooms\/c\d\/assignment$/, (r) => {
    const id = r.request().url().match(/\/classrooms\/(c\d)\/assignment$/)[1];
    if (r.request().method() === 'PUT') {
        const body = r.request().postDataJSON();
        puts.push({ id, body });
        pagesById[id] = body.pages;
        if (Object.prototype.hasOwnProperty.call(body, 'lesson')) savedLessons[id] = body.lesson;
        return r.fulfill({ json: { imageUploadUrls: [], starterUploadUrl: null, lesson: savedLessons[id] } });
    }
    const pages = pagesById[id] || [];
    return r.fulfill({ json: { assignment: pages.length ? { pages } : null, lesson: savedLessons[id] } });
});

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name, docsName) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `issue-1780-${name}.png`) });
    if (DOCS_SHOTS && docsName) await page.screenshot({ path: resolve(DOCS_DIR, docsName) });
};
const BODY = '[data-testid="classroom-teacher-modal"] main';
const LIST = '[data-testid="classroom-lesson-challenges"]';
const measure = () =>
    page.evaluate(
        ([bodySel, listSel]) => {
            const btn = document.querySelector('[data-testid="classroom-assignment-save"]');
            const se = document.scrollingElement;
            const el = document.querySelector(bodySel);
            const list = document.querySelector(listSel);
            const panel = document.querySelector('[data-testid="classroom-lesson-panel"]');
            return {
                bottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
                vh: window.innerHeight,
                pageOk: se.scrollHeight <= se.clientHeight,
                bodyOk: el ? el.scrollHeight <= el.clientHeight : false,
                body: el ? `${el.scrollHeight}/${el.clientHeight}` : '-',
                list: list ? `${list.scrollHeight}/${list.clientHeight}` : '-',
                panelBottom: panel ? Math.round(panel.getBoundingClientRect().bottom) : null,
            };
        },
        [BODY, LIST],
    );
const describe = (m) =>
    `save.bottom=${m.bottom}/${m.vh} page=${m.pageOk ? 'no scroll' : 'SCROLLS'} body(${BODY})=${m.body} list(${LIST})=${m.list} panel.bottom=${m.panelBottom}`;
const r6 = (m) => m.bottom !== null && m.bottom <= m.vh && m.pageOk && m.bodyOk;
const text = (id) => page.$eval(tid(id), (el) => el.textContent);

const openDescription = async (id) => {
    await page.locator(tid(`classroom-board-row-toggle-${id}`)).click();
    await page.locator(tid(`classroom-board-open-${id}`)).click();
    await page.waitForSelector(tid('classroom-phase-teacher-detail'), { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.locator(tid('classroom-tab-description')).click();
    await page.waitForSelector(tid('classroom-lesson-settings'), { timeout: 10000 });
    await page.waitForTimeout(500);
};
const backToBoard = async () => {
    await page.locator(tid('classroom-breadcrumb-assignments')).click();
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    if (await page.$(tid('classroom-board-tab-classwork'))) await page.locator(tid('classroom-board-tab-classwork')).click();
    await page.waitForTimeout(500);
};

const pageText = () => page.$eval(tid('classroom-assignment-page-text-0'), (el) => el.value);
const openBoard = async () => {
    await page.goto(`${BASE}/?no_beforeunload=1&locale=ja&devlogin=stub-token`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    await page.addStyleTag({ content: '#webpack-dev-server-client-overlay { display: none !important; }' });
    await page.$eval(tid('classroom-teacher-menu-button'), (el) => el.click());
    await page.waitForTimeout(300);
    await page.$eval(tid('classroom-teacher-menu-class-list'), (el) => el.click());
    await page.locator(tid('classroom-class-open-g1')).click();
    await page.waitForSelector(tid('classroom-board'), { timeout: 20000 });
    await page.locator(tid('classroom-board-tab-classwork')).click();
    await page.waitForTimeout(500);
};

try {
    await openBoard();

    // 1. The menu: 「レッスン」 right below 「課題」.
    await page.locator(tid('classroom-board-create-menu')).click();
    await page.waitForTimeout(200);
    const items = await page.$$eval('[data-testid="classroom-board-create-menu-list"] [role="menuitem"]', (els) =>
        els.map((el) => `${el.dataset.testid}:${el.textContent.trim()}`),
    );
    record(
        'menu: レッスン below 課題',
        items[0] === 'classroom-board-create:課題' && items[1] === 'classroom-board-create-lesson:レッスン',
        items.join(' | '),
    );
    await shot('create-menu', '0224-board-create-menu.png');

    // 2. Create → opens with the panel open and the first lesson chosen.
    await page.locator(tid('classroom-board-create-lesson')).click();
    await page.waitForSelector(tid('classroom-board-create-view'));
    const title = await text('classroom-board-create-view');
    record('create screen title', title.includes('レッスンの課題を作成'), title.slice(0, 40));
    await page.fill(tid('classroom-board-create-name'), 'レッスンをやろう');
    await page.locator(tid('classroom-board-create-submit')).click();
    await page.waitForSelector(tid('classroom-lesson-panel'), { timeout: 20000 });
    await page.waitForTimeout(500);
    const checked = await page.$eval(tid('classroom-lesson-lesson-blocks-l1'), (el) => el.checked);
    const others = await page.$$eval('[data-testid^="classroom-lesson-lesson-"]', (els) =>
        els.slice(1).every((el) => !el.checked),
    );
    record('first lesson chosen, others not', checked && others && posts.length === 1, JSON.stringify(posts[0]));
    let text0 = await pageText();
    record(
        'empty page got the description',
        text0.startsWith('「きょうからプログラマー」のレッスンにチャレンジしよう！') && text0.includes('全部できたら課題クリア'),
        JSON.stringify(text0),
    );
    let m = await measure();
    record('created, panel open: R6', r6(m) && m.panelBottom <= m.vh, describe(m));
    await shot('created-panel-open', '0256-detail-lesson-create.png');

    // 3. Changing the lesson rewrites the generated text (no question).
    await page.locator(tid('classroom-lesson-required-blocks-l1-key-sound')).click();
    await page.locator(tid('classroom-lesson-submit-yes')).click();
    await page.waitForTimeout(200);
    text0 = await pageText();
    record(
        'generated text follows the lesson',
        text0.includes('★ のついたチャレンジ 1 こは') && text0.includes('作品をつくって提出しよう'),
        JSON.stringify(text0),
    );
    await page.locator(tid('classroom-lesson-close')).click();
    await page.waitForTimeout(200);
    record('no question while the page is the generated text', !(await page.$(tid('classroom-lesson-description-question'))));
    const summary = await text('classroom-lesson-summary');
    record('closing keeps the lesson', summary.includes('きょうからプログラマー'), summary);
    m = await measure();
    record('created, folded: R6', r6(m), describe(m));
    await shot('created-folded');

    // 4. Save → PUT carries the lesson and the description page.
    await page.locator(tid('classroom-assignment-save')).click();
    await page.waitForTimeout(1500);
    const put = puts.at(-1);
    record(
        'PUT has the lesson and the description page',
        put && put.id === 'c9' && put.body.lesson && put.body.lesson.challengeIds.length === 4 && put.body.pages[0].text === text0,
        JSON.stringify(put && { lesson: put.body.lesson, pages: put.body.pages }),
    );

    // 5. A page the teacher wrote: asked in the page on close.
    await backToBoard();
    await openDescription('c1');
    await page.locator(tid('classroom-lesson-toggle')).click();
    await page.selectOption(tid('classroom-lesson-course'), 'kyou-kara-programmer');
    await page.locator(tid('classroom-lesson-lesson-blocks-l2')).click();
    await page.waitForTimeout(200);
    record('teacher page untouched while choosing', (await pageText()) === 'きょうは自由にプログラムを作ろう。');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const question = await page.$(tid('classroom-lesson-description-question'));
    record('question shown on close', !!question, question ? await text('classroom-lesson-description-question') : '');
    m = await measure();
    record('question shown: R6', r6(m), describe(m));
    await shot('description-question', '0257-detail-lesson-description-question.png');
    await page.locator(tid('classroom-lesson-description-no')).click();
    await page.waitForTimeout(200);
    record(
        '［いいえ］ keeps the page',
        (await pageText()) === 'きょうは自由にプログラムを作ろう。' && !(await page.$(tid('classroom-lesson-description-question'))),
    );
    await page.locator(tid('classroom-lesson-toggle')).click();
    await page.locator(tid('classroom-lesson-required-blocks-l1-if')).click();
    await page.locator(tid('classroom-lesson-close')).click();
    await page.waitForTimeout(300);
    await page.locator(tid('classroom-lesson-description-yes')).click();
    await page.waitForTimeout(200);
    text0 = await pageText();
    record('［はい］ overwrites page 1', text0.startsWith('「きょうからプログラマー」') && text0.includes('★'), JSON.stringify(text0));
} catch (e) {
    record('script', false, e.stack);
    await shot('error');
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
