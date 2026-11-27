/**
 * 縦のステッパー（中の手順・#2454・EPIC #2438 の F1）。
 *
 * 外の手順（横の帯）の中にもう一段の手順があるときの形。外は横・中は縦、番号は「2」と「2-1」で
 * 段の違いを見せる。中の手順を太い枠で囲み、縦の番号つきで並べる。
 * いまの小手順だけ開き、終わった小手順は 1 行（まとめ）にたたむので、授業 PC の 600px の高さにも収まる。
 * 見出しを押すとその小手順を開く（開いているのはいつも 1 つまで）。
 * 開いていた小手順が済んで次へ移るときは、すぐ閉じずに「済み」を見せる間を置き、ゆっくり閉じてから
 * 次の小手順を開く（#2521。何が起きたかを先生が見て取れるように）。
 *
 * 決まりは docs/design-system/components/inner-stepper.md。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

/** 済んだ小手順を開いたまま見せる間（ms・#2521）。0.6〜1 秒で、済みの印が目に入る長さ。 */
export const STEP_HOLD_MS = 800;
/** 閉じる動きの長さ（ms・#2521）。inner-stepper.css の閉じる動きと同じ長さにする。 */
export const STEP_CLOSE_MS = 300;

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
    const autoOpenId = initialOpenStepId(steps);
    const [ownOpenId, setOwnOpenId] = useState(autoOpenId);
    const [closingId, setClosingId] = useState(null);
    const openRef = useRef(ownOpenId);
    openRef.current = ownOpenId;
    const stepsRef = useRef(steps);
    stepsRef.current = steps;
    const lastAutoRef = useRef(autoOpenId);
    const timersRef = useRef([]);
    const frameRef = useRef(null);
    const scrollToRef = useRef(null);
    const clearTimers = useCallback(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        setClosingId(null);
    }, []);
    useEffect(() => () => timersRef.current.forEach(clearTimeout), []);
    // 使う側が小手順の状態を進めたら（2-2 が済んで 2-3 がいまここ）、開く小手順もいまの小手順へ移す。
    // 見出しで開いた小手順は、いまの小手順が変わるまではそのまま残す。
    // 開いていた小手順が済んだときは、済みを見せる間を置いてから閉じ、次を開く（#2521）。
    useEffect(() => {
        const finished = lastAutoRef.current;
        lastAutoRef.current = autoOpenId;
        if (finished === autoOpenId) return;
        clearTimers();
        // Wait only when the open step really became done: not when the steps go back, nor when
        // the user of the stepper decides the open step (openStepId).
        const wasDone = stepsRef.current.some((s) => s.id === finished && s.state === 'done');
        if (controlled || !wasDone || openRef.current !== finished) {
            setOwnOpenId(autoOpenId);
            return;
        }
        timersRef.current = [
            setTimeout(() => setClosingId(finished), STEP_HOLD_MS),
            setTimeout(() => {
                setClosingId(null);
                scrollToRef.current = autoOpenId;
                setOwnOpenId(autoOpenId);
            }, STEP_HOLD_MS + STEP_CLOSE_MS),
        ];
    }, [autoOpenId, clearTimers, controlled]);
    // The step opened by moving on may be below the fold of the pane: bring its head into view.
    useEffect(() => {
        const id = scrollToRef.current;
        scrollToRef.current = null;
        if (!id || id !== ownOpenId || !frameRef.current) return;
        const head = frameRef.current.querySelector(`[data-step-id="${id}"]`);
        if (!head || !head.scrollIntoView) return;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        head.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }, [ownOpenId]);
    const openId = controlled ? openStepId : ownOpenId;
    const tid = (part, id) => testId && `${testId}-${part}-${id}`;

    const handleHeadClick = useCallback(
        (event) => {
            const id = event.currentTarget.dataset.stepId;
            if (onToggleStep) onToggleStep(id);
            if (!controlled) {
                // A press wins over the wait to move on.
                clearTimers();
                setOwnOpenId((current) => (current === id ? null : id));
            }
        },
        [clearTimers, controlled, onToggleStep],
    );

    return (
        <section aria-label={title} className={styles.frame} data-testid={testId} ref={frameRef}>
            <h3 className={styles.title}>{title}</h3>
            <ol className={styles.list}>
                {steps.map((step) => {
                    const open = step.id === openId;
                    const subNumber = String(step.number).split('-').pop();
                    return (
                        <li
                            aria-current={step.state === 'now' ? 'step' : null}
                            className={styles.step}
                            data-closing={step.id === closingId ? 'true' : null}
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
