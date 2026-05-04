/**
 * Regression test for Blockly v12 / scratch-blocks v2 glow API migration.
 *
 * Background:
 *   Blockly v12 removed the per-workspace `WorkspaceSvg.glowStack` and
 *   `WorkspaceSvg.glowBlock` instance methods. scratch-blocks v2 instead
 *   exports `glowStack` as a top-level function on the ScratchBlocks
 *   namespace (per-block glow is unsupported and treated as no-op).
 *
 *   In commit 4e2ddc1406 (the upstream merge) the migration of the four
 *   glow handlers in `containers/blocks.jsx` was missed, so:
 *
 *     onScriptGlowOn (data) { this.workspace.glowStack(data.id, true); }
 *
 *   crashed with `TypeError: this.workspace.glowStack is not a function`
 *   the moment the user clicked any workspace block to execute it
 *   (e.g. a "10 歩動かす" block dropped on the workspace).
 *
 *   Fixed in commit 6d83dc360f by switching to `this.ScratchBlocks.glowStack`
 *   for script glows and no-oping the per-block handlers.
 *
 *   This test fires the same SCRIPT_GLOW_ON / OFF chain that the runtime
 *   would emit during a real script execution, and asserts that no JS
 *   error is thrown / logged. It does not depend on dragging a block to
 *   the workspace (which is fragile in Selenium); using `runtime.glowScript`
 *   directly exercises the same handler in `containers/blocks.jsx`.
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickText, getDriver, getLogs, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

describe('Workspace block glow (regression)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('SCRIPT_GLOW_ON / OFF do not throw "glowStack is not a function"', async () => {
        await loadUri(uri);
        await clickText('Code');
        await waitForLoadingFinished();

        // Pick any real block id from the flyout. ScratchBlocks.glowStack
        // looks up the block in main workspace + flyout workspace, so a
        // flyout-resident id is enough to exercise the handler chain.
        const blockId = await driver.executeScript(
            `return document.querySelector('g.blocklyDraggable')?.getAttribute('data-id') || null;`,
        );
        expect(typeof blockId).toBe('string');

        // Capture any uncaught error / console.error during glow emission.
        // If `containers/blocks.jsx` ever regresses to calling a
        // non-existent method on `this.workspace` (or any other v1 API
        // surface), the TypeError propagates out of the EventEmitter
        // listener and lands here.
        const errors = await driver.executeScript(
            `
                const blockId = arguments[0];
                const errors = [];
                const origError = console.error;
                console.error = (...args) => { errors.push(String(args[0])); origError.apply(console, args); };
                const onError = (ev) => { errors.push('window.error: ' + (ev.error?.message || ev.message)); };
                window.addEventListener('error', onError);
                try {
                    window.smalruby.vm.runtime.glowScript(blockId, true);
                    window.smalruby.vm.runtime.glowScript(blockId, false);
                } catch (e) {
                    errors.push('throw: ' + e.message);
                }
                window.removeEventListener('error', onError);
                console.error = origError;
                return errors;
            `,
            blockId,
        );

        // Filter out unrelated React / dev warnings — only fail on the
        // glow-related TypeError.
        const glowErrors = errors.filter((e) => /glowStack|glowBlock|workspace\.\w+ is not a function/i.test(e));
        expect(glowErrors).toEqual([]);

        // Sanity check: also verify the SEVERE selenium log channel.
        const logs = await getLogs();
        const severeGlow = logs.filter((l) =>
            /glowStack|glowBlock|workspace\.\w+ is not a function/i.test(l.message),
        );
        expect(severeGlow).toEqual([]);
    });
});
