// The note on 1-based indexes under the ✔ of a DNCL answer (#1420).
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import GenaiAnswerSteps from '../../../src/components/genai-concierge/genai-answer-steps.jsx';

const okResult = (indexHints) => ({
    ok: true,
    code: 'Data = [3, 1, 2]\n',
    parts: [{ name: 'Abby', code: 'Data = [3, 1, 2]\n', changes: [], lines: { added: 1, changed: 0, removed: 0 } }],
    fixes: [],
    problems: [],
    indexHints,
});

const renderSteps = (result) => {
    const adapter = {
        check: jest.fn(() => Promise.resolve(result)),
        apply: jest.fn(),
        switchSides: jest.fn(),
        watchMarks: jest.fn(() => () => {}),
        takeoverState: jest.fn(() => ({})),
        takeoverMessage: jest.fn(() => ''),
        mountDiff: jest.fn(() => () => {}),
        puts: 'code',
        language: 'dncl',
    };
    const noop = () => {};
    render(
        <IntlProvider locale="en">
            <GenaiAnswerSteps
                vm={{}}
                adapter={adapter}
                step="paste"
                open
                onStep={noop}
                onCopy={noop}
                onShowBlocks={noop}
                onClearNotice={noop}
                onClose={noop}
                onFinish={noop}
                onReset={noop}
            />
        </IntlProvider>,
    );
};

const convert = async () => {
    fireEvent.change(screen.getByTestId('genai-answer'), { target: { value: 'answer' } });
    await act(async () => {
        fireEvent.click(screen.getByTestId('genai-convert'));
        await new Promise((resolve) => setTimeout(resolve, 100));
    });
};

describe('GenaiAnswerSteps index hints', () => {
    test('a ✔ answer with 1-based indexes stays ✔ and shows the note on its line', async () => {
        renderSteps(okResult([{ line: 4, access: 'Data[i]', array: 'Data', last: 2, fixed: 'Data[i - 1]' }]));
        await convert();
        expect(screen.getByTestId('genai-convert-ok')).toBeInTheDocument();
        const hints = screen.getByTestId('genai-index-hints');
        expect(hints).toHaveTextContent('the indexes may start at 1');
        expect(hints).toHaveTextContent('Line 4: Data[i] reads past the end of the array');
        expect(hints).toHaveTextContent('Data[i - 1]');
        expect(screen.getByTestId('genai-apply')).toBeInTheDocument();
    });

    test('no note without hints', async () => {
        renderSteps(okResult([]));
        await convert();
        expect(screen.getByTestId('genai-convert-ok')).toBeInTheDocument();
        expect(screen.queryByTestId('genai-index-hints')).toBeNull();
    });
});
