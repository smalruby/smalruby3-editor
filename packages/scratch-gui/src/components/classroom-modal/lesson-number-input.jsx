/**
 * A number field of the lesson settings that keeps what the teacher types
 * and commits it only on blur or Enter (#1765 M1). Clamping on every key
 * made some values impossible to type: with a minimum of 2,「1」became 2
 * before「10」could be finished, and a cleared field jumped back at once.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';

const LessonNumberInput = ({ ariaLabel, className, disabled, max, min, testId, value, onCommit }) => {
    // null = not editing: show the committed value.
    const [text, setText] = useState(null);
    const commit = useCallback(() => {
        if (text === null) return;
        setText(null);
        onCommit(text);
    }, [text, onCommit]);
    const handleChange = useCallback((e) => setText(e.target.value), []);
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter') commit();
        },
        [commit],
    );
    return (
        <input
            aria-label={ariaLabel}
            className={className}
            data-testid={testId}
            disabled={disabled}
            max={max}
            min={min}
            type="number"
            value={text === null ? String(value) : text}
            onBlur={commit}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
        />
    );
};

LessonNumberInput.propTypes = {
    ariaLabel: PropTypes.string,
    className: PropTypes.string,
    disabled: PropTypes.bool,
    max: PropTypes.number,
    min: PropTypes.number,
    testId: PropTypes.string,
    value: PropTypes.number.isRequired,
    // Called with the typed string; the caller clamps and validates it.
    onCommit: PropTypes.func.isRequired,
};

export default LessonNumberInput;
