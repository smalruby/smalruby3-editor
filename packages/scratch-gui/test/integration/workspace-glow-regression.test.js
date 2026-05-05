/**
 * Regression tests for Blockly v12 / scratch-blocks v2 API migrations
 * inside `containers/blocks.jsx` listeners.
 *
 * Background:
 *   The upstream merge to scratch-blocks v2 (commit 4e2ddc1406) missed
 *   several v1 instance-method calls inside listener bodies that fire
 *   from the VM. These crash silently except when the user actually
 *   triggers the corresponding flow (clicking a block to execute it,
 *   completing a peripheral connection, etc.) — which is rare in
 *   automated tests, so they sneaked through merge CI.
 *
 *   Each test below exercises one VM event whose listener was found
 *   to crash in production, and asserts no `TypeError: ... is not a
 *   function` reaches the page console.
 *
 *   Known regressions covered:
 *
 *     - SCRIPT_GLOW_ON / OFF → onScriptGlowOn / Off
 *         was: this.workspace.glowStack    (v1 instance method)
 *         now: this.ScratchBlocks.glowStack (v2 namespace export)
 *         Fixed in commit 6d83dc360f.
 *
 *     - PERIPHERAL_CONNECTED / DISCONNECTED → handleStatusButtonUpdate
 *         was: this.ScratchBlocks.refreshStatusButtons(this.workspace)
 *         now: this.workspace.getFlyout().refreshStatusButtons()
 *         Fixed (this commit) — was crashing the mesh-v2 host-create flow.
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

    test('PERIPHERAL_CONNECTED / DISCONNECTED do not throw "refreshStatusButtons is not a function"', async () => {
        await loadUri(uri);
        await clickText('Code');
        await waitForLoadingFinished();

        // Capture errors during PERIPHERAL_CONNECTED / DISCONNECTED emission.
        // These are emitted by mesh-v2 / smalrubot-s1 / micro:bit etc. on a
        // successful host-create / connect flow. Our listener
        // (handleStatusButtonUpdate in blocks.jsx) used to call
        // ScratchBlocks.refreshStatusButtons which was removed in v2.
        const errors = await driver.executeScript(`
            const errors = [];
            const origError = console.error;
            console.error = (...args) => { errors.push(String(args[0])); origError.apply(console, args); };
            const onError = (ev) => { errors.push('window.error: ' + (ev.error?.message || ev.message)); };
            window.addEventListener('error', onError);
            try {
                window.smalruby.vm.runtime.emit('PERIPHERAL_CONNECTED', {extensionId: 'meshV2'});
                window.smalruby.vm.runtime.emit('PERIPHERAL_DISCONNECTED', {extensionId: 'meshV2'});
            } catch (e) {
                errors.push('throw: ' + e.message);
            }
            window.removeEventListener('error', onError);
            console.error = origError;
            return errors;
        `);

        const apiErrors = errors.filter((e) =>
            /refreshStatusButtons|ScratchBlocks\.\w+ is not a function|workspace\.\w+ is not a function/i.test(e),
        );
        expect(apiErrors).toEqual([]);

        const logs = await getLogs();
        const severeApi = logs.filter((l) =>
            /refreshStatusButtons|ScratchBlocks\.\w+ is not a function|workspace\.\w+ is not a function/i.test(
                l.message,
            ),
        );
        expect(severeApi).toEqual([]);
    });
});
