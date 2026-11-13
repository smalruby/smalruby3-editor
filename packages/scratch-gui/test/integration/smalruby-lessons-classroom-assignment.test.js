/**
 * Integration tests for lessons in classroom assignments (stage 2, EPIC #1592 / #1604).
 *
 * Student: join a lesson assignment (join code → seat) → 「はじめる」 → the lessons library
 * shows only the assignment's challenges with the assignment band → a completion that does
 * not clear the assignment shows 「できた！」 → the completion that meets the condition shows
 * 「課題クリア！」 → the class screen row says cleared → the menu bar mark is ✓.
 * Teacher: the 「レッスン」 field of the assignment's description tab shows its summary.
 *
 * The classroom API is not used: `window.fetch` is replaced with a stub for the
 * classroom paths, and the challenges are completed through the debug hook
 * `window.smalruby.lessonGoal` (like smalruby-lessons-next-challenge.test.js).
 *
 * The classroom menu (the student 「クラス」 button with the lesson mark, and the teacher
 * 「クラス管理」 menu) is only rendered when the build has CLASSROOM_API_ENDPOINT; CI builds
 * with a dummy endpoint (.github/workflows/ci-cd.yml) so both are always checked.
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { getDriver, loadUri } = seleniumHelper;

const uri = `${path.resolve(__dirname, '../../build/index.html')}?no_beforeunload=1`;

// The assignment: 3 challenges of lesson 1 (not 「くり返そう」), ★ on 「押したら話そう」, condition 2.
const CHALLENGES = ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say'];
const REQUIRED = 'blocks-l1-click-say';
const LESSON = {
    courseId: 'kyou-kara-programmer',
    challengeIds: CHALLENGES,
    requiredChallengeIds: [REQUIRED],
    completion: { type: 'count', count: 2 },
    submitWork: false,
    scoring: null,
};

let driver;

const byTestId = (testId) => `[data-testid="${testId}"]`;

// findElements (not findElement): a missing element must keep the wait going, not throw.
const waitForTestId = (testId, message, timeout = 10000) =>
    driver.wait(
        async () => (await driver.findElements({ css: byTestId(testId) }))[0],
        timeout,
        message || `${testId} did not appear`,
    );

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('${byTestId(testId)}').click();`);

const textByTestId = (testId) =>
    driver.executeScript(`return document.querySelector('${byTestId(testId)}').textContent;`);

const countByTestId = (testId) =>
    driver.executeScript(`return document.querySelectorAll('${byTestId(testId)}').length;`);

const waitForLessonGoalHook = () =>
    driver.wait(
        () =>
            driver.executeScript(
                'return Boolean(window.smalruby && window.smalruby.vm && window.smalruby.lessonGoal);',
            ),
        20000,
        'window.smalruby.lessonGoal did not become available',
    );

// Find the redux store through the React root (there is no global for it).
const exposeStore = () =>
    driver.executeScript(`
        if (window.__store) return true;
        const all = [document.body, ...document.body.querySelectorAll('*')];
        let root = null;
        for (const el of all) {
            const key = Object.keys(el).find(k => k.startsWith('__reactContainer'));
            if (key) { root = el[key]; break; }
        }
        const stack = [root && root.stateNode && root.stateNode.current];
        const seen = new WeakSet();
        while (stack.length && !window.__store) {
            const f = stack.pop();
            if (!f || seen.has(f)) continue;
            seen.add(f);
            const p = f.memoizedProps;
            if (p && p.store && p.store.dispatch) window.__store = p.store;
            else if (p && p.value && p.value.store && p.value.store.dispatch) window.__store = p.value.store;
            if (f.child) stack.push(f.child);
            if (f.sibling) stack.push(f.sibling);
        }
        return Boolean(window.__store);`);

// Replace fetch for the classroom API paths (lookup → join → assignment → progress, and
// the teacher's lists). Every call is kept in window.__classroomCalls.
const installClassroomStub = (lesson) =>
    driver.executeScript(
        `
        const lesson = arguments[0];
        const day = 24 * 60 * 60 * 1000;
        const iso = ms => new Date(ms).toISOString();
        const classroom = {
            classroomId: 'c1', className: '技術', assignmentName: 'レッスンの課題', joinCode: 'abc234',
            studentCount: 5, googleClassroomCourseId: null, coTeacherEmails: [], groupId: 'g1', topic: null,
            hasAssignment: true, hasLesson: true, status: 'active', role: 'owner',
            createdAt: iso(Date.now() - 10 * day), expiresAt: iso(Date.now() + 80 * day),
            sortDate: iso(Date.now() - 2 * day), meshGroupLimit: 6
        };
        const routes = [
            [/\\/notifications/, () => ({notifications: [], unreadCount: 0})],
            [/\\/kick-requests/, () => ({requests: []})],
            [/\\/classroom-groups\\/migrate$/, () => ({migrated: 0})],
            [/\\/classroom-groups$/, () => ({groups: [{groupId: 'g1', name: '技術', year: 2026, section: '2年1組',
                status: 'active', schemaVersion: 2, topics: []}]})],
            [/\\/classrooms\\/lookup$/, () => ({className: '技術', assignmentName: 'レッスンの課題', studentCount: 5,
                takenSeats: []})],
            [/\\/classrooms\\/join$/, () => ({classroomId: 'c1', className: '技術', assignmentName: 'レッスンの課題',
                seatNumber: 3, memberId: 'm3', sessionToken: 'session-stub', genai: null})],
            [/\\/classrooms\\/verify-session$/, () => ({hasAssignment: true, genai: null})],
            [/\\/continuable-submissions$/, () => ({submissions: []})],
            [/\\/peer-submissions$/, () => ({submissions: []})],
            [/\\/assignment$/, () => ({assignment: {pages: []}, lesson})],
            [/\\/lesson-progress$/, () => ({lesson, progress: []})],
            [/\\/members$/, () => ({members: []})],
            [/\\/submissions$/, () => ({submissions: []})],
            [/\\/classrooms\\/c1$/, () => classroom],
            [/\\/classrooms(\\?.*)?$/, () => ({classrooms: [classroom]})]
        ];
        window.__classroomCalls = [];
        const original = window.__originalFetch || window.fetch;
        window.__originalFetch = original;
        window.fetch = (url, options) => {
            const href = String(url && url.url ? url.url : url);
            const route = routes.find(([re]) => re.test(href.split('#')[0]));
            if (!route) return original(url, options);
            const method = (options && options.method) || 'GET';
            window.__classroomCalls.push(method + ' ' + href.replace(/^https?:\\/\\/[^/]+/, ''));
            return Promise.resolve(new Response(JSON.stringify(route[1]()), {
                status: 200,
                headers: {'Content-Type': 'application/json'}
            }));
        };
        `,
        lesson,
    );

describe('Lessons in classroom assignments (stage 2)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('student: はじめる → only the assignment challenges → 課題クリア！ → cleared mark', async () => {
        await loadUri(uri);
        await waitForLessonGoalHook();
        await driver.executeScript(`
            window.localStorage.removeItem('smalruby:lessonProgress');
            window.localStorage.removeItem('smalruby:classroom');`);
        await installClassroomStub(LESSON);
        expect(await exposeStore()).toBe(true);

        // Join with the code and seat 3 (the 「クラス」 modal opened as the menu button does).
        await driver.executeScript(`window.__store.dispatch({type: 'scratch-gui/classroom/OPEN_MODAL'});`);
        const input = await waitForTestId('classroom-join-code-input');
        await input.sendKeys('abc234');
        await clickByTestId('classroom-join-submit');
        await waitForTestId('classroom-seat-3');
        await clickByTestId('classroom-seat-3');
        await waitForTestId('classroom-confirm-seat');
        await clickByTestId('classroom-confirm-seat');

        // 「はじめる」 of a lesson assignment (no records on this device, so no confirmation).
        await waitForTestId('classroom-joined-start-lesson', 'the lesson start button did not appear', 15000);
        await driver.sleep(500);
        await clickByTestId('classroom-joined-start-lesson');
        await waitForTestId('lessons-library');
        await waitForTestId('lesson-assignment-band');
        const shown = await driver.executeScript(`
            return [...document.querySelectorAll('[data-testid^="lessons-library-challenge-blocks"]')]
                .map(el => el.getAttribute('data-testid').replace('lessons-library-challenge-', ''));`);
        expect(shown).toEqual(CHALLENGES);
        expect(await textByTestId('lesson-assignment-band-name')).toContain('レッスンの課題');
        expect(await countByTestId('lesson-progress-confirm')).toBe(0);
        // ★ only on the required one
        expect(
            await driver.executeScript(
                `return document.querySelector('[data-testid="lessons-library-challenge-${REQUIRED}"]')
                    .querySelectorAll('[data-testid="lessons-library-challenge-required"]').length;`,
            ),
        ).toBe(1);

        // 1 of 2 (not the ★ one): an ordinary 「できた！」.
        await clickByTestId(`lessons-library-challenge-${CHALLENGES[0]}`);
        await waitForTestId('lesson-task-bar');
        await driver.executeScript(`window.smalruby.lessonGoal.markCompleted(arguments[0]);`, CHALLENGES[0]);
        await waitForTestId('lesson-completed-toast');
        expect(await textByTestId('lesson-completed-toast-title')).toBe('You did it!');
        await clickByTestId('lesson-completed-toast-close');

        // 2 of 2 with the ★ one: 「課題クリア！」 (no submit button: the work is not submitted).
        await driver.executeScript(`window.smalruby.lessonGoal.openChallenge(arguments[0]);`, REQUIRED);
        await driver.executeScript(`window.smalruby.lessonGoal.markCompleted(arguments[0]);`, REQUIRED);
        await driver.wait(
            async () =>
                (await countByTestId('lesson-completed-toast')) > 0 &&
                (await textByTestId('lesson-completed-toast-title')) === 'Assignment cleared!',
            10000,
            'the assignment cleared toast did not appear',
        );
        expect(await countByTestId('lesson-completed-toast-submit')).toBe(0);
        await clickByTestId('lesson-completed-toast-close');

        // The progress is sent to the class (one PUT per send, stubbed).
        await driver.wait(
            () =>
                driver.executeScript(
                    `return window.__classroomCalls.some(c => c.startsWith('PUT /classrooms/c1/lesson-progress'));`,
                ),
            10000,
            'the lesson progress was not sent',
        );

        // The class screen: 「進み具合」 row says cleared.
        await driver.executeScript(`window.__store.dispatch({type: 'scratch-gui/classroom/OPEN_MODAL'});`);
        await waitForTestId('classroom-status-lesson-progress');
        await waitForTestId('lesson-assignment-cleared');
        expect(await countByTestId('classroom-submit-button')).toBe(0);

        // The menu bar mark.
        const mark = await waitForTestId('classroom-menu-lesson-mark');
        expect(await mark.getAttribute('data-kind')).toBe('cleared');
    });

    test('teacher: the lesson field of the description tab shows the summary', async () => {
        await loadUri(`${uri}&devlogin=stub-token`);
        await waitForLessonGoalHook();
        await installClassroomStub(LESSON);
        await waitForTestId('classroom-teacher-menu-button', 'the teacher menu did not appear', 15000);
        await clickByTestId('classroom-teacher-menu-button');
        await waitForTestId('classroom-teacher-menu-class-list');
        await clickByTestId('classroom-teacher-menu-class-list');
        await waitForTestId('classroom-class-open-g1', 'the class card did not appear', 15000);
        await clickByTestId('classroom-class-open-g1');
        await waitForTestId('classroom-board-tab-classwork', 'the class screen did not appear', 15000);
        await clickByTestId('classroom-board-tab-classwork');
        await waitForTestId('classroom-board-row-toggle-c1');
        await clickByTestId('classroom-board-row-toggle-c1');
        await waitForTestId('classroom-board-open-c1');
        await clickByTestId('classroom-board-open-c1');
        await waitForTestId('classroom-tab-description', 'the assignment detail did not appear', 15000);
        await clickByTestId('classroom-tab-description');
        await waitForTestId('classroom-lesson-settings');
        await driver.wait(
            async () => (await textByTestId('classroom-lesson-summary')).includes('3'),
            10000,
            'the lesson summary was not filled',
        );
        const summary = await textByTestId('classroom-lesson-summary');
        // 3 challenges, ★ 1, condition 2 (the words follow the locale; check the numbers)
        expect(summary).toMatch(/3/);
        expect(summary).toMatch(/2/);
        // Open the field: the course and the 3 chosen challenges with the ★.
        await clickByTestId('classroom-lesson-toggle');
        await waitForTestId('classroom-lesson-course');
        const chosen = await driver.executeScript(`
            return [...document.querySelectorAll('[data-testid^="classroom-lesson-challenge-"]')]
                .filter(el => el.checked).map(el => el.value);`);
        expect(chosen).toEqual(CHALLENGES);
        expect(
            await driver.executeScript(
                `return document.querySelector('[data-testid="classroom-lesson-course"]').value;`,
            ),
        ).toBe(LESSON.courseId);
    });
});
