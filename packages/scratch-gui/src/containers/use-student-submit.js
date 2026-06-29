/**
 * Student submission hook.
 *
 * Manages the submit-confirm flow: thumbnail capture, block screenshots,
 * project upload, and progress tracking.
 */
import { useCallback, useState } from 'react';
import analytics from '../lib/analytics';
import { renderBlocksToCanvas } from '../lib/blocks-screenshot.js';
import classroomAPI from '../lib/classroom-api.js';
import { getProjectThumbnail } from '../lib/store-project-thumbnail.js';
import { clearClassroomSession, setSubmissionStatus } from '../reducers/classroom.js';
import translateError from './classroom-error-utils.js';

/**
 * @param {object} params - hook dependencies
 * @param {object} params.classroomState - Redux classroom state
 * @param {object} params.vm - Scratch VM instance
 * @param {object|null} params.scratchBlocks - scratchBlocks instance
 * @param {string} params.projectTitle - current project title
 * @param {Function} params.dispatch - Redux dispatch
 * @param {Function} params.clearError - clear error helper
 * @param {Function} params.showError - error display helper
 * @param {Function} params.showSessionExpiredError - session-expired error helper
 * @param {object} params.intl - react-intl intl object
 * @param {Function} params.setIsLoading - loading state setter
 * @param {Function} params.setPhase - phase setter
 * @returns {object} submit state and handler functions
 */
const useStudentSubmit = ({
    classroomState,
    vm,
    scratchBlocks,
    projectTitle,
    dispatch,
    clearError,
    showError,
    showSessionExpiredError,
    intl,
    setIsLoading,
    setPhase,
}) => {
    const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null);
    const [submitProgress, setSubmitProgress] = useState(null);

    const handleStartSubmit = useCallback(() => {
        clearError();
        // If the student manually picked a submission thumbnail (stage-header button),
        // reuse it; otherwise auto-capture the current stage frame as before (#631).
        if (classroomState.submissionThumbnail) {
            setThumbnailDataUrl(classroomState.submissionThumbnail);
        } else {
            setThumbnailDataUrl(null);
            if (vm && vm.renderer) {
                getProjectThumbnail(vm, (dataUrl) => {
                    setThumbnailDataUrl(dataUrl);
                });
            }
        }
        setPhase('student-submit-confirm');
    }, [vm, clearError, setPhase, classroomState.submissionThumbnail]);

    const captureBlockScreenshots = useCallback(async () => {
        if (!vm || !scratchBlocks) return [];
        const workspace = scratchBlocks.getMainWorkspace();
        if (!workspace) return [];

        const originalTargetId = vm.editingTarget?.id;
        const allTargets = vm.runtime.targets.filter((t) => !t.isOriginal === false || t.isOriginal);
        const targetsWithBlocks = allTargets.filter((t) => {
            const blocks = t.blocks._blocks;
            return blocks && Object.keys(blocks).length > 0;
        });

        const blobs = [];
        for (let i = 0; i < targetsWithBlocks.length; i++) {
            const target = targetsWithBlocks[i];
            setSubmitProgress({
                current: i + 1,
                total: targetsWithBlocks.length,
                label: target.sprite.name,
            });

            vm.setEditingTarget(target.id);
            await new Promise((resolve) => {
                setTimeout(() => requestAnimationFrame(resolve), 100);
            });

            try {
                const costumeDataUri = target.sprite.costumes[target.currentCostume]?.asset?.encodeDataURI();
                const canvas = await renderBlocksToCanvas(workspace, costumeDataUri);
                if (!canvas) continue;

                const blob = await new Promise((resolve) => {
                    canvas.toBlob(resolve, 'image/png');
                });
                if (blob) blobs.push(blob);
            } catch {
                // Skip sprites that fail to capture
            }
        }

        if (originalTargetId) {
            vm.setEditingTarget(originalTargetId);
        }
        setSubmitProgress(null);
        return blobs;
    }, [vm, scratchBlocks]);

    const handleConfirmSubmit = useCallback(async () => {
        if (!classroomState.sessionToken || !classroomState.classroomId) return;
        clearError();
        setIsLoading(true);
        try {
            const submitProjectTitle = projectTitle || 'Untitled';
            const screenshotBlobs = await captureBlockScreenshots();

            const submissionData = await classroomAPI.createSubmission(
                classroomState.sessionToken,
                classroomState.classroomId,
                submitProjectTitle,
                screenshotBlobs.length,
            );

            setSubmitProgress({ current: 0, total: 1, label: 'project' });
            const sb3Data = await vm.saveProjectSb3();
            const MAX_FILE_SIZE = 10 * 1024 * 1024;
            if (sb3Data.byteLength > MAX_FILE_SIZE) {
                const sizeMB = (sb3Data.byteLength / (1024 * 1024)).toFixed(1);
                throw new Error(
                    intl.formatMessage(
                        {
                            defaultMessage: 'Project is too large ({size}MB). Maximum size is 10MB.',
                            description: 'File too large error',
                            id: 'gui.classroom.error.fileTooLarge',
                        },
                        { size: sizeMB },
                    ),
                );
            }
            await classroomAPI.uploadToPresignedUrl(submissionData.uploadUrl, sb3Data, 'application/octet-stream');

            if (thumbnailDataUrl) {
                const thumbnailBlob = await fetch(thumbnailDataUrl).then((r) => r.blob());
                await classroomAPI.uploadToPresignedUrl(
                    submissionData.thumbnailUploadUrl,
                    thumbnailBlob,
                    'image/png',
                );
            }

            if (screenshotBlobs.length > 0 && submissionData.screenshotUploadUrls) {
                await Promise.all(
                    screenshotBlobs.map((blob, i) =>
                        classroomAPI.uploadToPresignedUrl(submissionData.screenshotUploadUrls[i], blob, 'image/png'),
                    ),
                );
            }

            setSubmitProgress(null);
            dispatch(setSubmissionStatus('submitted', submissionData.submittedAt));
            setPhase('student-status');
            try {
                analytics.event({
                    category: 'classroom',
                    action: 'submit',
                    label: screenshotBlobs && screenshotBlobs.length > 0 ? 'with_screenshots' : 'no_screenshots',
                });
            } catch (_e) {
                // Swallow analytics failures so the editor never breaks.
            }
        } catch (err) {
            setSubmitProgress(null);
            if (err.status === 401) {
                dispatch(clearClassroomSession());
                showSessionExpiredError(translateError(intl, err, 'session'));
            } else {
                showError(translateError(intl, err));
            }
        } finally {
            setIsLoading(false);
        }
    }, [
        classroomState,
        vm,
        projectTitle,
        thumbnailDataUrl,
        captureBlockScreenshots,
        dispatch,
        clearError,
        showError,
        showSessionExpiredError,
        intl,
        setIsLoading,
        setPhase,
    ]);

    const handleCancelSubmit = useCallback(() => {
        setPhase('student-status');
    }, [setPhase]);

    return {
        thumbnailDataUrl,
        submitProgress,
        handleStartSubmit,
        handleConfirmSubmit,
        handleCancelSubmit,
    };
};

export default useStudentSubmit;
