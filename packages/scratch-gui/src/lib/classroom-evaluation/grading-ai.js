/**
 * Pure helpers of the ［基準］ tab of an assignment's grading (EPIC #2421 / #2425).
 *
 * The rubric is built from a few representative works: the works are put into
 * groups by what they added to the starter (grouping.js — a fixed calculation,
 * so the same class always gives the same groups), one work per group (at most
 * 8) is shown to the teacher, the teacher gives it the right grade, the AI asks
 * about works of the same group that look different (`fairness`), and then
 * writes the S/A/B/C sentences (`rubric`). Grading everyone sends the rubric and
 * the teacher's examples, and each grade keeps the name of its group, so changing
 * one grade can ask whether to change the rest of the same group.
 *
 * Everything here is a plain function of its arguments: the request bodies of
 * `POST /classrooms/{id}/evaluate`, the `rubric` saved with `PUT .../grading`,
 * and the plan of a change to a whole group. No I/O.
 */
import { DEFAULT_RUBRIC_AXES } from './evaluation-utils.js';
import { GRADES } from './gradebook.js';
import { groupSubmissions, pickRepresentatives } from './grouping.js';
import { diffFromStarter } from './starter-diff.js';

/** Sizes the server accepts (`PUT /grading` refuses more with 400, it does not cut). */
const LIMITS = {
    code: 4000,
    reason: 300,
    group: 80,
    levelText: 500,
    pageText: 500,
    examples: 20,
    submissions: 10,
    fairnessGroups: 20,
    fairnessSubmissions: 20,
    representatives: 8,
    describeWorks: 5,
};

const UNCHANGED_CODE = '（スターターのまま）';

const cut = (text, max) => String(text || '').slice(0, max);

const isGrade = (value) => GRADES.includes(value);

/**
 * The submitted works of an assignment, each with what it added to the starter.
 * @param {object} args - what is loaded
 * @param {Array<number>} args.seats - the seats of the assignment
 * @param {Function} args.getCell - (seat) → loaded cell or null
 * @param {string} [args.starterPseudocode] - the starter's pseudocode ('' = none)
 * @returns {Array<{seatNumber: number, added: string[], code: string, pseudocode: string, signals: object}>} works
 */
const worksOf = ({ seats, getCell, starterPseudocode = '' }) => {
    const works = [];
    for (const seatNumber of seats || []) {
        const cell = getCell(seatNumber);
        // A work that could not be analyzed has no signals: it is not put into a group.
        if (!cell || !cell.submitted || !cell.signals) continue;
        const pseudocode = cell.pseudocode || '';
        const { added } = diffFromStarter(pseudocode, starterPseudocode || '');
        works.push({
            seatNumber,
            added,
            code: added.length > 0 ? added.join('\n\n') : UNCHANGED_CODE,
            pseudocode,
            signals: cell.signals || {},
        });
    }
    return works;
};

/**
 * The groups of the works and their representatives (one per group, at most 8).
 * @param {Array<object>} works - worksOf result
 * @param {{max: number}} [options] - at most `max` representatives
 * @returns {{groups: Array<object>, representatives: Array<object>}} groups (groupSubmissions) and
 *   representatives ({key, name, seatNumber, size, code, work})
 */
const representativesOf = (works, { max = LIMITS.representatives } = {}) => {
    const groups = groupSubmissions(works);
    const bySeat = new Map((works || []).map((w) => [w.seatNumber, w]));
    const representatives = pickRepresentatives(groups, { max }).map((pick) => ({
        ...pick,
        code: (bySeat.get(pick.seatNumber) || {}).code || '',
        work: bySeat.get(pick.seatNumber) || null,
    }));
    return { groups, representatives };
};

/**
 * Seat → name of its group.
 * @param {Array<{name: string, seatNumbers: number[]}>} groups - groupSubmissions result
 * @returns {object} "<seat>" → group name
 */
const groupNameBySeat = (groups) => {
    const map = {};
    for (const g of groups || []) {
        for (const seat of g.seatNumbers || []) map[String(seat)] = cut(g.name, LIMITS.group);
    }
    return map;
};

