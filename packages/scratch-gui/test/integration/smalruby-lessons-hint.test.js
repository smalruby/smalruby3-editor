/**
 * Integration tests for the lesson hint balloon (ヒントの吹き出し).
 * レッスンモードに入る → ヒントを開く → 吹き出しに本物のブロックが描かれ、指す場所と初回だけの
 * スポットライトがある → 進める → 最後に「プログラムを入れる」でブロックが入る → 2 回目はスポットライト無し。
 */
import path from 'path';
import { unexpectedSevereLogs } from '../helpers/ignorable-severe-logs';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const CHALLENGE_ID = 'blocks-l1-click-say';
const SPOTLIGHT_SEEN_KEY = 'smalruby:lessonSpotlightSeen';

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

// Google Drive API の初期化失敗（gapi が読めない環境で数秒後に出る）はレッスンとは無関係
const isGoogleDriveInitLog = (log) => /Failed to initialize Google Drive API/.test(log.message);
const severeLogs = (logs) => unexpectedSevereLogs(logs).filter((log) => !isGoogleDriveInitLog(log));

let driver;

const startChallenge = (d, challengeId) =>
    d.executeScript(`window.smalruby.startChallenge(${JSON.stringify(challengeId)})`);

const clickByTestId = (d, testId) => d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const countByTestId = (d, testId) =>
    d.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

const textByTestId = (d, testId) =>
    d.executeScript(`return document.querySelector('[data-testid="${testId}"]').textContent`);

const attrByTestId = (d, testId, attr) =>
    d.executeScript(
        `return document.querySelector('[data-testid="${testId}"]').getAttribute(${JSON.stringify(attr)})`,
    );

// 吹き出しの中の Blockly の読み取り専用ワークスペースに描かれたブロック（SVG）の数
const hintBlockCount = (d) =>
    d.executeScript(
        `return document.querySelectorAll('[data-testid="lesson-hint-blocks"] .blocklyBlockCanvas g[data-id]').length`,
    );

// Blockly はラベルの空白を \u00a0 で描くので、ふつうの空白にそろえる
const hintBlockText = (d) =>
    d.executeScript(
        `const canvas = document.querySelector('[data-testid="lesson-hint-blocks"] .blocklyBlockCanvas');
        return canvas ? canvas.textContent.replace(/\\u00a0/g, ' ') : '';`,
    );

const waitForHintBlocks = (d) =>
    d.wait(async () => (await hintBlockCount(d)) > 0, 20000, 'hint blocks did not render');

const editingTargetOpcodes = (d) =>
    d.executeScript(`const blocks = window.smalruby.vm.editingTarget.blocks._blocks;
        return Object.values(blocks).filter(b => !b.shadow).map(b => b.opcode).sort();`);

describe('Smalruby Lessons: hint balloon', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('shows real blocks, points at the target, spotlights only the first time, and inserts the program', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await waitForLoadingFinished();
        // はじめて開くチャレンジにする
        await driver.executeScript(`window.localStorage.removeItem(${JSON.stringify(SPOTLIGHT_SEEN_KEY)})`);

        await startChallenge(driver, CHALLENGE_ID);
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(1000);
        expect(await countByTestId(driver, 'lesson-hint')).toBe(0);

        // ヒント 1: コスチュームタブを指す（spotlight ではない）
        await clickByTestId(driver, 'lesson-task-bar-hint');
        await findByXpath(byTestId('lesson-hint'));
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 1 of 7');
        expect(await attrByTestId(driver, 'lesson-hint', 'data-target')).toBe('costumes-tab');
        expect(await attrByTestId(driver, 'lesson-hint', 'data-side')).toBe('bottom');
        expect(await countByTestId(driver, 'lesson-hint-spotlight')).toBe(0);
        expect(await countByTestId(driver, 'lesson-hint-blocks')).toBe(0);

        // ヒント 2: パレットを指し、はじめてなのでスポットライト。本物のブロック（SVG）が描かれる
        await clickByTestId(driver, 'lesson-hint-next');
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 2 of 7');
        expect(await attrByTestId(driver, 'lesson-hint', 'data-target')).toBe('palette');
        expect(await countByTestId(driver, 'lesson-hint-spotlight')).toBe(1);
        await waitForHintBlocks(driver);
        expect(await hintBlockText(driver)).toContain('when this sprite clicked');
        const side = await attrByTestId(driver, 'lesson-hint', 'data-side');
        expect(['right', 'bottom', 'inside']).toContain(side);

        // ヒント 3: 「こんにちは！」と言うブロック
        await clickByTestId(driver, 'lesson-hint-next');
        await driver.wait(
            async () => (await hintBlockText(driver)).includes('こんにちは！'),
            20000,
            'the say block did not render',
        );
        expect(await hintBlockText(driver)).toContain('say');

        // もどる → 進める で同じヒントにもどれる
        await clickByTestId(driver, 'lesson-hint-prev');
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 2 of 7');
        await clickByTestId(driver, 'lesson-hint-next');
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 3 of 7');

        // 最後のページ: うまく動かないときは + プログラムを入れる
        for (let i = 0; i < 4; i++) await clickByTestId(driver, 'lesson-hint-next');
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 7 of 7');
        expect(await countByTestId(driver, 'lesson-hint-debug-title')).toBe(1);
        expect(
            await driver.executeScript(
                `return document.querySelectorAll('[data-testid="lesson-hint-debug"] li').length`,
            ),
        ).toBe(2);
        expect(
            await driver.executeScript(`return document.querySelector('[data-testid="lesson-hint-next"]').disabled`),
        ).toBe(true);

        await clickByTestId(driver, 'lesson-hint-insert-code');
        await driver.wait(
            async () => (await editingTargetOpcodes(driver)).includes('looks_nextcostume'),
            20000,
            'the program was not inserted',
        );
        expect(await editingTargetOpcodes(driver)).toEqual([
            'event_whenthisspriteclicked',
            'looks_nextcostume',
            'looks_sayforsecs',
        ]);
        // 入れたら吹き出しは閉じる。課題バーは残る（レッスンモードのまま）
        expect(await countByTestId(driver, 'lesson-hint')).toBe(0);
        expect(await countByTestId(driver, 'lesson-task-bar')).toBe(1);

        // 2 回目に開いたチャレンジでは、spotlight のヒントでも周りを暗くしない
        await clickByTestId(driver, 'lesson-task-bar-quit');
        await driver.sleep(500);
        // プログラムを入れたので作品に変更がある → 「保存しますか」の確認を自動で OK にする
        await driver.executeScript('window.confirm = () => true;');
        await startChallenge(driver, CHALLENGE_ID);
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(1000);
        await clickByTestId(driver, 'lesson-task-bar-hint');
        await findByXpath(byTestId('lesson-hint'));
        await clickByTestId(driver, 'lesson-hint-next');
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 2 of 7');
        expect(await countByTestId(driver, 'lesson-hint-spotlight')).toBe(0);
        await waitForHintBlocks(driver);

        // 閉じる
        await clickByTestId(driver, 'lesson-hint-close');
        expect(await countByTestId(driver, 'lesson-hint')).toBe(0);
        // やめると吹き出しの状態も消える
        await clickByTestId(driver, 'lesson-task-bar-quit');
        await driver.sleep(500);
        expect(await countByTestId(driver, 'lesson-hint')).toBe(0);

        const logs = await getLogs({ includeAllLevels: true });
        expect(severeLogs(logs)).toEqual([]);
    });
});
