import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickText, getDriver, loadUri, scope, findByXpath, rightClickText } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe.skip('Debug Smalruby 3 Defaults', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Log costume panel details', async () => {
        await loadUri(uri);
        await clickText('Costumes');
        await driver.sleep(2000);

        const costumePanel = await driver.findElement({ xpath: "//*[@id='panel:r0:1']" });
        console.log('--- COSTUME PANEL TEXT ---');
        console.log(await costumePanel.getText());

        await rightClickText('costume1', scope.costumesTab);
        await clickText('duplicate', scope.contextMenu);
        await driver.sleep(2000);

        console.log('--- COSTUME PANEL TEXT AFTER DUPLICATION ---');
        console.log(await costumePanel.getText());
    });
});
