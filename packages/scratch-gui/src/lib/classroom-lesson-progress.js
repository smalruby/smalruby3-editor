/**
 * Lesson progress of a classroom assignment, as the teacher sees it
 * (EPIC #1592 / #1602): the seat colours of the members tab and the
 * 「進み具合」 tab (seat × challenge table, sort orders, CSV).
 *
 * The input is the teacher API `GET /classrooms/{id}/lesson-progress`
 * (docs/classroom/architecture.md): one row per seat
 * `{memberId, seatNumber, challenges: {[id]: {completedAt, before}},
 *   current: {challengeId, openedAt} | null, updatedAt}`.
 * The counting rules are docs/classroom/ui-ux.md「レッスンの課題」:
 * only the assignment's current `lesson.challengeIds` that the course data
 * of this version knows are counted; あと n つ = max(条件 − できた, 残りの必須);
 * 課題クリア = できた ≥ 条件 and every required one is done.
 *
 * The counting itself is the student side's `assignmentProgress`
 * (lib/lessons/assignment-progress.js), so the teacher and the student see
 * the same numbers; a server row has the same `challenges` shape as the
 * device record.
 *
 * Pure functions only: the time is passed in (`now`, ms epoch).
 */
import { csvLines } from './classroom-download-utils.js';
import { computeLessonScore } from './classroom-lesson-settings.js';
import { SEATED_THRESHOLD_MS } from './classroom-presence.js';
import { assignmentProgress, normalizeAssignmentLesson } from './lessons/assignment-progress.js';

/** 同じチャレンジにこの長さいると「!」（止まっている）. */
export const STUCK_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * ▶ と ! は目安: 進み具合は定期的に送らないので、席の最後の送信がこれより
 * 前なら出さない（着席の目安と同じ 1 時間）.
 */
export const CURRENT_FRESH_MS = SEATED_THRESHOLD_MS;

export const SEAT_STATES = Object.freeze({
    NOT_JOINED: 'notJoined',
    NOT_STARTED: 'notStarted',
    IN_PROGRESS: 'inProgress',
    CLEARED: 'cleared',
});

export const CELL_KINDS = Object.freeze({
    DONE: 'done',
    BEFORE: 'before',
    CURRENT: 'current',
    STUCK: 'stuck',
    TODO: 'todo',
});

export const SORT_ORDERS = Object.freeze(['seat', 'progress', 'stuck']);

const toMs = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return NaN;
    return new Date(value).getTime();
};

/**
 * What to count for an assignment: its current challenges (in lesson order,
 * only those the course data knows), the required ones and the completion
 * target, plus the table columns grouped by lesson.
 * @param {?object} lesson - the assignment's stored `lesson` (null = no lesson)
 * @param {?object} course - its course (`lib/lessons/courses.js`); null when this version does not have it
 * @returns {?object} context, or null when there is nothing to count
 */
export const lessonProgressContext = (lesson, course) => {
    const normalized = normalizeAssignmentLesson(lesson);
    if (!normalized || !course || normalized.courseId !== course.id) return null;
    const courses = [course];
    const empty = assignmentProgress(normalized, null, courses);
    if (empty.challenges.length === 0) return null;
    const selected = new Set(empty.challenges.map((c) => c.id));
    const required = new Set(empty.challenges.filter((c) => c.required).map((c) => c.id));
    const columns = [];
    const lessonGroups = [];
    course.lessons.forEach((courseLesson, lessonIndex) => {
        const chosen = courseLesson.challenges.filter((c) => selected.has(c.id));
        if (chosen.length === 0) return;
        lessonGroups.push({ lesson: courseLesson, lessonIndex, span: chosen.length });
        for (const challenge of chosen) {
            columns.push({ id: challenge.id, challenge, lessonIndex, required: required.has(challenge.id) });
        }
    });
    return {
        lesson,
        normalized,
        course,
        courses,
        challengeIds: columns.map((c) => c.id),
        requiredIds: [...required],
        target: empty.conditionCount,
        columns,
        lessonGroups,
    };
};

/**
 * The progress of one seat under the current settings.
 * @param {?object} row - the seat's progress row (null when it has sent nothing)
 * @param {object} ctx - lessonProgressContext
 * @param {number} now - current time (ms epoch)
 * @returns {object} {state, done, before, shown, target, requiredLeft, remaining, cleared,
 *   doneIds, cells: {[id]: kind}, current: ?{challengeId, openedAt, elapsedMs}, stuck}
 */
