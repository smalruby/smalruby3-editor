import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';
import {
    SETTINGS_MENU_XPATH,
    FILE_MENU_XPATH,
    EDIT_MENU_XPATH
} from '../helpers/menu-xpaths';

const {
    clickText,
    clickXpath,
    findByText,
    findByXpath,
    getDriver,
    loadUri,
    rightClickText,
    scope
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Menu bar settings', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('File->New should be enabled', async () => {
        await loadUri(uri);
        await clickXpath(FILE_MENU_XPATH);
        await findByXpath('//*[li[span[text()="New"]] and not(@data-tip="tooltip")]');
    });

    test('File->Load should be enabled', async () => {
        await loadUri(uri);
        await clickXpath(FILE_MENU_XPATH);
        await findByXpath('//*[li[text()="Load from your computer"] and not(@data-tip="tooltip")]');
    });

    test('File->Save should be enabled', async () => {
        await loadUri(uri);
        await clickXpath(FILE_MENU_XPATH);
        await findByXpath('//*[li[span[text()="Save to your computer"]] and not(@data-tip="tooltip")]');
    });

    test.skip('Share button should NOT be enabled', async () => {
        await loadUri(uri);
        await findByXpath('//div[button[div[span[text()="Share"]]] and @data-tip="tooltip"]');
    });

    test('Logo should be clickable', async () => {
        await loadUri(uri);
        await findByXpath('//img[@alt="Smalruby"]');
    });

    test('(GH#4064) Project name should be editable', async () => {
        await loadUri(uri);
        const el = await findByXpath('//input[@value="Smalruby Project"]');
        await el.sendKeys(' - Personalized');
        await clickText('Costumes'); // just to blur the input
        await clickXpath('//input[@value="Smalruby Project - Personalized"]');
    });

    test('User is not warned before uploading project file over a fresh project', async () => {
        await loadUri(uri);
        await clickXpath(FILE_MENU_XPATH);
        await clickText('Load from your computer');
        const input = await findByXpath('//input[@accept=".sb,.sb2,.sb3"]');
        await input.sendKeys(path.resolve(__dirname, '../fixtures/project1.sb3'));
        // No replace alert since no changes were made
        await findByText('project1-sprite');
    });

    test('User is warned before uploading project file over an edited project', async () => {
        await loadUri(uri);

        // Change the project by deleting a sprite
        await rightClickText('Sprite1', scope.spriteTile);
        await clickText('delete', scope.contextMenu);
        await clickText('yes', scope.modal);

        await clickXpath(FILE_MENU_XPATH);
        await clickText('Load from your computer');
        const input = await findByXpath('//input[@accept=".sb,.sb2,.sb3"]');
        await input.sendKeys(path.resolve(__dirname, '../fixtures/project1.sb3'));
        await driver.switchTo().alert()
            .accept();
        await findByText('project1-sprite');
    });

    test('Color mode picker shows color modes', async () => {
        await loadUri(uri);
        await clickXpath(SETTINGS_MENU_XPATH);
        await clickText('Color Mode', scope.menuBar);

        expect(await (await findByText('Original', scope.menuBar)).isDisplayed()).toBe(true);
        expect(await (await findByText('High Contrast', scope.menuBar)).isDisplayed()).toBe(true);
    });

    test('Color mode picker switches to high contrast', async () => {
        await loadUri(uri);
        await clickXpath(SETTINGS_MENU_XPATH);
        await clickText('Color Mode', scope.menuBar);
        await clickText('High Contrast', scope.menuBar);

        // There is a tiny delay for the color color mode to be applied to the categories.
        await driver.wait(async () => {
            const motionCategoryDiv = await findByXpath(
                '//div[contains(@class, "scratchCategoryMenuItem") and ' +
                'contains(@class, "scratchCategoryId-motion")]/*[1]');
            const color = await motionCategoryDiv.getCssValue('background-color');

            // Documentation for getCssValue says it depends on how the browser
            // returns the value. Locally I am seeing 'rgba(128, 181, 255, 1)',
            // but this is a bit flexible just in case.
            return /128,\s?181,\s?255/.test(color) || color.includes('80B5FF');
        }, 5000, 'Motion category color does not match high contrast color mode');
    });

    test('Settings menu switches between submenus', async () => {
        await loadUri(uri);
        await clickXpath(SETTINGS_MENU_XPATH);

        // Language and color mode options not visible yet
        expect(await (await findByText('High Contrast', scope.menuBar)).isDisplayed()).toBe(false);
        expect(await (await findByText('Esperanto', scope.menuBar)).isDisplayed()).toBe(false);

        await clickText('Color Mode', scope.menuBar);

        // Only color mode options visible
        expect(await (await findByText('High Contrast', scope.menuBar)).isDisplayed()).toBe(true);
        expect(await (await findByText('Esperanto', scope.menuBar)).isDisplayed()).toBe(false);

        await clickText('Language', scope.menuBar);

        // Only language options visible
        expect(await (await findByText('High Contrast', scope.menuBar)).isDisplayed()).toBe(false);
        expect(await (await findByText('Esperanto', scope.menuBar)).isDisplayed()).toBe(true);
    });

    test('Menu labels hidden when width is equal to 1024', async () => {
        await loadUri(uri);
        await driver.manage()
            .window()
            .setSize(1024, 768);

        const collapsibleMenus = ['Settings', 'File', 'Edit', 'Tutorials'];
        for (const menu of collapsibleMenus) {
            const settingsMenu = await findByText(menu, scope.menuBar);
            expect(await settingsMenu.isDisplayed()).toBe(false);
        }
    });

    test('Menu labels shown when width is greater than 1024', async () => {
        await loadUri(uri);
        await driver.manage()
            .window()
            .setSize(1200, 768);

        const collapsibleMenus = ['Settings', 'File', 'Edit', 'Tutorials'];
        for (const menu of collapsibleMenus) {
            const settingsMenu = await findByText(menu, scope.menuBar);
            expect(await settingsMenu.isDisplayed()).toBe(true);
        }
    });

    test('Settings menu closes when clicked again while open', async () => {
        await loadUri(uri);
        // Open the settings menu
        await clickXpath(SETTINGS_MENU_XPATH);
        // Verify it is open by checking for a menu item
        const langOption = await findByXpath(
            '//ul[contains(@class, "menu_menu")]'
        );
        expect(await langOption.isDisplayed()).toBe(true);
        // Click the settings menu button again via JS to avoid interception by the open menu list
        const settingsBtn = await driver.findElement({xpath: SETTINGS_MENU_XPATH});
        await driver.executeScript('arguments[0].click()', settingsBtn);
        // Wait for the menu to close
        await driver.wait(async () => {
            const openMenus = await driver.findElements({xpath: '//ul[contains(@class, "menu_menu")]'});
            return openMenus.length === 0;
        }, 5000, 'Settings menu did not close after second click');
    });

    test('File menu closes when clicked again while open', async () => {
        await loadUri(uri);
        await clickXpath(FILE_MENU_XPATH);
        const menuList = await findByXpath('//ul[contains(@class, "menu_menu")]');
        expect(await menuList.isDisplayed()).toBe(true);
        // Click the file menu button again via JS to avoid interception by the open menu list
        const fileBtn = await driver.findElement({xpath: FILE_MENU_XPATH});
        await driver.executeScript('arguments[0].click()', fileBtn);
        // Wait for the menu to close
        await driver.wait(async () => {
            const openMenus = await driver.findElements({xpath: '//ul[contains(@class, "menu_menu")]'});
            return openMenus.length === 0;
        }, 5000, 'File menu did not close after second click');
    });

    test('Edit menu closes when clicked again while open', async () => {
        await loadUri(uri);
        await clickXpath(EDIT_MENU_XPATH);
        const menuList = await findByXpath('//ul[contains(@class, "menu_menu")]');
        expect(await menuList.isDisplayed()).toBe(true);
        // Click the edit menu button again via JS to avoid interception by the open menu list
        const editBtn = await driver.findElement({xpath: EDIT_MENU_XPATH});
        await driver.executeScript('arguments[0].click()', editBtn);
        // Wait for the menu to close
        await driver.wait(async () => {
            const openMenus = await driver.findElements({xpath: '//ul[contains(@class, "menu_menu")]'});
            return openMenus.length === 0;
        }, 5000, 'Edit menu did not close after second click');
    });
});