const submissionOf = (work) => ({
    seatNumber: work.seatNumber,
    signals: work.signals || {},
    pseudocode: work.pseudocode || '',
});

/**
 * The body of `describe`: guess the assignment's description from the starter and
 * a few works (the representatives, so different kinds of work are shown).
 * @param {object} args - inputs
 * @param {string} args.assignmentName - the assignment's name
 * @param {string} [args.starterPseudocode] - the starter
 * @param {Array<object>} args.works - works to show (worksOf items), in order of preference
 * @returns {?object} the request body, or null when there is no work
 */
const buildDescribeRequest = ({ assignmentName, starterPseudocode = '', works }) => {
    const chosen = (works || []).filter(Boolean).slice(0, LIMITS.describeWorks);
    if (chosen.length === 0) return null;
    return {
        mode: 'describe',
        assignmentName: assignmentName || '',
        ...(starterPseudocode ? { starterPseudocode } : {}),
        submissions: chosen.map(submissionOf),
    };
};

/**
 * The body of `grade` for the representatives only (the AI's proposal shown next
 * to the teacher's answer), or for a chunk of everyone.
 * @param {object} args - inputs
 * @param {string} args.assignmentName - the assignment's name
 * @param {string} [args.assignmentText] - the description
 * @param {string} [args.starterPseudocode] - the starter
 * @param {?object} [args.rubric] - the saved rubric ({levels, examples})
 * @param {Array<object>} args.works - the works to grade (at most 10)
 * @returns {object} the request body
 */
const buildGradeRequest = ({ assignmentName, assignmentText = '', starterPseudocode = '', rubric = null, works }) => {
    const levels = (rubric && rubric.levels) || [];
    const examples = (rubric && rubric.examples) || [];
    return {
        mode: 'grade',
        assignmentName: assignmentName || '',
        assignmentText: assignmentText || '',
        ...gradingCriteriaFor(rubric),
        samples: [],
        ...(starterPseudocode ? { starterPseudocode } : {}),
        ...(levels.length > 0 ? { rubricLevels: levels } : {}),
        ...(examples.length > 0 ? { examples: examples.slice(0, LIMITS.examples) } : {}),
        submissions: (works || []).slice(0, LIMITS.submissions).map(submissionOf),
    };
};

/**
 * The extra inputs of the full-class `grade` call: the starter (look at what was
 * added) and the seat → group map (each grade keeps its group).
 * @param {object} args - inputs
 * @param {string} [args.starterPseudocode] - the starter
 * @param {Array<object>} [args.groups] - groupSubmissions result
 * @returns {{payload: object, groupBySeat: object}} payload extras and the groups by seat
 */
const fullGradeExtras = ({ starterPseudocode = '', groups = [] }) => ({
    payload: starterPseudocode ? { starterPseudocode } : {},
    groupBySeat: groupNameBySeat(groups),
});

/**
 * The teacher's answers on the representatives as `rubric.examples`.
 * @param {Array<object>} representatives - representativesOf().representatives
 * @param {object} answers - "<seat>" → {grade, reason}
 * @returns {Array<{seatNumber: number, grade: string, reason: string, group: string, code: string}>} examples
 */
const examplesFromAnswers = (representatives, answers) =>
    (representatives || [])
        .filter((rep) => answers && answers[String(rep.seatNumber)] && isGrade(answers[String(rep.seatNumber)].grade))
        .map((rep) => {
            const answer = answers[String(rep.seatNumber)];
            return {
                seatNumber: rep.seatNumber,
                grade: answer.grade,
                reason: cut(answer.reason, LIMITS.reason),
                group: cut(rep.name, LIMITS.group),
                code: cut(rep.code, LIMITS.code),
            };
        })
        .slice(0, LIMITS.examples);

/**
 * The body of `fairness`: the teacher's examples and, per group, a few of the
 * other works (not the representative), at most 20 works in all — spread over the
 * groups in turn so a small group is not crowded out by a large one.
 * @param {object} args - inputs
 * @param {string} args.assignmentName - the assignment's name
 * @param {string} [args.assignmentText] - the description
 * @param {string} [args.starterPseudocode] - the starter
 * @param {Array<object>} [args.rubricLevels] - the draft levels
 * @param {Array<object>} args.examples - examplesFromAnswers result
 * @param {Array<object>} args.groups - groupSubmissions result
 * @param {Array<object>} args.works - worksOf result
 * @returns {?object} the request body, or null when there is nothing to compare
 */
