/**
 * The tabs inside a class: ［ストリーム］［授業］［採点］ (#1956 Q3), with
 * ［⚙ クラスの設定］ at the right end of the row.
 *
 * The board (stream / classwork) and the grading screen are different phases,
 * but they show the same row so the teacher moves between them like tabs.
 * Which tab is selected and what a tab does is decided by the screen that
 * draws the row (the grading screen asks before leaving, #1948).
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import ClassroomTab from './classroom-tab.jsx';

export const classTabMessages = defineMessages({
    stream: {
        defaultMessage: 'Stream',
        description: 'Tab of a class: the stream (announcements), like Google Classroom',
        id: 'gui.classroom.board.tabStream',
    },
    classwork: {
        defaultMessage: 'Classwork',
        description: 'Tab of a class: the assignment list, like Google Classroom',
        id: 'gui.classroom.board.tabClasswork',
    },
    grading: {
        defaultMessage: 'Grading',
        description: 'Tab of a class: the grading screen (grade book), like Google Classroom',
        id: 'gui.classroom.board.tabGrading',
    },
    settings: {
        defaultMessage: 'Class settings',
        description: 'Button at the right of the class tabs that opens the class settings',
        id: 'gui.classroom.board.classSettings',
    },
});

const TAB_ORDER = ['stream', 'classwork', 'grading'];

const TeacherClassTabs = ({ selected, onOpenSettings, onSelect }) => {
    const handleClick = useCallback(
        (event) => {
            const tab = event.currentTarget.dataset.tab;
            if (tab !== selected) onSelect(tab);
        },
        [selected, onSelect],
    );
    return (
        <div className={styles.tabList} data-testid="classroom-class-tabs" role="tablist">
            {TAB_ORDER.map((tab) => (
                <ClassroomTab
                    key={tab}
                    dataTab={tab}
                    dataTestId={`classroom-board-tab-${tab}`}
                    selected={selected === tab}
                    onClick={handleClick}
                >
                    <FormattedMessage {...classTabMessages[tab]} />
                </ClassroomTab>
            ))}
            {onOpenSettings ? (
                <span className={styles.tabListEnd}>
                    <ClassroomButton
                        dataTestId="classroom-board-class-settings"
                        variant="text"
                        onClick={onOpenSettings}
                    >
                        <span aria-hidden="true">{'⚙'}</span>
                        <FormattedMessage {...classTabMessages.settings} />
                    </ClassroomButton>
                </span>
            ) : null}
        </div>
    );
};

TeacherClassTabs.propTypes = {
    selected: PropTypes.oneOf(TAB_ORDER).isRequired,
    /** ［⚙ クラスの設定］。渡さなければ出さない（採点のタブ）。 */
    onOpenSettings: PropTypes.func,
    /** 選んだタブ（`'stream'` / `'classwork'` / `'grading'`）で呼ぶ。 */
    onSelect: PropTypes.func.isRequired,
};

export default TeacherClassTabs;
