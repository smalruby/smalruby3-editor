/**
 * Integration tests for the layout of the lesson task bar (課題バー) and the compact sprite info.
 * 授業のパソコン（1300×600）で:
 *   - 課題バーは画面の幅いっぱい（ステージの列の上もおおう）で、「ヒント」「ほかのチャレンジへ」は右端。
 *     ステージの列の旗・止める・ステージの大きさのボタンはバーの下にあって押せる。ページはスクロールしない。
 *   - 中サイズのステージ（既定）では、スプライトの情報が詰まった形（「スプライト」の字なし・大きさ / 向きはアイコン）。
 *     レッスンモードかどうかに関係なく同じ形で、どの入力欄も画面の中にあって押せる。
 *   - ほかのステージの大きさ（大）では、スプライトの情報は今までどおり。
 *   - 中サイズのステージでは、ステージの列の見出し「ステージ」を出さず、背景の番号が「背景を選ぶ」ボタンと
 *     重ならない（チャレンジ中もそうでないときも）。見出しが無くてもステージの列を押すとステージが選ばれる。
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickXpath, findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

let driver;

const countByTestId = (testId) =>
    driver.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

// 要素が画面の中にあり、真ん中が他のものに隠れていない（押せる）か
const HIT_TEST = `
    const hit = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight) return false;
        const at = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        return Boolean(at) && (at === el || el.contains(at));
    };
`;

const spriteInfoLayout = () =>
    driver.executeScript(`
        ${HIT_TEST}
        const info = document.querySelector('[class*="sprite-info_sprite-info_"]');
        const inputs = Array.from(info.querySelectorAll('input'));
        const list = document.querySelector('[class*="sprite-selector_scroll-wrapper_"]');
        return {
            inputCount: inputs.length,
            inputsUsable: inputs.every(hit),
            infoHeight: info.getBoundingClientRect().height,
            listHeight: list.getBoundingClientRect().height,
            pageScrolls: document.scrollingElement.scrollHeight > window.innerHeight + 1,
            scrollHeight: document.scrollingElement.scrollHeight,
            innerHeight: window.innerHeight,
        };
    `);

const barLayout = () =>
    driver.executeScript(`
        ${HIT_TEST}
        const bar = document.querySelector('[data-testid="lesson-task-bar"]').getBoundingClientRect();
        const hint = document.querySelector('[data-testid="lesson-task-bar-hint"]').getBoundingClientRect();
        const quit = document.querySelector('[data-testid="lesson-task-bar-quit"]').getBoundingClientRect();
        const flag = document.querySelector('[class*="green-flag_green-flag_"]');
        const stop = document.querySelector('[class*="stop-all_stop-all_"]');
        const stageButtons = Array.from(document.querySelectorAll('[title^="Switch to"], [class*="stage-header_stage-button_"]'));
        const stage = document.querySelector('[class*="stage_stage-wrapper_"]').getBoundingClientRect();
        return {
            barLeft: bar.left,
            barRight: bar.right,
            barBottom: bar.bottom,
            hintRight: hint.right,
            quitLeft: quit.left,
            quitRight: quit.right,
            flagTop: flag.getBoundingClientRect().top,
            flagUsable: hit(flag),
            stopUsable: hit(stop),
            stageButtonCount: stageButtons.length,
            stageButtonsUsable: stageButtons.every(hit),
            stageTop: stage.top,
            stageRight: stage.right,
            innerWidth: window.innerWidth,
        };
    `);

// ステージの列: 見出しがあるか、背景の番号と「背景を選ぶ」ボタンの矩形が重なっていないか
const stageSelectorLayout = () =>
    driver.executeScript(`
        const sel = document.querySelector('[class*="stage-selector_stage-selector_"]');
        const count = sel.querySelector('[class*="stage-selector_count_"]').getBoundingClientRect();
        const button = sel.querySelector('[class*="stage-selector_add-button_"] button').getBoundingClientRect();
        const overlaps = !(count.bottom <= button.top || button.bottom <= count.top ||
            count.right <= button.left || button.right <= count.left);
        return {
            hasHeader: Boolean(sel.querySelector('[class*="stage-selector_header_"]')),
            countBottom: count.bottom,
            buttonTop: button.top,
            overlaps,
        };
    `);

// 画面（ページの見える部分）を 1300×600 にする。ウィンドウの枠の分だけ外側を大きくする
const setViewport = async (width, height) => {
    await driver.manage().window().setRect({ width, height });
    const inner = await driver.executeScript('return [window.innerWidth, window.innerHeight];');
    await driver
        .manage()
        .window()
        .setRect({ width: width + (width - inner[0]), height: height + (height - inner[1]) });
    await driver.sleep(300);
};

describe('Smalruby Lessons: task bar across the whole width and the compact sprite info', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('the bar covers the stage column, the buttons are at the right end, and everything stays usable', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await setViewport(1300, 600);
        await waitForLoadingFinished();

        // レッスンモードでなくても、中サイズのステージ（既定）ではスプライトの情報は詰まった形
        await findByXpath(byTestId('sprite-info-compact'));
        expect(await countByTestId('sprite-info-size-icon')).toBe(1);
        expect(await countByTestId('sprite-info-direction-icon')).toBe(1);
        const before = await spriteInfoLayout();
        expect(before.inputCount).toBe(5);
        expect(before.inputsUsable).toBe(true);
        expect(before.pageScrolls).toBe(false);

        await driver.executeScript(`window.smalruby.startChallenge('blocks-l1-click-say')`);
        await findByXpath(byTestId('lesson-task-bar'));
        // 自動で開くヒントの吹き出しは閉じて、下の部品を押せるか確かめる
        await findByXpath(byTestId('lesson-hint'));
        await driver.executeScript(`document.querySelector('[data-testid="lesson-task-bar-hint"]').click()`);
        await driver.wait(async () => (await countByTestId('lesson-hint')) === 0, 5000, 'the hint should close');
        await driver.sleep(500);

        const bar = await barLayout();
        // 画面の幅いっぱい
        expect(bar.barLeft).toBe(0);
        expect(Math.abs(bar.barRight - bar.innerWidth)).toBeLessThanOrEqual(1);
        // ボタンは右端（ステージの列の上）
        expect(bar.innerWidth - bar.quitRight).toBeLessThanOrEqual(24);
        expect(bar.hintRight).toBeLessThanOrEqual(bar.quitLeft);
        expect(bar.quitLeft).toBeGreaterThan(bar.innerWidth - 400);
        // ステージの列はバーの下にあって、旗・止める・ステージの大きさのボタンが押せる
        expect(bar.flagTop).toBeGreaterThanOrEqual(bar.barBottom);
        expect(bar.stageTop).toBeGreaterThanOrEqual(bar.barBottom);
        expect(bar.flagUsable).toBe(true);
        expect(bar.stopUsable).toBe(true);
        expect(bar.stageButtonCount).toBeGreaterThanOrEqual(3);
        expect(bar.stageButtonsUsable).toBe(true);
        expect(bar.stageRight).toBeLessThanOrEqual(bar.innerWidth);

        // スプライトの情報はレッスンモードでも同じ形で、どの入力欄も押せる。ページはスクロールしない
        await findByXpath(byTestId('sprite-info-compact'));
        const during = await spriteInfoLayout();
        expect(during.inputsUsable).toBe(true);
        expect(during.pageScrolls).toBe(false);
        expect(during.listHeight).toBeGreaterThan(0);

        // ほかのステージの大きさ（大）では今までどおり（「スプライト」の字がある・アイコンは無い）
        await clickXpath('//button[@title="Switch to large stage"]');
        await driver.wait(
            async () => (await countByTestId('sprite-info-compact')) === 0,
            5000,
            'the sprite info should go back to the upstream layout',
        );
        expect(await countByTestId('sprite-info-size-icon')).toBe(0);
        const spriteLabel = await driver.executeScript(
            `return Array.from(document.querySelectorAll('[class*="sprite-info_sprite-info_"] span'))` +
                `.some(s => s.textContent === 'Sprite');`,
        );
        expect(spriteLabel).toBe(true);

        // 中サイズへもどすと、また詰まった形
        await clickXpath('//button[@title="Switch to middle stage"]');
        await findByXpath(byTestId('sprite-info-compact'));

        // ほかのチャレンジへ（レッスンモードを抜ける）と、本体の高さが元にもどってスクロールしない
        await driver.executeScript(`document.querySelector('[data-testid="lesson-task-bar-quit"]').click()`);
        await driver.executeScript(`
            // 「ほかのチャレンジへ」で開いたレッスン表を閉じる（ライブラリのモーダルの戻るボタン）
            const back = document.querySelector('[class*="modal_back-button_"]');
            if (back) back.click();
        `);
        await driver.wait(
            async () => (await countByTestId('lesson-task-bar')) === 0,
            5000,
            'the task bar should go away',
        );
        const after = await spriteInfoLayout();
        expect(after.inputsUsable).toBe(true);
        expect(after.pageScrolls).toBe(false);

        const logs = await getLogs();
        await expect(logs).toEqual([]);
    });
    test('on the middle stage the stage column has no header, and the backdrop count does not overlap the button', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await setViewport(1300, 600);
        await waitForLoadingFinished();

        // チャレンジ中でないとき
        let layout = await stageSelectorLayout();
        expect(layout.hasHeader).toBe(false);
        expect(layout.overlaps).toBe(false);

        // 見出しが無くても、ステージの列を押すとステージが選ばれる
        await driver.executeScript(`document.querySelector('[class*="stage-selector_stage-selector_"]').click()`);
        await driver.wait(
            async () =>
                driver.executeScript(
                    `return document.querySelector('[class*="stage-selector_stage-selector_"]')` +
                        `.className.includes('is-selected')`,
                ),
            5000,
            'the stage should be selected',
        );
        // ステージを編集しているので、コスチュームのタブが「背景」になる
        await findByXpath('//li[@role="tab"]//*[text()="Backdrops"]');

        // チャレンジ中
        await driver.executeScript(`window.smalruby.startChallenge('blocks-l1-click-say')`);
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(500);
        layout = await stageSelectorLayout();
        expect(layout.hasHeader).toBe(false);
        expect(layout.overlaps).toBe(false);

        // 大きいステージでは今までどおり見出しがある
        await clickXpath('//button[@title="Switch to large stage"]');
        await driver.wait(
            async () => (await stageSelectorLayout()).hasHeader,
            5000,
            'the stage column should show the header on the large stage',
        );

        const logs = await getLogs();
        await expect(logs).toEqual([]);
    });
});
