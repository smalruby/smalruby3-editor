import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import intlShape from '../../lib/intlShape.js';
import { COMPLETED_ACTIONS } from '../../lib/lessons/lesson-progress.js';
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
        defaultMessage: 'You have done every challenge of this lesson.',
        description: 'Shown on the completed toast when every challenge of the lesson is done',
    },
    otherLessons: {
        id: 'gui.lessons.completed.otherLessons',
        defaultMessage: 'Go to other lessons',
        description:
            'Button on the completed toast when every challenge of the lesson is done and the course has a next ' +
            'lesson; opens the lessons library at the next lesson',
    },
    library: {
        id: 'gui.lessons.completed.library',
        defaultMessage: 'Go to the lessons',
        description:
            'Button on the completed toast when every challenge of the lesson is done and there is no next ' +
            'lesson; opens the lessons library',
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

// ボタンの文言（COMPLETED_ACTIONS ごと）
const BUTTON_MESSAGES = {
    [COMPLETED_ACTIONS.NEXT]: messages.next,
    [COMPLETED_ACTIONS.OTHER_LESSONS]: messages.otherLessons,
    [COMPLETED_ACTIONS.LIBRARY]: messages.library,
};

/**
 * 「できた！」の表示。チャレンジの名前と、身についた「できること」と、「次のチャレンジ」
 * （レッスンのチャレンジが全部できたら「ほかのレッスンへ」か「レッスン表へ」）を並べる。
 * @param {object} props - props。
 * @param {object} props.challenge - できたチャレンジ。
 * @param {string} props.action - ボタンの種類（lesson-progress.js の COMPLETED_ACTIONS）。
 * @param {Function} props.onClose - 閉じる。
 * @param {Function} props.onNextChallenge - 「次のチャレンジ」（レッスン表を開く）。
 * @param {object} props.intl - react-intl。
 * @returns {React.ReactElement} toast。
 */
const LessonCompletedToast = ({ action = COMPLETED_ACTIONS.NEXT, challenge, onClose, onNextChallenge, intl }) => {
    const lessonDone = action !== COMPLETED_ACTIONS.NEXT;
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
                {lessonDone ? (
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
                            data-action={action}
                        >
                            {intl.formatMessage(BUTTON_MESSAGES[action])}
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
    // ボタンの種類。next =「次のチャレンジ」、otherLessons / library はレッスンのチャレンジが全部できたとき
    // （「これでおわり」の行も出す）。決め方は lesson-progress.js の completedAction
    action: PropTypes.oneOf(Object.values(COMPLETED_ACTIONS)),
    challenge: PropTypes.shape({
        name: PropTypes.object.isRequired,
        skills: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.object })),
    }).isRequired,
    intl: intlShape.isRequired,
    onClose: PropTypes.func.isRequired,
    // 「次のチャレンジ」。レッスン表をいまのレッスンで開く。無ければボタンを出さない
    onNextChallenge: PropTypes.func,
};

export { messages };
export default injectIntl(LessonCompletedToast);
