import { computeOverall } from '../../../../src/lib/classroom-evaluation/overall-grade';

const points = { S: 3, A: 2, B: 1, C: 0, none: 0 };
const cuts = { S: 2.5, A: 1.5, B: 0.5 };

describe('computeOverall', () => {
    test('weighted average of points cut into grades', () => {
        const assignments = [
            { id: 'led', weight: 1, grades: { 1: 'S', 2: 'A', 3: 'C' } },
            { id: 'robot', weight: 2, grades: { 1: 'S', 2: 'B', 3: 'B' } },
        ];
        expect(computeOverall({ assignments, points, cuts, seats: [1, 2, 3] })).toEqual([
            { seatNumber: 1, average: 3, grade: 'S', missing: [] },
            { seatNumber: 2, average: 1.33, grade: 'B', missing: [] },
            { seatNumber: 3, average: 0.67, grade: 'B', missing: [] },
        ]);
    });

    test('a missing grade counts as none and is listed', () => {
        const assignments = [
            { id: 'led', weight: 1, grades: { 1: 'S' } },
            { id: 'robot', weight: 1, grades: {} },
        ];
        expect(computeOverall({ assignments, points, cuts, seats: [1] })).toEqual([
            { seatNumber: 1, average: 1.5, grade: 'A', missing: ['robot'] },
        ]);
    });

    test('none = null leaves the missing assignment out of the average', () => {
        const assignments = [
            { id: 'led', weight: 1, grades: { 1: 'S' } },
            { id: 'robot', weight: 1, grades: {} },
        ];
        const [row] = computeOverall({ assignments, points: { ...points, none: null }, cuts, seats: [1] });
        expect(row).toEqual({ seatNumber: 1, average: 3, grade: 'S', missing: ['robot'] });
    });

    test('cuts are inclusive', () => {
        const assignments = [{ id: 'x', weight: 1, grades: { 1: 'A', 2: 'B' } }];
        const rows = computeOverall({ assignments, points, cuts: { S: 2.5, A: 2, B: 1 }, seats: [1, 2] });
        expect(rows.map((r) => r.grade)).toEqual(['A', 'B']);
    });

    test('nothing to count gives no grade; defaults apply', () => {
        expect(computeOverall({ assignments: [], seats: [1] })).toEqual([
            { seatNumber: 1, average: null, grade: '', missing: [] },
        ]);
        const [row] = computeOverall({ assignments: [{ id: 'x', weight: 1, grades: { 1: 'A' } }], seats: [1] });
        expect(row.grade).toBe('A');
    });

    test('an unknown grade value counts as missing', () => {
        const [row] = computeOverall({
            assignments: [{ id: 'x', weight: 1, grades: { 1: '?' } }],
            points,
            cuts,
            seats: [1],
        });
        expect(row).toEqual({ seatNumber: 1, average: 0, grade: 'C', missing: ['x'] });
    });
});
