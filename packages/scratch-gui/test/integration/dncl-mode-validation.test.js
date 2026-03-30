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

const clickByTestId = (d, testId) => d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const isActiveByTestId = (d, testId) =>
    d.executeScript(
        `return document.querySelector('[data-testid="${testId}"]')` + `?.className?.includes('Active') ?? false`,
    );

const waitForEditorValue = (d, expected) =>
    d.wait(
        async () => {
            const value = await d.executeScript('return window.monacoEditor && window.monacoEditor.getValue()');
            return value && value.includes(expected);
        },
        10000,
        `Editor value did not contain "${expected}"`,
    );

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

/**
 * Load the editor in Ruby mode (not DNCL), clearing any localStorage state.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 */
const loadInRubyMode = async d => {
    // Use rubyMode=ruby to ensure we start in Ruby mode, regardless of localStorage
    await loadUri(`${uri}?rubyMode=ruby`);
    await clickText('Ruby', '*[@role="tab"]');
};

let driver;

describe('DNCL mode validation on switch', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('valid code allows DNCL switch', async () => {
        await loadInRubyMode(driver);
        await fillInRubyProgram('@x = 10\nsay("hello", 1)\n');
        await waitForEditorValue(driver, '@x = 10');

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);
    });

    test('invalid code blocks DNCL switch and shows errors', async () => {
        await loadInRubyMode(driver);
        await fillInRubyProgram('move(10)\n');
        await waitForEditorValue(driver, 'move(10)');

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        // Validation is async; wait for it to complete and errors to appear
        await driver.wait(
            async () => {
                const errors = await getErrors();
                return errors.length > 0;
            },
            15000,
            'DNCL validation errors did not appear',
        );

        expect(await isActiveByTestId(driver, 'ruby-toolbar-mode-dncl')).toBe(false);

        const errors = await getErrors();
        expect(errors[0].message).toContain('日本語モードでは対応していない記述です');
    });

    test('when_flag_clicked blocks DNCL switch', async () => {
        await loadInRubyMode(driver);
        await fillInRubyProgram('when_flag_clicked do\n  say("hello", 1)\nend\n');
        await waitForEditorValue(driver, 'when_flag_clicked');

        await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
        await driver.wait(
            async () => {
                const errors = await getErrors();
                return errors.length > 0;
            },
            15000,
            'DNCL validation errors did not appear',
        );

        expect(await isActiveByTestId(driver, 'ruby-toolbar-mode-dncl')).toBe(false);
    });

    test('DNCL to Ruby switch is not affected', async () => {
        await loadUri(`${uri}?rubyMode=dncl`);
        await clickText('Ruby', '*[@role="tab"]');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);

        await clickByTestId(driver, 'ruby-toolbar-mode-ruby');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', false);
    });
});
