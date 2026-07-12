import { buildAssignmentSections } from '../../../src/lib/classroom-group-utils.js';

const assignment = (over = {}) => ({
    classroomId: 'c1',
    assignmentName: '課題',
    topic: null,
    sortDate: '2026-07-01T00:00:00Z',
    createdAt: '2026-07-01T00:00:00Z',
    ...over,
});

describe('buildAssignmentSections', () => {
    test('should list untopiced assignments first without a heading', () => {
        const sections = buildAssignmentSections(
            [
                assignment({ classroomId: 'c1', topic: '単元A' }),
                assignment({ classroomId: 'c2', topic: null }),
            ],
            ['単元A'],
        );
        expect(sections[0].topic).toBeNull();
        expect(sections[0].classrooms.map((c) => c.classroomId)).toEqual(['c2']);
        expect(sections[1].topic).toBe('単元A');
    });

    test('should sort each section by sortDate descending with createdAt fallback', () => {
        const sections = buildAssignmentSections(
            [
                assignment({ classroomId: 'old', sortDate: '2026-05-01T00:00:00Z' }),
                assignment({ classroomId: 'new', sortDate: '2026-07-10T00:00:00Z' }),
                assignment({ classroomId: 'fallback', sortDate: null, createdAt: '2026-06-01T00:00:00Z' }),
            ],
            [],
        );
        expect(sections[0].classrooms.map((c) => c.classroomId)).toEqual(['new', 'fallback', 'old']);
    });

    test('should keep the class topic order and include empty topics', () => {
        const sections = buildAssignmentSections([assignment({ topic: 'B' })], ['A', 'B']);
        expect(sections.map((s) => s.topic)).toEqual(['A', 'B']);
        expect(sections[0].classrooms).toEqual([]);
    });

    test('should append stray topics that are missing from the class list', () => {
        const sections = buildAssignmentSections(
            [assignment({ classroomId: 'c1', topic: '消えたトピック' })],
            ['単元A'],
        );
        expect(sections.map((s) => s.topic)).toEqual(['単元A', '消えたトピック']);
        expect(sections[1].classrooms.map((c) => c.classroomId)).toEqual(['c1']);
    });

    test('should return no untopiced section when every assignment has a topic', () => {
        const sections = buildAssignmentSections([assignment({ topic: 'A' })], ['A']);
        expect(sections.map((s) => s.topic)).toEqual(['A']);
    });
});
