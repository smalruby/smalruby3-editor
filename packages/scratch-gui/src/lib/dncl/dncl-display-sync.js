// === Smalruby: This file is Smalruby-specific (showing the Ruby of the editing target in the Japanese tab) ===

/**
 * Whether the Ruby has a line that becomes a block: a line that is neither blank nor a comment.
 * @param {?string} ruby - The Ruby, or null for text that makes no Ruby.
 * @returns {boolean} Whether the Ruby makes statements.
 */
const makesStatements = (ruby) =>
    typeof ruby === 'string' &&
    ruby.split('\n').some((line) => {
        const text = line.trim();
        return text !== '' && !text.startsWith('#');
    });

/**
 * The Japanese the Japanese tab shows when the Ruby of the editing target changed outside the
 * editor (from the blocks, or by selecting another target).
 *
 * Empty Ruby empties the editor, as in the Ruby tab, when the target changed (a target without a
 * program, issue #2576) or when the text makes statements (its blocks were deleted in the Code
 * tab, issue #2583). Otherwise empty Ruby keeps the text: text that makes no blocks (a line of the
 * settings or comments only) comes back as empty Ruby, and text with errors makes no Ruby at all,
 * so the lines the student wrote must not be lost.
 * @param {object} params - The parameters.
 * @param {?string} params.editorRuby - The Ruby the text in the editor makes, or null when it has errors.
 * @param {string} params.ruby - The Ruby of the editing target.
 * @param {boolean} params.targetChanged - Whether the editing target changed.
 * @param {function(string): string} params.toJapanese - Turns the Ruby into Japanese.
 * @returns {?string} The text to show, or null to keep the text in the editor.
 */
const japaneseTextForRuby = ({ editorRuby, ruby, targetChanged, toJapanese }) => {
    if (editorRuby === ruby) return null;
    if (!ruby) return targetChanged || makesStatements(editorRuby) ? '' : null;
    return toJapanese(ruby);
};

export { japaneseTextForRuby };
