import path from 'path';
import RubyHelper from '../helpers/ruby-helper';
import SeleniumHelper from '../helpers/selenium-helper';

const seleniumHelper = new SeleniumHelper();
const {
    /* eslint-disable no-unused-vars */
    clickText,
    clickButton,
    clickXpath,
    findByText,
    findByXpath,
    getDriver,
    getLogs,
    loadUri,
    waitForLoadingFinished,
    notExistsByXpath,
    rightClickText,
    scope,
    /* eslint-enable no-unused-vars */
} = seleniumHelper;
const rubyHelper = new RubyHelper(seleniumHelper);
const { fillInRubyProgram } = rubyHelper;

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

// Regression tests for issue #719: onWorkspaceUpdate used to call
// updateToolbox() inside the ScratchBlocks.Events.disable() window, so the
// flyout rebuild's BLOCK_CREATE events were silently discarded (Blockly v12
// drops events fired while disabled) and never reached
// vm.flyoutBlockListener / vm.monitorBlockListener. Variables created by the
// Ruby -> blocks conversion were then missing from runtime.monitorBlocks and
// runtime.flyoutBlocks, leaving their monitor checkboxes inert.
describe('Ruby conversion keeps flyout/monitor block containers in sync (issue #719)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    // Probe the VM containers for the block belonging to a stage variable.
    // Returns null when the variable itself does not exist yet.
    const probeVariableSync = (d, varName) =>
        d.executeScript(
            `
            const vm = window.smalruby && window.smalruby.vm;
            if (!vm) return null;
            const stage = vm.runtime.getTargetForStage();
            const entry = Object.entries(stage.variables)
                .find(([, v]) => v.name === arguments[0]);
            if (!entry) return null;
            const varId = entry[0];
            return {
                varId,
                inMonitorBlocks: !!vm.runtime.monitorBlocks._blocks[varId],
                inFlyoutBlocks: !!vm.runtime.flyoutBlocks._blocks[varId],
                sameNameCount: Object.values(stage.variables)
                    .filter(v => v.name === arguments[0]).length
            };
            `,
            varName,
        );

    const waitForVariable = async (d, varName) => {
        let probe = null;
        for (let i = 0; i < 40 && !probe; i++) {
            probe = await probeVariableSync(d, varName);
            if (!probe) await d.sleep(250);
        }
        return probe;
    };

    test('clicking Go on the Ruby tab registers converted variables in monitorBlocks', async () => {
        await loadUri(uri);

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('$points = 0\\n');

        // Convert while STAYING on the Ruby tab. This path has no
        // code-tab visibility transition, so nothing rebuilds the flyout
        // afterwards — before the fix the discarded create events left
        // monitorBlocks/flyoutBlocks permanently out of sync.
        await clickXpath('//img[@title="Go"]');

        const probe = await waitForVariable(driver, 'points');
        expect(probe).not.toBeNull();
        // Allow one frame for Blockly's async event delivery.
        await driver.sleep(500);
        const synced = await probeVariableSync(driver, 'points');
        expect(synced.inMonitorBlocks).toBe(true);
        expect(synced.inFlyoutBlocks).toBe(true);
        // Adversarial: the now-live flyout var_create events must not create
        // duplicate (ghost) variables via blocks.blocklyListen.
        expect(synced.sameNameCount).toBe(1);
    });

    test('monitor checkbox path works for a variable created by Ruby conversion', async () => {
        await loadUri(uri);

        await clickText('Ruby', '*[@role="tab"]');
        await fillInRubyProgram('$score = 0\\n');
        await clickXpath('//img[@title="Go"]');

        const probe = await waitForVariable(driver, 'score');
        expect(probe).not.toBeNull();
        await driver.sleep(500);

        // Drive the same VM entry point the flyout checkbox uses
        // (monitorBlockListener -> changeBlock with element 'checkbox').
        // Before the fix this silently no-oped because the block was
        // missing from monitorBlocks, so no monitor ever appeared.
        const monitorAdded = await driver.executeScript(
            `
            const vm = window.smalruby.vm;
            vm.runtime.monitorBlocks.changeBlock({
                id: arguments[0],
                element: 'checkbox',
                value: true
            });
            return vm.runtime._monitorState.has(arguments[0]);
            `,
            probe.varId,
        );
        expect(monitorAdded).toBe(true);

        // The monitor should render on the stage.
        await findByXpath('//*[contains(@class, "monitor_monitor-container")]');
    });
});
