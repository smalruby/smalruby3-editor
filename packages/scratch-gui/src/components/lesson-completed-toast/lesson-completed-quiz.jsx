import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useId, useState } from 'react';
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
    wrongOneTry: {
        id: 'gui.lessons.completed.quizWrongOneTry',
        defaultMessage: 'Not quite. The right answer is {number}.',
        description:
            'Shown when the student chose a wrong answer of a one-try question (the readiness check): the ' +
            'right choice is marked and cannot be chosen again. {number} is the number of the right choice',
    },
});

/**
 * ふりかえりのクイズ（#1639）。「できた！」の表示の中に出す 3 択。選ぶと正解／はずれと解説を出し、
 * 何度でも選び直せる。「できた」の判定には関係しない（選んだものは記録しない）。
 * 選んだものは、この部品の中だけに持つ（別のチャレンジの「できた！」では key で作り直す）。
 * 読み上げ: 3 つから 1 つを選ぶので radiogroup / radio。結果の読み上げは toast（外側の role="status"）に
 * 任せ、ここには live region を置かない（入れ子にしない）。はずれを続けて選んでも字が変わるように、
 * 結果の文の前に選んだ番号を付ける（「3: はずれ…」）。
 * `oneTry` のとき（じゅんびチェック・#2299）は、1 回めに選んだものだけで決める: 選んだら選びなおせず、まちがえたら
 * その場で正しい選択肢に ○ を付け、「はずれ。正しい答えは n」と解説を出す。選んだものは親が持つ（`selected` /
 * `onChoose`。記録に入れるため）。
 * @param {object} props - props。
 * @param {object} props.quiz - チャレンジの `quiz`（courses.js の `challengeQuiz`）。
 * @param {object} props.intl - react-intl。
 * @param {boolean} [props.oneTry] - 1 回めに選んだものだけで決めるか。
 * @param {?string} [props.label] - 上の小さな見出し（無ければ「ふりかえりクイズ」）。
 * @param {?number} [props.selected] - 選んだ選択肢（親が持つとき。持たなければこの部品の中に持つ）。
 * @param {?Function} [props.onChoose] - 選んだ（選択肢の番号を渡す）。
 * @param {?React.ReactNode} [props.action] - 答えたあと、結果の行の右に出すもの（じゅんびチェックの「次の問いへ」）。
 * @returns {React.ReactElement} クイズ。
 */
const LessonCompletedQuiz = ({
    quiz,
    intl,
    oneTry = false,
    label = null,
    selected: controlled,
    onChoose = null,
    action = null,
}) => {
    const [own, setOwn] = useState(null);
    const isControlled = typeof controlled !== 'undefined';
    const selected = isControlled ? controlled : own;
    const answered = selected !== null && typeof selected !== 'undefined';
    const locked = oneTry && answered;
    const handleChoose = useCallback(
        (event) => {
            if (locked) return;
            const index = Number(event.currentTarget.dataset.index);
            if (!isControlled) setOwn(index);
            if (onChoose) onChoose(index);
        },
        [isControlled, locked, onChoose],
    );
    const correct = answered && selected === quiz.answer;
    const questionId = useId();
    return (
        <div className={styles.quiz} role="radiogroup" aria-labelledby={questionId} data-testid="lesson-quiz">
            <div className={styles.label} data-testid="lesson-quiz-label">
                {label || intl.formatMessage(messages.label)}
            </div>
            <div className={styles.question} id={questionId} data-testid="lesson-quiz-question">
                {intl.formatMessage(quiz.question)}
            </div>
            <div className={styles.choices}>
                {quiz.choices.map((choice, index) => {
                    const isSelected = selected === index;
                    let result;
                    if (isSelected) result = correct ? 'correct' : 'wrong';
                    // 1 回だけのときは、まちがえたら正しい選択肢も見せる
                    else if (locked && index === quiz.answer) result = 'correct';
                    return (
                        <button
                            key={choice.id}
                            type="button"
                            className={classNames(styles.choice, {
                                [styles.choiceCorrect]: result === 'correct',
                                [styles.choiceWrong]: result === 'wrong',
                            })}
                            role="radio"
                            aria-checked={isSelected ? 'true' : 'false'}
                            aria-disabled={locked ? 'true' : 'false'}
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
                <div className={styles.feedback}>
                    <div className={styles.resultRow}>
                        <div
                            className={classNames(styles.result, correct ? styles.resultCorrect : styles.resultWrong)}
                            data-testid="lesson-quiz-result"
                            data-correct={correct ? 'true' : 'false'}
                        >
                            {`${selected + 1}: ${
                                correct
                                    ? intl.formatMessage(messages.correct)
                                    : oneTry
                                      ? intl.formatMessage(messages.wrongOneTry, { number: quiz.answer + 1 })
                                      : intl.formatMessage(messages.wrong)
                            }`}
                        </div>
                        {action}
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
    action: PropTypes.node,
    intl: intlShape.isRequired,
    label: PropTypes.string,
    onChoose: PropTypes.func,
    oneTry: PropTypes.bool,
    selected: PropTypes.number,
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
