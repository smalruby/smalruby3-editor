/**
 * Lesson progress summaries for the teacher's other screens (EPIC #1592 /
 * #1603): the 「いまの課題の状況」 floating panel, the seat detail on the
 * right, the class screen's［授業］row, the 採点 (grading) screen and the
 * `提出状況.csv` columns.
 *
 * Every count reuses the #1602 functions of classroom-lesson-progress.js
 * (which reuse the student side's assignmentProgress), so these screens show
 * the same numbers as the seat colours and the 「進み具合」 tab: only the
 * assignment's current challenges that the course data knows are counted,
 * cleared seats are never 「止まっている」, ▶ / ! disappear an hour after the
 * seat's last send.
 *
 * Pure functions only: the time is passed in (`now`, ms epoch) and the course
 * is passed in (null when this version does not have it).
 */
import { submissionStatusLabel } from './classroom-download-utils.js';
import { DEFAULT_LESSON_TOTAL, computeLessonScore } from './classroom-lesson-settings.js';
import {
    CELL_KINDS,
    SEAT_STATES,
    columnTotals,
    lessonCsvCells,
    lessonProgressContext,
    progressRowsByMember,
    progressTableRows,
    seatMemberId,
    seatProgress,
    seatTile,
} from './classroom-lesson-progress.js';

/**
 * The panel's lesson part: per seat tiles (same colours as the members tab),
 * 「課題クリア N」, 「止まっている N」 and one bar per challenge.
 * @param {object} params - inputs
 * @param {Array<object>} params.members - members of the assignment
 * @param {?object} params.progressData - GET lesson-progress response
 * @param {number} params.studentCount - number of seats
 * @param {object} params.ctx - lessonProgressContext
 * @param {number} params.now - current time (ms epoch)
 * @returns {{tiles: Array<object>, cleared: number, joined: number, stuck: number,
 *   rowCount: number, bars: Array<object>}} summary
 */
export const panelLessonSummary = ({ members, progressData, studentCount, ctx, now }) => {
    const memberMap = {};
    for (const m of members || []) memberMap[m.memberId] = m;
    const rowsByMember = progressRowsByMember(progressData);
    const tiles = [];
    let cleared = 0;
    let joined = 0;
    let stuck = 0;
    for (let seatNumber = 1; seatNumber <= (studentCount || 0); seatNumber++) {
        const memberId = seatMemberId(seatNumber);
        const tile = seatTile(memberMap[memberId] || null, rowsByMember[memberId] || null, ctx, now);
        tiles.push(tile);
        if (tile.state === SEAT_STATES.NOT_JOINED) continue;
        joined += 1;
        if (tile.state === SEAT_STATES.CLEARED) cleared += 1;
        if (tile.progress.stuck) stuck += 1;
    }
    // The bars count the same rows as the 「できた人」 row of the progress tab.
    const rows = progressTableRows(members, rowsByMember, studentCount, ctx, now);
    const totals = columnTotals(rows, ctx);
    const bars = ctx.columns.map((column) => ({
        id: column.id,
        challenge: column.challenge,
        lessonIndex: column.lessonIndex,
        required: column.required,
        done: totals[column.id].done,
        current: totals[column.id].current,
    }));
    return { tiles, cleared, joined, stuck, rowCount: rows.length, bars };
};

/**
 * Bar widths in percent (done = green, on it now = blue), out of the rows
 * that are counted.
 * @param {{done: number, current: number}} bar - one bar of panelLessonSummary
 * @param {number} rowCount - rows counted (panelLessonSummary.rowCount)
 * @returns {{done: number, current: number}} widths (0–100, together at most 100)
 */
export const barWidths = (bar, rowCount) => {
    if (!rowCount) return { done: 0, current: 0 };
    const done = Math.min(100, (bar.done / rowCount) * 100);
    return { done, current: Math.min(100 - done, (bar.current / rowCount) * 100) };
};

/**
 * The seat detail (right panel): one row per challenge of the setting.
 * @param {?object} row - the seat's progress row (null when it sent nothing)
 * @param {object} ctx - lessonProgressContext
 * @param {number} now - current time (ms epoch)
 * @returns {{progress: object, rows: Array<object>}} progress (seatProgress) and rows
 *   `{id, challenge, lesson, lessonIndex, lessonStart, required, kind, completedAt, elapsedMs}`
 */
export const seatChallengeDetails = (row, ctx, now) => {
    const progress = seatProgress(row, ctx, now);
    const records = (row && row.challenges) || {};
    const rows = ctx.columns.map((column) => {
        const kind = progress.cells[column.id];
        const done = kind === CELL_KINDS.DONE || kind === CELL_KINDS.BEFORE;
        const onIt = kind === CELL_KINDS.CURRENT || kind === CELL_KINDS.STUCK;
        return {
            id: column.id,
            challenge: column.challenge,
            lesson: column.lesson,
            lessonIndex: column.lessonIndex,
            lessonStart: column.lessonStart,
            required: column.required,
            kind,
            completedAt: done && records[column.id] ? records[column.id].completedAt || null : null,
            elapsedMs: onIt ? progress.current.elapsedMs : null,
        };
    });
    return { progress, rows };
};

