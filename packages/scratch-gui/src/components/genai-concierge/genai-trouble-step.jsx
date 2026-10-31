// Step 1: the student picks a kind of trouble and describes it in their own words.
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { PROBLEM_KINDS } from '../../lib/genai-prompt.js';

import styles from './genai-concierge.css';
import messages, { KIND_MESSAGES } from './messages.js';

const GenaiTroubleStep = ({ kindId, text, onKindChange, onTextChange, onMakePrompt }) => {
    const intl = useIntl();
    const starterOf = (id) => intl.formatMessage(KIND_MESSAGES[id].starter);

    const handleKindClick = useCallback(
        (e) => {
            const id = e.currentTarget.dataset.kind;
            // The starter seeds an empty box so the student goes on in their own words.
            onKindChange(id, text.trim() ? null : intl.formatMessage(KIND_MESSAGES[id].starter));
        },
        [intl, onKindChange, text],
    );
    const handleTextChange = useCallback((e) => onTextChange(e.target.value), [onTextChange]);

    // Leaving the starter as it is does not count as the student's own words.
    const ready = kindId && text.trim() && text.trim() !== starterOf(kindId);

    return (
        <>
            <p className={styles.label}>
                <FormattedMessage {...messages.troubleQuestion} />
            </p>
            <div className={styles.chips}>
                {PROBLEM_KINDS.map((k) => (
                    <button
                        key={k.id}
                        className={k.id === kindId ? styles.chipOn : styles.chip}
                        data-testid={`genai-kind-${k.id}`}
                        data-kind={k.id}
                        onClick={handleKindClick}
                    >
                        <FormattedMessage {...KIND_MESSAGES[k.id].label} />
                    </button>
                ))}
            </div>
            <p className={styles.label}>
                <FormattedMessage {...messages.troubleOwnWords} />
            </p>
            <textarea
                className={styles.text}
                data-testid="genai-trouble-text"
                rows={3}
                value={text}
                onChange={handleTextChange}
            />
            <div className={styles.row}>
                <button
                    className={styles.primary}
                    data-testid="genai-make-prompt"
                    disabled={!ready}
                    onClick={onMakePrompt}
                >
                    <FormattedMessage {...messages.makePrompt} />
                </button>
            </div>
        </>
    );
};

GenaiTroubleStep.propTypes = {
    kindId: PropTypes.string,
    text: PropTypes.string.isRequired,
    onKindChange: PropTypes.func.isRequired,
    onTextChange: PropTypes.func.isRequired,
    onMakePrompt: PropTypes.func.isRequired,
};

export default GenaiTroubleStep;
