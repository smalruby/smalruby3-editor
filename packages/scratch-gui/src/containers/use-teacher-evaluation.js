/**
 * Term-end evaluation hook (teacher side).
 *
 * Flow: pick a group → select its lessons → load submissions (download each
 * sb3, unzip, static-analyze) → optionally grade a few cells by hand
 * (calibration samples) → run the AI for grade proposals → review/fix →
 * export CSVs and/or generate positive comment drafts → return comments.
 *
 * The matrix is a plain object keyed by `${seatNumber}:${classroomId}`.
 * Each cell: {submissionId, submitted, signals, pseudocode, grade, reason,
 * needsReview, comment, returned, returnedComment}.
 *
 * Grades live only here and in the exported 「採点結果」 CSV (returning sends
 * only the comment), so leaving with grades not exported or comments not
 * returned asks first (#1923 C4: `hasUnsavedWork` / `requestLeave`).
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
    evaluationSnapshot,
    unsavedEvaluation,
    isLessonOnlyAssignment,
} from '../lib/classroom-evaluation/evaluation-utils.js';
import { analyzeProject } from '../lib/classroom-evaluation/sb3-analyzer.js';
import { isSameLessonScoring } from '../lib/classroom-lesson-settings.js';
import { lessonScoresBySeat } from '../lib/classroom-lesson-summary.js';
import { findCourse } from '../lib/lessons/courses.js';
import translateError from './classroom-error-utils.js';

const evaluationMessages = defineMessages({
    lessonRemoved: {
        defaultMessage: 'This assignment no longer has a lesson, so the points were not saved.',
        description: 'Grading screen: the lesson was removed elsewhere before the lesson points were saved (#1778)',
        id: 'gui.classroom.evaluation.lessonRemoved',
    },
    openWorkFailed: {
        defaultMessage:
            'The work could not be opened. Wait a moment and press [Open the work] again. If it still fails, ' +
            'load the submissions again (grades not exported will be lost).',
        description:
            'Grading screen: [Open the work] could not get the link to the work (a network error, or it was ' +
            'taken back). Trying again first keeps the grades; loading again drops grades not exported (#1980)',
        id: 'gui.classroom.evaluation.openWorkFailed',
    },
});

const EVAL_CHUNK_SIZE = 10;
// The link to a work (`projectUrl`) is a signed URL that ends after an hour by
// default (PRESIGNED_URL_DOWNLOAD_EXPIRY). Grading often takes longer, so an old
// link is fetched again before opening (#1980). A little under the hour.
const WORK_URL_FRESH_MS = 50 * 60 * 1000;
const cellKey = (seatNumber, classroomId) => `${seatNumber}:${classroomId}`;
const seatFromMemberId = (memberId) => {
    const match = /^seat-(\d+)$/.exec(memberId || '');
    return match ? parseInt(match[1], 10) : null;
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
 * @returns {object} evaluation state and handlers
 */
