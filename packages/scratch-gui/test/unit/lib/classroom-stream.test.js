/* eslint-env jest */
import { buildStreamEvents } from '../../../src/lib/classroom-stream.js';

const NOW = Date.parse('2026-10-25T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const assignment = (over = {}) => ({
    classroomId: 'c1',
    assignmentName: '課題1',
    createdAt: '2026-10-01T00:00:00.000Z',
    expiresAt: iso(NOW + 60 * DAY),
    ...over,
});

const summarize = (events) => events.map((e) => `${e.type}:${e.classroom.classroomId}`);

describe('buildStreamEvents (B5)', () => {
    test('an active assignment gives one "created" event dated by createdAt', () => {
        const events = buildStreamEvents([assignment()], [], NOW);
        expect(events).toEqual([
            expect.objectContaining({ type: 'created', date: '2026-10-01T00:00:00.000Z', archived: false }),
        ]);
    });

    test('an archived assignment gives "created" and "archived" (archivedAt)', () => {
        const events = buildStreamEvents(
            [],
            [assignment({ status: 'archived', archivedAt: '2026-10-10T00:00:00.000Z' })],
            NOW,
        );
        expect(events.map((e) => [e.type, e.date, e.archived])).toEqual([
            ['archived', '2026-10-10T00:00:00.000Z', true],
            ['created', '2026-10-01T00:00:00.000Z', true],
        ]);
    });

    test('archived data without archivedAt falls back to updatedAt, and is skipped without either', () => {
        const withUpdated = buildStreamEvents(
            [],
            [assignment({ status: 'archived', updatedAt: '2026-10-12T00:00:00.000Z' })],
            NOW,
        );
        expect(withUpdated.find((e) => e.type === 'archived').date).toBe('2026-10-12T00:00:00.000Z');

        const withNeither = buildStreamEvents([], [assignment({ status: 'archived' })], NOW);
        expect(summarize(withNeither)).toEqual(['created:c1']);
    });

    test('created and archived events are newest first', () => {
        const events = buildStreamEvents(
            [
                assignment({ classroomId: 'a', createdAt: '2026-10-05T00:00:00.000Z' }),
                assignment({ classroomId: 'b', createdAt: '2026-10-20T00:00:00.000Z' }),
            ],
            [
                assignment({
                    classroomId: 'x',
                    createdAt: '2026-09-01T00:00:00.000Z',
                    archivedAt: '2026-10-15T00:00:00.000Z',
                }),
            ],
            NOW,
        );
        expect(summarize(events)).toEqual(['created:b', 'archived:x', 'created:a', 'created:x']);
    });

    test('"expiring" appears only within 7 days, pinned on top, soonest first', () => {
        const events = buildStreamEvents(
            [
                assignment({ classroomId: 'far', expiresAt: iso(NOW + 8 * DAY) }),
                assignment({ classroomId: 'soon', expiresAt: iso(NOW + 2 * DAY) }),
                assignment({ classroomId: 'week', expiresAt: iso(NOW + 7 * DAY) }),
            ],
            [assignment({ classroomId: 'arch', archivedAt: '2026-10-02T00:00:00.000Z', expiresAt: iso(NOW + DAY) })],
            NOW,
        );
        const expiring = events.filter((e) => e.type === 'expiring');
        expect(summarize(expiring)).toEqual(['expiring:arch', 'expiring:soon', 'expiring:week']);
        expect(summarize(events.slice(0, 3))).toEqual(summarize(expiring));
        expect(expiring[0]).toEqual(expect.objectContaining({ archived: true, date: iso(NOW + DAY) }));
    });

    test('an assignment whose deadline already passed shows no "expiring" event', () => {
        const events = buildStreamEvents([assignment({ expiresAt: iso(NOW - DAY) })], [], NOW);
        expect(summarize(events)).toEqual(['created:c1']);
    });

    test('missing lists and dates are tolerated', () => {
        expect(buildStreamEvents(undefined, undefined, NOW)).toEqual([]);
        expect(buildStreamEvents([assignment({ createdAt: undefined, expiresAt: undefined })], [], NOW)).toEqual([]);
    });

    test('each event has a stable unique key', () => {
        const events = buildStreamEvents(
            [assignment({ expiresAt: iso(NOW + DAY) })],
            [assignment({ classroomId: 'c2', archivedAt: '2026-10-02T00:00:00.000Z' })],
            NOW,
        );
        const keys = events.map((e) => e.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toContain('expiring-c1');
    });
});
