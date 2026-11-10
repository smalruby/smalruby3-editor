/**
 * Integration tests for the lesson goal monitor (src/lib/lessons/goal-monitor.js).
 *
 * The lesson UI that opens a challenge does not exist yet, so the goal is attached to the
 * live VM through the debug hook `window.smalruby.lessonGoal` (exposed by the always-mounted
 * LessonGoalWatcher). A Ruby program is put into the project through the Ruby tab, then run
 * by the green flag / a key press, and the monitor must report the goal as met.
 *
 * Browser logs are not asserted here: like the other Ruby tab tests, opening the build from
 * `file://` makes the self-hosted Monaco editor worker fail to load (see
 * helpers/ignorable-severe-logs.js), which is unrelated to the goal monitor.
 */
import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const { clickText, getDriver, loadUri } = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);

const uri = `${path.resolve(__dirname, '../../build/index.html')}?no_beforeunload=1&tab=ruby`;

let driver;

const waitForLessonGoalHook = () =>
    driver.wait(
        () =>
            driver.executeScript(
                'return Boolean(window.smalruby && window.smalruby.vm && window.smalruby.lessonGoal);',
            ),
        20000,
        'window.smalruby.lessonGoal did not become available',
    );

// Put the Ruby program into the current sprite. The conversion to blocks happens when
// switching to the Code tab; wait until the sprite actually has the hat block.
const putRubyProgram = async (code, hatOpcode) => {
    await rubyHelper.fillInRubyProgram(code);
    await clickText('Code', '*[@role="tab"]');
    await driver.wait(
        () =>
            driver.executeScript(
                `const blocks = window.smalruby.vm.editingTarget.blocks._blocks;
                 return Object.values(blocks).some((b) => b.opcode === arguments[0]);`,
                hatOpcode,
            ),
        15000,
        `the Ruby program was not converted to blocks (${hatOpcode} not found)`,
    );
    await driver.sleep(500);
};

const attachGoal = (goal) =>
    driver.executeScript(
        `window.__lessonGoalDone = false;
         window.smalruby.lessonGoal.attach(arguments[0], () => { window.__lessonGoalDone = true; });`,
        goal,
    );

const isGoalDone = () => driver.executeScript('return window.__lessonGoalDone === true;');

const waitForGoalDone = () => driver.wait(isGoalDone, 10000, 'goal was not satisfied');

describe('Lesson goal monitor', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('uses + said: blocks run from the green flag script and the spoken text', async () => {
        await loadUri(uri);
        await waitForLessonGoalHook();
        await putRubyProgram('when_flag_clicked do\n  move(10)\n  say("こんにちは")\nend\n', 'event_whenflagclicked');

        await attachGoal([
            { type: 'uses', trigger: { hat: 'event_whenflagclicked' }, blocks: ['motion_movesteps', 'looks_say'] },
            { type: 'said', text: 'こんにちは' },
        ]);
        await driver.sleep(500);
        expect(await isGoalDone()).toBe(false);

        await driver.executeScript('window.smalruby.vm.greenFlag();');
        await waitForGoalDone();
        expect(await isGoalDone()).toBe(true);
    });

    test('uses with a key trigger and argument matcher: the block ran with y > 0 from the space key', async () => {
        await loadUri(uri);
        await waitForLessonGoalHook();
        await putRubyProgram('when_key_pressed("space") do\n  self.y += 10\nend\n', 'event_whenkeypressed');

        await attachGoal([
            {
                type: 'uses',
                trigger: { hat: 'event_whenkeypressed', key: 'space' },
                blocks: [{ opcode: 'motion_changeyby', args: { DY: { gt: 0 } } }],
            },
        ]);
        // Running the script another way (green flag) must not count as the key.
        await driver.executeScript('window.smalruby.vm.greenFlag();');
        await driver.sleep(500);
        expect(await isGoalDone()).toBe(false);

        await driver.executeScript(
            `const vm = window.smalruby.vm;
             vm.postIOData('keyboard', { key: ' ', isDown: true });
             setTimeout(() => vm.postIOData('keyboard', { key: ' ', isDown: false }), 100);`,
        );
        await waitForGoalDone();
        expect(await isGoalDone()).toBe(true);
    });

    test('variable: the stage variable reaches the value after the script changed it', async () => {
        await loadUri(uri);
        await waitForLessonGoalHook();
        await putRubyProgram(
            'when_flag_clicked do\n  $回数 = 0\n  3.times do\n    $回数 += 1\n  end\nend\n',
            'event_whenflagclicked',
        );

        await attachGoal([
            {
                type: 'uses',
                trigger: { hat: 'event_whenflagclicked' },
                blocks: [{ opcode: 'data_changevariableby', count: 3 }],
            },
            { type: 'variable', name: '回数', value: { gte: 3 } },
        ]);
        await driver.executeScript('window.smalruby.vm.greenFlag();');
        await waitForGoalDone();
        expect(await isGoalDone()).toBe(true);
    });

    test('completing the open challenge shows "You did it!" and records it', async () => {
        await loadUri(uri);
        await waitForLessonGoalHook();
        await driver.executeScript(`
            window.localStorage.removeItem('smalruby:lessonProgress');
            window.smalruby.lessonGoal.openChallenge('blocks-l1-key-sound');
        `);
        await driver.executeScript(`window.smalruby.lessonGoal.markCompleted('blocks-l1-key-sound');`);

        const toast = await driver.wait(
            () => driver.findElement({ css: '[data-testid="lesson-completed-toast"]' }),
            10000,
            'the completed toast did not appear',
        );
        expect(await toast.isDisplayed()).toBe(true);
        const challengeName = await driver.findElement({ css: '[data-testid="lesson-completed-toast-challenge"]' });
        expect(await challengeName.getText()).toBe('Play a sound with a key');

        const saved = await driver.executeScript(
            `return JSON.parse(window.localStorage.getItem('smalruby:lessonProgress'));`,
        );
        expect(saved.challenges['blocks-l1-key-sound']).toEqual(
            expect.objectContaining({ courseId: 'kyou-kara-programmer', lessonId: 'blocks-l1' }),
        );

        await driver.executeScript(`document.querySelector('[data-testid="lesson-completed-toast-close"]').click();`);
        await driver.sleep(300);
        const toasts = await driver.findElements({ css: '[data-testid="lesson-completed-toast"]' });
        expect(toasts.length).toBe(0);
        await driver.executeScript(`window.smalruby.lessonGoal.closeLesson();`);
    });
});
