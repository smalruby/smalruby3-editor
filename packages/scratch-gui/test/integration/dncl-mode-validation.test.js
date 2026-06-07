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
 * Click the Code tab using a stable selector instead of XPath text matching.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 */
const clickCodeTab = (d) => d.executeScript(`document.querySelector('[role="tab"]').click()`);

/**
 * Click the Ruby tab (last tab: Code / Costumes / Sounds / Ruby).
 * Uses index instead of text matching because the label is locale-dependent.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 */
const clickRubyTab = (d) =>
    d.executeScript(`const tabs = document.querySelectorAll('[role="tab"]'); tabs[tabs.length - 1].click()`);

const existsByTestId = (d, testId) =>
    d.executeScript(`return document.querySelector('[data-testid="${testId}"]') !== null`);

const waitForTestIdPresence = (d, testId, expected) =>
    d.wait(
        async () => (await existsByTestId(d, testId)) === expected,
        10000,
        `Element ${testId} did not become ${expected ? 'present' : 'absent'}`,
    );

/**
 * Stub window.confirm so native dialogs do not block Selenium, recording call count.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 * @param {boolean} result - Value the stubbed confirm should return.
 */
const setConfirmResult = (d, result) =>
    d.executeScript(
        `window.__confirmCalls = 0; window.confirm = () => { window.__confirmCalls += 1; return ${result}; }`,
    );

const getConfirmCallCount = (d) => d.executeScript('return window.__confirmCalls || 0');

const isExtensionButtonDisabled = (d) =>
    d.executeScript(
        `return document.querySelector('[data-testid="extension-button"]')` +
            `?.className?.includes('disabled') ?? false`,
    );

const isExtensionLibraryOpen = (d) =>
    d.executeScript(`return document.querySelector('[class*="library-scroll-grid"]') !== null`);

const getToolboxCategoryCount = (d) =>
    d.executeScript(
        `const toolbox = document.querySelector('.blocklyToolbox');` +
            `if (!toolbox || toolbox.style.display === 'none') return 0;` +
            `return toolbox.querySelectorAll('.blocklyToolboxCategory').length;`,
    );

const waitForMonacoLanguage = (d, expected) =>
    d.wait(
        async () => {
            const lang = await d.executeScript(
                'return window.monacoEditor && window.monacoEditor.getModel().getLanguageId()',
            );
            return lang === expected;
        },
        10000,
        `Monaco language did not become "${expected}"`,
    );

/**
 * Load the editor in Ruby mode (not DNCL), clearing any localStorage state.
 * Uses locale=ja because furigana/DNCL modes are only available in Japanese locales.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 */
const loadInRubyMode = async () => {
    // Use rubyMode=ruby to ensure we start in Ruby mode, regardless of localStorage
    // locale=ja is required because DNCL mode is hidden for non-Japanese locales
    // tab=ruby opens Ruby tab directly (avoids locale-dependent tab label)
    await loadUri(`${uri}?rubyMode=ruby&locale=ja&tab=ruby`);
};

let driver;

