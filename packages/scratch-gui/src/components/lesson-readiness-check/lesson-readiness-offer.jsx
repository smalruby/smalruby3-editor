// 「先にじゅんびチェックをする？」（#2299）。じゅんびチェックのあるコースのレッスン 1 の最初のチャレンジを、はじめて開いた
// ときに 1 回だけ聞く（いつ聞くかは lib/lessons/readiness.js の readinessOffer）。「じゅんびチェックをする」でチェックを開き、
// 「このまま始める」で閉じる（飛ばしてよい）。document.body への portal で出す。
import PropTypes from 'prop-types';
import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import styles from './lesson-readiness-offer.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessons.readiness.offerTitle',
        defaultMessage: 'Take the readiness check first?',
        description: 'Asked once when the student first opens lesson 1 of a course that has a readiness check',
    },
    detail: {
        id: 'gui.lessons.readiness.offerDetail',
        defaultMessage:
            'It checks what this course uses with {count} questions. If you miss one, it recommends a challenge.',
        description: 'Second line of the readiness check offer. {count} is the number of questions',
    },
    yes: {
        id: 'gui.lessons.readiness.offerYes',
        defaultMessage: 'Take the check',
        description: 'Button of the readiness check offer: opens the readiness check',
    },
    skip: {
        id: 'gui.lessons.readiness.offerSkip',
        defaultMessage: 'Start this challenge',
        description: 'Button of the readiness check offer: closes it and stays in the challenge',
    },
});

const LessonReadinessOffer = ({ count, onSkip, onYes }) => {
    const intl = useIntl();
    const titleId = useId();
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div className={styles.dialog} role="dialog" aria-labelledby={titleId} data-testid="lesson-readiness-offer">
            <div className={styles.title} id={titleId}>
                {intl.formatMessage(messages.title)}
            </div>
            <div className={styles.detail}>{intl.formatMessage(messages.detail, { count })}</div>
            <div className={styles.actions}>
                <button type="button" className={styles.yes} onClick={onYes} data-testid="lesson-readiness-offer-yes">
                    {intl.formatMessage(messages.yes)}
                </button>
                <button
                    type="button"
                    className={styles.skip}
                    onClick={onSkip}
                    data-testid="lesson-readiness-offer-skip"
                >
                    {intl.formatMessage(messages.skip)}
                </button>
            </div>
        </div>,
        document.body,
    );
};

LessonReadinessOffer.propTypes = {
    // じゅんびチェックの問いの数
    count: PropTypes.number.isRequired,
    // 「このまま始める」（閉じる）
    onSkip: PropTypes.func.isRequired,
    // 「じゅんびチェックをする」
    onYes: PropTypes.func.isRequired,
};

export { messages };
export default LessonReadinessOffer;
