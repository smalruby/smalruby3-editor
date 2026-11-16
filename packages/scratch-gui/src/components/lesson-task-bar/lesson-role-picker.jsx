// ペアでやるチャレンジの役を選ぶボタン（課題バーの中・#2062）。「シマラビの役」「シマネコの役」の 2 つを並べ、
// いまの役を白地で出す。役をどう決めたかを、選びなおすまでボタンの下に小さく出す（「前回はシマネコの役」
// 「出席番号で決めた役」）。チャレンジを順番にやらない生徒も、なぜその役が選ばれているかがわかるように。
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ROLE_SOURCES } from '../../lib/lessons/lesson-role';
import { ROLES } from '../../lib/lessons/role-swap';
import styles from './lesson-task-bar.css';

const messages = defineMessages({
    label: {
        id: 'gui.lessonTaskBar.role',
        description: 'Accessible name of the buttons that choose your role in a pair challenge of the chat course',
        defaultMessage: 'Your role',
    },
    shimaraby: {
        id: 'gui.lessonTaskBar.roleShimaraby',
        description:
            'Button that chooses the role of Shimaraby in a pair challenge (the hints use the names as they are)',
        defaultMessage: 'Shimaraby',
    },
    shimacat: {
        id: 'gui.lessonTaskBar.roleShimacat',
        description:
            'Button that chooses the role of Shimacat in a pair challenge (the hints and the answer swap ' +
            'Shimaraby and Shimacat)',
        defaultMessage: 'Shimacat',
    },
    remembered: {
        id: 'gui.lessonTaskBar.roleRemembered',
        description: 'Note next to the role buttons: the role was preselected from the last pair challenge',
        defaultMessage: 'Last time: {role}',
    },
    seat: {
        id: 'gui.lessonTaskBar.roleSeat',
        description:
            'Note next to the role buttons: in a class, the role was decided by the seat numbers of the pair ' +
            '(the smaller number plays Shimaraby)',
        defaultMessage: 'Decided by seat number',
    },
});

const ROLE_MESSAGES = { [ROLES.SHIMARABY]: messages.shimaraby, [ROLES.SHIMACAT]: messages.shimacat };

const LessonRolePicker = ({ role, source, onChoose }) => {
    const intl = useIntl();
    const handleClick = useCallback(
        (e) => {
            const value = e.currentTarget.dataset.role;
            if (value !== role) onChoose(value);
        },
        [onChoose, role],
    );
    let note = null;
    if (source === ROLE_SOURCES.REMEMBERED) {
        note = intl.formatMessage(messages.remembered, { role: intl.formatMessage(ROLE_MESSAGES[role]) });
    } else if (source === ROLE_SOURCES.SEAT) {
        note = intl.formatMessage(messages.seat);
    }
    return (
        <span className={styles.role} data-testid="lesson-task-bar-role">
            <span
                className={styles.roleButtons}
                role="group"
                aria-label={intl.formatMessage(messages.label)}
                // ヒントの「役を決めよう」の吹き出しが指す（lib/lessons/hint-targets.js の ROLE_PICKER）
                data-testid="lesson-task-bar-role-buttons"
            >
                {[ROLES.SHIMARABY, ROLES.SHIMACAT].map((value) => (
                    <button
                        key={value}
                        type="button"
                        className={value === role ? styles.roleButtonActive : styles.roleButton}
                        data-testid={`lesson-task-bar-role-${value}`}
                        data-role={value}
                        aria-pressed={value === role}
                        onClick={handleClick}
                    >
                        {intl.formatMessage(ROLE_MESSAGES[value])}
                    </button>
                ))}
            </span>
            {note && (
                <span className={styles.roleNote} data-testid="lesson-task-bar-role-note">
                    {note}
                </span>
            )}
        </span>
    );
};

LessonRolePicker.propTypes = {
    // いまの役（lib/lessons/role-swap.js の ROLES）
    role: PropTypes.oneOf([ROLES.SHIMARABY, ROLES.SHIMACAT]).isRequired,
    // どう決めたか（lib/lessons/lesson-role.js の ROLE_SOURCES）
    source: PropTypes.string,
    // 役を選びなおした（いまとちがう役を押したときだけ）
    onChoose: PropTypes.func.isRequired,
};

export default LessonRolePicker;
