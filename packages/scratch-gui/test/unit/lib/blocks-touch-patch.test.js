// === Smalruby: This file is Smalruby-specific (unit tests for Touch pointer event patch) ===
import {patchTouchForPointerEvents} from '../../../src/lib/blocks-touch-patch';

describe('patchTouchForPointerEvents', () => {
    let originalWindow;

    beforeEach(() => {
        originalWindow = global.window;
        global.window = {};
    });

    afterEach(() => {
        global.window = originalWindow;
    });

    test('exposes ScratchBlocks.Touch on window for integration testing', () => {
        const mockTouch = {checkTouchIdentifier: jest.fn()};
        const mockScratchBlocks = {Touch: mockTouch};

        patchTouchForPointerEvents(mockScratchBlocks);

        expect(window.__smalrubyBlocklyTouch).toBe(mockTouch);
    });

    test('does not throw when window is undefined', () => {
        delete global.window;

        const mockScratchBlocks = {Touch: {}};
        expect(() => patchTouchForPointerEvents(mockScratchBlocks)).not.toThrow();
    });
});
