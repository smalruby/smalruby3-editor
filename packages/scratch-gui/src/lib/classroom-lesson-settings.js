/**
 * Lesson settings of a classroom assignment (EPIC #1592 / #1598).
 *
 * The teacher picks a course, the lessons / challenges, the required (★)
 * ones, the completion condition, whether work is also submitted, and the
 * scoring points in the assignment's description tab. This module holds the
 * pure logic: the editor draft ↔ the API `lesson` field
 * (docs/classroom/architecture.md「レッスンの設定」), the completion numbers
 * and the scoring split (docs/classroom/ui-ux.md「採点」).
 *
 * A course here is the shape of `lib/lessons/courses.js`:
 * `{id, lessons: [{id, challenges: [{id}]}]}`. Functions take the course
 * as an argument so they do not depend on the course data.
 *
 * The draft is `null` (no lesson) or
 * `{courseId, challengeIds, requiredChallengeIds, completion: {type, count},
 *   submitWork, scoring: null | {total, requiredPoints}}`.
 * `scoring: null` means "the defaults" (満点 100・必須の点 = 満点の 70%);
 * `requiredPoints: null` means "the default for this total".
 */

export const DEFAULT_LESSON_TOTAL = 100;
export const MAX_LESSON_TOTAL = 1000;
const REQUIRED_POINTS_RATIO = 0.7;

/**
 * Round to 6 decimals before rounding up: adding points that do not divide
 * evenly leaves float errors (40.00000000000001 would become 41).
 * @param {number} value - points
 * @returns {number} the integer points (rounded up)
 */
export const ceilPoints = (value) => Math.ceil(Math.round(value * 1e6) / 1e6);

/**
 * 必須の点の既定 = 満点の 70%（切り上げ・満点まで）。
 * @param {number} total - 満点
 * @returns {number} the default required points
 */
export const defaultRequiredPoints = (total) => Math.min(total, ceilPoints(total * REQUIRED_POINTS_RATIO));

/**
 * @param {?object} course - course
 * @returns {Array<string>} the challenge ids of the course in lesson order
 */
export const courseChallengeIds = (course) =>
    course ? course.lessons.flatMap((lesson) => lesson.challenges.map((c) => c.id)) : [];

/**
 * Put challenge ids in the course order (the teacher does not reorder) and
 * drop ids that are not in the course.
 * @param {?object} course - course
 * @param {Array<string>} ids - challenge ids
 * @returns {Array<string>} ordered ids
 */
export const orderChallengeIds = (course, ids) => {
    const selected = new Set(ids);
    return courseChallengeIds(course).filter((id) => selected.has(id));
};

/**
 * @param {string} courseId - course id
 * @returns {object} a new draft with nothing selected
 */
export const createLessonDraft = (courseId) => ({
    courseId,
    challengeIds: [],
    requiredChallengeIds: [],
    completion: { type: 'all', count: null },
    submitWork: false,
    scoring: null,
});

/**
 * @param {?object} draft - draft
 * @returns {{selected: number, required: number, optional: number}} counts
 */
export const lessonCounts = (draft) => {
    const selected = draft ? draft.challengeIds.length : 0;
    const required = draft ? draft.requiredChallengeIds.length : 0;
    return { selected, required, optional: selected - required };
};

/**
 * The range of n in「n つ（必須をふくむ）」: from the required count (at
 * least 1) up to the selected count.
 * @param {?object} draft - draft
 * @returns {{min: number, max: number}} range (max 0 when nothing is selected)
 */
export const completionRange = (draft) => {
    const { selected, required } = lessonCounts(draft);
    return { min: Math.min(Math.max(1, required), selected), max: selected };
};

/**
 * Keep a draft consistent after a change: ★ only on selected challenges,
 * the count within its range.
 * @param {object} draft - draft
 * @returns {object} normalized draft
 */
