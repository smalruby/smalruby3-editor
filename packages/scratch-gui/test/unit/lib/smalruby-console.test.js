import { getStageDimensions } from '../../../src/lib/screen-utils';
import { hideSmalrubyConsole, showSmalrubyConsole, stageCanvasSize } from '../../../src/lib/smalruby-console';
import { resetSmalrubyConsole, showSmalrubyConsoleByDefault } from '../../../src/reducers/smalruby-console';

describe('showSmalrubyConsole', () => {
    test('shows only the console, without the VM (the extension is not added here)', () => {
        const dispatch = jest.fn();

        // The extension is added by the conversion when the program prints or reads (#2372)
        expect(showSmalrubyConsole(dispatch)).toBeUndefined();

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(showSmalrubyConsoleByDefault());
    });
});

describe('hideSmalrubyConsole', () => {
    test('shows the stage again, and forgets that the user hid the console', () => {
        const dispatch = jest.fn();
        hideSmalrubyConsole(dispatch);
        expect(dispatch).toHaveBeenCalledWith(resetSmalrubyConsole());
    });
});

describe('stageCanvasSize', () => {
    test('keeps the measured size of a shown stage', () => {
        expect(stageCanvasSize({ width: 360, height: 270 }, 'middle')).toEqual({ width: 360, height: 270 });
    });

    test('keeps the size of the stage while the console hides it (a 0×0 canvas has no thumbnail)', () => {
        const { width, height } = getStageDimensions('middle', false);
        expect(stageCanvasSize({ width: 0, height: 0 }, 'middle')).toEqual({ width, height });
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
    });
});
