/**
 * Integration tests for Ruby editor actions.
 * Consolidated from monaco-paste.test.js and execute-line.test.js
 * to reduce cold-start overhead.
 */
import path from 'path';
import webdriver from 'selenium-webdriver';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const { By, until } = webdriver;
const seleniumHelper = new SeleniumHelper();
const { clickText, clickXpath, getDriver, loadUri } = seleniumHelper;

const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Ruby editor actions', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    describe('Monaco Editor Paste Action', () => {
        test('Custom paste action is registered and works', async () => {
            await loadUri(uri);
            await clickText('Ruby', '*[@role="tab"]');

            // Wait for Monaco Editor to be ready
            await driver.wait(async () => {
                return await driver.executeScript('return !!window.monacoEditor;');
            }, 10000);

            // Mock clipboard
            await driver.executeScript(
                'navigator.clipboard.readText = () => Promise.resolve("pasted_text_from_mock");',
            );

            // Trigger the custom action
            await driver.executeScript(`
                const action = window.monacoEditor.getAction('smalruby.paste');
                if (action) {
                    return action.run();
                }
                throw new Error('Action smalruby.paste not found');
            `);

            // Wait a bit for async paste
            await driver.sleep(500);

            // Check if text is pasted
            const code = await driver.executeScript('return window.monacoEditor.getValue();');
            expect(code).toContain('pasted_text_from_mock');
        });
    });

    describe('Ruby cursor line execution', () => {
        test('Execute if-end block from the end line', async () => {
            await loadUri(uri);
            await driver.sleep(2000);

            await clickText('Ruby', '*[@role="tab"]');
            const code = ['text = "hello"', 'if text.empty?', '  say("empty")', 'end'].join('\n');
            await fillInRubyProgram(code);

            // Set cursor to line 4 (end line)
            await driver.executeScript('window.monacoEditor.setPosition({lineNumber: 4, column: 1});');

            // Click "Execute current line" button
            const executeButtonXpath =
                '//button[contains(@title, "Execute current line") or contains(@title, "カーソル行を実行")]';
            await clickXpath(executeButtonXpath);

            // Verify that it doesn't show "This line cannot be executed" alert
            const cannotExecuteAlertXpath =
                '//span[contains(text(), "This line cannot be executed") or contains(text(), "この行は実行できません")]';
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
            const code = ['if true', '  say("hi")', 'end', '', ''].join('\n');
            await fillInRubyProgram(code);

            // Set cursor to line 5 (empty line)
            await driver.executeScript('window.monacoEditor.setPosition({lineNumber: 5, column: 1});');

            const executeButtonXpath =
                '//button[contains(@title, "Execute current line") or contains(@title, "カーソル行を実行")]';
            await clickXpath(executeButtonXpath);

            const cannotExecuteAlertXpath =
                '//span[contains(text(), "This line cannot be executed") or contains(text(), "この行は実行できません")]';
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
});