/**
 * Whether a time is on the same local day as now (the detail shows 「10:23」
 * for today and adds the date otherwise).
 * @param {string} iso - ISO 8601
 * @param {number} now - current time (ms epoch)
 * @returns {boolean} same local day
 */
export const isSameLocalDay = (iso, now) => {
    const a = new Date(iso);
    const b = new Date(now);
    if (Number.isNaN(a.getTime())) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

/**
 * Minutes on a challenge, as shown 「いまやっている（12 分）」 (rounded down).
 * @param {number} elapsedMs - time on the challenge
 * @returns {number} whole minutes
 */
export const elapsedMinutes = (elapsedMs) => Math.max(0, Math.floor((elapsedMs || 0) / 60000));

/**
 * 「課題クリア N」 of the class screen's［授業］row.
 * @param {object} params - inputs
 * @param {Array<object>} params.members - members of the assignment
 * @param {?object} params.progressData - GET lesson-progress response
 * @param {?object} params.course - the course of `progressData.lesson`
 * @param {number} params.studentCount - number of seats
 * @param {number} params.now - current time (ms epoch)
 * @returns {?number} cleared seats, or null when it cannot be counted (no lesson / unknown course)
 */
export const lessonClearedCount = ({ members, progressData, course, studentCount, now }) => {
    const ctx = progressData ? lessonProgressContext(progressData.lesson, course) : null;
    if (!ctx) return null;
    return panelLessonSummary({ members, progressData, studentCount, ctx, now }).cleared;
};

/**
 * The challenge columns of a CSV that holds several assignments
 * (`提出状況.csv`): every assignment's challenges, the first assignment's
 * order first, without repeats.
 * @param {Array<?object>} contexts - lessonProgressContext of each assignment (null = no lesson)
 * @returns {Array<{id: string, challenge: object}>} columns
 */
export const mergedChallengeColumns = (contexts) => {
    const seen = new Set();
    const columns = [];
    for (const ctx of contexts || []) {
        if (!ctx) continue;
        for (const column of ctx.columns) {
            if (seen.has(column.id)) continue;
            seen.add(column.id);
            columns.push({ id: column.id, challenge: column.challenge });
        }
    }
    return columns;
};

/**
 * レッスンの点 of every seat with a record, for the 採点 screen.
 * @param {?object} progressData - GET lesson-progress response
 * @param {?object} course - its course
 * @param {number} now - current time (ms epoch)
 * @returns {?{total: number, submitWork: boolean, scores: object}} seatNumber → score,
 *   or null when it cannot be scored (no lesson / unknown course)
 */
export const lessonScoresBySeat = (progressData, course, now) => {
    const ctx = progressData ? lessonProgressContext(progressData.lesson, course) : null;
    if (!ctx) return null;
    const scores = {};
    for (const row of progressData.progress || []) {
        if (!row || !Number.isInteger(row.seatNumber)) continue;
        scores[row.seatNumber] = computeLessonScore(ctx.lesson, seatProgress(row, ctx, now).doneIds, ctx.course);
    }
    const scoring = ctx.lesson.scoring;
    const total = scoring && Number.isFinite(scoring.total) ? scoring.total : DEFAULT_LESSON_TOTAL;
    return { total, submitWork: ctx.lesson.submitWork === true, scores };
};

/**
 * The `提出状況.csv` rows of one assignment: one per member (as before) with
 * the lesson cells, plus the seats whose last student left a progress record
 * but no submission (the 「進み具合」 tab shows them too).
 * @param {object} params - inputs
 * @param {string} params.assignmentName - assignment name
 * @param {Array<object>} params.members - enriched members (enrichMembers)
 * @param {?object} params.progressData - GET lesson-progress response (null = no lesson)
 * @param {?object} params.ctx - lessonProgressContext (null = no lesson / unknown course)
 * @param {number} params.now - current time (ms epoch)
 * @returns {Array<object>} rows for buildSubmissionsCsv
 */
export const submissionCsvRows = ({ assignmentName, members, progressData, ctx, now }) => {
    const rowsByMember = ctx ? progressRowsByMember(progressData) : {};
    const seen = new Set();
    const rows = (members || []).map((m) => {
        seen.add(m.memberId);
        return {
            assignmentName,
            seat: (m.memberId || '').replace('seat-', ''),
            name: m.displayName || '',
            projectName: m.projectName || '',
            submittedAt: m.submittedAt || '',
            status: submissionStatusLabel(m),
            lesson: ctx ? lessonCsvCells(rowsByMember[m.memberId] || null, ctx, now) : null,
        };
    });
    if (!ctx) return rows;
    for (const row of (progressData && progressData.progress) || []) {
        if (!row || !row.memberId || seen.has(row.memberId)) continue;
        rows.push({
            assignmentName,
            seat: row.memberId.replace('seat-', ''),
            name: '',
            projectName: '',
            submittedAt: '',
            status: submissionStatusLabel({}),
            lesson: lessonCsvCells(row, ctx, now),
        });
    }
    return rows.sort((a, b) => a.seat.localeCompare(b.seat));
};
