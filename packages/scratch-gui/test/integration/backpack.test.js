import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    findByText,
    findByXpath,
    getDriver,
    getLogs,
    loadUri,
    waitForLoadingFinished
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Backpack with localStorage', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Backpack header is visible without backpack_host param', async () => {
        await loadUri(uri);
        // Backpack should always be visible (localStorage default)
        await findByText('Backpack');
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    test('Backpack can be expanded and shows empty state', async () => {
        await loadUri(uri);
        // Clear localStorage to ensure clean state
        await driver.executeScript(`localStorage.removeItem('smalrubyBackpack')`);

        // Click Backpack to expand
        await clickText('Backpack');
        // Should show empty state
        await findByText('Backpack is empty');
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    test('Backpack can be expanded from Costumes tab', async () => {
        await loadUri(uri);
        await driver.executeScript(`localStorage.removeItem('smalrubyBackpack')`);

        // Switch to costumes tab first
        await clickText('Costumes');

        // Backpack is at the bottom; click to expand
        await clickText('Backpack');
        await findByText('Backpack is empty');
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    test('Backpack persists items in localStorage across page load', async () => {
        await loadUri(uri);
        // Seed localStorage with a backpack item directly
        const item = {
            id: 'test-id-123',
            type: 'script',
            name: 'test script',
            mime: 'application/json',
            body: 'W10=', // base64 of '[]'
            thumbnail: '/9j/4AAQSkZJRg==' // minimal jpeg header base64
        };
        await driver.executeScript(
            `localStorage.setItem('smalrubyBackpack', JSON.stringify([${JSON.stringify(item)}]))`
        );

        // Reload the page and wait for it to finish loading
        await driver.navigate().refresh();
        await waitForLoadingFinished();

        // Expand backpack
        await clickText('Backpack');

        // Should show items list (not empty state)
        // The ul.backpack-list-inner only renders when there are items
        await findByXpath('//ul[contains(@class, "backpack-list-inner")]');
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });
});
