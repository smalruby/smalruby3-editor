import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

// The problem form of the Japanese mode (Issue #1755): line numbers `(01)`
// and the rules of the blocks, drawn while the editor has no focus. The
// program is written for this test; no question of the test is used.
const seleniumHelper = new SeleniumHelper();
const { getDriver, getLogs, loadUri } = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

const CODE = [
    'goukei = 0',
    'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
    '    もし i % 2 == 0 ならば:',
    '        goukei = goukei + i',
    '    そうでなければ:',
    '        表示する(i)',
    '表示する(goukei)',
].join('\n');

const clickByTestId = (d, testId) => d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const existsByTestId = (d, testId) =>
    d.executeScript(`return document.querySelector('[data-testid="${testId}"]') !== null`);

const ruleCount = (d) => d.executeScript("return document.querySelectorAll('.dncl-rule-bar, .dncl-rule-end').length");

const rawOption = (d, name) =>
    d.executeScript(
        `const v = window.monacoEditor.getRawOptions()['${name}']; return typeof v === 'function' ? 'function' : v;`,
    );

const firstLineNumber = (d) =>
    d.executeScript("const n = document.querySelector('.monaco-editor .line-numbers'); return n && n.textContent;");

const waitFor = (d, check, message) => d.wait(check, 10000, message);

let driver;

describe('Japanese mode: the problem form', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('switches with the focus, by 「できた」, and is undone in Ruby', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitFor(
            driver,
            () =>
                driver.executeScript(
                    'return !!window.monacoEditor && window.monacoEditor.getModel().getLanguageId() === "dncl"',
                ),
            'The Japanese mode did not start',
        );

        // While the editor has the focus: the text, and the 「できた」 button.
        await driver.executeScript(
            `window.monacoEditor.focus(); window.monacoEditor.setValue(${JSON.stringify(CODE)});`,
        );
        await waitFor(
            driver,
            () => existsByTestId(driver, 'ruby-tab-problem-form-done'),
            '「できた」 did not appear',
        );
        expect(await ruleCount(driver)).toBe(0);
        expect(await rawOption(driver, 'renderWhitespace')).toBe('all');
        expect(await rawOption(driver, 'lineNumbers')).toBe('function');
        expect(await firstLineNumber(driver)).toBe('(01)');

        // 「できた」 shows the problem form.
        await clickByTestId(driver, 'ruby-tab-problem-form-done');
        await waitFor(driver, async () => (await ruleCount(driver)) === 6, 'The rules were not drawn');
        expect(await existsByTestId(driver, 'ruby-tab-problem-form-done')).toBe(false);
        expect(await rawOption(driver, 'renderWhitespace')).toBe('none');
        expect(await driver.executeScript('return window.monacoEditor.getValue()')).toBe(CODE);

        // The focus brings the text back.
        await driver.executeScript('window.monacoEditor.focus()');
        await waitFor(driver, async () => (await ruleCount(driver)) === 0, 'The rules stayed with the focus');
        expect(await rawOption(driver, 'renderWhitespace')).toBe('all');

        // Ruby has its own line numbers and the dots of the spaces.
        await driver.executeScript('window.monacoEditor.getContainerDomNode().ownerDocument.activeElement.blur()');
        await waitFor(driver, async () => (await ruleCount(driver)) > 0, 'The rules were not drawn on blur');
        await clickByTestId(driver, 'ruby-toolbar-mode-ruby');
        await waitFor(
            driver,
            () => driver.executeScript('return window.monacoEditor.getModel().getLanguageId() !== "dncl"'),
            'Ruby did not come back',
        );
        await waitFor(driver, async () => (await rawOption(driver, 'lineNumbers')) === 'on', 'lineNumbers stayed');
        expect(await rawOption(driver, 'renderWhitespace')).toBe('all');
        expect(await ruleCount(driver)).toBe(0);
        expect(await firstLineNumber(driver)).toBe('1');

        expect(await getLogs()).toEqual([]);
    });
});
