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
const { fillInRubyProgram, currentRubyProgram, getErrors, waitForErrorOnLine, waitForNoErrors } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

const DNCL_BUTTON_XPATH = '//button[@title="DNCL mode"]';

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

        // Click DNCL button
        await clickXpath(DNCL_BUTTON_XPATH);

        // Wait for validation to complete and mode to switch
        await driver.sleep(3000);

        // DNCL button should be active (has active class)
        const dnclButton = await driver.findElement(seleniumHelper.By.xpath(DNCL_BUTTON_XPATH));
        const className = await dnclButton.getAttribute('class');
        expect(className).toContain('Active');
    });

    test('invalid code blocks DNCL switch and shows errors', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('move(10)\n');

        // Click DNCL button
        await clickXpath(DNCL_BUTTON_XPATH);

        // Wait for validation to complete
        await driver.sleep(3000);

        // DNCL button should NOT be active (validation failed)
        const dnclButton = await driver.findElement(seleniumHelper.By.xpath(DNCL_BUTTON_XPATH));
        const className = await dnclButton.getAttribute('class');
        expect(className).not.toContain('Active');

        // Errors should be shown in the editor
        const errors = await getErrors();
        expect(errors.length).toBeGreaterThan(0);

        // Error message should be the localized validation message
        expect(errors[0].message).toContain('日本語モードでは対応していない記述です');
    });

    test('when_flag_clicked blocks DNCL switch', async () => {
        await loadUri(uri);
        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('when_flag_clicked do\n  say("hello", 1)\nend\n');

        // Click DNCL button
        await clickXpath(DNCL_BUTTON_XPATH);

        // Wait for validation to complete
        await driver.sleep(3000);

        // DNCL button should NOT be active
        const dnclButton = await driver.findElement(seleniumHelper.By.xpath(DNCL_BUTTON_XPATH));
        const className = await dnclButton.getAttribute('class');
        expect(className).not.toContain('Active');

        // Errors should be shown
        const errors = await getErrors();
        expect(errors.length).toBeGreaterThan(0);
    });

    test('DNCL to Ruby switch is not affected', async () => {
        await loadUri(`${uri}?rubyMode=dncl`);
        await clickText('Ruby', '*[@role="tab"]');

        // Should start in DNCL mode
        const dnclButton = await driver.findElement(seleniumHelper.By.xpath(DNCL_BUTTON_XPATH));
        let className = await dnclButton.getAttribute('class');
        expect(className).toContain('Active');

        // Click Ruby button to switch back — should always work
        await clickXpath('//button[@title="Ruby mode"]');
        await driver.sleep(500);

        className = await dnclButton.getAttribute('class');
        expect(className).not.toContain('Active');
    });
});
