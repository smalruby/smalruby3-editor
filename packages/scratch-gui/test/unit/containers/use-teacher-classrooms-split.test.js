import { pickDetailEntryTab, splitClassroomsByStatus } from '../../../src/containers/use-teacher-classrooms.js';

describe('splitClassroomsByStatus', () => {
    test('partitions active and archived classrooms', () => {
        const { active, archived } = splitClassroomsByStatus([
            { classroomId: 'a', status: 'active' },
            { classroomId: 'b', status: 'archived' },
            { classroomId: 'c', status: 'active' },
        ]);
        expect(active.map((c) => c.classroomId)).toEqual(['a', 'c']);
        expect(archived.map((c) => c.classroomId)).toEqual(['b']);
    });

    test('treats items without a status as active (old backend compatibility)', () => {
        const { active, archived } = splitClassroomsByStatus([{ classroomId: 'a' }]);
        expect(active).toHaveLength(1);
        expect(archived).toHaveLength(0);
    });

    test('handles empty / missing lists', () => {
        expect(splitClassroomsByStatus([])).toEqual({ active: [], archived: [] });
        expect(splitClassroomsByStatus(undefined)).toEqual({ active: [], archived: [] });
        expect(splitClassroomsByStatus(null)).toEqual({ active: [], archived: [] });
    });
});

describe('pickDetailEntryTab (teacher review on #1199)', () => {
    test('opens on the members tab by default', () => {
        expect(pickDetailEntryTab({ classroomId: 'a', freshlyCreatedIds: new Set() })).toBe('members');
    });

    test('opens a just-created assignment on the description tab', () => {
        expect(pickDetailEntryTab({ classroomId: 'a', freshlyCreatedIds: new Set(['a']) })).toBe('description');
    });

    test('a requested tab wins (「いまの課題を開く」 always asks for members)', () => {
        expect(
            pickDetailEntryTab({ classroomId: 'a', requestedTab: 'members', freshlyCreatedIds: new Set(['a']) }),
        ).toBe('members');
    });
});
