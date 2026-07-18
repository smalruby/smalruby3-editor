/**
 * みんなの課題 (shared assignment library) hook — EPIC #1066.
 *
 * S2 (#1069) scope: publishing an assignment from the detail view. The
 * catalog / import side (S3 #1070) extends this hook.
 */
import { useCallback, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';
import translateError from './classroom-error-utils.js';

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {Function} params.handleTeacher401 - 401 handler from auth hook
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setIsLoading - loading state setter
 * @returns {object} shared assignment state and handlers
 */
const useSharedAssignments = ({ idToken, handleTeacher401, clearError, showError, intl, setIsLoading }) => {
    // The share form is shown inline in the assignment detail; after a
    // successful publish we keep the created summary so the detail view can
    // confirm ("公開しました") instead of silently closing.
    const [showShareForm, setShowShareForm] = useState(false);
    const [lastShared, setLastShared] = useState(null);

    const handleOpenShareForm = useCallback(() => {
        setLastShared(null);
        setShowShareForm(true);
    }, []);
    const handleCloseShareForm = useCallback(() => setShowShareForm(false), []);

    const handleShareAssignment = useCallback(
        async (payload) => {
            clearError();
            setIsLoading(true);
            try {
                const shared = await classroomAPI.shareAssignment(idToken, payload);
                setLastShared(shared);
                setShowShareForm(false);
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
        [idToken, clearError, showError, handleTeacher401, intl, setIsLoading],
    );

    /** Reset share state (view switch / logout). */
    const resetSharedAssignments = useCallback(() => {
        setShowShareForm(false);
        setLastShared(null);
    }, []);

    return {
        showShareForm,
        lastShared,
        handleOpenShareForm,
        handleCloseShareForm,
        handleShareAssignment,
        resetSharedAssignments,
    };
};

export default useSharedAssignments;
