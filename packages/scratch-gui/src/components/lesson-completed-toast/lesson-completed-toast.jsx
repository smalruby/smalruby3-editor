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
    close: {
        id: 'gui.lessons.completed.close',
        defaultMessage: 'Close',
        description: 'Close the completed toast',
    },
});

/**
 * 「できた！」の表示。チャレンジの名前と、身についた「できること」を並べる。
 * @param {object} props - props。
 * @returns {React.ReactElement} toast。
 */
/**
 * できることの区切り。日本語は「・」、それ以外は ", "（空白だけの文言は ICU message で
 * 消えるので locale 文字列にはしない）。
 * @param {string} locale - intl の locale。
 * @returns {string} 区切り。
 */
const skillSeparator = (locale) => (String(locale).toLowerCase().startsWith('ja') ? '・' : ', ');

const LessonCompletedToast = ({ challenge, onClose, intl }) => {
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
    onClose: PropTypes.func.isRequired,
};

export { messages };
export default injectIntl(LessonCompletedToast);
