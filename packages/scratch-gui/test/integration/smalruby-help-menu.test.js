/**
 * Integration tests for the "?" (help) menu in the menu bar.
 *
 * Tutorials and Debug are no longer menu-bar buttons; both live inside the
 * "?" menu so they stay out of sight until someone looks for help.
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickXpath, findByText, findByXpath, getDriver, loadUri, scope, waitForLoadingFinished } =
    new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

const ABOUT_BUTTON_XPATH = '//*[@data-testid="menu-bar-about"]';
const HELP_TUTORIALS_XPATH = '//*[@data-testid="menu-bar-help-tutorials"]';
const HELP_DEBUG_XPATH = '//*[@data-testid="menu-bar-help-debug"]';

let driver;

describe('Menu bar help ("?") menu', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('menu bar has no Tutorials / Debug buttons', async () => {
        await loadUri(uri);
        await waitForLoadingFinished();

        const tutorialsButtons = await driver.findElements({ xpath: '//*[@aria-label="Tutorials"]' });
        const debugButtons = await driver.findElements({ xpath: '//*[@aria-label="Debug"]' });
        expect(tutorialsButtons.length).toBe(0);
        expect(debugButtons.length).toBe(0);
    });

    test('help items are hidden until the "?" menu is opened', async () => {
        await loadUri(uri);
        await waitForLoadingFinished();

        const items = await driver.findElements({ xpath: HELP_TUTORIALS_XPATH });
        expect(items.length).toBe(0);

        await clickXpath(ABOUT_BUTTON_XPATH);
        await findByXpath(HELP_TUTORIALS_XPATH);
        await findByXpath(HELP_DEBUG_XPATH);
    });

    test('"?" > Tutorials opens the tutorial library', async () => {
        await loadUri(uri);
        await waitForLoadingFinished();

        await clickXpath(ABOUT_BUTTON_XPATH);
        await clickXpath(HELP_TUTORIALS_XPATH);
        await findByText('Choose a Tutorial', scope.modal);
    });

    test('"?" > Debug opens the debug modal', async () => {
        await loadUri(uri);
        await waitForLoadingFinished();

        await clickXpath(ABOUT_BUTTON_XPATH);
        await clickXpath(HELP_DEBUG_XPATH);
        await findByText('Debugging | Getting Unstuck');
    });
});
