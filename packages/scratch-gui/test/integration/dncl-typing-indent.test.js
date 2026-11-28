import path from 'path';
import { Key } from 'selenium-webdriver';
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

    // Each key goes alone: Enter sent in one string with the text is typed as a
    // line break, which Monaco does not indent. A word typed with the IME comes
    // in at once (`ime`), not key by key (Issue #2554).
    const startTyping = async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await driver.wait(
            () =>
                driver.executeScript(
                    'return !!window.monacoEditor && window.monacoEditor.getModel().getLanguageId() === "dncl"',
                ),
            10000,
            'The Japanese tab did not start',
        );
        await driver.executeScript('window.monacoEditor.setValue(""); window.monacoEditor.focus();');
        const textarea = await driver.switchTo().activeElement();
        return async (...keys) => {
            for (const key of keys) {
                if (typeof key === 'object') {
                    // Compose the word, then commit it, as the IME does.
                    await driver.sendDevToolsCommand('Input.imeSetComposition', {
                        text: key.ime,
                        selectionStart: key.ime.length,
                        selectionEnd: key.ime.length,
                    });
                    await driver.sleep(100);
                    await driver.sendDevToolsCommand('Input.insertText', { text: key.ime });
                } else {
                    await textarea.sendKeys(key);
                }
                await driver.sleep(100);
            }
        };
    };

    test('indents by 4 spaces after `:` and goes back with Backspace', async () => {
        const type = await startTyping();
        await type(
            'x = 3',
            Key.ENTER,
            'もし x > 1 ならば:',
            Key.ENTER,
            '表示する(x)',
            Key.ENTER,
            Key.BACK_SPACE,
            '表示する(0)',
        );
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

    // Issue #2554: `そうでなくもし … ならば:` indents the next line, the else
    // lines and the closing lines go back to the depth of their block.
    test('indents after else-if and else, and takes them back to the depth of `もし`', async () => {
        const type = await startTyping();
        await type(
            'もし x > 1 ならば:',
            Key.ENTER,
            '表示する(x)',
            Key.ENTER,
            { ime: 'そうでなくもし' },
            ' x > 0 ならば:',
            Key.ENTER,
            '表示する(1)',
            Key.ENTER,
            { ime: 'そうでなければ' },
            ':',
            Key.ENTER,
            '表示する(0)',
            Key.ENTER,
            Key.BACK_SPACE,
            '表示する(9)',
        );
        await driver.wait(
            async () => (await editorValue(driver)).endsWith('表示する(9)'),
            10000,
            'The lines were not typed',
        );
        expect(await editorValue(driver)).toBe(
            [
                'もし x > 1 ならば:',
                '    表示する(x)',
                'そうでなくもし x > 0 ならば:',
                '    表示する(1)',
                'そうでなければ:',
                '    表示する(0)',
                '表示する(9)',
            ].join('\n'),
        );

        expect(await getLogs()).toEqual([]);
    });

    test('takes else and the closing line back to the depth of the inner block', async () => {
        const type = await startTyping();
        await type(
            'i が 3 より小さい の間',
            // The completion of the opener is shown without the `:`.
            Key.ESCAPE,
            Key.ENTER,
            'もし i > 1 ならば',
            Key.ESCAPE,
            Key.ENTER,
            '表示する(i)',
            Key.ENTER,
            { ime: 'そうでなければ' },
            Key.ENTER,
            '表示する(0)',
            Key.ENTER,
            { ime: 'を実行する' },
            Key.ENTER,
            'i = i + 1',
            Key.ENTER,
            { ime: 'を繰り返す' },
            Key.ENTER,
            '表示する(i)',
        );
        await driver.wait(
            async () => (await editorValue(driver)).endsWith('\n表示する(i)'),
            10000,
            'The lines were not typed',
        );
        expect(await editorValue(driver)).toBe(
            [
                'i が 3 より小さい の間',
                '    もし i > 1 ならば',
                '        表示する(i)',
                '    そうでなければ',
                '        表示する(0)',
                '    を実行する',
                '    i = i + 1',
                'を繰り返す',
                '表示する(i)',
            ].join('\n'),
        );

        expect(await getLogs()).toEqual([]);
    });
});
