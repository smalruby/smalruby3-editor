import path from 'path';
import { By, Key } from 'selenium-webdriver';
import SeleniumHelper from '../helpers/selenium-helper';

// Typing in the Japanese tab needs no ruled lines (Issue #1731, W10): Enter
// after a line that ends with `:` indents the next line by 4 spaces (the
// width of the standard form), and the ruled lines are drawn only on the
// problem form. The program is written for this test.
const seleniumHelper = new SeleniumHelper();
const { getDriver, getLogs, loadUri } = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

const editorValue = (d) => d.executeScript('return window.monacoEditor.getValue()');

let driver;

describe('Japanese tab: typing the indent', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('indents by 4 spaces after `:` and goes back with Backspace', async () => {
        await loadUri(`${uri}?locale=ja&tab=japanese`);
        await driver.wait(
            () =>
                driver.executeScript(
                    'return !!window.monacoEditor && window.monacoEditor.getModel().getLanguageId() === "dncl"',
                ),
            10000,
            'The Japanese tab did not start',
        );
        await driver.executeScript('window.monacoEditor.setValue(""); window.monacoEditor.focus();');
        const textarea = await driver.findElement(By.css('.monaco-editor textarea'));
        await textarea.sendKeys('x = 3', Key.ENTER, 'もし x > 1 ならば:', Key.ENTER);
        await textarea.sendKeys('表示する(x)', Key.ENTER, Key.BACK_SPACE, '表示する(0)');
        await driver.wait(
            async () => (await editorValue(driver)).endsWith('表示する(0)'),
            10000,
            'The lines were not typed',
        );
        expect(await editorValue(driver)).toBe(
            ['x = 3', 'もし x > 1 ならば:', '    表示する(x)', '表示する(0)'].join('\n'),
        );

        expect(await getLogs()).toEqual([]);
    });
});
