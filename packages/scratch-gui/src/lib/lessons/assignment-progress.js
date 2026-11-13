// クラスの課題に紐付いたレッスンの進み具合（課題の帯・課題クリア・クラスの画面・メニューバーの印）を、
// 端末のレッスンの記録（lesson-progress.js）から作る純粋関数。決まりは docs/lessons/design.md の
// 「段 2: クラスの課題とレッスン」と docs/classroom/ui-ux.md の「レッスンの課題」。
//
// 先生の画面（座席の色・「進み具合」タブ）も同じ数え方を使えるよう、記録の形（`challenges` に
// `<challengeId>: {completedAt}` を持つもの）だけを見て、どこから来た記録かは問わない。
// クラスへの送信（進み具合を送る・本人の確認）は別（assignmentChallengeRecords で送る分を作る）。
import { COURSES, findChallenge, findCourse } from './courses';

/** メニューバーの印の種類。 */
export const ASSIGNMENT_MARKS = Object.freeze({
    NOT_STARTED: 'notStarted',
    IN_PROGRESS: 'inProgress',
    CLEARED: 'cleared',
});

const uniqueStrings = (values) =>
    Array.isArray(values) ? [...new Set(values.filter((v) => typeof v === 'string' && v))] : [];

/**
 * API の `lesson`（docs/classroom/architecture.md の「レッスンの設定」）を、画面で使う形にそろえる。
 * サーバーが検証済みでも、古い版・壊れた値で画面を落とさないよう既定を埋める。
 * @param {*} raw - API の `lesson`（無ければ null）。
 * @returns {?{courseId: string, challengeIds: Array<string>, requiredChallengeIds: Array<string>,
 *   completion: {type: string, count: number}, submitWork: boolean, scoring: ?object}}
 *   そろえた設定。レッスンの課題でなければ null。
 */
export const normalizeAssignmentLesson = (raw) => {
    if (!raw || typeof raw !== 'object' || typeof raw.courseId !== 'string' || !raw.courseId) return null;
    const challengeIds = uniqueStrings(raw.challengeIds);
    if (challengeIds.length === 0) return null;
    const requiredChallengeIds = uniqueStrings(raw.requiredChallengeIds).filter((id) => challengeIds.includes(id));
    const completion =
        raw.completion && raw.completion.type === 'count' && Number.isInteger(raw.completion.count)
            ? { type: 'count', count: raw.completion.count }
            : { type: 'all' };
    const scoring = raw.scoring && typeof raw.scoring === 'object' ? { ...raw.scoring } : null;
    return {
        courseId: raw.courseId,
        challengeIds,
        requiredChallengeIds,
        completion,
        submitWork: raw.submitWork === true,
        scoring,
    };
};

/**
 * 完了の条件の数。「全部」は選んだチャレンジの数、「n つ（必須をふくむ）」は n を
 * 必須の数〜選んだ数に収めたもの。
 * @param {object} lesson - normalizeAssignmentLesson の結果。
 * @returns {number} 条件の数。
 */
export const conditionCount = (lesson) => {
    const total = lesson.challengeIds.length;
    if (lesson.completion.type !== 'count') return total;
    return Math.min(total, Math.max(lesson.requiredChallengeIds.length, lesson.completion.count, 1));
};

const isCompleted = (progress, id) => Boolean(progress && progress.challenges && progress.challenges[id]);

/**
 * 課題の進み具合。
 *   - completedCount: 課題のチャレンジのうちできた数（課題の外の記録は数えない）
 *   - cappedCount: 条件の数で止めたできた数（「5/4」にしない）
 *   - remaining: 「あと n つ」= max(条件の数 − できた数, 残っている必須の数)
 *   - cleared: できた数が条件の数以上で、必須が全部できた
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {object} progress - 端末の記録。
 * @returns {?object} 進み具合。lesson が無ければ null。
 */
export const assignmentProgress = (lesson, progress) => {
    if (!lesson) return null;
    const required = new Set(lesson.requiredChallengeIds);
    const challenges = lesson.challengeIds.map((id) => ({
        id,
        required: required.has(id),
        completed: isCompleted(progress, id),
    }));
    const completedCount = challenges.filter((c) => c.completed).length;
    const requiredRemaining = challenges.filter((c) => c.required && !c.completed).length;
    const count = conditionCount(lesson);
    const remaining = Math.max(count - completedCount, requiredRemaining, 0);
    return {
        challenges,
        completedCount,
        cappedCount: Math.min(completedCount, count),
        conditionCount: count,
        requiredCount: required.size,
        requiredRemaining,
        remaining,
        started: completedCount > 0,
        cleared: remaining === 0,
    };
};

/**
 * メニューバーの課題名の横の印（未着手 ○ ／ 2/4 ／ ✓）。
 * @param {?object} status - assignmentProgress の結果。
 * @param {object} [options] - オプション。
 * @param {boolean} [options.submitted] - 作品を提出したか（✓ の横に提出済みのアイコンを並べる）。
 * @returns {?{kind: string, text: string, submitted: boolean}} 印。status が無ければ null。
 */
