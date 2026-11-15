/**
 * クラス一覧（先生の入口）に出す要約を、いまの API の値から作る純粋関数（EPIC #1956 Q4・#1959）。
 *
 * - 次の授業日: そのクラスの課題（`GET /classrooms` の `sortDate` = 授業日。無ければ作成日）のうち、
 *   今日かそれより後でいちばん近いもの。
 * - 確認が必要な課題: 返却していない提出がある課題。課題の一覧の API は提出の数を返さないので、
 *   授業日が最近の課題だけを選んで `GET /classrooms/{id}/submissions` で数える（API は変えない）。
 *   選ぶ範囲を絞るのは、一覧を開くたびに課題の数だけ問い合わせないため。
 */

/** 確認が必要な課題として数える、授業日のさかのぼり（日）。 */
const REVIEW_LOOKBACK_DAYS = 14;
/** 確認が必要な課題を数えるために問い合わせる課題の数の上限。 */
const REVIEW_CANDIDATE_LIMIT = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * その時刻の、利用者の時間帯での日付（`YYYY-MM-DD`）。授業日の入力（`<input type="date">`）と同じ形。
 * @param {number} ms - ms epoch
 * @returns {string} 例 `2026-11-15`
 */
const localDateKey = (ms) => {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * 課題の授業日（`YYYY-MM-DD`）。授業日が無ければ作成日。どちらも無ければ null。
 * @param {object} classroom - 課題（`{sortDate, createdAt}`）
 * @returns {string|null} 日付
 */
const lessonDateKey = (classroom) => {
    const iso = (classroom && (classroom.sortDate || classroom.createdAt)) || '';
    return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null;
};

/**
 * クラスの次の授業日の課題。今日かそれより後の授業日でいちばん近いもの（同じ日なら名前順）。
 * @param {Array<object>} classrooms - 先生の課題の一覧（active）
 * @param {string} groupId - クラスの id
 * @param {number} now - いまの時刻（ms epoch）
 * @returns {{classroom: object, date: string}|null} 課題と授業日。無ければ null
 */
const nextLessonFor = (classrooms, groupId, now) => {
    const today = localDateKey(now);
    let best = null;
    for (const c of classrooms || []) {
        if (!c || c.groupId !== groupId || (c.status && c.status !== 'active')) continue;
        const date = lessonDateKey(c);
        if (!date || date < today) continue;
        const name = c.assignmentName || c.className || '';
        if (!best || date < best.date || (date === best.date && name < best.name)) {
            best = { classroom: c, date, name };
        }
    }
    return best ? { classroom: best.classroom, date: best.date } : null;
};

/**
 * 確認が必要な課題を数える候補。アーカイブしていないクラスの課題のうち、授業日が今日から
 * `REVIEW_LOOKBACK_DAYS` 日前までのものを、授業日の新しい順に `REVIEW_CANDIDATE_LIMIT` 件まで。
 * @param {Array<object>} classrooms - 先生の課題の一覧（active）
 * @param {Array<object>} groups - 先生のクラスの一覧
 * @param {number} now - いまの時刻（ms epoch）
 * @returns {Array<{classroom: object, group: object}>} 候補
 */
const reviewCandidates = (classrooms, groups, now) => {
    const activeGroups = new Map(
        (groups || []).filter((g) => g && g.status !== 'archived').map((g) => [g.groupId, g]),
    );
    const today = localDateKey(now);
    const from = localDateKey(now - REVIEW_LOOKBACK_DAYS * DAY_MS);
    return (classrooms || [])
        .filter((c) => c && activeGroups.has(c.groupId) && (!c.status || c.status === 'active'))
        .map((c) => ({ classroom: c, group: activeGroups.get(c.groupId), date: lessonDateKey(c) }))
        .filter((x) => x.date && x.date >= from && x.date <= today)
        .sort(
            (a, b) =>
                b.date.localeCompare(a.date) ||
                String(a.classroom.classroomId).localeCompare(b.classroom.classroomId),
        )
        .slice(0, REVIEW_CANDIDATE_LIMIT)
        .map(({ classroom, group }) => ({ classroom, group }));
};

/**
 * 返却していない提出の数。生徒（席）ごとにいちばん新しい提出だけを見て、まだ返却していないものを数える
 * （出し直した生徒を 2 回数えない。先生の画面の `enrichMembers` と同じ見方）。
 * @param {object} submissionsData - `GET /classrooms/{id}/submissions` の応答（`{submissions}`）
 * @returns {number} 数
 */
const countUnreturned = (submissionsData) => {
    const latest = new Map();
    for (const sub of (submissionsData && submissionsData.submissions) || []) {
        if (!sub || !sub.memberId) continue;
        const prev = latest.get(sub.memberId);
        if (!prev || String(sub.submittedAt || '') > String(prev.submittedAt || '')) latest.set(sub.memberId, sub);
    }
    let count = 0;
    for (const sub of latest.values()) {
        if (sub.status !== 'returned') count++;
    }
    return count;
};

export {
    REVIEW_CANDIDATE_LIMIT,
    REVIEW_LOOKBACK_DAYS,
    countUnreturned,
    lessonDateKey,
    localDateKey,
    nextLessonFor,
    reviewCandidates,
};
