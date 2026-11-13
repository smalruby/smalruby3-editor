// The「レッスン」section of the assignment's description tab (EPIC #1592 / #1598)
// at the lesson PC size (1300x600). The classroom API is stubbed with
// page.route, so no login or stg data is needed — only the dev server.
//
// Checks: choosing a course / lessons / challenges / ★ / completion / submit /
// scoring, the PUT payload's `lesson`, the unsaved marks, the dropped-progress
// notice, an unknown course, and R6 (the save button bottom ≤ 600, the page
// and the modal body do not scroll, only the challenge list frame scrolls).
//
//   node verify-classroom-lesson-settings.mjs                 # headless, asserts
//   DOCS_SHOTS=1 node verify-classroom-lesson-settings.mjs    # + docs/classroom/screenshots
//   BASE=http://localhost:8611 node verify-classroom-lesson-settings.mjs
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
const classrooms = [
    assignment({ classroomId: 'c1', assignmentName: 'レッスンをやろう', joinCode: 'abc234' }),
    assignment({ classroomId: 'c2', assignmentName: '取り込んだ課題', joinCode: 'kx7p2m' }),
];
const savedLessons = {
    c1: null,
    c2: {
        courseId: 'old-course',
        challengeIds: ['old-1', 'old-2'],
        requiredChallengeIds: [],
        completion: { type: 'all' },
        submitWork: false,
        scoring: null,
    },
};
const puts = [];

const results = [];
const record = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
};

const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false', args: ['--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ja-JP' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
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
await page.route(/\/classrooms$/, (r) => r.fulfill({ json: { classrooms } }));
await page.route(/\/classrooms\/c\d$/, (r) => {
    const id = r.request().url().match(/\/classrooms\/(c\d)$/)[1];
    return r.fulfill({ json: classrooms.find((c) => c.classroomId === id) });
});
await page.route(/\/classrooms\/c\d\/members$/, (r) => r.fulfill({ json: { members: [] } }));
await page.route(/\/classrooms\/c\d\/submissions$/, (r) => r.fulfill({ json: { submissions: [] } }));
await page.route(/\/classrooms\/c\d\/assignment$/, (r) => {
    const id = r.request().url().match(/\/classrooms\/(c\d)\/assignment$/)[1];
    if (r.request().method() === 'PUT') {
        const body = r.request().postDataJSON();
        puts.push({ id, body });
        if (Object.prototype.hasOwnProperty.call(body, 'lesson')) savedLessons[id] = body.lesson;
        return r.fulfill({ json: { imageUploadUrls: [], starterUploadUrl: null, lesson: savedLessons[id] } });
    }
    return r.fulfill({
        json: { assignment: { pages: [{ text: 'レッスンを進めよう。' }] }, lesson: savedLessons[id] },
    });
});

