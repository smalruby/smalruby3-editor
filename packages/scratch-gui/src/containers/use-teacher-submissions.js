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
    buildSubmissionsCsv,
    sanitizeEntryName,
    submissionStatusLabel,
} from '../lib/classroom-download-utils.js';
import { closeClassroomModal } from '../reducers/classroom.js';
import translateError from './classroom-error-utils.js';
import { enrichMembers } from './use-teacher-classrooms.js';

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {object|null} params.selectedClassroom - currently selected classroom
 * @param {Array} params.members - current members list
 * @param {Function} params.handleTeacher401 - 401 handler from auth hook
 * @param {Function} params.loadClassroomDetail - reload detail after return
 * @param {string} params.mode - 'student' | 'teacher'
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
    mode,
    clearError,
    showError,
    intl,
    setIsLoading,
    vm,
    dispatch,
}) => {
    const [codeDisplayClassroom, setCodeDisplayClassroom] = useState(null);
    const [codeDisplayFullscreen, setCodeDisplayFullscreen] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(null);

    // --- Open student submission ---

    const handleOpenSubmission = useCallback(
        async (projectUrl) => {
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
                dispatch(closeClassroomModal());
            } catch (err) {
                showError(translateError(intl, err));
            } finally {
                setIsLoading(false);
            }
        },
        [vm, dispatch, clearError, showError, intl, setIsLoading],
    );

    // --- Code display ---

    const handleShowCodeDisplay = useCallback(() => {
        if (selectedClassroom) {
            setCodeDisplayClassroom(selectedClassroom);
            setCodeDisplayFullscreen(mode === 'teacher');
        }
    }, [selectedClassroom, mode]);

    const handleCloseCodeDisplay = useCallback(() => {
        setCodeDisplayClassroom(null);
        setCodeDisplayFullscreen(false);
    }, []);

    const handleToggleCodeFullscreen = useCallback(() => {
        setCodeDisplayFullscreen((prev) => !prev);
    }, []);

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

    const handleReturnSubmission = useCallback(
        async (submissionId, teacherComment) => {
            if (!idToken || !selectedClassroom) return;
            clearError();
            setIsLoading(true);
            try {
                await classroomAPI.updateSubmission(idToken, selectedClassroom.classroomId, submissionId, {
                    status: 'returned',
                    teacherComment,
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
        if (!selectedClassroom || !members || members.length === 0) return;
        clearError();

        const submittedMembers = members.filter((m) => m.hasSubmission && m.projectUrl);
        if (submittedMembers.length === 0) return;

        setDownloadProgress({ current: 0, total: submittedMembers.length });

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
    }, [selectedClassroom, members, clearError, showError, intl]);

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

                    const assignmentFolder = folderNames.get(assignment.classroomId);
                    for (const m of enriched) {
                        const seatLabel = (m.memberId || '').replace('seat-', '');
                        csvRows.push({
                            assignmentName: assignment.assignmentName || assignment.className,
                            seat: seatLabel,
                            name: m.displayName || '',
                            projectName: m.projectName || '',
                            submittedAt: m.submittedAt || '',
                            status: submissionStatusLabel(m),
                        });
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

                zip.file('提出状況.csv', buildSubmissionsCsv(csvRows));

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

    /** Reset display state (used by back-to-dashboard). */
    const resetSubmissionDisplay = useCallback(() => {
        setCodeDisplayClassroom(null);
        setCodeDisplayFullscreen(false);
    }, []);

    return {
        codeDisplayClassroom,
        codeDisplayFullscreen,
        downloadProgress,
        handleOpenSubmission,
        handleShowCodeDisplay,
        handleCloseCodeDisplay,
        handleToggleCodeFullscreen,
        handleCopyInviteLink,
        handleReturnSubmission,
        handleDownloadAll,
        handleDownloadClassAll,
        resetSubmissionDisplay,
    };
};

export default useTeacherSubmissions;
