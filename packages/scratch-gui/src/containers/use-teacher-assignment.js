/**
 * Teacher assignment editor hook.
 *
 * Loads / saves the assignment content (pages + starter project) of the
 * selected classroom. Editor pages carry either an existing image
 * ({imageKey, imageUrl}) or a newly attached one ({newImageBlob,
 * newImageType, previewUrl}); the starter is tracked as a mode:
 *   'none' — no starter after save
 *   'keep' — keep the server-side starter as-is
 *   'new'  — upload a new starter on save (from the open project or a file)
 */
import { useCallback, useState } from 'react';
import { defineMessages } from 'react-intl';
import classroomAPI from '../lib/classroom-api.js';
import {
    ASSIGNMENT_IMAGE_CONTENT_TYPES,
    MAX_ASSIGNMENT_PAGES,
    buildAssignmentPayload,
    moveItem,
    validateEditorPages,
} from '../lib/classroom-assignment-utils.js';
import translateError from './classroom-error-utils.js';

const messages = defineMessages({
    textTooLong: {
        defaultMessage: 'Page {page} text is too long (max 500 characters)',
        description: 'Assignment editor error: page text too long',
        id: 'gui.classroom.assignmentEditor.errorTextTooLong',
    },
    tooManyPages: {
        defaultMessage: 'An assignment may have at most 10 pages',
        description: 'Assignment editor error: too many pages',
        id: 'gui.classroom.assignmentEditor.errorTooManyPages',
    },
    badImageType: {
        defaultMessage: 'Images must be PNG or JPEG',
        description: 'Assignment editor error: unsupported image type',
        id: 'gui.classroom.assignmentEditor.errorBadImageType',
    },
    starterSaveFailed: {
        defaultMessage: 'Failed to save the current project as starter',
        description: 'Assignment editor error: vm.saveProjectSb3 failed',
        id: 'gui.classroom.assignmentEditor.errorStarterSave',
    },
});

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token
 * @param {object|null} params.selectedClassroom - currently selected classroom
 * @param {Function} params.handleTeacher401 - 401 handler (session expiry)
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setIsLoading - loading state setter
 * @param {Function} params.setPhase - phase setter
 * @param {object} params.vm - Scratch VM instance (for "use open project")
 * @returns {object} assignment editor state and handlers
 */
