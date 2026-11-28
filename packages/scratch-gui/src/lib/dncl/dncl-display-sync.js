// === Smalruby: This file is Smalruby-specific (showing the Ruby of the editing target in the Japanese tab) ===

/**
 * The Japanese the Japanese tab shows when the Ruby of the editing target changed outside the
 * editor (from the blocks, or by selecting another target).
 *
 * Empty Ruby is shown only when the target changed: a target without a program empties the
 * editor, as in the Ruby tab (issue #2576). Without the change of the target, empty Ruby keeps the
 * text, since text that makes no blocks (a line of the settings only) comes back as empty Ruby.
 * @param {object} params - The parameters.
 * @param {string} params.editorRuby - The Ruby the text in the editor makes.
 * @param {string} params.ruby - The Ruby of the editing target.
 * @param {boolean} params.targetChanged - Whether the editing target changed.
 * @param {function(string): string} params.toJapanese - Turns the Ruby into Japanese.
 * @returns {?string} The text to show, or null to keep the text in the editor.
 */
const japaneseTextForRuby = ({ editorRuby, ruby, targetChanged, toJapanese }) => {
    if (editorRuby === ruby) return null;
    if (!ruby) return targetChanged ? '' : null;
    return toJapanese(ruby);
};

export { japaneseTextForRuby };
