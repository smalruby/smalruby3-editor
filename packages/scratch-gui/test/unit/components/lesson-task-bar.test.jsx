/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonTaskBar from '../../../src/components/lesson-task-bar/lesson-task-bar.jsx';
import { findChallenge } from '../../../src/lib/lessons/courses';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';

// defaultMessage は ja なので、英語の表示は en の messages を渡して確かめる
const renderBar = (props = {}, { locale = 'en', messages = en } = {}) => {
    const { challenge, lesson } = findChallenge(props.challengeId || 'blocks-l1-click-say');
    const onHint = jest.fn();
    const onQuit = jest.fn();
    const utils = render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonTaskBar
                challenge={challenge}
                challengeCount={lesson.challenges.length}
                hintAvailable
                onHint={onHint}
                onQuit={onQuit}
                {...props}
            />
        </IntlProvider>,
    );
    return { ...utils, onHint, onQuit };
};

describe('LessonTaskBar', () => {
    test('shows the task line and "n of N"', () => {
        const { getByTestId } = renderBar();
        expect(getByTestId('lesson-task-bar')).toBeInTheDocument();
        expect(getByTestId('lesson-task-bar-position')).toHaveTextContent('3 of 11');
        expect(getByTestId('lesson-task-bar-task')).toHaveTextContent(
            'Add a costume you like to the cat, and make it say "Hello!" and change its look when it is clicked',
        );
    });

    test('falls back to the challenge name when there is no task line yet', () => {
        const { getByTestId } = renderBar({ challengeId: 'blocks-l1-broadcast' });
        expect(getByTestId('lesson-task-bar-position')).toHaveTextContent('9 of 11');
        expect(getByTestId('lesson-task-bar-task')).toHaveTextContent('Signal a friend');
    });

    test('uses the Japanese strings', () => {
        const { getByTestId } = renderBar({}, { locale: 'ja', messages: ja });
        expect(getByTestId('lesson-task-bar-position')).toHaveTextContent('3 / 全部で 11');
        expect(getByTestId('lesson-task-bar-quit')).toHaveTextContent('やめる');
        expect(getByTestId('lesson-task-bar-hint')).toHaveTextContent('ヒント');
    });

    test('quit button calls onQuit', () => {
        const { getByTestId, onQuit } = renderBar();
        fireEvent.click(getByTestId('lesson-task-bar-quit'));
        expect(onQuit).toHaveBeenCalledTimes(1);
    });

    test('hint button calls onHint', () => {
        const { getByTestId, onHint } = renderBar();
        fireEvent.click(getByTestId('lesson-task-bar-hint'));
        expect(onHint).toHaveBeenCalledTimes(1);
    });

    test('hint button is disabled when the challenge has no hints', () => {
        const { getByTestId } = renderBar({ hintAvailable: false });
        expect(getByTestId('lesson-task-bar-hint')).toBeDisabled();
    });
});
