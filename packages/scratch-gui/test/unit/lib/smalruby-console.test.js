import { hideSmalrubyConsole, showSmalrubyConsole } from '../../../src/lib/smalruby-console';
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
