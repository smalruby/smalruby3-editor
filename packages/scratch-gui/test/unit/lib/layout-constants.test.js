import { STAGE_SIZE_MODES, STAGE_DISPLAY_SIZES, STAGE_DISPLAY_SCALES } from '../../../src/lib/layout-constants';

describe('Layout Constants', () => {
    test('STAGE_SIZE_MODES includes middle', async () => {
        expect(STAGE_SIZE_MODES.middle).toBe('middle');
    });

    test('STAGE_DISPLAY_SIZES includes middle', async () => {
        expect(STAGE_DISPLAY_SIZES.middle).toBe('middle');
    });

    test('STAGE_DISPLAY_SCALES includes middle', async () => {
        // We need to make sure we are accessing the property after it is defined.
        // Since we are testing if it exists, using the string key is safer for the test setup if the constant isn't there yet.
        expect(STAGE_DISPLAY_SCALES.middle).toBe(0.75);
    });
});
