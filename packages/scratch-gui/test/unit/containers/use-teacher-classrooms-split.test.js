import { splitClassroomsByStatus } from '../../../src/containers/use-teacher-classrooms.js';

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
