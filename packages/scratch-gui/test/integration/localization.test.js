import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';
import {
    SETTINGS_MENU_XPATH,
    FILE_MENU_XPATH
} from '../helpers/menu-xpaths';

const {
    clickBlocksCategory,
    clickText,
    clickXpath,
    findByText,
    findByXpath,
    getDriver,
    getLogs,
    loadUri,
    waitForLoadingFinished,
    notExistsByXpath,
    rightClickText,
    scope
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Localization', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Switching languages', async () => {
        await loadUri(uri);

        // Add a sprite to make sure it stays when switching languages
        await clickXpath('//button[@aria-label="Choose a Sprite"]');
        await clickText('Apple', scope.modal); // Closes modal

        await clickXpath(SETTINGS_MENU_XPATH);
        await clickText('Language', scope.menuBar);
        await driver.sleep(500);
        await clickText('日本語');
        await waitForLoadingFinished();
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for blocks refresh

        // Make sure the blocks are translating
        await clickBlocksCategory('調べる'); // Sensing category in Japanese
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for blocks to scroll
        await clickText('答え'); // Find the "answer" block in Japanese

        // Change to the costumes tab to confirm other parts of the GUI are translating
        await clickText('コスチューム');

        // After switching languages, make sure Apple sprite still exists
        await rightClickText('Apple', scope.spriteTile); // Make sure it is there

        // Remounting re-attaches the beforeunload callback. Make sure to remove it
        driver.executeScript('window.onbeforeunload = undefined;');

        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    // Regression test for #4476, blocks in wrong language when loaded with locale
    test('Loading with locale shows correct blocks', async () => {
        await loadUri(`${uri}?locale=de`);
        await clickBlocksCategory('Fühlen'); // Sensing category in German
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for blocks to scroll
        await clickText('Antwort'); // Find the "answer" block in German
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    // === Smalruby: skipped after the upstream Blockly v12 / scratch-blocks v2
    // upgrade — relies on the flyout-click report tooltip which does not open
    // reliably in our headless Selenium runs. Tracking under follow-up issue. ===
    // test for #5445
    test.skip('Loading with locale shows correct translation for string length block parameter', async () => {
        await loadUri(`${uri}?locale=ja`);
        await clickBlocksCategory('演算'); // Operators category in Japanese
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for blocks to scroll
        await clickText('の長さ', scope.blocksTab); // Click "length <apple>" block
        await findByText('3', scope.reportedValue); // Tooltip with result
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    // Regression test for ENA-142, monitor can lag behind language selection
    test('Monitor labels update on locale change', async () => {
        await loadUri(uri);
        await clickXpath(FILE_MENU_XPATH);
        await clickText('Load from your computer');
        const input = await findByXpath('//input[@accept=".sb,.sb2,.sb3"]');
        await input.sendKeys(path.resolve(__dirname, '../fixtures/monitor-variable.sb3'));
        await waitForLoadingFinished();

        // Monitors are present
        await findByText('username', scope.monitors);
        await findByText('language', scope.monitors);

        // Change locale to ja
        await clickXpath(SETTINGS_MENU_XPATH);
        await clickText('Language', scope.menuBar);
        await driver.sleep(500);
        await clickText('日本語');
        await waitForLoadingFinished();

        // Monitor labels updated
        await findByText('ユーザー名', scope.monitors);
        await findByText('言語', scope.monitors);

        const logs = await getLogs();
        expect(logs).toEqual([]);
    });
});
