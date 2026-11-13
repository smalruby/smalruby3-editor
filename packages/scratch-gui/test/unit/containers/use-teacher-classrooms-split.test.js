import {
    fetchAssignmentRowSummary,
    pickDetailEntryTab,
    splitClassroomsByStatus,
} from '../../../src/containers/use-teacher-classrooms.js';

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

describe('fetchAssignmentRowSummary (#1301)', () => {
    const api = (over = {}) => ({
        listMembers: jest.fn().mockResolvedValue({
            members: [{ memberId: 'seat-01' }, { memberId: 'seat-02' }],
        }),
        listSubmissions: jest.fn().mockResolvedValue({
            submissions: [{ memberId: 'seat-01', submissionId: 's1', submittedAt: '2026-07-01' }],
        }),
        getAssignment: jest.fn().mockResolvedValue({ assignment: { pages: [{ text: '説明の1行目\n2行目' }] } }),
        ...over,
    });

    test('joins members and submissions and reads the first description line', async () => {
        const a = api();
        const summary = await fetchAssignmentRowSummary(a, 'tok', { classroomId: 'c1', studentCount: 30 });
        expect(a.listMembers).toHaveBeenCalledWith('tok', 'c1');
        expect(summary).toEqual({ submitted: 1, joined: 2, capacity: 30, descriptionLine: '説明の1行目' });
    });

    test('a failing getAssignment only drops the description', async () => {
        const a = api({ getAssignment: jest.fn().mockRejectedValue(new Error('x')) });
        const summary = await fetchAssignmentRowSummary(a, 'tok', { classroomId: 'c1', studentCount: 30 });
        expect(summary.descriptionLine).toBe('');
        expect(summary.joined).toBe(2);
    });

    test('レッスンの課題は課題クリアの数も出す（#1603）', async () => {
        const lesson = {
            courseId: 'kyou-kara-programmer',
            challengeIds: ['blocks-l1-key-sound'],
            requiredChallengeIds: [],
            completion: { type: 'all' },
            submitWork: false,
            scoring: null,
        };
        const progress = [
            {
                memberId: 'seat-01',
                seatNumber: 1,
                challenges: { 'blocks-l1-key-sound': { completedAt: '2026-11-15T01:00:00Z' } },
                current: null,
                updatedAt: '2026-11-15T01:00:00Z',
            },
        ];
        const a = api({ getLessonProgress: jest.fn().mockResolvedValue({ lesson, progress }) });
        const summary = await fetchAssignmentRowSummary(a, 'tok', { classroomId: 'c1', studentCount: 30, hasLesson: true });
        expect(a.getLessonProgress).toHaveBeenCalledWith('tok', 'c1');
        expect(summary.lessonCleared).toBe(1);
    });

    test('レッスンの無い課題は進み具合を取りに行かない', async () => {
        const a = api({ getLessonProgress: jest.fn() });
        const summary = await fetchAssignmentRowSummary(a, 'tok', { classroomId: 'c1', studentCount: 30 });
        expect(a.getLessonProgress).not.toHaveBeenCalled();
        expect(summary).not.toHaveProperty('lessonCleared');
    });
});
