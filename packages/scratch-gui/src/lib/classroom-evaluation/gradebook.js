/**
 * Pure helpers of the gradebook and of the per-assignment grading (EPIC #2421 / #2424).
 *
 * The grading tab is a gradebook after Google Classroom's: a column per assignment
 * (the newest on the left), a row per seat, S/A/B/C in the cells. An assignment is
 * graded on its own screen; what is decided there is saved on the server as the
 * assignment's `grading`:
 *
 *     {rubric, grades: {"<seat>": {grade, reason, source: 'ai'|'teacher', group?, needsReview?}},
 *      confirmedAt, updatedAt}
 *
 * A grade the AI proposed is a draft until the teacher confirms the assignment
 * (`confirmedAt`); a grade the teacher set is the teacher's even before that.
 */

/** The grades from the best down (the order of the counts row and the buttons). */
const GRADES = ['S', 'A', 'B', 'C'];

const isGrade = (value) => GRADES.includes(value);
// The longest reason / group name the server saves (PUT /grading, #2422).
const MAX_REASON = 300;
const MAX_GROUP = 80;

const sortKeyOf = (assignment) => String((assignment && (assignment.sortDate || assignment.createdAt)) || '');

/**
 * The columns of the gradebook: the newest assignment on the left, like Google
 * Classroom. Assignments with the same date keep their order.
 * @param {Array<object>} assignments - [{classroomId, assignmentName, sortDate?, createdAt?}]
 * @returns {Array<object>} the same assignments, newest first
 */
const gradebookColumns = (assignments) =>
    (assignments || [])
        .map((assignment, index) => ({ assignment, index }))
        .sort((a, b) => sortKeyOf(b.assignment).localeCompare(sortKeyOf(a.assignment)) || a.index - b.index)
        .map(({ assignment }) => assignment);

/**
 * How many seats have each grade (the top row of the gradebook).
 * @param {?object} grades - `grading.grades` ("<seat>" → {grade})
 * @returns {{S: number, A: number, B: number, C: number}} the counts
 */
const gradeCounts = (grades) => {
    const counts = { S: 0, A: 0, B: 0, C: 0 };
    for (const entry of Object.values(grades || {})) {
        if (entry && isGrade(entry.grade)) counts[entry.grade]++;
    }
    return counts;
};

/**
 * Whether a saved grade is still the AI's draft: the AI proposed it and the
 * teacher has not confirmed the assignment yet. Drafts are drawn dashed and faint.
 * @param {?object} grading - the assignment's grading
 * @param {?object} entry - one entry of `grading.grades`
 * @returns {boolean} true for a draft
 */
const isDraftGrade = (grading, entry) => !!entry && entry.source !== 'teacher' && !(grading && grading.confirmedAt);

/**
 * What one gradebook cell shows.
 * @param {?object} grading - the assignment's grading (null = nothing saved)
 * @param {number} seat - seat number
 * @returns {?{grade: string, draft: boolean, needsReview: boolean}} null when the seat has no grade
 */
const gradebookCell = (grading, seat) => {
    const entry = grading && grading.grades ? grading.grades[String(seat)] : null;
    if (!entry || !isGrade(entry.grade)) return null;
    return { grade: entry.grade, draft: isDraftGrade(grading, entry), needsReview: entry.needsReview === true };
};

/**
 * The rows of the gradebook: every seat that has a grade in any assignment.
 * @param {object} gradings - classroomId → grading (null / undefined = none)
 * @returns {Array<number>} seat numbers, ascending
 */
const gradebookSeats = (gradings) => {
    const seats = new Set();
    for (const grading of Object.values(gradings || {})) {
        for (const [seat, entry] of Object.entries((grading && grading.grades) || {})) {
            const n = parseInt(seat, 10);
            if (Number.isFinite(n) && entry && isGrade(entry.grade)) seats.add(n);
        }
    }
    return [...seats].sort((a, b) => a - b);
};

