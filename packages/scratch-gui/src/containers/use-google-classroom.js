/**
 * Google Classroom integration hook.
 *
 * Manages course listing, import flow, and assignment posting.
 */
import { useCallback, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import { GOOGLE_COURSE_ACCESS } from '../lib/classroom-google-share.js';
import {
    requestClassroomAccessToken,
    clearClassroomAccessToken,
    getCachedClassroomAccessToken,
} from '../lib/google-classroom-auth.js';
import translateError from './classroom-error-utils.js';

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {object|null} params.selectedClassroom - currently selected classroom
 * @param {Function} params.setSelectedClassroom - setter for selected classroom
 * @param {Function} params.setClassrooms - setter for classrooms list
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setIsLoading - loading state setter
 * @param {Function} params.setPhase - phase setter
 * @param {Function} params.onImportCourse - create a class from a GC course (v2)
 * @returns {object} Google Classroom state and handler functions
 */
const useGoogleClassroom = ({
    idToken,
    selectedClassroom,
    setSelectedClassroom,
    setClassrooms,
    clearError,
    showError,
    intl,
    setIsLoading,
    setPhase,
    onImportCourse,
}) => {
    const [googleAccessToken, setGoogleAccessToken] = useState(null);
    const [googleCourses, setGoogleCourses] = useState([]);
    const [selectedGoogleCourse, setSelectedGoogleCourse] = useState(null);
    // Share-button verdict: {groupId, status, linkedByEmail, linkedByMe,
    // verifyFailed}. Sharing is blocked unless this says otherwise (#1184).
    const [googleCourseAccess, setGoogleCourseAccess] = useState(null);
    const [isVerifyingGoogleCourseAccess, setIsVerifyingGoogleCourseAccess] = useState(false);

    /**
     * Find out whether this teacher can post to the class's linked Google
     * Classroom course, so a Google Classroom co-teacher who already granted
     * access this session gets the share button without having to ask for a
     * check (issue #1184).
     *
     * Deliberately silent: it uses a Google token the teacher already granted
     * and gives up when there is none, so the check never triggers a consent
     * popup on its own. Giving up leaves the button blocked — the teacher can
     * lift that themselves with the explicit check below.
     * @param {?object} group - the class (group) whose link to check
     * @returns {Promise<void>} resolves once the state has been updated
     */
    const handleCheckGoogleCourseAccess = useCallback(
        async (group) => {
            if (!group || !group.groupId || !group.googleClassroomCourseId) {
                setGoogleCourseAccess(null);
                return;
            }
            const unknown = {
                groupId: group.groupId,
                status: GOOGLE_COURSE_ACCESS.UNKNOWN,
                linkedByEmail: group.googleClassroomLinkedByEmail || null,
                linkedByMe: Boolean(group.googleClassroomLinkedByMe),
                verifyFailed: false,
            };
            const accessToken = googleAccessToken || getCachedClassroomAccessToken();
            if (!accessToken) {
                setGoogleCourseAccess(unknown);
                return;
            }
            try {
                const data = await classroomAPI.getGoogleCourseAccess(idToken, accessToken, group.groupId);
                setGoogleCourseAccess({
                    ...unknown,
                    status: data.status || GOOGLE_COURSE_ACCESS.UNKNOWN,
                    linkedByEmail: data.linkedByEmail || group.googleClassroomLinkedByEmail || null,
                    linkedByMe: Boolean(data.linkedByMe) || unknown.linkedByMe,
                });
            } catch {
                // Nothing the teacher did has failed yet, so this must not
                // raise an error banner.
                setGoogleCourseAccess(unknown);
            }
        },
        [idToken, googleAccessToken],
    );

    /**
     * Run the same probe at the teacher's request, asking for Google access
     * when they have none.
     *
     * This is the way out of the default block for a teacher who really is a
     * Google Classroom co-teacher of the linked course: they press "check",
     * grant access once, and sharing opens up. Dismissing consent or being
     * refused by Google is not an error the teacher needs a banner for — it is
     * simply the block standing, so the reason is reported in place (#1184).
     * @param {?object} group - the class (group) whose link to check
     * @returns {Promise<void>} resolves once the state has been updated
     */
    const handleVerifyGoogleCourseAccess = useCallback(
        async (group) => {
            if (!group || !group.groupId || !group.googleClassroomCourseId) return;
            const base = {
                groupId: group.groupId,
                linkedByEmail: group.googleClassroomLinkedByEmail || null,
                linkedByMe: Boolean(group.googleClassroomLinkedByMe),
            };
            setIsVerifyingGoogleCourseAccess(true);
            try {
                let accessToken = googleAccessToken || getCachedClassroomAccessToken();
                if (!accessToken) {
                    accessToken = await requestClassroomAccessToken();
                    setGoogleAccessToken(accessToken);
                }
                const data = await classroomAPI.getGoogleCourseAccess(idToken, accessToken, group.groupId);
                const status = data.status || GOOGLE_COURSE_ACCESS.UNKNOWN;
                setGoogleCourseAccess({
                    ...base,
                    status,
                    linkedByEmail: data.linkedByEmail || base.linkedByEmail,
                    linkedByMe: Boolean(data.linkedByMe) || base.linkedByMe,
                    verifyFailed: status !== GOOGLE_COURSE_ACCESS.TEACHER,
                });
            } catch (err) {
                // A refused or expired token is useless for the next attempt,
                // so drop it and let a retry re-run consent (#1175).
                if (err && (err.status === 401 || err.status === 403)) {
                    clearClassroomAccessToken();
                    setGoogleAccessToken(null);
                }
                setGoogleCourseAccess({
                    ...base,
                    status: GOOGLE_COURSE_ACCESS.UNKNOWN,
                    verifyFailed: true,
                });
            } finally {
                setIsVerifyingGoogleCourseAccess(false);
            }
        },
        [idToken, googleAccessToken],
    );

    const handleShowGoogleCourses = useCallback(() => {
        clearError();
        setGoogleCourses([]);
        setSelectedGoogleCourse(null);
        setPhase('teacher-google-courses');
    }, [clearError, setPhase]);

    const handleLoadGoogleCourses = useCallback(async () => {
        clearError();
        setIsLoading(true);
        try {
            const accessToken = await requestClassroomAccessToken();
            setGoogleAccessToken(accessToken);
            const data = await classroomAPI.listGoogleCourses(idToken, accessToken);
            setGoogleCourses(data.courses || []);
            setSelectedGoogleCourse(null);
        } catch (err) {
            if (err.status === 401 || err.status === 403) {
                clearClassroomAccessToken();
                setGoogleAccessToken(null);
            }
            showError(translateError(intl, err));
        } finally {
            setIsLoading(false);
        }
    }, [idToken, clearError, showError, intl, setIsLoading]);

    const handleSelectGoogleCourse = useCallback((course) => {
        setSelectedGoogleCourse(course);
    }, []);

    // v2: confirming an import creates a class from the course (wired via a
    // ref in the facade because the groups hook is created later).
    const handleConfirmGoogleImport = useCallback(() => {
        if (!selectedGoogleCourse) return;
        onImportCourse(selectedGoogleCourse);
    }, [selectedGoogleCourse, onImportCourse]);

    const handleShowCreateForm = useCallback(() => {
        setSelectedGoogleCourse(null);
        setPhase('teacher-create');
    }, [setPhase]);

    const handlePostAssignment = useCallback(
        async (title, description) => {
            if (!selectedClassroom) return;
            clearError();
            setIsLoading(true);
            try {
                let accessToken = googleAccessToken;
                if (!accessToken) {
                    accessToken = await requestClassroomAccessToken();
                    setGoogleAccessToken(accessToken);
                }
                const link = `${window.location.origin}${window.location.pathname}?classcode=${selectedClassroom.joinCode.toLowerCase()}`;
                const result = await classroomAPI.postGoogleAssignment(
                    idToken,
                    accessToken,
                    selectedClassroom.classroomId,
                    title,
                    link,
                    description,
                );
                if (result.alternateLink) {
                    setSelectedClassroom((prev) => ({
                        ...prev,
                        googleClassroomAlternateLink: result.alternateLink,
                    }));
                    setClassrooms((prev) =>
                        prev.map((c) =>
                            c.classroomId === selectedClassroom.classroomId
                                ? {
                                      ...c,
                                      googleClassroomAlternateLink: result.alternateLink,
                                  }
                                : c,
                        ),
                    );
                }
                return result;
            } catch (err) {
                // 401 = the Google token expired; 403 = Google refused (most
                // often a scope the teacher did not grant). Either way the
                // cached token is useless, so drop it and let the next attempt
                // re-run consent instead of replaying the same failure (#1175).
                if (err.status === 401 || err.status === 403) {
                    clearClassroomAccessToken();
                    setGoogleAccessToken(null);
                }
                showError(translateError(intl, err));
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [
            idToken,
            googleAccessToken,
            selectedClassroom,
            setSelectedClassroom,
            setClassrooms,
            clearError,
            showError,
            intl,
            setIsLoading,
        ],
    );

    const handleShowPostAssignment = useCallback(() => {
        setPhase('teacher-post-assignment');
    }, [setPhase]);

    const handleBackToDetail = useCallback(() => {
        clearError();
        setPhase('teacher-class-detail');
    }, [clearError, setPhase]);

    /** Clear the selected Google course (used after classroom creation). */
    const clearSelectedCourse = useCallback(() => {
        setSelectedGoogleCourse(null);
    }, []);

    return {
        googleCourses,
        googleCourseAccess,
        isVerifyingGoogleCourseAccess,
        handleCheckGoogleCourseAccess,
        handleVerifyGoogleCourseAccess,
        selectedGoogleCourse,
        handleShowGoogleCourses,
        handleLoadGoogleCourses,
        handleSelectGoogleCourse,
        handleConfirmGoogleImport,
        handleShowCreateForm,
        handlePostAssignment,
        handleShowPostAssignment,
        handleBackToDetail,
        clearSelectedCourse,
    };
};

export default useGoogleClassroom;
