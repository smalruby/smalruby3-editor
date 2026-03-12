// === Smalruby: This file is Smalruby-specific (execution line highlighting) ===

/**
 * Clear an existing executing line decoration.
 * @param {object|null} decoration - The decoration collection to clear.
 */
const clearDecoration = decoration => {
    if (decoration) {
        decoration.clear();
    }
};

/**
 * Highlight a single executing line in the editor.
 * @param {object} editor - Monaco editor instance.
 * @param {object} monaco - Monaco namespace.
 * @param {number} lineNumber - The line number to highlight.
 * @param {object|null} existingDecoration - Existing decoration to clear first.
 * @returns {object} New decoration collection.
 */
const highlightLine = (editor, monaco, lineNumber, existingDecoration) => {
    clearDecoration(existingDecoration);

    const decoration = editor.createDecorationsCollection([{
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
            isWholeLine: true,
            className: 'executing-line'
        }
    }]);

    editor.revealLineInCenter(lineNumber);
    return decoration;
};

/**
 * Highlight a range of executing lines in the editor.
 * @param {object} editor - Monaco editor instance.
 * @param {object} monaco - Monaco namespace.
 * @param {number} startLine - Start line number.
 * @param {number} endLine - End line number.
 * @param {object|null} existingDecoration - Existing decoration to clear first.
 * @returns {object} New decoration collection.
 */
const highlightLineRange = (editor, monaco, startLine, endLine, existingDecoration) => {
    clearDecoration(existingDecoration);

    const decoration = editor.createDecorationsCollection([{
        range: new monaco.Range(startLine, 1, endLine, 1),
        options: {
            isWholeLine: true,
            className: 'executing-line'
        }
    }]);

    const middleLine = Math.floor((startLine + endLine) / 2);
    editor.revealLineInCenter(middleLine);
    return decoration;
};

/**
 * Find the nearest non-empty line at or above the given line number.
 * @param {string} code - The full source code.
 * @param {number} lineNumber - The starting line number (1-based).
 * @returns {number|null} The line number of the nearest non-empty line, or null if none found.
 */
const findExecutableLine = (code, lineNumber) => {
    const lines = code.split('\n');
    let targetLine = lineNumber;

    while (targetLine >= 1) {
        const line = lines[targetLine - 1];
        if (line && line.trim() !== '') {
            return targetLine;
        }
        targetLine--;
    }
    return null;
};

export {
    clearDecoration,
    highlightLine,
    highlightLineRange,
    findExecutableLine
};
