// === Smalruby: This file is Smalruby-specific (integration test for Touch pointer event patch) ===
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    getDriver,
    loadUri
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Touch pointer event compatibility patch', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('internal Blockly.Touch.checkTouchIdentifier recognizes pointerdown', async () => {
        await loadUri(uri);
        await clickText('Code');

        // Wait for __smalrubyBlocklyTouch to be exposed
        await driver.wait(async () => {
            const available = await driver.executeScript(
                'return !!window.__smalrubyBlocklyTouch;'
            );
            return available;
        }, 10000);

        // Verify the postinstall patch was applied to the compiled source.
        // The internal Blockly.Touch.checkTouchIdentifier should now recognize
        // pointerdown as a gesture start event.
        const result = await driver.executeScript(`
            var Touch = window.__smalrubyBlocklyTouch;

            // The checkTouchIdentifier function source should contain 'pointerdown'
            // after the postinstall patch.
            var source = Touch.checkTouchIdentifier.toString();
            var hasPointerdown = source.indexOf('pointerdown') >= 0;

            return JSON.stringify({
                hasPointerdown: hasPointerdown,
                sourceSnippet: source.substring(0, 300)
            });
        `);

        const parsed = JSON.parse(result);
        // eslint-disable-next-line no-console
        console.log('checkTouchIdentifier source:', parsed.sourceSnippet);
        expect(parsed.hasPointerdown).toBe(true);
    });
});
