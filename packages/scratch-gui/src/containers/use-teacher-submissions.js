/**
 * Teacher submission management hook.
 *
 * Handles opening, returning, and bulk-downloading student submissions,
 * as well as the code-display overlay and invite-link copy.
 */
import JSZip from 'jszip';
import { useCallback, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import {
    assignmentFolderNames,
    assignmentZipPlan,
    buildSubmissionsCsv,
    sanitizeEntryName,
} from '../lib/classroom-download-utils.js';
import { lessonProgressContext } from '../lib/classroom-lesson-progress.js';
import { mergedChallengeColumns, submissionCsvRows } from '../lib/classroom-lesson-summary.js';
import { findCourse } from '../lib/lessons/courses.js';
import { closeClassroomModal, closeTeacherModal, setTeacherOpenedWork } from '../reducers/classroom.js';
import translateError from './classroom-error-utils.js';
import { enrichMembers } from './use-teacher-classrooms.js';

/**
 * The lesson progress of an assignment for the 提出状況.csv columns (#1603).
 * A failed fetch leaves the lesson cells empty instead of failing the zip.
 * @param {string} token - teacher ID token
 * @param {object} assignment - the assignment (classroomId, hasLesson)
 * @returns {Promise<{progressData: ?object, ctx: ?object}>} progress and its context
 */
const loadLessonForCsv = async (token, assignment) => {
    if (!assignment || !assignment.hasLesson) return { progressData: null, ctx: null };
    try {
        const progressData = await classroomAPI.getLessonProgress(token, assignment.classroomId);
        const lesson = progressData && progressData.lesson;
        return { progressData, ctx: lesson ? lessonProgressContext(lesson, findCourse(lesson.courseId)) : null };
    } catch {
        return { progressData: null, ctx: null };
    }
};

/**
 * The challenge columns (with their names) of a 提出状況.csv.
 * @param {Array<?object>} contexts - lessonProgressContext of each assignment
 * @param {boolean} anyLesson - some assignment of the file has a lesson
 * @param {object} intl - react-intl intl object
 * @returns {?Array<{id: string, name: string}>} columns, or null for the old columns only
 */
const csvChallengeColumns = (contexts, anyLesson, intl) =>
    anyLesson
        ? mergedChallengeColumns(contexts).map((c) => ({ id: c.id, name: intl.formatMessage(c.challenge.name) }))
        : null;

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {object|null} params.selectedClassroom - currently selected classroom
 * @param {Array} params.members - current members list
 * @param {Function} params.handleTeacher401 - 401 handler from auth hook
 * @param {Function} params.loadClassroomDetail - reload detail after return
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setIsLoading - loading state setter
 * @param {object} params.vm - Scratch VM instance
 * @param {Function} params.dispatch - Redux dispatch
 * @returns {object} submission state and handler functions
 */
const useTeacherSubmissions = ({
    idToken,
    selectedClassroom,
    members,
    handleTeacher401,
    loadClassroomDetail,
    clearError,
    showError,
    intl,
    setIsLoading,
    vm,
    dispatch,
}) => {
    const [downloadProgress, setDownloadProgress] = useState(null);

    // --- Open student submission ---

    /**
     * Open a student's work in the editor and close class management (#1980).
     * The teacher screens stay as they were behind it, and the bar above the
     * editor offers to go back to them (#1990).
     * @param {string} projectUrl - link to the work
     * @param {{from: string, seatNumber: ?number, assignmentName: ?string}} [work] - where
     *   it was opened from, for the bar: 'evaluation' (grading) or 'assignment' (the
     *   assignment's members). The assignment name defaults to the selected assignment.
     */
    const handleOpenSubmission = useCallback(
        async (projectUrl, work = null) => {
            if (!projectUrl || !vm) return;
            clearError();
            setIsLoading(true);
            try {
                const response = await fetch(projectUrl);
                if (!response.ok) {
                    throw new Error(`Download failed: ${response.status}`);
                }
                const projectData = await response.arrayBuffer();
                await vm.loadProject(projectData);
                // The teacher screens live in their own modal now: close it too,
                // or the work opens behind it (#1980).
                dispatch(closeTeacherModal());
                dispatch(closeClassroomModal());
                if (work) {
                    dispatch(
                        setTeacherOpenedWork({
                            ...work,
                            assignmentName:
                                work.assignmentName ||
                                (selectedClassroom && selectedClassroom.assignmentName) ||
                                null,
                        }),
                    );
                }
            } catch (err) {
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [vm, dispatch, clearError, showError, intl, setIsLoading, selectedClassroom],
    );

    // --- Invite link ---

    const handleCopyInviteLink = useCallback((classroom) => {
        const url = new URL(window.location.href);
        url.searchParams.set('classcode', classroom.joinCode.toLowerCase());
        url.searchParams.delete('features');
        navigator.clipboard.writeText(url.toString()).catch(() => {
            // Clipboard API failed, ignore silently
        });
    }, []);

    // --- Return submission ---

    // Resolves true when the comment was returned (the container then drops its draft, #1990).
    const handleReturnSubmission = useCallback(
        async (submissionId, teacherComment) => {
            if (!idToken || !selectedClassroom) return false;
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.updateSubmission(idToken, selectedClassroom.classroomId, submissionId, {
                    status: 'returned',
                    teacherComment,
                });
                await loadClassroomDetail(selectedClassroom.classroomId);
                return true;
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [
            idToken,
            selectedClassroom,
            clearError,
            showError,
            handleTeacher401,
            intl,
            loadClassroomDetail,
            setIsLoading,
        ],
    );

    // --- Peer view (#1208): hide a submission from classmates ---

    const handleSetHiddenFromPeers = useCallback(
        async (submissionId, hiddenFromPeers) => {
            if (!idToken || !selectedClassroom || !submissionId) return;
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.updateSubmission(idToken, selectedClassroom.classroomId, submissionId, {
                    hiddenFromPeers: !!hiddenFromPeers,
                });
                await loadClassroomDetail(selectedClassroom.classroomId);
            } catch (err) {
                if (err.status === 401) {
                    await handleTeacher401();
                } else {
                    showError(translateError(intl, err));
                }
            } finally {
                setIsLoading(false);
            }
        },
        [
            idToken,
            selectedClassroom,
            clearError,
            showError,
            handleTeacher401,
            intl,
            loadClassroomDetail,
            setIsLoading,
        ],
    );

    // --- Download all submissions as ZIP ---

    const handleDownloadAll = useCallback(async () => {
        if (!selectedClassroom) return;
        const submittedMembers = (members || []).filter((m) => m.hasSubmission && m.projectUrl);
        const plan = assignmentZipPlan(!!selectedClassroom.hasLesson, submittedMembers.length);
        if (!plan) return;
        clearError();

        setDownloadProgress({ current: 0, total: Math.max(1, submittedMembers.length) });

        try {
            const zip = new JSZip();
            const className = selectedClassroom.className || 'class';

            for (let i = 0; i < submittedMembers.length; i++) {
                const m = submittedMembers[i];
                setDownloadProgress({
                    current: i + 1,
                    total: submittedMembers.length,
                });

                const seatLabel = m.memberId.replace('seat-', '');
                const name = m.displayName || '';
                const folderName = name ? `${seatLabel}_${name}` : seatLabel;
                const folder = zip.folder(folderName);

                // Download project .sb3
                try {
                    const res = await fetch(m.projectUrl);
                    if (res.ok) folder.file(`${m.projectName || 'project'}.sb3`, await res.blob());
                } catch {
                    // Skip failed downloads
                }

                // Download thumbnail
                if (m.thumbnailUrl) {
                    try {
                        const res = await fetch(m.thumbnailUrl);
                        if (res.ok) folder.file('thumbnail.png', await res.blob());
                    } catch {
                        // Skip
                    }
                }

                // Download screenshots
                for (let si = 0; si < (m.screenshotUrls || []).length; si++) {
                    try {
                        const res = await fetch(m.screenshotUrls[si]);
                        if (res.ok) folder.file(`screenshot-${si}.png`, await res.blob());
                    } catch {
                        // Skip
                    }
                }
            }

            // Lesson assignments only (#1603): 提出状況.csv with the lesson columns.
            if (plan.statusCsv) {
                const { progressData, ctx } = await loadLessonForCsv(idToken, selectedClassroom);
                const csvRows = submissionCsvRows({
                    assignmentName: selectedClassroom.assignmentName || selectedClassroom.className,
                    members: members || [],
                    progressData,
                    ctx,
                    now: Date.now(),
                });
                zip.file('提出状況.csv', buildSubmissionsCsv(csvRows, csvChallengeColumns([ctx], true, intl)));
            }

            // Generate and download ZIP
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${className}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            showError(translateError(intl, err));
        } finally {
            setDownloadProgress(null);
        }
    }, [idToken, selectedClassroom, members, clearError, showError, intl]);

    // --- Download the whole class (every assignment) as one ZIP ---

    /**
     * Class-wide bulk download (issue #1055): one zip with
     * `課題名/席番号_名前/作品.sb3` (+ thumbnail / screenshots) for every
     * assignment of the class, plus a 提出状況.csv summary. Archived
     * assignments are included — their submissions are TTL-bound too, and
     * "save everything before the deadline" is the whole point.
     * @param {object} group - the class (group) being downloaded
     * @param {Array<object>} assignments - the class's classrooms (active + archived)
     */
    const handleDownloadClassAll = useCallback(
        async (group, assignments) => {
            if (!group || !assignments || assignments.length === 0) return;
            clearError();
            setDownloadProgress({ current: 0, total: assignments.length });

            try {
                const folderNames = assignmentFolderNames(assignments);
                const zip = new JSZip();
                const csvRows = [];
                const lessonContexts = [];

                for (let ai = 0; ai < assignments.length; ai++) {
                    const assignment = assignments[ai];
                    setDownloadProgress({ current: ai + 1, total: assignments.length });

                    let enriched;
                    try {
                        const [membersData, submissionsData] = await Promise.all([
                            classroomAPI.listMembers(idToken, assignment.classroomId),
                            classroomAPI.listSubmissions(idToken, assignment.classroomId),
                        ]);
                        enriched = enrichMembers(membersData, submissionsData);
                    } catch (err) {
                        if (err.status === 401) {
                            await handleTeacher401();
                            return;
                        }
                        // Skip assignments that fail to load; the rest of the
                        // class is still worth saving.
                        continue;
                    }

                    const { progressData, ctx } = await loadLessonForCsv(idToken, assignment);
                    lessonContexts.push(ctx);
                    csvRows.push(
                        ...submissionCsvRows({
                            assignmentName: assignment.assignmentName || assignment.className,
                            members: enriched,
                            progressData,
                            ctx,
                            now: Date.now(),
                        }),
                    );

                    const assignmentFolder = folderNames.get(assignment.classroomId);
                    for (const m of enriched) {
                        const seatLabel = (m.memberId || '').replace('seat-', '');
                        if (!m.hasSubmission || !m.projectUrl) continue;

                        const name = m.displayName || '';
                        const folder = zip.folder(
                            `${assignmentFolder}/${sanitizeEntryName(name ? `${seatLabel}_${name}` : seatLabel)}`,
                        );

                        try {
                            const res = await fetch(m.projectUrl);
                            if (res.ok) {
                                folder.file(`${sanitizeEntryName(m.projectName || 'project')}.sb3`, await res.blob());
                            }
                        } catch {
                            // Skip failed downloads
                        }
                        if (m.thumbnailUrl) {
                            try {
                                const res = await fetch(m.thumbnailUrl);
                                if (res.ok) folder.file('thumbnail.png', await res.blob());
                            } catch {
                                // Skip
                            }
                        }
                        for (let si = 0; si < (m.screenshotUrls || []).length; si++) {
                            try {
                                const res = await fetch(m.screenshotUrls[si]);
                                if (res.ok) folder.file(`screenshot-${si}.png`, await res.blob());
                            } catch {
                                // Skip
                            }
                        }
                    }
                }

                const anyLesson = assignments.some((a) => a.hasLesson);
                zip.file(
                    '提出状況.csv',
                    buildSubmissionsCsv(csvRows, csvChallengeColumns(lessonContexts, anyLesson, intl)),
                );

                const blob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${sanitizeEntryName(group.name || 'class')}_全課題.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (err) {
                showError(translateError(intl, err));
            } finally {
                setDownloadProgress(null);
            }
        },
        [idToken, clearError, showError, handleTeacher401, intl],
    );

    return {
        downloadProgress,
        handleOpenSubmission,
        handleCopyInviteLink,
        handleReturnSubmission,
        handleSetHiddenFromPeers,
        handleDownloadAll,
        handleDownloadClassAll,
    };
};

export default useTeacherSubmissions;
