/* eslint-env jest */
import {
    LAST_SEATS_STORAGE_KEY,
    clearLastSeat,
    loadLastSeat,
    saveLastSeat,
} from '../../../src/lib/classroom-last-seats-storage.js';

describe('classroom last seats storage (#1796)', () => {
    beforeEach(() => window.localStorage.clear());

    test('uses the documented key', () => {
        expect(LAST_SEATS_STORAGE_KEY).toBe('smalruby:classroom:lastSeats');
    });

    test('saves and loads a seat per class', () => {
        saveLastSeat('group:g1', 3);
        saveLastSeat('assignment:c1', 12);
        expect(loadLastSeat('group:g1', 40)).toBe(3);
        expect(loadLastSeat('assignment:c1', 40)).toBe(12);
        expect(JSON.parse(window.localStorage.getItem(LAST_SEATS_STORAGE_KEY))).toEqual({
            'group:g1': 3,
            'assignment:c1': 12,
        });
    });

    test('a broken value reads as no previous seat', () => {
        window.localStorage.setItem(LAST_SEATS_STORAGE_KEY, '{oops');
        expect(loadLastSeat('group:g1', 40)).toBeNull();
        saveLastSeat('group:g1', 4);
        expect(loadLastSeat('group:g1', 40)).toBe(4);
    });

    test('clearing drops only that seat', () => {
        saveLastSeat('group:g1', 3);
        saveLastSeat('group:g2', 5);
        clearLastSeat('group:g1', 3);
        expect(loadLastSeat('group:g1', 40)).toBeNull();
        expect(loadLastSeat('group:g2', 40)).toBe(5);
    });

    test('storage errors are swallowed', () => {
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        expect(loadLastSeat('group:g1', 40)).toBeNull();
        expect(() => saveLastSeat('group:g1', 3)).not.toThrow();
        spy.mockRestore();
    });
});