export const seatProgress = (row, ctx, now) => {
    const records = (row && row.challenges) || {};
    const status = assignmentProgress(ctx.normalized, row, ctx.courses);
    const doneIds = [];
    let before = 0;
    const cells = {};
    for (const challenge of status.challenges) {
        const { id } = challenge;
        if (challenge.completed) {
            doneIds.push(id);
            if (records[id] && records[id].before === true) {
                before += 1;
                cells[id] = CELL_KINDS.BEFORE;
            } else {
                cells[id] = CELL_KINDS.DONE;
            }
        } else {
            cells[id] = CELL_KINDS.TODO;
        }
    }
    const done = status.completedCount;
    const cleared = status.cleared;

    // ▶ / !: only a challenge of the setting that is not done yet (going back
    // to a done one is not being stuck), and only while the seat's last send
    // is recent (the record stays when the editor is closed).
    let current = null;
    const cur = row && row.current;
    const updatedMs = toMs(row && row.updatedAt);
    const openedMs = toMs(cur && cur.openedAt);
    if (
        cur &&
        cells[cur.challengeId] === CELL_KINDS.TODO &&
        Number.isFinite(updatedMs) &&
        now - updatedMs < CURRENT_FRESH_MS &&
        Number.isFinite(openedMs)
    ) {
        const elapsedMs = Math.max(0, now - openedMs);
        current = { challengeId: cur.challengeId, openedAt: cur.openedAt, elapsedMs };
        cells[cur.challengeId] = elapsedMs >= STUCK_THRESHOLD_MS ? CELL_KINDS.STUCK : CELL_KINDS.CURRENT;
    }

    let state = SEAT_STATES.IN_PROGRESS;
    if (cleared) state = SEAT_STATES.CLEARED;
    else if (done === 0) state = SEAT_STATES.NOT_STARTED;
    return {
        state,
        done,
        before,
        // 「5/4」にしない: できた数は条件の数で止める.
        shown: status.cappedCount,
        target: status.conditionCount,
        requiredLeft: status.requiredRemaining,
        remaining: status.remaining,
        cleared,
        doneIds,
        cells,
        current,
        stuck: Boolean(current && current.elapsedMs >= STUCK_THRESHOLD_MS),
    };
};

/**
 * @param {number} seatNumber - seat number (1-based)
 * @returns {string} member id (`seat-NN`)
 */
export const seatMemberId = (seatNumber) => `seat-${String(seatNumber).padStart(2, '0')}`;

/**
 * @param {?object} data - GET lesson-progress response
 * @returns {object} memberId → progress row
 */
export const progressRowsByMember = (data) => {
    const map = {};
    for (const row of (data && data.progress) || []) {
        if (row && row.memberId) map[row.memberId] = row;
    }
    return map;
};

/**
 * The seat tile of the members tab.
 * @param {?object} member - member (null = no one ever joined)
 * @param {?object} row - the seat's progress row
 * @param {object} ctx - lessonProgressContext
 * @param {number} now - current time (ms epoch)
 * @returns {object} {state, progress: ?object} (progress is null for a seat not joined)
 */
export const seatTile = (member, row, ctx, now) => {
    if (!member || member.left) return { state: SEAT_STATES.NOT_JOINED, progress: null };
    const progress = seatProgress(row, ctx, now);
    return { state: progress.state, progress };
};

/**
 * The rows of the 「進み具合」 table: seats with a student now, and seats
 * whose last student left a record (empty / kicked seats keep the last
 * one). Seats nobody joined and with no record are left out.
 * @param {Array<object>} members - members of the assignment
 * @param {object} rowsByMember - progressRowsByMember
 * @param {number} studentCount - number of seats
 * @param {object} ctx - lessonProgressContext
 * @param {number} now - current time (ms epoch)
 * @returns {Array<object>} [{seatNumber, memberId, member, joined, progress}] in seat order
 */
