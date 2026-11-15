/**
 * クラス一覧（先生の入口）に出す要約を、課題の一覧（`GET /classrooms`）の値から作る純粋関数
 * （EPIC #1956 Q4・#1959）。
 *
 * - 次の授業日: そのクラスの課題（`sortDate` = 授業日。無ければ作成日）のうち、今日かそれより後で
 *   いちばん近いもの。
 * - 確認が必要な課題: 返却していない提出がある課題。数は課題の一覧の各課題の `unreturnedCount`
 *   （席ごとにいちばん新しい提出のうち、まだ返却していないものの数・#1972）を読む。提出の一覧は
 *   問い合わせない。`unreturnedCount` を返さない古い API のときは数がそろわないので null を返す。
 */

/**
 * その時刻の、利用者の時間帯での日付（`YYYY-MM-DD`）。授業日の入力（`<input type="date">`）と同じ形。
 * @param {number} ms - ms epoch
 * @param {string} [timeZone] - 時間帯（IANA 名）。省略すると利用者の時間帯（テストで固定するため）
 * @returns {string} 例 `2026-11-15`
 */
const localDateKey = (ms, timeZone) => {
    if (timeZone) {
        // en-CA は YYYY-MM-DD で書く。
        return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(ms));
    }
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * 課題の授業日（利用者の時間帯での `YYYY-MM-DD`）。授業日が無ければ作成日。どちらも無ければ null。
 * 時刻つきの ISO（UTC）は先頭の 10 文字で切らずに、その時間帯の日付に直す（日本時間の朝の授業日が
 * 前の日にずれないように）。日付だけの文字列はそのまま使う。
 * @param {object} classroom - 課題（`{sortDate, createdAt}`）
 * @param {string} [timeZone] - 時間帯（IANA 名）。省略すると利用者の時間帯
 * @returns {string|null} 日付
 */
const lessonDateKey = (classroom, timeZone) => {
    const value = (classroom && (classroom.sortDate || classroom.createdAt)) || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : localDateKey(ms, timeZone);
};

/**
 * アーカイブしていない（status が無い古い値も含む）課題か。
 * @param {object} classroom - 課題
 * @returns {boolean} active なら true
 */
const isActive = (classroom) => !!classroom && (!classroom.status || classroom.status === 'active');

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
        if (!isActive(c) || c.groupId !== groupId) continue;
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
 * 確認が必要な課題。アーカイブしていないクラスの課題のうち `unreturnedCount` が 1 以上のものを、
 * 授業日の新しい順に並べる。
 * - 対象の課題（アーカイブしていないクラスの active な課題）が 1 つも無いときは null（帯を出さない）。
 * - 対象のどれかに `unreturnedCount`（0 以上の整数）が無いとき（古い API）も null。数がそろわないのに
 *   「すべて返却しました」と言わないため。
 * @param {Array<object>} classrooms - 先生の課題の一覧（`GET /classrooms`）
 * @param {Array<object>} groups - 先生のクラスの一覧
 * @returns {?Array<{classroom: object, group: object, count: number}>} 課題。数がそろわなければ null
 */
const reviewItems = (classrooms, groups) => {
    const activeGroups = new Map(
        (groups || []).filter((g) => g && g.status !== 'archived').map((g) => [g.groupId, g]),
    );
    const targets = (classrooms || []).filter((c) => isActive(c) && activeGroups.has(c.groupId));
    if (targets.length === 0) return null;
    const counted = targets.every((c) => Number.isInteger(c.unreturnedCount) && c.unreturnedCount >= 0);
    if (!counted) return null;
    return targets
        .filter((c) => c.unreturnedCount > 0)
        .map((c) => ({
            classroom: c,
            group: activeGroups.get(c.groupId),
            count: c.unreturnedCount,
            date: lessonDateKey(c) || '',
        }))
        .sort(
            (a, b) =>
                b.date.localeCompare(a.date) ||
                String(a.classroom.classroomId).localeCompare(b.classroom.classroomId),
        )
        .map(({ classroom, group, count }) => ({ classroom, group, count }));
};

export { lessonDateKey, localDateKey, nextLessonFor, reviewItems };
