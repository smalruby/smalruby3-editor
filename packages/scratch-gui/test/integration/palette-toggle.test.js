import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    clickXpath,
    findByXpath,
    getDriver,
    getLogs,
    loadUri
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Palette toggle', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('◀ button is visible when palette is open', async () => {
        await loadUri(uri);
        await clickText('Code');
        // The hide-palette button (◀) should be visible by default
        await findByXpath('//button[@title="ブロックパレットを隠す"]');
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    test('clicking ◀ hides the palette and shows ▶', async () => {
        await loadUri(uri);
        await clickText('Code');
        // Click the hide button
        await clickXpath('//button[@title="ブロックパレットを隠す"]');
        // The show-palette button (▶) should now be visible
        await findByXpath('//button[@title="ブロックパレットを表示する"]');
        // The toolbox should be hidden
        const toolboxVisible = await driver.executeScript(
            'const el = document.querySelector(".blocklyToolboxDiv"); return el ? el.style.display !== "none" : true;'
        );
        expect(toolboxVisible).toBe(false);
        // The extension button should be hidden
        const extensionButtonVisible = await driver.executeScript(
            'const el = document.querySelector(\'[class*="extension-button_extension-button-container"]\'); return el ? el.style.display !== "none" : false;'
        );
        expect(extensionButtonVisible).toBe(false);
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    test('clicking ▶ shows the palette again', async () => {
        await loadUri(uri);
        await clickText('Code');
        // First hide the palette
        await clickXpath('//button[@title="ブロックパレットを隠す"]');
        await findByXpath('//button[@title="ブロックパレットを表示する"]');
        // Now show it again
        await clickXpath('//button[@title="ブロックパレットを表示する"]');
        // The hide-palette button should be visible again
        await findByXpath('//button[@title="ブロックパレットを隠す"]');
        // The toolbox should be visible again
        const toolboxVisible = await driver.executeScript(
            'const el = document.querySelector(".blocklyToolboxDiv"); return el ? el.style.display !== "none" : true;'
        );
        expect(toolboxVisible).toBe(true);
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    test('palette toggle works after switching sprite', async () => {
        await loadUri(uri);
        await clickText('Code');
        // Hide palette
        await clickXpath('//button[@title="ブロックパレットを隠す"]');
        await findByXpath('//button[@title="ブロックパレットを表示する"]');
        // Switch to backdrop tab and back
        await clickText('Backdrops');
        await clickText('Code');
        // Show palette button should still be visible (state preserved)
        await findByXpath('//button[@title="ブロックパレットを表示する"]');
        // Show the palette again
        await clickXpath('//button[@title="ブロックパレットを表示する"]');
        await findByXpath('//button[@title="ブロックパレットを隠す"]');
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });
});
