/* eslint-env jest */
/**
 * 参加したあとの始め方 (#1793): 主ボタンは決めた始め方 1 つ。ほかは「ほかの始め方」にしまう。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentStartMethod from '../../../src/components/classroom-modal/student-start-method.jsx';

const PREVIOUS = {
    assignmentName: 'ねこの迷路（第 1 回）',
    submittedAt: '2026-10-25T05:00:00.000Z',
    projectUrl: 'https://signed.example/prev.sb3',
};
const CURRENT = { submittedAt: '2026-10-26T05:00:00.000Z', projectUrl: 'https://signed.example/cur.sb3' };

const handlers = () => ({
    onKeepCurrent: jest.fn(),
    onLoadStarter: jest.fn(),
    onLoadSubmission: jest.fn(),
    onStartLesson: jest.fn(),
});

const renderMethod = (props) =>
    render(
        <IntlProvider locale="en">
            <StudentStartMethod {...props} />
        </IntlProvider>,
    );

describe('StudentStartMethod', () => {
    test('主ボタンは決めた始め方 1 つで、2 行目に何を開くかを書く', () => {
        const h = handlers();
        const { getByTestId, getAllByRole } = renderMethod({
            ...h,
            continueOptions: { previous: PREVIOUS, current: null },
            method: { main: 'previous', others: ['starter', 'keep'], notice: null },
        });
        expect(getByTestId('classroom-start-main')).toHaveTextContent("Continue from last time's work");
        expect(getByTestId('classroom-start-main-note')).toHaveTextContent('ねこの迷路（第 1 回）');
        // ほかの始め方はしまってある（主ボタンと並ぶボタンは出さない）
        expect(getAllByRole('button').map((b) => b.dataset.testid)).toEqual([
            'classroom-start-main',
            'classroom-start-others-toggle',
        ]);
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(h.onLoadSubmission).toHaveBeenCalledWith('previous');
    });

    test('「ほかの始め方」を押すと残りの始め方を小さなリンクで並べ、押すとその作品で始める', () => {
        const h = handlers();
        const { getByTestId, queryByTestId } = renderMethod({
            ...h,
            continueOptions: { previous: PREVIOUS, current: CURRENT },
            method: { main: 'current', others: ['previous', 'starter', 'keep'], notice: null },
        });
        expect(queryByTestId('classroom-start-others')).not.toBeInTheDocument();
        const toggle = getByTestId('classroom-start-others-toggle');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(getByTestId('classroom-start-other-previous'));
        expect(h.onLoadSubmission).toHaveBeenCalledWith('previous');
        fireEvent.click(getByTestId('classroom-start-other-starter'));
        expect(h.onLoadStarter).toHaveBeenCalledTimes(1);
        fireEvent.click(getByTestId('classroom-start-other-keep'));
        expect(h.onKeepCurrent).toHaveBeenCalledTimes(1);
    });

    test('主ボタンが「はじめる」でほかに無ければ、「ほかの始め方」は出さない', () => {
        const h = handlers();
        const { getByTestId, queryByTestId } = renderMethod({
            ...h,
            method: { main: 'keep', others: [], notice: null },
        });
        expect(getByTestId('classroom-start-main')).toHaveTextContent('Start');
        expect(getByTestId('classroom-start-main-note')).toBeInTheDocument();
        expect(queryByTestId('classroom-start-others-toggle')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(h.onKeepCurrent).toHaveBeenCalledTimes(1);
    });

    test('スターターが主ボタンなら押すとスターターを開く', () => {
        const h = handlers();
        const { getByTestId } = renderMethod({ ...h, method: { main: 'starter', others: ['keep'], notice: null } });
        expect(getByTestId('classroom-start-main')).toHaveTextContent('Start from the starter');
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(h.onLoadStarter).toHaveBeenCalledTimes(1);
    });

    test('レッスンの課題は「はじめる」でレッスン表を開く', () => {
        const h = handlers();
        const { getByTestId } = renderMethod({ ...h, method: { main: 'lesson', others: [], notice: null } });
        expect(getByTestId('classroom-start-method')).toHaveAttribute('data-main', 'lesson');
        fireEvent.click(getByTestId('classroom-start-main'));
        expect(h.onStartLesson).toHaveBeenCalledTimes(1);
        expect(h.onKeepCurrent).not.toHaveBeenCalled();
    });

    test('先生の設定のお知らせを 1 行で出す', () => {
        const { getByTestId, queryByTestId, rerender } = renderMethod({
            ...handlers(),
            continueOptions: { previous: PREVIOUS, current: null },
            method: { main: 'previous', others: ['keep'], notice: 'recommendPrevious' },
        });
        expect(getByTestId('classroom-start-notice')).toHaveTextContent('Your teacher recommends');
        rerender(
            <IntlProvider locale="en">
                <StudentStartMethod {...handlers()} method={{ main: 'keep', others: [], notice: null }} />
            </IntlProvider>,
        );
        expect(queryByTestId('classroom-start-notice')).not.toBeInTheDocument();
    });

    test('先生の設定が ON でこの課題に提出済みなら、前回からも始められることを 1 行で知らせる', () => {
        const { getByTestId } = renderMethod({
            ...handlers(),
            continueOptions: { previous: PREVIOUS, current: CURRENT },
            method: { main: 'current', others: ['previous', 'keep'], notice: 'previousAlsoAvailable' },
        });
        expect(getByTestId('classroom-start-notice')).toHaveTextContent("also start from last time's work");
        expect(getByTestId('classroom-start-main')).toHaveTextContent('Continue from what you submitted');
    });

    test('「ほかの始め方」は aria-controls で一覧を指し、矢印は読み上げない', () => {
        const { getByTestId } = renderMethod({
            ...handlers(),
            method: { main: 'starter', others: ['keep'], notice: null },
        });
        const toggle = getByTestId('classroom-start-others-toggle');
        fireEvent.click(toggle);
        expect(getByTestId('classroom-start-others').id).toBe(toggle.getAttribute('aria-controls'));
        expect(toggle.querySelector('[aria-hidden="true"]')).toHaveTextContent('▴');
    });

    test('読み込み中は押せない', () => {
        const { getByTestId } = renderMethod({
            ...handlers(),
            isLoading: true,
            method: { main: 'starter', others: ['keep'], notice: null },
        });
        expect(getByTestId('classroom-start-main')).toBeDisabled();
        expect(getByTestId('classroom-start-others-toggle')).toBeDisabled();
    });
});
