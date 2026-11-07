// === Smalruby: This file is Smalruby-specific (offer to shift 1-based indexes pasted into DNCL mode) ===

import { defineMessages } from 'react-intl';

import { findOneBasedSuspects, hasOneBasedIndexNote, shiftArrayIndexes } from '../../lib/dncl/dncl-paste-index-shift';

// When a program whose comments say "the index starts at 1" is pasted into
// the Japanese (DNCL) mode editor, ask whether to shift its array indexes
// down by 1, then mark what was rewritten (green) and the lines that
// probably assume 1-based indexes but were not rewritten (yellow), such as
// loop ranges (Issue #1366).

/** How many entries of each list the summary dialog shows. */
const MAX_LISTED = 15;

const messages = defineMessages({
    confirm: {
        id: 'gui.rubyTab.dnclIndexShiftConfirm',
        defaultMessage:
            'In Smalruby Japanese mode, array indices start at 0. Shift the array indices of the pasted program down by 1?',
    },
    done: {
        id: 'gui.rubyTab.dnclIndexShiftDone',
        defaultMessage:
            'Shifted {count} array indices down by 1 (marked in green).\nLoop ranges (such as "i を 1 から n まで") were not changed. Fix them yourself if they should start at 0.',
    },
    changedHeading: {
        id: 'gui.rubyTab.dnclIndexShiftChangedHeading',
        defaultMessage: 'Changed:',
    },
    changedItem: {
        id: 'gui.rubyTab.dnclIndexShiftChangedItem',
        defaultMessage: 'Line {line}: {before} → {after}',
    },
    suspectsHeading: {
        id: 'gui.rubyTab.dnclIndexShiftSuspectsHeading',
        defaultMessage: 'These may also need fixing (marked in yellow):',
    },
    suspectItem: {
        id: 'gui.rubyTab.dnclIndexShiftSuspectItem',
        defaultMessage: 'Line {line}: {text} ({reason})',
    },
    more: {
        id: 'gui.rubyTab.dnclIndexShiftMore',
        defaultMessage: '…and {count} more',
    },
    changedHover: {
        id: 'gui.rubyTab.dnclIndexShiftChangedHover',
        defaultMessage: 'Index shifted down by 1: {before} → {after}',
    },
    assignOne: {
        id: 'gui.rubyTab.dnclIndexShiftReasonAssignOne',
        defaultMessage: 'sets a variable to 1; if it is used as an index, it may need to be 0',
    },
    loopFromOne: {
        id: 'gui.rubyTab.dnclIndexShiftReasonLoopFromOne',
        defaultMessage: 'the loop starts at 1; it may need to start at 0',
    },
    loopFromN: {
        id: 'gui.rubyTab.dnclIndexShiftReasonLoopFromN',
        defaultMessage: 'the loop skips the first elements; its start may need to be 1 smaller',
    },
    loopToLength: {
        id: 'gui.rubyTab.dnclIndexShiftReasonLoopToLength',
        defaultMessage: 'the loop runs up to the number of elements; with 0-based indices it ends at 要素数(X) - 1',
    },
    lessEqual: {
        id: 'gui.rubyTab.dnclIndexShiftReasonLessEqual',
        defaultMessage: 'compares an index with <=; with 0-based indices it may need to be <',
    },
});

/**
 * List entries for the summary dialog, cut at `MAX_LISTED`.
 * @param {Array<string>} items - The entries.
 * @param {function(object, object=): string} formatMessage - intl.formatMessage.
 * @returns {Array<string>} The lines to show.
 */
const listLines = (items, formatMessage) =>
    items.length > MAX_LISTED
        ? [...items.slice(0, MAX_LISTED), formatMessage(messages.more, { count: items.length - MAX_LISTED })]
        : items;

/**
 * Turn a position in the pasted text into a Monaco position.
 * @param {object} range - The pasted range in the model.
 * @param {number} line - 1-based line in the pasted text.
 * @param {number} column - 0-based column in that line.
 * @returns {{lineNumber: number, column: number}} The model position.
 */
