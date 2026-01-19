import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    clickXpath,
    findByXpath,
    notExistsByXpath,
    getDriver,
    loadUri,
    urlFor
} = new SeleniumHelper();

let driver;

const trademarkNames = [
    'Cat',
    'Cat-Flying',
    'Gobo',
    'Pico',
    'Pico Walking',
    'Nano',
    'Tera',
    'Giga',
    'Giga Walking'
];

describe('Removed trademarks (ex: Scratch Cat)', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Removed trademark sprites', async () => {
        await loadUri(urlFor('/'));
        await clickXpath('//button[@aria-label="Choose a Sprite"]');
        const searchElement = await findByXpath("//input[@placeholder='Search']");

        for (const name of trademarkNames) {
            await searchElement.sendKeys(name);
            expect(await notExistsByXpath(`//*[span[text()="${name}"]]`)).toBeTruthy();
            searchElement.clear();
        }
    }, 60 * 1000);

    test('Removed trademark costumes', async () => {
        await loadUri(urlFor('/'));
        await clickText('Costumes');
        await clickXpath('//button[@aria-label="Choose a Costume"]');
        const searchElement = await findByXpath("//input[@placeholder='Search']");

        for (const name of trademarkNames) {
            const costumePrefix = `${name}-`;
            await searchElement.sendKeys(costumePrefix);
            expect(await notExistsByXpath(`//*[span[contains(text(), "${costumePrefix}")]]`)).toBeTruthy();
            searchElement.clear();
        }
    }, 120 * 1000);
});
