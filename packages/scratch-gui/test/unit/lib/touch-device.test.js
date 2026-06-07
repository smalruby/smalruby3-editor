/* eslint-env jest */
import { isTouchDevice } from '../../../src/lib/touch-device';

describe('isTouchDevice', () => {
    const setMaxTouchPoints = (value) => {
        Object.defineProperty(window.navigator, 'maxTouchPoints', {
            value,
            configurable: true,
        });
    };

    afterEach(() => {
        setMaxTouchPoints(0);
    });

    test('returns false when maxTouchPoints is 0 (desktop)', () => {
        setMaxTouchPoints(0);
        expect(isTouchDevice()).toBe(false);
    });

    test('returns true when maxTouchPoints > 0 (iPad / Android)', () => {
        setMaxTouchPoints(5);
        expect(isTouchDevice()).toBe(true);
    });

    test('returns false when maxTouchPoints is undefined', () => {
        setMaxTouchPoints(undefined);
        expect(isTouchDevice()).toBe(false);
    });
});
