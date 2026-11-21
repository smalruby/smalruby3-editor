import { assignmentGoal } from '../../../src/lib/classroom-assignment-goal.js';
import { normalizeAssignmentLesson } from '../../../src/lib/lessons/assignment-progress.js';

const lesson = (overrides = {}) =>
    normalizeAssignmentLesson({
        courseId: 'kyou-kara-programmer',
        challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move', 'blocks-l1-click-say'],
        requiredChallengeIds: ['blocks-l1-click-say'],
        completion: { type: 'count', count: 2 },
        submitWork: false,
        ...overrides,
    });

describe('assignmentGoal', () => {
    test('not a lesson assignment → null', () => {
        expect(assignmentGoal(null)).toBeNull();
    });

    test('N of the condition, M required, the lesson of the challenges', () => {
        const goal = assignmentGoal(lesson());
        expect(goal).toMatchObject({ target: 2, required: 1, all: false, submitWork: false, unknownCount: 0 });
        expect(goal.lessons.map((l) => [l.id, l.number])).toEqual([['blocks-l1', 1]]);
        expect(goal.lessons[0].name.id).toBe('gui.lessons.lesson.blocks-l1.name');
    });

    test('"all" counts every challenge', () => {
        const goal = assignmentGoal(lesson({ completion: { type: 'all' }, requiredChallengeIds: [] }));
        expect(goal).toMatchObject({ target: 3, required: 0, all: true });
    });

    test('lessons are listed once each, in course order', () => {
        const goal = assignmentGoal(
            lesson({
                challengeIds: ['blocks-l1-if', 'blocks-l1-key-sound', 'blocks-l1-arrow-move'],
                requiredChallengeIds: [],
                completion: { type: 'all' },
            }),
        );
        expect(goal.lessons.map((l) => l.number)).toEqual([1, 2]);
    });

    test('submitWork is passed on', () => {
        expect(assignmentGoal(lesson({ submitWork: true })).submitWork).toBe(true);
    });

    test('challenges unknown to this version are not counted', () => {
        const goal = assignmentGoal(
            lesson({
                challengeIds: ['blocks-l1-key-sound', 'future-challenge'],
                requiredChallengeIds: [],
                completion: { type: 'all' },
            }),
        );
        expect(goal).toMatchObject({ target: 1, unknownCount: 1 });
    });

    test('the teacher draft shape (completion count null) works', () => {
        const goal = assignmentGoal({
            courseId: 'kyou-kara-programmer',
            challengeIds: ['blocks-l1-key-sound', 'blocks-l1-arrow-move'],
            requiredChallengeIds: ['blocks-l1-arrow-move'],
            completion: { type: 'all', count: null },
            submitWork: true,
        });
        expect(goal).toMatchObject({ target: 2, required: 1, all: true, submitWork: true });
    });

    test('a setting without challenges still says whether work is submitted', () => {
        expect(assignmentGoal({ submitWork: true })).toEqual({
            target: 0,
            required: 0,
            all: false,
            lessons: [],
            submitWork: true,
            unknownCount: 0,
        });
    });
});
