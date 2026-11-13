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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineMessages } from 'react-intl';
import classroomAPI from '../lib/classroom-api.js';
import {
    ASSIGNMENT_IMAGE_CONTENT_TYPES,
    MAX_ASSIGNMENT_PAGES,
    buildAssignmentPayload,
    moveItem,
    normalizeMeshGroupLimit,
    normalizePeerView,
    validateEditorPages,
} from '../lib/classroom-assignment-utils.js';
import {
    buildLessonPayload,
    lessonChanges,
    lessonDraftFromSaved,
    validateLessonDraft,
} from '../lib/classroom-lesson-settings.js';
import { findCourse } from '../lib/lessons/courses.js';
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
    lessonUnknownCourse: {
        defaultMessage: 'The course of the lesson is not available. Choose another course or "Don\'t use lessons".',
        description: 'Assignment editor error: the lesson course does not exist in this version',
        id: 'gui.classroom.assignmentEditor.errorLessonUnknownCourse',
    },
    lessonNoChallenges: {
        defaultMessage: 'Choose at least one challenge for the lesson.',
        description: 'Assignment editor error: a course is chosen but no challenge is selected',
        id: 'gui.classroom.assignmentEditor.errorLessonNoChallenges',
    },
    templateOverwriteConfirm: {
        defaultMessage: 'Replace the current pages with the template?',
        description: 'Confirm before a template replaces edited pages',
        id: 'gui.classroom.assignmentEditor.templateOverwriteConfirm',
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
 * @param {string} params.phase - current UI phase (drives the auto-load)
 * @param {Function} params.setPhase - phase setter
 * @param {object} params.vm - Scratch VM instance (for "use open project")
 * @param {Function} [params.setSelectedClassroom] - selected classroom setter
 *     (reflects a saved meshGroupLimit)
 * @param {Function} [params.setClassrooms] - classroom list setter
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
    phase,
    setPhase,
    vm,
    setSelectedClassroom,
    setClassrooms,
}) => {
    const [editorPages, setEditorPages] = useState([]);
    // 'none' | 'keep' | 'new'
    const [starterMode, setStarterMode] = useState('none');
    // For 'new': where the sb3 bytes come from on save
    // {source: 'current-project'} | {source: 'file', blob, name}
    const [starterSource, setStarterSource] = useState(null);
    const [hasExistingStarter, setHasExistingStarter] = useState(false);
    // "Start from the previous submission" (#1202): students open the same
    // seat's submission from the previous assignment right after joining.
    const [startFromPrevious, setStartFromPrevious] = useState(false);
    // "Peer view" (#1208): 'none' | 'always' | 'afterSubmit'.
    const [peerView, setPeerView] = useState('none');
    // Mesh group size limit (#1257): lives on the classroom item (PATCH
    // /classrooms/{id}), not the assignment content, but is saved with it.
    const [meshGroupLimit, setMeshGroupLimit] = useState(
        normalizeMeshGroupLimit(selectedClassroom && selectedClassroom.meshGroupLimit),
    );
    const [isSaving, setIsSaving] = useState(false);
    // The stored start-from-previous / peer view, so the editor can mark an
    // unsaved choice (#1303 review Q1). Updated on each (re)load, i.e. also
    // right after a save.
    const [savedStartFromPrevious, setSavedStartFromPrevious] = useState(false);
    const [savedPeerView, setSavedPeerView] = useState('none');
    // Lesson settings (#1598): the editor draft (null = no lesson) and the
    // stored `lesson` field, to mark unsaved changes and to send `lesson`
    // only when it changed (an unchanged one — even of a course this version
    // does not know — is kept by omitting it).
    const [lessonDraft, setLessonDraft] = useState(null);
    const [savedLesson, setSavedLesson] = useState(null);

    /** Release blob preview URLs to avoid leaking object URLs. */
    const releasePreviews = useCallback((pages) => {
        for (const page of pages) {
            if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
        }
    }, []);

    /** Load the saved assignment content into the editor state (no phase change). */
    const loadAssignmentEditor = useCallback(async () => {
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
            setStartFromPrevious(data.startFromPrevious === true);
            setPeerView(normalizePeerView(data.peerView));
            setSavedStartFromPrevious(data.startFromPrevious === true);
            setSavedPeerView(normalizePeerView(data.peerView));
            setSavedLesson(data.lesson || null);
            setLessonDraft(lessonDraftFromSaved(data.lesson || null));
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

    // The description tab is the detail view's default — keep the editor
    // in sync with the opened assignment.
    useEffect(() => {
        if (phase === 'teacher-class-detail' && selectedClassroom) {
            loadAssignmentEditor();
        }
        // loadAssignmentEditor identity changes with the classroom — the two
        // deps below are the actual triggers.
    }, [phase === 'teacher-class-detail', selectedClassroom && selectedClassroom.classroomId]);

    // Follow the opened classroom's stored value (also after a save updates
    // it). Not part of loadAssignmentEditor: its post-save reload closes over
    // the pre-save classroom and would put the old value back. Re-entering the
    // detail view also resets it, so an unsaved choice does not come back when
    // the same assignment is opened again.
    const storedMeshGroupLimit = normalizeMeshGroupLimit(selectedClassroom && selectedClassroom.meshGroupLimit);
    useEffect(() => {
        setMeshGroupLimit(storedMeshGroupLimit);
    }, [phase === 'teacher-class-detail', selectedClassroom && selectedClassroom.classroomId, storedMeshGroupLimit]);

    const savedSettings = useMemo(
        () => ({
            startFromPrevious: savedStartFromPrevious,
            peerView: savedPeerView,
            meshGroupLimit: storedMeshGroupLimit,
        }),
        [savedStartFromPrevious, savedPeerView, storedMeshGroupLimit],
    );

    const handleAddPage = useCallback(() => {
        setEditorPages((pages) => (pages.length >= MAX_ASSIGNMENT_PAGES ? pages : [...pages, { text: '' }]));
    }, []);

    /**
     * Apply an official template: replaces the pages with the template's
     * pages (asks first when the editor already has content). The teacher
     * customizes the text afterwards and attaches a starter as usual.
     */
    const handleApplyTemplate = useCallback(
        (template) => {
            if (!template) return;
            setEditorPages((pages) => {
                const hasContent = pages.some((page) => (page.text || '').trim() || page.imageKey || page.previewUrl);
                if (hasContent) {
                    // eslint-disable-next-line no-alert
                    if (!window.confirm(intl.formatMessage(messages.templateOverwriteConfirm))) {
                        return pages;
                    }
                    releasePreviews(pages);
                }
                return template.pages.map((page) => ({ text: page.text }));
            });
        },
        [intl, releasePreviews],
    );

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

    const handleChangeStartFromPrevious = useCallback((value) => {
        setStartFromPrevious(!!value);
    }, []);

    const handleChangePeerView = useCallback((value) => {
        setPeerView(normalizePeerView(value));
    }, []);

    const handleChangeMeshGroupLimit = useCallback((value) => {
        setMeshGroupLimit(normalizeMeshGroupLimit(value));
    }, []);

    const handleChangeLesson = useCallback((draft) => {
        setLessonDraft(draft || null);
    }, []);

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
        const lessonChanged = lessonChanges(lessonDraft, savedLesson).any;
        const lessonError = lessonChanged
            ? validateLessonDraft(lessonDraft, lessonDraft && findCourse(lessonDraft.courseId))
            : null;
        if (lessonError) {
            showError(
                intl.formatMessage(
                    lessonError === 'unknownCourse' ? messages.lessonUnknownCourse : messages.lessonNoChallenges,
                ),
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

            const payload = buildAssignmentPayload(editorPages, starterMode, startFromPrevious, peerView);
            if (lessonChanged) payload.lesson = buildLessonPayload(lessonDraft);
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

            if (meshGroupLimit !== normalizeMeshGroupLimit(selectedClassroom.meshGroupLimit)) {
                const { classroomId } = selectedClassroom;
                await classroomAPI.updateClassroom(idToken, classroomId, { meshGroupLimit });
                const apply = (c) => (c && c.classroomId === classroomId ? { ...c, meshGroupLimit } : c);
                if (setSelectedClassroom) setSelectedClassroom(apply);
                if (setClassrooms) setClassrooms((prev) => prev.map(apply));
            }

            releasePreviews(editorPages);
            setStarterSource(null);
            // Embedded in the description tab: reload the saved content so
            // image previews point at fresh signed URLs.
            await loadAssignmentEditor();
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
        startFromPrevious,
        peerView,
        meshGroupLimit,
        lessonDraft,
        savedLesson,
        vm,
        clearError,
        showError,
        intl,
        setPhase,
        handleTeacher401,
        releasePreviews,
        setSelectedClassroom,
        setClassrooms,
    ]);

    return {
        editorPages,
        starterMode,
        starterSource,
        hasExistingStarter,
        isSaving,
        startFromPrevious,
        peerView,
        meshGroupLimit,
        savedSettings,
        lessonDraft,
        savedLesson,
        loadAssignmentEditor,
        handleAddPage,
        handleRemovePage,
        handleMovePage,
        handleChangePageText,
        handleAttachPageImage,
        handleRemovePageImage,
        handleUseCurrentProjectAsStarter,
        handleUseFileAsStarter,
        handleRemoveStarter,
        handleChangeStartFromPrevious,
        handleChangePeerView,
        handleChangeMeshGroupLimit,
        handleChangeLesson,
        handleSaveAssignment,
        handleApplyTemplate,
    };
};

export default useTeacherAssignment;
