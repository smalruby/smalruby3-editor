/* eslint-env jest */
/**
 * 生徒の画面の部品 (#1792): 主ボタン・小さな文字のリンク・進む順の帯。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentMainButton from '../../../src/components/classroom-modal/student-main-button.jsx';
import StudentStepBand from '../../../src/components/classroom-modal/student-step-band.jsx';
import StudentTextLink from '../../../src/components/classroom-modal/student-text-link.jsx';

const withIntl = (node) => render(<IntlProvider locale="en">{node}</IntlProvider>);

describe('StudentMainButton', () => {
    test('文字と説明の小さい字を出し、押すと onClick', () => {
        const onClick = jest.fn();
        const { getByTestId } = withIntl(
            <StudentMainButton dataTestId="x-main" note="10/25 に出したもの" onClick={onClick}>
                前回の作品から続ける
            </StudentMainButton>,
        );
        expect(getByTestId('x-main')).toHaveTextContent('前回の作品から続ける');
        expect(getByTestId('x-main-note')).toHaveTextContent('10/25 に出したもの');
        fireEvent.click(getByTestId('x-main'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('説明が無ければ説明の行を出さない', () => {
        const { queryByTestId } = withIntl(
            <StudentMainButton dataTestId="x-main" onClick={jest.fn()}>
                つづける
            </StudentMainButton>,
        );
        expect(queryByTestId('x-main-note')).toBeNull();
    });

    test('disabled なら押せない', () => {
        const onClick = jest.fn();
        const { getByTestId } = withIntl(
            <StudentMainButton disabled dataTestId="x-main" onClick={onClick}>
                次へ
            </StudentMainButton>,
        );
        expect(getByTestId('x-main')).toBeDisabled();
        fireEvent.click(getByTestId('x-main'));
        expect(onClick).not.toHaveBeenCalled();
    });
});

describe('StudentTextLink', () => {
    test('ボタンとして描き、押すと onClick', () => {
        const onClick = jest.fn();
        const { getByTestId } = withIntl(
            <StudentTextLink dataTestId="x-link" onClick={onClick}>
                ほかの始め方
            </StudentTextLink>,
        );
        expect(getByTestId('x-link').tagName).toBe('BUTTON');
        expect(getByTestId('x-link')).toHaveAttribute('type', 'button');
        fireEvent.click(getByTestId('x-link'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});

describe('StudentStepBand', () => {
    test('5 つの段を順に出し、状態を data-state に持つ', () => {
        const { getByTestId } = withIntl(<StudentStepBand phase="student-joined" />);
        const band = getByTestId('classroom-step-band');
        expect(band).toHaveAttribute('data-complete', 'false');
        expect(getByTestId('classroom-step-band-join')).toHaveAttribute('data-state', 'done');
        expect(getByTestId('classroom-step-band-seat')).toHaveAttribute('data-state', 'done');
        expect(getByTestId('classroom-step-band-start')).toHaveAttribute('data-state', 'now');
        expect(getByTestId('classroom-step-band-make')).toHaveAttribute('data-state', 'todo');
        expect(getByTestId('classroom-step-band-submit')).toHaveAttribute('data-state', 'todo');
        expect(band).toHaveTextContent('① Join');
        expect(band).toHaveTextContent('⑤ Submit');
    });

    test('いまの段に aria-current="step"', () => {
        const { getByTestId } = withIntl(<StudentStepBand phase="student-seat" />);
        expect(getByTestId('classroom-step-band-seat')).toHaveAttribute('aria-current', 'step');
        expect(getByTestId('classroom-step-band-join')).not.toHaveAttribute('aria-current');
    });

    test('提出済みは全部すんだ、⑤ に ✓', () => {
        const { getByTestId } = withIntl(<StudentStepBand phase="student-status" submissionStatus="submitted" />);
        expect(getByTestId('classroom-step-band')).toHaveAttribute('data-complete', 'true');
        expect(getByTestId('classroom-step-band-submit')).toHaveAttribute('data-state', 'done');
        expect(getByTestId('classroom-step-band-submit')).toHaveTextContent('✓');
        expect(getByTestId('classroom-step-band-make')).not.toHaveTextContent('✓');
    });

    test('札は押せない (ボタンでない)', () => {
        const { getByTestId } = withIntl(<StudentStepBand phase="student-join" />);
        expect(getByTestId('classroom-step-band').querySelector('button')).toBeNull();
    });

    test('生徒の画面でなければ何も出さない', () => {
        const { queryByTestId } = withIntl(<StudentStepBand phase="teacher-login" />);
        expect(queryByTestId('classroom-step-band')).toBeNull();
    });
});
