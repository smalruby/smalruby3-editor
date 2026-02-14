import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    findByXpath,
    getDriver,
    getLogs,
    loadUri
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html?tutorial=all');
const uriPrefix = path.resolve(__dirname, '../../build/index.html?tutorial=');

let driver;

describe('Smalruby Tutorials', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('opens with the Tutorial Library showing and no severe logs', async () => {
        await loadUri(uri);
        // "さあ、始めましょう" is the name of Getting Started in Japanese
        // In English test environment:
        await clickText('Getting Started');
        await findByXpath('//div[contains(@class, "card_card_")]');

        // Make sure the background is still interactable
        await clickText('Costumes');
        await clickText('Code');

        const logs = await getLogs({includeAllLevels: true});
        const severeLogs = logs.filter(l => l.level.name === 'SEVERE');
        expect(severeLogs).toEqual([]);
    });

    test('can open tutorials by url id', async () => {
        // urlId for getting-started is 'getstarted'
        await loadUri(`${uriPrefix}getstarted`);
        // should open the tutorial card immediately
        await findByXpath('//div[contains(@class, "card_card_")]');

        const logs = await getLogs({includeAllLevels: true});
        const severeLogs = logs.filter(l => l.level.name === 'SEVERE');
        expect(severeLogs).toEqual([]);
    });
});
