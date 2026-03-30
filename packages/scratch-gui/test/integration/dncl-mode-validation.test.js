import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const {
    /* eslint-disable no-unused-vars */
    clickText,
    clickButton,
    clickXpath,
    findByText,
    findByXpath,
    getDriver,
    getLogs,
    loadUri,
    waitForLoadingFinished,
    notExistsByXpath,
    scope,
    /* eslint-enable no-unused-vars */
} = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram, getErrors } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

/**
 * Click a button identified by data-testid.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 * @param {string} testId - The data-testid value.
 */
const clickByTestId = (d, testId) => d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

/**
 * Check whether a button identified by data-testid has 'Active' in its class.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 * @param {string} testId - The data-testid value.
 * @returns {Promise<boolean>}
 */
const isActiveByTestId = (d, testId) =>
    d.executeScript(
        `return document.querySelector('[data-testid="${testId}"]')` + `?.className?.includes('Active') ?? false`,
    );

/**
 * Wait until the Monaco editor has a non-empty value.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 */
const waitForEditorContent = d =>
    d.wait(
        async () => {
            const value = await d.executeScript('return window.monacoEditor && window.monacoEditor.getValue()');
            return value && value.length > 0;
        },
        10000,
        'Editor content did not appear',
    );

let driver;

describe('DNCL mode validation on switch', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('valid code allows DNCL switch', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('@x = 10\nsay("hello", 1)\n');
        await waitForEditorContent(driver);

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        await driver.sleep(5000);

        expect(await isActiveByTestId(driver, 'ruby-toolbar-mode-dncl')).toBe(true);
    });

    test('invalid code blocks DNCL switch and shows errors', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('move(10)\n');
        await waitForEditorContent(driver);

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        await driver.sleep(5000);

        expect(await isActiveByTestId(driver, 'ruby-toolbar-mode-dncl')).toBe(false);

        const errors = await getErrors();
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain('日本語モードでは対応していない記述です');
    });

    test('when_flag_clicked blocks DNCL switch', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('when_flag_clicked do\n  say("hello", 1)\nend\n');
        await waitForEditorContent(driver);

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        await driver.sleep(5000);

        expect(await isActiveByTestId(driver, 'ruby-toolbar-mode-dncl')).toBe(false);

        const errors = await getErrors();
        expect(errors.length).toBeGreaterThan(0);
    });

    test('DNCL to Ruby switch is not affected', async () => {
        await loadUri(`${uri}?rubyMode=dncl`);
        await clickText('Ruby', '*[@role="tab"]');

        expect(await isActiveByTestId(driver, 'ruby-toolbar-mode-dncl')).toBe(true);

        await clickByTestId(driver, 'ruby-toolbar-mode-ruby');
        await driver.sleep(500);

        expect(await isActiveByTestId(driver, 'ruby-toolbar-mode-dncl')).toBe(false);
    });
});