const normalizeDraft = (draft) => {
    const selected = new Set(draft.challengeIds);
    const next = {
        ...draft,
        requiredChallengeIds: draft.challengeIds.filter(
            (id) => selected.has(id) && draft.requiredChallengeIds.includes(id),
        ),
    };
    const { min, max } = completionRange(next);
    const count = draft.completion.count;
    next.completion = {
        type: draft.completion.type,
        count:
            max === 0 || count === null || typeof count === 'undefined' ? count : Math.min(Math.max(count, min), max),
    };
    return next;
};

/**
 * レッスンにチェック: 中のチャレンジが全部入る / 全部外れる。
 * @param {object} draft - draft
 * @param {object} course - the draft's course
 * @param {string} lessonId - lesson id
 * @param {boolean} checked - add (true) or remove (false)
 * @returns {object} new draft
 */
export const setLessonChecked = (draft, course, lessonId, checked) => {
    const lesson = course.lessons.find((l) => l.id === lessonId);
    if (!lesson) return draft;
    const ids = lesson.challenges.map((c) => c.id);
    const challengeIds = checked
        ? orderChallengeIds(course, [...draft.challengeIds, ...ids])
        : draft.challengeIds.filter((id) => !ids.includes(id));
    return normalizeDraft({ ...draft, challengeIds });
};

/**
 * @param {object} draft - draft
 * @param {object} course - the draft's course
 * @param {string} challengeId - challenge id
 * @param {boolean} checked - add (true) or remove (false)
 * @returns {object} new draft
 */
export const setChallengeChecked = (draft, course, challengeId, checked) => {
    const challengeIds = checked
        ? orderChallengeIds(course, [...draft.challengeIds, challengeId])
        : draft.challengeIds.filter((id) => id !== challengeId);
    return normalizeDraft({ ...draft, challengeIds });
};

/**
 * ★「必須にする」: only for selected challenges.
 * @param {object} draft - draft
 * @param {string} challengeId - challenge id
 * @param {boolean} required - mark (true) or unmark (false)
 * @returns {object} new draft
 */
export const setChallengeRequired = (draft, challengeId, required) => {
    if (!draft.challengeIds.includes(challengeId)) return draft;
    const others = draft.requiredChallengeIds.filter((id) => id !== challengeId);
    return normalizeDraft({ ...draft, requiredChallengeIds: required ? [...others, challengeId] : others });
};

/**
 * @param {object} draft - draft
 * @param {string} type - 'all' | 'count'
 * @param {number} [count] - n for 'count' (kept within the range)
 * @returns {object} new draft
 */
export const setCompletion = (draft, type, count) => {
    // Switching the type resets n (a dependent input goes back to its default,
    // .claude/rules/scratch-gui/development.md): 「全部」 forgets it, and
    // 「n つ」 starts from the selected count.
    if (type !== 'count') return { ...draft, completion: { type: 'all', count: null } };
    const { min, max } = completionRange(draft);
    const given = count === null || typeof count === 'undefined' || count === '' ? NaN : Math.round(Number(count));
    let n = given;
    if (!Number.isFinite(n))
        n = draft.completion.type === 'count' && draft.completion.count !== null ? draft.completion.count : max;
    return { ...draft, completion: { type: 'count', count: Math.min(Math.max(n, min), max) } };
};

/**
 * @param {?object} draft - draft
 * @returns {number} how many challenges complete the assignment (課題クリアの数)
 */
export const completionTarget = (draft) => {
    const { selected, required } = lessonCounts(draft);
    if (!draft || draft.completion.type !== 'count') return selected;
    const count = draft.completion.count === null ? selected : draft.completion.count;
    return Math.max(count, required);
};

/**
 * The scoring that is stored: 満点・必須を全部こなしたときの点・必須でないものの合計点.
 * 必須が 0 個なら全部同じ点（必須の点 0）、必須でないものが 0 個なら必須の点 = 満点.
 * @param {?object} draft - draft
 * @returns {{total: number, requiredPoints: number, optionalPoints: number}} scoring
 */
