/* eslint-env jest */
/**
 * 「AI に相談」の囲み（#2454）。
 *
 * - 紫の囲みに「ここで AI がすること」を 1 文で書き、AI は押したときだけ動く、と添える。
 * - ボタンには「AI」の印を付ける。
 * - 一度実行したボタン（used）は押せない。動いている間（running）も押せない。
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import AskAi, { AskAiButton } from '../../../src/components/ask-ai/ask-ai.jsx';

const renderAskAi = (props = {}) => {
    const onClick = jest.fn();
    render(
        <IntlProvider locale="en">
            <AskAi
                buttonLabel="AI に代表の案を出してもらう"
                description="代表の作品に S/A/B/C の案と理由を付けます。"
                testId="ask"
                onClick={onClick}
                {...props}
            />
        </IntlProvider>,
    );
    return onClick;
};

describe('AskAi', () => {
    test('says what the AI does here and that it runs only when pressed', () => {
        renderAskAi();
        const box = screen.getByTestId('ask');
        expect(box).toHaveTextContent('What the AI does here:');
        expect(box).toHaveTextContent('代表の作品に S/A/B/C の案と理由を付けます。');
        expect(box).toHaveTextContent('The AI runs only when you press the button.');
    });

    test('marks the button with "AI" and runs it on a press', () => {
        const onClick = renderAskAi();
        const button = screen.getByTestId('ask-button');
        expect(button).toHaveTextContent('AI');
        expect(button).toHaveTextContent('AI に代表の案を出してもらう');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('cannot be pressed again once it has run', () => {
        const onClick = renderAskAi({ used: true });
        const button = screen.getByTestId('ask-button');
        expect(button).toBeDisabled();
        expect(screen.getByTestId('ask')).toHaveTextContent('The AI has already run here.');
        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    test('cannot be pressed while it runs, and says so', () => {
        renderAskAi({ running: true });
        const button = screen.getByTestId('ask-button');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toHaveTextContent('The AI is working…');
    });

    test('can be turned off by the screen (disabled)', () => {
        renderAskAi({ disabled: true });
        expect(screen.getByTestId('ask-button')).toBeDisabled();
    });

    test('shows extra content below the button', () => {
        renderAskAi({ children: <p>AI の案の中身</p> });
        expect(screen.getByTestId('ask')).toHaveTextContent('AI の案の中身');
    });
});

describe('AskAiButton', () => {
    test('can be used alone with the AI mark', () => {
        render(
            <AskAiButton testId="solo" onClick={() => {}}>
                AI に書いてもらう
            </AskAiButton>,
        );
        expect(screen.getByTestId('solo')).toHaveTextContent('AI');
        expect(screen.getByTestId('solo')).toHaveTextContent('AI に書いてもらう');
    });
});
