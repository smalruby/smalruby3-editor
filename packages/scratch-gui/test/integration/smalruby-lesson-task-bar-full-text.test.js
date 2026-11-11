/**
 * Integration tests for the lesson task bar's full text panel (課題の全文).
 * 授業のパソコン（1300×600・日本語）でチャレンジ 5「もし〜なら」を開くと、課題の文が … で切れる。
 * 「全文」ボタンで課題バーの下に全文を出し、全文が見える・ステージは画面の外にはみ出さないことを確かめる。
 */
import path from 'path';
import { unexpectedSevereLogs } from '../helpers/ignorable-severe-logs';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const CHALLENGE_ID = 'blocks-l1-if';
const FULL_TASK =
    'マウスでネコにさわったら「くすぐったい！」、さわっていないときは「さわってみて」と言うようにしよう';

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

// Google Drive API の初期化失敗（gapi が読めない環境で数秒後に出る）はレッスンとは無関係
const isGoogleDriveInitLog = (log) => /Failed to initialize Google Drive API/.test(log.message);
const severeLogs = (logs) => unexpectedSevereLogs(logs).filter((log) => !isGoogleDriveInitLog(log));

let driver;

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const countByTestId = (testId) =>
    driver.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

const attrByTestId = (testId, attr) =>
    driver.executeScript(
        `return document.querySelector('[data-testid="${testId}"]').getAttribute(${JSON.stringify(attr)})`,
    );

describe('Smalruby Lessons: full text of the task', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('shows the whole task under the bar at 1300x600 without pushing the stage out', async () => {
        await loadUri(`${uri}?no_beforeunload=1&locale=ja`);
        await driver.manage().window().setRect({ width: 1300, height: 600 });
        await waitForLoadingFinished();
        await driver.executeScript(`window.smalruby.startChallenge(${JSON.stringify(CHALLENGE_ID)})`);
        await findByXpath(byTestId('lesson-task-bar'));

        // 切れるかどうかを、その環境のフォントに任せない。CI のランナーには日本語のフォントが無く、
        // かなや漢字が細い代わりの字で描かれて課題の文が 1 行に入ってしまう（授業のパソコンでは切れる）。
        // そこで、課題の文の字の間を広げてから、フォントが読み込まれたことを知らせる。課題の文は
        // width: 0 の flex なので要素の大きさは変わらず（resize も ResizeObserver も来ない）、
        // document.fonts の loadingdone で測り直したときだけ「切れている」になる
        await driver.executeScript(`
            const style = document.createElement('style');
            style.textContent = '[data-testid="lesson-task-bar-task"] { letter-spacing: 0.75em; }';
            document.head.appendChild(style);
            document.fonts.dispatchEvent(new Event('loadingdone'));
        `);

        // 課題の文は 1 行に入りきらず切れている → 「全文」ボタンがある（閉じている）。
        // 測り直しが済むまで待つ
        await driver.wait(
            async () => (await attrByTestId('lesson-task-bar-task', 'data-truncated')) === 'true',
            5000,
            'the task line should be cut off at 1300x600',
        );
        expect(await countByTestId('lesson-task-bar-full-text-toggle')).toBe(1);
        expect(await attrByTestId('lesson-task-bar-full-text-toggle', 'aria-expanded')).toBe('false');
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);

        await clickByTestId('lesson-task-bar-full-text-toggle');
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        expect(await attrByTestId('lesson-task-bar-full-text-toggle', 'aria-expanded')).toBe('true');

        const layout = await driver.executeScript(`
            const panel = document.querySelector('[data-testid="lesson-task-bar-full-text"]');
            const bar = document.querySelector('[data-testid="lesson-task-bar"]').getBoundingClientRect();
            const stage = document.querySelector('[class*="stage_stage-wrapper_"]').getBoundingClientRect();
            const rect = panel.getBoundingClientRect();
            return {
                text: panel.textContent,
                // 全文が切れずに見えている（パネルの中でスクロールしない・画面の中にある）
                fits: panel.scrollHeight <= panel.clientHeight + 1 && panel.scrollWidth <= panel.clientWidth + 1,
                panelTop: rect.top,
                panelBottom: rect.bottom,
                barBottom: bar.bottom,
                stageRight: stage.right,
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
            };
        `);
        expect(layout.text).toBe(FULL_TASK);
        expect(layout.fits).toBe(true);
        expect(Math.abs(layout.panelTop - layout.barBottom)).toBeLessThanOrEqual(1);
        expect(layout.panelBottom).toBeLessThanOrEqual(layout.innerHeight);
        // エディタの列を広げていない: ステージの右端が画面の中
        expect(layout.stageRight).toBeLessThanOrEqual(layout.innerWidth);

        // もう一度押すと閉じる
        await clickByTestId('lesson-task-bar-full-text-toggle');
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);

        // 課題の文を押しても開き、外（ステージ）を押すと閉じる
        await clickByTestId('lesson-task-bar-task');
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        await driver.findElement({ css: '[class*="stage_stage-wrapper_"] canvas' }).click();
        await driver.sleep(200);
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);

        // コードエリアを押しても閉じる（Blockly は pointerdown を preventDefault するので mousedown が来ない）
        await clickByTestId('lesson-task-bar-full-text-toggle');
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        const workspace = await driver.findElement({ css: '.blocklyMainBackground' });
        await driver.actions().move({ origin: workspace, x: 100, y: 120 }).click().perform();
        await driver.sleep(200);
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);

        // ヒントの吹き出しが出ているときに全文を開くと、吹き出しは閉じる（重ねない）
        await clickByTestId('lesson-task-bar-hint');
        await findByXpath(byTestId('lesson-hint'));
        await clickByTestId('lesson-task-bar-full-text-toggle');
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        expect(await countByTestId('lesson-hint')).toBe(0);
        // ヒントを開くと全文のパネルが閉じる
        await clickByTestId('lesson-task-bar-hint');
        await findByXpath(byTestId('lesson-hint'));
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);

        const logs = await getLogs({ includeAllLevels: true });
        expect(severeLogs(logs)).toEqual([]);
    });
});
