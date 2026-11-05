// The progress display under the header (#1293 G9): square nodes joined by a
// line under the step names. A finished step is filled in with ✓ (and can be
// gone back to before the blocks are in), the current one is outlined in bold.
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

const GenaiStepper = ({ step, onStep }) => {
    const intl = useIntl();
    const items = stepperItems(step);
    const at = items.filter((item) => item.status === 'done').length;
    const handleReturn = useCallback((e) => onStep(e.currentTarget.dataset.step), [onStep]);

    return (
        <ol className={styles.stepper} data-testid="genai-stepper" data-at={Math.min(at, items.length - 1)}>
            {items.map((item) => {
                const name = intl.formatMessage(STEP_MESSAGES[item.id]);
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
    onStep: PropTypes.func.isRequired,
};

export default GenaiStepper;