const toModelPosition = (range, line, column) => ({
    lineNumber: range.startLineNumber + line - 1,
    column: (line === 1 ? range.startColumn : 1) + column,
});

/**
 * After a paste into the DNCL mode editor, offer to shift 1-based array
 * indexes down by 1 when the pasted text says indexes start at 1. Nothing
 * happens (no dialog) without such a note or without any array access.
 * When the user agrees, the pasted range is rewritten in one undo step, the
 * rewritten accesses and the suspicious lines are marked, and a summary is
 * shown; when the user declines, nothing changes.
 * @param {object} options - Options.
 * @param {object} options.editor - Monaco editor instance.
 * @param {object} options.monaco - Monaco namespace.
 * @param {object} options.range - The pasted range (`onDidPaste` event).
 * @param {function(object, object=): string} options.formatMessage - intl.formatMessage.
 * @param {function(string): boolean} [options.confirm] - Asks yes / no.
 * @param {function(string): void} [options.alert] - Shows the summary.
 * @returns {?object} The decorations collection marking the result, or
 *   null when nothing was rewritten.
 */
const offerDnclIndexShift = ({
    editor,
    monaco,
    range,
    formatMessage,
    // eslint-disable-next-line no-alert
    confirm = (message) => window.confirm(message),
    // eslint-disable-next-line no-alert
    alert = (message) => window.alert(message),
}) => {
    const model = editor.getModel();
    if (!model || range.isEmpty()) return null;
    const pasted = model.getValueInRange(range);
    if (!hasOneBasedIndexNote(pasted)) return null;
    const { text, changes } = shiftArrayIndexes(pasted);
    if (changes.length === 0) return null;
    if (!confirm(formatMessage(messages.confirm))) return null;

    editor.pushUndoStop();
    editor.executeEdits('smalruby.dnclIndexShift', [{ range, text, forceMoveMarkers: true }]);
    editor.pushUndoStop();

    const suspects = findOneBasedSuspects(text);
    const decorations = [
        ...changes.map((change) => {
            const start = toModelPosition(range, change.line, change.start);
            const end = toModelPosition(range, change.line, change.end);
            return {
                range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
                options: {
                    inlineClassName: 'dncl-index-shifted',
                    hoverMessage: { value: formatMessage(messages.changedHover, change) },
                },
            };
        }),
        ...suspects.map((suspect) => {
            const start = toModelPosition(range, suspect.line, suspect.start);
            const end = toModelPosition(range, suspect.line, suspect.end);
            return {
                range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
                options: {
                    inlineClassName: 'dncl-index-suspect',
                    hoverMessage: suspect.reasons.map((reason) => ({ value: formatMessage(messages[reason]) })),
                },
            };
        }),
    ];
    const collection = editor.createDecorationsCollection(decorations);

    const lineOf = (line) => range.startLineNumber + line - 1;
    // Nested accesses are listed with the access around them, so list only
    // the outermost ones.
    const outermost = changes.filter(
        (change) =>
            !changes.some(
                (o) => o !== change && o.line === change.line && o.start <= change.start && o.end >= change.end,
            ),
    );
    const summary = [
        formatMessage(messages.done, { count: changes.length }),
        '',
        formatMessage(messages.changedHeading),
        ...listLines(
            outermost.map((change) => formatMessage(messages.changedItem, { ...change, line: lineOf(change.line) })),
            formatMessage,
        ),
    ];
    if (suspects.length > 0) {
        summary.push(
            '',
            formatMessage(messages.suspectsHeading),
            ...listLines(
                suspects.map((suspect) =>
                    formatMessage(messages.suspectItem, {
                        line: lineOf(suspect.line),
                        text: suspect.text,
                        reason: suspect.reasons.map((reason) => formatMessage(messages[reason])).join(' / '),
                    }),
                ),
                formatMessage,
            ),
        );
    }
    alert(summary.join('\n'));
    return collection;
};

export { offerDnclIndexShift };
