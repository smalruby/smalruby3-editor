/**
 * Integration tests for the lesson task bar's full text panel (課題の全文).
 * 授業のパソコン（1300×600・日本語）で、課題バーにマウスを乗せると、課題が短くても長くても、
 * 改行つきの全文（画像があれば画像も）がバーの下に出て、離すと消えることを確かめる。
 * チャレンジを始めると自動で開くヒントの吹き出しが出ていても、ホバーの全文は吹き出しより上に出る。
 * タッチ（ポインタの種類が無い click）では課題の文で開閉し、「ほかのチャレンジへ」でレッスン表が開く。
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const IF_TASK =
    'マウスでネコにさわったら「くすぐったい！」、\nさわっていないときは「さわってみて」と言うようにしよう';

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

let driver;

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const countByTestId = (testId) =>
    driver.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

const startChallenge = async (id, number) => {
    await driver.executeScript(`window.smalruby.startChallenge(${JSON.stringify(id)})`);
    await driver.wait(
        async () =>
            (await driver.executeScript(
                `const el = document.querySelector('[data-testid="lesson-task-bar-position"]'); return el && el.textContent;`,
            )) === `${number} / 全部で 11`,
        10000,
        `challenge ${id} should open`,
    );
    // チャレンジを始めるとヒントが自動で開く。開いたままでもホバーで全文が出ることを確かめるので閉じない
    await findByXpath(byTestId('lesson-hint'));
};

// 全文のパネルがヒントの吹き出しより上に重なっているか（どちらも同じ重ね合わせの文脈にいるので、
// z-index で比べる。マウスで出したパネルは pointer-events: none なので elementFromPoint では見られない）
const panelAboveHint = () =>
    driver.executeScript(`
        const panel = document.querySelector('[data-testid="lesson-task-bar-full-text"]');
        const hint = document.querySelector('[data-testid="lesson-hint"]');
        let balloon = hint;
        while (balloon && getComputedStyle(balloon).position !== 'fixed') balloon = balloon.parentElement;
        return {
            hintVisible: Boolean(hint) && getComputedStyle(hint).visibility !== 'hidden',
            panelZ: parseInt(getComputedStyle(panel).zIndex, 10),
            hintZ: balloon ? parseInt(getComputedStyle(balloon).zIndex, 10) : null,
        };
    `);

const hoverBar = async () => {
    const bar = await driver.findElement({ css: '[data-testid="lesson-task-bar-position"]' });
    await driver.actions().move({ origin: bar }).perform();
};

const moveToWorkspace = async () => {
    const workspace = await driver.findElement({ css: '.blocklyMainBackground' });
    await driver.actions().move({ origin: workspace, x: 0, y: 0 }).perform();
};

const panelLayout = () =>
    driver.executeScript(`
        const panel = document.querySelector('[data-testid="lesson-task-bar-full-text"]');
        const text = document.querySelector('[data-testid="lesson-task-bar-full-text-text"]');
        const image = document.querySelector('[data-testid="lesson-task-bar-full-text-image"]');
        const bar = document.querySelector('[data-testid="lesson-task-bar"]').getBoundingClientRect();
        const stage = document.querySelector('[class*="stage_stage-wrapper_"]').getBoundingClientRect();
        const rect = panel.getBoundingClientRect();
        return {
            text: text.textContent,
            fontSize: parseFloat(getComputedStyle(text).fontSize),
            lineCount: Math.round(text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight)),
            imageLoaded: image ? image.complete && image.naturalWidth > 0 : null,
            fits: panel.scrollHeight <= panel.clientHeight + 1,
            panelTop: rect.top,
            panelBottom: rect.bottom,
            barBottom: bar.bottom,
            stageRight: stage.right,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
        };
    `);

describe('Smalruby Lessons: full text of the task', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('shows the whole task (with line breaks and an image) under the bar while the mouse is on it', async () => {
        await loadUri(`${uri}?no_beforeunload=1&locale=ja`);
        await driver.manage().window().setRect({ width: 1300, height: 600 });
        await waitForLoadingFinished();

        // 短い課題（チャレンジ 2）でも出る。画像つきの例
        await startChallenge('blocks-l1-arrow-move', 2);
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);
        // 「全文」ボタンはもう無い
        expect(await countByTestId('lesson-task-bar-full-text-toggle')).toBe(0);
        // ヒントの吹き出しが出ていても、マウスを乗せれば全文が吹き出しより上に出る
        await hoverBar();
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        const stacking = await panelAboveHint();
        expect(stacking.hintVisible).toBe(true);
        expect(stacking.hintZ).not.toBeNull();
        expect(stacking.panelZ).toBeGreaterThan(stacking.hintZ);
        await driver.wait(
            async () => (await panelLayout()).imageLoaded === true,
            5000,
            'the image of the challenge should load',
        );
        let layout = await panelLayout();
        expect(layout.text).toBe('上向き矢印キーで上へ、下向き矢印キーで下へ、ネコを動かそう');
        expect(layout.fits).toBe(true);
        // プロジェクターで読める大きさ（バーの 14px より大きく）
        expect(layout.fontSize).toBeGreaterThanOrEqual(20);
        expect(Math.abs(layout.panelTop - layout.barBottom)).toBeLessThanOrEqual(1);
        expect(layout.panelBottom).toBeLessThanOrEqual(layout.innerHeight);
        expect(layout.stageRight).toBeLessThanOrEqual(layout.innerWidth);

        // バーから離れると消える（パネルの上に動かしても残らない）。ヒントの吹き出しはそのまま
        await moveToWorkspace();
        await driver.sleep(200);
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);
        expect(await countByTestId('lesson-hint')).toBe(1);

        // 長い課題（チャレンジ 5）は、定義の改行どおりに 2 行以上で出る。画像の無いチャレンジは画像を出さない
        await startChallenge('blocks-l1-if', 5);
        await hoverBar();
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        layout = await panelLayout();
        expect(layout.text).toBe(IF_TASK);
        expect(layout.lineCount).toBeGreaterThanOrEqual(2);
        expect(layout.imageLoaded).toBeNull();
        expect(layout.fits).toBe(true);
        expect(layout.stageRight).toBeLessThanOrEqual(layout.innerWidth);
        await moveToWorkspace();
        await driver.sleep(200);
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);

        // タップ（ポインタの種類が無い click）では課題の文で開き、もう一度で閉じる。
        // ヒントの吹き出しが出ているときにタップで開くと、吹き出しは閉じる（開いたままのパネルとは重ねない）
        expect(await countByTestId('lesson-hint')).toBe(1);
        await clickByTestId('lesson-task-bar-task');
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        await driver.wait(async () => (await countByTestId('lesson-hint')) === 0, 5000, 'the hint should close');
        await clickByTestId('lesson-task-bar-task');
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);

        // タップで開いているときにヒントを開くと、全文は閉じる（重ねない）
        await clickByTestId('lesson-task-bar-task');
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        await clickByTestId('lesson-task-bar-hint');
        await findByXpath(byTestId('lesson-hint'));
        expect(await countByTestId('lesson-task-bar-full-text')).toBe(0);
        // 全文をタップで開くと、ヒントの吹き出しは閉じる
        await clickByTestId('lesson-task-bar-task');
        await findByXpath(byTestId('lesson-task-bar-full-text'));
        expect(await countByTestId('lesson-hint')).toBe(0);

        // 「ほかのチャレンジへ」でレッスンモードを抜けてレッスン表が開く
        const label = await driver.executeScript(
            `return document.querySelector('[data-testid="lesson-task-bar-quit"]').textContent`,
        );
        expect(label).toBe('ほかのチャレンジへ');
        await clickByTestId('lesson-task-bar-quit');
        await findByXpath(byTestId('lessons-library'));
        expect(await countByTestId('lesson-task-bar')).toBe(0);

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });
});
