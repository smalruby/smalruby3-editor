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

const editorValue = (d) => d.executeScript('return window.monacoEditor.getValue()');

const waitFor = (d, check, message) => d.wait(check, 10000, message);

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

        await clickByTestId(driver, 'ruby-toolbar-more-menu');
        await clickByTestId(driver, 'ruby-toolbar-menu-settings-pattern-index-from-one');
        await waitFor(
            driver,
            async () => (await editorValue(driver)).startsWith('# すべての配列の添字は 1 から始まる。'),
            'The sentence was not written',
        );
        const value = await editorValue(driver);
        expect(value).toContain('# 「and」は「かつ」を意味する論理演算子であり，');
        expect(value.endsWith('A = [5, 6]\n表示する(A[1])')).toBe(true);

        await clickByTestId(driver, 'ruby-toolbar-more-menu');
        expect(
            await driver.executeScript(
                'return document.querySelector(\'[data-testid="ruby-toolbar-menu-settings-pattern-index-from-one"]\').getAttribute("aria-checked")',
            ),
        ).toBe('true');
        await clickByTestId(driver, 'ruby-toolbar-menu-settings-pattern-example');
        await waitFor(driver, async () => (await editorValue(driver)) === CODE, 'The form of 例示 did not come back');

        expect(await getLogs()).toEqual([]);
    });
});
