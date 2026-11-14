/**
 * Student assignment hook.
 *
 * Fetches the assignment content of the joined classroom and offers where
 * to start: the starter project, and the seat's submissions to continue
 * from (#1201) — this assignment's or the previous assignment's of the same
 * class. Joining never loads a project by itself; the student's choice does
 * (an automatic load plus the same choice on screen made students unsure
 * what to press and loaded the project twice). Nothing clobbers work silently: when the open
 * project has unsaved changes the student is asked first. A loaded project
 * that uses mesh asks for the mesh connection modal (#1251).
 *
 * A lesson assignment (EPIC #1592 / #1599) is told by the assignment
 * response (`lesson`), so the assignment is always fetched right after
 * joining (join / verify-session only tell `hasAssignment`, which is false
 * for a lesson-only assignment). The lesson goes to Redux
 * (classroom.studentLesson) for the lessons library, the class screen and
 * the menu-bar mark. A lesson assignment starts in the lessons library
 * (「はじめる」); its starter and submissions go under 「ほかの始め方」.
 *
 * The way to start is decided as one main button (#1793, decideStartMethod):
 * this assignment's submission → last time's → the starter → as it is.
 */
import { useCallback, useRef, useState } from 'react';
import { defineMessages } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import classroomAPI from '../lib/classroom-api.js';
import { decideStartMethod, normalizeContinueOptions } from '../lib/classroom-continue-options.js';
import { readMeshState, shouldPromptMeshConnect } from '../lib/classroom-mesh-connect.js';
import { submissionKey } from '../lib/classroom-welcome-back.js';
import { normalizeAssignmentLesson } from '../lib/lessons/assignment-progress.js';
import { loadProjectWithChecks } from '../lib/project-loader-utils.js';
import {
    clearMeshConnectRequest,
    markStudentProjectLoaded,
    requestMeshConnect,
    setStudentLesson,
    setStudentPeerView,
    setSubmissionStatus,
} from '../reducers/classroom.js';
import translateError from './classroom-error-utils.js';

