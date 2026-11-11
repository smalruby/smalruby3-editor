/**
 * Integration test for clearing lesson 1 (ブロックのなかま) as a whole.
 * レッスン表から 11 個のチャレンジがすべて開ける → 必須 5 つ（3・6・8・9・11）+ 2 つ（7・10）を
 * 「プログラムを入れる」→ 操作 →「できた！」→ レッスン表に「クリア！」とコースの印
 * 「プログラマー デビュー！」が出て、できたチャレンジの「できること」に印が付く（1300×600）。
 * 1 つずつの細かい確かめは smalruby-lesson1-challenges-*.test.js。
 */
import path from 'path';
import { Key, Origin } from 'selenium-webdriver';
import { COURSES } from '../../src/lib/lessons/courses';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const PROGRESS_KEY = 'smalruby:lessonProgress';
const LESSON = COURSES[0].lessons[0];

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

let driver;

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const textByTestId = (testId) =>
    driver.executeScript(`return document.querySelector('[data-testid="${testId}"]').textContent`);

const countByTestId = (testId) =>
    driver.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

// ステージの真ん中（ネコ）を画面の座標で押す（smalruby-lesson1-challenges-9-11.test.js と同じ理由）
const clickCat = async () => {
    const { x, y } = await driver.executeScript(`
        const rect = document.querySelector('[class*="stage_stage-wrapper_"] canvas').getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };`);
    await driver.actions().move({ origin: Origin.VIEWPORT, x, y }).press().release().perform();
};

const clickGreenFlag = () => driver.findElement({ css: '[class*="green-flag_green-flag_"]' }).click();

const answerQuestion = async (text) => {
    const input = await driver.wait(
        async () => {
            const inputs = await driver.findElements({ css: '[class*="question_question-input_"] input' });
            return inputs.length > 0 ? inputs[0] : null;
        },
        10000,
        'the question input did not appear',
    );
    await input.sendKeys(text, Key.ENTER);
    // 「聞いて待つ」の入力らんが消えるのを待つ（次の質問とまちがえない）
    await driver.sleep(300);
};

const openLibrary = async () => {
    await clickByTestId('menu-bar-lessons');
    await findByXpath(byTestId('lessons-library'));
};

// レッスン表からチャレンジを開く
const openFromLibrary = async (challengeId) => {
    await openLibrary();
    await clickByTestId(`lessons-library-challenge-${challengeId}`);
    await findByXpath(byTestId('lesson-task-bar'));
    await driver.sleep(1000);
};

// ヒントを最後のページまで進めて「プログラムを入れる」
const insertCode = async (hatOpcode) => {
    await clickByTestId('lesson-task-bar-hint');
    await findByXpath(byTestId('lesson-hint'));
    for (let i = 0; i < 10 && (await countByTestId('lesson-hint-insert-code')) === 0; i++) {
        await clickByTestId('lesson-hint-next');
    }
    await clickByTestId('lesson-hint-insert-code');
    await driver.wait(
        async () =>
            driver.executeScript(
                `return Object.values(window.smalruby.vm.editingTarget.blocks._blocks)
                    .some(b => b.opcode === ${JSON.stringify(hatOpcode)});`,
            ),
        20000,
        'the program was not inserted',
    );
    await driver.sleep(500);
};

const waitForCompleted = async () => {
    await driver.wait(
        async () => (await countByTestId('lesson-completed-toast')) > 0,
        20000,
        'the completed toast did not appear',
    );
    return textByTestId('lesson-completed-toast-challenge');
};