/**
 * The state shown above a column's name.
 * - 'none': nothing graded yet
 * - 'draft': graded but not confirmed (`drafts` = grades the AI proposed)
 * - 'confirmed': the teacher confirmed the grades
 * @param {?object} grading - the assignment's grading
 * @returns {{kind: 'none'|'draft'|'confirmed', graded: number, drafts: number, hasRubric: boolean}} the state
 */
const columnStatus = (grading) => {
    const entries = Object.values((grading && grading.grades) || {}).filter((e) => e && isGrade(e.grade));
    const hasRubric = !!(grading && grading.rubric && (grading.rubric.levels || []).length > 0);
    if (entries.length === 0) return { kind: 'none', graded: 0, drafts: 0, hasRubric };
    const drafts = entries.filter((e) => isDraftGrade(grading, e)).length;
    return { kind: grading.confirmedAt ? 'confirmed' : 'draft', graded: entries.length, drafts, hasRubric };
};

/**
 * The `grades` to save from the grading table of one assignment. A cell the
 * teacher changed the grade of is the teacher's (`source: 'teacher'`); the others
 * are the AI's. The まとまり (`group`) is the cell's group of works (`groupName`, from
 * what was added to the starter); without one, the saved group is kept.
 * @param {object} matrix - `${seat}:${classroomId}` → cell
 * @param {string} classroomId - the assignment
 * @param {?object} [saved] - the saved `grading.grades`, to keep `group`
 * @returns {object} "<seat>" → {grade, reason, source, needsReview?, group?}
 */
const gradesFromMatrix = (matrix, classroomId, saved = null) => {
    const grades = {};
    const suffix = `:${classroomId}`;
    for (const [key, cell] of Object.entries(matrix || {})) {
        if (!key.endsWith(suffix) || !cell || !cell.submitted || !isGrade(cell.grade)) continue;
        const seat = key.slice(0, key.length - suffix.length);
        const entry = {
            grade: cell.grade,
            // The server takes up to 300 characters of reason and 80 of group (#2422).
            reason: (cell.reason || '').slice(0, MAX_REASON),
            source: cell.gradeEdited ? 'teacher' : 'ai',
        };
        if (cell.needsReview) entry.needsReview = true;
        const before = saved ? saved[seat] : null;
        if (cell.groupName) entry.group = cell.groupName.slice(0, MAX_GROUP);
        else if (before && 'group' in before) entry.group = before.group;
        grades[seat] = entry;
    }
    return grades;
};

/**
 * Put a saved grade into a cell just loaded from the submissions, so a grading
 * closed as a draft comes back as it was. A grade the teacher set stays the
 * teacher's (the AI does not grade it again, and it calibrates the AI).
 * @param {object} cell - the loaded cell (no grade yet)
 * @param {?object} saved - one entry of `grading.grades`
 * @returns {object} the cell with the saved grade
 */
const withSavedGrade = (cell, saved) => {
    if (!saved || !isGrade(saved.grade)) return cell;
    const teacher = saved.source === 'teacher';
    return {
        ...cell,
        grade: saved.grade,
        reason: saved.reason || '',
        needsReview: saved.needsReview === true,
        manual: teacher,
        gradeEdited: teacher,
    };
};

/**
 * Whether two `grades` maps say the same (nothing to save).
 * @param {?object} a - grades
 * @param {?object} b - grades
 * @returns {boolean} true when equal
 */
const sameGrades = (a, b) => {
    const left = a || {};
    const right = b || {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
        const x = left[key];
        const y = right[key];
        if (!x || !y) return false;
        if (
            x.grade !== y.grade ||
            (x.reason || '') !== (y.reason || '') ||
            x.source !== y.source ||
            !!x.needsReview !== !!y.needsReview
        ) {
            return false;
        }
    }
    return true;
};