describe('DNCL mode validation on switch', () => {
    beforeAll(async () => {
        driver = await getDriver();
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
        // Message is locale-dependent; check for either Japanese or English
        expect(
            errors[0].message.includes('日本語モードでは対応していない記述です') ||
                errors[0].message.includes('not supported in Japanese mode'),
        ).toBe(true);
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
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);

        await clickByTestId(driver, 'ruby-toolbar-mode-ruby');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', false);
    });

    test('DNCL to Ruby switch restores block palette and extension button on Code tab', async () => {
        // Start in DNCL mode
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);

        // Switch back to Ruby mode
        await clickByTestId(driver, 'ruby-toolbar-mode-ruby');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', false);

        // Switch to Code tab
        await clickCodeTab(driver);

        // Wait for the extension button to be visible and clickable (not disabled)
        await driver.wait(
            () =>
                driver.executeScript(
                    `const btn = document.querySelector('[class*="extension-button_extension-button-container"]');` +
                        `return btn && btn.style.display !== 'none' && !btn.className.includes('Disabled');`,
                ),
            10000,
            'Extension button did not become visible and enabled after leaving DNCL mode',
        );

        // Verify block palette (toolbox) is visible and has multiple categories
        const categoryCount = await driver.executeScript(
            `const toolbox = document.querySelector('.blocklyToolbox');` +
                `if (!toolbox || toolbox.style.display === 'none') return 0;` +
                `return toolbox.querySelectorAll('.blocklyToolboxCategory').length;`,
        );
        // Non-DNCL mode should have more categories than DNCL mode (which filters heavily)
        expect(categoryCount).toBeGreaterThan(3);
    });

    test('notice banner is shown on Code tab in DNCL mode', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);
        await clickCodeTab(driver);

        await waitForTestIdPresence(driver, 'dncl-mode-notice', true);
        // Extension button is rendered in disabled style while DNCL mode is on
        expect(await isExtensionButtonDisabled(driver)).toBe(true);
    });

    test('banner exit button: cancel keeps DNCL mode', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);
        await clickCodeTab(driver);
        await waitForTestIdPresence(driver, 'dncl-mode-notice', true);

        await setConfirmResult(driver, false);
        await clickByTestId(driver, 'dncl-mode-notice-exit-button');
        expect(await getConfirmCallCount(driver)).toBe(1);

        // Banner stays and blocks remain restricted
        expect(await existsByTestId(driver, 'dncl-mode-notice')).toBe(true);
        expect(await isExtensionButtonDisabled(driver)).toBe(true);
    });

    test('banner exit button: OK exits DNCL mode and restores full toolbox', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);
        await clickCodeTab(driver);
        await waitForTestIdPresence(driver, 'dncl-mode-notice', true);

        await setConfirmResult(driver, true);
        await clickByTestId(driver, 'dncl-mode-notice-exit-button');

        // Banner disappears and full toolbox is restored without tab switching
        await waitForTestIdPresence(driver, 'dncl-mode-notice', false);
        await driver.wait(
            async () => (await getToolboxCategoryCount(driver)) > 3,
            10000,
            'Toolbox categories were not restored after exiting DNCL mode via banner',
        );
        expect(await isExtensionButtonDisabled(driver)).toBe(false);
    });

    test('extension button: cancel keeps DNCL mode and does not open library', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);
        await clickCodeTab(driver);
        await waitForTestIdPresence(driver, 'dncl-mode-notice', true);

        await setConfirmResult(driver, false);
        await clickByTestId(driver, 'extension-button');
        expect(await getConfirmCallCount(driver)).toBe(1);

        // Extension library does not open, DNCL mode continues
        expect(await isExtensionLibraryOpen(driver)).toBe(false);
        expect(await existsByTestId(driver, 'dncl-mode-notice')).toBe(true);
        expect(await isExtensionButtonDisabled(driver)).toBe(true);
    });

    test('extension button: OK exits DNCL mode and opens extension library', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);
        await clickCodeTab(driver);
        await waitForTestIdPresence(driver, 'dncl-mode-notice', true);

        await setConfirmResult(driver, true);
        await clickByTestId(driver, 'extension-button');

        // Extension library opens and DNCL restriction is lifted
        await driver.wait(
            () => isExtensionLibraryOpen(driver),
            10000,
            'Extension library did not open after confirming exit from DNCL mode',
        );
        await waitForTestIdPresence(driver, 'dncl-mode-notice', false);
    });

    test('Ruby tab shows Ruby code after exiting DNCL mode via banner', async () => {
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);
        await waitForMonacoLanguage(driver, 'dncl');

        await clickCodeTab(driver);
        await waitForTestIdPresence(driver, 'dncl-mode-notice', true);
        await setConfirmResult(driver, true);
        await clickByTestId(driver, 'dncl-mode-notice-exit-button');
        await waitForTestIdPresence(driver, 'dncl-mode-notice', false);

        // Reopen the Ruby tab: the wasDncl restore path must be skipped
        await clickRubyTab(driver);
        await waitForMonacoLanguage(driver, 'smalruby');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', false);
    });

    test('DNCL to furigana switch restores block palette on Code tab', async () => {
        // Start in DNCL mode
        await loadUri(`${uri}?rubyMode=dncl&locale=ja&tab=ruby`);
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', true);

        // Switch to furigana mode
        await clickByTestId(driver, 'ruby-toolbar-mode-furigana');
        await waitForActiveState(driver, 'ruby-toolbar-mode-dncl', false);

        // Switch to Code tab
        await clickCodeTab(driver);

        // Wait for extension button to be visible and not disabled
        await driver.wait(
            () =>
                driver.executeScript(
                    `const btn = document.querySelector('[class*="extension-button_extension-button-container"]');` +
                        `return btn && btn.style.display !== 'none' && !btn.className.includes('Disabled');`,
                ),
            10000,
            'Extension button did not become visible and enabled after leaving DNCL mode',
        );

        // Verify block palette has full categories
        const categoryCount = await driver.executeScript(
            `const toolbox = document.querySelector('.blocklyToolbox');` +
                `if (!toolbox || toolbox.style.display === 'none') return 0;` +
                `return toolbox.querySelectorAll('.blocklyToolboxCategory').length;`,
        );
        expect(categoryCount).toBeGreaterThan(3);
    });
});
