// === Smalruby: This file is Smalruby-specific (put the auto-corrected text after the change) ===
/**
 * Put the auto-corrected text in the editor after the change that made it has
 * reached every listener of the model. Replacing the text from inside a
 * listener of the change gives the editor worker the replacement before the
 * change itself, and the worker throws (`Cannot read properties of undefined
 * (reading 'substring') at _acceptDeleteRange`. Issue #2557, B16).
 *
 * Nothing is put when the text has changed again in the meantime: that change
 * is auto-corrected by itself.
 * @param {object} editor - The Monaco editor.
 * @param {string} value - The text the change made.
 * @param {string} corrected - The auto-corrected text.
 * @param {function(string): string} correct - Auto-corrects a text (for the part before the cursor).
 * @param {Function} beforeApply - Called just before the text is put (the change it makes is not corrected again).
 */
const applyAutoCorrection = (editor, value, corrected, correct, beforeApply) => {
    queueMicrotask(() => {
        const model = editor.getModel();
        if (!model || model.getValue() !== value) return;
        const position = editor.getPosition();
        const beforeCursor = value.substring(0, model.getOffsetAt(position));
        const offsetDiff = beforeCursor.length - correct(beforeCursor).length;
        beforeApply();
        model.setValue(corrected);
        const newOffset = model.getOffsetAt(position) - offsetDiff;
        editor.setPosition(model.getPositionAt(Math.max(0, newOffset)));
    });
};

export { applyAutoCorrection };
