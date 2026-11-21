import { readWaitSeconds } from '../../../src/lib/classroom-read-wait.js';

describe('readWaitSeconds', () => {
    test('a short or empty page waits 2 s', () => {
        expect(readWaitSeconds({ textLength: 0 })).toBe(2);
        expect(readWaitSeconds({ textLength: 49 })).toBe(2);
        expect(readWaitSeconds()).toBe(2);
    });

    test('one more second every 50 characters', () => {
        expect(readWaitSeconds({ textLength: 50 })).toBe(3);
        expect(readWaitSeconds({ textLength: 120 })).toBe(4);
    });

    test('at most 5 s', () => {
        expect(readWaitSeconds({ textLength: 150 })).toBe(5);
        expect(readWaitSeconds({ textLength: 10000 })).toBe(5);
    });

    test('after paging through earlier pages the last page waits about half (1–3 s)', () => {
        expect(readWaitSeconds({ textLength: 0, readEarlierPages: true })).toBe(1);
        expect(readWaitSeconds({ textLength: 60, readEarlierPages: true })).toBe(2);
        expect(readWaitSeconds({ textLength: 500, readEarlierPages: true })).toBe(3);
    });

    test('a bad length counts as empty', () => {
        expect(readWaitSeconds({ textLength: NaN })).toBe(2);
        expect(readWaitSeconds({ textLength: -10 })).toBe(2);
    });
});
