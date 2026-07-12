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
 * needsReview, comment, returned}.
 */
import JSZip from 'jszip';
import { useCallback, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import {
    DEFAULT_RUBRIC_AXES,
    buildAuditCsv,
    buildEvaluationCsv,
    chunk,
} from '../lib/classroom-evaluation/evaluation-utils.js';
import { analyzeProject } from '../lib/classroom-evaluation/sb3-analyzer.js';
import translateError from './classroom-error-utils.js';

const EVAL_CHUNK_SIZE = 10;
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
 * @returns {object} evaluation state and handlers
 */
const useTeacherEvaluation = ({ idToken, classrooms, handleTeacher401, clearError, showError, intl, setPhase }) => {
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

    const handleShowEvaluation = useCallback(
        (group) => {
            clearError();
            const lessons = (classrooms || [])
                .filter((c) => c.groupId === group.groupId)
                .map((c) => ({ classroomId: c.classroomId, assignmentName: c.assignmentName || '' }));
            setEvalGroup(group);
            setEvalLessons(lessons);
            setSelectedLessonIds(lessons.map((l) => l.classroomId));
            setMatrix({});
            setSeats([]);
            setComments({});
            setEvalProgress(null);
            setPhase('teacher-evaluation');
        },
        [classrooms, clearError, setPhase],
    );

    const handleBackFromEvaluation = useCallback(() => {
        clearError();
        setEvalProgress(null);
        setPhase('teacher-class-list');
    }, [clearError, setPhase]);

    const handleToggleLesson = useCallback((classroomId) => {
        setSelectedLessonIds((prev) =>
            prev.includes(classroomId) ? prev.filter((id) => id !== classroomId) : [...prev, classroomId],
        );
    }, []);

    /** Load submissions of the selected lessons and static-analyze each sb3. */
    const handleLoadSubmissions = useCallback(async () => {
        clearError();
        const targets = evalLessons.filter((l) => selectedLessonIds.includes(l.classroomId));
        const nextMatrix = {};
        const seatSet = new Set();
        let done = 0;
        try {
            for (const lesson of targets) {
                setEvalProgress({ label: lesson.assignmentName, done, total: targets.length });
                const data = await classroomAPI.listSubmissions(idToken, lesson.classroomId);
                for (const submission of data.submissions || []) {
                    const seatNumber = seatFromMemberId(submission.memberId);
                    if (seatNumber === null) continue;
                    seatSet.add(seatNumber);
                    const cell = {
                        submissionId: submission.submissionId,
                        submitted: true,
                        returned: submission.status === 'returned',
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
            setMatrix(nextMatrix);
            setSeats([...seatSet].sort((a, b) => a - b));
        } catch (err) {
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            showError(translateError(intl, err));
        } finally {
            setEvalProgress(null);
        }
    }, [idToken, evalLessons, selectedLessonIds, clearError, showError, intl, handleTeacher401]);

    /** Run the AI per lesson (grade proposals or comment drafts). */
    const handleRunAi = useCallback(
        async (mode) => {
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
                if (err.status === 401) {
                    handleTeacher401();
                    return;
                }
                showError(translateError(intl, err));
            } finally {
                setEvalProgress(null);
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
        ],
    );

    /** Teacher edits a cell — marks it manual so it feeds calibration. */
    const handleSetCellGrade = useCallback((seatNumber, classroomId, grade) => {
        setMatrix((prev) => {
            const key = cellKey(seatNumber, classroomId);
            if (!prev[key]) return prev;
            return {
                ...prev,
                [key]: { ...prev[key], grade: grade || null, needsReview: false, manual: true },
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
        downloadText(`${evalGroup?.name || 'class'}_評価.csv`, buildEvaluationCsv(selectedLessons, seats, getCell));
    }, [evalGroup, selectedLessons, seats, getCell]);

    const handleExportAuditCsv = useCallback(() => {
        downloadText(`${evalGroup?.name || 'class'}_検証用.csv`, buildAuditCsv(selectedLessons, seats, getCell));
    }, [evalGroup, selectedLessons, seats, getCell]);

    /** Return every non-empty comment draft to its student. */
    const handleReturnComments = useCallback(async () => {
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
                setEvalProgress({ label: `返却 ${done + 1}/${targets.length}`, done, total: targets.length });
                await classroomAPI.updateSubmission(idToken, target.lesson.classroomId, target.submissionId, {
                    status: 'returned',
                    teacherComment: target.comment,
                });
                setMatrix((prev) => ({
                    ...prev,
                    [target.key]: { ...prev[target.key], returned: true },
                }));
                done++;
            }
        } catch (err) {
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            showError(translateError(intl, err));
        } finally {
            setEvalProgress(null);
        }
    }, [idToken, selectedLessons, seats, comments, matrix, clearError, showError, intl, handleTeacher401]);

    return {
        evalGroup,
        evalLessons,
        selectedLessonIds,
        seats,
        matrix,
        comments,
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
        handleExportEvaluationCsv,
        handleExportAuditCsv,
        handleReturnComments,
    };
};

export default useTeacherEvaluation;
