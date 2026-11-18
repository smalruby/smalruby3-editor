// === Smalruby: This file is Smalruby-specific (take a pasted note on the indexes as the setting) ===
import { defineMessages } from 'react-intl';
import { hasOneBasedIndexNote } from '../../lib/dncl/dncl-index-note';
import { dnclWithIndexFromOne } from '../../lib/dncl/dncl-settings';

// When a program whose comments say "the indexes start at 1" is pasted into the
// Japanese mode editor, ask whether to take it as the setting of the program:
// the sentence `# すべての配列の添字は 1 から始まる。` is written at the top
// (docs/dncl/design.md 4 章). The indexes of the pasted text are kept as they
// are written: with the setting they mean what the problem says.

const messages = defineMessages({
    confirm: {
        id: 'gui.rubyTab.dnclIndexSettingConfirm',
        defaultMessage:
            'The pasted program says that its array indices start at 1. Write "すべての配列の添字は 1 から始まる。" at the top of the program, so that the indices start at 1?',
    },
});

/**
 * Change the text of the editor to `after` in one undo step, replacing only the
 * part that differs (so the cursor and the view stay where they are).
 * @param {object} editor - Monaco editor instance.
 * @param {string} after - The new text.
 * @param {string} source - The name of the edit.
 * @returns {boolean} True when the text changed.
 */
const replaceEditorText = (editor, after, source) => {
    const model = editor.getModel();
    const before = model.getValue();
    if (before === after) return false;
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    let end = 0;
    while (
        end < before.length - start &&
        end < after.length - start &&
        before[before.length - 1 - end] === after[after.length - 1 - end]
    ) {
        end++;
    }
    const from = model.getPositionAt(start);
    const to = model.getPositionAt(before.length - end);
    editor.pushUndoStop();
    editor.executeEdits(source, [
        {
            range: {
                startLineNumber: from.lineNumber,
                startColumn: from.column,
                endLineNumber: to.lineNumber,
                endColumn: to.column,
            },
            text: after.substring(start, after.length - end),
            forceMoveMarkers: true,
        },
    ]);
    editor.pushUndoStop();
    return true;
};

/**
 * After a paste into the Japanese mode editor, offer to take a note of the
 * pasted text that the indexes start at 1 as the setting of the program.
 * Nothing happens (no dialog) without such a note, or when the program says
 * so at its top already.
 * @param {object} options - Options.
 * @param {object} options.editor - Monaco editor instance.
 * @param {object} options.range - The pasted range (`onDidPaste` event).
 * @param {function(object, object=): string} options.formatMessage - intl.formatMessage.
 * @param {function(string): boolean} [options.confirm] - Asks yes / no.
 * @returns {boolean} True when the setting was written.
 */
const offerDnclIndexSetting = ({
    editor,
    range,
    formatMessage,
    // eslint-disable-next-line no-alert
    confirm = (message) => window.confirm(message),
}) => {
    const model = editor.getModel();
    if (!model || range.isEmpty()) return false;
    if (!hasOneBasedIndexNote(model.getValueInRange(range))) return false;
    const after = dnclWithIndexFromOne(model.getValue());
    if (after === null) return false;
    if (!confirm(formatMessage(messages.confirm))) return false;
    return replaceEditorText(editor, after, 'smalruby.dnclIndexSetting');
};

export { offerDnclIndexSetting, replaceEditorText };
