import path from 'path';
import webdriver from 'selenium-webdriver';
import SeleniumHelper from '../helpers/selenium-helper';
import RubyHelper from '../helpers/ruby-helper';

const {By, until} = webdriver;
const seleniumHelper = new SeleniumHelper();
const {
    clickText,
    clickXpath,
    getDriver,
    loadUri,
    waitForLoadingFinished
} = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const {
    fillInRubyProgram
} = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Ruby cursor line execution', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Execute if-end block from the end line', async () => {
        await loadUri(uri);
        await driver.sleep(2000);

        await clickText('Ruby', '*[@role="tab"]');
        const code = [
            'text = "hello"',
            'if text.empty?',
            '  say("empty")',
            'end'
        ].join('\n');
        await fillInRubyProgram(code);

        // Set cursor to line 4 (end line)
        await driver.executeScript('window.monacoEditor.setPosition({lineNumber: 4, column: 1});');

        // Click "Execute current line" button
        const executeButtonXpath = '//button[contains(@title, "Execute current line") or contains(@title, "カーソル行を実行")]';
        await clickXpath(executeButtonXpath);

        // Verify that it doesn't show "This line cannot be executed" alert
        const cannotExecuteAlertXpath = '//span[contains(text(), "This line cannot be executed") or contains(text(), "この行は実行できません")]';
        let alertFound = false;
        try {
            await driver.wait(until.elementLocated(By.xpath(cannotExecuteAlertXpath)), 2000);
            alertFound = true;
        } catch (e) {
            // Success: alert not found
        }
        expect(alertFound).toBe(false);
    });

    test('Execute if-end block from a trailing empty line', async () => {
        await loadUri(uri);
        await driver.sleep(2000);

        await clickText('Ruby', '*[@role="tab"]');
        const code = [
            'if true',
            '  say("hi")',
            'end',
            '',
            ''
        ].join('\n');
        await fillInRubyProgram(code);

        // Set cursor to line 5 (empty line)
        await driver.executeScript('window.monacoEditor.setPosition({lineNumber: 5, column: 1});');

        const executeButtonXpath = '//button[contains(@title, "Execute current line") or contains(@title, "カーソル行を実行")]';
        await clickXpath(executeButtonXpath);

        const cannotExecuteAlertXpath = '//span[contains(text(), "This line cannot be executed") or contains(text(), "この行は実行できません")]';
        let alertFound = false;
        try {
            await driver.wait(until.elementLocated(By.xpath(cannotExecuteAlertXpath)), 2000);
            alertFound = true;
        } catch (e) {
            // Success: alert not found
        }
        expect(alertFound).toBe(false);
    });
});
