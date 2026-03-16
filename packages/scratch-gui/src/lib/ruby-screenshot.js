// === Smalruby: This file is Smalruby-specific (Ruby tab screenshot export) ===

import {toBlob} from 'html-to-image';
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

        // Capture the editor DOM as a PNG blob
        const blob = await toBlob(editorDomNode, {
            backgroundColor: '#ffffff',
            pixelRatio: 2
        });

        if (blob) {
            downloadBlob(buildFilename(projectTitle, spriteName), blob);
        }
    } finally {
        // Restore original state
        containerEl.style.height = originalHeight;
        containerEl.style.overflow = originalOverflow;
        editor.layout();
        editor.setScrollTop(scrollTop);
        editor.setScrollLeft(scrollLeft);
    }
};

export {
    buildFilename,
    downloadRubyAsImage
};
