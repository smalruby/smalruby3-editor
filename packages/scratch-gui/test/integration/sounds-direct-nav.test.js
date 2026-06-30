import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickXpath, findByXpath, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

// Issue #633: opening the sounds tab via direct navigation (?tab=sounds) mounts
// the SoundEditor before any user gesture has created the shared AudioContext.
// Previously this threw in AudioBufferPlayer's constructor (createBuffer on an
// undefined context). The editor must now render without crashing, and playback
// must still work once a user gesture creates the context.
describe('Direct navigation to the sounds tab (?tab=sounds)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('renders the sound editor without an AudioContext crash', async () => {
        await loadUri(`${uri}?tab=sounds`);
        await waitForLoadingFinished();

        // The Play button only renders if the SoundEditor mounted past
        // AudioBufferPlayer construction, i.e. no crash on direct navigation.
        await findByXpath('//button[@title="Play"]');

        // No TypeError from AudioBufferPlayer should have been logged on mount.
        let logs = await getLogs();
        await expect(logs).toEqual([]);

        // Clicking Play is the first user gesture; playback must work without error.
        await clickXpath('//button[@title="Play"]');
        logs = await getLogs();
        await expect(logs).toEqual([]);
    });
});
