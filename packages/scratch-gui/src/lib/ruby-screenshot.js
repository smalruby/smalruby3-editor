// === Smalruby: This file is Smalruby-specific (Ruby tab screenshot export) ===

import {toBlob} from 'html-to-image';
import downloadBlob from './download-blob';

/** Threshold below which a colour channel is considered "content" (handles anti-aliasing). */
const WHITE_THRESHOLD = 250;

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
 * Trims right-side whitespace from a PNG blob by scanning pixel data.
 * Finds the rightmost non-white column, then crops the image to that
 * column plus padding. Returns the original blob if cropping would not
 * save meaningful space.
 * @param {Blob} blob - source PNG blob
 * @param {number} padding - extra pixels to keep to the right of content
 * @returns {Promise<Blob>} cropped (or original) PNG blob
 */
const cropRightWhitespace = async function (blob, padding = 32) {
    const bitmap = await createImageBitmap(blob);
    const {width, height} = bitmap;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // Scan columns from right to find the rightmost column with content
    const imageData = ctx.getImageData(0, 0, width, height);
    const {data} = imageData;

    let rightmostContentX = 0;
    for (let x = width - 1; x >= 0; x--) {
        let hasContent = false;
        // Sample every 4th row for performance
        for (let y = 0; y < height; y += 4) {
            const idx = ((y * width) + x) * 4;
            if (data[idx] < WHITE_THRESHOLD ||
                data[idx + 1] < WHITE_THRESHOLD ||
                data[idx + 2] < WHITE_THRESHOLD) {
                hasContent = true;
                break;
            }
        }
        if (hasContent) {
            rightmostContentX = x;
            break;
        }
    }

    const cropWidth = Math.min(width, rightmostContentX + 1 + padding);

    // If cropping would not save meaningful space, return the original
    if (cropWidth >= width - padding) {
        return blob;
    }

    // Create a cropped canvas and export as PNG blob
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = height;
    const croppedCtx = croppedCanvas.getContext('2d');
    croppedCtx.drawImage(canvas, 0, 0, cropWidth, height, 0, 0, cropWidth, height);

    return new Promise(resolve => {
        croppedCanvas.toBlob(croppedBlob => {
            resolve(croppedBlob || blob);
        }, 'image/png');
    });
};

/**
 * Captures the Monaco editor content as a PNG image and triggers a download.
 * Temporarily expands the editor to its full content height so that all lines
 * (including those scrolled out of view) are rendered in the DOM before capture.
 * ViewZones (e.g. furigana annotations) are captured naturally as DOM elements.
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

    try {
        // Disable scrollBeyondLastLine to get tight content height
        editor.updateOptions({scrollBeyondLastLine: false});
        editor.layout();

        // Expand editor to full content height so all lines are in the DOM
        const contentHeight = editor.getContentHeight();
        containerEl.style.height = `${contentHeight}px`;
        containerEl.style.overflow = 'hidden';

        // Force Monaco to re-layout at the new size
        editor.layout();

        // Wait for Monaco to render all lines
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });

        // Capture the editor DOM as a PNG blob.
        // skipFonts avoids SecurityError when html-to-image tries to read
        // cssRules from cross-origin stylesheets (Monaco's CDN CSS).
        const blob = await toBlob(editorDomNode, {
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            skipFonts: true
        });

        if (blob) {
            const croppedBlob = await cropRightWhitespace(blob);
            downloadBlob(buildFilename(projectTitle, spriteName), croppedBlob);
        }
    } finally {
        // Restore original state
        editor.updateOptions({scrollBeyondLastLine: true});
        containerEl.style.height = originalHeight;
        containerEl.style.overflow = originalOverflow;
        editor.layout();
        editor.setScrollTop(scrollTop);
        editor.setScrollLeft(scrollLeft);
    }
};

export {
    buildFilename,
    cropRightWhitespace,
    downloadRubyAsImage
};
