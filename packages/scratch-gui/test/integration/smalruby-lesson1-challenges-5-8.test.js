/**
 * Integration tests for lesson 1 challenges 5-8 (もし〜なら / 聞いて答えよう / クイズを作ろう / 数えよう).
 * チャレンジを開く → ヒントを最後まで進めて「プログラムを入れる」→ 課題の操作（旗・マウス・ネコを押す・
 * 答えを入力する）→「できた！」の toast。
 *
 * チャレンジは子どもと同じく、メニューバーの「レッスン」→ レッスン表のチャレンジを押して開く。
 */
import path from 'path';
import { Key } from 'selenium-webdriver';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickBlocksCategory, clickButton, clickText, findByXpath, getDriver, loadUri, waitForLoadingFinished } =
    new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

let driver;

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const textByTestId = (testId) =>
    driver.executeScript(`return document.querySelector('[data-testid="${testId}"]').textContent`);

const editingTargetOpcodes = () =>
    driver.executeScript(`const blocks = window.smalruby.vm.editingTarget.blocks._blocks;
        return Object.values(blocks).filter(b => !b.shadow).map(b => b.opcode).sort();`);

const stageCanvas = () => driver.findElement({ css: '[class*="stage_stage-wrapper_"] canvas' });

// マウスをステージの上で動かす（x, y はステージの真ん中からのずれ。ネコは真ん中にいる）
const moveMouseOnStage = async (x, y) => {
    await driver
        .actions()
        .move({ origin: await stageCanvas(), x, y })
        .perform();
};

// ステージの真ん中（ネコ）を押す
const clickCat = async () => {
    await driver
        .actions()
        .move({ origin: await stageCanvas(), x: 0, y: 0 })
        .press()
        .release()
        .perform();
};

const clickGreenFlag = () => driver.findElement({ css: '[class*="green-flag_green-flag_"]' }).click();

// 「聞いて待つ」の入力らんに書いて Enter
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
};

const waitForCompletedToast = async () => {
    await driver.wait(
        async () => (await driver.findElements({ css: '[data-testid="lesson-completed-toast"]' })).length > 0,
        20000,
        'the completed toast did not appear',
    );
    return textByTestId('lesson-completed-toast-challenge');
};

const countCompletedToasts = async () =>
    (await driver.findElements({ css: '[data-testid="lesson-completed-toast"]' })).length;

// チャレンジを開いて、ヒントを最後まで進め、「プログラムを入れる」で code を入れる
const openChallengeAndInsertCode = async (challengeId, { hintCount, firstTarget, hatOpcode, beforeInsert }) => {
    await loadUri(`${uri}?no_beforeunload=1`);
    // 授業のパソコンの大きさ。既定の幅ではステージが画面の外にはみ出してネコを押せない
    await driver.manage().window().setRect({ width: 1300, height: 600 });
    await waitForLoadingFinished();
    await findByXpath(byTestId('menu-bar-lessons'));
    await clickByTestId('menu-bar-lessons');
    await findByXpath(byTestId(`lessons-library-challenge-${challengeId}`));
    await clickByTestId(`lessons-library-challenge-${challengeId}`);
    await findByXpath(byTestId('lesson-task-bar'));
    await driver.sleep(1000);

    await clickByTestId('lesson-task-bar-hint');
    await findByXpath(byTestId('lesson-hint'));
    expect(await textByTestId('lesson-hint-position')).toBe(`Hint 1 of ${hintCount}`);
    expect(
        await driver.executeScript(
            `return document.querySelector('[data-testid="lesson-hint"]').getAttribute('data-target')`,
        ),
    ).toBe(firstTarget);

    if (beforeInsert) {
        await clickByTestId('lesson-hint-close');
        await beforeInsert();
        await clickByTestId('lesson-task-bar-hint');
        await findByXpath(byTestId('lesson-hint'));
    }
    for (let i = 1; i < hintCount; i++) await clickByTestId('lesson-hint-next');
    expect(await textByTestId('lesson-hint-position')).toBe(`Hint ${hintCount} of ${hintCount}`);
    await clickByTestId('lesson-hint-insert-code');
    await driver.wait(
        async () => (await editingTargetOpcodes()).includes(hatOpcode),
        20000,
        'the program was not inserted',
    );
    await driver.sleep(500);
    expect(await countCompletedToasts()).toBe(0);
};

