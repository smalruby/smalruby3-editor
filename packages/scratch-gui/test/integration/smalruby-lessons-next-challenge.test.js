/**
 * Integration tests for "Next challenge" on the "You did it!" toast (#1520).
 *
 * Completing a challenge shows the toast with a "Next challenge" button. Pressing it opens
 * the lessons library at the current lesson (scrolled to it) with the next challenge not
 * done yet marked. Only when every challenge of the lesson is done the toast says the lesson
 * is over, and the button points to the other lessons (or to the lessons library when there
 * is no next lesson). Finishing the last challenge after skipping some keeps "Next challenge".
 * The course has 3 lessons (#1529), so finishing lesson 1 moves to lesson 2, and finishing the
 * last lesson goes back to the lessons library.
 *
 * The challenge is opened and completed through the debug hook `window.smalruby.lessonGoal`
 * (like lesson-goal.test.js) so that the test only covers the toast and the library.
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { getDriver, loadUri } = seleniumHelper;

const uri = `${path.resolve(__dirname, '../../build/index.html')}?no_beforeunload=1`;

// レッスン 1（うごかしてみよう）・レッスン 3（おぼえて つたえよう）のチャレンジ
const LESSON1 = ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say', 'blocks-l1-repeat'];
const LESSON3 = ['blocks-l1-count', 'blocks-l1-broadcast', 'blocks-l1-speak', 'blocks-l1-message-list'];
const [FIRST, SECOND] = LESSON1;
const LAST = LESSON1[LESSON1.length - 1];
// レッスン 2 の最初
const LESSON2_FIRST = 'blocks-l1-if';

let driver;

const byTestId = (testId) => `[data-testid="${testId}"]`;

const waitForTestId = (testId, message) =>
    driver.wait(() => driver.findElement({ css: byTestId(testId) }), 10000, message || `${testId} did not appear`);

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('${byTestId(testId)}').click();`);

const waitForLessonGoalHook = () =>
    driver.wait(
        () =>
            driver.executeScript(
                'return Boolean(window.smalruby && window.smalruby.vm && window.smalruby.lessonGoal);',
            ),
        20000,
        'window.smalruby.lessonGoal did not become available',
    );

// Open and complete a challenge through the debug hook, then wait for the toast.
const completeChallenge = async (challengeId) => {
    await driver.executeScript(`window.smalruby.lessonGoal.openChallenge(arguments[0]);`, challengeId);
    await driver.executeScript(`window.smalruby.lessonGoal.markCompleted(arguments[0]);`, challengeId);
    await waitForTestId('lesson-completed-toast');
};

describe('Lessons: "Next challenge" on the completed toast', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('opens the library at the current lesson and marks the next challenge', async () => {
        await loadUri(uri);
        await waitForLessonGoalHook();
        await driver.executeScript(`window.localStorage.removeItem('smalruby:lessonProgress');`);
        await completeChallenge(FIRST);

        const next = await waitForTestId('lesson-completed-toast-next');
        expect(await next.getText()).toBe('Next challenge');
        expect(await next.getAttribute('data-action')).toBe('next');
        expect(await driver.findElements({ css: byTestId('lesson-completed-toast-detail') })).toHaveLength(0);
        expect(await (await driver.findElement({ css: byTestId('lesson-completed-toast-title') })).getText()).toBe(
            'You did it!',
        );
        // Lesson 1 has 4 challenges and only the first one is done
        expect(
            await (await driver.findElement({ css: byTestId('lesson-completed-toast-remaining') })).getText(),
        ).toBe('3 more in this lesson');
        const dots = await driver.executeScript(
            `return Array.from(document.querySelectorAll('[data-testid="lesson-completed-toast-dot"]'))
                .map((d) => d.dataset.completed + '/' + d.dataset.current);`,
        );
        expect(dots).toEqual(['true/true', 'false/false', 'false/false', 'false/false']);
        expect(await (await driver.findElement({ css: byTestId('lesson-completed-toast-close') })).getText()).toBe(
            'Keep looking',
        );

        await clickByTestId('lesson-completed-toast-next');
        await waitForTestId('lessons-library', 'the lessons library did not open');
        // The toast is closed when the library opens
        expect(await driver.findElements({ css: byTestId('lesson-completed-toast') })).toHaveLength(0);

        const lesson = await driver.findElement({ css: byTestId('lessons-library-lesson-blocks-l1') });
        expect(await lesson.getAttribute('data-focused')).toBe('true');
        const marked = await driver.findElements({ css: '[data-next="true"]' });
        expect(marked).toHaveLength(1);
        expect(await marked[0].getAttribute('data-testid')).toBe(`lessons-library-challenge-${SECOND}`);
        expect(await marked[0].getText()).toContain('Next!');

        // Choosing the marked challenge starts it (the library closes)
        await clickByTestId(`lessons-library-challenge-${SECOND}`);
        await driver.wait(
            async () => (await driver.findElements({ css: byTestId('lessons-library') })).length === 0,
            10000,
            'the lessons library did not close',
        );
        await driver.wait(
            () => driver.executeScript(`return Boolean(document.querySelector('[data-testid="lesson-task-bar"]'));`),
            20000,
            'the next challenge did not open',
        );
        await driver.executeScript(`window.smalruby.lessonGoal.closeLesson();`);
    });

    // Start from an empty record: the record is read when the page loads
    const loadWithEmptyRecord = async () => {
        await loadUri(uri);
        await waitForLessonGoalHook();
        await driver.executeScript(`window.localStorage.removeItem('smalruby:lessonProgress');`);
        await loadUri(uri);
        await waitForLessonGoalHook();
    };

    test('on the last challenge with others not done, keeps "Next challenge"', async () => {
        await loadWithEmptyRecord();
        await completeChallenge(LAST);

        const next = await waitForTestId('lesson-completed-toast-next');
        expect(await next.getText()).toBe('Next challenge');
        expect(await next.getAttribute('data-action')).toBe('next');
        expect(await driver.findElements({ css: byTestId('lesson-completed-toast-detail') })).toHaveLength(0);

        await clickByTestId('lesson-completed-toast-next');
        await waitForTestId('lessons-library', 'the lessons library did not open');
        const marked = await driver.findElements({ css: '[data-next="true"]' });
        expect(marked).toHaveLength(1);
        // Wraps around to the first challenge not done in the lesson
        expect(await marked[0].getAttribute('data-testid')).toBe(`lessons-library-challenge-${FIRST}`);
    });

    // Mark every challenge of the lesson done, the toast being for `openId` (not the last in the order)
    const completeLesson = async (ids, openId) => {
        await driver.executeScript(`window.smalruby.lessonGoal.openChallenge(arguments[0]);`, openId);
        for (const id of ids) {
            await driver.executeScript(`window.smalruby.lessonGoal.markCompleted(arguments[0]);`, id);
        }
        await driver.executeScript(`window.smalruby.lessonGoal.markCompleted(arguments[0]);`, openId);
        await waitForTestId('lesson-completed-toast');
    };

    test('when every challenge of lesson 1 is done, points to the other lessons and opens lesson 2', async () => {
        await loadWithEmptyRecord();
        await completeLesson(LESSON1, SECOND);

        const title = await waitForTestId('lesson-completed-toast-title');
        expect(await title.getText()).toBe('Lesson 1 complete!');
        const detail = await driver.findElement({ css: byTestId('lesson-completed-toast-detail') });
        expect(await detail.getText()).toBe(`You finished all ${LESSON1.length} challenges of "Let's Move".`);
        const next = await driver.findElement({ css: byTestId('lesson-completed-toast-next') });
        expect(await next.getText()).toBe('Next lesson');
        expect(await next.getAttribute('data-action')).toBe('otherLessons');

        await clickByTestId('lesson-completed-toast-next');
        await waitForTestId('lessons-library', 'the lessons library did not open');
        const lesson2 = await driver.findElement({ css: byTestId('lessons-library-lesson-blocks-l2') });
        expect(await lesson2.getAttribute('data-focused')).toBe('true');
        const lesson1 = await driver.findElement({ css: byTestId('lessons-library-lesson-blocks-l1') });
        expect(await lesson1.getAttribute('data-focused')).toBe('false');
        const marked = await driver.findElements({ css: '[data-next="true"]' });
        expect(marked).toHaveLength(1);
        expect(await marked[0].getAttribute('data-testid')).toBe(`lessons-library-challenge-${LESSON2_FIRST}`);
    });

    test('when every challenge of the last lesson is done, points to the lessons library', async () => {
        await loadWithEmptyRecord();
        await completeLesson(LESSON3, LESSON3[1]);

        // レッスン 1・2 はまだなので「これで全部です」とは言わず、レッスン名の行にする（ボタンはレッスン表へ）
        const detail = await waitForTestId('lesson-completed-toast-detail');
        expect(await detail.getText()).toBe('You finished all 4 challenges of "Remember and Tell".');
        expect(await (await driver.findElement({ css: byTestId('lesson-completed-toast-title') })).getText()).toBe(
            'Lesson 3 complete!',
        );
        const next = await driver.findElement({ css: byTestId('lesson-completed-toast-next') });
        expect(await next.getText()).toBe('Go to the lessons');
        expect(await next.getAttribute('data-action')).toBe('library');

        await clickByTestId('lesson-completed-toast-next');
        await waitForTestId('lessons-library', 'the lessons library did not open');
        const lesson = await driver.findElement({ css: byTestId('lessons-library-lesson-blocks-l3') });
        expect(await lesson.getAttribute('data-focused')).toBe('true');
        expect(await driver.findElements({ css: '[data-next="true"]' })).toHaveLength(0);
    });
});