export const effectiveScoring = (draft) => {
    const scoring = (draft && draft.scoring) || {};
    const total = Number.isFinite(scoring.total) && scoring.total > 0 ? scoring.total : DEFAULT_LESSON_TOTAL;
    const { required, optional } = lessonCounts(draft);
    if (required === 0) return { total, requiredPoints: 0, optionalPoints: total };
    if (optional === 0) return { total, requiredPoints: total, optionalPoints: 0 };
    const chosen = Number.isFinite(scoring.requiredPoints) ? scoring.requiredPoints : defaultRequiredPoints(total);
    const requiredPoints = Math.min(Math.max(chosen, 0), total);
    return { total, requiredPoints, optionalPoints: total - requiredPoints };
};

/**
 * 1 つの点: 必須 1 つ = 必須の点 ÷ 必須の数、必須でない 1 つ = 残り ÷ 必須でない数.
 * @param {?object} draft - draft
 * @returns {{required: ?number, optional: ?number}} points of one challenge (null when there is none)
 */
export const challengePoints = (draft) => {
    const { required, optional } = lessonCounts(draft);
    const { requiredPoints, optionalPoints } = effectiveScoring(draft);
    return {
        required: required > 0 ? requiredPoints / required : null,
        optional: optional > 0 ? optionalPoints / optional : null,
    };
};

/**
 * The scoring inputs can only be changed when they mean something: the
 * required points need both required and optional challenges.
 * @param {?object} draft - draft
 * @returns {boolean} whether the required points field is editable
 */
export const canChooseRequiredPoints = (draft) => {
    const { required, optional } = lessonCounts(draft);
    return required > 0 && optional > 0;
};

/**
 * @param {object} draft - draft
 * @param {{total?: *, requiredPoints?: *}} change - new input values
 * @returns {object} new draft (total within 1..1000, a given required points within 0..total)
 */
export const setScoring = (draft, change) => {
    const current = draft.scoring || { total: DEFAULT_LESSON_TOTAL, requiredPoints: null };
    const next = { ...current };
    if (Object.prototype.hasOwnProperty.call(change, 'total')) {
        const total = Math.round(Number(change.total));
        if (Number.isFinite(total)) next.total = Math.min(Math.max(total, 1), MAX_LESSON_TOTAL);
    }
    if (Object.prototype.hasOwnProperty.call(change, 'requiredPoints')) {
        const value = change.requiredPoints;
        const points = value === null || value === '' ? null : Math.round(Number(value));
        next.requiredPoints =
            points === null || !Number.isFinite(points) ? null : Math.min(Math.max(points, 0), next.total);
    }
    // Changing the total does not clamp the stored required points (typing
    // "50" passes through "5"); effectiveScoring clamps what is used.
    return { ...draft, scoring: next };
};

/**
 * Build the API `lesson` field from a draft.
 * @param {?object} draft - draft
 * @returns {?object} the lesson payload, or null for "no lesson"
 */
export const buildLessonPayload = (draft) => {
    if (!draft) return null;
    const completion =
        draft.completion.type === 'count' ? { type: 'count', count: completionTarget(draft) } : { type: 'all' };
    return {
        courseId: draft.courseId,
        challengeIds: [...draft.challengeIds],
        requiredChallengeIds: [...draft.requiredChallengeIds],
        completion,
        submitWork: !!draft.submitWork,
        scoring: draft.scoring ? effectiveScoring(draft) : null,
    };
};

/**
 * Make the editor draft from the stored `lesson` (GET /assignment).
 * @param {?object} lesson - stored lesson settings
 * @returns {?object} draft (null when the assignment has no lesson)
 */
export const lessonDraftFromSaved = (lesson) => {
    if (!lesson || typeof lesson.courseId !== 'string') return null;
    const challengeIds = Array.isArray(lesson.challengeIds) ? [...lesson.challengeIds] : [];
    const requiredChallengeIds = (lesson.requiredChallengeIds || []).filter((id) => challengeIds.includes(id));
    const completion =
        lesson.completion && lesson.completion.type === 'count'
            ? { type: 'count', count: lesson.completion.count }
            : { type: 'all', count: null };
    const draft = {
        courseId: lesson.courseId,
        challengeIds,
        requiredChallengeIds,
        completion,
        submitWork: lesson.submitWork === true,
        scoring: null,
    };
    if (lesson.scoring) {
        // The stored required points only mean the teacher's choice when there
        // are both kinds; otherwise they are derived (0 or 満点), so keep the
        // default to use once ★ are added.
        draft.scoring = {
            total: lesson.scoring.total,
            requiredPoints: canChooseRequiredPoints(draft) ? lesson.scoring.requiredPoints : null,
        };
    }
    return draft;
};

