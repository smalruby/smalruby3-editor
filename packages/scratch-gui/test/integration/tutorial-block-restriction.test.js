import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const {
    clickText,
    findByXpath,
    getDriver,
    getLogs,
    loadUri,
    scope,
    textExists
} = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');
const uriWithTutorial = id => `${uri}?tutorial=${id}`;

let driver;

describe('Tutorial Block Restriction', () => {
    beforeAll(() => {
        driver = getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    describe('chat-1-basic-1 tutorial', () => {
        test('restricts toolbox to allowed blocks (Looks and Events; no Motion or Sound)', async () => {
            await loadUri(uriWithTutorial('chat1Basic1'));
            await findByXpath('//div[contains(@class, "card_card_")]');
            await driver.sleep(1000);

            // Allowed categories: Looks, Events
            expect(await textExists('Looks', scope.blocksTab)).toBe(true);
            expect(await textExists('Events', scope.blocksTab)).toBe(true);

            // Disallowed categories: Motion, Sound, Control, Sensing, Operators
            expect(await textExists('Motion', scope.blocksTab)).toBe(false);
            expect(await textExists('Sound', scope.blocksTab)).toBe(false);
            expect(await textExists('Control', scope.blocksTab)).toBe(false);
            expect(await textExists('Sensing', scope.blocksTab)).toBe(false);
            expect(await textExists('Operators', scope.blocksTab)).toBe(false);

            const logs = await getLogs();
            expect(logs).toEqual([]);
        });

        test('restores all blocks after tutorial is closed', async () => {
            await loadUri(uriWithTutorial('chat1Basic1'));
            await findByXpath('//div[contains(@class, "card_card_")]');
            await driver.sleep(1000);

            // Verify restriction is active
            expect(await textExists('Motion', scope.blocksTab)).toBe(false);

            // Close the tutorial
            await clickText('Close');
            await driver.sleep(500);

            // All categories should be restored
            expect(await textExists('Motion', scope.blocksTab)).toBe(true);
            expect(await textExists('Looks', scope.blocksTab)).toBe(true);
            expect(await textExists('Sound', scope.blocksTab)).toBe(true);
            expect(await textExists('Events', scope.blocksTab)).toBe(true);
            expect(await textExists('Control', scope.blocksTab)).toBe(true);
            expect(await textExists('Sensing', scope.blocksTab)).toBe(true);
            expect(await textExists('Operators', scope.blocksTab)).toBe(true);

            const logs = await getLogs();
            expect(logs).toEqual([]);
        });

        test('overrides only_blocks restriction; restores it after close', async () => {
            // Load with only_blocks=sound_ (only Sound) AND chat-1-basic-1 tutorial
            const testUri = `${uri}?only_blocks=sound_&tutorial=chat1Basic1`;
            await loadUri(testUri);
            await findByXpath('//div[contains(@class, "card_card_")]');
            await driver.sleep(1000);

            // Tutorial restriction should override only_blocks:
            // chat-1-basic-1 allows Looks and Events, not Sound
            expect(await textExists('Looks', scope.blocksTab)).toBe(true);
            expect(await textExists('Events', scope.blocksTab)).toBe(true);
            expect(await textExists('Sound', scope.blocksTab)).toBe(false);
            expect(await textExists('Motion', scope.blocksTab)).toBe(false);

            // Close the tutorial
            await clickText('Close');
            await driver.sleep(500);

            // only_blocks restriction (Sound only) should be restored
            expect(await textExists('Sound', scope.blocksTab)).toBe(true);
            expect(await textExists('Looks', scope.blocksTab)).toBe(false);
            expect(await textExists('Events', scope.blocksTab)).toBe(false);
            expect(await textExists('Motion', scope.blocksTab)).toBe(false);

            const logs = await getLogs();
            expect(logs).toEqual([]);
        });
    });

    describe('chat-2-sprites-1 tutorial', () => {
        test('restricts toolbox to allowed blocks (no Motion)', async () => {
            await loadUri(uriWithTutorial('chat2Sprites1'));
            await findByXpath('//div[contains(@class, "card_card_")]');
            await driver.sleep(1000);

            expect(await textExists('Looks', scope.blocksTab)).toBe(true);
            expect(await textExists('Events', scope.blocksTab)).toBe(true);
            expect(await textExists('Motion', scope.blocksTab)).toBe(false);
            expect(await textExists('Sound', scope.blocksTab)).toBe(false);

            const logs = await getLogs();
            expect(logs).toEqual([]);
        });
    });

    describe('chat-3-mesh-1 tutorial', () => {
        test('restricts toolbox to allowed blocks (no Motion)', async () => {
            await loadUri(uriWithTutorial('chat3Mesh1'));
            await findByXpath('//div[contains(@class, "card_card_")]');
            await driver.sleep(1000);

            expect(await textExists('Looks', scope.blocksTab)).toBe(true);
            expect(await textExists('Events', scope.blocksTab)).toBe(true);
            expect(await textExists('Motion', scope.blocksTab)).toBe(false);
            expect(await textExists('Sound', scope.blocksTab)).toBe(false);

            const logs = await getLogs();
            expect(logs).toEqual([]);
        });
    });
});
