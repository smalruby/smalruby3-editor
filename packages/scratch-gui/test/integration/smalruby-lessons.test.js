/**
 * Integration tests for lesson mode (コース › レッスン › チャレンジ).
 * チャレンジを開く → 新しい作品・課題バー・絞ったパレット → やめる → 元にもどる。
 */
import path from 'path';
import { unexpectedSevereLogs } from '../helpers/ignorable-severe-logs';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, scope, textExists, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const CHALLENGE_ID = 'blocks-l1-click-say';

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

describe('Smalruby Lessons', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('opening a challenge shows the task bar and restricts the palette; quitting restores it', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await waitForLoadingFinished();

        // レッスンモードでないときは課題バーが無く、パレットは全部ある
        expect(await countByTestId(driver, 'lesson-task-bar')).toBe(0);
        expect(await textExists('Motion', scope.blocksTab)).toBe(true);

        await startChallenge(driver, CHALLENGE_ID);
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(1000);

        // 課題の 1 行と「何個め / 全部で何個」
        const position = await findByXpath(byTestId('lesson-task-bar-position'));
        expect(await position.getText()).toBe('3 of 11');
        const task = await findByXpath(byTestId('lesson-task-bar-task'));
        expect(await task.getText()).toBe(
            'Add a costume you like to the cat, and make it say "Hello!" and change its look when it is clicked',
        );

        // パレットはチャレンジの allowedBlocks（見た目・イベント）だけ
        expect(await textExists('Looks', scope.blocksTab)).toBe(true);
        expect(await textExists('Events', scope.blocksTab)).toBe(true);
        expect(await textExists('Motion', scope.blocksTab)).toBe(false);
        expect(await textExists('Sound', scope.blocksTab)).toBe(false);
        expect(await textExists('Control', scope.blocksTab)).toBe(false);

        // 新しい作品になっている（ネコ 1 匹・題名は既定）
        const spriteCount = await driver.executeScript(
            `return document.querySelectorAll('[class*="sprite-selector-item_sprite-selector-item_"]').length`,
        );
        expect(spriteCount).toBe(1);

        // やめる → 課題バーが消え、パレットが元にもどる
        await clickByTestId(driver, 'lesson-task-bar-quit');
        await driver.sleep(1000);
        expect(await countByTestId(driver, 'lesson-task-bar')).toBe(0);
        expect(await textExists('Motion', scope.blocksTab)).toBe(true);
        expect(await textExists('Sound', scope.blocksTab)).toBe(true);
        expect(await textExists('Control', scope.blocksTab)).toBe(true);

        const logs = await getLogs({ includeAllLevels: true });
        expect(severeLogs(logs)).toEqual([]);
    });

    test('a challenge without allowedBlocks keeps the whole palette', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await waitForLoadingFinished();

        await startChallenge(driver, 'blocks-l1-quiz');
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(1000);

        const position = await findByXpath(byTestId('lesson-task-bar-position'));
        expect(await position.getText()).toBe('7 of 11');
        expect(await textExists('Motion', scope.blocksTab)).toBe(true);
        expect(await textExists('Looks', scope.blocksTab)).toBe(true);

        await clickByTestId(driver, 'lesson-task-bar-quit');
        await driver.sleep(500);
        expect(await countByTestId(driver, 'lesson-task-bar')).toBe(0);
    });
});
