/**
 * Integration tests for "Next challenge" on the "You did it!" toast (#1520).
 *
 * Completing a challenge shows the toast with a "Next challenge" button. Pressing it opens
 * the lessons library at the current lesson (scrolled to it) with the next challenge not
 * done yet marked. Only when every challenge of the lesson is done the toast says the lesson
 * is over, and the button points to the other lessons (or to the lessons library when there
 * is no next lesson). Finishing the last challenge after skipping some keeps "Next challenge".
 *
 * The challenge is opened and completed through the debug hook `window.smalruby.lessonGoal`
 * (like lesson-goal.test.js) so that the test only covers the toast and the library.
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { getDriver, loadUri } = seleniumHelper;

const uri = `${path.resolve(__dirname, '../../build/index.html')}?no_beforeunload=1`;

const FIRST = 'blocks-l1-key-sound';
const SECOND = 'blocks-l1-arrow-move';
const LAST = 'blocks-l1-message-list';
const ALL = [
    'blocks-l1-key-sound',
    'blocks-l1-arrow-move',
    'blocks-l1-click-say',
    'blocks-l1-repeat',
    'blocks-l1-if',
    'blocks-l1-ask-answer',
    'blocks-l1-quiz',
    'blocks-l1-count',
    'blocks-l1-broadcast',
    'blocks-l1-speak',
    LAST,
];

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
        expect(await driver.findElements({ css: byTestId('lesson-completed-toast-last') })).toHaveLength(0);

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
        expect(await driver.findElements({ css: byTestId('lesson-completed-toast-last') })).toHaveLength(0);

        await clickByTestId('lesson-completed-toast-next');
        await waitForTestId('lessons-library', 'the lessons library did not open');
        const marked = await driver.findElements({ css: '[data-next="true"]' });
        expect(marked).toHaveLength(1);
        // Wraps around to the first challenge not done in the lesson
        expect(await marked[0].getAttribute('data-testid')).toBe(`lessons-library-challenge-${FIRST}`);
    });

    test('when every challenge is done, says the lesson is over and points to the lessons library', async () => {
        await loadWithEmptyRecord();
        await driver.executeScript(`window.smalruby.lessonGoal.openChallenge(arguments[0]);`, ALL[3]);
        for (const id of ALL) {
            await driver.executeScript(`window.smalruby.lessonGoal.markCompleted(arguments[0]);`, id);
        }
        // The toast is for the open challenge (not the last one in the order)
        await driver.executeScript(`window.smalruby.lessonGoal.markCompleted(arguments[0]);`, ALL[3]);
        await waitForTestId('lesson-completed-toast');

        const last = await waitForTestId('lesson-completed-toast-last');
        expect(await last.getText()).toBe('You have done every challenge of this lesson.');
        const next = await driver.findElement({ css: byTestId('lesson-completed-toast-next') });
        // There is only lesson 1 yet: no next lesson
        expect(await next.getText()).toBe('Go to the lessons');
        expect(await next.getAttribute('data-action')).toBe('library');

        await clickByTestId('lesson-completed-toast-next');
        await waitForTestId('lessons-library', 'the lessons library did not open');
        const lesson = await driver.findElement({ css: byTestId('lessons-library-lesson-blocks-l1') });
        expect(await lesson.getAttribute('data-focused')).toBe('true');
        expect(await driver.findElements({ css: '[data-next="true"]' })).toHaveLength(0);
    });
});
