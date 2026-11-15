/**
 * Student submission hook.
 *
 * Manages the submit-confirm flow: thumbnail capture, block screenshots,
 * project upload, and progress tracking.
 */
import { useCallback, useRef, useState } from 'react';
import analytics from '../lib/analytics';
import { renderBlocksToCanvas } from '../lib/blocks-screenshot.js';
import classroomAPI from '../lib/classroom-api.js';
import { CLASSROOM_STUDENT_EVENTS, secondsSince } from '../lib/classroom-student-analytics.js';
import { activeNow } from '../lib/lessons/lesson-analytics.js';
import { getProjectThumbnail } from '../lib/store-project-thumbnail.js';
import {
    clearClassroomSession,
    clearSubmissionThumbnail,
    closeClassroomModal,
    setStudentSubmitting,
    setSubmissionStatus,
} from '../reducers/classroom.js';
import translateError from './classroom-error-utils.js';

// Server-side limit of each screenshotLabels entry (#1239).
const MAX_SCREENSHOT_LABEL_LENGTH = 100;

const noTrack = () => {};

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
 * @param {Function} [params.targetCodeToBlocks] - converts the edited Ruby code to blocks
 *     (from RubyToBlocksConverterHOC)
 * @param {Function} [params.track] - sends a classroom_student GA event (#1831)
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
    targetCodeToBlocks,
    track = noTrack,
}) => {
    // When the confirmation was opened (activeNow clock), for the GA seconds (#1831).
    const openedAtRef = useRef(null);
    const trackResult = useCallback(
        (result) =>
            track(CLASSROOM_STUDENT_EVENTS.SUBMIT_RESULT, {
                result,
                seconds: secondsSince(openedAtRef.current, activeNow()),
            }),
        [track],
    );
    const [thumbnailDataUrl, setThumbnailDataUrl] = useState(null);
    const [submitProgress, setSubmitProgress] = useState(null);
    // Sending the submission (#1795). Kept apart from the modal's isLoading,
    // which verify-session also sets: the confirmation opened from the menu bar
    // must not read 「提出中...」 before the student has confirmed.
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        openedAtRef.current = activeNow();
        setPhase('student-submit-confirm');
    }, [vm, clearError, setPhase, classroomState.submissionThumbnail]);

    const captureBlockScreenshots = useCallback(async () => {
        // Sprite names travel with the images (#1208) so the peer viewer can
        // tell which sprite each block image belongs to.
        const empty = { blobs: [], labels: [] };
        if (!vm || !scratchBlocks) return empty;
        const workspace = scratchBlocks.getMainWorkspace();
        if (!workspace) return empty;

        const originalTargetId = vm.editingTarget?.id;
        const allTargets = vm.runtime.targets.filter((t) => !t.isOriginal === false || t.isOriginal);
        const targetsWithBlocks = allTargets.filter((t) => {
            const blocks = t.blocks._blocks;
            return blocks && Object.keys(blocks).length > 0;
        });

        const blobs = [];
        const labels = [];
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
                if (blob) {
                    blobs.push(blob);
                    labels.push(String(target.sprite.name || '').slice(0, MAX_SCREENSHOT_LABEL_LENGTH));
                }
            } catch {
                // Skip sprites that fail to capture
            }
        }

        if (originalTargetId) {
            vm.setEditingTarget(originalTargetId);
        }
        setSubmitProgress(null);
        return { blobs, labels };
    }, [vm, scratchBlocks]);

    const handleConfirmSubmit = useCallback(async () => {
        if (!classroomState.sessionToken || !classroomState.classroomId) return;
        clearError();
        setIsLoading(true);
        setIsSubmitting(true);
        // The menu bar's button is disabled meanwhile: no second, concurrent submit.
        dispatch(setStudentSubmitting(true));
        try {
            // Code edited in the Ruby tab is not blocks yet; submitting it as-is
            // sent a project without those blocks (#1449). Convert first, like
            // saving and running do.
            if (targetCodeToBlocks) {
                const converter = await targetCodeToBlocks(intl);
                if (!converter.result) {
                    // The HOC already opened the Ruby tab with the error; close
                    // the modal so the student can see it.
                    trackResult('convert_error');
                    dispatch(setStudentSubmitting(false));
                    dispatch(closeClassroomModal());
                    return;
                }
                await converter.apply();
            }

            const submitProjectTitle = projectTitle || 'Untitled';
            const { blobs: screenshotBlobs, labels: screenshotLabels } = await captureBlockScreenshots();

            const submissionData = await classroomAPI.createSubmission(
                classroomState.sessionToken,
                classroomState.classroomId,
                submitProjectTitle,
                screenshotBlobs.length,
                screenshotLabels,
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
            // The manually picked thumbnail is consumed by this submission. Clear it so a
            // later submit auto-captures the then-current stage frame unless re-picked (#631).
            dispatch(clearSubmissionThumbnail());
            // A big 「提出できました ✓」 (#1795); the menu bar turns green 「提出済み ✓」.
            setPhase('student-submit-done');
            trackResult('done');
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
            trackResult(err.status === 401 ? 'expired' : 'error');
            if (err.status === 401) {
                dispatch(clearClassroomSession());
                showSessionExpiredError(translateError(intl, err, 'session'));
            } else {
                showError(translateError(intl, err));
            }
        } finally {
            setIsLoading(false);
            setIsSubmitting(false);
            dispatch(setStudentSubmitting(false));
        }
    }, [
        classroomState,
        vm,
        projectTitle,
        thumbnailDataUrl,
        captureBlockScreenshots,
        targetCodeToBlocks,
        dispatch,
        clearError,
        showError,
        showSessionExpiredError,
        intl,
        setIsLoading,
        setPhase,
        trackResult,
    ]);

    // The confirmation is opened from the menu bar's 「提出する」 (#1795), so
    // 「やめる」 goes back to the work rather than to the status view.
    const handleCancelSubmit = useCallback(() => {
        trackResult('cancel');
        dispatch(closeClassroomModal());
    }, [dispatch, trackResult]);

    return {
        thumbnailDataUrl,
        submitProgress,
        isSubmitting,
        handleStartSubmit,
        handleConfirmSubmit,
        handleCancelSubmit,
    };
};

export default useStudentSubmit;
