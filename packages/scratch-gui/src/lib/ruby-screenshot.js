// === Smalruby: This file is Smalruby-specific (Ruby tab screenshot export) ===
import { toBlob } from 'html-to-image';
import downloadBlob from './download-blob';

/**
 * Builds the export filename for Ruby tab screenshots.
 * @param {string} projectTitle - Project name
 * @param {string} spriteName - Sprite / stage name
 * @returns {string} PNG filename
 */
const buildFilename = function (projectTitle, spriteName) {
    return `${projectTitle}_${spriteName}_ruby.png`;
};

/**
 * Measures the maximum rendered text width across all visible lines
 * in the Monaco editor, relative to the editor DOM node's left edge.
 * This is more reliable than pixel scanning because Monaco renders
 * decorative elements (overview ruler, scrollbar, line highlights)
 * that span the full editor width.
 * @param {HTMLElement} editorDomNode - the editor's root DOM node
 * @returns {number} maximum text right edge in CSS pixels, relative to editorDomNode
 */
const measureTextWidth = function (editorDomNode) {
    const viewLines = editorDomNode.querySelector('.view-lines');
    if (!viewLines) return 0;

    const editorLeft = editorDomNode.getBoundingClientRect().left;
    let maxRight = 0;

    for (const line of viewLines.children) {
        const spans = line.querySelectorAll('span span');
        for (const span of spans) {
            const right = span.getBoundingClientRect().right;
            if (right > maxRight) maxRight = right;
        }
    }

    return maxRight > 0 ? maxRight - editorLeft : 0;
};

/**
 * Measures the maximum rendered furigana annotation width.
 * ViewZones may extend beyond the code text width.
 * @param {HTMLElement} editorDomNode - the editor's root DOM node
 * @returns {number} maximum furigana right edge in CSS pixels, relative to editorDomNode
 */
const measureFuriganaWidth = function (editorDomNode) {
    const viewZones = editorDomNode.querySelector('.view-zones');
    if (!viewZones) return 0;

    const editorLeft = editorDomNode.getBoundingClientRect().left;
    let maxRight = 0;

    const spans = viewZones.querySelectorAll('span');
    for (const span of spans) {
        const right = span.getBoundingClientRect().right;
        if (right > maxRight) maxRight = right;
    }

    return maxRight > 0 ? maxRight - editorLeft : 0;
};

/**
 * Crops a PNG blob to the specified width.
 * Returns the original blob if cropping would not reduce the width.
 * @param {Blob} blob - source PNG blob
 * @param {number} cropWidth - target width in image pixels
 * @returns {Promise<Blob>} cropped (or original) PNG blob
 */
const cropToWidth = async function (blob, cropWidth) {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;

    // No crop needed if target width >= image width
    if (cropWidth >= width) {
        bitmap.close();
        return blob;
    }

    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, cropWidth, height, 0, 0, cropWidth, height);
    bitmap.close();

    return new Promise((resolve) => {
        canvas.toBlob((croppedBlob) => {
            resolve(croppedBlob || blob);
        }, 'image/png');
    });
};

/**
 * Captures the Monaco editor content as a PNG image and triggers a download.
 * Temporarily expands the editor to its full content height so that all lines
 * (including those scrolled out of view) are rendered in the DOM before capture.
 * ViewZones (e.g. furigana annotations) are captured naturally as DOM elements.
 * After capture, the image is cropped to the actual text content width to remove
 * the large right-side whitespace caused by the editor being wider than the code.
 * @param {object} editor - Monaco editor instance
 * @param {string} projectTitle - Project name (used in filename)
 * @param {string} spriteName - Sprite / stage name (used in filename)
 * @returns {Promise<void>}
 */
const downloadRubyAsImage = async function (editor, projectTitle, spriteName) {
    if (!editor) return;

    const editorDomNode = editor.getDomNode();
    if (!editorDomNode) return;

    const model = editor.getModel();
    if (!model || model.getLineCount() === 0) return;

    // Save original state
    const scrollTop = editor.getScrollTop();
    const scrollLeft = editor.getScrollLeft();
    const containerEl = editorDomNode.parentElement;
    const originalHeight = containerEl.style.height;
    const originalOverflow = containerEl.style.overflow;

    /** Extra pixels (CSS) added to the right of the content boundary. */
    const CROP_PADDING = 16;
    const PIXEL_RATIO = 2;

    try {
        // Disable scrollBeyondLastLine to get tight content height
        editor.updateOptions({ scrollBeyondLastLine: false });
        editor.layout();

        // Expand editor to full content height so all lines are in the DOM
        const contentHeight = editor.getContentHeight();
        containerEl.style.height = `${contentHeight}px`;
        containerEl.style.overflow = 'hidden';

        // Force Monaco to re-layout at the new size
        editor.layout();

        // Wait for Monaco to render all lines
        await new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });

        // Measure content width from rendered DOM before capture
        const textWidth = measureTextWidth(editorDomNode);
        const furiganaWidth = measureFuriganaWidth(editorDomNode);
        const contentWidth = Math.max(textWidth, furiganaWidth);

        // Capture the editor DOM as a PNG blob.
        // skipFonts avoids SecurityError when html-to-image tries to read
        // cssRules from cross-origin stylesheets (Monaco's CDN CSS).
        const blob = await toBlob(editorDomNode, {
            backgroundColor: '#ffffff',
            pixelRatio: PIXEL_RATIO,
            skipFonts: true,
        });

        if (blob) {
            let downloadableBlob = blob;
            if (contentWidth > 0) {
                const cropWidthPx = Math.ceil((contentWidth + CROP_PADDING) * PIXEL_RATIO);
                downloadableBlob = await cropToWidth(blob, cropWidthPx);
            }
            downloadBlob(buildFilename(projectTitle, spriteName), downloadableBlob);
        }
    } finally {
        // Restore original state
        editor.updateOptions({ scrollBeyondLastLine: true });
        containerEl.style.height = originalHeight;
        containerEl.style.overflow = originalOverflow;
        editor.layout();
        editor.setScrollTop(scrollTop);
        editor.setScrollLeft(scrollLeft);
    }
};

export { buildFilename, cropToWidth, measureFuriganaWidth, measureTextWidth, downloadRubyAsImage };
