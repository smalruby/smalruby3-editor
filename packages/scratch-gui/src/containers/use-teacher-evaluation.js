/**
 * Grading hook (teacher side, 「採点」).
 *
 * The grading tab is a gradebook (EPIC #2421 / #2424): a column per assignment of the
 * class, a row per seat. Opening it reads the saved grading of every assignment
 * (`GET /classrooms/{id}/grading`). An assignment is graded on its own screen
 * (`view: 'assignment'`): load its submissions (download each sb3, unzip,
 * static-analyze) → look at the rubric → let the AI grade everyone → fix and
 * confirm → draft comments → return them.
 *
 * Grades are saved on the server (`PUT /classrooms/{id}/grading`, only `grades` /
 * `confirmedAt`): the AI's results right after each call, the teacher's edits a
 * moment after the last key (GRADE_SAVE_DELAY_MS). So a grading closed half way
 * comes back as it was. Confirming sets `confirmedAt`; changing a grade after that
 * takes the confirmation back (the teacher confirms again), so the gradebook never
 * shows changed grades as confirmed.
 *
 * The matrix is a plain object keyed by `${seatNumber}:${classroomId}`. Each cell:
 * {submissionId, submitted, signals, pseudocode, grade, reason, needsReview,
 * returned, returnedComment}. It keeps every assignment opened so far, so going
 * back to the gradebook and opening another assignment loses nothing.
 *
 * Comment drafts live only here until they are returned, so leaving with comments
 * not returned (or a grade that could not be saved) asks first (#1923 C4:
 * `hasUnsavedWork` / `requestLeave`).
 *
 * Leaving stops what is running (#1950): every run (load, AI, return) carries
 * the generation it started in. The generation moves on when the teacher
 * leaves through `requestLeave` (［戻る］/［離れる］, logout included), opens
 * another class's grading, logs out (the modal unmounts), or starts a new load /
 * AI run. A run whose generation is gone sends nothing more and writes nothing,
 * so results from before do not end up in the table shown now. Hiding the modal
 * (← エディタに戻る, Esc, ［作品を開く］) is not leaving: the runs go on to the
 * end and their results are in the table when it is shown again (#1990).
 */
import JSZip from 'jszip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defineMessages } from 'react-intl';
import classroomAPI from '../lib/classroom-api.js';
import {
    DEFAULT_RUBRIC_AXES,
    buildAuditCsv,
    buildEvaluationCsv,
    chunk,
    isLessonOnlyAssignment,
} from '../lib/classroom-evaluation/evaluation-utils.js';
import { carryOverExamples, seatsToReview } from '../lib/classroom-evaluation/grade-consistency.js';
import {
    assignmentTextOf,
    columnStatus,
    gradebookColumns,
    gradesFromMatrix,
    hasUnreturnedComments,
    sameGrades,
    withSavedGrade,
} from '../lib/classroom-evaluation/gradebook.js';
import { assignmentCsvRows, gradingCsvText } from '../lib/classroom-evaluation/grading-csv.js';
import { groupSubmissions } from '../lib/classroom-evaluation/grouping.js';
import { analyzeProject } from '../lib/classroom-evaluation/sb3-analyzer.js';
import { diffFromStarter } from '../lib/classroom-evaluation/starter-diff.js';
import { isSameLessonScoring } from '../lib/classroom-lesson-settings.js';
import { lessonScoresBySeat } from '../lib/classroom-lesson-summary.js';
import { findCourse } from '../lib/lessons/courses.js';
import translateError from './classroom-error-utils.js';
import useGradingRubric from './use-grading-rubric.js';

const evaluationMessages = defineMessages({
    lessonRemoved: {
        defaultMessage: 'This assignment no longer has a lesson, so the points were not saved.',
        description: 'Grading screen: the lesson was removed elsewhere before the lesson points were saved (#1778)',
        id: 'gui.classroom.evaluation.lessonRemoved',
    },
    openWorkFailed: {
        defaultMessage:
            'The work could not be opened. Wait a moment and press [Open the work] again. If it still fails, ' +
            'load the submissions again.',
        description:
            'Grading screen: [Open the work] could not get the link to the work (a network error, or it was ' +
            'taken back). Trying again first; loading again also works since the grades are saved (#1980, #2424)',
        id: 'gui.classroom.evaluation.openWorkFailed',
    },
    saveFailed: {
        defaultMessage: 'The grades could not be saved. They are saved again when you change a grade.',
        description: 'Grading screen: saving the grades of an assignment failed; the next change tries again (#2424)',
        id: 'gui.classroom.evaluation.saveFailed',
    },
});

const EVAL_CHUNK_SIZE = 10;
// The link to a work (`projectUrl`) is a signed URL that ends after an hour by
// default (PRESIGNED_URL_DOWNLOAD_EXPIRY). Grading often takes longer, so an old
// link is fetched again before opening (#1980). A little under the hour.
const WORK_URL_FRESH_MS = 50 * 60 * 1000;
// How long a result that went well stays on the grading screen (#2419).
const EVAL_RESULT_SHOWN_MS = 6000;
// Grades are saved this long after the last change (a teacher fixing grades one
// after another sends one save, #2424).
const GRADE_SAVE_DELAY_MS = 800;
const cellKey = (seatNumber, classroomId) => `${seatNumber}:${classroomId}`;
const seatFromMemberId = (memberId) => {
    const match = /^seat-(\d+)$/.exec(memberId || '');
    return match ? parseInt(match[1], 10) : null;
};
const savedSeats = (grading) =>
    Object.keys((grading && grading.grades) || {})
        .map((seat) => parseInt(seat, 10))
        .filter((n) => Number.isFinite(n));

/**
 * Download an sb3 and analyze its project (signals + pseudocode).
 * @param {string} url - the sb3's URL
 * @returns {Promise<?{signals: object, pseudocode: string}>} null when it has no project.json
 */
const analyzeSb3 = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`download ${response.status}`);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const projectFile = zip.file('project.json');
    if (!projectFile) return null;
    return analyzeProject(JSON.parse(await projectFile.async('string')));
};

/**
 * Trigger a client-side download of a text file.
 * @param {string} filename - Suggested filename
 * @param {string} text - File contents
 */
