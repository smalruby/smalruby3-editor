/**
 * Regression test for the palette-toggle position after close → re-open.
 *
 * Background:
 *   The palette-toggle button (◀ / ▶) sits at the right edge of the
 *   open flyout, computed in `containers/blocks.jsx` render() as:
 *
 *     toggleButtonLeft = paletteVisible
 *         ? toolbox.getWidth() + flyout.getWidth()
 *         : 0;
 *
 *   In the upstream merge to scratch-blocks v2 we initially missed
 *   that React's render runs *before* `componentDidUpdate`, where
 *   `_applyPaletteVisibility` un-hides the flyout and calls
 *   `ScratchBlocks.svgResize` to recompute dimensions. The first
 *   render after a close → re-open therefore saw stale flyout widths
 *   and dropped the toggle on top of the blocks (only `toolbox.getWidth()`
 *   instead of `toolbox.getWidth() + flyout.getWidth()`).
 *
 *   Fixed by calling `this.forceUpdate()` at the end of
 *   `_applyPaletteVisibility` so render() re-runs with the now-correct
 *   flyout dimensions.
 *
 *   This test exercises close → re-open and asserts the toggle lands
 *   strictly to the right of the flyout area.
 */
import path from 'path';
import SeleniumHelper from '../helpers/selenium-helper';

const { clickXpath, getDriver, loadUri, waitForLoadingFinished } = new SeleniumHelper();

const uri = path.resolve(__dirname, '../../build/index.html');

let driver;

const PALETTE_TOGGLE_XPATH = '//button[contains(@class, "palette-toggle_palette-toggle-button")]';

const readState = () =>
    driver.executeScript(`
        const btn = document.querySelector('[class*="palette-toggle_palette-toggle-button"]');
        const fiberRoot = document.querySelector('.index_app_ZUgsL');
        const fiberKey = Object.keys(fiberRoot).find(k => k.startsWith('__reactContainer'));
        let blocksInst = null;
        function walk(fiber, depth) {
            // The depth guard only protects against cycles; the traversal
            // counts every visited child/sibling, so keep it well above the
            // GUI's total fiber path length (it grows as components are added).
            if (!fiber || depth > 5000) return;
            const inst = fiber.stateNode;
            if (inst && typeof inst === 'object' && inst.workspace && inst.flyoutWorkspace) {
                blocksInst = inst;
            }
            if (fiber.child) walk(fiber.child, depth + 1);
            if (fiber.sibling) walk(fiber.sibling, depth + 1);
        }
        if (fiberKey) walk(fiberRoot[fiberKey].stateNode.current, 0);
        const ws = blocksInst?.workspace;
        const tb = ws?.getToolbox?.();
        const fl = ws?.getFlyout?.();
        return {
            toggleLeft: btn ? btn.getBoundingClientRect().left : -1,
            toggleText: btn?.textContent || '',
            toolboxWidth: tb?.getWidth?.() ?? null,
            flyoutWidth: fl?.getWidth?.() ?? null,
        };
    `);

describe('Palette toggle position (regression)', () => {
    beforeAll(async () => {
        driver = await getDriver();
    });

    afterAll(async () => {
        await driver.quit();
    });

    test('toggle lands at flyout right edge after close → re-open', async () => {
        await loadUri(uri);
        await waitForLoadingFinished();

        // Initial state: palette visible, toggle should be at toolbox + flyout edge.
        const initial = await readState();
        expect(initial.toggleText).toBe('◀');
        expect(initial.toolboxWidth).toBeGreaterThan(0);
        expect(initial.flyoutWidth).toBeGreaterThan(0);
        const expectedOpenLeft = initial.toolboxWidth + initial.flyoutWidth;
        // Allow a small slack for fractional pixels / borders.
        expect(initial.toggleLeft).toBeGreaterThanOrEqual(expectedOpenLeft - 5);
        expect(initial.toggleLeft).toBeLessThanOrEqual(expectedOpenLeft + 5);

        // Close palette.
        await clickXpath(PALETTE_TOGGLE_XPATH);
        await driver.sleep(500);
        const closed = await readState();
        expect(closed.toggleText).toBe('▶');
        expect(closed.toggleLeft).toBeLessThan(20); // anchored at the very left

        // Re-open palette — this is the regression case.
        await clickXpath(PALETTE_TOGGLE_XPATH);
        await driver.sleep(500);
        const reopened = await readState();
        expect(reopened.toggleText).toBe('◀');
        expect(reopened.toolboxWidth).toBeGreaterThan(0);
        expect(reopened.flyoutWidth).toBeGreaterThan(0);
        const expectedReopenLeft = reopened.toolboxWidth + reopened.flyoutWidth;
        // The button must land at the visual right edge of the flyout, NOT
        // somewhere inside the flyout (e.g. just toolbox.getWidth() or just
        // flyout.getWidth()). The pre-fix bug landed it at flyout.getWidth()
        // alone, so we tolerate +/- 5px slack but require it strictly on or
        // past the toolbox + flyout boundary.
        expect(reopened.toggleLeft).toBeGreaterThanOrEqual(expectedReopenLeft - 5);
        expect(reopened.toggleLeft).toBeLessThanOrEqual(expectedReopenLeft + 5);
    });
});
