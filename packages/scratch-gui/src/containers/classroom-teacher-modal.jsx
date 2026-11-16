import PropTypes from 'prop-types';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import ClassroomTeacherModalComponent from '../components/classroom-teacher-modal/classroom-teacher-modal.jsx';
import classroomAPI from '../lib/classroom-api.js';
import { teacherEmailFromToken } from '../lib/classroom-class-label.js';
import {
    clearTeacherSession,
    resolveTeacherNavigation,
    saveTeacherLastSelection,
    saveTeacherLogin,
} from '../lib/classroom-teacher-session.js';
import {
    memberCommentDraftKey,
    memberDraftsForClassroom,
    unsavedMemberCommentDrafts,
} from '../lib/classroom-teacher-work.js';
import { getUrlParams } from '../lib/url-params.js';
import { showAlertWithTimeout } from '../reducers/alerts.js';
import {
    closeTeacherModal,
    clearClassroomSession,
    setTeacherSelection,
    clearTeacherSelection,
    setTeacherLoggedIn,
    setTeacherUnreadCount,
    setTeacherLastSelection,
    clearTeacherNavigation,
    setTeacherHasUnsavedWork,
} from '../reducers/classroom.js';
import { decideTeacherSelectionSync } from './classroom-classcode-utils.js';
import useBeforeUnloadWhile from './use-before-unload-while.js';
import { getCachedTeacherAuthProvider } from './use-teacher-auth.js';
import useTeacherClassroom, { getCachedTeacherIdToken, setCachedTeacherIdToken } from './use-teacher-classroom.js';

const TEACHER_MODE = 'teacher';

/**
 * The teacher's class management (full-screen modal).
 *
 * Mounted by ClassroomTeacherModalHost. When the teacher opens a work in the
 * editor, the modal closes but this container stays mounted with `visible`
 * false (#1990), so the class, assignment, tab, seat and the grading drafts are
 * all there when the teacher comes back (the bar above the editor, the menu).
 * @param {object} props - component props
 * @param {boolean} [props.visible] - the modal is shown
 * @returns {React.ReactElement|null} the modal, or null while hidden
 */
