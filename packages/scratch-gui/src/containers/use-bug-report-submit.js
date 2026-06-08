/**
 * Bug report submission hook.
 *
 * Serializes the current project, captures a thumbnail and per-sprite block
 * screenshots, creates a bug report, and uploads everything to the presigned
 * S3 URLs returned by the API. Mirrors the classroom student-submit flow.
 */
import { useCallback, useState } from 'react';
import { renderBlocksToCanvas } from '../lib/blocks-screenshot.js';
import bugReportAPI from '../lib/bug-report-api.js';
import { getProjectThumbnail } from '../lib/store-project-thumbnail.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * @param {object} params - hook dependencies
 * @param {object} params.vm - Scratch VM instance
 * @param {object|null} params.scratchBlocks - scratchBlocks instance (optional)
 * @param {string} params.projectTitle - current project title
 * @returns {object} {submitProgressLabel, submitReport}
 */
const useBugReportSubmit = ({ vm, scratchBlocks, projectTitle }) => {
    const [submitProgressLabel, setSubmitProgressLabel] = useState(null);

    const captureThumbnail = useCallback(
        () =>
            new Promise((resolve) => {
                if (!vm || !vm.renderer) {
                    resolve(null);
                    return;
                }
                try {
                    getProjectThumbnail(vm, (dataUrl) => resolve(dataUrl));
                } catch {
                    resolve(null);
                }
            }),
        [vm],
    );

    const captureBlockScreenshots = useCallback(async () => {
        if (!vm || !scratchBlocks) return [];
        const workspace = scratchBlocks.getMainWorkspace();
        if (!workspace) return [];

        const originalTargetId = vm.editingTarget?.id;
        const targetsWithBlocks = vm.runtime.targets.filter((t) => {
            const blocks = t.blocks && t.blocks._blocks;
            return blocks && Object.keys(blocks).length > 0;
        });

        const blobs = [];
        for (let i = 0; i < targetsWithBlocks.length; i++) {
            const target = targetsWithBlocks[i];
            vm.setEditingTarget(target.id);
            await new Promise((resolve) => {
                setTimeout(() => requestAnimationFrame(resolve), 100);
            });
            try {
                const costumeDataUri = target.sprite.costumes[target.currentCostume]?.asset?.encodeDataURI();
                const canvas = await renderBlocksToCanvas(workspace, costumeDataUri);
                if (!canvas) continue;
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                if (blob) blobs.push(blob);
            } catch {
                // Skip sprites that fail to capture.
            }
        }
        if (originalTargetId) {
            vm.setEditingTarget(originalTargetId);
        }
        return blobs;
    }, [vm, scratchBlocks]);

    /**
     * Run the full submission. Throws on failure (caller shows the error).
     * @param {object} args - submission args
     * @param {string} args.idToken - authenticated ID token
     * @param {string} args.description - bug description
     * @param {object} [args.appContext] - editor context
     * @returns {Promise<string>} the created report id
     */
    const submitReport = useCallback(
        async ({ idToken, description, appContext }) => {
            setSubmitProgressLabel('screenshots');
            const thumbnailDataUrl = await captureThumbnail();
            const screenshotBlobs = await captureBlockScreenshots();

            setSubmitProgressLabel('project');
            const sb3Data = await vm.saveProjectSb3();
            if (sb3Data.byteLength > MAX_FILE_SIZE) {
                const sizeMB = (sb3Data.byteLength / (1024 * 1024)).toFixed(1);
                const err = new Error(`Project is too large (${sizeMB}MB). Maximum size is 10MB.`);
                err.code = 'fileTooLarge';
                throw err;
            }

            const report = await bugReportAPI.createReport(idToken, {
                description,
                projectName: projectTitle || 'Untitled',
                screenshotCount: screenshotBlobs.length,
                userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
                appContext,
            });

            setSubmitProgressLabel('upload');
            await bugReportAPI.uploadToPresignedUrl(report.uploadUrl, sb3Data, 'application/octet-stream');

            if (thumbnailDataUrl && report.thumbnailUploadUrl) {
                const thumbnailBlob = await fetch(thumbnailDataUrl).then((r) => r.blob());
                await bugReportAPI.uploadToPresignedUrl(report.thumbnailUploadUrl, thumbnailBlob, 'image/png');
            }

            if (screenshotBlobs.length > 0 && report.screenshotUploadUrls) {
                await Promise.all(
                    screenshotBlobs.map((blob, i) =>
                        bugReportAPI.uploadToPresignedUrl(report.screenshotUploadUrls[i], blob, 'image/png'),
                    ),
                );
            }

            setSubmitProgressLabel(null);
            return report.reportId;
        },
        [vm, projectTitle, captureThumbnail, captureBlockScreenshots],
    );

    return { submitProgressLabel, submitReport };
};

export default useBugReportSubmit;
