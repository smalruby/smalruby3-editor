/* eslint-env jest */
/**
 * レッスンの数の欄（#1765 M1）: 打っている途中の値は範囲に直さず、blur / Enter のときだけ確定する。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import LessonNumberInput from '../../../src/components/classroom-modal/lesson-number-input.jsx';

const setup = (value = 11) => {
    const onCommit = jest.fn();
    const utils = render(
        <LessonNumberInput ariaLabel="n" max={11} min={2} testId="num" value={value} onCommit={onCommit} />,
    );
    return { ...utils, input: utils.getByTestId('num'), onCommit };
};

describe('LessonNumberInput', () => {
    test('「1」→「10」と打つ途中は確定せず、blur で「10」を確定する', () => {
        const { input, onCommit } = setup();
        fireEvent.change(input, { target: { value: '1' } });
        expect(input).toHaveValue(1);
        fireEvent.change(input, { target: { value: '10' } });
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith('10');
    });

    test('消してから打ち直せる（Enter で確定）', () => {
        const { input, onCommit } = setup(100);
        fireEvent.change(input, { target: { value: '' } });
        expect(input).toHaveValue(null);
        fireEvent.change(input, { target: { value: '50' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledWith('50');
    });

    test('確定したあとは渡された値を出す（範囲に直した値）', () => {
        const { input, onCommit, rerender } = setup(70);
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith('');
        rerender(<LessonNumberInput testId="num" value={70} onCommit={onCommit} />);
        expect(input).toHaveValue(70);
    });

    test('名前（aria-label）が付く', () => {
        const { input } = setup();
        expect(input).toHaveAccessibleName('n');
    });
});
