import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    findByXpath,
    getDriver,
    loadUri
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html?tutorial=all');
const uriPrefix = path.resolve(__dirname, '../../build/index.html?tutorial=');

let driver;

describe('Working with shortcut to Tutorials library', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('opens with the Tutorial Library showing', async () => {
        await loadUri(uri);
        await clickText('Getting Started');
        await findByXpath('//div[contains(@class, "card_card_")]');

        // Make sure the background is still interactable
        await clickText('Costumes');
        await clickText('Code');
    });

    test('can open tutorials by url id', async () => {
        // urlId for getting-started is 'getstarted'
        await loadUri(`${uriPrefix}getstarted`);
        // should open the tutorial card immediately
        await findByXpath('//div[contains(@class, "card_card_")]');
    });
});
