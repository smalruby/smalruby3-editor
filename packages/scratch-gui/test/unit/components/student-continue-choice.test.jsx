/* eslint-env jest */
/**
 * 「どこから始める？」の選択肢 (#1201)。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentContinueChoice from '../../../src/components/classroom-modal/student-continue-choice.jsx';

const previous = {
    classroomId: 'c-prev',
    assignmentName: '第1回 ねこを動かそう',
    projectName: '先週',
    submittedAt: '2026-10-01T10:00:00.000Z',
    projectUrl: 'https://signed.example/prev.sb3',
};
const current = {
    ...previous,
    classroomId: 'c-now',
    assignmentName: '第2回',
    projectUrl: 'https://signed.example/now.sb3',
};

const renderChoice = (props) =>
    render(
        <IntlProvider locale="en">
            <StudentContinueChoice
                continueOptions={{ previous, current }}
                showStarter
                onLoadStarter={jest.fn()}
                onLoadSubmission={jest.fn()}
                {...props}
            />
        </IntlProvider>,
    );

describe('StudentContinueChoice', () => {
    test('スターター・前回・この課題の 3 つを出し、前回には課題名を添える', () => {
        const { getByTestId } = renderChoice();
        expect(getByTestId('classroom-continue-starter')).toBeInTheDocument();
        expect(getByTestId('classroom-continue-previous')).toHaveTextContent('第1回 ねこを動かそう');
        expect(getByTestId('classroom-continue-current')).toBeInTheDocument();
    });

    test('無いものは出さない', () => {
        const { queryByTestId } = renderChoice({ continueOptions: { previous, current: null }, showStarter: false });
        expect(queryByTestId('classroom-continue-starter')).not.toBeInTheDocument();
        expect(queryByTestId('classroom-continue-current')).not.toBeInTheDocument();
        expect(queryByTestId('classroom-continue-previous')).toBeInTheDocument();
    });

    test('選択肢が無ければ何も描かない', () => {
        const { queryByTestId } = renderChoice({ continueOptions: null });
        expect(queryByTestId('classroom-continue-choice')).not.toBeInTheDocument();
    });

    test('押すと種類を渡して読み込む', () => {
        const onLoadSubmission = jest.fn();
        const onLoadStarter = jest.fn();
        const { getByTestId } = renderChoice({ onLoadSubmission, onLoadStarter });
        fireEvent.click(getByTestId('classroom-continue-previous'));
        fireEvent.click(getByTestId('classroom-continue-current'));
        fireEvent.click(getByTestId('classroom-continue-starter'));
        expect(onLoadSubmission.mock.calls).toEqual([['previous'], ['current']]);
        expect(onLoadStarter).toHaveBeenCalledTimes(1);
    });

    test('読み込んだものに印を付け、読み込み中は押せない', () => {
        const { getByTestId } = renderChoice({ loadedChoice: 'previous', isLoading: true });
        expect(getByTestId('classroom-continue-previous')).toHaveAttribute('aria-pressed', 'true');
        expect(getByTestId('classroom-continue-current')).toHaveAttribute('aria-pressed', 'false');
        expect(getByTestId('classroom-continue-current')).toBeDisabled();
    });
});
