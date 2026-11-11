/**
 * Integration tests for the lesson hint balloon (ヒントの吹き出し).
 * レッスンモードに入る → ヒントの 1 ページ目が自動で開く → 吹き出しに本物のブロックが描かれ、指す場所と初回だけの
 * スポットライトがある → 進める → 最後に「正解のプログラムを確認する」→ 確認（いいえで何もしない／はいで入れる）
 * → 2 回目はスポットライト無し。吹き出しはヘッダーをドラッグして動かせる（画面の外には出ない）・「おわり」で閉じる。
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const CHALLENGE_ID = 'blocks-l1-click-say';
const SPOTLIGHT_SEEN_KEY = 'smalruby:lessonSpotlightSeen';

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

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
        // ヒントボタンを押さなくても、1 ページ目が自動で開く
        await findByXpath(byTestId('lesson-hint'));

        // ヒント 1: コスチュームタブを指す（spotlight ではない）
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

        // ヒント 3: 「言う」ブロック（CI の en では、en の課題の文言どおり "Hello!" と言う）
        await clickByTestId(driver, 'lesson-hint-next');
        await driver.wait(
            async () => (await hintBlockText(driver)).includes('Hello!'),
            20000,
            'the say block did not render',
        );
        expect(await hintBlockText(driver)).toContain('say');

        // もどる → 進める で同じヒントにもどれる
        await clickByTestId(driver, 'lesson-hint-prev');
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 2 of 7');
        await clickByTestId(driver, 'lesson-hint-next');
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 3 of 7');

        // 最後のページ: うまく動かないときは + 正解のプログラムを確認する
        for (let i = 0; i < 4; i++) await clickByTestId(driver, 'lesson-hint-next');
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 7 of 7');
        expect(await countByTestId(driver, 'lesson-hint-debug-title')).toBe(1);
        expect(
            await driver.executeScript(
                `return document.querySelectorAll('[data-testid="lesson-hint-debug"] li').length`,
            ),
        ).toBe(2);
        // 「進める」の代わりに「おわり」
        expect(await countByTestId(driver, 'lesson-hint-next')).toBe(0);
        expect(await textByTestId(driver, 'lesson-hint-finish')).toBe('Finish');

        // 押すと確認が出る。「いいえ」では何も変わらない
        expect(await textByTestId(driver, 'lesson-hint-insert-code')).toBe('See the correct program');
        await clickByTestId(driver, 'lesson-hint-insert-code');
        await findByXpath(byTestId('lesson-hint-insert-code-confirm'));
        expect(await textByTestId(driver, 'lesson-hint-insert-code-confirm')).toContain(
            'Replace your program with the correct program?',
        );
        await clickByTestId(driver, 'lesson-hint-insert-code-no');
        await driver.sleep(500);
        expect(await countByTestId(driver, 'lesson-hint-insert-code-confirm')).toBe(0);
        expect(await countByTestId(driver, 'lesson-hint')).toBe(1);
        expect(await editingTargetOpcodes(driver)).toEqual([]);

        // 「はい」で今までの「プログラムを入れる」と同じ（ブロックが入って吹き出しが閉じる）
        await clickByTestId(driver, 'lesson-hint-insert-code');
        await clickByTestId(driver, 'lesson-hint-insert-code-yes');
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
        // 2 回目も 1 ページ目が自動で開く
        await findByXpath(byTestId('lesson-hint'));
        expect(await textByTestId(driver, 'lesson-hint-position')).toBe('Hint 1 of 7');
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

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });

    test('the balloon can be dragged by its header, stays on screen and on the next page; Finish closes it', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await driver.manage().window().setRect({ width: 1300, height: 800 });
        await waitForLoadingFinished();
        await driver.executeScript('window.confirm = () => true;');
        await startChallenge(driver, CHALLENGE_ID);
        await findByXpath(byTestId('lesson-task-bar'));
        await findByXpath(byTestId('lesson-hint'));
        await driver.sleep(500);

        const rectOf = () =>
            driver.executeScript(`const r = document.querySelector('[data-testid="lesson-hint"]').getBoundingClientRect();
                return {left: r.left, top: r.top, right: r.right, bottom: r.bottom,
                    vw: window.innerWidth, vh: window.innerHeight};`);
        const before = await rectOf();
        expect(await attrByTestId(driver, 'lesson-hint', 'data-dragged')).toBe('false');
        // ヒント 1 はコスチュームタブを指す（しっぽがある）
        expect(
            await driver.executeScript(
                `return document.querySelectorAll('[data-testid="lesson-hint"] [data-balloon-arrow]').length`,
            ),
        ).toBe(1);

        // ヘッダーをマウスでドラッグして動かす
        const handle = await driver.findElement({ css: '[data-testid="lesson-hint-drag-handle"]' });
        await driver
            .actions()
            .move({ origin: handle, x: -40, y: 0 })
            .press()
            .move({ origin: handle, x: 60, y: 150 })
            .release()
            .perform();
        await driver.sleep(300);
        const moved = await rectOf();
        expect(Math.round(moved.left - before.left)).toBe(100);
        expect(Math.round(moved.top - before.top)).toBe(150);
        expect(await attrByTestId(driver, 'lesson-hint', 'data-dragged')).toBe('true');
        // 動かしたあとはしっぽを出さない
        expect(
            await driver.executeScript(
                `return document.querySelectorAll('[data-testid="lesson-hint"] [data-balloon-arrow]').length`,
            ),
        ).toBe(0);

        // 画面の外へは出ない（右下の角までドラッグする）
        await driver
            .actions()
            .move({ origin: handle, x: -40, y: 0 })
            .press()
            .move({ x: Math.floor(moved.vw) - 2, y: Math.floor(moved.vh) - 2 })
            .release()
            .perform();
        await driver.sleep(300);
        const clamped = await rectOf();
        expect(clamped.right).toBeLessThanOrEqual(clamped.vw);
        expect(clamped.bottom).toBeLessThanOrEqual(clamped.vh);
        expect(clamped.left).toBeGreaterThanOrEqual(0);
        expect(clamped.top).toBeGreaterThanOrEqual(0);

        // 次のページでも動かした位置のまま（画面の内側に収め直す）
        await clickByTestId(driver, 'lesson-hint-next');
        await driver.sleep(500);
        expect(await attrByTestId(driver, 'lesson-hint', 'data-dragged')).toBe('true');
        const next = await rectOf();
        expect(next.right).toBeLessThanOrEqual(next.vw);
        expect(next.bottom).toBeLessThanOrEqual(next.vh);

        // 最後のページの「おわり」で閉じる。ヒントで開き直すと、元の置き方にもどる
        for (let i = 0; i < 10 && (await countByTestId(driver, 'lesson-hint-finish')) === 0; i++) {
            await clickByTestId(driver, 'lesson-hint-next');
        }
        await clickByTestId(driver, 'lesson-hint-finish');
        await driver.sleep(300);
        expect(await countByTestId(driver, 'lesson-hint')).toBe(0);
        await clickByTestId(driver, 'lesson-task-bar-hint');
        await findByXpath(byTestId('lesson-hint'));
        expect(await attrByTestId(driver, 'lesson-hint', 'data-dragged')).toBe('false');
        await clickByTestId(driver, 'lesson-task-bar-quit');

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });
});
