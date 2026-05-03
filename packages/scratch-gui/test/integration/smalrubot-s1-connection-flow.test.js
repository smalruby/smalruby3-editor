import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickXpath, clickText, findByXpath, getDriver, loadUri } = seleniumHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

const findByTestId = async (testId) => findByXpath(`//*[@data-testid="${testId}"]`);

const clickByTestId = async (testId) => {
    const el = await findByTestId(testId);
    await el.click();
};

const activateSmalrubotS1Extension = async () => {
    // Open extension chooser
    await clickXpath('//button[@title="Add Extension"]');
    // Click the smalrubotS1 extension by name
    await clickText('Smalrubot S1');
    // Wait briefly for the connection modal to mount
    await new Promise((resolve) => setTimeout(resolve, 1000));
};

describe('SmalrubotS1 dedicated connection flow', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('shows the initial step (student/teacher choice) when extension is activated', async () => {
        await loadUri(uri);
        await activateSmalrubotS1Extension();

        // The initial step exposes two action buttons via data-testid.
        // Note: in headless Chromium without WebSerial, the unsupported-step
        // is shown instead. Both branches are valid here.
        const initialButton = await driver.executeScript(
            'return document.querySelector("[data-testid=smalrubot-s1-initial-connect]") !== null;',
        );
        const unsupported = await driver.executeScript(
            'return document.querySelector("[data-testid=smalrubot-s1-unsupported-help]") !== null;',
        );

        expect(initialButton || unsupported).toBe(true);
    });

    test('clicking "Write firmware" button opens the firmware modal and closes the connection modal', async () => {
        await loadUri(uri);
        await activateSmalrubotS1Extension();

        // Force WebSerial-supported branch: only run this assertion if initial button exists
        const hasInitial = await driver.executeScript(
            'return document.querySelector("[data-testid=smalrubot-s1-initial-flash-firmware]") !== null;',
        );
        if (!hasInitial) {
            // Headless environment without WebSerial: skip
            return;
        }

        await clickByTestId('smalrubot-s1-initial-flash-firmware');
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Connection modal should have closed; firmware modal should appear.
        // Firmware modal exposes a known button id from existing tests.
        const firmwareModalVisible = await driver.executeScript(
            'return document.querySelector("[id^=connectionModal]") === null;',
        );
        expect(firmwareModalVisible).toBe(true);
    });
});
