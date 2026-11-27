/**
 * The 「ゴール」 card of a lesson assignment (the student's assignment panel and the joined
 * confirmation, and the teacher's student-view preview).
 *
 * Students closed the assignment panel without knowing how many challenges they had to clear,
 * so the card says it in one line: 「チャレンジを N つクリア（★ M つはかならず）」, the lessons the
 * challenges come from, and — when work is also submitted — that they then make their own
 * program and submit it.
 *
 * N and M are counted like the assignment band (assignmentProgress): only the challenges this
 * version of the course knows, the condition capped by them, so the card, the band and the
 * teacher's screens show the same numbers.
 */
import { assignmentProgress } from './lessons/assignment-progress.js';
import { COURSES, findChallenge, lessonNumberOf } from './lessons/courses.js';

/**
 * @param {?object} lesson - the lesson setting (normalizeAssignmentLesson, or the teacher's draft)
 * @param {Array} [courses] - courses (for tests)
 * @returns {?{target: number, required: number, all: boolean, lessons: Array<{id: string,
 *   number: number, name: object}>, submitWork: boolean, unknownCount: number}} the goal: the
 *   challenges to clear (`target`), the required ones (★, `required`), whether it is every
 *   challenge (`all`), the lessons in course order (`name` is a message descriptor), whether work
 *   is submitted. Null when it is not a lesson assignment.
 */
export const assignmentGoal = (lesson, courses = COURSES) => {
    if (!lesson) return null;
    const submitWork = lesson.submitWork === true;
    if (!Array.isArray(lesson.challengeIds) || lesson.challengeIds.length === 0) {
        // An old or broken setting: still say what happens after the lessons.
        return { target: 0, required: 0, all: false, lessons: [], submitWork, unknownCount: 0 };
    }
    const status = assignmentProgress(
        {
            ...lesson,
            requiredChallengeIds: Array.isArray(lesson.requiredChallengeIds) ? lesson.requiredChallengeIds : [],
            completion: lesson.completion || { type: 'all' },
        },
        {},
        courses,
    );
    const lessons = [];
    const seen = new Set();
    status.challenges.forEach(({ id }) => {
        const found = findChallenge(id, courses);
        if (seen.has(found.lesson.id)) return;
        seen.add(found.lesson.id);
        lessons.push({
            id: found.lesson.id,
            number: lessonNumberOf(found.course, found.lesson),
            name: found.lesson.name,
        });
    });
    lessons.sort((a, b) => a.number - b.number);
    return {
        target: status.conditionCount,
        required: status.requiredCount,
        all: status.conditionCount > 0 && status.conditionCount === status.challenges.length,
        lessons,
        submitWork,
        unknownCount: status.unknownCount,
    };
};
