/* eslint-env jest */
import { initialsFromEmail } from '../../../src/lib/avatar-initials.js';

describe('initialsFromEmail (#1111)', () => {
    test('single-segment local part → first letter', () => {
        expect(initialsFromEmail('kouji@example.com')).toBe('K');
    });

    test('two-segment local part → both initials', () => {
        expect(initialsFromEmail('kouji.takao@example.com')).toBe('KT');
    });

    test('three-segment local part → first two initials', () => {
        expect(initialsFromEmail('kouji.takao.xxx@example.com')).toBe('KT');
    });

    test('leading dot / empty segments are ignored', () => {
        expect(initialsFromEmail('.kouji.takao@example.com')).toBe('KT');
    });

    test('null / malformed → ?', () => {
        expect(initialsFromEmail(null)).toBe('?');
        expect(initialsFromEmail('')).toBe('?');
        expect(initialsFromEmail('noatsign')).toBe('?');
        expect(initialsFromEmail('@example.com')).toBe('?');
    });
});
