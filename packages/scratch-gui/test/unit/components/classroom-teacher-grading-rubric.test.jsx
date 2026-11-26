/* eslint-env jest */
/**
 * 課題の採点の［基準］のタブ (EPIC #2421 / #2425)。
 *
 * - 説明が空で AI の案があると「合っていますか？」と 3 つのボタンを出す。
 * - 代表の作品は一覧で、押した行だけ開く（アコーディオン）。
 * - 基準がある課題は基準を見せ、基準づくりを飛ばせる。
 * - ほかの課題から基準をコピー: クラスと課題を選び、中身を見てからコピーする。
 * - 1 件を直したあとの「同じまとまりも直すか」の問い。
 * - 正解の例が無い段には「正解の例が無い（AI の推測）」、S の例が無ければ注意の文。
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherGradingRubric, {
    TeacherGradingGroupPrompt,
} from '../../../src/components/classroom-modal/teacher-grading-rubric.jsx';

const lesson = { classroomId: 'a1', assignmentName: '04_モーター', assignmentText: '' };

const makeTools = (overrides = {}) => ({
    answers: {},
    copyClasses: [{ key: 'g2', label: '技術 2026年度', assignments: [{ classroomId: 'b1', assignmentName: '04' }] }],
    description: null,
    examples: [],
    fairness: null,
    groups: [{ name: 'サーボだけ' }, { name: 'モーターだけ' }],
    levels: ['S', 'A', 'B', 'C'].map((grade) => ({ grade, text: '' })),
    loaded: true,
    proposals: { 1: { grade: 'A', reason: 'r' } },
    representatives: [
        { key: 'k1', name: 'サーボだけ', seatNumber: 1, size: 3, code: 'サーボを 90 度に曲げる' },
        { key: 'k2', name: 'モーターだけ', seatNumber: 4, size: 1, code: 'モーターで進む' },
    ],
    running: null,
    savedAt: null,
    savedRubric: null,
    starter: { status: 'ready' },
    works: [{ seatNumber: 1 }, { seatNumber: 2 }, { seatNumber: 3 }, { seatNumber: 4 }],
    loadStarter: jest.fn(),
    handleDescribe: jest.fn(),
    handleUseDescription: jest.fn(),
    handleSetAnswer: jest.fn(),
    handlePropose: jest.fn(),
    handleCheckFairness: jest.fn(),
    handleAnswerFairness: jest.fn(),
    handleDraftRubric: jest.fn(),
    handleSetLevel: jest.fn(),
    handleSaveRubric: jest.fn(() => Promise.resolve(true)),
    handleReadCopySource: jest.fn(),
    handleCopyRubric: jest.fn(() => Promise.resolve(true)),
    ...overrides,
});

const renderTab = (tools) =>
    render(
        <IntlProvider locale="en" messages={{}}>
            <TeacherGradingRubric lesson={lesson} tools={tools} onOpenWork={jest.fn()} />
        </IntlProvider>,
    );

describe('TeacherGradingRubric (#2425)', () => {
    test('説明の案に「合っていますか？」と 3 つの答え', () => {
        const tools = makeTools({ description: { status: 'proposed', text: 'サーボを動かす' } });
        renderTab(tools);
        expect(tools.loadStarter).toHaveBeenCalled();
        expect(screen.getByTestId('grading-rubric-describe-text')).toHaveValue('サーボを動かす');
        fireEvent.click(screen.getByTestId('grading-rubric-describe-ok'));
        expect(tools.handleUseDescription).toHaveBeenCalledWith('サーボを動かす', true);
        // 直していなければ［直して保存］は押せない
        expect(screen.getByTestId('grading-rubric-describe-fix')).toBeDisabled();
        fireEvent.change(screen.getByTestId('grading-rubric-describe-text'), { target: { value: 'LED' } });
        fireEvent.click(screen.getByTestId('grading-rubric-describe-fix'));
        expect(tools.handleUseDescription).toHaveBeenLastCalledWith('LED', true);
        fireEvent.click(screen.getByTestId('grading-rubric-describe-only-here'));
        expect(tools.handleUseDescription).toHaveBeenLastCalledWith('LED', false);
    });

    test('代表は押した行だけ開き、正解を付けられる', () => {
        const tools = makeTools();
        renderTab(tools);
        expect(screen.queryByTestId('grading-rubric-rep-body-1')).toBeNull();
        fireEvent.click(screen.getByTestId('grading-rubric-rep-1'));
        expect(screen.getByTestId('grading-rubric-rep-body-1')).toHaveTextContent('サーボを 90 度に曲げる');
        fireEvent.click(screen.getByTestId('grading-rubric-rep-4'));
        expect(screen.queryByTestId('grading-rubric-rep-body-1')).toBeNull();
        expect(screen.getByTestId('grading-rubric-rep-body-4')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('grading-rubric-rep-grade-4-B'));
        expect(tools.handleSetAnswer).toHaveBeenCalledWith(4, { grade: 'B' });
    });

    test('選んだ答えは aria-pressed でも分かる（代表の正解・フェアの確認）', () => {
        const tools = makeTools({
            answers: { 4: { grade: 'B', reason: '' } },
            fairness: {
                checks: [{ question: '2 番は B ですか？', options: ['B のまま', 'A にする'], seatNumbers: [2] }],
                answers: { 0: 'A にする' },
            },
        });
        renderTab(tools);
        fireEvent.click(screen.getByTestId('grading-rubric-rep-4'));
        expect(screen.getByTestId('grading-rubric-rep-grade-4-B')).toHaveAttribute('aria-pressed', 'true');
        for (const g of ['S', 'A', 'C']) {
            expect(screen.getByTestId(`grading-rubric-rep-grade-4-${g}`)).toHaveAttribute('aria-pressed', 'false');
        }
        expect(screen.getByTestId('grading-rubric-check-0-option-0')).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByTestId('grading-rubric-check-0-option-1')).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByTestId('grading-rubric-check-0-option-0'));
        expect(tools.handleAnswerFairness).toHaveBeenCalledWith(0, 'B のまま');
    });

    test('基準がある課題は基準を見せ、つくり直しは選んだときだけ', () => {
        const tools = makeTools({ savedRubric: { levels: [{ grade: 'B', text: 'サーボ' }], examples: [] } });
        renderTab(tools);
        expect(screen.getByTestId('grading-rubric-saved')).toHaveTextContent('サーボ');
        expect(screen.queryByTestId('grading-rubric-reps')).toBeNull();
        fireEvent.click(screen.getByTestId('grading-rubric-edit'));
        expect(screen.getByTestId('grading-rubric-reps')).toBeInTheDocument();
    });

    test('ほかの課題から基準をコピー: 選んで中身を見てからコピーする', async () => {
        const source = { levels: [{ grade: 'S', text: '両方' }], examples: [{ seatNumber: 1 }] };
        const tools = makeTools({ handleReadCopySource: jest.fn(() => Promise.resolve(source)) });
        renderTab(tools);
        fireEvent.click(screen.getByTestId('grading-rubric-copy'));
        expect(screen.getByTestId('grading-rubric-copy-do')).toBeDisabled();
        fireEvent.change(screen.getByTestId('grading-rubric-copy-class'), { target: { value: 'g2' } });
        await act(async () => {
            fireEvent.change(screen.getByTestId('grading-rubric-copy-assignment'), { target: { value: 'b1' } });
        });
        expect(tools.handleReadCopySource).toHaveBeenCalledWith('b1');
        expect(screen.getByTestId('grading-rubric-copy-preview')).toHaveTextContent('両方');
        await act(async () => {
            fireEvent.click(screen.getByTestId('grading-rubric-copy-do'));
        });
        expect(tools.handleCopyRubric).toHaveBeenCalledWith(source);
        expect(screen.queryByTestId('grading-rubric-copy-dialog')).toBeNull();
    });

    test('保存された基準: 例の無い段に印、S の例が無ければ注意', () => {
        const levels = ['S', 'A', 'B', 'C'].map((grade) => ({ grade, text: `${grade} の文` }));
        const examples = [
            { seatNumber: 1, grade: 'B' },
            { seatNumber: 2, grade: 'C' },
        ];
        renderTab(makeTools({ savedRubric: { levels, examples } }));
        expect(screen.getByTestId('grading-rubric-no-s-example')).toBeInTheDocument();
        expect(screen.getByTestId('classroom-eval-rubric-levels-no-example-S')).toBeInTheDocument();
        expect(screen.getByTestId('classroom-eval-rubric-levels-no-example-A')).toBeInTheDocument();
        expect(screen.queryByTestId('classroom-eval-rubric-levels-no-example-B')).toBeNull();
        expect(screen.queryByTestId('classroom-eval-rubric-levels-no-example-C')).toBeNull();
    });

    test('S の例があれば注意を出さない', () => {
        const levels = [{ grade: 'S', text: 's' }];
        renderTab(makeTools({ savedRubric: { levels, examples: [{ seatNumber: 1, grade: 'S' }] } }));
        expect(screen.queryByTestId('grading-rubric-no-s-example')).toBeNull();
        expect(screen.queryByTestId('classroom-eval-rubric-levels-no-example-S')).toBeNull();
    });

    test('コピーのダイアログ: 選んだ基準に S の例が無ければ注意', async () => {
        const source = { levels: [{ grade: 'B', text: 'b' }], examples: [{ seatNumber: 1, grade: 'B' }] };
        renderTab(makeTools({ handleReadCopySource: jest.fn(() => Promise.resolve(source)) }));
        fireEvent.click(screen.getByTestId('grading-rubric-copy'));
        fireEvent.change(screen.getByTestId('grading-rubric-copy-class'), { target: { value: 'g2' } });
        await act(async () => {
            fireEvent.change(screen.getByTestId('grading-rubric-copy-assignment'), { target: { value: 'b1' } });
        });
        expect(screen.getByTestId('grading-rubric-copy-no-s-example')).toBeInTheDocument();
    });

    test('基準づくり: 先生の正解に S が無ければ、文を書いてもらう前に注意', () => {
        const { unmount } = renderTab(makeTools({ examples: [{ seatNumber: 1, grade: 'B' }] }));
        expect(screen.getByTestId('grading-rubric-draft-no-s-example')).toBeInTheDocument();
        unmount();
        renderTab(makeTools({ examples: [{ seatNumber: 1, grade: 'S' }] }));
        expect(screen.queryByTestId('grading-rubric-draft-no-s-example')).toBeNull();
    });

    test('基準づくり: 正解がまだ無いときは注意を出さない', () => {
        renderTab(makeTools());
        expect(screen.queryByTestId('grading-rubric-draft-no-s-example')).toBeNull();
    });
});

describe('TeacherGradingGroupPrompt (#2425)', () => {
    test('同じまとまりのほかの作品も変えるかを聞く', () => {
        const onApply = jest.fn();
        const onDismiss = jest.fn();
        render(
            <IntlProvider locale="en" messages={{}}>
                <TeacherGradingGroupPrompt
                    prompt={{ group: 'サーボだけ', seats: [2, 3], grade: 'A' }}
                    onApply={onApply}
                    onDismiss={onDismiss}
                />
            </IntlProvider>,
        );
        expect(screen.getByTestId('grading-group-prompt')).toHaveTextContent('サーボだけ');
        fireEvent.click(screen.getByTestId('grading-group-prompt-yes'));
        expect(onApply).toHaveBeenCalled();
    });
});
