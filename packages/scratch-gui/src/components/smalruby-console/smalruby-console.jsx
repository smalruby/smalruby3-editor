import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { connect } from 'react-redux';
import {
    addSmalrubyConsoleLine,
    CONSOLE_LINE_KINDS,
    clearSmalrubyConsole,
    setSmalrubyConsoleVisible,
} from '../../reducers/smalruby-console.js';
import { useSmalrubyConsoleSlot } from './smalruby-console-slot.jsx';
import styles from './smalruby-console.css';

// The runtime event the console extension emits for each printed line
// (SmalrubyConsoleBlocks.PRINT_EVENT in scratch-vm).
const PRINT_EVENT = 'SMALRUBY_CONSOLE_PRINT';
// The event the Japanese tab emits when its run button starts the program, so
// that the lines are cleared as by the green flag (Issue #2557, B17-4).
const CLEAR_EVENT = 'SMALRUBY_CONSOLE_CLEAR';

const stopPropagation = (e) => e.stopPropagation();

const messages = defineMessages({
    title: {
        id: 'gui.smalrubyConsole.title',
        defaultMessage: 'Console',
        description: 'Title of the console shown in place of the stage',
    },
    clear: {
        id: 'gui.smalrubyConsole.clear',
        defaultMessage: 'Clear',
        description: 'Button that clears the lines of the console',
    },
    close: {
        id: 'gui.smalrubyConsole.close',
        defaultMessage: 'Back to the stage',
        description: 'Button that hides the console and shows the stage again',
    },
    inputLabel: {
        id: 'gui.smalrubyConsole.inputLabel',
        defaultMessage: 'Type the answer and press Enter',
        description: 'Label of the field where the answer to the console input is typed',
    },
    empty: {
        id: 'gui.smalrubyConsole.empty',
        defaultMessage: 'What the program prints appears here.',
        description: 'Shown in the console before anything is printed',
    },
});

/**
 * Keeps the lines of the console from the VM: the printed lines, cleared when
 * the green flag or the run button of the Japanese tab starts the project.
 * Mounted with the stage, shown or not.
 * @param {?object} vm - The VM.
 * @param {Function} onLine - Adds a printed line.
 * @param {Function} onClear - Clears the lines.
 */
const useConsoleLines = (vm, onLine, onClear) => {
    useEffect(() => {
        const runtime = vm && vm.runtime;
        if (!runtime || typeof runtime.on !== 'function') return () => {};
        const handlePrint = (text) => onLine(text);
        runtime.on(PRINT_EVENT, handlePrint);
        runtime.on('PROJECT_START', onClear);
        runtime.on(CLEAR_EVENT, onClear);
        return () => {
            runtime.removeListener(PRINT_EVENT, handlePrint);
            runtime.removeListener('PROJECT_START', onClear);
            runtime.removeListener(CLEAR_EVENT, onClear);
        };
    }, [vm, onLine, onClear]);
};

/**
 * The console shown in place of the stage (docs/extension-smalruby-console/README.md):
 * the printed lines from the top, and a field for the answer while the program
 * waits for one (`入力する` or `聞いて待つ`). The stage's own question field is
 * hidden while the console is shown, so the answer is typed here. In the Japanese tab
 * the console fills the right column instead (a portal into its place), without the
 * button back to the stage (the `>_` button is always there), and comes out while the
 * program waits for an answer, so that the program does not stop unanswered.
 * @param {object} props - The props.
 * @param {boolean} props.inColumn - Whether to fill the right column of the Japanese tab.
 * @param {Array<{text: string, kind: string}>} props.lines - The lines.
 * @param {?string} props.question - The question the program waits on (null when none).
 * @param {boolean} props.visible - Whether the console is shown.
 * @param {?object} props.vm - The VM.
 * @param {Function} props.onAddLine - Adds a line.
 * @param {Function} props.onClear - Clears the lines.
 * @param {Function} props.onClose - Hides the console.
 * @param {Function} props.onQuestionAnswered - Answers the question.
 * @param {Function} props.onShow - Shows the console.
 * @returns {?React.ReactElement} The console, or null while hidden.
 */
