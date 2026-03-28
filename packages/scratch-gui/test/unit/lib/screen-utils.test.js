import layout from '../../../src/lib/layout-constants';
import { resolveStageSize, getStageDimensions } from '../../../src/lib/screen-utils';

describe('resolveStageSize', () => {
    test('returns middle display size when mode is middle', async () => {
        const mode = 'middle';
        const size = resolveStageSize(mode, false);
        expect(size).toBe('middle');
    });
});

describe('getStageDimensions', () => {
    test('returns correct dimensions for middle size', async () => {
        const size = 'middle';
        // Mocking STAGE_DISPLAY_SCALES locally if needed, but getStageDimensions imports it.
        // We expect the implementation to use the constant.

        // Since getStageDimensions uses STAGE_DISPLAY_SCALES from layout-constants,
        // and we can't easily mock that internal dependency without complex jest setup or rewire,
        // we will rely on the fact that we will update layout-constants.

        const dimensions = getStageDimensions(size, false);
        expect(dimensions.width).toBe(360);
        expect(dimensions.height).toBe(270);
        expect(dimensions.scale).toBe(0.75);
    });
});
