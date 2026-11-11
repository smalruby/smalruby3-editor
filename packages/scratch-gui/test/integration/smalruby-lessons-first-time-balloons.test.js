/**
 * Integration tests for the first-time balloons in lesson mode (Issue #1498).
 * 「レッスンをはじめよう！」とウェルカムバルーンは、授業のパソコン（1300×600）で課題バーに重なる。
 * レッスンモードのあいだは出さず、抜けたらウェルカムバルーンは元どおり出る（「レッスンをはじめよう！」は
 * チャレンジを開いた時点で役目を終えるので出ない）ことを確かめる。
 */
import path from 'path';
import { unexpectedSevereLogs } from '../helpers/ignorable-severe-logs';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const CHALLENGE_ID = 'blocks-l1-if';

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

// Google Drive API の初期化失敗（gapi が読めない環境で数秒後に出る）はレッスンとは無関係
const isGoogleDriveInitLog = (log) => /Failed to initialize Google Drive API/.test(log.message);
const severeLogs = (logs) => unexpectedSevereLogs(logs).filter((log) => !isGoogleDriveInitLog(log));

let driver;

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const countByTestId = (testId) =>
    driver.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

describe('Smalruby Lessons: first-time balloons in lesson mode', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('hides the balloons at 1300x600 while a challenge is open and shows them again after quitting', async () => {
        await loadUri(`${uri}?no_beforeunload=1&locale=ja`);
        await driver.manage().window().setRect({ width: 1300, height: 600 });
        await waitForLoadingFinished();

        // はじめての人: どちらの吹き出しも出ている
        await findByXpath(byTestId('lessons-tooltip'));
        expect(await countByTestId('lessons-tooltip')).toBe(1);
        expect(await countByTestId('welcome-tooltip')).toBe(1);

        await driver.executeScript(`window.smalruby.startChallenge(${JSON.stringify(CHALLENGE_ID)})`);
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(500);

        // レッスンモードのあいだは課題バーに重ならないよう、どちらも出さない
        expect(await countByTestId('lessons-tooltip')).toBe(0);
        expect(await countByTestId('welcome-tooltip')).toBe(0);

        // やめると（レッスン表が開く）、ウェルカムバルーンは記録を消していないので元どおり出る。
        // 「レッスンをはじめよう！」はチャレンジを開いた時点で役目を終えたので、もう出ない
        await clickByTestId('lesson-task-bar-quit');
        await driver.sleep(500);
        expect(await countByTestId('lesson-task-bar')).toBe(0);
        expect(await countByTestId('welcome-tooltip')).toBe(1);
        expect(await countByTestId('lessons-tooltip')).toBe(0);
        expect(await driver.executeScript("return localStorage.getItem('smalruby:tutorialSeen')")).toBe('true');

        const logs = await getLogs();
        expect(severeLogs(logs)).toEqual([]);
    });
});
