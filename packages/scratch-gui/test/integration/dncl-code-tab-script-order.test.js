import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { getDriver, loadUri } = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

// A function defined after the main program that calls it (issue #2550). The programs do not use
// `表示する`: the console extension does not load from the file:// build of the tests.
const FUNCTION_AFTER_MAIN = [
    'x = 合計(3)',
    'Data = [1, 2]',
    'Data に 3 を追加する',
    '関数 合計(n):',
    '    s = 0',
    '    i を 1 から n まで 1 ずつ増やしながら繰り返す:',
    '        s = s + i',
    '    s を返す',
    '',
].join('\n');

// Two functions, each after the call that uses it.
const FUNCTIONS_BETWEEN_CALLS = [
    'x = 倍(2)',
    '関数 倍(n):',
    '    n * 2 を返す',
    'y = 足す(1, 2)',
    '関数 足す(a, b):',
    '    a + b を返す',
    '',
].join('\n');

const getEditorValue = (d) => d.executeScript('return window.monacoEditor && window.monacoEditor.getValue()');

const getMonacoLanguage = (d) =>
    d.executeScript('return window.monacoEditor && window.monacoEditor.getModel().getLanguageId()');

const waitForMonacoLanguage = (d, expected) =>
    d.wait(
        async () => (await getMonacoLanguage(d)) === expected,
        10000,
        `Monaco language did not become "${expected}"`,
    );

const isTabSelected = (d, testId) =>
    d.executeScript(
        `return document.querySelector('[data-testid="${testId}"]')?.getAttribute('aria-selected') === 'true'`,
    );

const isCodeTabSelected = (d) =>
    d.executeScript(`return document.querySelector('[role="tab"]')?.getAttribute('aria-selected') === 'true'`);

const clickByTestId = (d, testId) => d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Write the program in the Japanese tab and wait until the blocks are made from it.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 * @param {string} program - The program in Japanese.
 */
const openJapaneseTabWith = async (d, program) => {
    await loadUri(`${uri}?locale=ja&tab=japanese`);
    await waitForMonacoLanguage(d, 'dncl');
    await fillInRubyProgram(program);
    await d.wait(async () => (await getEditorValue(d)) === program, 10000, 'The program was not written');
};

/**
 * Go to the Code tab and back to the Japanese tab.
 * @param {import('selenium-webdriver').WebDriver} d - WebDriver instance.
 * @param {number} wait - How long to stay on the Code tab, in ms.
 */
const throughCodeTab = async (d, wait) => {
    await d.executeScript(`document.querySelector('[role="tab"]').click()`);
    await d.wait(() => isCodeTabSelected(d), 10000, 'The Code tab was not opened');
    await pause(wait);
    await clickByTestId(d, 'gui-tab-japanese');
    await d.wait(() => isTabSelected(d, 'gui-tab-japanese'), 10000, 'The Japanese tab was not opened');
    await waitForMonacoLanguage(d, 'dncl');
};

let driver;

describe('The Japanese tab after the Code tab (Issue #2577)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('a function defined after the main program stays after it', async () => {
        await openJapaneseTabWith(driver, FUNCTION_AFTER_MAIN);
        for (let i = 0; i < 3; i++) {
            await throughCodeTab(driver, 1500);
            expect(await getEditorValue(driver)).toBe(FUNCTION_AFTER_MAIN);
        }
    });

    test('two functions between the calls keep their places', async () => {
        await openJapaneseTabWith(driver, FUNCTIONS_BETWEEN_CALLS);
        await throughCodeTab(driver, 1500);
        expect(await getEditorValue(driver)).toBe(FUNCTIONS_BETWEEN_CALLS);
    });

    // 30 round trips take about a minute, longer on a slow CI runner than the 95 s of the helper.
    test('coming back from the Code tab 30 times never falls back to the Ruby tab', async () => {
        await openJapaneseTabWith(driver, FUNCTION_AFTER_MAIN);
        for (let i = 0; i < 30; i++) {
            // Vary the time on the Code tab, since the fallback came at some timings only.
            await throughCodeTab(driver, 200 + (i % 5) * 300);
            // The fallback to the Ruby tab comes after the check of the Ruby: wait a little.
            await pause(300);
            expect(await isTabSelected(driver, 'gui-tab-japanese')).toBe(true);
            expect(await getMonacoLanguage(driver)).toBe('dncl');
            expect(await getEditorValue(driver)).toBe(FUNCTION_AFTER_MAIN);
        }
    }, 240000);
});
