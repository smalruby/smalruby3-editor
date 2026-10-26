/**
 * Student assignment hook.
 *
 * Fetches the assignment content of the joined classroom and loads the
 * starter project into the VM. When the seat has submissions to continue
 * from (#1201) — this assignment's or the previous assignment's of the same
 * class — the student chooses where to start instead of the starter opening
 * automatically. Nothing clobbers work silently: when the open project has
 * unsaved changes the student is asked first.
 */
import { useCallback, useState } from 'react';
import { defineMessages } from 'react-intl';
import { useSelector } from 'react-redux';
import classroomAPI from '../lib/classroom-api.js';
import { normalizeContinueOptions } from '../lib/classroom-continue-options.js';
import { loadProjectWithChecks } from '../lib/project-loader-utils.js';
import translateError from './classroom-error-utils.js';

const messages = defineMessages({
    overwriteConfirm: {
        defaultMessage: 'Open the assignment starter project? Your current project will be replaced.',
        description: 'Confirm dialog before the starter project replaces an edited project',
        id: 'gui.classroom.studentAssignment.overwriteConfirm',
    },
    overwriteConfirmPrevious: {
        defaultMessage: "Open last time's submitted project? Your current project will be replaced.",
        description: 'Confirm dialog before the previous assignment submission replaces an edited project',
        id: 'gui.classroom.continueChoice.confirmPrevious',
    },
    overwriteConfirmCurrent: {
        defaultMessage: 'Open the project you submitted for this assignment? Your current project will be replaced.',
        description: "Confirm dialog before this assignment's own submission replaces an edited project",
        id: 'gui.classroom.continueChoice.confirmCurrent',
    },
    starterLoadFailed: {
        defaultMessage: 'Failed to open the starter project',
        description: 'Error when downloading/loading the starter project fails',
        id: 'gui.classroom.studentAssignment.starterLoadFailed',
    },
    submissionLoadFailed: {
        defaultMessage: 'Failed to open the submitted project',
        description: 'Error when downloading/loading a submitted project to continue from fails',
        id: 'gui.classroom.continueChoice.loadFailed',
    },
    submissionGone: {
        defaultMessage: 'That submitted project is no longer available',
        description: 'Error when the chosen submitted project has expired or was removed',
        id: 'gui.classroom.continueChoice.gone',
    },
});

/**
 * @param {object} params - hook dependencies
 * @param {object} params.classroomState - Redux classroom state (session)
 * @param {object} params.vm - Scratch VM instance
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {Function} params.setIsLoading - loading state setter
 * @param {Function} params.setPhase - phase setter
 * @param {Function} [params.onStarted] - called once a project chosen in the
 *     choice row has loaded: the choice starts the work (closes the modal)
 * @returns {object} student assignment state and handlers
 */
