import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { getDriver, loadUri } = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram, getErrors } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

const VALID = 'a = 1\n表示する(a)\n';
const WITH_ERROR = 'a = 1\n表示する(a)\nb = ☆ + 2\n';

const clickByTestId = (d, testId) => d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const getEditorValue = (d) => d.executeScript('return window.monacoEditor && window.monacoEditor.getValue()');

const waitForEditorValue = (d, expected) =>
    d.wait(
        async () => {
            const value = await getEditorValue(d);
            return value && value.includes(expected);
        },
        10000,
        `Editor value did not contain "${expected}"`,
    );

const waitForMonacoLanguage = (d, expected) =>
    d.wait(
        () =>
            d.executeScript(
                `return window.monacoEditor && window.monacoEditor.getModel().getLanguageId() === '${expected}'`,
            ),
        10000,
        `Monaco language did not become "${expected}"`,
    );

const isTabSelected = (d, testId) =>
    d.executeScript(
        `return document.querySelector('[data-testid="${testId}"]')?.getAttribute('aria-selected') === 'true'`,
    );

const waitForTabSelected = (d, testId) =>
    d.wait(() => isTabSelected(d, testId), 10000, `Tab ${testId} was not selected`);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Open the Japanese tab with a program that has an error on its last line.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 */
const openJapaneseTabWithError = async (d) => {
    await loadUri(`${uri}?locale=ja&tab=japanese`);
    await waitForMonacoLanguage(d, 'dncl');
    await fillInRubyProgram(VALID);
    await waitForEditorValue(d, '表示する(a)');
    await fillInRubyProgram(WITH_ERROR);
    await d.wait(
        async () => (await getErrors()).some((e) => e.line === 3),
        10000,
        'The line that cannot be read was not marked',
    );
};

/**
 * Whether the alert that the Japanese program has errors is shown.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 * @returns {Promise<boolean>} true when the alert is shown.
 */
const isJapaneseErrorAlertShown = (d) =>
    d.executeScript(
        "return document.body.innerText.includes('日本語のプログラムに読めない行があります。印のある行を直してください！')",
    );

let driver;

describe('Japanese text with an error is kept when leaving the tab or the sprite (Issue #2546)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('the Ruby tab does not take the program away', async () => {
        await openJapaneseTabWithError(driver);
        await clickByTestId(driver, 'gui-tab-ruby');
        await pause(1000);

        expect(await isTabSelected(driver, 'gui-tab-japanese')).toBe(true);
        expect(await getEditorValue(driver)).toBe(WITH_ERROR);
        expect(await isJapaneseErrorAlertShown(driver)).toBe(true);
    });

    test('the Code tab does not take the program away', async () => {
        await openJapaneseTabWithError(driver);
        await driver.executeScript(`document.querySelector('[role="tab"]').click()`);
        await pause(1000);

        expect(await isTabSelected(driver, 'gui-tab-japanese')).toBe(true);
        expect(await getEditorValue(driver)).toBe(WITH_ERROR);
        expect(await isJapaneseErrorAlertShown(driver)).toBe(true);
    });

    test('switching the sprite does not take the program away', async () => {
        await openJapaneseTabWithError(driver);
        const spriteId = await driver.executeScript('return window.smalruby.vm.editingTarget.id');
        await driver.executeScript(
            'const vm = window.smalruby.vm; vm.setEditingTarget(vm.runtime.getTargetForStage().id);',
        );
        await pause(1000);

        expect(await driver.executeScript('return window.smalruby.vm.editingTarget.id')).toBe(spriteId);
        expect(await getEditorValue(driver)).toBe(WITH_ERROR);
        expect(await isJapaneseErrorAlertShown(driver)).toBe(true);
    });

    test('once the line is fixed, the Ruby tab is opened', async () => {
        await openJapaneseTabWithError(driver);
        await fillInRubyProgram('a = 1\n表示する(a)\nb = 3 + 2\n');
        await waitForEditorValue(driver, 'b = 3 + 2');
        await clickByTestId(driver, 'gui-tab-ruby');
        await waitForTabSelected(driver, 'gui-tab-ruby');
        await waitForMonacoLanguage(driver, 'smalruby');
        await waitForEditorValue(driver, 'b = 3 + 2');
    });

    // Issue #2560: the green flag (like saving and submitting) converts through the same HOC,
    // which used to run the program without the line with an error.
    test('the green flag stops on the Japanese tab', async () => {
        await openJapaneseTabWithError(driver);
        await driver.findElement({ css: '[class*="green-flag_green-flag_"]' }).click();
        await pause(1000);

        expect(await isTabSelected(driver, 'gui-tab-japanese')).toBe(true);
        expect(await getEditorValue(driver)).toBe(WITH_ERROR);
        expect(await isJapaneseErrorAlertShown(driver)).toBe(true);
        expect(await driver.executeScript('return window.smalruby.vm.runtime.threads.length')).toBe(0);
    });

    // The run button of the toolbar ran the Ruby without the line with an error.
    test('the run button stops on the Japanese tab', async () => {
        await openJapaneseTabWithError(driver);
        await clickByTestId(driver, 'ruby-toolbar-execute');
        await pause(1000);

        expect(await isTabSelected(driver, 'gui-tab-japanese')).toBe(true);
        expect(await getEditorValue(driver)).toBe(WITH_ERROR);
        expect(await isJapaneseErrorAlertShown(driver)).toBe(true);
    });
});
