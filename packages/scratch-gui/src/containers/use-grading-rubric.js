/**
 * The ［基準］ tab of an assignment's grading (teacher side, EPIC #2421 / #2425).
 *
 * Used inside `useTeacherEvaluation`, which owns the table (matrix), the saved
 * gradings and the delayed grade saves. This hook adds what the rubric needs:
 *
 * - the starter's pseudocode (read once per assignment from GET /assignment), so
 *   works are compared with what the teacher handed out;
 * - the groups and representatives (grading-ai.js / grouping.js: a fixed
 *   calculation from the works, so they are the same every time);
 * - the AI calls of the tab: `describe` (when the description is empty), `grade`
 *   on the representatives (the AI's proposal next to the teacher's answer),
 *   `fairness` and `rubric`;
 * - saving the rubric (`PUT /grading` with `rubric` only), copying one from another
 *   assignment, and saving the description into the assignment (`PUT /assignment`
 *   with the pages read just before, images kept by key);
 * - after everyone is graded, changing one grade asks whether to change the rest of
 *   the same group (`groupPrompt`).
 *
 * Its state is per assignment (classroomId → state) so going back to the
 * gradebook and opening another assignment keeps it.
 */
import JSZip from 'jszip';
import { useCallback, useMemo, useRef, useState } from 'react';
import { defineMessages } from 'react-intl';
import classroomAPI from '../lib/classroom-api.js';
import {
    applyFairnessAnswers,
    buildDescribeRequest,
    buildFairnessRequest,
    buildGradeRequest,
    buildRubricRequest,
    descriptionSaveRequest,
    editableLevels,
    examplesFromAnswers,
    fullGradeExtras,
    groupChangePlan,
    representativesOf,
    rubricToSave,
    worksOf,
} from '../lib/classroom-evaluation/grading-ai.js';
import { analyzeProject } from '../lib/classroom-evaluation/sb3-analyzer.js';
import translateError from './classroom-error-utils.js';

const rubricHookMessages = defineMessages({
    rubricSaveFailed: {
        defaultMessage: 'The rubric could not be saved. Please try again.',
        description: 'Assignment grading: saving the rubric failed (#2425)',
        id: 'gui.classroom.gradingRubric.saveFailed',
    },
    descriptionSaveFailed: {
        defaultMessage: 'The description could not be saved to the assignment. It is used for this grading only.',
        description: 'Assignment grading: saving the guessed description into the assignment failed (#2425)',
        id: 'gui.classroom.gradingRubric.descriptionSaveFailed',
    },
});

const EMPTY_STATE = Object.freeze({
    starter: null, // null = not read | {status: 'loading'|'ready'|'none'|'failed', pseudocode, assignment}
    description: null, // {status: 'running'|'proposed'|'failed', text}
    answers: null, // "<seat>" → {grade, reason}; null = not started (taken from the saved rubric)
    proposals: {}, // "<seat>" → {grade, reason}
    fairness: null, // {checks, answers: {index: option}}
    levels: null, // edited levels; null = from the saved rubric
    extraExamples: null, // examples added by the fairness answers
    notes: [],
    running: null, // 'starter' | 'describe' | 'propose' | 'fairness' | 'rubric' | 'save' | 'copy' | 'saveDescription'
    savedAt: null,
});

const cellKey = (seatNumber, classroomId) => `${seatNumber}:${classroomId}`;

