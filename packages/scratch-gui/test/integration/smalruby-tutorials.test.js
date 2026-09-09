/**
 * Integration tests for Smalruby tutorials.
 * Consolidated from smalruby-tutorials.test.js and tutorial-block-restriction.test.js
 * to reduce cold-start overhead.
 */
import path from 'path';
// === Smalruby: 既知の無視できる SEVERE ログの判定は helper に切り出してある（unit test 付き） ===
import { unexpectedSevereLogs } from '../helpers/ignorable-severe-logs';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickText, clickXpath, findByXpath, getDriver, getLogs, loadUri, scope, textExists, waitForLoadingFinished } =
    new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');
const uriWithTutorial = (id) => `${uri}?tutorial=${id}`;

let driver;

describe('Smalruby Tutorials', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('opens with the Tutorial Library showing and no severe logs', async () => {
        await loadUri(uri);
        // === Smalruby: clear any persistent localStorage state from prior runs
        // and wait for the editor to finish loading before looking for the
        // first-time-user tooltip.
        await driver.executeScript(
            `window.localStorage.removeItem('smalruby:tutorialSeen'); window.localStorage.removeItem('smalruby:rubyTabUsed');`,
        );
        await driver.navigate().refresh();
        await waitForLoadingFinished();
        await clickText('Try Ruby!');
        await findByXpath('//div[contains(@class, "card_card_")]');

        // Make sure the background is still interactable
        await clickText('Costumes');
        await clickText('Code');

        const logs = await getLogs({ includeAllLevels: true });
        // === Smalruby: 既知の無視できる SEVERE ログを除外する (isIgnorableSevereLog 参照) ===
        expect(unexpectedSevereLogs(logs)).toEqual([]);
    });

    test('can open tutorials by url id', async () => {
        await loadUri(`${uriWithTutorial('getStarted')}`);
        await findByXpath('//div[contains(@class, "card_card_")]');

        const logs = await getLogs({ includeAllLevels: true });
        // === Smalruby: 既知の無視できる SEVERE ログを除外する (isIgnorableSevereLog 参照) ===
        expect(unexpectedSevereLogs(logs)).toEqual([]);
    });

    test('can close tutorial card', async () => {
        await loadUri(`${uriWithTutorial('getStarted')}`);
        await findByXpath('//div[contains(@class, "card_card_")]');

        await clickText('Close');

        const cards = await driver.findElements({ xpath: '//div[contains(@class, "card_card_")]' });
        expect(cards.length).toBe(0);
    });

    // === Smalruby: Start of start-tutorial button ===
    describe('Start Tutorial Button', () => {
        test('shows "Start Tutorial" button on the first step of a tutorial', async () => {
            await loadUri(uriWithTutorial('getStarted'));
            await findByXpath('//div[contains(@class, "card_card_")]');

            expect(await textExists('Start Tutorial')).toBe(true);

            const logs = await getLogs();
            expect(logs).toEqual([]);
        });

        test('clicking "Start Tutorial" resets project and sets title to tutorial name', async () => {
            await loadUri(uriWithTutorial('getStarted'));
            await findByXpath('//div[contains(@class, "card_card_")]');

            // Click the Start Tutorial button
            await clickText('Start Tutorial');

            // Wait for project reset to complete
            await driver.sleep(2000);

            // Verify project title changed to the tutorial name
            const titleValue = await driver.executeScript(
                'return document.querySelector(\'input[class*="title-field"]\').value;',
            );
            expect(titleValue).toBe('Getting Started');

            const logs = await getLogs();
            expect(logs).toEqual([]);
        });
    });
    // === Smalruby: End of start-tutorial button ===

    describe('Tutorial Block Restriction', () => {
        describe('chat-1-basic-1 tutorial', () => {
            test('restricts toolbox to allowed blocks (Looks and Events; no Motion or Sound)', async () => {
                await loadUri(uriWithTutorial('chat1Basic1'));
                await findByXpath('//div[contains(@class, "card_card_")]');
                await driver.sleep(1000);

                expect(await textExists('Looks', scope.blocksTab)).toBe(true);
                expect(await textExists('Events', scope.blocksTab)).toBe(true);

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

                expect(await textExists('Motion', scope.blocksTab)).toBe(false);

                await clickText('Close');
                await driver.sleep(500);

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
                const testUri = `${uri}?only_blocks=sound_&tutorial=chat1Basic1`;
                await loadUri(testUri);
                await findByXpath('//div[contains(@class, "card_card_")]');
                await driver.sleep(1000);

                expect(await textExists('Looks', scope.blocksTab)).toBe(true);
                expect(await textExists('Events', scope.blocksTab)).toBe(true);
                expect(await textExists('Sound', scope.blocksTab)).toBe(false);
                expect(await textExists('Motion', scope.blocksTab)).toBe(false);

                await clickText('Close');
                await driver.sleep(500);

                expect(await textExists('Sound', scope.blocksTab)).toBe(true);
                expect(await textExists('Looks', scope.blocksTab)).toBe(false);
                expect(await textExists('Events', scope.blocksTab)).toBe(false);
                expect(await textExists('Motion', scope.blocksTab)).toBe(false);

                const logs = await getLogs();
                expect(logs).toEqual([]);
            });
        });

        describe('chat-1-basic-2 tutorial', () => {
            test('restricts toolbox to allowed blocks (Looks and Events; no Motion or Sound)', async () => {
                await loadUri(uriWithTutorial('chat1Basic2'));
                await findByXpath('//div[contains(@class, "card_card_")]');
                await driver.sleep(1000);

                expect(await textExists('Looks', scope.blocksTab)).toBe(true);
                expect(await textExists('Events', scope.blocksTab)).toBe(true);

                expect(await textExists('Motion', scope.blocksTab)).toBe(false);
                expect(await textExists('Sound', scope.blocksTab)).toBe(false);
                expect(await textExists('Control', scope.blocksTab)).toBe(false);
                expect(await textExists('Sensing', scope.blocksTab)).toBe(false);
                expect(await textExists('Operators', scope.blocksTab)).toBe(false);

                const logs = await getLogs();
                expect(logs).toEqual([]);
            });
        });

        describe('chat-1-basic-3 tutorial', () => {
            test('restricts toolbox to allowed blocks (Looks and Events; no Motion or Sound)', async () => {
                await loadUri(uriWithTutorial('chat1Basic3'));
                await findByXpath('//div[contains(@class, "card_card_")]');
                await driver.sleep(1000);

                expect(await textExists('Looks', scope.blocksTab)).toBe(true);
                expect(await textExists('Events', scope.blocksTab)).toBe(true);

                expect(await textExists('Motion', scope.blocksTab)).toBe(false);
                expect(await textExists('Sound', scope.blocksTab)).toBe(false);
                expect(await textExists('Control', scope.blocksTab)).toBe(false);
                expect(await textExists('Sensing', scope.blocksTab)).toBe(false);
                expect(await textExists('Operators', scope.blocksTab)).toBe(false);

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
});