export const progressTableRows = (members, rowsByMember, studentCount, ctx, now) => {
    const memberMap = {};
    for (const m of members || []) memberMap[m.memberId] = m;
    const rows = [];
    for (let seatNumber = 1; seatNumber <= studentCount; seatNumber++) {
        const memberId = seatMemberId(seatNumber);
        const member = memberMap[memberId] || null;
        const joined = Boolean(member && !member.left);
        const record = rowsByMember[memberId] || null;
        if (!joined && !record) continue;
        rows.push({ seatNumber, memberId, member, joined, progress: seatProgress(record, ctx, now) });
    }
    return rows;
};

/**
 * 「クリア N / 参加 N」.
 * @param {Array<object>} tiles - seatTile results
 * @returns {{cleared: number, joined: number}} counts
 */
export const clearedSummary = (tiles) => {
    let cleared = 0;
    let joined = 0;
    for (const tile of tiles) {
        if (tile.state === SEAT_STATES.NOT_JOINED) continue;
        joined += 1;
        if (tile.state === SEAT_STATES.CLEARED) cleared += 1;
    }
    return { cleared, joined };
};

/**
 * 「できた人」: per challenge, how many rows did it and how many are on it now.
 * @param {Array<object>} rows - progressTableRows
 * @param {object} ctx - lessonProgressContext
 * @returns {object} id → {done, current}
 */
export const columnTotals = (rows, ctx) => {
    const totals = {};
    for (const id of ctx.challengeIds) totals[id] = { done: 0, current: 0 };
    for (const row of rows) {
        for (const id of ctx.challengeIds) {
            const kind = row.progress.cells[id];
            if (kind === CELL_KINDS.DONE || kind === CELL_KINDS.BEFORE) totals[id].done += 1;
            else if (kind === CELL_KINDS.CURRENT || kind === CELL_KINDS.STUCK) totals[id].current += 1;
        }
    }
    return totals;
};

/**
 * 並べ方: 席 / 進んでいる順（できた数の多い順）/ 止まっている順（いまの
 * チャレンジにいる時間の長い順・いまやっていない席は後ろ）. Ties keep seat order.
 * @param {Array<object>} rows - progressTableRows
 * @param {string} order - 'seat' | 'progress' | 'stuck'
 * @returns {Array<object>} sorted copy
 */
export const sortProgressRows = (rows, order) => {
    const bySeat = (a, b) => a.seatNumber - b.seatNumber;
    const elapsed = (row) => (row.progress.current ? row.progress.current.elapsedMs : -1);
    const sorted = [...rows];
    if (order === 'progress') sorted.sort((a, b) => b.progress.done - a.progress.done || bySeat(a, b));
    else if (order === 'stuck') sorted.sort((a, b) => elapsed(b) - elapsed(a) || bySeat(a, b));
    else sorted.sort(bySeat);
    return sorted;
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * CSV の時刻（端末の時刻で `2026/11/15 10:23`）.
 * @param {string} iso - ISO 8601
 * @returns {string} formatted time, or '' when it is not a date
 */
export const formatCsvTime = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return (
        `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ` +
        `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
    );
};

/**
 * The 「進み具合」 CSV: 出席番号・名前・課題クリア・できた数・チャレンジごと
 * （できた時刻か「前」か空）・得点（レッスンの点）. Rows in the given order.
 * @param {Array<object>} rows - progressTableRows (already sorted)
 * @param {object} rowsByMember - progressRowsByMember (for the times)
 * @param {object} ctx - lessonProgressContext
 * @param {Array<string>} challengeNames - column titles, in ctx.columns order
 * @returns {string} CSV text (BOM + CRLF)
 */
export const buildLessonProgressCsv = (rows, rowsByMember, ctx, challengeNames) => {
    const header = ['出席番号', '名前', '課題クリア', 'できた数', ...challengeNames, '得点'];
    const lines = rows.map((row) => {
        const records = (rowsByMember[row.memberId] && rowsByMember[row.memberId].challenges) || {};
        const cells = ctx.challengeIds.map((id) => {
            const kind = row.progress.cells[id];
            if (kind === CELL_KINDS.BEFORE) return '前';
            if (kind === CELL_KINDS.DONE) return formatCsvTime(records[id] && records[id].completedAt);
            return '';
        });
        return [
            pad2(row.seatNumber),
            (row.member && row.member.displayName) || '',
            row.progress.cleared ? '○' : '',
            row.progress.done,
            ...cells,
            computeLessonScore(ctx.lesson, row.progress.doneIds, ctx.course),
        ];
    });
    return csvLines([header, ...lines]);
};
