import path from 'path';
import { FILE_MENU_XPATH, EDIT_MENU_XPATH } from '../helpers/menu-xpaths';
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
    rightClickText,
    scope,
    /* eslint-enable no-unused-vars */
} = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram, currentRubyProgram, waitForErrorOnLine, waitForNoErrors } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('convert Code from Ruby', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Code from Ruby -> Ruby from Code', async () => {
        await loadUri(uri);

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('move(\\n10\\n)\\n');

        await clickText('Code', '*[@role="tab"]');

        await clickXpath(EDIT_MENU_XPATH);
        await clickText('Generate Ruby from Code');

        await clickText('Ruby', '*[@role="tab"]');

        expect(await currentRubyProgram()).toEqual('move(10)\n');
    });

    describe('syntax error', () => {
        beforeEach(async () => {
            await loadUri(uri);
            await clickText('Ruby', '*[@role="tab"]');
            await fillInRubyProgram('move(10)');
            await clickText('Code', '*[@role="tab"]');
            await clickText('Ruby', '*[@role="tab"]');
            await fillInRubyProgram('move(10');
        });

        test('clicked Code', async () => {
            await clickText('Code', '*[@role="tab"]');

            await findByXpath('//li[@role="tab" and @aria-selected="false"]/span[text()="Code"]');
            await findByXpath('//li[@role="tab" and @aria-selected="true"]/span[text()="Ruby"]');
            await findByXpath(
                '//*[contains(@class, "alert_alert-message")]/' +
                    'span[text()="Could not convert Ruby to Code. Please fix Ruby!"]',
            );
            await waitForErrorOnLine(1);
        });

        test('clicked Go', async () => {
            await clickXpath('//img[@title="Go"]');

            await findByXpath(
                '//*[contains(@class, "alert_alert-message")]/' +
                    'span[text()="Could not convert Ruby to Code. Please fix Ruby!"]',
            );
            await waitForErrorOnLine(1);
        });

        test('clicked "Download to your computer" menu', async () => {
            await clickXpath(FILE_MENU_XPATH);
            await clickText('Save to your computer');

            await findByXpath(
                '//*[contains(@class, "alert_alert-message")]/' +
                    'span[text()="Could not convert Ruby to Code. Please fix Ruby!"]',
            );
            await waitForErrorOnLine(1);
        });

        test('changed sprite', async () => {
            await clickXpath('//button[@aria-label="Choose a Sprite"]');
            await clickText('Apple', scope.modal);

            await findByXpath(
                '//*[contains(@class, "sprite-selector-item_sprite-selector-item") and ' +
                    'contains(@class, "sprite-selector-item_is-selected")]/*/' +
                    '*[contains(@class, "sprite-selector-item_sprite-name") and text()="Sprite1"]',
            );
            await findByXpath(
                '//*[contains(@class, "sprite-selector-item_sprite-selector-item") and ' +
                    'not(contains(@class, "sprite-selector-item_is-selected"))]/*/' +
                    '*[contains(@class, "sprite-selector-item_sprite-name") and text()="Apple"]',
            );
            await findByXpath(
                '//*[contains(@class, "alert_alert-message")]/' +
                    'span[text()="Could not convert Ruby to Code. Please fix Ruby!"]',
            );
            await waitForErrorOnLine(1);
        });

        test('errors cleared when executing fixed code with Go button', async () => {
            // First, trigger errors by clicking Go with invalid code
            await clickXpath('//img[@title="Go"]');
            await waitForErrorOnLine(1);

            // Fix the code
            await fillInRubyProgram('move(10)');

            // Execute the fixed code
            await clickXpath('//img[@title="Go"]');

            // Verify that errors are cleared
            await waitForNoErrors();
        });

        test('recover with "Generate Ruby from Code" menu', async () => {
            await clickText('Code', '*[@role="tab"]');

            await findByXpath(
                '//*[contains(@class, "alert_alert-message")]/' +
                    'span[text()="Could not convert Ruby to Code. Please fix Ruby!"]',
            );
            await clickXpath('//div[contains(@class, "alert_alert-close-button")]');

            await clickXpath(EDIT_MENU_XPATH);
            await clickText('Generate Ruby from Code');

            expect(await currentRubyProgram()).toEqual('move(10)\n');

            await clickText('Code', '*[@role="tab"]');
            await findByXpath('//li[@role="tab" and @aria-selected="true"]/span[text()="Code"]');
            await findByXpath('//li[@role="tab" and @aria-selected="false"]/span[text()="Ruby"]');
        });
    });
});
