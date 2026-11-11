import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import intlShape from '../../lib/intlShape.js';
import styles from './lesson-completed-toast.css';

const messages = defineMessages({
    title: {
        id: 'gui.lessons.completed.title',
        defaultMessage: 'You did it!',
        description: 'Title of the toast shown when a lesson challenge is completed',
    },
    skills: {
        id: 'gui.lessons.completed.skills',
        defaultMessage: 'Now you can: {skills}',
        description: 'Line listing the skills learned by the completed challenge',
    },
    next: {
        id: 'gui.lessons.completed.next',
        defaultMessage: 'Next challenge',
        description: 'Button on the completed toast that opens the lessons library at the current lesson',
    },
    lastInLesson: {
        id: 'gui.lessons.completed.lastInLesson',
        defaultMessage: 'That was the last challenge of this lesson.',
        description: 'Shown on the completed toast when the challenge is the last one of its lesson',
    },
    otherLessons: {
        id: 'gui.lessons.completed.otherLessons',
        defaultMessage: 'Go to other lessons',
        description: 'Button on the completed toast of the last challenge of a lesson; opens the lessons library',
    },
    close: {
        id: 'gui.lessons.completed.close',
        defaultMessage: 'Close',
        description: 'Close the completed toast',
    },
});

/**
 * できることの区切り。日本語は「・」、それ以外は ", "（空白だけの文言は ICU message で
 * 消えるので locale 文字列にはしない）。
 * @param {string} locale - intl の locale。
 * @returns {string} 区切り。
 */
const skillSeparator = (locale) => (String(locale).toLowerCase().startsWith('ja') ? '・' : ', ');

/**
 * 「できた！」の表示。チャレンジの名前と、身についた「できること」と、「次のチャレンジ」
 * （レッスンの最後なら「ほかのレッスンへ」）を並べる。
 * @param {object} props - props。
 * @param {object} props.challenge - できたチャレンジ。
 * @param {boolean} props.isLastChallenge - レッスンの最後のチャレンジか。
 * @param {Function} props.onClose - 閉じる。
 * @param {Function} props.onNextChallenge - 「次のチャレンジ」（レッスン表を開く）。
 * @param {object} props.intl - react-intl。
 * @returns {React.ReactElement} toast。
 */
const LessonCompletedToast = ({ challenge, isLastChallenge, onClose, onNextChallenge, intl }) => {
    const skills = (challenge.skills || []).map((skill) => intl.formatMessage(skill.name));
    return (
        <div className={styles.toast} role="status" data-testid="lesson-completed-toast">
            <span className={styles.icon} aria-hidden="true">
                {'🎉'}
            </span>
            <div className={styles.body}>
                <div className={styles.title}>
                    <span data-testid="lesson-completed-toast-title">{intl.formatMessage(messages.title)}</span>
                    <span className={styles.challengeName} data-testid="lesson-completed-toast-challenge">
                        {intl.formatMessage(challenge.name)}
                    </span>
                </div>
                {skills.length > 0 ? (
                    <div className={styles.skills} data-testid="lesson-completed-toast-skills">
                        {intl.formatMessage(messages.skills, {
                            skills: skills.join(skillSeparator(intl.locale)),
                        })}
                    </div>
                ) : null}
                {isLastChallenge ? (
                    <div className={styles.lastInLesson} data-testid="lesson-completed-toast-last">
                        {intl.formatMessage(messages.lastInLesson)}
                    </div>
                ) : null}
                {onNextChallenge ? (
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.next}
                            onClick={onNextChallenge}
                            data-testid="lesson-completed-toast-next"
                            data-last={isLastChallenge ? 'true' : 'false'}
                        >
                            {intl.formatMessage(isLastChallenge ? messages.otherLessons : messages.next)}
                        </button>
                    </div>
                ) : null}
            </div>
            <button
                className={styles.close}
                onClick={onClose}
                aria-label={intl.formatMessage(messages.close)}
                data-testid="lesson-completed-toast-close"
            >
                {'×'}
            </button>
        </div>
    );
};

LessonCompletedToast.propTypes = {
    challenge: PropTypes.shape({
        name: PropTypes.object.isRequired,
        skills: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.object })),
    }).isRequired,
    intl: intlShape.isRequired,
    // レッスンの最後のチャレンジか（並び順で最後）。文言を「ほかのレッスンへ」にする
    isLastChallenge: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    // 「次のチャレンジ」。レッスン表をいまのレッスンで開く。無ければボタンを出さない
    onNextChallenge: PropTypes.func,
};

export { messages };
export default injectIntl(LessonCompletedToast);
