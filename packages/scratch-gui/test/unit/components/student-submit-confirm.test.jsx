/* eslint-env jest */
/**
 * 提出確認と「提出できました ✓」(#1795)。主ボタンは 1 つ（右）・「やめる」は小さなリンク（左）。
 * 提出済み・返却済みからは「もう一度提出します」の再提出の流れになる。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentSubmitConfirm from '../../../src/components/classroom-modal/student-submit-confirm.jsx';
import StudentSubmitDone from '../../../src/components/classroom-modal/student-submit-done.jsx';

const withIntl = (node) => render(<IntlProvider locale="en">{node}</IntlProvider>);

const props = (extra = {}) => ({
    onCancelSubmit: jest.fn(),
    onConfirmSubmit: jest.fn(),
    thumbnailDataUrl: 'data:image/png;base64,x',
    ...extra,
});

describe('StudentSubmitConfirm', () => {
    test('はじめての提出は「作品を提出します」と主ボタン「提出する」', () => {
        const p = props();
        const { getByTestId } = withIntl(<StudentSubmitConfirm {...p} />);
        expect(getByTestId('classroom-phase-submit-confirm')).toHaveTextContent('Submit your project');
        expect(getByTestId('classroom-submit-confirm')).toHaveTextContent('Submit');
        expect(getByTestId('classroom-submit-confirm')).not.toHaveTextContent('Submit again');
        fireEvent.click(getByTestId('classroom-submit-confirm'));
        expect(p.onConfirmSubmit).toHaveBeenCalledTimes(1);
    });

    test('再提出は「もう一度提出します」・置きかわる案内・主ボタン「もう一度提出する」', () => {
        const { getByTestId } = withIntl(<StudentSubmitConfirm {...props({ resubmit: true })} />);
        const phase = getByTestId('classroom-phase-submit-confirm');
        expect(phase).toHaveTextContent('Submit again');
        expect(phase).toHaveTextContent('replaced');
        expect(getByTestId('classroom-submit-confirm')).toHaveTextContent('Submit again');
    });

    test('返却済みの再提出では先生のコメントを出す', () => {
        const { getByTestId, queryByTestId, rerender } = withIntl(
            <StudentSubmitConfirm {...props({ resubmit: true, teacherComment: 'よくできました' })} />,
        );
        expect(getByTestId('classroom-submit-teacher-comment')).toHaveTextContent('よくできました');
        rerender(
            <IntlProvider locale="en">
                <StudentSubmitConfirm {...props()} />
            </IntlProvider>,
        );
        expect(queryByTestId('classroom-submit-teacher-comment')).toBeNull();
    });

    test('「やめる」は小さなリンクで、押すと onCancelSubmit', () => {
        const p = props();
        const { getByTestId } = withIntl(<StudentSubmitConfirm {...p} />);
        fireEvent.click(getByTestId('classroom-submit-cancel'));
        expect(p.onCancelSubmit).toHaveBeenCalledTimes(1);
    });

    test('送信中は主ボタンを押せない', () => {
        const { getByTestId } = withIntl(<StudentSubmitConfirm {...props({ isLoading: true })} />);
        expect(getByTestId('classroom-submit-confirm')).toBeDisabled();
        expect(getByTestId('classroom-submit-confirm')).toHaveTextContent('Submitting...');
    });
});

describe('StudentSubmitDone', () => {
    test('大きく「提出できました ✓」と主ボタン「つづける」。押すと onContinue', () => {
        const onContinue = jest.fn();
        const { getByTestId } = withIntl(<StudentSubmitDone onContinue={onContinue} />);
        expect(getByTestId('classroom-submit-done-title')).toHaveTextContent('submitted ✓');
        fireEvent.click(getByTestId('classroom-submit-done-continue'));
        expect(onContinue).toHaveBeenCalledTimes(1);
    });
});
