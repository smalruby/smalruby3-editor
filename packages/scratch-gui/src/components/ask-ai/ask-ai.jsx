/**
 * 「AI に相談」の囲みとボタン（#2454・EPIC #2438 の F3）。
 *
 * AI は費用の都合で、先生がボタンを押したときだけ動かす。なぜそこに AI のボタンがあるのかが分かるよう、
 * 紫の囲みの中に「ここで AI がすること」を 1 文で書き、押したときだけ動くと添える。
 * ボタンには「AI」の印を付ける。一度実行したボタン（used）はもう押せない（費用・二重の呼び出しを防ぐ）。
 *
 * 「AI に相談といえばこの見た目」として、どの画面でもこの部品を使う
 * （決まりは docs/design-system/components/ask-ai.md）。
 */
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import styles from './ask-ai.css';

const messages = defineMessages({
    lead: {
        defaultMessage: 'What the AI does here:',
        description: 'Lead before the one sentence telling what the AI does in this place (ask-AI block)',
        id: 'gui.askAi.lead',
    },
    onlyWhenPressed: {
        defaultMessage: 'The AI runs only when you press the button.',
        description: 'Note in the ask-AI block: the AI does not run by itself (it costs money)',
        id: 'gui.askAi.onlyWhenPressed',
    },
    used: {
        defaultMessage: 'The AI has already run here.',
        description: 'Note in the ask-AI block after its button has been used once (it cannot be pressed again)',
        id: 'gui.askAi.used',
    },
    running: {
        defaultMessage: 'The AI is working…',
        description: 'Label of the ask-AI button while the AI is running',
        id: 'gui.askAi.running',
    },
});

/**
 * 「AI」の印つきのボタン。囲みの外で単独で使うこともできる。
 * @param {object} props - component props
 * @param {React.ReactNode} props.children - ボタンの文字（「AI に説明の案を書いてもらう」など）
 * @param {boolean} [props.disabled] - 押せない
 * @param {boolean} [props.busy] - AI が動いている（読み上げに伝える）
 * @param {string} [props.testId] - data-testid
 * @param {Function} props.onClick - 押したとき
 * @returns {React.ReactElement} the button
 */
export const AskAiButton = ({ busy = false, children, disabled = false, testId, onClick }) => (
    <button
        aria-busy={busy}
        className={styles.button}
        data-testid={testId}
        disabled={disabled}
        type="button"
        onClick={onClick}
    >
        <span aria-hidden="true" className={styles.mark}>
            {'AI'}
        </span>
        <span>{children}</span>
    </button>
);

AskAiButton.propTypes = {
    busy: PropTypes.bool,
    children: PropTypes.node,
    disabled: PropTypes.bool,
    testId: PropTypes.string,
    onClick: PropTypes.func.isRequired,
};

/**
 * 「AI に相談」の囲み。ボタンは囲みの中の上のほうに置く（先生がまず AI を押したくなる場所・F3）。
 * @param {object} props - component props
 * @param {string} props.description - ここで AI がすること（1 文）
 * @param {React.ReactNode} props.buttonLabel - ボタンの文字
 * @param {boolean} [props.used] - 一度実行した（もう押せない）
 * @param {boolean} [props.running] - AI が動いている
 * @param {boolean} [props.disabled] - 画面の都合で押せない（材料がそろっていないなど）
 * @param {React.ReactNode} [props.children] - ボタンの下に出すもの（AI の結果など）
 * @param {string} [props.testId] - data-testid（ボタンは `<testId>-button`）
 * @param {Function} props.onClick - ボタンを押したとき
 * @returns {React.ReactElement} the block
 */
const AskAi = ({
    buttonLabel,
    children,
    description,
    disabled = false,
    running = false,
    testId,
    used = false,
    onClick,
}) => {
    const intl = useIntl();
    return (
        <div className={styles.box} data-testid={testId}>
            <p className={styles.description}>
                <span className={styles.lead}>{intl.formatMessage(messages.lead)}</span> {description}
            </p>
            <p className={styles.note}>{intl.formatMessage(used ? messages.used : messages.onlyWhenPressed)}</p>
            <AskAiButton
                busy={running}
                disabled={disabled || running || used}
                testId={testId && `${testId}-button`}
                onClick={onClick}
            >
                {running ? intl.formatMessage(messages.running) : buttonLabel}
            </AskAiButton>
            {children}
        </div>
    );
};

AskAi.propTypes = {
    buttonLabel: PropTypes.node.isRequired,
    children: PropTypes.node,
    description: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    running: PropTypes.bool,
    testId: PropTypes.string,
    used: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
};

export default AskAi;
