/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonCompletedQuiz from '../../../src/components/lesson-completed-toast/lesson-completed-quiz.jsx';
import { en, ja, jaHira } from '../../../src/lib/lessons/lessons.locale.js';

// ふりかえりのクイズ（#1639）。文言は message descriptor（テストは defaultMessage で出す）
const quiz = {
    question: { id: 'test.quiz.question', defaultMessage: 'Which one sends a message to everyone?' },
    choices: [
        { id: 'test.quiz.choice1', defaultMessage: 'say' },
        { id: 'test.quiz.choice2', defaultMessage: 'broadcast' },
        { id: 'test.quiz.choice3', defaultMessage: 'wait' },
    ],
    answer: 1,
    explanation: { id: 'test.quiz.explanation', defaultMessage: 'Broadcast reaches every sprite.' },
};

const renderQuiz = (props = {}, { locale = 'en', messages = en } = {}) =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonCompletedQuiz quiz={quiz} {...props} />
        </IntlProvider>,
    );

const choices = (getAllByTestId) => getAllByTestId('lesson-quiz-choice');

describe('LessonCompletedQuiz', () => {
    test('shows the question and the 3 choices, without the result before choosing', () => {
        const { getByTestId, getAllByTestId, queryByTestId } = renderQuiz();
        expect(getByTestId('lesson-quiz')).toBeInTheDocument();
        expect(getByTestId('lesson-quiz-label')).toHaveTextContent('Quick quiz');
        expect(getByTestId('lesson-quiz-question')).toHaveTextContent('Which one sends a message to everyone?');
        expect(choices(getAllByTestId).map((c) => c.textContent)).toEqual(['1say', '2broadcast', '3wait']);
        choices(getAllByTestId).forEach((c) => {
            expect(c).toHaveAttribute('aria-checked', 'false');
            expect(c).not.toHaveAttribute('data-result');
        });
        expect(queryByTestId('lesson-quiz-result')).not.toBeInTheDocument();
        expect(queryByTestId('lesson-quiz-explanation')).not.toBeInTheDocument();
    });

    test('choosing the answer says it is correct and shows the explanation', () => {
        const { getByTestId, getAllByTestId } = renderQuiz();
        fireEvent.click(choices(getAllByTestId)[1]);
        expect(choices(getAllByTestId)[1]).toHaveAttribute('aria-checked', 'true');
        expect(choices(getAllByTestId)[1]).toHaveAttribute('data-result', 'correct');
        expect(getByTestId('lesson-quiz-result')).toHaveAttribute('data-correct', 'true');
        expect(getByTestId('lesson-quiz-result')).toHaveTextContent('2: Correct!');
        expect(getByTestId('lesson-quiz-explanation')).toHaveTextContent('Broadcast reaches every sprite.');
    });

    test('choosing another one says it is wrong, shows the explanation, and can be chosen again', () => {
        const { getByTestId, getAllByTestId } = renderQuiz();
        fireEvent.click(choices(getAllByTestId)[0]);
        expect(choices(getAllByTestId)[0]).toHaveAttribute('data-result', 'wrong');
        expect(getByTestId('lesson-quiz-result')).toHaveAttribute('data-correct', 'false');
        expect(getByTestId('lesson-quiz-result')).toHaveTextContent('1: Not quite. Try another one.');
        expect(getByTestId('lesson-quiz-explanation')).toHaveTextContent('Broadcast reaches every sprite.');

        // 何度でも選び直せる（Q12）
        fireEvent.click(choices(getAllByTestId)[2]);
        expect(choices(getAllByTestId)[0]).toHaveAttribute('aria-checked', 'false');
        expect(choices(getAllByTestId)[0]).not.toHaveAttribute('data-result');
        expect(choices(getAllByTestId)[2]).toHaveAttribute('data-result', 'wrong');
        fireEvent.click(choices(getAllByTestId)[1]);
        expect(getByTestId('lesson-quiz-result')).toHaveAttribute('data-correct', 'true');
        // 正解のあとも選び直せる
        fireEvent.click(choices(getAllByTestId)[0]);
        expect(getByTestId('lesson-quiz-result')).toHaveAttribute('data-correct', 'false');
    });

    // スクリーンリーダー（FYI1）: 3 つから 1 つを選ぶ radiogroup。結果に選んだ番号を入れて、はずれを続けて
    // 選んでも字が変わって読み上げられるようにする。live region は toast（外側）の 1 つだけ
    test('is a radiogroup and every pick changes the result text, without its own live region', () => {
        const { getByTestId, getAllByTestId, container } = renderQuiz();
        expect(getByTestId('lesson-quiz')).toHaveAttribute('role', 'radiogroup');
        expect(getByTestId('lesson-quiz')).toHaveAttribute('aria-labelledby', getByTestId('lesson-quiz-question').id);
        choices(getAllByTestId).forEach((c) => expect(c).toHaveAttribute('role', 'radio'));
        fireEvent.click(choices(getAllByTestId)[0]);
        const first = getByTestId('lesson-quiz-result').textContent;
        fireEvent.click(choices(getAllByTestId)[2]);
        const second = getByTestId('lesson-quiz-result').textContent;
        expect(second).toBe('3: Not quite. Try another one.');
        expect(second).not.toBe(first);
        expect(container.querySelector('[role="status"], [aria-live]')).toBeNull();
    });

    test('the words of the quiz are in ja and ja-Hira (hiragana only)', () => {
        const kanji = renderQuiz({}, { locale: 'ja', messages: ja });
        expect(kanji.getByTestId('lesson-quiz-label')).toHaveTextContent('ふりかえりクイズ');
        fireEvent.click(kanji.getAllByTestId('lesson-quiz-choice')[1]);
        expect(kanji.getByTestId('lesson-quiz-result')).toHaveTextContent('2: 正解！');
        fireEvent.click(kanji.getAllByTestId('lesson-quiz-choice')[0]);
        expect(kanji.getByTestId('lesson-quiz-result')).toHaveTextContent('1: はずれ。もう一度選んでみよう');
        kanji.unmount();

        const hira = renderQuiz({}, { locale: 'ja-Hira', messages: jaHira });
        expect(hira.getByTestId('lesson-quiz-label')).toHaveTextContent('ふりかえりクイズ');
        fireEvent.click(hira.getAllByTestId('lesson-quiz-choice')[1]);
        expect(hira.getByTestId('lesson-quiz-result')).toHaveTextContent('2: せいかい！');
        fireEvent.click(hira.getAllByTestId('lesson-quiz-choice')[0]);
        expect(hira.getByTestId('lesson-quiz-result')).toHaveTextContent('1: はずれ。もういちど えらんでみよう');
    });

    test('the quiz words of the locale files: same keys, ja-Hira without kanji', () => {
        const keys = (messages) => Object.keys(messages).filter((id) => /^gui\.lessons\.completed\.quiz/.test(id));
        expect(keys(en).length).toBe(3);
        expect(keys(ja)).toEqual(keys(en));
        expect(keys(jaHira)).toEqual(keys(en));
        keys(jaHira).forEach((id) =>
            expect({ id, text: jaHira[id] }).toEqual({ id, text: expect.not.stringMatching(/\p{Script=Han}/u) }),
        );
    });
});
