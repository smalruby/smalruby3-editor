// レッスン表を開いたときに、どのコース・レッスンを開いておくか（たたみ方）を決める純粋関数（#2148）。
// 「チャレンジが多すぎる」と感じてためらわないよう、いま進めているところだけを開く:
//   - いま進めているコースだけ開く（どれも始めていなければ最初のコース）。ほかのコースは見出しとバーだけ
//   - コースの中では、つぎのチャレンジがあるレッスンと、そのつぎのレッスン 1 つだけ開く
//   - 全部できたレッスンと、それより後のレッスンは閉じる（閉じた行にもチャレンジの数だけ丸を出す）
//   - 検索中・クラスの課題のチャレンジだけの表は全部開く
// 開閉は覚えない（表を開くたびにこの決まりで決める）。見せる側は components/lessons-library/lessons-library.jsx。

/**
 * まだ全部できていない（チャレンジのある）レッスンか。チャレンジがまだ無いレッスンは対象にしない。
 * @param {object} lessonStatus - `courseProgress` の `lessons` の 1 つ。
 * @returns {boolean} 進める余地があれば true。
 */
const isOpenable = (lessonStatus) => lessonStatus.total > 0 && !lessonStatus.allCompleted;

/**
 * コースの中で開いておくレッスンの id。いまのレッスン（`focusLessonId` があればそれ、無ければ最初の
 * まだ全部できていないレッスン）と、その後ろで最初のまだ全部できていないレッスン。
 * @param {object} status - `filterCourseStatuses` の 1 つ。
 * @param {?string} focusLessonId - 「つぎのチャレンジ」で開いたときに見せるレッスン。
 * @returns {Array<string>} 開くレッスンの id（0〜2 個）。
 */
const openLessonIdsOf = (status, focusLessonId) => {
    const lessons = status.lessons;
    let current = focusLessonId ? lessons.findIndex((l) => l.lesson.id === focusLessonId) : -1;
    if (current < 0) current = lessons.findIndex(isOpenable);
    if (current < 0) return [];
    const ids = [lessons[current].lesson.id];
    const following = lessons.slice(current + 1).find(isOpenable);
    if (following) ids.push(following.lesson.id);
    return ids;
};

/**
 * コースのチャレンジのうち、いちばん新しい「できた」の日時（ISO 文字列）。1 つも無ければ ''。
 * @param {object} status - `filterCourseStatuses` の 1 つ。
 * @param {object} progress - 記録。
 * @returns {string} 日時。
 */
const latestCompletedAt = (status, progress) =>
    status.lessons.reduce(
        (latest, lessonStatus) =>
            lessonStatus.challenges.reduce((acc, { challenge }) => {
                const record = progress.challenges[challenge.id];
                return record && record.completedAt > acc ? record.completedAt : acc;
            }, latest),
        '',
    );

/**
 * いま進めているコースの id。`focusLessonId` のあるコース → まだ全部できていないコースのうち、いちばん
 * 最近チャレンジができたコース → まだ全部できていない最初のコース → 最初のコース、の順に決める。
 * @param {Array<object>} statuses - `filterCourseStatuses` の結果。
 * @param {object} progress - 記録。
 * @param {?string} focusLessonId - 「つぎのチャレンジ」で開いたときに見せるレッスン。
 * @returns {?string} コースの id。コースが無ければ null。
 */
export const currentCourseId = (statuses, progress, focusLessonId = null) => {
    if (statuses.length === 0) return null;
    if (focusLessonId) {
        const focused = statuses.find((s) => s.lessons.some((l) => l.lesson.id === focusLessonId));
        if (focused) return focused.course.id;
    }
    const unfinished = statuses.filter((s) => !s.allCompleted);
    let latest = null;
    let latestAt = '';
    unfinished.forEach((status) => {
        const at = latestCompletedAt(status, progress);
        if (at > latestAt) {
            latest = status;
            latestAt = at;
        }
    });
    if (latest) return latest.course.id;
    return (unfinished[0] || statuses[0]).course.id;
};

/**
 * レッスン表を開いたときの、コースとレッスンの開き方。
 * @param {Array<object>} statuses - `filterCourseStatuses` の結果（課題だけの表では絞ったもの）。
 * @param {object} progress - 記録。
 * @param {object} [options] - 開き方の条件。
 * @param {boolean} [options.searching] - 検索中か（全部開く）。
 * @param {boolean} [options.assignmentOnly] - クラスの課題のチャレンジだけの表か（全部開く）。
 * @param {?string} [options.focusLessonId] - 「つぎのチャレンジ」で開いたときに見せるレッスン（必ず開く）。
 * @returns {{courses: {[id: string]: boolean}, lessons: {[id: string]: boolean}}} id → 開いているか。
 */
export const initialFoldState = (
    statuses,
    progress,
    { searching = false, assignmentOnly = false, focusLessonId = null } = {},
) => {
    const courses = {};
    const lessons = {};
    const openAll = searching || assignmentOnly;
    const current = openAll ? null : currentCourseId(statuses, progress, focusLessonId);
    statuses.forEach((status) => {
        courses[status.course.id] = openAll || status.course.id === current;
        const open = openAll ? null : openLessonIdsOf(status, focusLessonId);
        status.lessons.forEach(({ lesson }) => {
            lessons[lesson.id] = openAll || open.includes(lesson.id);
        });
    });
    return { courses, lessons };
};

/** 閉じた行の丸の種類。 */
export const DOT_STATES = Object.freeze({ DONE: 'done', NEXT: 'next', TODO: 'todo' });

/**
 * 閉じたレッスンの行に出す丸（チャレンジの数だけ。できた＝塗り・つぎ＝オレンジ・まだ＝白）。
 * @param {object} lessonStatus - `courseProgress` の `lessons` の 1 つ。
 * @param {?string} nextChallengeId - 「つぎ！」のチャレンジ。
 * @returns {Array<{id: string, state: string}>} 丸の並び。
 */
export const lessonDots = (lessonStatus, nextChallengeId = null) =>
    lessonStatus.challenges.map(({ challenge, completed }) => {
        let state = DOT_STATES.TODO;
        if (completed) state = DOT_STATES.DONE;
        else if (challenge.id === nextChallengeId) state = DOT_STATES.NEXT;
        return { id: challenge.id, state };
    });