const SmalrubyConsole = ({
    inColumn,
    lines,
    question,
    visible,
    vm,
    onAddLine,
    onClear,
    onClose,
    onQuestionAnswered,
    onShow,
}) => {
    const intl = useIntl();
    const columnSlot = useSmalrubyConsoleSlot();
    const slot = inColumn ? columnSlot : null;
    const [answer, setAnswer] = useState('');
    const linesRef = useRef(null);
    const inputRef = useRef(null);
    const asking = question !== null && typeof question !== 'undefined';

    const handleLine = useCallback((text) => onAddLine(text, CONSOLE_LINE_KINDS.output), [onAddLine]);
    useConsoleLines(vm, handleLine, onClear);

    useEffect(() => {
        if (visible && linesRef.current) linesRef.current.scrollTop = linesRef.current.scrollHeight;
    }, [visible, lines, asking]);

    useEffect(() => {
        if (visible && asking && inputRef.current) inputRef.current.focus();
    }, [visible, asking]);

    useEffect(() => {
        if (slot && asking && !visible) onShow();
    }, [slot, asking, visible]);

    const handleChange = useCallback((e) => setAnswer(e.target.value), []);
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            onAddLine(answer, CONSOLE_LINE_KINDS.input);
            setAnswer('');
            onQuestionAnswered(answer);
        },
        [answer, onAddLine, onQuestionAnswered],
    );

    if (!visible) return null;
    const content = (
        <div
            className={classNames(styles.console, { [styles.inColumn]: slot })}
            data-testid="smalruby-console"
            // The stage around it in the React tree takes a double click for itself.
            onDoubleClick={stopPropagation}
        >
            <div className={styles.header}>
                <span className={styles.title}>{intl.formatMessage(messages.title)}</span>
                <button
                    className={styles.headerButton}
                    data-testid="smalruby-console-clear"
                    onClick={onClear}
                    type="button"
                >
                    {intl.formatMessage(messages.clear)}
                </button>
                {slot ? null : (
                    <button
                        className={styles.headerButton}
                        data-testid="smalruby-console-close"
                        onClick={onClose}
                        type="button"
                    >
                        {intl.formatMessage(messages.close)}
                    </button>
                )}
            </div>
            <div className={styles.lines} data-testid="smalruby-console-lines" ref={linesRef}>
                {lines.length === 0 && !asking ? (
                    <div className={styles.empty}>{intl.formatMessage(messages.empty)}</div>
                ) : null}
                {lines.map((line, index) => (
                    <div
                        className={classNames(styles.line, { [styles.inputLine]: line.kind === 'input' })}
                        data-kind={line.kind}
                        data-testid="smalruby-console-line"
                        // The lines are only ever added at the end or all cleared.
                        key={index}
                    >
                        {line.text}
                    </div>
                ))}
                {asking ? (
                    <div className={styles.inputRow}>
                        {question ? <span className={styles.prompt}>{question}</span> : null}
                        <span aria-hidden="true" className={styles.caret}>
                            {'>'}
                        </span>
                        <input
                            aria-label={intl.formatMessage(messages.inputLabel)}
                            className={styles.input}
                            data-testid="smalruby-console-input"
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            ref={inputRef}
                            type="text"
                            value={answer}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
    return slot ? ReactDOM.createPortal(content, slot) : content;
};

SmalrubyConsole.propTypes = {
    inColumn: PropTypes.bool,
    lines: PropTypes.arrayOf(
        PropTypes.shape({
            kind: PropTypes.string,
            text: PropTypes.string,
        }),
    ).isRequired,
    onAddLine: PropTypes.func.isRequired,
    onClear: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onQuestionAnswered: PropTypes.func,
    onShow: PropTypes.func,
    question: PropTypes.string,
    visible: PropTypes.bool.isRequired,
    vm: PropTypes.object,
};

SmalrubyConsole.defaultProps = {
    inColumn: false,
    onQuestionAnswered: () => {},
    onShow: () => {},
    question: null,
};

const mapStateToProps = (state) => ({
    lines: state.scratchGui.smalrubyConsole.lines,
    visible: state.scratchGui.smalrubyConsole.visible,
});

const mapDispatchToProps = (dispatch) => ({
    onAddLine: (text, kind) => dispatch(addSmalrubyConsoleLine(text, kind)),
    onClear: () => dispatch(clearSmalrubyConsole()),
    onClose: () => dispatch(setSmalrubyConsoleVisible(false)),
    onShow: () => dispatch(setSmalrubyConsoleVisible(true)),
});

export { CLEAR_EVENT, PRINT_EVENT, SmalrubyConsole };
export default connect(mapStateToProps, mapDispatchToProps)(SmalrubyConsole);
