/**
 * Student assignment hook.
 *
 * Fetches the assignment content of the joined classroom and loads the
 * starter project into the VM. The starter never clobbers work silently:
 * when the open project has unsaved changes the student is asked first.
 */
import { useCallback, useState } from 'react';
import { defineMessages } from 'react-intl';
import { useSelector } from 'react-redux';
import classroomAPI from '../lib/classroom-api.js';
import { loadProjectWithChecks } from '../lib/project-loader-utils.js';
import { persistRubyVersion } from '../lib/settings/ruby-version/persistence';
import { setRubyVersion } from '../reducers/settings';
import translateError from './classroom-error-utils.js';

const messages = defineMessages({
    overwriteConfirm: {
        defaultMessage: 'Open the assignment starter project? Your current project will be replaced.',
        description: 'Confirm dialog before the starter project replaces an edited project',
        id: 'gui.classroom.studentAssignment.overwriteConfirm',
    },
    starterLoadFailed: {
        defaultMessage: 'Failed to open the starter project',
        description: 'Error when downloading/loading the starter project fails',
        id: 'gui.classroom.studentAssignment.starterLoadFailed',
    },
});

/**
 * @param {object} params - hook dependencies
 * @param {object} params.classroomState - Redux classroom state (session)
 * @param {object} params.vm - Scratch VM instance
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.dispatch - Redux dispatch
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {Function} params.setIsLoading - loading state setter
 * @param {Function} params.setPhase - phase setter
 * @returns {object} student assignment state and handlers
 */
const useStudentAssignment = ({
    classroomState,
    vm,
    intl,
    dispatch,
    clearError,
    showError,
    setIsLoading,
    setPhase,
}) => {
    const projectChanged = useSelector((state) => state.scratchGui.projectChanged);
    const rubyVersion = useSelector((state) => state.scratchGui.settings.rubyVersion);

    const [assignment, setAssignment] = useState(null);
    const [assignmentPageIndex, setAssignmentPageIndex] = useState(0);
    // Whether the joined classroom carries assignment content. Comes from the
    // join / verify-session responses so the status view can offer the
    // "View Assignment" button without an extra request.
    const [hasAssignment, setHasAssignment] = useState(false);

    /**
     * Download the starter sb3 and load it into the VM. Asks for confirmation
     * when the open project has unsaved changes (never clobbers silently).
     * @param {object} assignmentData - assignment content with starterUrl
     * @returns {Promise<boolean>} true when the starter was loaded
     */
    const loadStarter = useCallback(
        async (assignmentData) => {
            if (!assignmentData?.starterUrl) return false;
            if (projectChanged) {
                // eslint-disable-next-line no-alert
                if (!window.confirm(intl.formatMessage(messages.overwriteConfirm))) {
                    return false;
                }
            }
            const response = await fetch(assignmentData.starterUrl);
            if (!response.ok) {
                throw new Error(`Starter download failed: ${response.status}`);
            }
            const projectData = await response.arrayBuffer();
            await loadProjectWithChecks(vm, intl, projectData, rubyVersion, (version) => {
                dispatch(setRubyVersion(version));
                persistRubyVersion(version);
            });
            return true;
        },
        [projectChanged, vm, intl, rubyVersion, dispatch],
    );

    /**
     * Called right after a successful join when the classroom carries
     * assignment content: fetch it, auto-load the starter, and return the
     * phase the container should switch to ('student-assignment' when there
     * are pages to read, null to fall back to the joined confirmation).
     * Failures fall back gracefully — joining must never be blocked by
     * assignment delivery problems.
     * @param {string} sessionToken - fresh session token from the join
     * @param {string} classroomId - joined classroom ID
     * @returns {Promise<?string>} next phase or null
     */
    const handleJoinedWithAssignment = useCallback(
        async (sessionToken, classroomId) => {
            try {
                const data = await classroomAPI.getAssignment(sessionToken, classroomId);
                if (!data.assignment) return null;
                setAssignment(data.assignment);
                setAssignmentPageIndex(0);
                setHasAssignment(true);
                try {
                    await loadStarter(data.assignment);
                } catch {
                    showError(intl.formatMessage(messages.starterLoadFailed));
                }
                return (data.assignment.pages || []).length > 0 ? 'student-assignment' : null;
            } catch {
                // Assignment fetch failed — the join itself succeeded, so show
                // the normal joined confirmation and let the student retry
                // from the status view.
                return null;
            }
        },
        [loadStarter, showError, intl],
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

    /** Explicitly (re)open the starter from the assignment panel. */
    const handleReloadStarter = useCallback(async () => {
        if (!assignment) return;
        clearError();
        setIsLoading(true);
        try {
            await loadStarter(assignment);
        } catch {
            showError(intl.formatMessage(messages.starterLoadFailed));
        } finally {
            setIsLoading(false);
        }
    }, [assignment, loadStarter, clearError, showError, intl, setIsLoading]);

    const handleAssignmentPrevPage = useCallback(() => {
        setAssignmentPageIndex((i) => Math.max(0, i - 1));
    }, []);

    const handleAssignmentNextPage = useCallback(() => {
        setAssignmentPageIndex((i) => Math.min((assignment?.pages?.length || 1) - 1, i + 1));
    }, [assignment]);

    return {
        assignment,
        assignmentPageIndex,
        hasAssignment,
        setHasAssignment,
        handleJoinedWithAssignment,
        handleOpenAssignment,
        handleReloadStarter,
        handleAssignmentPrevPage,
        handleAssignmentNextPage,
    };
};

export default useStudentAssignment;
