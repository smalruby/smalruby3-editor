// The progress display under the header (#1293 G9): round nodes joined by a
// line under the step names, like a delivery tracker (#1425). A finished step is
// a filled circle with ✓ (and can be gone back to before the blocks are in), the
// current one a filled circle with a ring, the ones to come grey circles.
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { stepperItems } from '../../lib/genai-concierge-state.js';
import styles from './genai-concierge.css';
import messages from './messages.js';

const STEP_MESSAGES = {
    trouble: messages.stepTrouble,
    copy: messages.stepCopy,
    paste: messages.stepPaste,
};

// The Ruby tab's answer goes into the code, not the blocks (#1399).
const CODE_STEP_MESSAGES = { ...STEP_MESSAGES, paste: messages.stepPasteCode };

const GenaiStepper = ({ step, putsCode, onStep }) => {
    const intl = useIntl();
    const names = putsCode ? CODE_STEP_MESSAGES : STEP_MESSAGES;
    const items = stepperItems(step);
    const at = items.filter((item) => item.status === 'done').length;
    const handleReturn = useCallback((e) => onStep(e.currentTarget.dataset.step), [onStep]);

    return (
        <ol className={styles.stepper} data-testid="genai-stepper" data-at={Math.min(at, items.length - 1)}>
            {items.map((item) => {
                const name = intl.formatMessage(names[item.id]);
                const content = (
                    <>
                        <span className={styles.stepName}>{name}</span>
                        <span className={styles.stepNode} aria-hidden="true">
                            {item.status === 'done' ? '✓' : ''}
                        </span>
                    </>
                );
                return (
                    <li
                        key={item.id}
                        className={classNames(styles.stepItem, styles[`step-${item.status}`])}
                        data-testid={`genai-step-${item.id}`}
                        data-status={item.status}
                        aria-current={item.status === 'current' ? 'step' : null}
                    >
                        {item.canReturn ? (
                            <button
                                className={styles.stepReturn}
                                data-step={item.id}
                                aria-label={intl.formatMessage(messages.backTo, { step: name })}
                                onClick={handleReturn}
                            >
                                {content}
                            </button>
                        ) : (
                            content
                        )}
                    </li>
                );
            })}
        </ol>
    );
};

GenaiStepper.propTypes = {
    step: PropTypes.string.isRequired,
    // The answer goes into a code editor (the adapter's puts is 'code').
    putsCode: PropTypes.bool,
    onStep: PropTypes.func.isRequired,
};

export default GenaiStepper;