const useTeacherAssignment = ({
    idToken,
    selectedClassroom,
    handleTeacher401,
    clearError,
    showError,
    intl,
    setIsLoading,
    setPhase,
    vm,
}) => {
    const [editorPages, setEditorPages] = useState([]);
    // 'none' | 'keep' | 'new'
    const [starterMode, setStarterMode] = useState('none');
    // For 'new': where the sb3 bytes come from on save
    // {source: 'current-project'} | {source: 'file', blob, name}
    const [starterSource, setStarterSource] = useState(null);
    const [hasExistingStarter, setHasExistingStarter] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    /** Release blob preview URLs to avoid leaking object URLs. */
    const releasePreviews = useCallback((pages) => {
        for (const page of pages) {
            if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
        }
    }, []);

    const handleShowAssignmentEditor = useCallback(async () => {
        if (!selectedClassroom) return;
        clearError();
        setIsLoading(true);
        try {
            const data = await classroomAPI.getAssignment(idToken, selectedClassroom.classroomId);
            const assignment = data.assignment;
            const pages = (assignment?.pages || []).map((page) => ({
                text: page.text,
                imageKey: page.imageKey || null,
                imageUrl: page.imageUrl || null,
            }));
            setEditorPages(pages.length > 0 ? pages : [{ text: '' }]);
            const hasStarter = !!assignment?.starterKey;
            setHasExistingStarter(hasStarter);
            setStarterMode(hasStarter ? 'keep' : 'none');
            setStarterSource(null);
            setPhase('teacher-assignment-edit');
        } catch (err) {
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            showError(translateError(intl, err));
        } finally {
            setIsLoading(false);
        }
    }, [idToken, selectedClassroom, clearError, showError, intl, setIsLoading, setPhase, handleTeacher401]);

    const handleAddPage = useCallback(() => {
        setEditorPages((pages) => (pages.length >= MAX_ASSIGNMENT_PAGES ? pages : [...pages, { text: '' }]));
    }, []);

    const handleRemovePage = useCallback((index) => {
        setEditorPages((pages) => {
            const removed = pages[index];
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return pages.filter((_, i) => i !== index);
        });
    }, []);

    const handleMovePage = useCallback((index, delta) => {
        setEditorPages((pages) => moveItem(pages, index, index + delta));
    }, []);

    const handleChangePageText = useCallback((index, text) => {
        setEditorPages((pages) => pages.map((page, i) => (i === index ? { ...page, text } : page)));
    }, []);

    const handleAttachPageImage = useCallback(
        (index, file) => {
            if (!file) return;
            if (!ASSIGNMENT_IMAGE_CONTENT_TYPES.includes(file.type)) {
                showError(intl.formatMessage(messages.badImageType));
                return;
            }
            clearError();
            setEditorPages((pages) =>
                pages.map((page, i) => {
                    if (i !== index) return page;
                    if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
                    return {
                        text: page.text,
                        newImageBlob: file,
                        newImageType: file.type,
                        previewUrl: URL.createObjectURL(file),
                    };
                }),
            );
        },
        [clearError, showError, intl],
    );

    const handleRemovePageImage = useCallback((index) => {
        setEditorPages((pages) =>
            pages.map((page, i) => {
                if (i !== index) return page;
                if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
                return { text: page.text };
            }),
        );
    }, []);

    const handleUseCurrentProjectAsStarter = useCallback(() => {
        clearError();
        setStarterMode('new');
        setStarterSource({ source: 'current-project' });
    }, [clearError]);

    const handleUseFileAsStarter = useCallback(
        (file) => {
            if (!file) return;
            clearError();
            setStarterMode('new');
            setStarterSource({ source: 'file', blob: file, name: file.name });
        },
        [clearError],
    );

    const handleRemoveStarter = useCallback(() => {
        setStarterMode('none');
        setStarterSource(null);
    }, []);

    const handleSaveAssignment = useCallback(async () => {
        if (!selectedClassroom) return;
        const validation = validateEditorPages(editorPages);
        if (validation) {
            showError(
                intl.formatMessage(messages[validation.error], {
                    page: (validation.pageIndex ?? 0) + 1,
                }),
            );
            return;
        }
        clearError();
        setIsSaving(true);
        try {
            // Resolve the starter bytes first so a broken project fails fast
            // before the server-side assignment is replaced.
            let starterData = null;
            if (starterMode === 'new') {
                if (starterSource?.source === 'file') {
                    starterData = starterSource.blob;
                } else {
                    try {
                        starterData = await vm.saveProjectSb3();
                    } catch {
                        showError(intl.formatMessage(messages.starterSaveFailed));
                        return;
                    }
                }
            }

            const payload = buildAssignmentPayload(editorPages, starterMode);
            const result = await classroomAPI.setAssignment(idToken, selectedClassroom.classroomId, payload);

            // Upload newly attached images / starter to the presigned URLs.
            const uploads = [];
            (result.imageUploadUrls || []).forEach((url, i) => {
                if (url && editorPages[i]?.newImageBlob) {
                    uploads.push(
                        classroomAPI.uploadToPresignedUrl(
                            url,
                            editorPages[i].newImageBlob,
                            editorPages[i].newImageType,
                        ),
                    );
                }
            });
            if (result.starterUploadUrl && starterData) {
                uploads.push(
                    classroomAPI.uploadToPresignedUrl(
                        result.starterUploadUrl,
                        starterData,
                        'application/octet-stream',
                    ),
                );
            }
            await Promise.all(uploads);

            releasePreviews(editorPages);
            setEditorPages([]);
            setStarterSource(null);
            setPhase('teacher-class-detail');
        } catch (err) {
            if (err.status === 401) {
                handleTeacher401();
                return;
            }
            showError(translateError(intl, err));
        } finally {
            setIsSaving(false);
        }
    }, [
        idToken,
        selectedClassroom,
        editorPages,
        starterMode,
        starterSource,
        vm,
        clearError,
        showError,
        intl,
        setPhase,
        handleTeacher401,
        releasePreviews,
    ]);

    const handleCancelAssignmentEdit = useCallback(() => {
        releasePreviews(editorPages);
        setEditorPages([]);
        setStarterSource(null);
        clearError();
        setPhase('teacher-class-detail');
    }, [editorPages, releasePreviews, clearError, setPhase]);

    return {
        editorPages,
        starterMode,
        starterSource,
        hasExistingStarter,
        isSaving,
        handleShowAssignmentEditor,
        handleAddPage,
        handleRemovePage,
        handleMovePage,
        handleChangePageText,
        handleAttachPageImage,
        handleRemovePageImage,
        handleUseCurrentProjectAsStarter,
        handleUseFileAsStarter,
        handleRemoveStarter,
        handleSaveAssignment,
        handleCancelAssignmentEdit,
    };
};

export default useTeacherAssignment;
