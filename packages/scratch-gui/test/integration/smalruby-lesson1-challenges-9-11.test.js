/**
 * Integration tests for lesson 1 challenges 9-11 (なかまに合図しよう / しゃべらせよう / メッセージをためよう).
 * チャレンジを開く → ヒントのとおりの準備（スプライト・リストを足す）→ ヒントを最後まで進めて
 * 「プログラムを入れる」→ 課題の操作（ネコを押す・旗・答えを入力する）→「できた！」の toast。
 *
 * レッスン表（一覧の画面）はこのブランチにまだ無いので、チャレンジはレッスン表が呼ぶのと同じ
 * `window.smalruby.startChallenge(id)` で開く（docs/lessons/README.md の「レッスンモード」）。
 */
import path from 'path';
import { Key, Origin } from 'selenium-webdriver';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickBlocksCategory, clickButton, clickText, findByXpath, getDriver, loadUri, waitForLoadingFinished } =
    new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

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

const editingTargetOpcodes = () =>
    driver.executeScript(`const blocks = window.smalruby.vm.editingTarget.blocks._blocks;
        return Object.values(blocks).filter(b => !b.shadow).map(b => b.opcode).sort();`);

// スプライト（元のもの）の名前 → ブロックの opcode
const spriteOpcodes = () =>
    driver.executeScript(`
        const result = {};
        window.smalruby.vm.runtime.targets
            .filter(t => t.isOriginal && !t.isStage)
            .forEach(t => {
                result[t.getName()] = Object.values(t.blocks._blocks).filter(b => !b.shadow).map(b => b.opcode).sort();
            });
        return result;`);

// ステージの真ん中（ネコ）を押す。ステージは 1300 幅だと右端が少し画面の外に出るので、要素を起点にすると
// WebDriver は見えている部分の真ん中を押してしまう（ネコから外れる）。canvas の本当の真ん中を画面の座標で押す
const clickCat = async () => {
    const { x, y } = await driver.executeScript(`
        const rect = document.querySelector('[class*="stage_stage-wrapper_"] canvas').getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };`);
    await driver.actions().move({ origin: Origin.VIEWPORT, x, y }).press().release().perform();
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
    // 授業のパソコンの大きさ
    await driver.manage().window().setRect({ width: 1300, height: 600 });
    await waitForLoadingFinished();
    await driver.executeScript(`window.smalruby.startChallenge(${JSON.stringify(challengeId)})`);
    await findByXpath(byTestId('lesson-task-bar'));
    await driver.sleep(1000);

    await openHint();
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
        await openHint();
        await findByXpath(byTestId('lesson-hint'));
    }
    for (let i = 1; i < hintCount; i++) await clickByTestId('lesson-hint-next');
    expect(await textByTestId('lesson-hint-position')).toBe(`Hint ${hintCount} of ${hintCount}`);
    await confirmInsertCode();
    await driver.wait(
        async () => (await editingTargetOpcodes()).includes(hatOpcode),
        20000,
        'the program was not inserted',
    );
    await driver.sleep(500);
    expect(await countCompletedToasts()).toBe(0);
};

// ヒント 1 のとおり、スプライトリストの「スプライトを選ぶ」からペンギンを足す
const addPenguinFromLibrary = async () => {
    await clickByTestId('lesson-hint-close').catch(() => {});
    const button = await findByXpath('//button[@aria-label="Choose a Sprite"]');
    await driver.actions().move({ origin: button }).perform();
    await driver.sleep(500);
    await button.click();
    const item = await findByXpath('//*[contains(@class, "ReactModalPortal")]//*[text()="Penguin"]');
    await item.click();
    await driver.wait(
        async () =>
            driver.executeScript(
                'return window.smalruby.vm.runtime.targets.some(t => t.isOriginal && t.getName() === "Penguin");',
            ),
        20000,
        'the penguin was not added',
    );
    // ライブラリはランダムな場所に置くので、ネコと重ならないように右へ動かす
    await driver.executeScript(`
        const penguin = window.smalruby.vm.runtime.targets.find(t => t.isOriginal && t.getName() === 'Penguin');
        penguin.setXY(150, 0);`);
};