const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {Array<object>} params.classrooms - teacher's classrooms list
 * @param {Function} params.handleTeacher401 - 401 handler
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setPhase - phase setter
 * @param {Function} [params.openSubmission] - opens a work in the editor and closes
 *   the modal (`handleOpenSubmission` of use-teacher-submissions, the same as
 *   「スモウルビーで開く」 of the assignment's members). This screen's state stays (#1990).
 * @param {Array<object>} [params.groups] - the teacher's classes (labels when copying a rubric, #2425)
 * @returns {object} evaluation state and handlers
 */
const useTeacherEvaluation = ({
    idToken,
    classrooms,
    groups: classGroups,
    handleTeacher401,
    clearError,
    showError,
    intl,
    setPhase,
    openSubmission,
}) => {
    const [evalGroup, setEvalGroup] = useState(null);
    // Every assignment of the class, the newest first (the gradebook's columns).
    const [evalLessons, setEvalLessons] = useState([]);
    // 'book' (the gradebook) | 'assignment' (one assignment's grading) | 'overall' (#2426)
    const [view, setView] = useState('book');
    // The assignment open in view 'assignment'.
    const [currentId, setCurrentId] = useState(null);
    // classroomId → saved grading (null = nothing saved or could not be read)
    const [gradings, setGradings] = useState({});
    // classroomId → seats of the loaded assignment (members, submissions, lesson records)
    const [seatsById, setSeatsById] = useState({});
    const [matrix, setMatrix] = useState({});
    const [rubricAxes, setRubricAxes] = useState(DEFAULT_RUBRIC_AXES);
    const [strictness, setStrictness] = useState('standard');
    // The running step while loading submissions / calling the AI / returning:
    // {kind, assignmentName, done, total, from, to} (lib/classroom-evaluation/eval-status.js, #2419)
    const [evalProgress, setEvalProgress] = useState(null);
    // The short result of the last step: {kind, count, lessons, failed, done, total} (#2419)
    const [evalResult, setEvalResult] = useState(null);
    const [comments, setComments] = useState({});
    // classroomId → lessonScoresBySeat (null = cannot be scored) for lesson assignments (#1603)
    const [lessonScores, setLessonScores] = useState({});
    // classroomId → GET lesson-progress (kept to re-score after the points change, #1778)
    const [lessonProgress, setLessonProgress] = useState({});
    // The teacher has checked (or changed) the lesson points: the lesson-only flow moves on (#1778)
    const [scoringChecked, setScoringChecked] = useState(false);
    // classroomId whose lesson points are being saved
    const [scoringSavingId, setScoringSavingId] = useState(null);
    // classroomIds whose rubric step the teacher has looked at (the step can be skipped)
    const [rubricVisited, setRubricVisited] = useState({});
    // classroomId → 'pending' | 'failed' while its grades are not saved yet
    const [saveStates, setSaveStates] = useState({});
    // classroomIds whose confirmation was taken back by a change (a note says so)
    const [unconfirmed, setUnconfirmed] = useState({});
    // The tab of the right column of the assignment's grading: 'rubric' | 'student'
    const [innerTab, setInnerTab] = useState('rubric');
    // A leave waiting for the teacher's answer: {kind: 'back'|'leave'|'reload', action} (#1923 C4)
    const [leaveRequest, setLeaveRequest] = useState(null);
    // Settings fetched for a group that is no longer shown are dropped.
    const shownGroupRef = useRef(null);
    // The ID token at this moment (#1993): a long run (load, AI, return) reads it
    // before each call, so after logging in again on the way the rest is sent
    // with the new token, not the one the run started with.
    const idTokenRef = useRef(idToken);
    idTokenRef.current = idToken;
    // The latest state for the delayed saves (they run after the render that changed it).
    const matrixRef = useRef(matrix);
    matrixRef.current = matrix;
    const gradingsRef = useRef(gradings);
    gradingsRef.current = gradings;
    // classroomId → timer of the delayed save
    const saveTimersRef = useRef({});
    // classroomIds whose next save also takes the confirmation back
    const unconfirmRef = useRef({});
    // Generation of the runs (load / AI / return): a run that is no longer
    // current stops and writes nothing (#1950).
    const runRef = useRef(0);
    const stopRuns = useCallback(() => {
        runRef.current++;
        // The stopped run no longer clears it, so a leave to anywhere (notifications,
        // an assignment, the class list, logout) does not leave the screen busy.
        setEvalProgress(null);
        setEvalResult(null);
    }, []);
    /**
     * Start a run in the current generation.
     * @param {boolean} replace - true for a run that replaces the table (load / AI): it stops the older ones
     * @returns {Function} true while the run is still current
     */
    const startRun = useCallback((replace) => {
        if (replace) runRef.current++;
        const run = runRef.current;
        setEvalResult(null);
        return () => runRef.current === run;
    }, []);
    // A result that went well is short news: it goes away by itself so the table keeps its
    // height (1300×600). A failure stays until the next step (#2419).
    useEffect(() => {
        // 「同じ形なのに評価が違う」 asks the teacher to look: it stays like a failure does.
        if (!evalResult || evalResult.failed || evalResult.inconsistent > 0) return;
        const timer = setTimeout(() => setEvalResult(null), EVAL_RESULT_SHOWN_MS);
        return () => clearTimeout(timer);
    }, [evalResult]);
    // classroomId → when its submissions (and their links) were read (#1980)
    const urlsReadAtRef = useRef({});
    // A work is being opened: [Open the work] waits, so it is not pressed twice (#1980).
    const [openingWork, setOpeningWork] = useState(false);
    // The seat × assignment shown in the right column (#1962). Kept here, not in the
    // screen, so it is still chosen after a work is opened and the screen comes back (#1990).
    const [chosenCell, setChosenCell] = useState(null);
    const openingWorkRef = useRef(false);
    const markOpeningWork = useCallback((value) => {
        openingWorkRef.current = value;
        setOpeningWork(value);
    }, []);

    /**
     * Save the grades of an assignment now, from the latest table. Nothing is sent
     * when they are the same as saved (and the confirmation is not taken back).
     * @param {string} classroomId - the assignment
     * @param {object} [extra] - more keys to save with the grades ({confirmedAt})
     * @returns {Promise<boolean>} true when saved (or nothing to save)
     */
    const flushSave = useCallback(
        async (classroomId, extra = null) => {
            clearTimeout(saveTimersRef.current[classroomId]);
            delete saveTimersRef.current[classroomId];
            const saved = gradingsRef.current[classroomId] || null;
            const grades = gradesFromMatrix(matrixRef.current, classroomId, saved && saved.grades);
            const updates = { grades, ...(extra || {}) };
            const unconfirm = !!unconfirmRef.current[classroomId];
            if (unconfirm && !(extra && 'confirmedAt' in extra)) updates.confirmedAt = null;
            if (!extra && !unconfirm && sameGrades(grades, saved && saved.grades)) {
                setSaveStates((prev) => {
                    if (!prev[classroomId]) return prev;
                    const next = { ...prev };
                    delete next[classroomId];
                    return next;
                });
                return true;
            }
            try {
                const data = await classroomAPI.putGrading(idTokenRef.current, classroomId, updates);
                delete unconfirmRef.current[classroomId];
                setGradings((prev) => ({
                    ...prev,
                    [classroomId]: (data && data.grading) || { ...(prev[classroomId] || {}), ...updates },
                }));
                setSaveStates((prev) => {
                    if (!prev[classroomId] && !saveTimersRef.current[classroomId]) return prev;
                    const next = { ...prev };
                    // A change made while this save was on its way saves again by itself.
                    if (!saveTimersRef.current[classroomId]) delete next[classroomId];
                    return next;
                });
                return true;
            } catch (err) {
                if (err.status === 401) handleTeacher401();
                else showError(intl.formatMessage(evaluationMessages.saveFailed));
                setSaveStates((prev) => ({ ...prev, [classroomId]: 'failed' }));
                return false;
            }
        },
        [handleTeacher401, showError, intl],
    );
    const flushSaveRef = useRef(flushSave);
    flushSaveRef.current = flushSave;
    /**
     * Save the grades of an assignment a moment after the last change.
     * @param {string} classroomId - the assignment
     */
    const scheduleSave = useCallback((classroomId) => {
        clearTimeout(saveTimersRef.current[classroomId]);
        setSaveStates((prev) => (prev[classroomId] === 'pending' ? prev : { ...prev, [classroomId]: 'pending' }));
        saveTimersRef.current[classroomId] = setTimeout(() => {
            delete saveTimersRef.current[classroomId];
            flushSaveRef.current(classroomId);
        }, GRADE_SAVE_DELAY_MS);
    }, []);
    /** Send every waiting save now (before leaving, so nothing waits on a timer). */
    const flushAllSaves = useCallback(() => {
        for (const classroomId of Object.keys(saveTimersRef.current)) flushSaveRef.current(classroomId);
    }, []);
    /**
     * A grade of the assignment changed: save it, and take the confirmation back
     * when it was confirmed (the teacher confirms again).
     * @param {string} classroomId - the assignment
     */
    const gradesChanged = useCallback(
        (classroomId) => {
            const saved = gradingsRef.current[classroomId];
            if (saved && saved.confirmedAt) {
                unconfirmRef.current[classroomId] = true;
                setGradings((prev) => ({ ...prev, [classroomId]: { ...prev[classroomId], confirmedAt: null } }));
                setUnconfirmed((prev) => ({ ...prev, [classroomId]: true }));
            }
            scheduleSave(classroomId);
        },
        [scheduleSave],
    );
    // Logging out on purpose unmounts this (ClassroomTeacherModalHost, #1990): stop the
    // runs, and send the grades still waiting for their delayed save.
    useEffect(
        () => () => {
            stopRuns();
            flushAllSaves();
        },
        [stopRuns, flushAllSaves],
    );

    const handleShowEvaluation = useCallback(
        (group) => {
            clearError();
            const lessons = gradebookColumns(
                (classrooms || [])
                    .filter((c) => c.groupId === group.groupId)
                    .map((c) => ({
                        classroomId: c.classroomId,
                        assignmentName: c.assignmentName || '',
                        hasLesson: !!c.hasLesson,
                        sortDate: c.sortDate || null,
                        createdAt: c.createdAt || null,
                    })),
            );
            flushAllSaves();
            shownGroupRef.current = group.groupId;
            stopRuns();
            setEvalGroup(group);
            setEvalLessons(lessons);
            setView('book');
            setCurrentId(null);
            setGradings({});
            setSeatsById({});
            setMatrix({});
            setComments({});
            setLessonScores({});
            setLessonProgress({});
            setScoringChecked(false);
            setScoringSavingId(null);
            setRubricVisited({});
            setSaveStates({});
            setUnconfirmed({});
            unconfirmRef.current = {};
            setInnerTab('rubric');
            setEvalProgress(null);
            setLeaveRequest(null);
            setChosenCell(null);
            setPhase('teacher-evaluation');
            // The gradebook: the saved grading of every assignment. One that cannot be
            // read shows no grades (it is read again when the assignment is loaded).
            const current = startRun(true);
            if (lessons.length === 0) return;
            let done = 0;
            setEvalProgress({ kind: 'gradebook', done, total: lessons.length });
            let unauthorized = false;
            Promise.all(
                lessons.map((l) =>
                    Promise.resolve()
                        .then(() => classroomAPI.getGrading(idTokenRef.current, l.classroomId))
                        .then(
                            (data) => (data && data.grading) || null,
                            (err) => {
                                if (err && err.status === 401) unauthorized = true;
                                return null;
                            },
                        )
                        .then((grading) => {
                            if (!current()) return;
                            done++;
                            setGradings((prev) => ({ ...prev, [l.classroomId]: grading }));
                            setEvalProgress({ kind: 'gradebook', done, total: lessons.length });
                        }),
                ),
            ).then(() => {
                if (!current()) return;
                setEvalProgress(null);
                if (unauthorized) handleTeacher401();
            });
        },
        [classrooms, clearError, setPhase, stopRuns, startRun, flushAllSaves, handleTeacher401],
    );

    const handleBackFromEvaluation = useCallback(() => {
        flushAllSaves();
        stopRuns();
        clearError();
        setLeaveRequest(null);
        setEvalProgress(null);
        setPhase('teacher-class-list');
    }, [clearError, setPhase, stopRuns, flushAllSaves]);

    /**
     * Open the grading of one assignment (a column name, or a cell of the gradebook
     * with its seat). Its description (given to the AI) and lesson setting are read.
     * @param {string} classroomId - the assignment
     * @param {?number} [seat] - the seat pressed in the gradebook (shown in［生徒］)
     */
    const handleOpenAssignment = useCallback(
        (classroomId, seat = null) => {
            const lesson = evalLessons.find((l) => l.classroomId === classroomId);
            if (!lesson) return;
            clearError();
            setEvalResult(null);
            if (classroomId !== currentId) setScoringChecked(false);
            setCurrentId(classroomId);
            setView('assignment');
            if (typeof seat === 'number') {
                setChosenCell({ seat, classroomId });
                setInnerTab('student');
            } else {
                setInnerTab('rubric');
            }
            if (lesson.detailRead) return;
            const groupId = shownGroupRef.current;
            Promise.resolve()
                .then(() => classroomAPI.getAssignment(idTokenRef.current, classroomId))
                .then((data) => {
                    if (shownGroupRef.current !== groupId) return;
                    setEvalLessons((prev) =>
                        prev.map((x) =>
                            x.classroomId === classroomId
                                ? {
                                      ...x,
                                      detailRead: true,
                                      assignmentText: assignmentTextOf(data),
                                      lessonSetting: (data && data.lesson) || null,
                                  }
                                : x,
                        ),
                    );
                })
                .catch(() => {});
        },
        [evalLessons, currentId, clearError],
    );

    /** Back to the gradebook (nothing is lost: the assignment's state stays). */
    const handleShowGradebook = useCallback(() => {
        flushAllSaves();
        setView('book');
    }, [flushAllSaves]);
    /** The overall grade (#2426 builds it; a placeholder for now). */
    const handleShowOverall = useCallback(() => {
        flushAllSaves();
        setView('overall');
    }, [flushAllSaves]);

    const currentLesson = evalLessons.find((l) => l.classroomId === currentId) || null;
    const selectedLessonIds = useMemo(() => (currentId ? [currentId] : []), [currentId]);

    /** Load the submissions of the open assignment and static-analyze each sb3. */
    const handleLoadSubmissions = useCallback(async () => {
        const current = startRun(true);
        clearError();
        const lesson = evalLessons.find((l) => l.classroomId === currentId);
        if (!lesson) return;
        const id = lesson.classroomId;
        const nextMatrix = {};
        const seatSet = new Set();
        let nextLessonScore;
        let nextLessonProgress;
        let urlsReadAt = null;
        let grading = gradingsRef.current[id] || null;
        let starterPseudocode = '';
        try {
            const assignmentName = lesson.assignmentName;
            const notAuthorized = (err) => {
                if (err.status === 401) throw err;
                return null;
            };
            setEvalProgress({
                kind: lesson.hasLesson ? 'loadProgress' : 'load',
                assignmentName,
                done: 0,
                total: null,
            });
            // The saved grades (fresh: a co-teacher may have graded since) and the members
            // (a member who did not submit is 「未提出」).
            const [gradingData, membersData] = await Promise.all([
                Promise.resolve()
                    .then(() => classroomAPI.getGrading(idTokenRef.current, id))
                    .catch(notAuthorized),
                Promise.resolve()
                    .then(() => classroomAPI.listMembers(idTokenRef.current, id))
                    .catch(notAuthorized),
            ]);
            if (!current()) return;
            if (gradingData) grading = gradingData.grading || null;
            for (const member of (membersData && membersData.members) || []) {
                const seat = seatFromMemberId(member.memberId);
                if (seat !== null) seatSet.add(seat);
            }
            savedSeats(grading).forEach((seat) => seatSet.add(seat));
            let lessonOnly = false;
            if (lesson.hasLesson) {
                // The lesson score comes from the progress, not the work (#1603).
                // A failed fetch leaves the scores empty (「—」) but still reads the
                // setting, so an assignment without work keeps showing no work column.
                let progressData = await classroomAPI.getLessonProgress(idTokenRef.current, id).catch(notAuthorized);
                if (!progressData) {
                    const assignment = await classroomAPI.getAssignment(idTokenRef.current, id).catch(notAuthorized);
                    progressData =
                        assignment && assignment.lesson ? { lesson: assignment.lesson, progress: [] } : null;
                }
                const saved = progressData && progressData.lesson;
                const scored = saved
                    ? lessonScoresBySeat(progressData, findCourse(saved.courseId), Date.now())
                    : null;
                nextLessonScore = scored;
                nextLessonProgress = progressData;
                if (scored) Object.keys(scored.scores).forEach((seat) => seatSet.add(Number(seat)));
                // No work is submitted: nothing to download or grade (#1778).
                lessonOnly = isLessonOnlyAssignment(lesson, { [id]: scored });
            }
            if (!lessonOnly) {
                if (!current()) return;
                setEvalProgress({ kind: 'load', assignmentName, done: 0, total: null });
                // The starter, to tell what each student added (a failed read compares with nothing).
                const detail = await Promise.resolve()
                    .then(() => classroomAPI.getAssignment(idTokenRef.current, id))
                    .catch(notAuthorized);
                const starterUrl = detail && detail.assignment && detail.assignment.starterUrl;
                const starterAnalysis = starterUrl ? await analyzeSb3(starterUrl).catch(() => null) : null;
                starterPseudocode = (starterAnalysis && starterAnalysis.pseudocode) || '';
                if (!current()) return;
                const data = await classroomAPI.listSubmissions(idTokenRef.current, id);
                urlsReadAt = Date.now();
                const submissions = data.submissions || [];
                const savedGrades = (grading && grading.grades) || {};
                for (let i = 0; i < submissions.length; i++) {
                    const submission = submissions[i];
                    if (!current()) return;
                    setEvalProgress({ kind: 'load', assignmentName, done: i, total: submissions.length });
                    const seatNumber = seatFromMemberId(submission.memberId);
                    if (seatNumber === null) continue;
                    seatSet.add(seatNumber);
                    const cell = {
                        submissionId: submission.submissionId,
                        submitted: true,
                        // Opened from the right column (#1980). Not part of the grades.
                        projectUrl: submission.projectUrl || null,
                        returned: submission.status === 'returned',
                        // The comment the student got: a draft equal to it is not lost (#1923 C4).
                        returnedComment:
                            submission.status === 'returned' ? (submission.teacherComment || '').trim() : null,
                        signals: null,
                        pseudocode: '',
                        grade: null,
                        reason: '',
                        needsReview: false,
                    };
                    try {
                        const analysis = await analyzeSb3(submission.projectUrl);
                        if (analysis) {
                            cell.signals = analysis.signals;
                            cell.pseudocode = analysis.pseudocode;
                        }
                        // What the student added to the starter: the main thing to grade (EPIC #2421).
                        cell.added = diffFromStarter(cell.pseudocode, starterPseudocode).added;
                    } catch (err) {
                        // Analysis failure is per-cell: keep the submission
                        // visible and let the AI/teacher treat it as unknown.
                        cell.pseudocode = `(解析失敗: ${err.message})`;
                        cell.needsReview = true;
                    }
                    // A grade saved before comes back as it was (#2424).
                    nextMatrix[cellKey(seatNumber, id)] = withSavedGrade(cell, savedGrades[String(seatNumber)]);
                }
            }
            if (!current()) return;
            // The まとまり (works that added the same operations, EPIC #2421): saved with each grade.
            const groups = groupSubmissions(
                Object.entries(nextMatrix).map(([key, cell]) => ({
                    seatNumber: parseInt(key, 10),
                    added: cell.added || [],
                })),
            );
            for (const group of groups) {
                for (const seat of group.seatNumbers) {
                    const key = cellKey(seat, id);
                    if (nextMatrix[key]) nextMatrix[key] = { ...nextMatrix[key], groupName: group.name };
                }
            }
            setEvalLessons((prev) =>
                prev.map((x) => (x.classroomId === id ? { ...x, starterPseudocode, groups } : x)),
            );
            const suffix = `:${id}`;
            setMatrix((prev) => {
                const next = {};
                for (const [key, cell] of Object.entries(prev)) if (!key.endsWith(suffix)) next[key] = cell;
                return { ...next, ...nextMatrix };
            });
            setGradings((prev) => ({ ...prev, [id]: grading }));
            if (urlsReadAt) urlsReadAtRef.current = { ...urlsReadAtRef.current, [id]: urlsReadAt };
            if (lesson.hasLesson) {
                setLessonScores((prev) => ({ ...prev, [id]: nextLessonScore }));
                setLessonProgress((prev) => ({ ...prev, [id]: nextLessonProgress }));
            }
            setScoringChecked(false);
            setSeatsById((prev) => ({ ...prev, [id]: [...seatSet].sort((a, b) => a - b) }));
            // `lessons` counts only the assignments whose lesson progress was read: an ordinary
            // assignment with no submission yet is「0 件の提出」, not「進み具合を読み込みました」.
            setEvalResult({
                kind: 'load',
                count: Object.keys(nextMatrix).length,
                lessons: lesson.hasLesson ? 1 : 0,
            });
        } catch (err) {
            if (!current()) return;
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            showError(translateError(intl, err));
            setEvalResult({ kind: 'load', failed: true });
        } finally {
            if (current()) setEvalProgress(null);
        }
    }, [evalLessons, currentId, clearError, showError, intl, handleTeacher401, startRun]);

    const seats = useMemo(() => {
        if (!currentId) return [];
        if (seatsById[currentId]) return seatsById[currentId];
        return savedSeats(gradings[currentId]).sort((a, b) => a - b);
    }, [currentId, seatsById, gradings]);
    const loaded = !!(currentId && seatsById[currentId]);

    // The［基準］tab (#2425): starter, groups, representatives and the rubric.
    const rubricTools = useGradingRubric({
        idTokenRef,
        lesson: currentLesson,
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
        classrooms,
        groups: classGroups,
        handleTeacher401,
        showError,
        intl,
    });
    const { noteGradeChange } = rubricTools;

    /** Run the AI on the open assignment (grade proposals or comment drafts). */
    const handleRunAi = useCallback(
        async (mode) => {
            const current = startRun(true);
            clearError();
            const lesson = evalLessons.find((l) => l.classroomId === currentId);
            if (!lesson) return;
            let sent = 0;
            try {
                const cells = seats
                    .map((seatNumber) => ({ seatNumber, cell: matrix[cellKey(seatNumber, lesson.classroomId)] }))
                    .filter((entry) => entry.cell && entry.cell.submitted);
                // Calibration: hand-graded cells of this assignment (up to 5)
                const samples = cells
                    .filter((entry) => entry.cell.grade && entry.cell.manual)
                    .slice(0, 5)
                    .map((entry) => ({
                        seatNumber: entry.seatNumber,
                        grade: entry.cell.grade,
                        ...(entry.cell.reason ? { reason: entry.cell.reason } : {}),
                    }));
                const rubric = gradingsRef.current[lesson.classroomId]?.rubric || null;
                const pending = mode === 'grade' ? cells.filter((entry) => !entry.cell.manual) : cells;
                const chunks = chunk(pending, EVAL_CHUNK_SIZE);
                // Each chunk is a call of its own, so the same kind of work could get B in one
                // chunk and S in the next. The examples grow by one work per new shape of each
                // chunk (after the teacher's), and the grades of this run are checked at the end.
                let examples = (rubric && rubric.examples) || [];
                const graded = {};
                for (let i = 0; i < chunks.length; i++) {
                    if (!current()) return;
                    // Seats from..to of this assignment's seats sent to the AI.
                    const from = i * EVAL_CHUNK_SIZE + 1;
                    setEvalProgress({
                        kind: mode === 'grade' ? 'grade' : 'comment',
                        assignmentName: lesson.assignmentName,
                        from,
                        to: from + chunks[i].length - 1,
                        total: pending.length,
                    });
                    const payload = {
                        mode,
                        assignmentName: lesson.assignmentName,
                        // The description the teacher wrote: without it the AI guessed the task (#2424).
                        assignmentText: lesson.assignmentText || '',
                        // The AI looks at what was added to the starter (EPIC #2421).
                        ...(lesson.starterPseudocode ? { starterPseudocode: lesson.starterPseudocode } : {}),
                        rubricAxes,
                        strictness,
                        samples,
                        ...(rubric && (rubric.levels || []).length > 0 ? { rubricLevels: rubric.levels } : {}),
                        ...(examples.length > 0 ? { examples } : {}),
                        submissions: chunks[i].map((entry) => ({
                            seatNumber: entry.seatNumber,
                            signals: entry.cell.signals || {},
                            pseudocode: entry.cell.pseudocode || '',
                        })),
                    };
                    const data = await classroomAPI.evaluateSubmissions(
                        idTokenRef.current,
                        lesson.classroomId,
                        payload,
                    );
                    // Left (or started again) while the AI was answering: drop the result.
                    if (!current()) return;
                    if (mode === 'grade') {
                        setMatrix((prev) => {
                            const next = { ...prev };
                            for (const result of data.results || []) {
                                const key = cellKey(result.seatNumber, lesson.classroomId);
                                if (!next[key]) continue;
                                next[key] = {
                                    ...next[key],
                                    grade: result.grade,
                                    reason: result.reason || '',
                                    needsReview: result.needsReview === true,
                                    manual: false,
                                    gradeEdited: false,
                                };
                            }
                            return next;
                        });
                        gradesChanged(lesson.classroomId);
                        for (const result of data.results || []) graded[String(result.seatNumber)] = result;
                        examples = carryOverExamples({
                            examples,
                            results: data.results || [],
                            works: chunks[i].map((entry) => ({
                                seatNumber: entry.seatNumber,
                                added: entry.cell.added || [],
                            })),
                            groupBySeat: Object.fromEntries(
                                chunks[i].map((entry) => [String(entry.seatNumber), entry.cell.groupName || '']),
                            ),
                        });
                    } else {
                        setComments((prev) => {
                            const next = { ...prev };
                            for (const result of data.results || []) {
                                if (!result.comment) continue;
                                next[cellKey(result.seatNumber, lesson.classroomId)] = result.comment;
                            }
                            return next;
                        });
                    }
                    sent += chunks[i].length;
                }
                if (!current()) return;
                // The last check: works of the same shape with different grades are marked
                // 「要確認」. The grades are not changed. A work that could not be analyzed
                // (no `added`) is already 「要確認」 and has no shape.
                const review =
                    mode === 'grade'
                        ? seatsToReview(
                              cells
                                  .filter((entry) => Array.isArray(entry.cell.added))
                                  .map((entry) => {
                                      const result = graded[String(entry.seatNumber)];
                                      return {
                                          seatNumber: entry.seatNumber,
                                          added: entry.cell.added,
                                          grade: result ? result.grade : entry.cell.grade,
                                          manual: !result && !!entry.cell.manual,
                                      };
                                  }),
                          )
                        : [];
                if (review.length > 0) {
                    setMatrix((prev) => {
                        const next = { ...prev };
                        for (const seat of review) {
                            const key = cellKey(seat, lesson.classroomId);
                            if (next[key]) next[key] = { ...next[key], needsReview: true };
                        }
                        return next;
                    });
                    gradesChanged(lesson.classroomId);
                }
                setEvalResult({
                    kind: mode === 'grade' ? 'grade' : 'comment',
                    count: sent,
                    ...(review.length > 0 ? { inconsistent: review.length } : {}),
                });
            } catch (err) {
                if (!current()) return;
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
                setEvalResult({ kind: mode === 'grade' ? 'grade' : 'comment', failed: true });
            } finally {
                if (current()) setEvalProgress(null);
            }
        },
        [
            evalLessons,
            currentId,
            seats,
            matrix,
            rubricAxes,
            strictness,
            clearError,
            showError,
            intl,
            handleTeacher401,
            startRun,
            gradesChanged,
        ],
    );

    const handleCheckScoring = useCallback(() => setScoringChecked(true), []);

    /** The teacher looked at the rubric step (step 2): the flow moves on to grading. */
    const handleVisitRubric = useCallback(() => {
        if (!currentId) return;
        setRubricVisited((prev) => ({ ...prev, [currentId]: true }));
        setInnerTab('rubric');
    }, [currentId]);

    /** Confirm the grades of the open assignment (step 4): they count as decided. */
    const handleConfirmGrades = useCallback(async () => {
        const lesson = evalLessons.find((l) => l.classroomId === currentId);
        if (!lesson) return;
        // Confirming does not replace the table, so it does not stop the others.
        const current = startRun(false);
        clearError();
        setEvalProgress({ kind: 'confirm', assignmentName: lesson.assignmentName });
        const confirmedAt = new Date().toISOString();
        const ok = await flushSave(lesson.classroomId, { confirmedAt });
        if (!current()) return;
        setEvalProgress(null);
        if (ok) {
            setUnconfirmed((prev) => {
                if (!prev[lesson.classroomId]) return prev;
                const next = { ...prev };
                delete next[lesson.classroomId];
                return next;
            });
            const count = Object.keys(gradesFromMatrix(matrixRef.current, lesson.classroomId)).length;
            setEvalResult({ kind: 'confirm', count });
        } else {
            setEvalResult({ kind: 'confirm', failed: true });
        }
    }, [evalLessons, currentId, startRun, clearError, flushSave]);

    /**
     * Open the work of a cell in the editor (#1980), the same way as
     * 「スモウルビーで開く」 of the assignment's members. The modal closes but this
     * hook stays mounted (#1990), so nothing is lost and it does not ask. A link read more than
     * WORK_URL_FRESH_MS ago is read again (it may have ended), without loading
     * the table again.
     * @param {number} seatNumber - seat of the cell
     * @param {string} classroomId - assignment of the cell
     */
    const handleOpenWork = useCallback(
        async (seatNumber, classroomId) => {
            const cell = matrix[cellKey(seatNumber, classroomId)];
            if (!openSubmission || !cell || !cell.submissionId || openingWorkRef.current) return;
            markOpeningWork(true);
            try {
                let projectUrl = cell.projectUrl;
                const readAt = urlsReadAtRef.current[classroomId];
                if (!projectUrl || !readAt || Date.now() - readAt > WORK_URL_FRESH_MS) {
                    clearError();
                    let fresh = null;
                    try {
                        const data = await classroomAPI.listSubmissions(idTokenRef.current, classroomId);
                        fresh = data.submissions || [];
                    } catch (err) {
                        if (err.status === 401) {
                            handleTeacher401();
                            return;
                        }
                    }
                    if (fresh) {
                        const urls = new Map(fresh.map((s) => [s.submissionId, s.projectUrl || null]));
                        projectUrl = urls.get(cell.submissionId) || null;
                        // Every link of this assignment is new now. A submission no longer
                        // listed has no link (pressing it says so). The grades are kept.
                        urlsReadAtRef.current = { ...urlsReadAtRef.current, [classroomId]: Date.now() };
                        setMatrix((prev) => {
                            const next = { ...prev };
                            for (const [key, value] of Object.entries(prev)) {
                                if (!key.endsWith(`:${classroomId}`) || !value.submissionId) continue;
                                next[key] = { ...value, projectUrl: urls.get(value.submissionId) || null };
                            }
                            return next;
                        });
                    } else {
                        projectUrl = null;
                    }
                    if (!projectUrl) {
                        showError(intl.formatMessage(evaluationMessages.openWorkFailed));
                        return;
                    }
                }
                // Only the seat and the assignment name go to the bar above the editor (#1990).
                const lesson = evalLessons.find((l) => l.classroomId === classroomId);
                await openSubmission(projectUrl, {
                    from: 'evaluation',
                    seatNumber,
                    assignmentName: (lesson && lesson.assignmentName) || null,
                });
            } finally {
                markOpeningWork(false);
            }
        },
        [matrix, evalLessons, openSubmission, clearError, showError, intl, handleTeacher401, markOpeningWork],
    );

    /**
     * Save new lesson points from the grading screen (#1778): the table is
     * re-scored at once, then only `scoring` is sent to the points-only API
     * (#1787: pages and the starter are not sent back, so an image replaced in
     * the meantime is kept). The screen follows the returned lesson (M1).
     * Nothing is saved when the points do not change (FYI1). When the save
     * fails, the screen follows what the server has (it may have gone through, FYI2).
     * @param {string} classroomId - assignment
     * @param {?object} scoring - the new `lesson.scoring` (null = the defaults)
     */
    const handleChangeLessonScoring = useCallback(
        async (classroomId, scoring) => {
            const target = evalLessons.find((l) => l.classroomId === classroomId);
            if (!target || !target.lessonSetting) return;
            const before = target.lessonSetting;
            if (isSameLessonScoring(before, scoring)) return;
            const progressData = lessonProgress[classroomId];
            const apply = (setting) => {
                setEvalLessons((prev) =>
                    prev.map((l) => (l.classroomId === classroomId ? { ...l, lessonSetting: setting } : l)),
                );
                if (progressData) {
                    const next = { ...progressData, lesson: setting };
                    setLessonProgress((prev) => ({ ...prev, [classroomId]: next }));
                    setLessonScores((prev) => ({
                        ...prev,
                        [classroomId]: setting
                            ? lessonScoresBySeat(next, findCourse(setting.courseId), Date.now())
                            : null,
                    }));
                }
            };
            clearError();
            apply({ ...before, scoring });
            setScoringChecked(true);
            setScoringSavingId(classroomId);
            try {
                const saved = await classroomAPI.setLessonScoring(idTokenRef.current, classroomId, scoring);
                apply((saved && saved.lesson) || null);
            } catch (err) {
                if (err.status === 400) {
                    // The lesson was removed elsewhere: the server does not put it back.
                    apply(null);
                    showError(intl.formatMessage(evaluationMessages.lessonRemoved));
                    return;
                }
                if (err.status === 401) {
                    apply(before);
                    handleTeacher401();
                    return;
                }
                // The points may have been saved even though it failed here: show
                // what the server has, or the old points when it cannot be read.
                const UNREAD = {};
                const fresh = await classroomAPI.getAssignment(idTokenRef.current, classroomId).catch(() => UNREAD);
                apply(fresh === UNREAD ? before : (fresh && fresh.lesson) || null);
                showError(translateError(intl, err));
            } finally {
                setScoringSavingId(null);
            }
        },
        [evalLessons, lessonProgress, clearError, showError, intl, handleTeacher401],
    );

    /**
     * Teacher edits a cell's grade — it becomes the teacher's (`source: 'teacher'`):
     * it feeds calibration and the AI does not grade it again. It is saved a moment later.
     */
    const handleSetCellGrade = useCallback(
        (seatNumber, classroomId, grade) => {
            const key = cellKey(seatNumber, classroomId);
            if (!matrixRef.current[key]) return;
            const before = matrixRef.current[key].grade || null;
            setMatrix((prev) => {
                if (!prev[key]) return prev;
                return {
                    ...prev,
                    [key]: {
                        ...prev[key],
                        grade: grade || null,
                        needsReview: false,
                        manual: true,
                        gradeEdited: true,
                    },
                };
            });
            gradesChanged(classroomId);
            // Ask whether to change the rest of the same group too (#2425).
            noteGradeChange(seatNumber, classroomId, before, grade || null);
        },
        [gradesChanged, noteGradeChange],
    );

    /** Editing only the reason keeps the AI's grade (it stays a draft); it is saved too. */
    const handleSetCellReason = useCallback(
        (seatNumber, classroomId, reason) => {
            const key = cellKey(seatNumber, classroomId);
            if (!matrixRef.current[key]) return;
            setMatrix((prev) => {
                if (!prev[key]) return prev;
                return { ...prev, [key]: { ...prev[key], reason, manual: true } };
            });
            gradesChanged(classroomId);
        },
        [gradesChanged],
    );

    const handleSetComment = useCallback((seatNumber, classroomId, comment) => {
        setComments((prev) => ({ ...prev, [cellKey(seatNumber, classroomId)]: comment }));
    }, []);

    const handleChangeRubricAxis = useCallback((index, field, value) => {
        setRubricAxes((prev) => prev.map((axis, i) => (i === index ? { ...axis, [field]: value } : axis)));
    }, []);

    const getCell = useCallback(
        (seatNumber, classroomId) => matrix[cellKey(seatNumber, classroomId)] || null,
        [matrix],
    );

    const fileBase = `${evalGroup?.name || 'class'}_${currentLesson ? currentLesson.assignmentName : ''}`;
    /** The CSV of the open assignment (#2424: one assignment per file). */
    const handleExportEvaluationCsv = useCallback(() => {
        if (!currentLesson) return;
        // A lesson assignment keeps the CSV with the lesson points (#1603 / #1778).
        if (currentLesson.hasLesson) {
            downloadText(
                `${fileBase}_採点結果.csv`,
                buildEvaluationCsv([currentLesson], seats, getCell, lessonScores),
            );
            return;
        }
        // One CSV per assignment (EPIC #2421): 出席番号・評価・根拠・まとまり・確定.
        const grading = gradings[currentLesson.classroomId] || null;
        const confirmed = !!(grading && grading.confirmedAt);
        const rows = seats.map((seat) => {
            const cell = getCell(seat, currentLesson.classroomId);
            const saved = grading && grading.grades ? grading.grades[String(seat)] : null;
            const grade = cell ? cell.grade : saved && saved.grade;
            return {
                seatNumber: seat,
                grade: grade || '',
                reason: cell ? cell.reason : (saved && saved.reason) || '',
                groupName: (cell && cell.groupName) || (saved && saved.group) || '',
                confirmed: confirmed && !!grade,
            };
        });
        downloadText(`${fileBase}_採点結果.csv`, gradingCsvText(assignmentCsvRows(rows)));
    }, [currentLesson, fileBase, seats, getCell, lessonScores, gradings]);

    const handleExportAuditCsv = useCallback(() => {
        if (!currentLesson) return;
        downloadText(`${fileBase}_検証用.csv`, buildAuditCsv([currentLesson], seats, getCell));
    }, [currentLesson, fileBase, seats, getCell]);

    /** Return every non-empty comment draft of the open assignment to its student. */
    const handleReturnComments = useCallback(async () => {
        // Returning does not replace the table, so it does not stop the others.
        const current = startRun(false);
        clearError();
        const targets = [];
        if (currentLesson) {
            for (const seatNumber of seats) {
                const key = cellKey(seatNumber, currentLesson.classroomId);
                const comment = (comments[key] || '').trim();
                const cell = matrix[key];
                if (comment && cell?.submissionId) {
                    targets.push({
                        lesson: currentLesson,
                        seatNumber,
                        key,
                        comment,
                        submissionId: cell.submissionId,
                    });
                }
            }
        }
        let done = 0;
        try {
            for (const target of targets) {
                if (!current()) return;
                setEvalProgress({ kind: 'return', done, total: targets.length });
                await classroomAPI.updateSubmission(
                    idTokenRef.current,
                    target.lesson.classroomId,
                    target.submissionId,
                    {
                        status: 'returned',
                        teacherComment: target.comment,
                    },
                );
                if (!current()) return;
                setMatrix((prev) => ({
                    ...prev,
                    [target.key]: { ...prev[target.key], returned: true, returnedComment: target.comment },
                }));
                done++;
            }
            if (current()) setEvalResult({ kind: 'return', count: done });
        } catch (err) {
            if (!current()) return;
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            showError(translateError(intl, err));
            setEvalResult({ kind: 'return', failed: true, done, total: targets.length });
        } finally {
            if (current()) setEvalProgress(null);
        }
    }, [currentLesson, seats, comments, matrix, clearError, showError, intl, handleTeacher401, startRun]);

    // What leaving would lose: comment drafts not returned, and grades whose save failed
    // (grades waiting for their delayed save are sent before leaving).
    const unsaved = useMemo(
        () => ({
            grades: Object.values(saveStates).includes('failed'),
            comments: hasUnreturnedComments(matrix, comments),
        }),
        [saveStates, matrix, comments],
    );
    const hasUnsavedWork = unsaved.grades || unsaved.comments;
    const busy = !!evalProgress;
    // Loading again on confirm uses the assignment open at that time (#1923 FYI1).
    const loadRef = useRef(handleLoadSubmissions);
    loadRef.current = handleLoadSubmissions;

    /**
     * Leave the grading screen, or re-load the table, only after asking when
     * work would be lost (#1923 C4): comments not returned, grades that could not
     * be saved, or the AI still running. Every way out goes through here
     * (cancel, breadcrumb, the modal's close, notifications, logout, the
     * menu bar and the kick toast's links, load). What is lost is shown from
     * `unsavedWork` as it is when drawn, not as it was when asked.
     * @param {Function} action - what to do once it is fine to leave
     * @param {'back'|'leave'|'reload'} [kind] - which question to ask
     */
    const requestLeave = useCallback(
        (action, kind = 'back') => {
            flushAllSaves();
            // Loading again keeps the comment drafts: only the grades not saved are lost.
            const lost = kind === 'reload' ? unsaved.grades : hasUnsavedWork;
            const waitsForAi = busy && kind !== 'reload';
            if (lost || waitsForAi) {
                setLeaveRequest({ kind, action });
                return;
            }
            // Leaving stops the runs (#1950); loading again stops them itself.
            if (kind !== 'reload') stopRuns();
            action();
        },
        [unsaved.grades, hasUnsavedWork, busy, stopRuns, flushAllSaves],
    );
    const confirmLeave = useCallback(() => {
        const request = leaveRequest;
        setLeaveRequest(null);
        if (!request) return;
        if (request.kind === 'reload') {
            loadRef.current();
            return;
        }
        // 「離れると、そこで止まります。」 (#1950)
        stopRuns();
        request.action();
    }, [leaveRequest, stopRuns]);
    const cancelLeave = useCallback(() => setLeaveRequest(null), []);

    /**
     * Save one assignment's grades read from the old grading-result CSV (#2431) and
     * show them in the gradebook. The caller builds the body (teacher grades, confirmed).
     */
    const handleImportGrading = useCallback(async (classroomId, body) => {
        const data = await classroomAPI.putGrading(idTokenRef.current, classroomId, body);
        setGradings((prev) => ({
            ...prev,
            [classroomId]: (data && data.grading) || { ...(prev[classroomId] || {}), ...body },
        }));
    }, []);

    const currentGrading = currentId ? gradings[currentId] || null : null;
    const rubricDone = !!(currentId && (rubricVisited[currentId] || columnStatus(currentGrading).hasRubric));

    return {
        rubricTools,
        evalGroup,
        evalLessons,
        view,
        currentId,
        currentLesson,
        currentGrading,
        gradings,
        handleImportGrading,
        loaded,
        rubricDone,
        gradeSaveState: currentId ? saveStates[currentId] || null : null,
        unconfirmedByEdit: !!(currentId && unconfirmed[currentId]),
        innerTab,
        selectedLessonIds,
        seats,
        matrix,
        comments,
        lessonScores,
        scoringChecked,
        scoringSavingId,
        rubricAxes,
        strictness,
        evalProgress,
        evalResult,
        getCell,
        handleSetStrictness: setStrictness,
        handleShowEvaluation,
        handleBackFromEvaluation,
        handleOpenAssignment,
        handleShowGradebook,
        handleShowOverall,
        handleSetInnerTab: setInnerTab,
        handleLoadSubmissions,
        handleRunAi,
        handleVisitRubric,
        handleConfirmGrades,
        handleSetCellGrade,
        handleSetCellReason,
        handleSetComment,
        handleChangeRubricAxis,
        handleCheckScoring,
        handleChangeLessonScoring,
        handleOpenWork: openSubmission ? handleOpenWork : null,
        openingWork,
        chosenCell,
        handleChooseCell: setChosenCell,
        handleExportEvaluationCsv,
        handleExportAuditCsv,
        handleReturnComments,
        hasUnsavedWork,
        unsavedWork: unsaved,
        leaveRequest,
        handleRequestLeave: requestLeave,
        handleConfirmLeave: confirmLeave,
        handleCancelLeave: cancelLeave,
    };
};

export default useTeacherEvaluation;