/**
 * The counts at the top of the assignment's grading (Google Classroom's
 * 「生徒の提出物」): seats that did not submit, AI drafts, confirmed grades and
 * returned works.
 * @param {object} args - what is known
 * @param {Array<number>} args.seats - the seats of the assignment
 * @param {Function} args.getCell - (seat) → loaded cell or null
 * @param {?object} args.grading - the assignment's grading
 * @param {boolean} args.loaded - the submissions are loaded (before that, who did not submit is unknown)
 * @returns {{notSubmitted: ?number, drafts: number, confirmed: number, returned: number}} the counts
 */
const assignmentCounts = ({ seats, getCell, grading, loaded }) => {
    const confirmed = !!(grading && grading.confirmedAt);
    if (!loaded) {
        const status = columnStatus(grading);
        return {
            notSubmitted: null,
            drafts: status.drafts,
            confirmed: confirmed ? status.graded : 0,
            returned: 0,
        };
    }
    const counts = { notSubmitted: 0, drafts: 0, confirmed: 0, returned: 0 };
    for (const seat of seats || []) {
        const cell = getCell(seat);
        if (!cell || !cell.submitted) {
            counts.notSubmitted++;
            continue;
        }
        if (cell.returned) counts.returned++;
        if (!isGrade(cell.grade)) continue;
        if (confirmed) counts.confirmed++;
        else if (!cell.gradeEdited) counts.drafts++;
    }
    return counts;
};

/**
 * Which step of the assignment's grading the teacher is on (only it is the primary
 * button, R2): 1 load the submissions → 2 make the rubric → 3 grade everyone →
 * 4 confirm → 5 draft comments → 6 return.
 * - The rubric step is done when the assignment has a rubric, or the teacher has
 *   looked at it (it can be skipped: the AI then grades with the criteria).
 * - Drafting comments before grading is still a shortcut: with drafts, the step is 6.
 * @param {object} state - what has been done
 * @param {boolean} state.loaded - submissions loaded
 * @param {boolean} state.rubricDone - there is a rubric, or the teacher looked at the rubric step
 * @param {boolean} state.hasGrades - a submitted seat has a grade
 * @param {boolean} state.confirmed - the grades are confirmed
 * @param {boolean} state.hasComments - a comment draft is written
 * @returns {'load'|'rubric'|'grade'|'confirm'|'comment'|'return'} the current step
 */
const currentGradingStep = ({ loaded, rubricDone, hasGrades, confirmed, hasComments }) => {
    if (!loaded) return 'load';
    if (hasComments) return 'return';
    if (!hasGrades) return rubricDone ? 'grade' : 'rubric';
    return confirmed ? 'comment' : 'confirm';
};

/**
 * The assignment's description given to the AI: the text of its pages.
 * @param {?object} data - the response of GET /classrooms/{id}/assignment
 * @returns {string} the text (empty when there is none)
 */
const assignmentTextOf = (data) => {
    const pages = (data && data.assignment && data.assignment.pages) || [];
    return pages
        .map((page) => ((page && page.text) || '').trim())
        .filter(Boolean)
        .join('\n');
};

/**
 * Whether leaving would lose comment drafts: a draft not returned, or one edited
 * after it was returned. Grades are not counted: they are saved on the server.
 * @param {object} matrix - `${seat}:${classroomId}` → cell
 * @param {object} comments - `${seat}:${classroomId}` → comment draft
 * @returns {boolean} true when a comment would be lost
 */
const hasUnreturnedComments = (matrix, comments) =>
    Object.entries(comments || {}).some(([key, text]) => {
        const comment = (text || '').trim();
        if (!comment) return false;
        const cell = (matrix || {})[key];
        return !(cell && cell.returned && cell.returnedComment === comment);
    });

export {
    GRADES,
    assignmentCounts,
    assignmentTextOf,
    columnStatus,
    currentGradingStep,
    gradeCounts,
    gradebookCell,
    gradebookColumns,
    gradebookSeats,
    gradesFromMatrix,
    hasUnreturnedComments,
    isDraftGrade,
    sameGrades,
    withSavedGrade,
};
