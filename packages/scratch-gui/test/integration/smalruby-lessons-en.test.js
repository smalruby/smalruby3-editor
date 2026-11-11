/**
 * Integration tests for the lessons in the English UI (`?locale=en`).
 * 作品の中の名前（ネコの音「ニャー」/ "Meow"）は作品を作ったときの locale で変わるので、
 * 「プログラムを入れる」の code は locale ごとに持つ（courses.js の localizeCode）。英語の作品でも
 * チャレンジを開く → 「プログラムを入れる」→ 課題の操作 →「できた！」になることを確かめる。
 *
 * - 1 キーで音を鳴らそう: en の作品のネコの音は "Meow"（日本語の作品は「ニャー」）
 * - 8 数えよう: 変数「count」（en の名前。ja は「回数」）
 * - 9 なかまに合図しよう: ペンギンをライブラリから足して、ネコ（Sprite1）に code を入れる
 */
import path from 'path';
import { Key, Origin } from 'selenium-webdriver';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickBlocksCategory,
    clickButton,
    clickText,
    findByXpath,
    getDriver,
    getLogs,
    loadUri,
    waitForLoadingFinished,
} = new SeleniumHelper();

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

// ステージの真ん中（ネコ）を押す。canvas の本当の真ん中を画面の座標で押す
const clickCat = async () => {
    const { x, y } = await driver.executeScript(`
        const rect = document.querySelector('[class*="stage_stage-wrapper_"] canvas').getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };`);
    await driver.actions().move({ origin: Origin.VIEWPORT, x, y }).press().release().perform();
};

const clickGreenFlag = () => driver.findElement({ css: '[class*="green-flag_green-flag_"]' }).click();

// コードエリア（Blockly のワークスペース）の空いているところをクリックしてフォーカスを移す
const focusCodeArea = async () => {
    const svg = await driver.findElement({ css: '[class*="blocks_blocks_"] .blocklySvg' });
    await driver.actions().move({ origin: svg, x: 200, y: 120 }).click().perform();
    await driver.sleep(300);
};

const pressKey = async (key) => {
    await driver.actions().keyDown(key).perform();
    await driver.sleep(100);
    await driver.actions().keyUp(key).perform();
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

const loadEnglishEditor = async () => {
    await loadUri(`${uri}?no_beforeunload=1&locale=en`);
    // 授業のパソコンの大きさ
    await driver.manage().window().setRect({ width: 1300, height: 600 });
    await waitForLoadingFinished();
    await driver.executeScript(`window.localStorage.removeItem('smalruby:lessonProgress');
        window.localStorage.removeItem('smalruby:lessonSpotlightSeen');`);
};

const openChallenge = async (challengeId) => {
    await driver.executeScript(`window.smalruby.startChallenge(${JSON.stringify(challengeId)})`);
    await findByXpath(byTestId('lesson-task-bar'));
    await driver.sleep(1000);
};

// ヒントを開き、最後の手段のページまで進めて「プログラムを入れる」を押す
const insertProgramFromHints = async (hintCount) => {
    await openHint();
    await findByXpath(byTestId('lesson-hint'));
    for (let i = 1; i < hintCount; i++) await clickByTestId('lesson-hint-next');
    expect(await textByTestId('lesson-hint-position')).toBe(`Hint ${hintCount} of ${hintCount}`);
    await confirmInsertCode();
};

// 「プログラムを入れる」のわけ（入らなかったとき）が出ていないか
const countInsertErrors = () =>
    driver.executeScript(`return document.querySelectorAll('[data-testid="lesson-hint-insert-code-error"]').length`);

const waitForSpriteOpcode = (sprite, opcode) =>
    driver.wait(
        async () => ((await spriteOpcodes())[sprite] || []).includes(opcode),
        20000,
        `${opcode} was not inserted into ${sprite}`,
    );

describe('Smalruby Lessons in the English UI', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('1 Play a sound with a key: the en project (cat sound "Meow") gets the program → done', async () => {
        await loadEnglishEditor();
        expect(
            await driver.executeScript('return window.smalruby.vm.editingTarget.sprite.sounds.map(s => s.name);'),
        ).toEqual(['Meow']);
        await openChallenge('blocks-l1-key-sound');
        expect(await textByTestId('lesson-task-bar-position')).toBe('1 of 4');

        // 「Owl」を足す（音タブで足したのと同じ VM の状態。複製は元の次 = index 1 に入る）
        await driver.executeScript(`const vm = window.smalruby.vm;
            return vm.duplicateSound(0).then(() => vm.renameSound(1, 'Owl'));`);

        await insertProgramFromHints(6);
        await waitForSpriteOpcode('Sprite1', 'sound_play');
        expect(await countInsertErrors()).toBe(0);
        expect((await spriteOpcodes()).Sprite1).toEqual([
            'event_whenkeypressed',
            'sound_play',
            'sound_playuntildone',
        ]);
        // 入ったのは en の code（ネコの音は "Meow"）
        const soundMenus = await driver.executeScript(`
            return Object.values(window.smalruby.vm.editingTarget.blocks._blocks)
                .filter(b => b.opcode === 'sound_sounds_menu').map(b => b.fields.SOUND_MENU.value).sort();`);
        expect(soundMenus).toEqual(['Meow', 'Owl']);

        await focusCodeArea();
        await pressKey(Key.SPACE);
        expect(await waitForCompletedToast()).toBe('Play a sound with a key');
        await clickByTestId('lesson-completed-toast-close');
        await clickByTestId('lesson-task-bar-quit');

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });

    test('8 Count: a variable made with "Make a Variable", the flag, and 3 clicks on the cat → done', async () => {
        await loadEnglishEditor();
        await openChallenge('blocks-l1-count');

        // ヒント 1 のとおり「変数を作る」で「count」を作る（en の名前）
        await clickBlocksCategory('Variables');
        await clickText('Make a Variable');
        const input = await findByXpath("//input[@name='New variable name:']");
        await input.sendKeys('count');
        await clickButton('OK');
        await driver.sleep(500);

        await insertProgramFromHints(5);
        await waitForSpriteOpcode('Sprite1', 'data_changevariableby');
        await driver.sleep(500);

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
            return stage.lookupVariableByNameAndType('count', '').value;
        `);
        expect(Number(count)).toBe(3);
    });

    test('9 Signal a friend: inserting adds the penguin and puts the cat program into Sprite1 → done', async () => {
        await loadEnglishEditor();
        await openChallenge('blocks-l1-broadcast');

        await insertProgramFromHints(6);
        await waitForSpriteOpcode('Sprite1', 'event_broadcast');
        expect(await spriteOpcodes()).toEqual({
            Sprite1: ['event_broadcast', 'event_whenthisspriteclicked'],
            Penguin: ['event_whenbroadcastreceived', 'looks_sayforsecs'],
        });
        expect(await driver.executeScript('return window.smalruby.vm.editingTarget.getName();')).toBe('Sprite1');

        await clickCat();
        expect(await waitForCompletedToast()).toBe('Signal a friend');
    });
});