describe('Smalruby Lessons: lesson 1 challenges 5-8', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('5 もし〜なら: the line changes when the mouse touches the cat and leaves it', async () => {
        await openChallengeAndInsertCode('blocks-l1-if', {
            hintCount: 6,
            firstTarget: 'palette',
            hatOpcode: 'event_whenflagclicked',
        });
        expect(await editingTargetOpcodes()).toEqual([
            'control_forever',
            'control_if_else',
            'event_whenflagclicked',
            'looks_say',
            'looks_say',
            'sensing_touchingobject',
        ]);

        // マウスをネコからはなしたまま旗 →「さわってみて」だけでは「できた」にならない
        await moveMouseOnStage(-200, -150);
        await clickGreenFlag();
        await driver.sleep(1500);
        expect(await countCompletedToasts()).toBe(0);

        // ネコに重ねる →「くすぐったい！」も出たので「できた」
        await moveMouseOnStage(0, 0);
        expect(await waitForCompletedToast()).toBe('If ...');
        await driver.executeScript('window.smalruby.vm.stopAll();');
    });

    test('6 聞いて答えよう: clicking the cat, typing a name, and the answer and the seconds are said', async () => {
        await openChallengeAndInsertCode('blocks-l1-ask-answer', {
            hintCount: 6,
            firstTarget: 'palette',
            hatOpcode: 'event_whenthisspriteclicked',
        });
        expect(await editingTargetOpcodes()).toEqual(
            expect.arrayContaining([
                'event_whenthisspriteclicked',
                'operator_join',
                'sensing_answer',
                'sensing_askandwait',
                'sensing_resettimer',
                'sensing_timer',
            ]),
        );

        await driver.executeScript(`window.__lessonSays = [];
            window.smalruby.vm.runtime.on('SAY', (target, type, text) => { if (text) window.__lessonSays.push(String(text)); });`);
        await clickCat();
        await answerQuestion('たろう');
        // 答え（2 秒）→ 秒数（2 秒）を言ったら「できた」
        expect(await waitForCompletedToast()).toBe('Ask and answer');
        // 言った文字（スプライトの「聞いて待つ」は質問も吹き出しで言う）: 質問・名前・「<小数の秒数>秒でした」。
        // 秒数は四捨五入しない
        const says = await driver.executeScript('return window.__lessonSays;');
        expect(says.slice(0, 2)).toEqual(['なまえは？', 'たろう']);
        expect(says[2]).toMatch(/^\d+(\.\d+)?秒でした$/);
    });

    test('7 クイズを作ろう: 7 says 正解です, another number says ちがいます, then it is done', async () => {
        await openChallengeAndInsertCode('blocks-l1-quiz', {
            hintCount: 5,
            firstTarget: 'palette',
            hatOpcode: 'event_whenthisspriteclicked',
        });

        await clickCat();
        await answerQuestion('7');
        // 「正解です」だけでは「できた」にならない
        await driver.sleep(2500);
        expect(await countCompletedToasts()).toBe(0);

        await clickCat();
        await answerQuestion('5');
        expect(await waitForCompletedToast()).toBe('Make a quiz');
    });

    test('8 数えよう: a variable made with "Make a Variable", the flag, and 3 clicks on the cat', async () => {
        await openChallengeAndInsertCode('blocks-l1-count', {
            hintCount: 5,
            firstTarget: 'palette',
            hatOpcode: 'event_whenthisspriteclicked',
            // ヒント 1 のとおり「変数を作る」で「回数」を作る（既定 = すべてのスプライト用）
            beforeInsert: async () => {
                await clickBlocksCategory('Variables');
                await clickText('Make a Variable');
                const input = await findByXpath("//input[@name='New variable name:']");
                await input.sendKeys('回数');
                await clickButton('OK');
                await driver.sleep(500);
            },
        });

        // Ruby の `$回数` は「変数を作る」で作ったステージの変数と同じもの（2 つにならない）
        const variables = await driver.executeScript(`
            return window.smalruby.vm.runtime.targets
                .filter(t => t.isOriginal)
                .flatMap(t => Object.values(t.variables)
                    .filter(v => v.name === '回数')
                    .map(v => ({ isStage: t.isStage, type: v.type })));
        `);
        expect(variables).toEqual([{ isStage: true, type: '' }]);

        await clickGreenFlag();
        await driver.sleep(500);
        await clickCat();
        await driver.sleep(300);
        await clickCat();
        await driver.sleep(300);
        expect(await countCompletedToasts()).toBe(0);
        await clickCat();
        expect(await waitForCompletedToast()).toBe('Count');
        const count = await driver.executeScript(`
            const stage = window.smalruby.vm.runtime.getTargetForStage();
            return stage.lookupVariableByNameAndType('回数', '').value;
        `);
        expect(Number(count)).toBe(3);
    });
});