/**
 * @param {object} params - dependencies (from useTeacherEvaluation)
 * @param {object} params.idTokenRef - ref to the teacher's current ID token
 * @param {?object} params.lesson - the open assignment (evalLessons item)
 * @param {Array<number>} params.seats - its seats
 * @param {object} params.matrix - the table (`${seat}:${classroomId}` → cell)
 * @param {object} params.matrixRef - ref to the latest table
 * @param {object} params.gradings - classroomId → saved grading
 * @param {Function} params.setGradings - setter of gradings
 * @param {Function} params.setMatrix - setter of the table
 * @param {Function} params.setEvalLessons - setter of the assignments (to keep a description)
 * @param {Function} params.gradesChanged - (classroomId) → schedule the grade save
 * @param {Array<object>} params.rubricAxes - the AI's criteria when there is no rubric
 * @param {string} params.strictness - lenient | standard | strict
 * @param {Array<object>} [params.classrooms] - every assignment of the teacher (copy source)
 * @param {Array<object>} [params.groups] - the teacher's classes (labels of the copy source)
 * @param {Function} params.handleTeacher401 - 401 handler
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {?Function} [params.noteQuota] - (quota) → keep today's AI calls from an evaluate answer
 * @returns {object} the rubric state and handlers
 */
const useGradingRubric = ({
    idTokenRef,
    lesson,
    seats,
    matrix,
    matrixRef,
    gradings,
    setGradings,
    setMatrix,
    setEvalLessons,
    gradesChanged,
    rubricAxes,
    strictness,
    classrooms = [],
    groups: classGroups = [],
    handleTeacher401,
    showError,
    intl,
    noteQuota = null,
}) => {
    const [byId, setById] = useState({});
    const [groupPrompt, setGroupPrompt] = useState(null);
    const byIdRef = useRef(byId);
    byIdRef.current = byId;
    const id = lesson ? lesson.classroomId : null;
    const state = (id && byId[id]) || EMPTY_STATE;
    const grading = (id && gradings[id]) || null;
    const savedRubric = (grading && grading.rubric) || null;

    const update = useCallback((classroomId, patch) => {
        setById((prev) => {
            const before = prev[classroomId] || EMPTY_STATE;
            const next = typeof patch === 'function' ? patch(before) : patch;
            return { ...prev, [classroomId]: { ...before, ...next } };
        });
    }, []);

    const fail = useCallback(
        (err) => {
            if (err && err.status === 401) handleTeacher401();
            else showError(translateError(intl, err));
        },
        [handleTeacher401, showError, intl],
    );

    const loaded = !!id && seats.some((seat) => matrix[cellKey(seat, id)]);
    // Loading the submissions (useTeacherEvaluation) reads the starter too; this hook
    // reads it itself only when that did not happen.
    const lessonStarter = lesson && typeof lesson.starterPseudocode === 'string' ? lesson.starterPseudocode : null;
    const starterPseudocode =
        lessonStarter === null ? (state.starter && state.starter.pseudocode) || '' : lessonStarter;
    const works = useMemo(
        () =>
            id && loaded
                ? worksOf({ seats, getCell: (seat) => matrix[cellKey(seat, id)] || null, starterPseudocode })
                : [],
        [id, loaded, seats, matrix, starterPseudocode],
    );
    const { groups, representatives } = useMemo(() => representativesOf(works), [works]);
    const extras = useMemo(() => {
        const computed = fullGradeExtras({ starterPseudocode, groups });
        // The group the table saves with each grade (cell.groupName) wins, so the question
        // after a change names the same group as the table.
        const groupBySeat = { ...computed.groupBySeat };
        for (const seat of seats) {
            const cell = id ? matrix[cellKey(seat, id)] : null;
            if (cell && cell.groupName) groupBySeat[String(seat)] = cell.groupName;
        }
        return { payload: computed.payload, groupBySeat };
    }, [starterPseudocode, groups, seats, matrix, id]);

    /** Read the starter (and the pages, to save a description later). Once per assignment. */
    const loadStarter = useCallback(async () => {
        if (!lesson) return;
        const classroomId = lesson.classroomId;
        const current = byIdRef.current[classroomId];
        if (current && current.starter && current.starter.status !== 'failed') return;
        if (typeof lesson.starterPseudocode === 'string') {
            update(classroomId, {
                starter: { status: lesson.starterPseudocode ? 'ready' : 'none', pseudocode: '', assignment: null },
            });
            return;
        }
        update(classroomId, { starter: { status: 'loading', pseudocode: '', assignment: null }, running: 'starter' });
        try {
            const data = await classroomAPI.getAssignment(idTokenRef.current, classroomId);
            const assignment = (data && data.assignment) || null;
            let pseudocode = '';
            if (assignment && assignment.starterUrl) {
                const response = await fetch(assignment.starterUrl);
                if (!response.ok) throw new Error(`download ${response.status}`);
                const zip = await JSZip.loadAsync(await response.arrayBuffer());
                const file = zip.file('project.json');
                if (file) pseudocode = analyzeProject(JSON.parse(await file.async('string'))).pseudocode || '';
            }
            update(classroomId, {
                starter: { status: assignment && assignment.starterUrl ? 'ready' : 'none', pseudocode, assignment },
                running: null,
            });
        } catch (err) {
            // Without the starter the works are compared as they are (everything counts as added).
            update(classroomId, { starter: { status: 'failed', pseudocode: '', assignment: null }, running: null });
            if (err && err.status === 401) handleTeacher401();
        }
    }, [lesson, idTokenRef, update, handleTeacher401]);

    const evaluate = useCallback(
        async (payload) => {
            const data = await classroomAPI.evaluateSubmissions(idTokenRef.current, id, payload);
            // Every AI call counts: the screen's 「今日の AI の残り」 follows the answer (#2448).
            if (noteQuota) noteQuota(data && data.quota);
            return data;
        },
        [idTokenRef, id, noteQuota],
    );

    /** 1. The description is empty: the AI guesses it from the starter and a few works. */
    const handleDescribe = useCallback(async () => {
        if (!lesson) return;
        const classroomId = lesson.classroomId;
        const repWorks = representatives.map((r) => r.work).filter((w) => w && w.added.length > 0);
        const payload = buildDescribeRequest({
            assignmentName: lesson.assignmentName,
            starterPseudocode,
            works: repWorks.length > 0 ? repWorks : works,
        });
        if (!payload) return;
        update(classroomId, { running: 'describe', description: { status: 'running', text: '' } });
        try {
            const data = await evaluate(payload);
            update(classroomId, {
                running: null,
                description: { status: 'proposed', text: (data && data.description) || '' },
            });
        } catch (err) {
            update(classroomId, { running: null, description: { status: 'failed', text: '' } });
            fail(err);
        }
    }, [lesson, representatives, works, starterPseudocode, update, evaluate, fail]);

    const setLessonText = useCallback(
        (classroomId, text) =>
            setEvalLessons((prev) =>
                prev.map((l) => (l.classroomId === classroomId ? { ...l, assignmentText: text } : l)),
            ),
        [setEvalLessons],
    );

    /**
     * Use the description: `save` = also save it into the assignment (the students see it).
     * @param {string} text - the description (as proposed or as edited)
     * @param {boolean} save - save it into the assignment too
     */
    const handleUseDescription = useCallback(
        async (text, save) => {
            if (!lesson) return;
            const classroomId = lesson.classroomId;
            const value = String(text || '').trim();
            if (!value) return;
            setLessonText(classroomId, value);
            update(classroomId, { description: { status: save ? 'saving' : 'used', text: value } });
            if (!save) return;
            update(classroomId, { running: 'saveDescription' });
            try {
                // Read the pages again just before (a stale imageKey would delete a replaced image).
                const data = await classroomAPI.getAssignment(idTokenRef.current, classroomId);
                const body = descriptionSaveRequest((data && data.assignment) || null, value);
                await classroomAPI.setAssignment(idTokenRef.current, classroomId, body);
                update(classroomId, { running: null, description: { status: 'saved', text: value } });
            } catch (err) {
                update(classroomId, { running: null, description: { status: 'used', text: value } });
                if (err && err.status === 401) handleTeacher401();
                else showError(intl.formatMessage(rubricHookMessages.descriptionSaveFailed));
            }
        },
        [lesson, idTokenRef, update, setLessonText, handleTeacher401, showError, intl],
    );

    // The teacher's answers: the edited ones, else the saved examples.
    const answers = useMemo(() => {
        if (state.answers) return state.answers;
        const fromSaved = {};
        for (const e of (savedRubric && savedRubric.examples) || []) {
            fromSaved[String(e.seatNumber)] = { grade: e.grade, reason: e.reason || '' };
        }
        return fromSaved;
    }, [state.answers, savedRubric]);
    const levels = useMemo(
        () => state.levels || editableLevels((savedRubric && savedRubric.levels) || []),
        [state.levels, savedRubric],
    );
    const examples = useMemo(() => {
        const base = examplesFromAnswers(representatives, answers);
        const extra = (state.extraExamples || []).filter((e) => !base.some((b) => b.seatNumber === e.seatNumber));
        // Examples saved for seats that are not a representative now (another load) are kept.
        const saved = ((savedRubric && savedRubric.examples) || []).filter(
            (e) =>
                !state.answers &&
                !base.some((b) => b.seatNumber === e.seatNumber) &&
                !extra.some((x) => x.seatNumber === e.seatNumber),
        );
        return [...base, ...extra, ...saved].slice(0, 20);
    }, [representatives, answers, state.extraExamples, state.answers, savedRubric]);

    /**
     * 2. The teacher's grade / reason of a representative.
     * @param {number} seat - the representative's seat
     * @param {object} patch - {grade?, reason?}
     */
    const handleSetAnswer = useCallback(
        (seat, patch) => {
            if (!id) return;
            update(id, (before) => {
                const current = before.answers || answers;
                const key = String(seat);
                return { answers: { ...current, [key]: { grade: null, reason: '', ...current[key], ...patch } } };
            });
        },
        [id, update, answers],
    );

    /** 2. The AI's proposal for each representative. */
    const handlePropose = useCallback(async () => {
        if (!lesson || representatives.length === 0) return;
        const classroomId = lesson.classroomId;
        update(classroomId, { running: 'propose' });
        try {
            const data = await evaluate(
                buildGradeRequest({
                    assignmentName: lesson.assignmentName,
                    assignmentText: lesson.assignmentText || '',
                    starterPseudocode,
                    rubric: savedRubric,
                    rubricAxes,
                    strictness,
                    works: representatives.map((r) => r.work).filter(Boolean),
                }),
            );
            const proposals = {};
            for (const r of (data && data.results) || []) {
                proposals[String(r.seatNumber)] = { grade: r.grade, reason: r.reason || '' };
            }
            update(classroomId, { running: null, proposals });
        } catch (err) {
            update(classroomId, { running: null });
            fail(err);
        }
    }, [lesson, representatives, starterPseudocode, savedRubric, rubricAxes, strictness, update, evaluate, fail]);

    /** 3. Fairness: the AI compares the answers with the other works of each group. */
    const handleCheckFairness = useCallback(async () => {
        if (!lesson) return;
        const classroomId = lesson.classroomId;
        const payload = buildFairnessRequest({
            assignmentName: lesson.assignmentName,
            assignmentText: lesson.assignmentText || '',
            starterPseudocode,
            rubricLevels: levels.filter((l) => l.text.trim()),
            examples: examplesFromAnswers(representatives, answers),
            groups,
            works,
        });
        if (!payload) {
            update(classroomId, { fairness: { checks: [], answers: {} } });
            return;
        }
        update(classroomId, { running: 'fairness' });
        try {
            const data = await evaluate(payload);
            update(classroomId, { running: null, fairness: { checks: (data && data.checks) || [], answers: {} } });
        } catch (err) {
            update(classroomId, { running: null });
            fail(err);
        }
    }, [lesson, starterPseudocode, levels, representatives, answers, groups, works, update, evaluate, fail]);

    /**
     * 3. The teacher answers a fairness question.
     * @param {number} index - the question
     * @param {string} option - the chosen option
     */
    const handleAnswerFairness = useCallback(
        (index, option) => {
            if (!id) return;
            update(id, (before) => {
                const fairness = before.fairness || { checks: [], answers: {} };
                const nextAnswers = { ...fairness.answers, [index]: option };
                const applied = applyFairnessAnswers({
                    checks: fairness.checks,
                    answers: nextAnswers,
                    examples: examplesFromAnswers(representatives, answers),
                    groupBySeat: extras.groupBySeat,
                    works,
                });
                const base = examplesFromAnswers(representatives, answers);
                return {
                    fairness: { ...fairness, answers: nextAnswers },
                    extraExamples: applied.examples.slice(base.length),
                    notes: applied.notes,
                };
            });
        },
        [id, update, representatives, answers, extras, works],
    );

    /** 4. The AI writes the S/A/B/C sentences from the answers. */
    const handleDraftRubric = useCallback(async () => {
        if (!lesson) return;
        const classroomId = lesson.classroomId;
        const payload = buildRubricRequest({
            assignmentName: lesson.assignmentName,
            assignmentText: lesson.assignmentText || '',
            starterPseudocode,
            examples,
            levels: levels.filter((l) => l.text.trim()),
            notes: state.notes || [],
        });
        if (!payload) return;
        update(classroomId, { running: 'rubric' });
        try {
            const data = await evaluate(payload);
            update(classroomId, { running: null, levels: editableLevels((data && data.levels) || []) });
        } catch (err) {
            update(classroomId, { running: null });
            fail(err);
        }
    }, [lesson, starterPseudocode, examples, levels, state.notes, update, evaluate, fail]);

    /**
     * 4. Edit one sentence.
     * @param {string} grade - S/A/B/C
     * @param {string} text - the sentence
     */
    const handleSetLevel = useCallback(
        (grade, text) => {
            if (!id) return;
            update(id, { levels: levels.map((l) => (l.grade === grade ? { ...l, text } : l)) });
        },
        [id, update, levels],
    );

    const putRubric = useCallback(
        async (classroomId, rubric) => {
            const data = await classroomAPI.putGrading(idTokenRef.current, classroomId, { rubric });
            setGradings((prev) => ({
                ...prev,
                [classroomId]: (data && data.grading) || { ...(prev[classroomId] || {}), rubric },
            }));
        },
        [idTokenRef, setGradings],
    );

    /** 4. Save the sentences and the examples to the assignment's grading. */
    const handleSaveRubric = useCallback(async () => {
        if (!lesson) return false;
        const classroomId = lesson.classroomId;
        const rubric = rubricToSave(levels, examples);
        update(classroomId, { running: 'save' });
        try {
            await putRubric(classroomId, rubric);
            update(classroomId, { running: null, levels: null, answers: null, savedAt: Date.now() });
            return true;
        } catch (err) {
            update(classroomId, { running: null });
            if (err && err.status === 401) handleTeacher401();
            else showError(intl.formatMessage(rubricHookMessages.rubricSaveFailed));
            return false;
        }
    }, [lesson, levels, examples, update, putRubric, handleTeacher401, showError, intl]);

    // 5. Copy from another assignment: every other assignment of the teacher, by class.
    const copyClasses = useMemo(() => {
        const labelOf = (groupId, fallback) => {
            const g = (classGroups || []).find((x) => x.groupId === groupId);
            if (g) return g.section ? `${g.name} ${g.year}年度 / ${g.section}` : `${g.name} ${g.year}年度`;
            return fallback || groupId || '';
        };
        const map = new Map();
        for (const c of classrooms || []) {
            if (!c || !c.classroomId || (id && c.classroomId === id)) continue;
            const key = c.groupId || `class:${c.className || ''}`;
            if (!map.has(key)) map.set(key, { key, label: labelOf(c.groupId, c.className), assignments: [] });
            map.get(key).assignments.push({ classroomId: c.classroomId, assignmentName: c.assignmentName || '' });
        }
        return [...map.values()];
    }, [classrooms, classGroups, id]);

    /**
     * 5. Read the rubric of another assignment (shown before copying).
     * @param {string} sourceId - the other assignment
     * @returns {Promise<?object>} its rubric, or null when it has none
     */
    const handleReadCopySource = useCallback(
        async (sourceId) => {
            try {
                const data = await classroomAPI.getGrading(idTokenRef.current, sourceId);
                const rubric = data && data.grading && data.grading.rubric;
                return rubric && ((rubric.levels || []).length > 0 || (rubric.examples || []).length > 0)
                    ? rubric
                    : null;
            } catch (err) {
                fail(err);
                return null;
            }
        },
        [idTokenRef, fail],
    );

    /**
     * 5. Copy the rubric (it replaces this assignment's rubric).
     * @param {object} rubric - the rubric read with handleReadCopySource
     * @returns {Promise<boolean>} true when copied
     */
    const handleCopyRubric = useCallback(
        async (rubric) => {
            if (!lesson || !rubric) return false;
            const classroomId = lesson.classroomId;
            update(classroomId, { running: 'copy' });
            try {
                await putRubric(classroomId, rubricToSave(rubric.levels || [], rubric.examples || []));
                update(classroomId, { running: null, levels: null, answers: null, extraExamples: null });
                return true;
            } catch (err) {
                update(classroomId, { running: null });
                if (err && err.status === 401) handleTeacher401();
                else showError(intl.formatMessage(rubricHookMessages.rubricSaveFailed));
                return false;
            }
        },
        [lesson, update, putRubric, handleTeacher401, showError, intl],
    );

    /**
     * 6. A grade was changed by the teacher: ask about the rest of the same group.
     * Called by useTeacherEvaluation's handleSetCellGrade.
     * @param {number} seat - the seat changed
     * @param {string} classroomId - the assignment
     * @param {?string} from - the grade before
     * @param {?string} to - the grade now
     */
    const noteGradeChange = useCallback(
        (seat, classroomId, from, to) => {
            if (classroomId !== id) return;
            const plan = groupChangePlan({
                seat,
                from,
                to,
                groupBySeat: extras.groupBySeat,
                seats,
                gradeOf: (s) => {
                    const cell = matrixRef.current[cellKey(s, classroomId)];
                    return cell && cell.submitted ? cell.grade : null;
                },
            });
            setGroupPrompt(plan ? { ...plan, classroomId, seat } : null);
        },
        [id, extras, seats, matrixRef],
    );

    /** 6. Change the rest of the group too. */
    const handleApplyGroupChange = useCallback(() => {
        const prompt = groupPrompt;
        setGroupPrompt(null);
        if (!prompt) return;
        setMatrix((prev) => {
            const next = { ...prev };
            for (const s of prompt.seats) {
                const key = cellKey(s, prompt.classroomId);
                if (!next[key]) continue;
                next[key] = {
                    ...next[key],
                    grade: prompt.grade,
                    needsReview: false,
                    reviewReason: null,
                    manual: true,
                    gradeEdited: true,
                };
            }
            return next;
        });
        gradesChanged(prompt.classroomId);
    }, [groupPrompt, setMatrix, gradesChanged]);
    const handleDismissGroupChange = useCallback(() => setGroupPrompt(null), []);

    return {
        classroomId: id,
        loaded,
        starter: state.starter,
        starterPseudocode,
        description: state.description,
        works,
        groups,
        representatives,
        groupBySeat: extras.groupBySeat,
        gradeExtras: extras.payload,
        answers,
        proposals: state.proposals || {},
        fairness: state.fairness,
        levels,
        examples,
        savedRubric,
        running: state.running,
        savedAt: state.savedAt,
        copyClasses,
        groupPrompt: groupPrompt && groupPrompt.classroomId === id ? groupPrompt : null,
        loadStarter,
        handleDescribe,
        handleUseDescription,
        handleSetAnswer,
        handlePropose,
        handleCheckFairness,
        handleAnswerFairness,
        handleDraftRubric,
        handleSetLevel,
        handleSaveRubric,
        handleReadCopySource,
        handleCopyRubric,
        noteGradeChange,
        handleApplyGroupChange,
        handleDismissGroupChange,
    };
};

export default useGradingRubric;