/**
 * Canonical form of a stored or built lesson payload, to compare them.
 * @param {?object} lesson - lesson payload
 * @returns {?object} canonical payload
 */
const canonicalLesson = (lesson) => {
    if (!lesson) return null;
    const draft = lessonDraftFromSaved(lesson);
    if (!draft) return null;
    return buildLessonPayload(draft);
};

/**
 * Which parts of the lesson differ from the stored ones (to colour them as
 * unsaved and to decide whether the save sends `lesson`).
 * @param {?object} draft - draft
 * @param {?object} saved - stored lesson settings
 * @returns {{any: boolean, course: boolean, challenges: boolean, completion: boolean,
 *   submit: boolean, scoring: boolean}} changed flags
 */
export const lessonChanges = (draft, saved) => {
    const a = buildLessonPayload(draft);
    const b = canonicalLesson(saved);
    const same = (key) => JSON.stringify(a && a[key]) === JSON.stringify(b && b[key]);
    const course = (a === null) !== (b === null) || !same('courseId');
    const challenges = course || !same('challengeIds') || !same('requiredChallengeIds');
    const completion = course || !same('completion');
    const submit = course || !same('submitWork');
    const scoring = course || !same('scoring');
    return {
        any: course || challenges || completion || submit || scoring,
        course,
        challenges,
        completion,
        submit,
        scoring,
    };
};

/**
 * Challenges that were in the stored setting but are not chosen now. Their
 * progress stays on the server but is no longer counted.
 * @param {?object} draft - draft
 * @param {?object} saved - stored lesson settings
 * @returns {Array<string>} dropped challenge ids
 */
export const droppedChallengeIds = (draft, saved) => {
    if (!saved || !Array.isArray(saved.challengeIds)) return [];
    if (!draft || draft.courseId !== saved.courseId) return [...saved.challengeIds];
    return saved.challengeIds.filter((id) => !draft.challengeIds.includes(id));
};

/**
 * @param {?object} draft - draft
 * @param {?object} course - the draft's course (null when it does not exist here)
 * @returns {?string} 'unknownCourse' | 'noChallenges' | null (valid)
 */
export const validateLessonDraft = (draft, course) => {
    if (!draft) return null;
    if (!course) return 'unknownCourse';
    if (draft.challengeIds.length === 0) return 'noChallenges';
    return null;
};

/**
 * レッスンの点 = できたチャレンジの点の合計（切り上げ・満点まで）. Progress of
 * challenges outside the setting is not counted.
 * @param {?object} lesson - lesson payload (stored settings)
 * @param {Array<string>} doneIds - completed challenge ids (「前」も入れる)
 * @returns {?number} the score, or null when there is no lesson
 */
export const computeLessonScore = (lesson, doneIds) => {
    const draft = lessonDraftFromSaved(lesson);
    if (!draft || draft.challengeIds.length === 0) return null;
    const scoring = lesson.scoring
        ? {
              total: lesson.scoring.total,
              requiredPoints: lesson.scoring.requiredPoints,
              optionalPoints: lesson.scoring.optionalPoints,
          }
        : effectiveScoring(draft);
    const { required, optional } = lessonCounts(draft);
    const done = new Set(doneIds);
    let sum = 0;
    for (const id of draft.challengeIds) {
        if (!done.has(id)) continue;
        if (draft.requiredChallengeIds.includes(id)) sum += scoring.requiredPoints / required;
        else sum += required === 0 ? scoring.total / draft.challengeIds.length : scoring.optionalPoints / optional;
    }
    return Math.min(scoring.total, ceilPoints(sum));
};
