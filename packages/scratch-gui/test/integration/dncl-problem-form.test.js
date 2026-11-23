import path from 'path';
import { By } from 'selenium-webdriver';
import SeleniumHelper from '../helpers/selenium-helper';

// The read mode of the Japanese mode (Issue #1755, #2380): line numbers
// `(01)` and the rules of the blocks. It comes on without input, by the
// toggle of the toolbar, after a paste, by the run button and on blur; the
// focus, a click and typing bring the write mode back. The program is
// written for this test; no question of the test is used.
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

const readModePressed = (d) =>
    d.executeScript(
        `return document.querySelector('[data-testid="ruby-toolbar-read-mode"]').getAttribute('aria-pressed')`,
    );

const waitForRules = (d, count, message) => waitFor(d, async () => (await ruleCount(d)) === count, message);

let driver;

describe('Japanese mode: the problem form', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('switches between the read mode and the write mode, and is undone in Ruby', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitFor(
            driver,
            () =>
                driver.executeScript(
                    'return !!window.monacoEditor && window.monacoEditor.getModel().getLanguageId() === "dncl"',
                ),
            'The Japanese mode did not start',
        );

        // While the editor has the focus: the write mode.
        await driver.executeScript(
            `window.monacoEditor.focus(); window.monacoEditor.setValue(${JSON.stringify(CODE)});`,
        );
        await waitFor(driver, async () => (await readModePressed(driver)) === 'false', 'Not in the write mode');
        expect(await existsByTestId(driver, 'ruby-tab-problem-form-done')).toBe(false);
        expect(await ruleCount(driver)).toBe(0);
        expect(await rawOption(driver, 'renderWhitespace')).toBe('all');
        expect(await rawOption(driver, 'lineNumbers')).toBe('function');
        expect(await firstLineNumber(driver)).toBe('(01)');

        // The toggle of the toolbar shows the read mode; the text stays.
        await clickByTestId(driver, 'ruby-toolbar-read-mode');
        await waitForRules(driver, 6, 'The rules were not drawn by the toggle');
        expect(await readModePressed(driver)).toBe('true');
        expect(await rawOption(driver, 'renderWhitespace')).toBe('none');
        expect(await driver.executeScript('return window.monacoEditor.getValue()')).toBe(CODE);

        // Typing brings the write mode back.
        await driver.executeScript(
            "window.monacoEditor.focus(); window.monacoEditor.trigger('keyboard', 'type', { text: 'x' });",
        );
        await waitForRules(driver, 0, 'Typing did not bring the write mode back');
        expect(await rawOption(driver, 'renderWhitespace')).toBe('all');
        await driver.executeScript("window.monacoEditor.trigger('keyboard', 'undo', null);");

        // A while without input shows the read mode.
        await waitForRules(driver, 6, 'The read mode did not come without input');

        // A click in the editor brings the write mode back.
        await driver.findElement(By.css('.monaco-editor .view-lines')).click();
        await waitForRules(driver, 0, 'A click did not bring the write mode back');

        // A paste shows the read mode.
        await driver.executeScript(
            "window.monacoEditor.trigger('keyboard', 'paste', { text: 'y', pasteOnNewLine: false });",
        );
        await waitForRules(driver, 6, 'The read mode did not come after a paste');

        // The toggle brings the write mode back, with the focus in the editor.
        await clickByTestId(driver, 'ruby-toolbar-read-mode');
        await waitForRules(driver, 0, 'The toggle did not bring the write mode back');
        expect(await driver.executeScript('return window.monacoEditor.hasTextFocus()')).toBe(true);
        await driver.executeScript("window.monacoEditor.trigger('keyboard', 'undo', null);");
        expect(await driver.executeScript('return window.monacoEditor.getValue()')).toBe(CODE);
        await waitForRules(driver, 0, 'Undo did not keep the write mode');

        // The green flag shows the read mode.
        await driver.executeScript('window.smalruby.vm.greenFlag()');
        await waitForRules(driver, 6, 'The read mode did not come by the green flag');

        // Ruby has its own line numbers and the dots of the spaces.
        await driver.executeScript('window.monacoEditor.getContainerDomNode().ownerDocument.activeElement.blur()');
        await waitFor(driver, async () => (await ruleCount(driver)) > 0, 'The rules were not drawn on blur');
        // The Ruby tab (the toolbar has no Japanese mode any more: docs/dncl/design.md 1 章)
        await clickByTestId(driver, 'gui-tab-ruby');
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
