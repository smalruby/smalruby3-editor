import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const {
    getDriver,
    loadUri,
    clickText
} = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Monaco Editor Paste Action', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        if (driver) {
            await driver.quit();
        }
    });

    test('Custom paste action is registered and works', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');

        // Wait for Monaco Editor to be ready
        await driver.wait(async () => {
            return await driver.executeScript('return !!window.monacoEditor;');
        }, 10000);

        // Mock clipboard
        await driver.executeScript('navigator.clipboard.readText = () => Promise.resolve("pasted_text_from_mock");');

        // Trigger the custom action
        await driver.executeScript(`
            const action = window.monacoEditor.getAction('smalruby.paste');
            if (action) {
                return action.run();
            }
            throw new Error('Action smalruby.paste not found');
        `);

        // Wait a bit for async paste
        await driver.sleep(500);

        // Check if text is pasted
        const code = await driver.executeScript('return window.monacoEditor.getValue();');
        expect(code).toContain('pasted_text_from_mock');
    });
});
