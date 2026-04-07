import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';
import {FILE_MENU_XPATH} from '../helpers/menu-xpaths';

const {
    clickText,
    clickXpath,
    findByXpath,
    getDriver,
    Key,
    loadUri
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Project state', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('File->New resets project title', async () => {
        const defaultProjectTitle = 'Smalruby Project';
        await loadUri(uri);
        const inputEl = await findByXpath(`//input[@value="${defaultProjectTitle}"]`);
        for (let i = 0; i < defaultProjectTitle.length; i++) {
            inputEl.sendKeys(Key.BACK_SPACE);
        }
        inputEl.sendKeys('Changed title of project');
        await clickText('Costumes'); // just to blur the input
        // verify that project title has changed
        await clickXpath('//input[@value="Changed title of project"]');
        await clickXpath(FILE_MENU_XPATH);
        await clickXpath('//li[span[text()="New"]]');
        // project title should be default again
        await clickXpath(`//input[@value="${defaultProjectTitle}"]`);
    });
});