const NO_START_METHOD = { main: 'keep', others: [] };

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
    const dispatch = useDispatch();
    // The assignment response carries the peer view setting (#1210); keep it
    // so the status view can hide / lock "みんなの作品を見る" without a request.
    // The same response carries the lesson (#1599); a failed fetch (no data)
    // keeps the lesson known so far.
    const rememberPeerView = useCallback(
        (data) => {
            if (data && typeof data.peerView === 'string') dispatch(setStudentPeerView(data.peerView));
            if (data && 'lesson' in data) dispatch(setStudentLesson(data.lesson));
        },
        [dispatch],
    );

    // The session token as of now (stale answers are dropped, like classroom-modal.jsx).
    const sessionTokenRef = useRef(classroomState.sessionToken);
    sessionTokenRef.current = classroomState.sessionToken;

    const [assignment, setAssignment] = useState(null);
    const [assignmentPageIndex, setAssignmentPageIndex] = useState(0);
    // Whether the joined classroom carries assignment content. Comes from the
    // join / verify-session responses so the status view can offer the
    // "View Assignment" button without an extra request.
    const [hasAssignment, setHasAssignment] = useState(false);
    // Whether the assignment has a starter project: the welcome back screen
    // offers it under 「作品を読み込み直す」 (#1794). Learned from the assignment
    // responses already fetched (join / status view), no extra request.
    const [hasStarter, setHasStarter] = useState(false);

    // Submissions to continue from ({current, previous}) or null when there
    // are none, and which choice was last loaded ('starter' | 'previous' |
    // 'current') so the choice row can mark it.
    const [continueOptions, setContinueOptions] = useState(null);
    const [loadedChoice, setLoadedChoice] = useState(null);
    // How to start right after joining (decideStartMethod, #1793): the main
    // button and the other ways under 「ほかの始め方」. 'lesson' opens the
    // lessons library (#1599).
    const [startMethod, setStartMethod] = useState(NO_START_METHOD);

    /**
     * Download an sb3 and load it into the VM. Asks for confirmation when the
     * open project has unsaved changes (never clobbers silently). Once loaded,
     * asks for the mesh connection modal when the project uses mesh (#1251);
     * a load without mesh drops an earlier request that is still waiting.
     * @param {string} url - presigned download URL
     * @param {object} confirmMessage - confirm text naming what replaces the project
     * @param {string} source - which choice is loaded ('starter' | 'previous' | 'current')
     * @param {?object} [submission] - the submission loaded (this assignment's is remembered
     *   in this tab so the welcome back screen does not offer it again, #1825)
     * @returns {Promise<boolean>} true when the project was loaded
     */
    const loadProjectFromUrl = useCallback(
        async (url, confirmMessage, source, submission = null) => {
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
            dispatch(markStudentProjectLoaded(source === 'current' ? submissionKey(submission) : null));
            const prompt = shouldPromptMeshConnect({ source, ...readMeshState(vm) });
            dispatch(prompt ? requestMeshConnect() : clearMeshConnectRequest());
            return true;
        },
        [projectChanged, vm, intl, dispatch],
    );

    /**
     * Load the assignment's starter project.
     * @param {object} assignmentData - assignment content with starterUrl
     * @returns {Promise<boolean>} true when the starter was loaded
     */
    const loadStarter = useCallback(
        async (assignmentData) => {
            if (!assignmentData?.starterUrl) return false;
            const loaded = await loadProjectFromUrl(assignmentData.starterUrl, messages.overwriteConfirm, 'starter');
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
     * @returns {Promise<?object>} normalized options (null when none). The
     *   old `startFromPrevious` setting in the answer is not read (#1825).
     */
    const fetchContinueOptions = useCallback(async (sessionToken, classroomId) => {
        try {
            const data = await classroomAPI.getContinuableSubmissions(sessionToken, classroomId);
            const options = normalizeContinueOptions(data);
            setContinueOptions(options);
            return options;
        } catch {
            // Could not check: offer nothing rather than an old answer (#1825).
            setContinueOptions(null);
            return null;
        }
    }, []);

    /**
     * Called right after a successful join: fetch the assignment content (when
     * the classroom has one) and the submissions to continue from, decide the
     * way to start (decideStartMethod) and return the phase the container
     * should switch to ('student-assignment' when there are pages to read,
     * null to fall back to the joined confirmation). Nothing is loaded here.
     * Failures fall back gracefully — joining must never be blocked by
     * assignment delivery problems.
     * @param {string} sessionToken - fresh session token from the join
     * @param {string} classroomId - joined classroom ID
     * @param {boolean} withAssignment - whether the classroom carries assignment content
     * @returns {Promise<?string>} next phase or null
     */
    const handleJoined = useCallback(
        async (sessionToken, classroomId, withAssignment) => {
            setLoadedChoice(null);
            setStartMethod(NO_START_METHOD);
            setContinueOptions(null);
            setHasAssignment(false);
            setHasStarter(false);
            // Fetched even without `hasAssignment`: a lesson-only assignment has
            // no pages or starter but still a lesson (#1599).
            const [assignmentData, options] = await Promise.all([
                Promise.resolve()
                    .then(() => classroomAPI.getAssignment(sessionToken, classroomId))
                    .catch(() => null),
                fetchContinueOptions(sessionToken, classroomId),
            ]);
            rememberPeerView(assignmentData);
            const joinedAssignment = withAssignment ? assignmentData?.assignment || null : null;
            setAssignment(joinedAssignment);
            setHasStarter(!!joinedAssignment?.starterUrl);
            setAssignmentPageIndex(0);
            const hasLesson = !!normalizeAssignmentLesson(assignmentData?.lesson);
            setStartMethod(
                decideStartMethod({
                    options,
                    hasStarter: !!joinedAssignment?.starterUrl,
                    lesson: hasLesson,
                }),
            );
            // Joining resets the submission status (another assignment, #1792). A
            // submission of this seat in this assignment (submitted on another PC
            // or before re-joining) is already in the answer above, so the menu
            // bar shows 「提出済み ✓」 without another request (#1795). Whether it
            // was returned is read by the next verify-session.
            if (options && options.current) {
                dispatch(setSubmissionStatus('submitted', options.current.submittedAt || null));
            }
            if (!joinedAssignment) return null;
            setHasAssignment(true);
            return (joinedAssignment.pages || []).length > 0 ? 'student-assignment' : null;
        },
        [dispatch, fetchContinueOptions, rememberPeerView],
    );

    /**
     * Re-read the assignment's lesson (status view): the teacher may tie a
     * lesson to the assignment, or change it, after the student joined (#1599).
     * Best-effort: a failure keeps the lesson known so far.
     */
    const refreshLesson = useCallback(async () => {
        const token = classroomState.sessionToken;
        if (!token || !classroomState.classroomId) return;
        try {
            const data = await classroomAPI.getAssignment(token, classroomState.classroomId);
            // The student may have left or joined another assignment meanwhile:
            // an answer for an old session must not land in the new one (#1599 FYI1).
            if (token !== sessionTokenRef.current) return;
            rememberPeerView(data);
            setHasStarter(!!data?.assignment?.starterUrl);
        } catch {
            // keep what we have
        }
    }, [classroomState.sessionToken, classroomState.classroomId, rememberPeerView]);

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
                if (await loadProjectFromUrl(target.projectUrl, confirmMessage, kind, target)) {
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
            rememberPeerView(data);
            setHasStarter(!!data?.assignment?.starterUrl);
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
        rememberPeerView,
    ]);

    /**
     * "Start from the starter" (the assignment panel / 「ほかの始め方」 /
     * 「作品を読み込み直す」): load the starter and start working. The starter URL
     * is fetched again right before loading, like the submissions: the URL
     * from the join may have expired while the student read the assignment.
     * On the welcome back screen the assignment is not in memory yet, so the
     * fresh fetch is the only source there (#1794).
     */
    const handleChooseStarter = useCallback(async () => {
        const canFetch = !!(classroomState.sessionToken && classroomState.classroomId);
        if (!assignment && !canFetch) return;
        clearError();
        setIsLoading(true);
        try {
            let starterAssignment = assignment;
            if (canFetch) {
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
            if ((await loadStarter(starterAssignment)) && onStarted) {
                onStarted();
            }
        } catch {
            showError(intl.formatMessage(messages.starterLoadFailed));
        } finally {
            setIsLoading(false);
        }
    }, [
        assignment,
        classroomState.sessionToken,
        classroomState.classroomId,
        loadStarter,
        onStarted,
        clearError,
        showError,
        intl,
        setIsLoading,
    ]);

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
        hasStarter,
        loadedChoice,
        startMethod,
        setHasAssignment,
        handleJoined,
        handleLoadSubmission,
        handleOpenAssignment,
        handleChooseStarter,
        refreshContinueOptions,
        refreshLesson,
        handleAssignmentPrevPage,
        handleAssignmentNextPage,
    };
};

export default useStudentAssignment;
