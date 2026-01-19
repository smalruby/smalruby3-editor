import bindAll from 'lodash.bindall';
import webdriver from 'selenium-webdriver';
import {EDIT_MENU_XPATH} from './menu-xpaths';

const {By, until} = webdriver;

class RubyHelper {
    constructor (seleniumHelper) {
        bindAll(this, [
            'fillInRubyProgram',
            'currentRubyProgram',
            'getErrors',
            'getErrorOnLine',
            'waitForErrorOnLine',
            'dismissAlertsIfPresent',
            'expectInterconvertBetweenCodeAndRuby'
        ]);

        this.seleniumHelper = seleniumHelper;
        this.clickText = seleniumHelper.clickText;
        this.clickXpath = seleniumHelper.clickXpath;
    }

    get driver () {
        return this.seleniumHelper.driver;
    }

    currentRubyProgram () {
        return this.driver.executeScript(`return window.monacoEditor.getValue();`);
    }

    fillInRubyProgram (code) {
        code = code.replace(/\n/g, '\\n').replace(/'/g, "\\'");
        return this.driver.executeScript(`window.monacoEditor.setValue('${code}');`);
    }

    getErrors () {
        return this.driver.executeScript(`
            return window.monaco.editor.getModelMarkers({}).map(m => ({
                line: m.startLineNumber,
                column: m.startColumn,
                message: m.message,
                severity: m.severity
            }));
        `);
    }

    async getErrorOnLine (line) {
        const errors = await this.getErrors();
        return errors.find(e => e.line === line);
    }

    async waitForErrorOnLine (line) {
        return this.driver.wait(async () => {
            const error = await this.getErrorOnLine(line);
            return !!error;
        }, 5000);
    }

    async dismissAlertsIfPresent () {
        try {
            // Find and dismiss any alert messages that have close buttons
            const alertCloseButtons = await this.driver.findElements(
                By.xpath('//div[contains(@class, "alert_alert-close-button")]')
            );
            for (const button of alertCloseButtons) {
                if (await button.isDisplayed()) {
                    await button.click();
                    await this.driver.sleep(100); // Wait for alert to be dismissed
                }
            }
        } catch (error) {
            // Ignore errors - alerts may not be present
        }
    }

    async expectInterconvertBetweenCodeAndRuby (inputCode, expectedCode = null) {
        await this.clickText('Ruby', '*[@role="tab"]');
        await this.fillInRubyProgram(inputCode);
        await this.clickText('Code', '*[@role="tab"]');
        
        // Dismiss any alerts that might be blocking subsequent clicks
        await this.dismissAlertsIfPresent();
        
        await this.clickXpath(EDIT_MENU_XPATH);
        await this.clickText('Generate Ruby from Code');
        await this.clickText('Ruby', '*[@role="tab"]');
        
        // If expectedCode is provided, use it; otherwise expect the same as input
        const expected = expectedCode !== null ? expectedCode : inputCode;
        expect(await this.currentRubyProgram()).toEqual(`${expected}\n`);
    }
}

export default RubyHelper;
