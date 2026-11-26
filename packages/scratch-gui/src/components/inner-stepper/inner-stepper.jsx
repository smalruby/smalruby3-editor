/**
 * 縦のステッパー（中の手順・#2454・EPIC #2438 の F1）。
 *
 * 外の手順（横の帯）の中にもう一段の手順があるときの形。外は横・中は縦、番号は「2」と「2-1」で
 * 段の違いを見せる。中の手順を太い枠で囲み、縦の番号つきで並べる。
 * いまの小手順だけ開き、終わった小手順は 1 行（まとめ）にたたむので、授業 PC の 600px の高さにも収まる。
 * 見出しを押すとその小手順を開く（開いているのはいつも 1 つまで）。
 *
 * 決まりは docs/design-system/components/inner-stepper.md。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import styles from './inner-stepper.css';

const messages = defineMessages({
    done: {
        defaultMessage: 'Done',
        description: 'State of a finished step in the inner (vertical) stepper',
        id: 'gui.innerStepper.done',
    },
    now: {
        defaultMessage: 'Now',
        description: 'State of the current step in the inner (vertical) stepper',
        id: 'gui.innerStepper.now',
    },
    todo: {
        defaultMessage: 'Not yet',
        description: 'State of a step not reached yet in the inner (vertical) stepper',
        id: 'gui.innerStepper.todo',
    },
});

const STATE_MESSAGES = { done: messages.done, now: messages.now, todo: messages.todo };

/**
 * はじめに開く小手順: いまの小手順。無ければ、まだ終わっていない最初の小手順。全部済んだら開かない。
 * @param {Array<{id: string, state: string}>} steps - 小手順
 * @returns {?string} 開く小手順の id
 */
export const initialOpenStepId = (steps) => {
    const now = steps.find((step) => step.state === 'now');
    if (now) return now.id;
    const notDone = steps.find((step) => step.state !== 'done');
    return notDone ? notDone.id : null;
};

/**
 * 縦のステッパー。開く小手順は、`openStepId` を渡せば使う側が決め（見出しを押すと `onToggleStep`）、
 * 渡さなければ部品の中で持つ。
 * @param {object} props - component props
 * @param {string} props.title - 枠の題（「手順 2 基準をつくる」など）
 * @param {Array<object>} props.steps - 小手順 `{id, number, title, state: 'done'|'now'|'todo', summary?, content}`
 * @param {?string} [props.openStepId] - 開いている小手順（使う側が決めるとき。null は全部閉じる）
 * @param {Function} [props.onToggleStep] - 見出しを押したとき（小手順の id を渡す）
 * @param {string} [props.testId] - data-testid（小手順は `<testId>-step-<id>`、見出しは `-head-`、まとめは `-summary-`）
 * @returns {React.ReactElement} the stepper
 */
const InnerStepper = ({ openStepId, steps, testId, title, onToggleStep }) => {
    const intl = useIntl();
    const controlled = typeof openStepId !== 'undefined';
    const [ownOpenId, setOwnOpenId] = useState(() => initialOpenStepId(steps));
    const openId = controlled ? openStepId : ownOpenId;
    const tid = (part, id) => testId && `${testId}-${part}-${id}`;

    const handleHeadClick = useCallback(
        (event) => {
            const id = event.currentTarget.dataset.stepId;
            if (onToggleStep) onToggleStep(id);
            if (!controlled) setOwnOpenId((current) => (current === id ? null : id));
        },
        [controlled, onToggleStep],
    );

    return (
        <section aria-label={title} className={styles.frame} data-testid={testId}>
            <h3 className={styles.title}>{title}</h3>
            <ol className={styles.list}>
                {steps.map((step) => {
                    const open = step.id === openId;
                    const subNumber = String(step.number).split('-').pop();
                    return (
                        <li
                            aria-current={step.state === 'now' ? 'step' : null}
                            className={styles.step}
                            data-state={step.state}
                            data-testid={tid('step', step.id)}
                            key={step.id}
                        >
                            <div aria-hidden="true" className={styles.rail}>
                                <span className={styles.marker}>{step.state === 'done' ? '✓' : subNumber}</span>
                                <span className={styles.line} />
                            </div>
                            <div className={styles.body}>
                                <button
                                    aria-expanded={open}
                                    className={styles.head}
                                    data-step-id={step.id}
                                    data-testid={tid('head', step.id)}
                                    type="button"
                                    onClick={handleHeadClick}
                                >
                                    <span className={styles.headTitle}>
                                        {step.number}
                                        {'　'}
                                        {step.title}
                                    </span>
                                    <span className={styles.state}>
                                        {intl.formatMessage(STATE_MESSAGES[step.state] || messages.todo)}
                                    </span>
                                </button>
                                {!open && step.summary && (
                                    <p className={styles.summary} data-testid={tid('summary', step.id)}>
                                        {step.summary}
                                    </p>
                                )}
                                {open && <div className={styles.content}>{step.content}</div>}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
};

InnerStepper.propTypes = {
    openStepId: PropTypes.string,
    steps: PropTypes.arrayOf(
        PropTypes.shape({
            content: PropTypes.node,
            id: PropTypes.string.isRequired,
            number: PropTypes.string.isRequired,
            state: PropTypes.oneOf(['done', 'now', 'todo']).isRequired,
            summary: PropTypes.node,
            title: PropTypes.node.isRequired,
        }),
    ).isRequired,
    testId: PropTypes.string,
    title: PropTypes.string.isRequired,
    onToggleStep: PropTypes.func,
};

export default InnerStepper;