// 必須 5 つ + 2 つ。準備（insertCode の前）と操作（後）
const PLAYS = [
    {
        id: 'blocks-l1-click-say',
        before: () => driver.executeScript('return window.smalruby.vm.duplicateCostume(0);'),
        hat: 'event_whenthisspriteclicked',
        play: clickCat,
    },
    {
        id: 'blocks-l1-ask-answer',
        hat: 'event_whenthisspriteclicked',
        play: async () => {
            await clickCat();
            await answerQuestion('たろう');
        },
    },
    {
        id: 'blocks-l1-quiz',
        hat: 'event_whenthisspriteclicked',
        play: async () => {
            await clickCat();
            await answerQuestion('7');
            await driver.sleep(2500);
            await clickCat();
            await answerQuestion('5');
        },
    },
    {
        id: 'blocks-l1-count',
        hat: 'event_whenthisspriteclicked',
        play: async () => {
            await clickGreenFlag();
            await driver.sleep(500);
            for (let i = 0; i < 3; i++) {
                await clickCat();
                await driver.sleep(300);
            }
        },
    },
    {
        id: 'blocks-l1-broadcast',
        hat: 'event_whenthisspriteclicked',
        play: clickCat,
    },
    {
        id: 'blocks-l1-speak',
        hat: 'event_whenthisspriteclicked',
        play: clickCat,
    },
    {
        id: 'blocks-l1-message-list',
        hat: 'event_whenthisspriteclicked',
        play: async () => {
            await clickGreenFlag();
            await driver.sleep(500);
            for (const text of ['こんにちは', 'げんき？', 'またね']) {
                await clickCat();
                await answerQuestion(text);
            }
        },
    },
];

describe('Smalruby Lessons: clearing lesson 1', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('all 11 challenges open from the library; 5 required + 2 clear the lesson and the course', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await driver.manage().window().setRect({ width: 1300, height: 600 });
        await waitForLoadingFinished();
        await driver.executeScript(`window.localStorage.removeItem(${JSON.stringify(PROGRESS_KEY)})`);

        // 11 個とも、レッスン表から開ける（課題バーの「何個め」と課題の 1 行）
        expect(LESSON.challenges).toHaveLength(11);
        // （やめると、開いたときのレッスン表にもどる）
        await openLibrary();
        for (const challenge of LESSON.challenges) {
            await clickByTestId(`lessons-library-challenge-${challenge.id}`);
            await findByXpath(byTestId('lesson-task-bar'));
            await driver.sleep(1000);
            expect(await textByTestId('lesson-task-bar-position')).toBe(`${challenge.number} of 11`);
            expect((await textByTestId('lesson-task-bar-task')).length).toBeGreaterThan(0);
            await clickByTestId('lesson-task-bar-quit');
            await findByXpath(byTestId('lessons-library'));
            await driver.sleep(300);
        }

        // 必須 5 つ + 2 つを「できた」にする
        expect(PLAYS.filter((p) => LESSON.clear.required.includes(p.id))).toHaveLength(LESSON.clear.required.length);
        expect(PLAYS).toHaveLength(LESSON.clear.count);
        for (const play of PLAYS) {
            await driver.navigate().refresh();
            await waitForLoadingFinished();
            await openFromLibrary(play.id);
            if (play.before) await play.before();
            await insertCode(play.hat);
            await play.play();
            await waitForCompleted();
        }

        // レッスン表: 7 つできた・必須 5 / 5・クリア！・コースの印・できることの印
        await driver.navigate().refresh();
        await waitForLoadingFinished();
        await openLibrary();
        expect(await textByTestId('lessons-library-progress')).toBe('7 / 11 done (required 5 / 5)');
        expect(await countByTestId('lessons-library-challenge-done')).toBe(7);
        expect(await textByTestId('lessons-library-lesson-cleared')).toBe('Cleared!');
        expect(await textByTestId('lessons-library-badge')).toContain('Programmer Debut!');
        const done = new Set(
            LESSON.challenges.filter((c) => PLAYS.some((p) => p.id === c.id)).flatMap((c) => c.skills.map((s) => s.id)),
        );
        const marks = await driver.executeScript(`
            return Array.from(document.querySelectorAll('[data-testid^="lessons-library-skill-"]'))
                .map(li => [li.getAttribute('data-testid').replace('lessons-library-skill-', ''), li.dataset.done]);`);
        expect(marks.length).toBeGreaterThan(0);
        marks.forEach(([id, mark]) => expect([id, mark]).toEqual([id, done.has(id) ? 'true' : 'false']));
    });
});