const ClassroomTeacherModal = ({ visible = true }) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const classroomState = useSelector((state) => state.scratchGui.classroom);
    const vm = useSelector((state) => state.scratchGui.vm);

    // Auto-login with dev bypass token from URL (e.g. ?devlogin=<secret>)
    const urlParams = getUrlParams();
    if (urlParams.devlogin && !getCachedTeacherIdToken()) {
        setCachedTeacherIdToken(urlParams.devlogin);
    }

    // Determine initial phase from cached idToken. v2: land on the class
    // list (GC-style) instead of the assignment dashboard.
    const getInitialPhase = () => (getCachedTeacherIdToken() ? 'teacher-class-list' : 'teacher-login');

    // UI state
    const [phase, setPhase] = useState(getInitialPhase);
    const [error, setError] = useState(null);
    const [errorTitle, setErrorTitle] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorActionLabel, setErrorActionLabel] = useState(null);
    const [errorActionHandler, setErrorActionHandler] = useState(null);

    const showError = useCallback((message, title = null) => {
        setError(message);
        setErrorTitle(title);
        setErrorActionLabel(null);
        setErrorActionHandler(null);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
        setErrorTitle(null);
        setErrorActionLabel(null);
        setErrorActionHandler(null);
    }, []);

    // Ref-based wrapper for showSessionExpiredError to break circular dependency
    const showSessionExpiredErrorRef = useRef(null);
    const stableShowSessionExpiredError = useCallback((...args) => showSessionExpiredErrorRef.current?.(...args), []);

    const teacher = useTeacherClassroom({
        mode: TEACHER_MODE,
        dispatch,
        intl,
        phase,
        setPhase,
        showError,
        clearError,
        showSessionExpiredError: stableShowSessionExpiredError,
        isLoading,
        setIsLoading,
        vm,
        visible,
    });

    // Go back to login screen (used as error action for session expiry)
    const handleGoToLogin = useCallback(() => {
        setCachedTeacherIdToken(null);
        teacher.setIdToken(null);
        teacher.setClassrooms([]);
        teacher.setSelectedClassroom(null);
        teacher.setMembers([]);
        dispatch(clearTeacherSelection());
        setPhase('teacher-login');
    }, [dispatch, teacher]);

    // Sync teacher's selectedClassroom into Redux so the Mesh v2 binding
    // (mesh-v2-classroom-binding.jsx) and the connection modal can react to it.
    useEffect(() => {
        if (teacher.selectedClassroom && teacher.selectedClassroom.joinCode) {
            dispatch(
                setTeacherSelection({
                    classroomId: teacher.selectedClassroom.classroomId,
                    joinCode: teacher.selectedClassroom.joinCode,
                    className: teacher.selectedClassroom.className || teacher.selectedClassroom.name || null,
                    assignmentName: teacher.selectedClassroom.assignmentName || null,
                }),
            );
        }
    }, [dispatch, teacher.selectedClassroom]);

    // The student "クラス" menu follows the selected assignment (#1199): when
    // the teacher joined another class as a student, leave it so the next
    // open of the student modal starts this assignment's seat selection.
    // Keyed on the join code only — refreshing the same assignment must not
    // re-run this. The session is read from a ref for the same reason.
    const studentSessionRef = useRef(classroomState);
    studentSessionRef.current = classroomState;
    const selectedJoinCode = (teacher.selectedClassroom && teacher.selectedClassroom.joinCode) || null;
    useEffect(() => {
        const sync = decideTeacherSelectionSync(studentSessionRef.current, selectedJoinCode);
        if (sync.type === 'none') return;
        if (sync.type === 'leave') {
            // Best effort, like the ?classcode= switch: a failed leave only
            // keeps the old seat until its TTL.
            classroomAPI.leaveClassroom(sync.leaveSessionToken, sync.leaveClassroomId).catch(() => {});
        }
        dispatch(clearClassroomSession());
    }, [dispatch, selectedJoinCode]);

    // --- Teacher menu in the menu bar (#1199) ---

    // Mirror the login into Redux (menu visibility) and remember the provider
    // so the next page load can restore it silently. Only a token → none
    // transition counts as a logout: the modal may mount logged out while the
    // menu is still restoring the login in the background.
    const { idToken: teacherIdToken, authProvider: teacherAuthProvider, setIdToken: setTeacherIdToken } = teacher;
    const prevTeacherIdTokenRef = useRef(teacherIdToken);
    useEffect(() => {
        if (teacherIdToken) {
            dispatch(setTeacherLoggedIn(true));
            saveTeacherLogin(teacherAuthProvider);
        } else if (prevTeacherIdTokenRef.current) {
            dispatch(setTeacherLoggedIn(false));
            clearTeacherSession();
        }
        prevTeacherIdTokenRef.current = teacherIdToken;
    }, [dispatch, teacherIdToken, teacherAuthProvider]);

    // The background restore finished after this modal mounted on the login
    // screen: adopt the restored login instead of asking to log in again.
    const teacherLoggedIn = classroomState.teacherLoggedIn;
    useEffect(() => {
        const cached = getCachedTeacherIdToken();
        if (teacherLoggedIn && !teacherIdToken && cached) {
            teacher.setAuthProvider(getCachedTeacherAuthProvider());
            setTeacherIdToken(cached);
            setPhase('teacher-class-list');
        }
        // teacher is a fresh object every render; the setters are stable.
    }, [teacherLoggedIn, teacherIdToken, setTeacherIdToken]);

    const unreadCount = teacher.notificationsCenter.unreadCount;
    useEffect(() => {
        if (teacherIdToken) dispatch(setTeacherUnreadCount(unreadCount));
    }, [dispatch, teacherIdToken, unreadCount]);

    // Remember the assignment being worked on for "いまの課題を開く".
    const selectedClassroomId = teacher.selectedClassroom && teacher.selectedClassroom.classroomId;
    const selectedClassroomGroupId =
        (teacher.selectedClassroom && teacher.selectedClassroom.groupId) ||
        (teacher.selectedGroup && teacher.selectedGroup.groupId) ||
        null;
    useEffect(() => {
        if (!selectedClassroomId) return;
        const selection = { classroomId: selectedClassroomId, groupId: selectedClassroomGroupId };
        dispatch(setTeacherLastSelection(selection));
        saveTeacherLastSelection(selection);
    }, [dispatch, selectedClassroomId, selectedClassroomGroupId]);

    // Leaving the grading screen any way (the modal's ✕ / overlay / Esc,
    // logout, the notifications) asks first when grades not exported or
    // comments not returned would be lost (#1923 C4). The question is shown on
    // the grading screen itself.
    const evaluation = teacher.evaluation;
    const onEvaluation = phase === 'teacher-evaluation' && !!evaluation;
    const guardLeave = useCallback(
        (action) => (onEvaluation ? evaluation.handleRequestLeave(action, 'leave') : action()),
        [onEvaluation, evaluation],
    );

    // Comments typed on the members tab and not returned yet (#1990). They live here,
    // not in the screen, so opening a work (which hides this modal) keeps them.
    // key (memberCommentDraftKey) → {text, base}; base is the returned comment when the
    // typing started, used while another assignment is shown.
    const [memberDrafts, setMemberDrafts] = useState({});
    const selectedDetailId = teacher.selectedClassroom && teacher.selectedClassroom.classroomId;
    const handleChangeMemberCommentDraft = useCallback(
        (memberId, text) => {
            if (!selectedDetailId || !memberId) return;
            const key = memberCommentDraftKey(selectedDetailId, memberId);
            const member = (teacher.members || []).find((m) => m.memberId === memberId);
            setMemberDrafts((prev) => ({
                ...prev,
                [key]: { text, base: prev[key] ? prev[key].base : (member && member.teacherComment) || '' },
            }));
        },
        [selectedDetailId, teacher.members],
    );
    const unsavedMemberDrafts = unsavedMemberCommentDrafts(memberDrafts, selectedDetailId, teacher.members);
    const unsavedMemberDraftsRef = useRef(unsavedMemberDrafts);
    unsavedMemberDraftsRef.current = unsavedMemberDrafts;

    // Logging out drops everything here, so it asks first: the grading screen's own
    // question, then this one for the members tab's comments (#1990).
    const [logoutConfirm, setLogoutConfirm] = useState(null);
    const guardLogout = useCallback(
        (action) => {
            const askDrafts = () => (unsavedMemberDraftsRef.current ? setLogoutConfirm({ action }) : action());
            if (onEvaluation) evaluation.handleRequestLeave(askDrafts, 'leave');
            else askDrafts();
        },
        [onEvaluation, evaluation],
    );
    const guardLogoutRef = useRef(guardLogout);
    guardLogoutRef.current = guardLogout;
    const handleConfirmLogout = useCallback(() => {
        const request = logoutConfirm;
        setLogoutConfirm(null);
        if (request) request.action();
    }, [logoutConfirm]);
    const handleCancelLogout = useCallback(() => setLogoutConfirm(null), []);

    // The menu bar's logout asks too when this modal is hidden (#1990).
    const hasUnsavedWork =
        (onEvaluation && !!(evaluation.hasUnsavedWork || evaluation.evalProgress)) || unsavedMemberDrafts;
    useEffect(() => {
        dispatch(setTeacherHasUnsavedWork(hasUnsavedWork));
    }, [dispatch, hasUnsavedWork]);
    useEffect(() => () => dispatch(setTeacherHasUnsavedWork(false)), [dispatch]);
    // The navigation effect below runs only when its inputs change: it reads the latest guard.
    const guardLeaveRef = useRef(guardLeave);
    guardLeaveRef.current = guardLeave;
    // A jump confirmed later uses the handlers of that time, not of the effect's run.
    const teacherRef = useRef(teacher);
    teacherRef.current = teacher;

    // Reloading or closing the tab: the browser's own question, only while
    // something would be lost (and not with ?no_beforeunload=1).
    useBeforeUnloadWhile(onEvaluation && evaluation.hasUnsavedWork);

    // Jump requested from the menu bar. Uses the same handlers as the
    // breadcrumbs / notification links, so the phase always follows the
    // selection (handleSelectGroup resets it to the board first).
    const navTarget = classroomState.teacherNavTarget;
    const navMemberId = classroomState.teacherNavMemberId;
    const lastSelection = classroomState.teacherLastSelection;
    useEffect(() => {
        if (!navTarget) return;
        if (!teacherIdToken) {
            // Not logged in after all: the modal shows the login screen.
            if (!teacherLoggedIn) dispatch(clearTeacherNavigation());
            return;
        }
        const nav = resolveTeacherNavigation({
            target: navTarget,
            lastSelection,
            groups: teacher.groups,
            groupsLoaded: teacher.groupsLoaded,
        });
        if (nav.action === 'wait' || nav.action === 'none') return;
        // The request is consumed now; the jump itself may wait for the
        // teacher's answer when it would leave the grading screen with work
        // not saved (#1923: the menu bar and the kick toast's 「課題を開く」).
        dispatch(clearTeacherNavigation());
        const memberId = navMemberId;
        if (nav.action === 'logout') {
            // The menu bar's logout over work not saved (#1990): ask here, like the
            // avatar menu's logout, then close as the menu bar's logout does.
            guardLogoutRef.current(() => {
                setMemberDrafts({});
                dispatch(clearTeacherSelection());
                teacherRef.current.handleTeacherLogout();
                dispatch(closeTeacherModal());
            });
            return;
        }
        guardLeaveRef.current(() => {
            const current = teacherRef.current;
            if (nav.action === 'notifications') {
                current.notificationsCenter.handleShowAll();
            } else if (nav.action === 'assignment') {
                if (nav.group) current.handleSelectGroup(nav.group);
                // Back to the lesson in progress: always the members tab, and the
                // seat picked in the floating status panel when there is one (#1203).
                Promise.resolve(current.handleSelectClassroom(nav.classroomId, { tab: 'members' })).then(() => {
                    if (memberId) teacherRef.current.handleSelectMember(memberId);
                });
            } else {
                current.handleShowClassList();
            }
        });
        // teacher is a fresh object every render; re-run only when the inputs change.
    }, [
        dispatch,
        navTarget,
        navMemberId,
        lastSelection,
        teacherIdToken,
        teacherLoggedIn,
        teacher.groups,
        teacher.groupsLoaded,
    ]);

    // Handle relogin request from Alert "参加しなおす" button
    useEffect(() => {
        if (classroomState.reloginRequested) {
            dispatch(clearClassroomSession());
            handleGoToLogin();
        }
    }, [classroomState.reloginRequested, dispatch, handleGoToLogin]);

    const showSessionExpiredError = useCallback(() => {
        showAlertWithTimeout(dispatch, 'classroomTeacherSessionExpired');
    }, [dispatch]);
    showSessionExpiredErrorRef.current = showSessionExpiredError;

    // Closing keeps this container mounted (#1990): nothing on the grading screen
    // is lost, so it does not ask. Reloading the tab still asks (above).
    const handleClose = useCallback(() => {
        dispatch(closeTeacherModal());
    }, [dispatch]);

    // Wrap the teacher logout so we also clear teacherSelection from Redux —
    // the underlying handleTeacherLogout only resets local hook state.
    const handleTeacherLogoutWithReduxClear = useCallback(() => {
        guardLogout(() => {
            setMemberDrafts({});
            dispatch(clearTeacherSelection());
            teacher.handleTeacherLogout();
        });
    }, [dispatch, teacher, guardLogout]);

    const notificationsCenter = teacher.notificationsCenter;
    const guardedNotificationsCenter = notificationsCenter && {
        ...notificationsCenter,
        handleShowAll: (...args) => guardLeave(() => notificationsCenter.handleShowAll(...args)),
        handleOpenLink: (...args) => guardLeave(() => notificationsCenter.handleOpenLink(...args)),
    };

    const teacherContainerProps = {
        phase,
        classrooms: teacher.classrooms,
        archivedClassrooms: teacher.archivedClassrooms,
        onRestoreClassroom: teacher.handleRestoreClassroom,
        selectedClassroom: teacher.selectedClassroom,
        members: teacher.members,
        error,
        errorTitle,
        errorActionLabel,
        errorActionHandler,
        isLoading,
        selectedMember: teacher.selectedMember,
        downloadProgress: teacher.downloadProgress,
        googleCourses: teacher.googleCourses,
        googleCourseAccess: teacher.googleCourseAccess,
        isVerifyingGoogleCourseAccess: teacher.isVerifyingGoogleCourseAccess,
        onVerifyGoogleCourseAccess: teacher.handleVerifyGoogleCourseAccess,
        selectedGoogleCourse: teacher.selectedGoogleCourse,
        googleSignInRef: teacher.googleSignInRef,
        googleFallbackReason: teacher.googleFallbackReason,
        onGoogleLogin: teacher.handleGoogleLogin,
        onMicrosoftLogin: teacher.handleMicrosoftLogin,
        isMicrosoftAuthAvailable: teacher.isMicrosoftAuthAvailable,
        authProvider: teacher.authProvider,
        onTeacherLogout: handleTeacherLogoutWithReduxClear,
        onSelectClassroom: teacher.handleSelectClassroom,
        onBackToDashboard: teacher.handleBackToDashboard,
        onDeleteClassroom: teacher.handleDeleteClassroom,
        onDeleteMember: teacher.handleDeleteMember,
        onRefreshDetail: teacher.handleRefreshDetail,
        onSelectMember: teacher.handleSelectMember,
        onOpenSubmission: teacher.handleOpenSubmission,
        onReturnSubmission: teacher.handleReturnSubmission,
        onSetHiddenFromPeers: teacher.handleSetHiddenFromPeers,
        onDownloadAll: teacher.handleDownloadAll,
        onDownloadClassAll: teacher.handleDownloadClassAll,
        onCopyInviteLink: teacher.handleCopyInviteLink,
        onShowPostAssignment: teacher.handleShowPostAssignment,
        onBackToDetail: teacher.handleBackToDetail,
        onPostAssignment: teacher.handlePostAssignment,
        onShowGoogleCourses: teacher.handleShowGoogleCourses,
        onLoadGoogleCourses: teacher.handleLoadGoogleCourses,
        onSelectGoogleCourse: teacher.handleSelectGoogleCourse,
        onConfirmGoogleImport: teacher.handleConfirmGoogleImport,
        onUpdateAssignmentName: teacher.handleUpdateAssignmentName,
        kickRequestsBySeat: teacher.kickRequestsBySeat,
        lessonProgress: teacher.lessonProgress,
        onApproveKickRequest: teacher.handleApproveKickRequest,
        onRejectKickRequest: teacher.handleRejectKickRequest,
        assignmentEditorPages: teacher.assignmentEditorPages,
        assignmentStarterMode: teacher.assignmentStarterMode,
        assignmentStarterSource: teacher.assignmentStarterSource,
        assignmentHasExistingStarter: teacher.assignmentHasExistingStarter,
        assignmentIsSaving: teacher.assignmentIsSaving,
        assignmentPeerView: teacher.assignmentPeerView,
        assignmentMeshGroupLimit: teacher.assignmentMeshGroupLimit,
        assignmentSavedSettings: teacher.assignmentSavedSettings,
        assignmentLessonDraft: teacher.assignmentLessonDraft,
        assignmentSavedLesson: teacher.assignmentSavedLesson,
        onAssignmentAddPage: teacher.handleAssignmentAddPage,
        onAssignmentRemovePage: teacher.handleAssignmentRemovePage,
        onAssignmentMovePage: teacher.handleAssignmentMovePage,
        onAssignmentChangePageText: teacher.handleAssignmentChangePageText,
        onAssignmentAttachPageImage: teacher.handleAssignmentAttachPageImage,
        onAssignmentRemovePageImage: teacher.handleAssignmentRemovePageImage,
        onAssignmentUseCurrentProject: teacher.handleAssignmentUseCurrentProject,
        onAssignmentUseFile: teacher.handleAssignmentUseFile,
        onAssignmentRemoveStarter: teacher.handleAssignmentRemoveStarter,
        onAssignmentChangePeerView: teacher.handleAssignmentChangePeerView,
        onAssignmentChangeMeshGroupLimit: teacher.handleAssignmentChangeMeshGroupLimit,
        onAssignmentChangeLesson: teacher.handleAssignmentChangeLesson,
        assignmentLessonPanelAutoOpen: teacher.assignmentLessonPanelAutoOpen,
        assignmentDescriptionQuestion: teacher.assignmentDescriptionQuestion,
        onAssignmentLessonPanelClose: teacher.handleAssignmentLessonPanelClose,
        onAssignmentLessonPanelAutoOpened: teacher.handleAssignmentLessonPanelAutoOpened,
        onAssignmentAnswerDescriptionQuestion: teacher.handleAssignmentAnswerDescriptionQuestion,
        onAssignmentSave: teacher.handleAssignmentSave,
        groups: teacher.groups,
        teacherEmail: teacherEmailFromToken(teacher.idToken),
        selectedGroup: teacher.selectedGroup,
        onSelectGroup: teacher.handleSelectGroup,
        onShowClassList: teacher.handleShowClassList,
        onCreateClassWithAssignment: teacher.handleCreateClassWithAssignment,
        onUpdateGroupTopics: teacher.handleUpdateGroupTopics,
        onUpdateAssignmentMeta: teacher.handleUpdateAssignmentMeta,
        onLoadAssignmentSummary: teacher.loadAssignmentSummary,
        onCreateAssignmentInClass: teacher.handleCreateAssignmentInClass,
        onDetailTabChange: teacher.setDetailTab,
        detailTab: teacher.detailTab,
        detailEntry: teacher.detailEntry,
        onProjectEntryUsed: teacher.consumeDetailProject,
        onReuseAssignment: teacher.handleReuseAssignment,
        onUpdateGroup: teacher.handleUpdateGroup,
        evaluation: teacher.evaluation,
        memberCommentDrafts: memberDraftsForClassroom(memberDrafts, selectedDetailId),
        onChangeMemberCommentDraft: handleChangeMemberCommentDraft,
        logoutConfirm: !!logoutConfirm,
        onConfirmLogout: handleConfirmLogout,
        onCancelLogout: handleCancelLogout,
        shared: teacher.shared,
        notificationsCenter: guardedNotificationsCenter,
    };
    if (!visible) return null;
    return <ClassroomTeacherModalComponent containerProps={teacherContainerProps} onClose={handleClose} />;
};

ClassroomTeacherModal.propTypes = {
    visible: PropTypes.bool,
};

export default ClassroomTeacherModal;
