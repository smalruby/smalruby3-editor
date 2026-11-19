import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

// The patterns of settings of the Japanese mode (Issue #1757): picking one in
// the more menu writes the sentences at the top and the same program by them.
// The program is written for this test; no question of the test is used.
const seleniumHelper = new SeleniumHelper();
const { getDriver, getLogs, loadUri } = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

const CODE = ['A = [5, 6]', '表示する(A[0])'].join('\n');

const clickByTestId = (d, testId) => d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const existsByTestId = (d, testId) =>
    d.executeScript(`return document.querySelector('[data-testid="${testId}"]') !== null`);

const editorValue = (d) => d.executeScript('return window.monacoEditor.getValue()');

const waitFor = (d, check, message) => d.wait(check, 10000, message);

/**
 * Open the more menu and pick an item of it, once the menu shows it.
 * @param {object} d - The driver.
 * @param {string} testId - The item.
 */
const pickMenuItem = async (d, testId) => {
    await clickByTestId(d, 'ruby-toolbar-more-menu');
    await waitFor(d, () => existsByTestId(d, testId), `The menu did not show ${testId}`);
    await clickByTestId(d, testId);
};

let driver;

describe('Japanese mode: the patterns of settings', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('writes the sentences at the top and the program by them, and back', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitFor(
            driver,
            () =>
                driver.executeScript(
                    'return !!window.monacoEditor && window.monacoEditor.getModel().getLanguageId() === "dncl"',
                ),
            'The Japanese mode did not start',
        );
        await driver.executeScript(`window.monacoEditor.setValue(${JSON.stringify(CODE)});`);

        await pickMenuItem(driver, 'ruby-toolbar-menu-settings-pattern-index-from-one');
        await waitFor(
            driver,
            async () => (await editorValue(driver)).startsWith('# すべての配列の添字は 1 から始まる。'),
            'The sentence was not written',
        );
        const value = await editorValue(driver);
        // The auto-correct (on by default) makes the full-width `，` of the comments half-width.
        expect(value).toMatch(/^# 「and」は「かつ」を意味する論理演算子であり[，,]/m);
        expect(value.endsWith('A = [5, 6]\n表示する(A[1])')).toBe(true);

        await clickByTestId(driver, 'ruby-toolbar-more-menu');
        await waitFor(
            driver,
            () => existsByTestId(driver, 'ruby-toolbar-menu-settings-pattern-example'),
            'The menu did not open again',
        );
        expect(
            await driver.executeScript(
                'return document.querySelector(\'[data-testid="ruby-toolbar-menu-settings-pattern-index-from-one"]\').getAttribute("aria-checked")',
            ),
        ).toBe('true');
        await clickByTestId(driver, 'ruby-toolbar-menu-settings-pattern-example');
        await waitFor(
            driver,
            async () => !(await editorValue(driver)).includes('添字は 1 から始まる'),
            'The sentences stayed',
        );
        expect(await editorValue(driver)).toBe(CODE);

        expect(await getLogs()).toEqual([]);
    });
});
