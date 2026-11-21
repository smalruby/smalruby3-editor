import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickText, clickXpath, getDriver, loadUri } = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

const count = (selector) => driver.executeScript(`return document.querySelectorAll('${selector}').length;`);

describe('Smalrubot S1 legacy card', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('shows both cards and the old card adds ArtecRobo with the rename alert', async () => {
        await loadUri(uri);
        await clickXpath('//button[@title="Add Extension"]');

        // Both the current card and the old card are in the library, with different ids.
        expect(await count('#smalrubotS1')).toBe(1);
        expect(await count('#smalrubotS1Legacy')).toBe(1);

        await clickText('Smalrubot S1');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        expect(await count('[data-testid="smalrubot-s1-renamed-alert"]')).toBe(1);
        const loaded = await driver.executeScript(
            'return document.querySelectorAll("[id^=connectionModal]").length > 0 || ' +
                'document.querySelector("[data-testid=smalrubot-s1-unsupported-help]") !== null || ' +
                'document.querySelector("[data-testid=smalrubot-s1-initial-connect]") !== null;',
        );
        // The same extension as the current card is loaded, so its connection flow opens.
        expect(loaded).toBe(true);
    });
});
