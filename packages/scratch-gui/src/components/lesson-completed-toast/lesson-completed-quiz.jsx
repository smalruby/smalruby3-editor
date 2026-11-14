import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import intlShape from '../../lib/intlShape.js';
import styles from './lesson-completed-quiz.css';

const messages = defineMessages({
    label: {
        id: 'gui.lessons.completed.quizLabel',
        defaultMessage: 'Quick quiz',
        description: 'Small heading above the 3-choice reflection quiz in the "You did it!" toast',
    },
    correct: {
        id: 'gui.lessons.completed.quizCorrect',
        defaultMessage: 'Correct!',
        description: 'Shown when the student chose the right answer of the reflection quiz',
    },
    wrong: {
        id: 'gui.lessons.completed.quizWrong',
        defaultMessage: 'Not quite. Try another one.',
        description: 'Shown when the student chose a wrong answer of the reflection quiz; they can choose again',
    },
});

/**
 * ふりかえりのクイズ（#1639）。「できた！」の表示の中に出す 3 択。選ぶと正解／はずれと解説を出し、
 * 何度でも選び直せる。「できた」の判定には関係しない（選んだものは記録しない）。
 * 選んだものは、この部品の中だけに持つ（別のチャレンジの「できた！」では key で作り直す）。
 * @param {object} props - props。
 * @param {object} props.quiz - チャレンジの `quiz`（courses.js の `challengeQuiz`）。
 * @param {object} props.intl - react-intl。
 * @returns {React.ReactElement} クイズ。
 */
const LessonCompletedQuiz = ({ quiz, intl }) => {
    const [selected, setSelected] = useState(null);
    const handleChoose = useCallback((event) => setSelected(Number(event.currentTarget.dataset.index)), []);
    const answered = selected !== null;
    const correct = answered && selected === quiz.answer;
    return (
        <div className={styles.quiz} data-testid="lesson-quiz">
            <div className={styles.label} data-testid="lesson-quiz-label">
                {intl.formatMessage(messages.label)}
            </div>
            <div className={styles.question} data-testid="lesson-quiz-question">
                {intl.formatMessage(quiz.question)}
            </div>
            <div className={styles.choices}>
                {quiz.choices.map((choice, index) => {
                    const isSelected = selected === index;
                    let result;
                    if (isSelected) result = correct ? 'correct' : 'wrong';
                    return (
                        <button
                            key={choice.id}
                            type="button"
                            className={classNames(styles.choice, {
                                [styles.choiceCorrect]: result === 'correct',
                                [styles.choiceWrong]: result === 'wrong',
                            })}
                            aria-pressed={isSelected ? 'true' : 'false'}
                            onClick={handleChoose}
                            data-testid="lesson-quiz-choice"
                            data-index={index}
                            data-result={result}
                        >
                            <span className={styles.mark} aria-hidden="true">
                                {result === 'correct' ? '○' : result === 'wrong' ? '×' : index + 1}
                            </span>
                            <span className={styles.choiceText}>{intl.formatMessage(choice)}</span>
                        </button>
                    );
                })}
            </div>
            {answered && (
                <div className={styles.feedback} role="status">
                    <div
                        className={classNames(styles.result, correct ? styles.resultCorrect : styles.resultWrong)}
                        data-testid="lesson-quiz-result"
                        data-correct={correct ? 'true' : 'false'}
                    >
                        {intl.formatMessage(correct ? messages.correct : messages.wrong)}
                    </div>
                    <div className={styles.explanation} data-testid="lesson-quiz-explanation">
                        {intl.formatMessage(quiz.explanation)}
                    </div>
                </div>
            )}
        </div>
    );
};

const messageShape = PropTypes.shape({ id: PropTypes.string.isRequired });

LessonCompletedQuiz.propTypes = {
    intl: intlShape.isRequired,
    quiz: PropTypes.shape({
        question: messageShape.isRequired,
        choices: PropTypes.arrayOf(messageShape).isRequired,
        // 正解の choices の何番目か（0 から）
        answer: PropTypes.number.isRequired,
        explanation: messageShape.isRequired,
    }).isRequired,
};

export { messages };
export default injectIntl(LessonCompletedQuiz);