const tid = (id) => `[data-testid="${id}"]`;
const shot = async (name, docsName) => {
    await page.screenshot({ path: resolve(SHOT_DIR, `issue-1598-${name}.png`) });
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

try {
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

    // 1. No lesson yet: folded, 1-line summary.
    await openDescription('c1');
    let m = await measure();
    record('folded: レッスンを使わない', (await text('classroom-lesson-summary')).includes('レッスンを使わない') && r6(m), describe(m));
    await shot('folded-none');

    // 2. Open, choose the course and lessons.
    await page.locator(tid('classroom-lesson-toggle')).click();
    await page.selectOption(tid('classroom-lesson-course'), 'kyou-kara-programmer');
    await page.waitForTimeout(200);
    const lessonBoxes = await page.$$('[data-testid^="classroom-lesson-lesson-"]');
    await lessonBoxes[0].click();
    await lessonBoxes[1].click();
    const challengeBoxes = await page.$$eval('[data-testid^="classroom-lesson-challenge-"]', (els) =>
        els.map((el) => ({ id: el.value, checked: el.checked })),
    );
    const chosen = challengeBoxes.filter((c) => c.checked).map((c) => c.id);
    record('lesson check adds all its challenges', chosen.length > 0, `chosen=${chosen.length}/${challengeBoxes.length}`);
    // Remove one, mark two required.
    await page.locator(tid(`classroom-lesson-challenge-${chosen[1]}`)).click();
    await page.locator(tid(`classroom-lesson-required-${chosen[0]}`)).click();
    await page.locator(tid(`classroom-lesson-required-${chosen[2]}`)).click();
    const firstLessonIndeterminate = await lessonBoxes[0].evaluate((el) => el.indeterminate);
    record('partly chosen lesson is indeterminate', firstLessonIndeterminate);
    await page.locator(tid('classroom-lesson-completion-count')).click();
    // M1 (#1765): typing "1" on the way to "10" is not clamped; it commits on Enter.
    await page.fill(tid('classroom-lesson-completion-count-value'), '1');
    const typing = await page.$eval(tid('classroom-lesson-completion-count-value'), (el) => el.value);
    record('typing is not clamped until commit', typing === '1', `value=${typing}`);
    await page.fill(tid('classroom-lesson-completion-count-value'), '3');
    await page.press(tid('classroom-lesson-completion-count-value'), 'Enter');
    await page.waitForTimeout(200);
    const selected = chosen.length - 1;
    const sentence = await text('classroom-lesson-sentence');
    record('completion sentence', sentence.includes(`${selected} つのうち 3 つ（★ 2 つをふくむ）`), sentence);
    await page.locator(tid('classroom-lesson-submit-yes')).click();
    m = await measure();
    record('panel open: R6', r6(m) && m.panelBottom <= m.vh, describe(m));
    await shot('panel-open', '0244-detail-lesson-settings.png');
    const unsaved = !!(await page.$(tid('classroom-lesson-unsaved')));
    record('unsaved mark', unsaved);

    // 3. Close (Escape), summary shows the current values.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const summary = await text('classroom-lesson-summary');
    record(
        'folded summary has current values',
        summary.includes('きょうからプログラマー') && summary.includes(`${selected} つ（★ 2）`) && summary.includes('条件: 3 つ'),
        summary,
    );
    const preview = await text('classroom-description-preview-lesson');
    record('student preview shows the lesson', preview.includes('★ 2 つをふくむ'), preview);

    // 4. Scoring in「詳しい設定」.
    await page.locator(tid('classroom-assignment-advanced-toggle')).click();
    await page.waitForTimeout(200);
    const each = await text('classroom-lesson-scoring-each');
    record('scoring: default 70 split', each.includes('必須 1 つ 35 点'), each);
    await page.fill(tid('classroom-lesson-scoring-total'), '50');
    await page.press(tid('classroom-lesson-scoring-total'), 'Enter');
    await page.waitForTimeout(200);
    m = await measure();
    record('advanced open with scoring: R6', r6(m), describe(m));
    await shot('advanced-scoring', '0245-detail-lesson-scoring.png');
    await page.keyboard.press('Escape');

    // 5. Save → PUT carries lesson.
    await page.locator(tid('classroom-assignment-save')).click();
    await page.waitForTimeout(1500);
    const put = puts.at(-1);
    const lesson = put && put.body.lesson;
    record(
        'PUT lesson payload',
        !!lesson &&
            lesson.courseId === 'kyou-kara-programmer' &&
            lesson.challengeIds.length === selected &&
            lesson.requiredChallengeIds.length === 2 &&
            lesson.completion.type === 'count' &&
            lesson.completion.count === 3 &&
            lesson.submitWork === true &&
            lesson.scoring.total === 50 &&
            lesson.scoring.requiredPoints === 35 &&
            lesson.scoring.optionalPoints === 15,
        JSON.stringify(lesson),
    );
    const unsavedAfter = !!(await page.$(tid('classroom-lesson-unsaved')));
    record('unsaved mark gone after save', !unsavedAfter);

    // 6. Removing a saved challenge shows the dropped-progress notice.
    await page.locator(tid('classroom-lesson-toggle')).click();
    await page.locator(tid(`classroom-lesson-challenge-${chosen[0]}`)).click();
    const notice = !!(await page.$(tid('classroom-lesson-dropped-notice')));
    record('dropped-progress notice', notice);
    // FYI3 (#1765): with the notice shown the panel still fits and nothing is clipped.
    m = await measure();
    const clip = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="classroom-lesson-panel"]').getBoundingClientRect();
        const n = document.querySelector('[data-testid="classroom-lesson-dropped-notice"]').getBoundingClientRect();
        return { notice: Math.round(n.bottom), panel: Math.round(panel.bottom) };
    });
    record(
        'panel open with dropped notice: R6, not clipped',
        r6(m) && m.panelBottom <= m.vh && clip.notice <= clip.panel,
        `${describe(m)} notice.bottom=${clip.notice}`,
    );
    await shot('panel-dropped-notice');
    await page.keyboard.press('Escape');

    // 7. Unknown course: warning, saving keeps it (no `lesson` sent).
    await backToBoard();
    await openDescription('c2');
    const warn = !!(await page.$(tid('classroom-lesson-unknown-course')));
    m = await measure();
    record('unknown course warning', warn && (await text('classroom-lesson-summary')).includes('見つからないコース') && r6(m), describe(m));
    await shot('unknown-course', '0246-detail-lesson-unknown-course.png');
    await page.locator(tid('classroom-assignment-save')).click();
    await page.waitForTimeout(1200);
    const put2 = puts.at(-1);
    record('unknown course kept (no lesson in PUT)', put2 && put2.id === 'c2' && !('lesson' in put2.body));
} catch (e) {
    record('script', false, e.stack);
    await shot('error');
} finally {
    await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