const buildFairnessRequest = ({
    assignmentName,
    assignmentText = '',
    starterPseudocode = '',
    rubricLevels = [],
    examples,
    groups,
    works,
}) => {
    if (!examples || examples.length === 0) return null;
    const exampleSeats = new Set(examples.map((e) => e.seatNumber));
    const bySeat = new Map((works || []).map((w) => [w.seatNumber, w]));
    const list = (groups || []).slice(0, LIMITS.fairnessGroups).map((g) => ({
        name: cut(g.name, LIMITS.group),
        seatNumbers: g.seatNumbers.slice(0, 200),
        rest: g.seatNumbers.filter((s) => !exampleSeats.has(s) && bySeat.has(s)),
        submissions: [],
    }));
    let total = 0;
    let added = true;
    while (added && total < LIMITS.fairnessSubmissions) {
        added = false;
        for (const g of list) {
            if (total >= LIMITS.fairnessSubmissions) break;
            if (g.rest.length === 0) continue;
            const seat = g.rest.shift();
            g.submissions.push(submissionOf(bySeat.get(seat)));
            total++;
            added = true;
        }
    }
    if (total === 0) return null;
    return {
        mode: 'fairness',
        assignmentName: assignmentName || '',
        assignmentText: assignmentText || '',
        ...(starterPseudocode ? { starterPseudocode } : {}),
        ...(rubricLevels && rubricLevels.length > 0 ? { rubricLevels } : {}),
        examples: examples.slice(0, LIMITS.examples),
        groups: list.map(({ name, seatNumbers, submissions }) => ({ name, seatNumbers, submissions })),
    };
};

/**
 * The grade an answer of a fairness question gives, when it names exactly one:
 * 「20 番は A」 → 'A'. 「1 番と同じ B」 → 'B'. 「C のまま」 → 'C'.
 * @param {string} option - the chosen option
 * @returns {?string} S/A/B/C, or null when the option names none or several
 */
const gradeOfOption = (option) => {
    const found = String(option || '').match(/(?<![A-Za-z])[SABC](?![A-Za-z])/g) || [];
    const unique = [...new Set(found)];
    return unique.length === 1 ? unique[0] : null;
};

/**
 * Turn the teacher's answers to the fairness questions into more examples:
 * a question about one seat that is not an example yet, answered with an option
 * that names one grade, becomes an example of that seat. The other answers are
 * kept as notes for the rubric sentences.
 * @param {object} args - inputs
 * @param {Array<{question: string, options: string[], seatNumbers: number[]}>} args.checks - fairness checks
 * @param {object} args.answers - index of the check → chosen option text
 * @param {Array<object>} args.examples - current examples
 * @param {object} args.groupBySeat - "<seat>" → group name
 * @param {Array<object>} args.works - worksOf result
 * @returns {{examples: Array<object>, notes: string[]}} the examples (old + new) and notes
 */
const applyFairnessAnswers = ({ checks, answers, examples, groupBySeat, works }) => {
    const next = [...(examples || [])];
    const notes = [];
    const bySeat = new Map((works || []).map((w) => [w.seatNumber, w]));
    (checks || []).forEach((check, i) => {
        const option = answers ? answers[i] : null;
        if (typeof option !== 'string' || !option) return;
        notes.push(`${check.question} → ${option}`);
        const grade = gradeOfOption(option);
        const seats = check.seatNumbers || [];
        const others = seats.filter((s) => !next.some((e) => e.seatNumber === s));
        if (!grade || others.length !== 1 || next.length >= LIMITS.examples) return;
        const seat = others[0];
        const work = bySeat.get(seat);
        if (!work) return;
        next.push({
            seatNumber: seat,
            grade,
            reason: cut(`${check.question} → ${option}`, LIMITS.reason),
            group: cut((groupBySeat || {})[String(seat)] || '', LIMITS.group),
            code: cut(work.code, LIMITS.code),
        });
    });
    return { examples: next, notes };
};

