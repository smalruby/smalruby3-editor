import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickText, clickXpath, findByText, findByXpath, getDriver, getLogs, loadUri, scope } = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

const loadExtension = async (d, extensionName) => {
    // Open extension chooser
    await clickXpath('//button[@title="Add Extension"]');
    // Click the extension by name
    await clickText(extensionName);
    // Wait for connection modal to appear and close it
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Close connection modal if visible
    try {
        const closeButton = await findByXpath(
            '//div[contains(@class, "modal_header-item")]//*[contains(@class, "close-button")]',
        );
        await closeButton.click();
    } catch (_) {
        // Modal may have auto-closed
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
};

describe('SmalrubotS1 firmware flash', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Artec Co., Ltd. is shown as collaborator in extension library', async () => {
        await loadUri(uri);
        // Open extension chooser
        await clickXpath('//button[@title="Add Extension"]');
        // Find the smalrubotS1 extension and check collaborator text
        const collaborator = await findByText('Artec Co., Ltd.');
        expect(await collaborator.isDisplayed()).toBe(true);

        // Go back to editor
        await driver.navigate().back();
        await new Promise((resolve) => setTimeout(resolve, 500));
    });
});
