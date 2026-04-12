/**
 * Google Classroom integration hook.
 *
 * Manages course listing, import flow, and assignment posting.
 */
import { useCallback, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import { requestClassroomAccessToken, clearClassroomAccessToken } from '../lib/google-classroom-auth.js';
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
}) => {
    const [googleAccessToken, setGoogleAccessToken] = useState(null);
    const [googleCourses, setGoogleCourses] = useState([]);
    const [selectedGoogleCourse, setSelectedGoogleCourse] = useState(null);

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
            if (err.status === 401) {
                clearClassroomAccessToken();
            }
            showError(translateError(intl, err));
        } finally {
            setIsLoading(false);
        }
    }, [idToken, clearError, showError, intl, setIsLoading]);

    const handleSelectGoogleCourse = useCallback(course => {
        setSelectedGoogleCourse(course);
    }, []);

    const handleConfirmGoogleImport = useCallback(() => {
        if (!selectedGoogleCourse) return;
        setPhase('teacher-create');
    }, [selectedGoogleCourse, setPhase]);

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
                    setSelectedClassroom(prev => ({
                        ...prev,
                        googleClassroomAlternateLink: result.alternateLink,
                    }));
                    setClassrooms(prev =>
                        prev.map(c =>
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
                if (err.status === 401) {
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