/**
 * Levels in S → C order, one per grade, the text cut to the server's size.
 * Levels with an empty text are dropped.
 * @param {Array<{grade: string, text: string}>} levels - levels in any order
 * @returns {Array<{grade: string, text: string}>} the levels to save
 */
const normalizeLevels = (levels) => {
    const byGrade = {};
    for (const level of levels || []) {
        if (level && isGrade(level.grade) && !byGrade[level.grade]) {
            byGrade[level.grade] = cut(level.text, LIMITS.levelText).trim();
        }
    }
    return GRADES.filter((g) => byGrade[g]).map((grade) => ({ grade, text: byGrade[grade] }));
};

/**
 * The body of `rubric`: the S/A/B/C sentences from the examples. The answers to
 * the fairness questions go with the description (the server has no field for them).
 * @param {object} args - inputs
 * @param {string} args.assignmentName - the assignment's name
 * @param {string} [args.assignmentText] - the description
 * @param {string} [args.starterPseudocode] - the starter
 * @param {Array<object>} args.examples - examples (1..20)
 * @param {Array<object>} [args.levels] - the current levels (a draft to improve)
 * @param {string[]} [args.notes] - the teacher's answers to the fairness questions
 * @returns {?object} the request body, or null when there is no example
 */
const buildRubricRequest = ({
    assignmentName,
    assignmentText = '',
    starterPseudocode = '',
    examples,
    levels = [],
    notes = [],
}) => {
    if (!examples || examples.length === 0) return null;
    const current = normalizeLevels(levels);
    const noteText = notes.length > 0 ? `\n\n先生の判断:\n${notes.map((n) => `- ${n}`).join('\n')}` : '';
    return {
        mode: 'rubric',
        assignmentName: assignmentName || '',
        assignmentText: `${assignmentText || ''}${noteText}`.trim(),
        ...(starterPseudocode ? { starterPseudocode } : {}),
        ...(current.length > 0 ? { rubricLevels: current } : {}),
        examples: examples.slice(0, LIMITS.examples),
    };
};

/**
 * The levels to edit: one row per grade, filled from the saved levels.
 * @param {Array<object>} levels - saved levels
 * @returns {Array<{grade: string, text: string}>} four rows, S → C
 */
const editableLevels = (levels) => {
    const saved = normalizeLevels(levels);
    return GRADES.map((grade) => ({ grade, text: (saved.find((l) => l.grade === grade) || {}).text || '' }));
};

/**
 * The `rubric` to save with `PUT /grading`.
 * @param {Array<object>} levels - edited levels
 * @param {Array<object>} examples - the teacher's examples
 * @returns {{levels: Array<object>, examples: Array<object>}} the rubric
 */
const rubricToSave = (levels, examples) => ({
    levels: normalizeLevels(levels),
    examples: (examples || []).slice(0, LIMITS.examples).map((e) => ({
        seatNumber: e.seatNumber,
        grade: e.grade,
        reason: cut(e.reason, LIMITS.reason),
        group: cut(e.group, LIMITS.group),
        code: cut(e.code, LIMITS.code),
    })),
});

/**
 * The pages to send back with `PUT /assignment` to save a description into an
 * assignment that has none: the first page gets the text (images are kept by
 * their key), and an assignment without pages gets one page.
 * @param {?object} assignment - `assignment` of GET /assignment (pages with imageKey)
 * @param {string} description - the description to save
 * @returns {{pages: Array<object>, keepStarter?: boolean}} the request body
 */
const descriptionSaveRequest = (assignment, description) => {
    const text = cut(String(description || '').trim(), LIMITS.pageText);
    const pages = ((assignment && assignment.pages) || []).map((page) => ({
        text: page.text || '',
        ...(page.imageKey ? { imageKey: page.imageKey } : {}),
    }));
    if (pages.length === 0) pages.push({ text });
    else pages[0] = { ...pages[0], text };
    return { pages, ...(assignment && assignment.starterKey ? { keepStarter: true } : {}) };
};

