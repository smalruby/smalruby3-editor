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
        const { queryByTestId } = renderChoice({ continueOptions: null, showStarter: false });
        expect(queryByTestId('classroom-continue-choice')).not.toBeInTheDocument();
    });

    test('提出物が無くてもスターターがあれば、スターターと「いまの作品のまま」を選ばせる', () => {
        const onKeepCurrent = jest.fn();
        const { getByTestId, queryByTestId } = renderChoice({ continueOptions: null, onKeepCurrent });
        expect(getByTestId('classroom-continue-starter')).toBeInTheDocument();
        expect(getByTestId('classroom-continue-keep')).toBeInTheDocument();
        expect(queryByTestId('classroom-continue-previous')).not.toBeInTheDocument();
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

    test('「いまの作品のまま始める」は onKeepCurrent があるときだけ出し、押すと何も読み込まずに始める', () => {
        const onKeepCurrent = jest.fn();
        const onLoadSubmission = jest.fn();
        const { getByTestId } = renderChoice({ onKeepCurrent, onLoadSubmission });
        fireEvent.click(getByTestId('classroom-continue-keep'));
        expect(onKeepCurrent).toHaveBeenCalledTimes(1);
        expect(onLoadSubmission).not.toHaveBeenCalled();
    });

    test('ステータス画面 (onKeepCurrent なし) には「いまの作品のまま」を出さない', () => {
        const { queryByTestId } = renderChoice({ showStarter: false });
        expect(queryByTestId('classroom-continue-keep')).not.toBeInTheDocument();
    });

    test('スターターには何が開くかの説明を添える', () => {
        const { getByTestId } = renderChoice();
        expect(getByTestId('classroom-continue-starter')).toHaveTextContent('your teacher prepared');
    });
});

describe('StudentContinueChoice — 先生の設定のおすすめ (#1202)', () => {
    test('前回の提出物を「おすすめ」にし、理由を知らせる (自動では開かないので印は付けない)', () => {
        const { getByTestId, queryByTestId } = renderChoice({
            continueOptions: { previous, current: null },
            showStarter: false,
            recommend: 'previous',
            startNotice: 'recommendPrevious',
        });
        expect(getByTestId('classroom-continue-notice')).toHaveTextContent(
            "Your teacher recommends continuing from last time's submission.",
        );
        expect(getByTestId('classroom-continue-previous-recommended')).toHaveTextContent('Recommended');
        expect(getByTestId('classroom-continue-previous')).toHaveAttribute('aria-pressed', 'false');
        expect(queryByTestId('classroom-continue-starter')).not.toBeInTheDocument();
    });

    test('前回の提出物が無ければ、スターターを「おすすめ」にしてそのことを知らせる', () => {
        const { getByTestId } = renderChoice({
            continueOptions: null,
            recommend: 'starter',
            startNotice: 'noPrevious',
        });
        expect(getByTestId('classroom-continue-notice')).toHaveTextContent(
            'There was no submission from last time. Start from the starter.',
        );
        expect(getByTestId('classroom-continue-starter-recommended')).toBeInTheDocument();
    });

    test('スターターも無いときは、前回の提出物が無かったことだけを知らせる', () => {
        const { getByTestId, queryByTestId } = renderChoice({
            continueOptions: null,
            showStarter: false,
            startNotice: 'noPrevious',
        });
        expect(queryByTestId('classroom-continue-choice')).not.toBeInTheDocument();
        expect(getByTestId('classroom-continue-notice')).toHaveTextContent('There was no submission from last time.');
    });
});
