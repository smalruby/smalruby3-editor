// レッスンモードでエディタの上に出す課題バー（1 行）。
// 「何個め / 全部で何個」・課題の 1 行・ヒント・やめる。見た目の高さは 40px に収め、
// 1300×600 の授業のパソコンでコードエリアを圧迫しない。
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import styles from './lesson-task-bar.css';

const messages = defineMessages({
    ariaLabel: {
        id: 'gui.lessonTaskBar.ariaLabel',
        description: 'Accessible name of the bar that shows the current lesson task',
        defaultMessage: 'Lesson task',
    },
    position: {
        id: 'gui.lessonTaskBar.position',
        description: 'Which challenge this is out of how many in the lesson',
        defaultMessage: '{number} of {count}',
    },
    hint: {
        id: 'gui.lessonTaskBar.hint',
        description: 'Button that shows a hint for the current challenge',
        defaultMessage: 'Hint',
    },
    quit: {
        id: 'gui.lessonTaskBar.quit',
        description: 'Button that leaves lesson mode',
        defaultMessage: 'Quit',
    },
});

const LessonTaskBar = ({ challenge, challengeCount, hintAvailable, onHint, onQuit }) => {
    const intl = useIntl();
    // 課題の 1 行が無いチャレンジ（中身がまだのもの）は名前を出す
    const task = intl.formatMessage(challenge.task || challenge.name);
    return (
        <div className={styles.bar} data-testid="lesson-task-bar" role="region" aria-label={intl.formatMessage(messages.ariaLabel)}>
            <span className={styles.position} data-testid="lesson-task-bar-position">
                {intl.formatMessage(messages.position, { number: challenge.number, count: challengeCount })}
            </span>
            <span className={styles.task} data-testid="lesson-task-bar-task" title={task}>
                {task}
            </span>
            <button
                type="button"
                className={styles.button}
                data-testid="lesson-task-bar-hint"
                disabled={!hintAvailable}
                onClick={onHint}
            >
                {intl.formatMessage(messages.hint)}
            </button>
            <button type="button" className={styles.button} data-testid="lesson-task-bar-quit" onClick={onQuit}>
                {intl.formatMessage(messages.quit)}
            </button>
        </div>
    );
};

LessonTaskBar.propTypes = {
    // courses.js の defineChallenge が返す形（number / name / task）
    challenge: PropTypes.shape({
        number: PropTypes.number.isRequired,
        name: PropTypes.object.isRequired,
        task: PropTypes.object,
    }).isRequired,
    challengeCount: PropTypes.number.isRequired,
    hintAvailable: PropTypes.bool,
    onHint: PropTypes.func.isRequired,
    onQuit: PropTypes.func.isRequired,
};

export default LessonTaskBar;