/**
 * After everyone is graded, a grade changed by the teacher: the other seats of the
 * same group that still had the old grade, which can be changed too.
 * @param {object} args - the change
 * @param {number} args.seat - the seat changed
 * @param {string} args.from - the grade before
 * @param {string} args.to - the grade now
 * @param {object} args.groupBySeat - "<seat>" → group name
 * @param {Array<number>} args.seats - the seats of the assignment
 * @param {Function} args.gradeOf - (seat) → current grade or null
 * @returns {?{group: string, seats: number[], grade: string}} null when there is nothing to ask
 */
const groupChangePlan = ({ seat, from, to, groupBySeat, seats, gradeOf }) => {
    if (!isGrade(to) || from === to) return null;
    const group = (groupBySeat || {})[String(seat)];
    if (!group) return null;
    const others = (seats || []).filter(
        (s) => s !== seat && (groupBySeat || {})[String(s)] === group && gradeOf(s) === from && isGrade(from),
    );
    if (others.length === 0) return null;
    return { group, seats: others, grade: to };
};

/**
 * Whether the rubric step can be skipped: the assignment already has levels.
 * @param {?object} rubric - grading.rubric
 * @returns {boolean} true when there are levels
 */
const hasRubricLevels = (rubric) => !!(rubric && (rubric.levels || []).length > 0);

/**
 * The criteria sent with `grade` / `comment` (#2455 F2). The screen has no criteria or
 * strictness any more: with the S/A/B/C sentences, the sentences and the teacher's
 * examples grade, so no criteria are sent; without a rubric, the fixed criteria
 * (it runs, the assignment's requirements, extra ideas) are sent, because the API needs
 * 1 to 6 of them then. The API stays the same.
 * @param {?object} rubric - grading.rubric
 * @returns {{rubricAxes: Array<object>, strictness: string}} the criteria of the request
 */
const gradingCriteriaFor = (rubric) => ({
    rubricAxes: hasRubricLevels(rubric) ? [] : DEFAULT_RUBRIC_AXES,
    strictness: 'standard',
});

/** The inner steps of step 2 (make the rubric), in order (#2455 F1). */
const RUBRIC_STEP_IDS = ['describe', 'examples', 'fairness', 'sentences'];

/**
 * The state of each inner step of the［基準］tab (2-1 description → 2-2 the right grades of
 * the representatives → 2-3 fairness → 2-4 the sentences). A step is done by what it made,
 * not by the order, so a step done out of order stays done; the first one not done is the
 * current step ('now') and the others not done are 'todo'.
 * @param {object} args - what the tab has
 * @param {boolean} args.hasDescription - the assignment has a description (written or used)
 * @param {number} args.repsTotal - representatives
 * @param {number} args.repsDone - representatives with the teacher's grade
 * @param {?object} args.fairness - {checks, answers} after the fairness check (null = not run)
 * @param {boolean} args.saved - the sentences were saved
 * @returns {{describe: string, examples: string, fairness: string, sentences: string}} 'done' | 'now' | 'todo'
 */
const rubricStepStates = ({ hasDescription, repsTotal, repsDone, fairness, saved }) => {
    const checks = (fairness && fairness.checks) || [];
    const done = {
        describe: !!hasDescription,
        examples: repsTotal > 0 && repsDone >= repsTotal,
        fairness: !!fairness && checks.every((_, i) => !!(fairness.answers || {})[i]),
        sentences: !!saved,
    };
    const now = RUBRIC_STEP_IDS.find((id) => !done[id]);
    const states = {};
    for (const id of RUBRIC_STEP_IDS) states[id] = done[id] ? 'done' : id === now ? 'now' : 'todo';
    return states;
};

export {
    LIMITS,
    UNCHANGED_CODE,
    applyFairnessAnswers,
    buildDescribeRequest,
    buildFairnessRequest,
    buildGradeRequest,
    buildRubricRequest,
    descriptionSaveRequest,
    editableLevels,
    examplesFromAnswers,
    fullGradeExtras,
    gradeOfOption,
    gradingCriteriaFor,
    groupChangePlan,
    groupNameBySeat,
    hasRubricLevels,
    normalizeLevels,
    representativesOf,
    rubricStepStates,
    rubricToSave,
    worksOf,
};
