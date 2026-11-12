/**
 * Integration test for finishing the course 「きょうからプログラマー」 (3 lessons, 11 challenges).
 * レッスン表から 11 個のチャレンジがすべて開ける（課題バーの番号はレッスンの中の番号）→
 * レッスン 1・2 の 7 つは、11 のチャレンジが 1 つのレッスンだったころの記録（lessonId: 'blocks-l1'）
 * として入れておく → レッスン 3 の 4 つを「プログラムを入れる」→ 操作 →「できた！」→ レッスン表の
 * コースの進み具合（「n / 11」）が正しく出て、コースのチャレンジが全部できたら
 * コース名の前に ✓ が出る（1300×600）。必須・クリア・できることは段 1 から外した（#1529）。
 * 1 つずつの細かい確かめは smalruby-lesson1-challenges-*.test.js。
 */
import path from 'path';
import { Key, Origin } from 'selenium-webdriver';
import { COURSES } from '../../src/lib/lessons/courses';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const PROGRESS_KEY = 'smalruby:lessonProgress';
const COURSE = COURSES[0];
const LAST_LESSON = COURSE.lessons[COURSE.lessons.length - 1];

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

let driver;

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

// ヒントの吹き出しはチャレンジを始めると自動で開く。閉じているときだけ課題バーの「ヒント」で開き直す
const openHint = async () => {
    const open = await driver.executeScript(`return document.querySelectorAll('[data-testid="lesson-hint"]').length`);
    if (open === 0) await clickByTestId('lesson-task-bar-hint');
    await findByXpath('//*[@data-testid="lesson-hint"]');
};

// 最後のページの「正解のプログラムを確認する」→ 確認の「はい」（今までの「プログラムを入れる」と同じ動き）
const confirmInsertCode = async () => {
    await clickByTestId('lesson-hint-insert-code');
    await findByXpath('//*[@data-testid="lesson-hint-insert-code-yes"]');
    await clickByTestId('lesson-hint-insert-code-yes');
};

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
    await openHint();
    await findByXpath(byTestId('lesson-hint'));
    for (let i = 0; i < 10 && (await countByTestId('lesson-hint-insert-code')) === 0; i++) {
        await clickByTestId('lesson-hint-next');
    }
    await confirmInsertCode();
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
    // チャレンジの名前は出さない（課題バーに出ている）ので、できたチャレンジは data-challenge-id で見る
    return driver.executeScript(
        `return document.querySelector('[data-testid="lesson-completed-toast"]').getAttribute('data-challenge-id');`,
    );
};

// レッスン 3 の 4 つ。操作は insertCode の後
const PLAYS = [
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

// コースの見出しの「n / m」（コース全体の進み具合）
const courseProgressText = () => textByTestId('lessons-library-course-progress-text');

describe('Smalruby Lessons: finishing the course', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('all 11 challenges open from the library; old records and the last lesson finish the course', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await driver.manage().window().setRect({ width: 1300, height: 600 });
        await waitForLoadingFinished();
        await driver.executeScript(`window.localStorage.removeItem(${JSON.stringify(PROGRESS_KEY)})`);

        // 11 個とも、レッスン表から開ける（課題バーの「何個め / レッスンの数」と課題の 1 行）
        expect(COURSE.lessons.map((l) => l.challenges.length)).toEqual([4, 3, 4]);
        // （やめると、開いたときのレッスン表にもどる）
        await openLibrary();
        for (const lesson of COURSE.lessons) {
            for (const challenge of lesson.challenges) {
                await clickByTestId(`lessons-library-challenge-${challenge.id}`);
                await findByXpath(byTestId('lesson-task-bar'));
                await driver.sleep(1000);
                expect(await textByTestId('lesson-task-bar-position')).toBe(
                    `${challenge.number} of ${lesson.challenges.length}`,
                );
                expect((await textByTestId('lesson-task-bar-task')).length).toBeGreaterThan(0);
                await clickByTestId('lesson-task-bar-quit');
                await findByXpath(byTestId('lessons-library'));
                await driver.sleep(300);
            }
        }

        // レッスン 1・2 は、1 つのレッスンだったころの記録（lessonId はみな blocks-l1）
        const oldRecords = Object.fromEntries(
            COURSE.lessons
                .slice(0, 2)
                .flatMap((l) => l.challenges)
                .map((c) => [
                    c.id,
                    { completedAt: '2026-11-01T00:00:00.000Z', courseId: COURSE.id, lessonId: 'blocks-l1' },
                ]),
        );
        await driver.executeScript(
            `window.localStorage.setItem(${JSON.stringify(PROGRESS_KEY)}, arguments[0])`,
            JSON.stringify({ version: 1, challenges: oldRecords }),
        );
        await driver.navigate().refresh();
        await waitForLoadingFinished();
        await openLibrary();
        expect(await courseProgressText()).toBe('7 / 11');
        expect(await countByTestId('lessons-library-course-done')).toBe(0);
        // 必須・クリア・できること・コースの印（「プログラマー デビュー！」）の表示は無い
        expect(await countByTestId('lessons-library-badge')).toBe(0);
        expect(await countByTestId('lessons-library-challenge-required')).toBe(0);
        expect(await countByTestId('lessons-library-lesson-cleared')).toBe(0);
        expect(await countByTestId('lessons-library-skills')).toBe(0);

        // レッスン 3 の 4 つを「できた」にする。最後のレッスンなので、全部できたら「レッスン表へ」
        expect(PLAYS.map((p) => p.id)).toEqual(LAST_LESSON.challenges.map((c) => c.id));
        for (const [index, play] of PLAYS.entries()) {
            await driver.navigate().refresh();
            await waitForLoadingFinished();
            await openFromLibrary(play.id);
            await insertCode(play.hat);
            await play.play();
            await waitForCompleted();
            expect(
                await driver.executeScript(
                    `return document.querySelector('[data-testid="lesson-completed-toast-next"]').dataset.action`,
                ),
            ).toBe(index === PLAYS.length - 1 ? 'library' : 'next');
        }

        // レッスン表: 全部できた → コース名の前に ✓（「プログラマー デビュー！」は出さない）
        await driver.navigate().refresh();
        await waitForLoadingFinished();
        await openLibrary();
        expect(await courseProgressText()).toBe('11 / 11');
        expect(await countByTestId('lessons-library-challenge-done')).toBe(11);
        expect(await countByTestId('lessons-library-course-done')).toBe(1);
        expect(await countByTestId('lessons-library-badge')).toBe(0);
    });
});