const useTeacherEvaluation = ({
    idToken,
    classrooms,
    handleTeacher401,
    clearError,
    showError,
    intl,
    setPhase,
    openSubmission,
}) => {
    const [evalGroup, setEvalGroup] = useState(null);
    const [evalLessons, setEvalLessons] = useState([]);
    const [selectedLessonIds, setSelectedLessonIds] = useState([]);
    const [matrix, setMatrix] = useState({});
    const [seats, setSeats] = useState([]);
    const [rubricAxes, setRubricAxes] = useState(DEFAULT_RUBRIC_AXES);
    const [strictness, setStrictness] = useState('standard');
    // {label, done, total} while loading submissions / calling the AI
    const [evalProgress, setEvalProgress] = useState(null);
    const [comments, setComments] = useState({});
    // classroomId → lessonScoresBySeat (null = cannot be scored) for lesson assignments (#1603)
    const [lessonScores, setLessonScores] = useState({});
    // classroomId → GET lesson-progress (kept to re-score after the points change, #1778)
    const [lessonProgress, setLessonProgress] = useState({});
    // The teacher has checked (or changed) the lesson points: the lesson-only flow moves on (#1778)
    const [scoringChecked, setScoringChecked] = useState(false);
    // classroomId whose lesson points are being saved
    const [scoringSavingId, setScoringSavingId] = useState(null);
    // evaluationSnapshot of the matrix at the last 「採点結果」 export (#1923 C4)
    const [exported, setExported] = useState({});
    // A leave waiting for the teacher's answer: {kind: 'back'|'leave'|'reload', action} (#1923 C4)
    const [leaveRequest, setLeaveRequest] = useState(null);
    // Settings fetched for a group that is no longer shown are dropped.
    const shownGroupRef = useRef(null);
    // Generation of the runs (load / AI / return): a run that is no longer
    // current stops and writes nothing (#1950).
    const runRef = useRef(0);
    const stopRuns = useCallback(() => {
        runRef.current++;
    }, []);
    /**
     * Start a run in the current generation.
     * @param {boolean} replace - true for a run that replaces the table (load / AI): it stops the older ones
     * @returns {Function} true while the run is still current
     */
    const startRun = useCallback((replace) => {
        if (replace) runRef.current++;
        const run = runRef.current;
        return () => runRef.current === run;
    }, []);
    // Logging out on purpose unmounts this (ClassroomTeacherModalHost, #1990).
    useEffect(() => stopRuns, [stopRuns]);
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

    const handleShowEvaluation = useCallback(
        (group) => {
            clearError();
            const lessons = (classrooms || [])
                .filter((c) => c.groupId === group.groupId)
                .map((c) => ({
                    classroomId: c.classroomId,
                    assignmentName: c.assignmentName || '',
                    hasLesson: !!c.hasLesson,
                }));
            shownGroupRef.current = group.groupId;
            stopRuns();
            setEvalGroup(group);
            setEvalLessons(lessons);
            setSelectedLessonIds(lessons.map((l) => l.classroomId));
            setMatrix({});
            setSeats([]);
            setComments({});
            setLessonScores({});
            setLessonProgress({});
            setScoringChecked(false);
            setScoringSavingId(null);
            setEvalProgress(null);
            setExported({});
            setLeaveRequest(null);
            setChosenCell(null);
            setPhase('teacher-evaluation');
            // The lesson settings decide the flow (lesson-only assignments are not
            // graded by the AI) and feed the lesson points field (#1778). A failed
            // read leaves the assignment in the usual flow.
            lessons
                .filter((l) => l.hasLesson)
                .forEach((l) => {
                    classroomAPI
                        .getAssignment(idToken, l.classroomId)
                        .then((data) => {
                            if (shownGroupRef.current !== group.groupId) return;
                            const lessonSetting = (data && data.lesson) || null;
                            setEvalLessons((prev) =>
                                prev.map((x) => (x.classroomId === l.classroomId ? { ...x, lessonSetting } : x)),
                            );
                        })
                        .catch(() => {});
                });
        },
        [idToken, classrooms, clearError, setPhase, stopRuns],
    );

    const handleBackFromEvaluation = useCallback(() => {
        stopRuns();
        clearError();
        setLeaveRequest(null);
        setEvalProgress(null);
        setPhase('teacher-class-list');
    }, [clearError, setPhase, stopRuns]);

    const handleToggleLesson = useCallback((classroomId) => {
        setSelectedLessonIds((prev) =>
            prev.includes(classroomId) ? prev.filter((id) => id !== classroomId) : [...prev, classroomId],
        );
    }, []);

    /** Load submissions of the selected lessons and static-analyze each sb3. */
    const handleLoadSubmissions = useCallback(async () => {
        const current = startRun(true);
        clearError();
        const targets = evalLessons.filter((l) => selectedLessonIds.includes(l.classroomId));
        const nextMatrix = {};
        const nextLessonScores = {};
        const nextLessonProgress = {};
        const nextUrlsReadAt = {};
        const seatSet = new Set();
        let done = 0;
        try {
            for (const lesson of targets) {
                if (!current()) return;
                setEvalProgress({ label: lesson.assignmentName, done, total: targets.length });
                if (lesson.hasLesson) {
                    // The lesson score comes from the progress, not the work (#1603).
                    // A failed fetch leaves the scores empty (「—」) but still reads the
                    // setting, so an assignment without work keeps showing no work column.
                    const notAuthorized = (err) => {
                        if (err.status === 401) throw err;
                        return null;
                    };
                    let progressData = await classroomAPI
                        .getLessonProgress(idToken, lesson.classroomId)
                        .catch(notAuthorized);
                    if (!progressData) {
                        const assignment = await classroomAPI
                            .getAssignment(idToken, lesson.classroomId)
                            .catch(notAuthorized);
                        progressData =
                            assignment && assignment.lesson ? { lesson: assignment.lesson, progress: [] } : null;
                    }
                    const saved = progressData && progressData.lesson;
                    const scored = saved
                        ? lessonScoresBySeat(progressData, findCourse(saved.courseId), Date.now())
                        : null;
                    nextLessonScores[lesson.classroomId] = scored;
                    nextLessonProgress[lesson.classroomId] = progressData;
                    if (scored) Object.keys(scored.scores).forEach((seat) => seatSet.add(Number(seat)));
                    // No work is submitted: nothing to download or grade (#1778).
                    if (isLessonOnlyAssignment(lesson, nextLessonScores)) {
                        done++;
                        continue;
                    }
                }
                if (!current()) return;
                const data = await classroomAPI.listSubmissions(idToken, lesson.classroomId);
                nextUrlsReadAt[lesson.classroomId] = Date.now();
                for (const submission of data.submissions || []) {
                    if (!current()) return;
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
                        const response = await fetch(submission.projectUrl);
                        if (!response.ok) throw new Error(`download ${response.status}`);
                        const zip = await JSZip.loadAsync(await response.arrayBuffer());
                        const projectFile = zip.file('project.json');
                        if (projectFile) {
                            const projectJson = JSON.parse(await projectFile.async('string'));
                            const { signals, pseudocode } = analyzeProject(projectJson);
                            cell.signals = signals;
                            cell.pseudocode = pseudocode;
                        }
                    } catch (err) {
                        // Analysis failure is per-cell: keep the submission
                        // visible and let the AI/teacher treat it as unknown.
                        cell.pseudocode = `(解析失敗: ${err.message})`;
                        cell.needsReview = true;
                    }
                    nextMatrix[cellKey(seatNumber, lesson.classroomId)] = cell;
                }
                done++;
            }
            if (!current()) return;
            setMatrix(nextMatrix);
            urlsReadAtRef.current = nextUrlsReadAt;
            setExported({});
            setLessonScores(nextLessonScores);
            setLessonProgress(nextLessonProgress);
            setScoringChecked(false);
            setSeats([...seatSet].sort((a, b) => a - b));
        } catch (err) {
            if (!current()) return;
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            showError(translateError(intl, err));
        } finally {
            if (current()) setEvalProgress(null);
        }
    }, [idToken, evalLessons, selectedLessonIds, clearError, showError, intl, handleTeacher401, startRun]);

    /** Run the AI per lesson (grade proposals or comment drafts). */
    const handleRunAi = useCallback(
        async (mode) => {
            const current = startRun(true);
            clearError();
            const targets = evalLessons.filter((l) => selectedLessonIds.includes(l.classroomId));
            let done = 0;
            try {
                for (const lesson of targets) {
                    const cells = seats
                        .map((seatNumber) => ({ seatNumber, cell: matrix[cellKey(seatNumber, lesson.classroomId)] }))
                        .filter((entry) => entry.cell && entry.cell.submitted);
                    if (cells.length === 0) {
                        done++;
                        continue;
                    }
                    // Calibration: hand-graded cells of this lesson (up to 5)
                    const samples = cells
                        .filter((entry) => entry.cell.grade && entry.cell.manual)
                        .slice(0, 5)
                        .map((entry) => ({
                            seatNumber: entry.seatNumber,
                            grade: entry.cell.grade,
                            ...(entry.cell.reason ? { reason: entry.cell.reason } : {}),
                        }));
                    const pending = mode === 'grade' ? cells.filter((entry) => !entry.cell.manual) : cells;
                    const chunks = chunk(pending, EVAL_CHUNK_SIZE);
                    for (let i = 0; i < chunks.length; i++) {
                        if (!current()) return;
                        setEvalProgress({
                            label: `${lesson.assignmentName} (${i + 1}/${chunks.length})`,
                            done,
                            total: targets.length,
                        });
                        const payload = {
                            mode,
                            assignmentName: lesson.assignmentName,
                            assignmentText: '',
                            rubricAxes,
                            strictness,
                            samples,
                            submissions: chunks[i].map((entry) => ({
                                seatNumber: entry.seatNumber,
                                signals: entry.cell.signals || {},
                                pseudocode: entry.cell.pseudocode || '',
                            })),
                        };
                        const data = await classroomAPI.evaluateSubmissions(idToken, lesson.classroomId, payload);
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
                    }
                    done++;
                }
            } catch (err) {
                if (!current()) return;
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                if (current()) setEvalProgress(null);
            }
        },
        [
            idToken,
            evalLessons,
            selectedLessonIds,
            seats,
            matrix,
            rubricAxes,
            strictness,
            clearError,
            showError,
            intl,
            handleTeacher401,
            startRun,
        ],
    );

    const handleCheckScoring = useCallback(() => setScoringChecked(true), []);

    /**
     * Open the work of a cell in the editor (#1980), the same way as
     * 「スモウルビーで開く」 of the assignment's members. The modal closes but this
     * hook stays mounted (#1990), so nothing is lost and it does not ask. A link read more than
     * WORK_URL_FRESH_MS ago is read again (it may have ended), without loading
     * the table again (that would drop grades not exported).
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
                        const data = await classroomAPI.listSubmissions(idToken, classroomId);
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
        [
            matrix,
            evalLessons,
            openSubmission,
            idToken,
            clearError,
            showError,
            intl,
            handleTeacher401,
            markOpeningWork,
        ],
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
                const saved = await classroomAPI.setLessonScoring(idToken, classroomId, scoring);
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
                const fresh = await classroomAPI.getAssignment(idToken, classroomId).catch(() => UNREAD);
                apply(fresh === UNREAD ? before : (fresh && fresh.lesson) || null);
                showError(translateError(intl, err));
            } finally {
                setScoringSavingId(null);
            }
        },
        [idToken, evalLessons, lessonProgress, clearError, showError, intl, handleTeacher401],
    );

    /**
     * Teacher edits a cell — marks it manual so it feeds calibration (and the AI
     * does not grade it again). `gradeEdited` is only for the screen: the grade is
     * no longer the AI's draft (#1962). Editing only the reason keeps the AI's grade,
     * so it stays a draft. Kept in the browser only; nothing is sent to the API.
     */
    const handleSetCellGrade = useCallback((seatNumber, classroomId, grade) => {
        setMatrix((prev) => {
            const key = cellKey(seatNumber, classroomId);
            if (!prev[key]) return prev;
            return {
                ...prev,
                [key]: { ...prev[key], grade: grade || null, needsReview: false, manual: true, gradeEdited: true },
            };
        });
    }, []);

    const handleSetCellReason = useCallback((seatNumber, classroomId, reason) => {
        setMatrix((prev) => {
            const key = cellKey(seatNumber, classroomId);
            if (!prev[key]) return prev;
            return { ...prev, [key]: { ...prev[key], reason, manual: true } };
        });
    }, []);

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

    const selectedLessons = evalLessons.filter((l) => selectedLessonIds.includes(l.classroomId));

    const handleExportEvaluationCsv = useCallback(() => {
        // The CSV is the only place the grades are kept (#1923 C4): remember
        // what it has (the selected assignments only, like the CSV).
        const ids = new Set(selectedLessons.map((lesson) => lesson.classroomId));
        const inCsv = Object.fromEntries(
            Object.entries(matrix).filter(([key]) => ids.has(key.slice(key.indexOf(':') + 1))),
        );
        setExported((prev) => ({ ...prev, ...evaluationSnapshot(inCsv) }));
        downloadText(
            `${evalGroup?.name || 'class'}_採点結果.csv`,
            buildEvaluationCsv(selectedLessons, seats, getCell, lessonScores),
        );
    }, [evalGroup, matrix, selectedLessons, seats, getCell, lessonScores]);

    const handleExportAuditCsv = useCallback(() => {
        downloadText(`${evalGroup?.name || 'class'}_検証用.csv`, buildAuditCsv(selectedLessons, seats, getCell));
    }, [evalGroup, selectedLessons, seats, getCell]);

    /** Return every non-empty comment draft to its student. */
    const handleReturnComments = useCallback(async () => {
        // Returning does not replace the table, so it does not stop the others.
        const current = startRun(false);
        clearError();
        const targets = [];
        for (const lesson of selectedLessons) {
            for (const seatNumber of seats) {
                const key = cellKey(seatNumber, lesson.classroomId);
                const comment = (comments[key] || '').trim();
                const cell = matrix[key];
                if (comment && cell?.submissionId) {
                    targets.push({ lesson, seatNumber, key, comment, submissionId: cell.submissionId });
                }
            }
        }
        let done = 0;
        try {
            for (const target of targets) {
                if (!current()) return;
                setEvalProgress({ label: `返却 ${done + 1}/${targets.length}`, done, total: targets.length });
                await classroomAPI.updateSubmission(idToken, target.lesson.classroomId, target.submissionId, {
                    status: 'returned',
                    teacherComment: target.comment,
                });
                if (!current()) return;
                setMatrix((prev) => ({
                    ...prev,
                    [target.key]: { ...prev[target.key], returned: true, returnedComment: target.comment },
                }));
                done++;
            }
        } catch (err) {
            if (!current()) return;
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            showError(translateError(intl, err));
        } finally {
            if (current()) setEvalProgress(null);
        }
    }, [idToken, selectedLessons, seats, comments, matrix, clearError, showError, intl, handleTeacher401, startRun]);

    const unsaved = useMemo(() => unsavedEvaluation({ matrix, comments, exported }), [matrix, comments, exported]);
    const hasUnsavedWork = unsaved.grades || unsaved.comments;
    const busy = !!evalProgress;
    // Loading again on confirm uses the selection at that time (#1923 FYI1).
    const loadRef = useRef(handleLoadSubmissions);
    loadRef.current = handleLoadSubmissions;

    /**
     * Leave the grading screen, or re-load the table, only after asking when
     * work would be lost (#1923 C4): grades not exported, comments not
     * returned, or the AI still running. Every way out goes through here
     * (cancel, breadcrumb, the modal's close, notifications, logout, the
     * menu bar and the kick toast's links, load). What is lost is shown from
     * `unsavedWork` as it is when drawn, not as it was when asked.
     * @param {Function} action - what to do once it is fine to leave
     * @param {'back'|'leave'|'reload'} [kind] - which question to ask
     */
    const requestLeave = useCallback(
        (action, kind = 'back') => {
            // Loading again keeps the comment drafts: only the grades are lost.
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
        [unsaved.grades, hasUnsavedWork, busy, stopRuns],
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

    return {
        evalGroup,
        evalLessons,
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
        getCell,
        handleSetStrictness: setStrictness,
        handleShowEvaluation,
        handleBackFromEvaluation,
        handleToggleLesson,
        handleLoadSubmissions,
        handleRunAi,
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