export const assignmentMenuMark = (status, { submitted = false } = {}) => {
    if (!status) return null;
    if (status.cleared) return { kind: ASSIGNMENT_MARKS.CLEARED, text: '✓', submitted: Boolean(submitted) };
    if (!status.started) return { kind: ASSIGNMENT_MARKS.NOT_STARTED, text: '○', submitted: false };
    return {
        kind: ASSIGNMENT_MARKS.IN_PROGRESS,
        text: `${status.cappedCount}/${status.conditionCount}`,
        submitted: false,
    };
};

/**
 * いまの「できた」で、はじめて課題クリアになったか（「課題クリア！」を出すのは 1 回だけ）。
 * 同じチャレンジがもう一度できたとき（記録が増えていない）と、前から課題クリアだったときは false。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {object} progressAfter - できたあとの記録。
 * @param {string} challengeId - できたチャレンジ id。
 * @param {boolean} wasNew - この「できた」で記録が増えたか。
 * @returns {boolean} はじめて課題クリアになったら true。
 */
export const isAssignmentJustCleared = (lesson, progressAfter, challengeId, wasNew) => {
    if (!lesson || !wasNew || !lesson.challengeIds.includes(challengeId)) return false;
    const after = assignmentProgress(lesson, progressAfter);
    if (!after.cleared) return false;
    const challenges = { ...progressAfter.challenges };
    delete challenges[challengeId];
    return !assignmentProgress(lesson, { ...progressAfter, challenges }).cleared;
};

/**
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {string} challengeId - チャレンジ id。
 * @returns {boolean} 課題のチャレンジなら true。
 */
export const isAssignmentChallenge = (lesson, challengeId) =>
    Boolean(lesson && lesson.challengeIds.includes(challengeId));

/**
 * クラスへ送る分の記録（課題のチャレンジだけ・できた日時だけ）。進み具合の送信（#1600）はここから作る。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {object} progress - 端末の記録。
 * @returns {object} `{<challengeId>: {completedAt}}`。
 */
export const assignmentChallengeRecords = (lesson, progress) => {
    const records = {};
    if (!lesson) return records;
    lesson.challengeIds.forEach((id) => {
        if (isCompleted(progress, id)) records[id] = { completedAt: progress.challenges[id].completedAt };
    });
    return records;
};

/**
 * レッスン表のコース 1 つ分（library-filter.js の filterCourseStatuses の要素）を、課題のチャレンジ
 * だけに絞る（「はじめる」で開いたとき）。課題のチャレンジが無いレッスンは除く。レッスンの番号は
 * コースの中の番号のまま、数（completedCount / total）は絞ったあとで数え直す。コースの ✓（allCompleted）は
 * コース全体の値のまま。
 * @param {object} status - コース 1 つ分の進み具合。
 * @param {Array<string>} challengeIds - 課題のチャレンジ id。
 * @returns {object} 絞った進み具合。
 */
export const restrictCourseStatus = (status, challengeIds) => {
    const ids = new Set(challengeIds);
    const lessons = status.lessons
        .map((lessonStatus) => {
            const challenges = lessonStatus.challenges.filter(({ challenge }) => ids.has(challenge.id));
            const completedCount = challenges.filter((c) => c.completed).length;
            return {
                ...lessonStatus,
                challenges,
                completedCount,
                total: challenges.length,
                allCompleted: challenges.length > 0 && completedCount === challenges.length,
            };
        })
        .filter((lessonStatus) => lessonStatus.challenges.length > 0);
    const completedCount = lessons.reduce((sum, l) => sum + l.completedCount, 0);
    const total = lessons.reduce((sum, l) => sum + l.total, 0);
    // コース名の前の ✓（allCompleted）はコース全体が全部できたときの印なので、絞る前の値のまま
    // （課題のチャレンジが全部できたことは課題の帯の「課題クリア」で伝える）
    return { ...status, lessons, completedCount, total };
};

/**
 * 課題のレッスン表を開くとき、どのレッスンを見せて、どのチャレンジに「次はこれ！」を付けるか。
 * 課題のチャレンジを並び順に、`afterId` の次からさがして（最後まで行ったら先頭にもどる）、
 * まだできていない最初のもの。全部できていれば印は付けない（コースの先頭のレッスンを見せる）。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {object} progress - 端末の記録。
 * @param {?string} [afterId] - いまのチャレンジ id（課題の外・null なら先頭から）。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {?{language: string, courseId: string, lessonId: ?string, nextChallengeId: ?string}}
 *   知らないコース・lesson が無ければ null。
 */
export const assignmentLibraryFocus = (lesson, progress, afterId = null, courses = COURSES) => {
    if (!lesson) return null;
    const course = findCourse(lesson.courseId, courses);
    if (!course) return null;
    const ids = lesson.challengeIds;
    const index = afterId === null ? -1 : ids.indexOf(afterId);
    let next = null;
    for (let i = 1; i <= ids.length; i++) {
        const id = ids[(index + i + ids.length) % ids.length];
        if (id !== afterId && !isCompleted(progress, id) && findChallenge(id, courses)) {
            next = id;
            break;
        }
    }
    const found = next ? findChallenge(next, courses) : null;
    const firstLesson = course.lessons.find((l) => l.challenges.some((c) => ids.includes(c.id)));
    return {
        language: course.language,
        courseId: course.id,
        lessonId: found ? found.lesson.id : firstLesson ? firstLesson.id : null,
        nextChallengeId: next,
    };
};
