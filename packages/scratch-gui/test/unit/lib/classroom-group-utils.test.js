import { buildSidebarSections } from '../../../src/lib/classroom-group-utils';

describe('buildSidebarSections', () => {
    const groups = [
        { groupId: 'g1', name: '2年1組', year: 2026, status: 'active' },
        { groupId: 'g2', name: '2年2組', year: 2026, status: 'active' },
        { groupId: 'g-old', name: '1年1組', year: 2025, status: 'active' },
        { groupId: 'g-arch', name: '旧クラス', year: 2024, status: 'archived' },
    ];
    const classrooms = [
        { classroomId: 'c1', className: '2年1組', assignmentName: '第2回', groupId: 'g1', createdAt: '2026-05-01' },
        { classroomId: 'c2', className: '2年1組', assignmentName: '第1回', groupId: 'g1', createdAt: '2026-04-01' },
        { classroomId: 'c3', className: 'ばら', assignmentName: 'x', groupId: null, createdAt: '2026-04-01' },
        { classroomId: 'c4', className: 'あか', assignmentName: 'y', createdAt: '2026-04-01' },
        { classroomId: 'c5', className: '旧', assignmentName: 'z', groupId: 'g-arch', createdAt: '2026-04-01' },
    ];

    test('groups come first (year desc, name asc), then className sections', () => {
        const sections = buildSidebarSections(classrooms, groups);
        expect(sections.map((s) => s.kind)).toEqual([
            'group',
            'group',
            'group',
            'className',
            'className',
            'className',
        ]);
        expect(sections[0].groupId).toBe('g1');
        expect(sections[1].groupId).toBe('g2');
        expect(sections[2].groupId).toBe('g-old');
    });

    test('classes inside a group are sorted by assignment name', () => {
        const sections = buildSidebarSections(classrooms, groups);
        expect(sections[0].classrooms.map((c) => c.classroomId)).toEqual(['c2', 'c1']);
    });

    test('empty active groups are still shown', () => {
        const sections = buildSidebarSections(classrooms, groups);
        const g2 = sections.find((s) => s.groupId === 'g2');
        expect(g2.classrooms).toEqual([]);
    });

    test('classes of an archived group fall back to className sections', () => {
        const sections = buildSidebarSections(classrooms, groups);
        expect(sections.some((s) => s.kind === 'group' && s.groupId === 'g-arch')).toBe(false);
        const fallback = sections.find((s) => s.kind === 'className' && s.className === '旧');
        expect(fallback.classrooms.map((c) => c.classroomId)).toEqual(['c5']);
    });

    test('className sections are sorted by Japanese collation', () => {
        const sections = buildSidebarSections(classrooms, groups).filter((s) => s.kind === 'className');
        expect(sections.map((s) => s.className)).toEqual(['あか', 'ばら', '旧']);
    });

    test('handles empty inputs', () => {
        expect(buildSidebarSections([], [])).toEqual([]);
        expect(buildSidebarSections(null, null)).toEqual([]);
    });
});
