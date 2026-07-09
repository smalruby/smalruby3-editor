/* eslint-env jest */
import {
    DISPLAY_MODE_AUTO,
    DISPLAY_MODE_DESKTOP,
    DISPLAY_MODE_MOBILE,
} from '../../../src/lib/settings/display-mode/index.js';
import {
    STORAGE_KEY,
    DISPLAY_MODE_CHANGED_EVENT,
    isValidDisplayMode,
    detectDisplayMode,
    persistDisplayMode,
} from '../../../src/lib/settings/display-mode/persistence.js';

describe('display-mode persistence', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    describe('isValidDisplayMode', () => {
        test('accepts the three known modes', () => {
            expect(isValidDisplayMode(DISPLAY_MODE_AUTO)).toBe(true);
            expect(isValidDisplayMode(DISPLAY_MODE_DESKTOP)).toBe(true);
            expect(isValidDisplayMode(DISPLAY_MODE_MOBILE)).toBe(true);
        });

        test('rejects unknown / empty values', () => {
            expect(isValidDisplayMode('tablet')).toBe(false);
            expect(isValidDisplayMode(null)).toBe(false);
            expect(isValidDisplayMode(undefined)).toBe(false);
        });
    });

    describe('detectDisplayMode', () => {
        test('defaults to auto when nothing is stored', () => {
            expect(detectDisplayMode()).toBe(DISPLAY_MODE_AUTO);
        });

        test('returns the stored value when valid', () => {
            window.localStorage.setItem(STORAGE_KEY, DISPLAY_MODE_DESKTOP);
            expect(detectDisplayMode()).toBe(DISPLAY_MODE_DESKTOP);
        });

        test('falls back to auto when the stored value is invalid', () => {
            window.localStorage.setItem(STORAGE_KEY, 'garbage');
            expect(detectDisplayMode()).toBe(DISPLAY_MODE_AUTO);
        });
    });

    describe('persistDisplayMode', () => {
        test('stores desktop / mobile in localStorage', () => {
            persistDisplayMode(DISPLAY_MODE_DESKTOP);
            expect(window.localStorage.getItem(STORAGE_KEY)).toBe(DISPLAY_MODE_DESKTOP);
            persistDisplayMode(DISPLAY_MODE_MOBILE);
            expect(window.localStorage.getItem(STORAGE_KEY)).toBe(DISPLAY_MODE_MOBILE);
        });

        test('removes the key when set to auto', () => {
            window.localStorage.setItem(STORAGE_KEY, DISPLAY_MODE_DESKTOP);
            persistDisplayMode(DISPLAY_MODE_AUTO);
            expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
            expect(detectDisplayMode()).toBe(DISPLAY_MODE_AUTO);
        });

        test('throws on an invalid mode', () => {
            expect(() => persistDisplayMode('bogus')).toThrow(/Invalid display mode/);
        });

        test('dispatches the change event so listeners can react', () => {
            const handler = jest.fn();
            window.addEventListener(DISPLAY_MODE_CHANGED_EVENT, handler);
            persistDisplayMode(DISPLAY_MODE_DESKTOP);
            expect(handler).toHaveBeenCalledTimes(1);
            window.removeEventListener(DISPLAY_MODE_CHANGED_EVENT, handler);
        });
    });
});