const useStudentAssignment = ({
    classroomState,
    vm,
    intl,
    clearError,
    showError,
    setIsLoading,
    setPhase,
    onStarted,
}) => {
    const projectChanged = useSelector((state) => state.scratchGui.projectChanged);

    const [assignment, setAssignment] = useState(null);
    const [assignmentPageIndex, setAssignmentPageIndex] = useState(0);
    // Whether the joined classroom carries assignment content. Comes from the
    // join / verify-session responses so the status view can offer the
    // "View Assignment" button without an extra request.
    const [hasAssignment, setHasAssignment] = useState(false);

    // Submissions to continue from ({current, previous}) or null when there
    // are none, and which choice was last loaded ('starter' | 'previous' |
    // 'current') so the choice row can mark it.
    const [continueOptions, setContinueOptions] = useState(null);
    const [loadedChoice, setLoadedChoice] = useState(null);

    /**
     * Download an sb3 and load it into the VM. Asks for confirmation when the
     * open project has unsaved changes (never clobbers silently).
     * @param {string} url - presigned download URL
     * @param {object} [confirmMessage] - confirm text naming what replaces the project
     * @returns {Promise<boolean>} true when the project was loaded
     */
    const loadProjectFromUrl = useCallback(
        async (url, confirmMessage = messages.overwriteConfirm) => {
            if (projectChanged) {
                // eslint-disable-next-line no-alert
                if (!window.confirm(intl.formatMessage(confirmMessage))) {
                    return false;
                }
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Project download failed: ${response.status}`);
            }
            const projectData = await response.arrayBuffer();
            await loadProjectWithChecks(vm, intl, projectData);
            return true;
        },
        [projectChanged, vm, intl],
    );

    /**
     * Load the assignment's starter project.
     * @param {object} assignmentData - assignment content with starterUrl
     * @returns {Promise<boolean>} true when the starter was loaded
     */
    const loadStarter = useCallback(
        async (assignmentData) => {
            if (!assignmentData?.starterUrl) return false;
            const loaded = await loadProjectFromUrl(assignmentData.starterUrl);
            if (loaded) setLoadedChoice('starter');
            return loaded;
        },
        [loadProjectFromUrl],
    );

    /**
     * Fetch the submissions to continue from. Best-effort: a failure means
     * "nothing to offer" so the join / status view keeps working.
     * @param {string} sessionToken - student session token
     * @param {string} classroomId - joined classroom ID
     * @returns {Promise<?object>} normalized options or null
     */
    const fetchContinueOptions = useCallback(async (sessionToken, classroomId) => {
        try {
            const options = normalizeContinueOptions(
                await classroomAPI.getContinuableSubmissions(sessionToken, classroomId),
            );
            setContinueOptions(options);
            return options;
        } catch {
            return null;
        }
    }, []);

    /**
     * Called right after a successful join: fetch the assignment content (when
     * the classroom has one) and the submissions to continue from, then
     * return the phase the container should switch to ('student-assignment'
     * when there are pages to read, null to fall back to the joined
     * confirmation). The starter opens automatically only when there is
     * nothing to continue from; otherwise the student chooses. Failures fall
     * back gracefully — joining must never be blocked by assignment delivery
     * problems.
     * @param {string} sessionToken - fresh session token from the join
     * @param {string} classroomId - joined classroom ID
     * @param {boolean} withAssignment - whether the classroom carries assignment content
     * @returns {Promise<?string>} next phase or null
     */
    const handleJoined = useCallback(
        async (sessionToken, classroomId, withAssignment) => {
            setLoadedChoice(null);
            setContinueOptions(null);
            setHasAssignment(false);
            const [assignmentData, options] = await Promise.all([
                withAssignment ? classroomAPI.getAssignment(sessionToken, classroomId).catch(() => null) : null,
                fetchContinueOptions(sessionToken, classroomId),
            ]);
            const joinedAssignment = assignmentData?.assignment || null;
            setAssignment(joinedAssignment);
            setAssignmentPageIndex(0);
            if (!joinedAssignment) return null;
            setHasAssignment(true);
            if (!options) {
                try {
                    await loadStarter(joinedAssignment);
                } catch {
                    showError(intl.formatMessage(messages.starterLoadFailed));
                }
            }
            return (joinedAssignment.pages || []).length > 0 ? 'student-assignment' : null;
        },
        [fetchContinueOptions, loadStarter, showError, intl],
    );

    /** Re-fetch the submissions to continue from (status view). */
    const refreshContinueOptions = useCallback(async () => {
        if (!classroomState.sessionToken || !classroomState.classroomId) return;
        await fetchContinueOptions(classroomState.sessionToken, classroomState.classroomId);
    }, [classroomState.sessionToken, classroomState.classroomId, fetchContinueOptions]);

    /**
     * Load a submission to continue from. The download URL is fetched again
     * right before loading — the one shown in the choice may have expired
     * while the student read the assignment.
     * @param {string} kind - 'previous' or 'current'
     */
    const handleLoadSubmission = useCallback(
        async (kind) => {
            if (!classroomState.sessionToken || !classroomState.classroomId) return;
            clearError();
            setIsLoading(true);
            try {
                const options = normalizeContinueOptions(
                    await classroomAPI.getContinuableSubmissions(
                        classroomState.sessionToken,
                        classroomState.classroomId,
                    ),
                );
                setContinueOptions(options);
                const target = options?.[kind];
                if (!target) {
                    showError(intl.formatMessage(messages.submissionGone));
                    return;
                }
                const confirmMessage =
                    kind === 'previous' ? messages.overwriteConfirmPrevious : messages.overwriteConfirmCurrent;
                if (await loadProjectFromUrl(target.projectUrl, confirmMessage)) {
                    setLoadedChoice(kind);
                    if (onStarted) onStarted();
                }
            } catch {
                showError(intl.formatMessage(messages.submissionLoadFailed));
            } finally {
                setIsLoading(false);
            }
        },
        [
            classroomState.sessionToken,
            classroomState.classroomId,
            loadProjectFromUrl,
            onStarted,
            clearError,
            showError,
            intl,
            setIsLoading,
        ],
    );

    /** Open the assignment panel from the status view (re-fetches URLs). */
    const handleOpenAssignment = useCallback(async () => {
        if (!classroomState.sessionToken || !classroomState.classroomId) return;
        clearError();
        setIsLoading(true);
        try {
            const data = await classroomAPI.getAssignment(classroomState.sessionToken, classroomState.classroomId);
            if (!data.assignment) {
                setHasAssignment(false);
                return;
            }
            setAssignment(data.assignment);
            setAssignmentPageIndex(0);
            setPhase('student-assignment');
        } catch (err) {
            showError(translateError(intl, err));
        } finally {
            setIsLoading(false);
        }
    }, [
        classroomState.sessionToken,
        classroomState.classroomId,
        clearError,
        showError,
        intl,
        setIsLoading,
        setPhase,
    ]);

    /**
     * Explicitly (re)open the starter from the assignment panel / choice row.
     * The starter URL is fetched again right before loading, like the
     * submissions: with a choice to make the starter no longer opens on join,
     * so the URL from the join may have expired while the student read the
     * assignment.
     * @param {boolean} start - true from the choice row: the work starts
     *     (onStarted) once the starter has loaded
     */
    const openStarter = useCallback(
        async (start) => {
            if (!assignment) return;
            clearError();
            setIsLoading(true);
            try {
                let starterAssignment = assignment;
                if (classroomState.sessionToken && classroomState.classroomId) {
                    const data = await classroomAPI.getAssignment(
                        classroomState.sessionToken,
                        classroomState.classroomId,
                    );
                    starterAssignment = data.assignment;
                }
                if (!starterAssignment?.starterUrl) {
                    showError(intl.formatMessage(messages.starterLoadFailed));
                    return;
                }
                if ((await loadStarter(starterAssignment)) && start && onStarted) {
                    onStarted();
                }
            } catch {
                showError(intl.formatMessage(messages.starterLoadFailed));
            } finally {
                setIsLoading(false);
            }
        },
        [
            assignment,
            classroomState.sessionToken,
            classroomState.classroomId,
            loadStarter,
            onStarted,
            clearError,
            showError,
            intl,
            setIsLoading,
        ],
    );

    /** "Open the Starter Project" button (no choices): reload and stay on the panel. */
    const handleReloadStarter = useCallback(() => openStarter(false), [openStarter]);

    /** "Start from the starter" choice: load the starter and start working. */
    const handleChooseStarter = useCallback(() => openStarter(true), [openStarter]);

    const handleAssignmentPrevPage = useCallback(() => {
        setAssignmentPageIndex((i) => Math.max(0, i - 1));
    }, []);

    const handleAssignmentNextPage = useCallback(() => {
        setAssignmentPageIndex((i) => Math.min((assignment?.pages?.length || 1) - 1, i + 1));
    }, [assignment]);

    return {
        assignment,
        assignmentPageIndex,
        continueOptions,
        hasAssignment,
        loadedChoice,
        setHasAssignment,
        handleJoined,
        handleLoadSubmission,
        handleOpenAssignment,
        handleReloadStarter,
        handleChooseStarter,
        refreshContinueOptions,
        handleAssignmentPrevPage,
        handleAssignmentNextPage,
    };
};

export default useStudentAssignment;
