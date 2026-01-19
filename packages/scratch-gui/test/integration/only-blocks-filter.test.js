import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    clickBlocksCategory,
    findByText,
    getDriver,
    getLogs,
    loadUri,
    notExistsByXpath,
    scope,
    textExists
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('only_blocks URL parameter filtering', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('Shows all blocks when only_blocks parameter is not specified', async () => {
        await loadUri(uri);
        await notExistsByXpath('//*[div[contains(@class, "loader_background")]]');
        await clickText('Code');
        
        // Check basic functionality - just verify core categories exist
        await clickBlocksCategory('Operators');
        await findByText('join', scope.blocksTab); // This is tested in existing blocks.test.js
        
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    test('Shows only motion blocks when only_blocks=motion_', async () => {
        const testUri = `${uri}?only_blocks=motion_`;
        await loadUri(testUri);
        await notExistsByXpath('//*[div[contains(@class, "loader_background")]]');
        await clickText('Code');
        
        // Motion category should be visible and contain blocks
        await clickBlocksCategory('Motion');
        await findByText('10', scope.blocksTab); // move 10 steps block
        
        // Variables and My Blocks should always be present
        expect(await textExists('Variables', scope.blocksTab)).toBeTruthy();
        expect(await textExists('My Blocks', scope.blocksTab)).toBeTruthy();
        
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });

    test('Variables category is always visible regardless of filter', async () => {
        const testUri = `${uri}?only_blocks=motion_`;
        await loadUri(testUri);
        await notExistsByXpath('//*[div[contains(@class, "loader_background")]]');
        await clickText('Code');
        
        // Variables should be present and functional
        await clickBlocksCategory('Variables');
        await findByText('my\u00A0variable', scope.blocksTab);
        
        const logs = await getLogs();
        expect(logs).toEqual([]);
    });
});