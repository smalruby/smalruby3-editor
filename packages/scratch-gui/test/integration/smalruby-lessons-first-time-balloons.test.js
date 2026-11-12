/**
 * Integration tests for the first-time balloons in lesson mode (Issue #1498).
 * ウェルカムバルーンは、授業のパソコン（1300×600）で課題バーに重なる。
 * レッスンモードのあいだは出さず、抜けたら元どおり出ることを確かめる。
 * 「レッスン」ボタンの下の「レッスンをはじめよう！」は、はじめての人にも出さない (#1512)。
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const CHALLENGE_ID = 'blocks-l1-if';

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

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
        // はじめての人として始める。jest.retryTimes(1) の再試行は同じブラウザ（beforeAll の driver）で
        // 走るので、1 回目に閉じたウェルカムバルーンの記録が残っていると、再試行は最初の吹き出しの
        // 確認で落ちて 1 回目の本当の失敗の理由が隠れる (#1505)
        await loadUri(`${uri}?no_beforeunload=1&locale=ja`);
        await driver.executeScript('localStorage.clear()');
        await loadUri(`${uri}?no_beforeunload=1&locale=ja`);
        await driver.manage().window().setRect({ width: 1300, height: 600 });
        await waitForLoadingFinished();

        // はじめての人: ウェルカムバルーンは出て、「レッスンをはじめよう！」は出ない (#1512)
        await findByXpath(byTestId('welcome-tooltip'));
        expect(await countByTestId('welcome-tooltip')).toBe(1);
        expect(await countByTestId('lessons-tooltip')).toBe(0);

        await driver.executeScript(`window.smalruby.startChallenge(${JSON.stringify(CHALLENGE_ID)})`);
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(500);

        // レッスンモードのあいだは課題バーに重ならないよう、出さない
        expect(await countByTestId('lessons-tooltip')).toBe(0);
        expect(await countByTestId('welcome-tooltip')).toBe(0);

        // やめると（レッスン表が開く）、ウェルカムバルーンは記録を消していないので元どおり出る
        await clickByTestId('lesson-task-bar-quit');
        await driver.sleep(500);
        expect(await countByTestId('lesson-task-bar')).toBe(0);
        expect(await countByTestId('welcome-tooltip')).toBe(1);
        expect(await countByTestId('lessons-tooltip')).toBe(0);

        // getLogs() は既知の無害なログ（Google Drive API の初期化失敗など）を除いた SEVERE だけを返す
        expect(await getLogs()).toEqual([]);
    });
});
