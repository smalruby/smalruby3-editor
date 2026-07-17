import {
    RETENTION_NOTICE_DAYS,
    RETENTION_WARNING_DAYS,
    daysUntil,
    retentionLevel,
} from '../../../src/lib/classroom-retention.js';

const NOW = new Date('2026-07-17T00:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const inDays = (days) => new Date(NOW + days * DAY).toISOString();

describe('daysUntil', () => {
    test('counts whole days, rounding partial days up', () => {
        expect(daysUntil(inDays(5), NOW)).toBe(5);
        expect(daysUntil(new Date(NOW + 4.2 * DAY).toISOString(), NOW)).toBe(5);
    });

    test('clamps past deadlines to 0', () => {
        expect(daysUntil(inDays(-3), NOW)).toBe(0);
    });

    test('returns null for missing or invalid deadlines', () => {
        expect(daysUntil(null, NOW)).toBeNull();
        expect(daysUntil(undefined, NOW)).toBeNull();
        expect(daysUntil('not a date', NOW)).toBeNull();
    });
});

describe('retentionLevel', () => {
    test('is none while the deadline is far away', () => {
        expect(retentionLevel(inDays(RETENTION_NOTICE_DAYS + 1), NOW)).toBe('none');
        expect(retentionLevel(inDays(90), NOW)).toBe('none');
    });

    test('is notice at 30 days or less', () => {
        expect(retentionLevel(inDays(RETENTION_NOTICE_DAYS), NOW)).toBe('notice');
        expect(retentionLevel(inDays(RETENTION_WARNING_DAYS + 1), NOW)).toBe('notice');
    });

    test('is warning at 7 days or less, including overdue', () => {
        expect(retentionLevel(inDays(RETENTION_WARNING_DAYS), NOW)).toBe('warning');
        expect(retentionLevel(inDays(0), NOW)).toBe('warning');
        expect(retentionLevel(inDays(-1), NOW)).toBe('warning');
    });

    test('is none without a valid deadline', () => {
        expect(retentionLevel(null, NOW)).toBe('none');
        expect(retentionLevel('broken', NOW)).toBe('none');
    });
});
