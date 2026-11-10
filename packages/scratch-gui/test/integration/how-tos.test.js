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

describe.skip('Working with the how-to library', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Choosing a how-to', async () => {
        await loadUri(uri);
        await clickText('Costumes');
        // === Smalruby: Start of help menu ===
        // Tutorials is reached through the "?" menu in Smalruby.
        await clickXpath('//*[@data-testid="menu-bar-about"]');
        await clickXpath('//*[@data-testid="menu-bar-help-tutorials"]');
        // === Smalruby: End of help menu ===
        await clickText('Add a Backdrop'); // Modal should close
        // Make sure YouTube video on card appears
        await findByXpath('//div[contains(@class, "step-video")]');
        const logs = await getLogs();
        await expect(logs).toEqual([]);
    });

    // @todo navigating cards, etc.
});
