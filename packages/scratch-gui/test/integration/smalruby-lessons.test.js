/**
 * Integration tests for lesson mode (コース › レッスン › チャレンジ).
 * チャレンジを開く → 新しい作品・課題バー・絞ったパレット → やめる → 元にもどる。
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickBlocksCategory,
    clickButton,
    clickText,
    findByXpath,
    getDriver,
    getLogs,
    loadUri,
    scope,
    textExists,
    waitForLoadingFinished,
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const CHALLENGE_ID = 'blocks-l1-click-say';

const byTestId = (testId) => `//*[@data-testid="${testId}"]`;

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
        // 動的カテゴリ（変数・ブロック定義）も allowedBlocks に無ければ出ない
        expect(await textExists('Variables', scope.blocksTab)).toBe(false);
        expect(await textExists('My Blocks', scope.blocksTab)).toBe(false);
        expect(await textExists('Make a Variable', scope.blocksTab)).toBe(false);

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
        expect(await textExists('Variables', scope.blocksTab)).toBe(true);
        expect(await textExists('My Blocks', scope.blocksTab)).toBe(true);

        // 既知の無害なログ (Google Drive の初期化失敗など) は getLogs() が除く
        expect(await getLogs()).toEqual([]);
    });

    // パレットを絞らないチャレンジ（allowedBlocks: null）は、レッスン 1 にはもう無い（11 個とも絞る）。
    // その場合に全部が出ることは reducer の unit テスト（getLessonAllowedBlocks が null）で確かめる
    test('a challenge later in the lesson restricts the palette to its own categories', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await waitForLoadingFinished();

        await startChallenge(driver, 'blocks-l1-broadcast');
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(1000);

        const position = await findByXpath(byTestId('lesson-task-bar-position'));
        expect(await position.getText()).toBe('9 of 11');
        expect(await textExists('Events', scope.blocksTab)).toBe(true);
        expect(await textExists('Looks', scope.blocksTab)).toBe(true);
        expect(await textExists('Motion', scope.blocksTab)).toBe(false);

        await clickByTestId(driver, 'lesson-task-bar-quit');
        await driver.sleep(500);
        expect(await countByTestId(driver, 'lesson-task-bar')).toBe(0);
    });

    test('a challenge that uses variables shows the Variables category with the make-a-variable button', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await waitForLoadingFinished();

        await startChallenge(driver, 'blocks-l1-count');
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(1000);

        const position = await findByXpath(byTestId('lesson-task-bar-position'));
        expect(await position.getText()).toBe('8 of 11');
        expect(await textExists('Variables', scope.blocksTab)).toBe(true);
        expect(await textExists('Make a Variable', scope.blocksTab)).toBe(true);
        // リストのブロックは allowedBlocks に無いので「リストを作る」は出ない
        expect(await textExists('Make a List', scope.blocksTab)).toBe(false);
        expect(await textExists('My Blocks', scope.blocksTab)).toBe(false);

        await clickByTestId(driver, 'lesson-task-bar-quit');
        await driver.sleep(500);
        expect(await countByTestId(driver, 'lesson-task-bar')).toBe(0);
    });

    test('a list made in a list challenge shows its box on the stage', async () => {
        await loadUri(`${uri}?no_beforeunload=1`);
        await waitForLoadingFinished();

        await startChallenge(driver, 'blocks-l1-message-list');
        await findByXpath(byTestId('lesson-task-bar'));
        await driver.sleep(1000);

        await clickBlocksCategory('Variables');
        await clickText('Make a List');
        const input = await findByXpath("//input[@name='New list name:']");
        await input.sendKeys('talk');
        await clickButton('OK');
        await driver.sleep(1000);

        // 「リストを作る」で作ったリストはステージに箱が出る（ヒント 1 のとおり）。リストのレポーター
        // （モニターのチェックボックス）を allowedBlocks で落とすと出なくなる
        const visibleListMonitors = await driver.executeScript(`
            return window.smalruby.vm.runtime._monitorState.valueSeq()
                .filter(m => m.get('mode') === 'list' && m.get('visible')).count();
        `);
        expect(visibleListMonitors).toBe(1);

        await clickByTestId(driver, 'lesson-task-bar-quit');
        await driver.sleep(500);
        // 「リストを作る」の prompt とリストのモニターが出す upstream の propTypes の警告（SEVERE）を
        // ここで読み捨てる。retryTimes で後から走りなおすテストのログ確認に混ざらないように
        await getLogs({ includeAllLevels: true });
    });
});
