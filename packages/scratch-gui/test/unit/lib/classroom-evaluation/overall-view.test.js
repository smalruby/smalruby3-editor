import {
    defaultOverallSettings,
    isIncluded,
    normalizeSettings,
    overallExportRows,
    overallView,
    weightOf,
} from '../../../../src/lib/classroom-evaluation/overall-view';

const lessons = [
    { classroomId: 'robot', assignmentName: 'ロボット' },
    { classroomId: 'led', assignmentName: 'LED' },
    { classroomId: 'empty', assignmentName: 'まだ' },
];

const confirmed = (grades) => ({ grades, confirmedAt: '2026-11-20T00:00:00Z' });
const g = (grade, source = 'ai') => ({ grade, reason: '', source });

const gradings = {
    robot: confirmed({ 1: g('S'), 2: g('B') }),
    led: confirmed({ 1: g('A'), 3: g('C') }),
    empty: null,
};

describe('overallView', () => {
    test('includes assignments with grades by default, newest first, and computes every seat', () => {
        const view = overallView({ lessons, gradings, settings: defaultOverallSettings() });
        expect(view.columns.map((c) => c.classroomId)).toEqual(['robot', 'led']);
        expect(view.rows).toEqual([
            { seatNumber: 1, average: 3.5, grade: 'S', missing: [] },
            { seatNumber: 2, average: 1, grade: 'C', missing: ['led'] },
            { seatNumber: 3, average: 0.5, grade: 'C', missing: ['robot'] },
        ]);
        expect(view.canExport).toBe(true);
    });

    test('weights and the points of 未提出 typed as strings are used', () => {
        const settings = {
            ...defaultOverallSettings(),
            weights: { robot: '3' },
            points: { S: 4, A: 3, B: 2, C: 1, none: '1' },
        };
        const view = overallView({ lessons, gradings, settings });
        // seat 2: robot B(2)×3 + led none(1)×1 = 7 / 4
        expect(view.rows[1]).toEqual({ seatNumber: 2, average: 1.75, grade: 'B', missing: ['led'] });
    });

    test('an included assignment not confirmed blocks the export and is listed', () => {
        const drafts = { ...gradings, led: { grades: { 1: g('A') }, confirmedAt: null } };
        const view = overallView({ lessons, gradings: drafts, settings: defaultOverallSettings() });
        expect(view.unconfirmed.map((c) => c.classroomId)).toEqual(['led']);
        expect(view.canExport).toBe(false);
        expect(overallExportRows(view)).toBeNull();
    });

    test('leaving the unconfirmed assignment out allows the export', () => {
        const drafts = { ...gradings, led: { grades: { 1: g('A') }, confirmedAt: null } };
        const settings = { ...defaultOverallSettings(), included: { led: false } };
        const view = overallView({ lessons, gradings: drafts, settings });
        expect(view.unconfirmed).toEqual([]);
        expect(view.canExport).toBe(true);
    });

    test('an included assignment still being read blocks the export', () => {
        const reading = { robot: gradings.robot };
        const settings = { ...defaultOverallSettings(), included: { led: true } };
        const view = overallView({ lessons, gradings: reading, settings });
        expect(view.loading.map((c) => c.classroomId)).toEqual(['led']);
        expect(view.canExport).toBe(false);
    });

    test('an included assignment without grades is not confirmed', () => {
        const settings = { ...defaultOverallSettings(), included: { empty: true } };
        const view = overallView({ lessons, gradings, settings });
        expect(view.unconfirmed.map((c) => c.classroomId)).toEqual(['empty']);
        expect(view.canExport).toBe(false);
    });

    test('nothing included cannot be exported', () => {
        const settings = { ...defaultOverallSettings(), included: { robot: false, led: false } };
        const view = overallView({ lessons, gradings, settings });
        expect(view.columns).toEqual([]);
        expect(view.canExport).toBe(false);
    });

    test('all weights 0 cannot be exported', () => {
        const settings = { ...defaultOverallSettings(), weights: { robot: '0', led: 0 } };
        const view = overallView({ lessons, gradings, settings });
        expect(view.canExport).toBe(false);
    });
});

describe('overallExportRows', () => {
    test('each assignment grade (newest first), the average and the overall grade', () => {
        const view = overallView({ lessons, gradings, settings: defaultOverallSettings() });
        expect(overallExportRows(view)).toEqual([
            ['出席番号', 'ロボット', 'LED', '平均', '総合'],
            [1, 'S', 'A', 3.5, 'S'],
            [2, 'B', '', 1, 'C'],
            [3, '', 'C', 0.5, 'C'],
        ]);
    });
});

describe('settings helpers', () => {
    test('empty or broken numbers fall back to the defaults', () => {
        expect(normalizeSettings({ points: { S: '', A: 'x', B: '5' }, cuts: { S: '3' } })).toEqual({
            points: { S: 4, A: 3, B: 5, C: 1, none: 0 },
            cuts: { S: 3, A: 2.5, B: 1.5 },
        });
    });

    test('weight defaults to 1 and a negative weight is 0', () => {
        expect(weightOf({}, 'a')).toBe(1);
        expect(weightOf({ weights: { a: '-2' } }, 'a')).toBe(0);
        expect(weightOf({ weights: { a: '' } }, 'a')).toBe(1);
    });

    test("the teacher's choice wins over the default", () => {
        expect(isIncluded({ included: { a: false } }, 'a', gradings.robot)).toBe(false);
        expect(isIncluded({ included: { a: true } }, 'a', null)).toBe(true);
        expect(isIncluded({}, 'a', null)).toBe(false);
    });
});
