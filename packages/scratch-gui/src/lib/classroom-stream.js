/**
 * Stream of a class (issue #1302, EPIC B5): what the teacher did to the
 * class's assignments, like Google Classroom's stream ("posted a new
 * assignment"). Only creating and removing are shown — description edits,
 * returns and submissions are not (submissions are seen on［授業］, B7).
 *
 * - created: every assignment (active or archived), dated by `createdAt`
 * - archived: archived assignments, dated by `archivedAt` (older data has
 *   no archivedAt; the API then returns updatedAt, and we fall back to it too)
 * - expiring: assignments auto-deleted within RETENTION_WARNING_DAYS (same
 *   threshold as the red mark, R4). Pinned on top, soonest first, because
 *   it is the only entry the teacher has to act on. Already-deleted ones are
 *   gone from the data, so a passed deadline shows nothing.
 */
import { RETENTION_WARNING_DAYS } from './classroom-retention.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const timeOf = (iso) => {
    if (!iso) return NaN;
    return new Date(iso).getTime();
};

/**
 * Build the stream entries of a class.
 * @param {Array<object>} classrooms - active assignments of the class
 * @param {Array<object>} archivedClassrooms - archived assignments of the class
 * @param {number} [now] - current time in ms (injectable for tests)
 * @returns {Array<{key: string, type: string, date: string, archived: boolean, classroom: object}>}
 *   entries: "expiring" first (soonest first), then the rest newest first
 */
export const buildStreamEvents = (classrooms, archivedClassrooms, now = Date.now()) => {
    const expiring = [];
    const history = [];
    const add = (classroom, archived) => {
        const id = classroom.classroomId;
        if (!Number.isNaN(timeOf(classroom.createdAt))) {
            history.push({ key: `created-${id}`, type: 'created', date: classroom.createdAt, archived, classroom });
        }
        const archivedAt = classroom.archivedAt || classroom.updatedAt;
        if (archived && !Number.isNaN(timeOf(archivedAt))) {
            history.push({ key: `archived-${id}`, type: 'archived', date: archivedAt, archived, classroom });
        }
        const expires = timeOf(classroom.expiresAt);
        if (!Number.isNaN(expires) && expires > now && expires - now <= RETENTION_WARNING_DAYS * DAY_MS) {
            expiring.push({
                key: `expiring-${id}`,
                type: 'expiring',
                date: classroom.expiresAt,
                archived,
                classroom,
            });
        }
    };
    (classrooms || []).forEach((c) => add(c, false));
    (archivedClassrooms || []).forEach((c) => add(c, true));
    expiring.sort((a, b) => timeOf(a.date) - timeOf(b.date));
    history.sort((a, b) => timeOf(b.date) - timeOf(a.date));
    return [...expiring, ...history];
};

/**
 * ストリームの「保存期限」のカード（#1960・R4）。
 * - `expiring`: 自動で消えるまで RETENTION_WARNING_DAYS 日以内の課題（active とアーカイブ済み）。
 *   早く消える順。これがあるときだけカードを赤にする。
 * - `next`: これから消える課題のうち、いちばん早いもの（7 日より先なら灰色の文に出す）。
 * もう期限を過ぎた課題はデータから消えているので数えない。
 * @param {Array<object>} classrooms - そのクラスの active な課題
 * @param {Array<object>} archivedClassrooms - そのクラスのアーカイブ済みの課題
 * @param {number} [now] - いまの時刻（ms。テストで固定するため）
 * @returns {{expiring: Array<{classroom: object, archived: boolean}>, next: ?{classroom: object, archived: boolean}}}
 *   カードに出すもの
 */
export const retentionSummary = (classrooms, archivedClassrooms, now = Date.now()) => {
    const upcoming = [
        ...(classrooms || []).map((c) => ({ classroom: c, archived: false })),
        ...(archivedClassrooms || []).map((c) => ({ classroom: c, archived: true })),
    ]
        .filter((e) => {
            const t = timeOf(e.classroom.expiresAt);
            return !Number.isNaN(t) && t > now;
        })
        .sort((a, b) => timeOf(a.classroom.expiresAt) - timeOf(b.classroom.expiresAt));
    return {
        expiring: upcoming.filter((e) => timeOf(e.classroom.expiresAt) - now <= RETENTION_WARNING_DAYS * DAY_MS),
        next: upcoming[0] || null,
    };
};
