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
 * Wait until the Monaco editor has the expected content.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 * @param {string} expected - Substring that must appear in editor value.
 */
const waitForEditorValue = (d, expected) =>
    d.wait(
        async () => {
            const value = await d.executeScript('return window.monacoEditor && window.monacoEditor.getValue()');
            return value && value.includes(expected);
        },
        10000,
        `Editor value did not contain "${expected}"`,
    );

/**
 * Wait until a data-testid button's Active state matches expected.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 * @param {string} testId - The data-testid value.
 * @param {boolean} expected - Expected active state.
 */
const waitForActiveState = (d, testId, expected) =>
    d.wait(
        () =>
            d.executeScript(
                `return (document.querySelector('[data-testid="${testId}"]')` +
                    `?.className?.includes('Active') ?? false) === ${expected}`,
            ),
        10000,
        `Button ${testId} Active state did not become ${expected}`,
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
        await waitForEditorValue(driver, '@x = 10');

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);
    });

    test('invalid code blocks DNCL switch and shows errors', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('move(10)\n');
        await waitForEditorValue(driver, 'move(10)');

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', false);

        const errors = await getErrors();
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain('日本語モードでは対応していない記述です');
    });

    test('when_flag_clicked blocks DNCL switch', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('when_flag_clicked do\n  say("hello", 1)\nend\n');
        await waitForEditorValue(driver, 'when_flag_clicked');

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', false);

        const errors = await getErrors();
        expect(errors.length).toBeGreaterThan(0);
    });

    test('DNCL to Ruby switch is not affected', async () => {
        await loadUri(`${uri}?rubyMode=dncl`);
        await clickText('Ruby', '*[@role="tab"]');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);

        await clickByTestId(driver, 'ruby-toolbar-mode-ruby');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', false);
    });
});
