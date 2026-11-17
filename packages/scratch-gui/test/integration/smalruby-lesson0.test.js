/**
 * Integration tests for lesson 0「スモウルビーをたんけんしよう」（#2134）.
 * - レッスン表: レッスン 0 がコースの最初に出て、コースの数（n / 11）には入らない。
 * - 0-1: ステージのネコをマウスでつかんで動かすと「できた！」。
 * - 0-3: 2 つのブロックをくっつけたプログラムを、コードエリアで押すと「できた！」。
 * - 0-8: 画面の部分をクリックして答えるクイズ。まちがえると正しい場所が光り、クリックは下の部品に届かない。
 *   5 問とも正しい場所をクリックすると「できた！」。
 * 窓は授業のパソコンと同じ 1300×600。
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

let driver;

const clickByTestId = (testId) => driver.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const countByTestId = (testId) =>
    driver.executeScript(`return document.querySelectorAll('[data-testid="${testId}"]').length`);

const attrByTestId = (testId, name) =>
    driver.executeScript(
        `const el = document.querySelector('[data-testid="${testId}"]'); return el ? el.getAttribute('${name}') : null;`,
    );

const resetProgress = () =>
    driver.executeScript(`window.localStorage.removeItem('smalruby:lessonProgress');
        window.localStorage.removeItem('smalruby:lessonSpotlightSeen');`);

const loadEditor = async () => {
    await loadUri(`${uri}?no_beforeunload=1`);
    await driver.manage().window().setRect({ width: 1300, height: 600 });
    await waitForLoadingFinished();
    await resetProgress();
};

const openChallenge = async (challengeId) => {
    await driver.executeScript(`window.smalruby.startChallenge(${JSON.stringify(challengeId)})`);
    await findByXpath(byTestId('lesson-task-bar'));
    await driver.sleep(1000);
};

// レッスン 0 はヒントが自動で開く。部品の上に重なるので、課題バーの「ヒント」で閉じる
const closeHint = async () => {
    if ((await countByTestId('lesson-hint')) > 0) await clickByTestId('lesson-task-bar-hint');
    await driver.wait(async () => (await countByTestId('lesson-hint')) === 0, 5000, 'the hint did not close');
};

const waitForCompletedToast = async (challengeId) => {
    await findByXpath(byTestId('lesson-completed-toast'));
    expect(await attrByTestId('lesson-completed-toast', 'data-challenge-id')).toBe(challengeId);
};

// 画面の部分の矩形の、見えている部分の真ん中（hint-targets.js と同じ探し方）
const centerOf = (selector) =>
    driver.executeScript(
        `const els = Array.from(document.querySelectorAll(arguments[0]))
            .map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
        if (els.length === 0) return null;
        // 画面に見えている部分の真ん中（スプライトリストは 1300×600 で下が切れる）
        const r = els[0];
        const top = Math.max(r.top, 0);
        const bottom = Math.min(r.bottom, window.innerHeight);
        const left = Math.max(r.left, 0);
        const right = Math.min(r.right, window.innerWidth);
        return { x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2) };`,
        selector,
    );

const clickAt = (point) => driver.actions().move({ origin: 'viewport', x: point.x, y: point.y }).click().perform();

describe('Lesson 0 (#2134)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('the lessons library shows lesson 0 first, outside the 11 of the course', async () => {
        await loadEditor();
        await driver.executeScript(`document.querySelector('[data-testid="menu-bar-lessons"]').click()`);
        await findByXpath(byTestId('lessons-library-lesson-blocks-l0'));
        const lessons = await driver.executeScript(
            `return Array.from(document.querySelectorAll('[data-testid="lessons-library-course-kyou-kara-programmer"] [data-testid^="lessons-library-lesson-"]')).map((el) => el.getAttribute('data-testid'));`,
        );
        expect(lessons.slice(0, 2)).toEqual(['lessons-library-lesson-blocks-l0', 'lessons-library-lesson-blocks-l1']);
        const progress = await driver.executeScript(
            `return document.querySelector('[data-testid="lessons-library-course-kyou-kara-programmer"] [data-testid="lessons-library-course-progress-text"]').textContent`,
        );
        expect(progress).toMatch(/0 \/ 11/);
        expect(await getLogs()).toEqual([]);
    });

    test('0-1: dragging the cat on the stage completes it', async () => {
        await loadEditor();
        await openChallenge('blocks-l0-drag-cat');
        // 「なまえ」の札はレッスン 0 では最初から出ている
        expect(await countByTestId('lesson-part-names')).toBe(1);
        await closeHint();
        const center = await centerOf('[class*="stage_stage-wrapper_"] canvas');
        await driver
            .actions()
            .move({ origin: 'viewport', x: center.x, y: center.y })
            .press()
            .move({ origin: 'viewport', x: center.x + 20, y: center.y + 10, duration: 200 })
            .move({ origin: 'viewport', x: center.x + 60, y: center.y + 40, duration: 200 })
            .release()
            .perform();
        await waitForCompletedToast('blocks-l0-drag-cat');
        expect(await getLogs()).toEqual([]);
    });

    test('0-3: clicking the two snapped blocks in the code area completes it', async () => {
        await loadEditor();
        await openChallenge('blocks-l0-snap');
        // 置いてくっつけたのと同じ状態にする（ヒントの「プログラムを入れる」と同じ変換）
        await clickByTestId('lesson-hint-next');
        await clickByTestId('lesson-hint-next');
        await clickByTestId('lesson-hint-next');
        await findByXpath(byTestId('lesson-hint-insert-code'));
        await clickByTestId('lesson-hint-insert-code');
        await findByXpath(byTestId('lesson-hint-insert-code-yes'));
        await clickByTestId('lesson-hint-insert-code-yes');
        await driver.wait(
            async () =>
                (
                    await driver.executeScript(
                        `return Object.values(window.smalruby.vm.editingTarget.blocks._blocks).map((b) => b.opcode)`,
                    )
                ).includes('motion_turnright'),
            20000,
            'the blocks were not inserted',
        );
        // 入れただけでは「できた」にならない（押して動かす）
        await driver.sleep(500);
        expect(await countByTestId('lesson-completed-toast')).toBe(0);
        await closeHint();
        await driver.sleep(500);
        const block = await centerOf('[class*="blocks_blocks_"] .blocklyBlockCanvas > .blocklyDraggable');
        await clickAt(block);
        await waitForCompletedToast('blocks-l0-snap');
        expect(await getLogs()).toEqual([]);
    });

    test('0-8: answering the 5 questions by clicking the parts completes it', async () => {
        await loadEditor();
        await openChallenge('blocks-l0-where');
        // クイズでは名前の札も「なまえ」のボタンも出さない
        expect(await countByTestId('lesson-part-names')).toBe(0);
        expect(await countByTestId('lesson-task-bar-part-names')).toBe(0);
        await closeHint();
        await findByXpath(byTestId('lesson-part-quiz-question'));
        const where = {
            palette: '[class*="blocks_blocks_"] .blocklyFlyout',
            codeArea: null,
            soundsTab: '[class*="gui_tab_"]:nth-child(3)',
            greenFlag: '[class*="green-flag_green-flag_"]',
            spriteList: '[class*="sprite-selector_sprite-selector_"]',
        };
        // まちがえると「ちがうよ」と出て、正しい場所が光る。クリックは下の部品（タブ）に届かない
        expect(await attrByTestId('lesson-part-quiz-question', 'data-part')).toBe('palette');
        await clickAt(await centerOf(where.soundsTab));
        expect(await attrByTestId('lesson-part-quiz-feedback', 'data-result')).toBe('wrong');
        expect(await countByTestId('lesson-part-quiz-reveal')).toBe(1);
        expect(
            await driver.executeScript(
                `return document.querySelector('[class*="gui_tab_"]:nth-child(1)').getAttribute('aria-selected')`,
            ),
        ).toBe('true');
        for (let i = 0; i < 5; i++) {
            const part = await attrByTestId('lesson-part-quiz-question', 'data-part');
            let point;
            if (part === 'codeArea') {
                // コードエリアはパレットの右の広いところ（下の問いの札をよける）
                const r = await driver.executeScript(
                    `const s = document.querySelector('[class*="blocks_blocks_"] .blocklySvg').getBoundingClientRect();
                    const f = document.querySelector('[class*="blocks_blocks_"] .blocklyFlyout').getBoundingClientRect();
                    return { x: Math.round((f.right + s.right) / 2), y: Math.round(s.top + 60) };`,
                );
                point = r;
            } else {
                point = await centerOf(where[part]);
            }
            await clickAt(point);
            await driver.sleep(200);
        }
        await findByXpath(byTestId('lesson-part-quiz-done'));
        await waitForCompletedToast('blocks-l0-where');
        // 答えのクリックで、緑の旗（プログラム）もタブも動いていない
        expect(
            await driver.executeScript(
                `return document.querySelector('[class*="gui_tab_"]:nth-child(1)').getAttribute('aria-selected')`,
            ),
        ).toBe('true');
        expect(await getLogs()).toEqual([]);
    });
});
