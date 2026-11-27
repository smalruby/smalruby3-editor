/* eslint-env jest */
/**
 * 縦のステッパー（中の手順・#2454）。
 *
 * - 外の手順の中のもう一段の手順を、枠で囲んだ縦の番号つきで出す。
 * - いまの小手順だけ開き、終わった小手順は 1 行（まとめ）にたたむ。
 * - 見出しを押すと開く・閉じる。開いているのは 1 つだけ。
 * - 状態（済み・いまここ・まだ）は色だけでなく文字でも伝える。
 * - 小手順が済んで次へ移るときは、済んだ小手順を少し開いたまま見せてから閉じ、次の小手順を開く（#2521）。
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import InnerStepper, {
    STEP_CLOSE_MS,
    STEP_HOLD_MS,
    initialOpenStepId,
} from '../../../src/components/inner-stepper/inner-stepper.jsx';

const steps = [
    {
        id: 'describe',
        number: '2-1',
        title: '課題の説明',
        state: 'done',
        summary: '説明を保存した',
        content: <p>c1</p>,
    },
    { id: 'examples', number: '2-2', title: '代表の作品', state: 'now', content: <p>c2</p> },
    { id: 'fairness', number: '2-3', title: 'フェアの確認', state: 'todo', content: <p>c3</p> },
];

const renderStepper = (props = {}) =>
    render(
        <IntlProvider locale="en">
            <InnerStepper steps={steps} testId="stepper" title="手順 2 基準をつくる" {...props} />
        </IntlProvider>,
    );

describe('initialOpenStepId', () => {
    test('opens the current step', () => {
        expect(initialOpenStepId(steps)).toBe('examples');
    });

    test('opens the first step not done when there is no current step', () => {
        expect(
            initialOpenStepId([
                { id: 'a', state: 'done' },
                { id: 'b', state: 'todo' },
            ]),
        ).toBe('b');
    });

    test('opens nothing when every step is done', () => {
        expect(initialOpenStepId([{ id: 'a', state: 'done' }])).toBe(null);
    });
});

describe('InnerStepper', () => {
    test('shows the title and a numbered list of the steps', () => {
        renderStepper();
        expect(screen.getByTestId('stepper')).toHaveTextContent('手順 2 基準をつくる');
        const list = screen.getByRole('list');
        expect(list.querySelectorAll('li')).toHaveLength(3);
        expect(screen.getByTestId('stepper-step-describe')).toHaveTextContent('2-1');
        expect(screen.getByTestId('stepper-step-describe')).toHaveAttribute('data-state', 'done');
    });

    test('opens only the current step and folds a done step into its summary', () => {
        renderStepper();
        expect(screen.getByText('c2')).toBeInTheDocument();
        expect(screen.queryByText('c1')).not.toBeInTheDocument();
        expect(screen.queryByText('c3')).not.toBeInTheDocument();
        expect(screen.getByTestId('stepper-summary-describe')).toHaveTextContent('説明を保存した');
        expect(screen.getByTestId('stepper-step-examples')).toHaveAttribute('aria-current', 'step');
    });

    test('tells the state in words, not only in color', () => {
        renderStepper();
        expect(screen.getByTestId('stepper-head-describe')).toHaveTextContent('Done');
        expect(screen.getByTestId('stepper-head-examples')).toHaveTextContent('Now');
        expect(screen.getByTestId('stepper-head-fairness')).toHaveTextContent('Not yet');
    });

    test('opens another step when its head is pressed, and keeps one open', () => {
        renderStepper();
        const head = screen.getByTestId('stepper-head-describe');
        expect(head).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(head);
        expect(head).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('c1')).toBeInTheDocument();
        expect(screen.queryByText('c2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('stepper-summary-describe')).not.toBeInTheDocument();
    });

    test('closes the open step when its head is pressed again', () => {
        renderStepper();
        fireEvent.click(screen.getByTestId('stepper-head-examples'));
        expect(screen.queryByText('c2')).not.toBeInTheDocument();
    });

    const advanced = steps.map((step) => {
        if (step.id === 'examples') return { ...step, state: 'done', summary: '正解を付けた' };
        if (step.id === 'fairness') return { ...step, state: 'now' };
        return step;
    });
    const rerenderAdvanced = (rerender) =>
        rerender(
            <IntlProvider locale="en">
                <InnerStepper steps={advanced} testId="stepper" title="手順 2 基準をつくる" />
            </IntlProvider>,
        );

    describe('when the steps advance', () => {
        beforeEach(() => jest.useFakeTimers());
        afterEach(() => jest.useRealTimers());

        test('moves the open step to the new current step', () => {
            const { rerender } = renderStepper();
            fireEvent.click(screen.getByTestId('stepper-head-describe'));
            expect(screen.getByText('c1')).toBeInTheDocument();
            rerenderAdvanced(rerender);
            expect(screen.getByText('c3')).toBeInTheDocument();
            expect(screen.queryByText('c1')).not.toBeInTheDocument();
            expect(screen.getByTestId('stepper-summary-examples')).toHaveTextContent('正解を付けた');
        });

        test('keeps the step just done open for a moment, then closes it slowly and opens the next (#2521)', () => {
            const { rerender } = renderStepper();
            expect(screen.getByText('c2')).toBeInTheDocument();
            rerenderAdvanced(rerender);
            // The finished step stays open with its「済み」so the teacher sees what happened.
            expect(screen.getByText('c2')).toBeInTheDocument();
            expect(screen.getByTestId('stepper-head-examples')).toHaveTextContent('Done');
            expect(screen.queryByText('c3')).not.toBeInTheDocument();
            act(() => jest.advanceTimersByTime(STEP_HOLD_MS));
            // Then it closes (the closing motion), still before the next step opens.
            expect(screen.getByTestId('stepper-step-examples')).toHaveAttribute('data-closing', 'true');
            expect(screen.queryByText('c3')).not.toBeInTheDocument();
            act(() => jest.advanceTimersByTime(STEP_CLOSE_MS));
            expect(screen.queryByText('c2')).not.toBeInTheDocument();
            expect(screen.getByText('c3')).toBeInTheDocument();
            expect(screen.getByTestId('stepper-head-fairness')).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByTestId('stepper-summary-examples')).toHaveTextContent('正解を付けた');
        });

        test('a head pressed while waiting opens that step at once', () => {
            const { rerender } = renderStepper();
            rerenderAdvanced(rerender);
            fireEvent.click(screen.getByTestId('stepper-head-describe'));
            expect(screen.getByText('c1')).toBeInTheDocument();
            act(() => jest.advanceTimersByTime(STEP_HOLD_MS + STEP_CLOSE_MS));
            expect(screen.getByText('c1')).toBeInTheDocument();
            expect(screen.queryByText('c3')).not.toBeInTheDocument();
        });
    });

    test('keeps a step opened by its head while the current step stays the same', () => {
        const { rerender } = renderStepper();
        fireEvent.click(screen.getByTestId('stepper-head-describe'));
        rerender(
            <IntlProvider locale="en">
                <InnerStepper steps={[...steps]} testId="stepper" title="手順 2 基準をつくる" />
            </IntlProvider>,
        );
        expect(screen.getByText('c1')).toBeInTheDocument();
    });

    test('follows openStepId and reports a press when it is controlled', () => {
        const onToggleStep = jest.fn();
        renderStepper({ openStepId: 'fairness', onToggleStep });
        expect(screen.getByText('c3')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('stepper-head-describe'));
        expect(onToggleStep).toHaveBeenCalledWith('describe');
        // The parent decides: nothing changes until it passes a new openStepId.
        expect(screen.getByText('c3')).toBeInTheDocument();
    });
});