describe('Smalruby Lessons: lesson 1 challenges 9-11', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('9 なかまに合図しよう: a penguin from the library, then the cat broadcasts and the penguin says', async () => {
        await openChallengeAndInsertCode('blocks-l1-broadcast', {
            hintCount: 6,
            firstTarget: 'sprite-list',
            hatOpcode: 'event_whenthisspriteclicked',
            beforeInsert: addPenguinFromLibrary,
        });
        // ネコに「押されたとき・送る」、足したペンギンに「受け取ったとき・言う」（ペンギンは 2 匹にならない）
        const programs = await spriteOpcodes();
        expect(Object.keys(programs).sort()).toEqual(['Penguin', 'Sprite1']);
        expect(programs.Sprite1).toEqual(['event_broadcast', 'event_whenthisspriteclicked']);
        expect(programs.Penguin).toEqual(['event_whenbroadcastreceived', 'looks_sayforsecs']);

        await driver.executeScript(`window.__lessonSays = [];
            window.smalruby.vm.runtime.on('SAY', (target, type, text) => {
                if (text) window.__lessonSays.push([target.getName(), String(text)]);
            });`);
        await clickCat();
        expect(await waitForCompletedToast()).toBe('Signal a friend');
        expect(await driver.executeScript('return window.__lessonSays;')).toEqual([['Penguin', 'Hi!']]);
    });

    test('9 なかまに合図しよう: inserting the program without the penguin adds it from the library', async () => {
        await openChallengeAndInsertCode('blocks-l1-broadcast', {
            hintCount: 6,
            firstTarget: 'sprite-list',
            hatOpcode: 'event_whenthisspriteclicked',
        });
        const programs = await spriteOpcodes();
        expect(programs).toEqual({
            Sprite1: ['event_broadcast', 'event_whenthisspriteclicked'],
            Penguin: ['event_whenbroadcastreceived', 'looks_sayforsecs'],
        });
        // ネコをえらんだ状態で入れる（コードエリアはネコのプログラム）
        expect(await driver.executeScript('return window.smalruby.vm.editingTarget.getName();')).toBe('Sprite1');
        await clickCat();
        expect(await waitForCompletedToast()).toBe('Signal a friend');
    });

    test('10 しゃべらせよう: the program loads Text to Speech and the speak block runs headless', async () => {
        // 拡張機能を足す前に「プログラムを入れる」を押しても、変換が音声合成を読み込む
        await openChallengeAndInsertCode('blocks-l1-speak', {
            hintCount: 4,
            firstTarget: 'extension-button',
            hatOpcode: 'event_whenthisspriteclicked',
        });
        expect(await editingTargetOpcodes()).toEqual(['event_whenthisspriteclicked', 'text2speech_speakAndWait']);
        expect(
            await driver.executeScript(
                'return window.smalruby.vm.extensionManager.isExtensionLoaded("text2speech");',
            ),
        ).toBe(true);
        // headless では声が出なくても（音声の取得に失敗しても）ブロックの実行は記録される
        await clickCat();
        expect(await waitForCompletedToast()).toBe('Make it speak');
    });

    test('11 メッセージをためよう: a list made with "Make a List", the flag, and 3 answers', async () => {
        await openChallengeAndInsertCode('blocks-l1-message-list', {
            hintCount: 5,
            firstTarget: 'palette',
            hatOpcode: 'event_whenthisspriteclicked',
            // ヒント 1 のとおり「リストを作る」で「talk」を作る（en の名前。既定 = すべてのスプライト用）
            beforeInsert: async () => {
                await clickBlocksCategory('Variables');
                await clickText('Make a List');
                const input = await findByXpath("//input[@name='New list name:']");
                await input.sendKeys('talk');
                await clickButton('OK');
                await driver.sleep(500);
            },
        });

        // Ruby の `$talk` は「リストを作る」で作ったステージのリストと同じもの（2 つにならない）
        const lists = await driver.executeScript(`
            return window.smalruby.vm.runtime.targets
                .filter(t => t.isOriginal)
                .flatMap(t => Object.values(t.variables)
                    .filter(v => v.name === 'talk')
                    .map(v => ({ isStage: t.isStage, type: v.type })));
        `);
        expect(lists).toEqual([{ isStage: true, type: 'list' }]);

        await clickGreenFlag();
        await driver.sleep(500);
        await clickCat();
        await answerQuestion('こんにちは');
        await driver.sleep(300);
        await clickCat();
        await answerQuestion('げんき？');
        await driver.sleep(300);
        expect(await countCompletedToasts()).toBe(0);
        await clickCat();
        await answerQuestion('またね');
        expect(await waitForCompletedToast()).toBe('Collect messages');
        const items = await driver.executeScript(`
            const stage = window.smalruby.vm.runtime.getTargetForStage();
            return stage.lookupVariableByNameAndType('talk', 'list').value;
        `);
        expect(items).toEqual(['こんにちは', 'げんき？', 'またね']);
    });
});
