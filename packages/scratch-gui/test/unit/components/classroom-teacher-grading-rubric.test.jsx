/* eslint-env jest */
/**
 * 課題の採点の［基準］のタブ (EPIC #2421 / #2425)。
 *
 * - 基準づくりは縦のステッパー（2-1 説明 → 2-2 代表 → 2-3 フェア → 2-4 基準の文・#2455 F1）。
 *   いまの小手順だけ開き、済んだ小手順は 1 行にたたむ。
 * - AI は各小手順の上部の「AI に相談」から。一度実行したら押せない（F3）。代表は 1 つのボタンでまとめて（F4）。
 * - 説明が空で AI の案があると「合っていますか？」と 3 つのボタンを出す。
 * - 代表の作品は一覧で、押した行だけ開く（アコーディオン）。
 * - 基準がある課題は基準を見せ、基準づくりを飛ばせる。
 * - ほかの課題から基準をコピー: クラスと課題を選び、中身を見てからコピーする。
 * - 1 件を直したあとの「同じまとまりも直すか」の問い。
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

const described = { ...lesson, assignmentText: 'サーボを動かす課題' };

const renderTab = (tools, theLesson = lesson) =>
    render(
        <IntlProvider locale="en" messages={{}}>
            <TeacherGradingRubric lesson={theLesson} tools={tools} onOpenWork={jest.fn()} />
        </IntlProvider>,
    );

const stepState = (id) => screen.getByTestId(`grading-rubric-steps-step-${id}`).getAttribute('data-state');

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
        renderTab(tools, described);
        expect(screen.queryByTestId('grading-rubric-rep-body-1')).toBeNull();
        fireEvent.click(screen.getByTestId('grading-rubric-rep-1'));
        expect(screen.getByTestId('grading-rubric-rep-body-1')).toHaveTextContent('サーボを 90 度に曲げる');
        fireEvent.click(screen.getByTestId('grading-rubric-rep-4'));
        expect(screen.queryByTestId('grading-rubric-rep-body-1')).toBeNull();
        expect(screen.getByTestId('grading-rubric-rep-body-4')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('grading-rubric-rep-grade-4-B'));
        expect(tools.handleSetAnswer).toHaveBeenCalledWith(4, { grade: 'B' });
    });

    test('基準がある課題は基準を見せ、つくり直しは選んだときだけ', () => {
        const tools = makeTools({ savedRubric: { levels: [{ grade: 'B', text: 'サーボ' }], examples: [] } });
        renderTab(tools);
        expect(screen.getByTestId('grading-rubric-saved')).toHaveTextContent('サーボ');
        expect(screen.queryByTestId('grading-rubric-reps')).toBeNull();
        fireEvent.click(screen.getByTestId('grading-rubric-edit'));
        expect(screen.getByTestId('grading-rubric-steps')).toBeInTheDocument();
        // 説明が空なので 2-1 がいまここ。2-2 は見出しで開ける。
        expect(stepState('describe')).toBe('now');
        fireEvent.click(screen.getByTestId('grading-rubric-steps-head-examples'));
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
});

describe('TeacherGradingRubric の縦のステッパーと「AI に相談」(#2455)', () => {
    test('はじめは 2-1 がいまここで開き、ほかはたたんである', () => {
        renderTab(makeTools());
        expect(screen.getByTestId('grading-rubric-steps')).toHaveTextContent('2-1 → 2-4');
        expect(stepState('describe')).toBe('now');
        expect(['examples', 'fairness', 'sentences'].map(stepState)).toEqual(['todo', 'todo', 'todo']);
        expect(screen.getByTestId('grading-rubric-description')).toBeInTheDocument();
        expect(screen.queryByTestId('grading-rubric-reps')).toBeNull();
    });

    test('説明があると 2-1 は済みの 1 行になり、2-2 が開く', () => {
        renderTab(makeTools(), described);
        expect(stepState('describe')).toBe('done');
        expect(screen.getByTestId('grading-rubric-steps-summary-describe')).toHaveTextContent('サーボを動かす課題');
        expect(stepState('examples')).toBe('now');
        expect(screen.getByTestId('grading-rubric-reps')).toBeInTheDocument();
    });

    test('AI のボタンは各小手順の上部に「AI に相談」の囲みで置く', () => {
        renderTab(makeTools(), described);
        const reps = screen.getByTestId('grading-rubric-reps');
        expect(reps.firstChild).toBe(screen.getByTestId('grading-rubric-propose-ai'));
        expect(screen.getByTestId('grading-rubric-propose-ai')).toHaveTextContent('What the AI does here:');
        fireEvent.click(screen.getByTestId('grading-rubric-steps-head-fairness'));
        expect(screen.getByTestId('grading-rubric-fairness').firstChild).toBe(
            screen.getByTestId('grading-rubric-fairness-ai'),
        );
        fireEvent.click(screen.getByTestId('grading-rubric-steps-head-sentences'));
        expect(screen.getByTestId('grading-rubric-sentences').firstChild).toBe(
            screen.getByTestId('grading-rubric-draft-ai'),
        );
    });

    test('代表の AI の案は 2-2 の上の 1 つのボタンでまとめて出す（F4）', () => {
        const tools = makeTools({ proposals: {} });
        renderTab(tools, described);
        const button = screen.getByTestId('grading-rubric-propose-ai-button');
        expect(button).toHaveTextContent('for the 2 Works');
        expect(button).toBeEnabled();
        fireEvent.click(button);
        expect(tools.handlePropose).toHaveBeenCalledTimes(1);
        expect(screen.getAllByText(/Ask the AI to Propose/)).toHaveLength(1);
    });

    test('一度実行した AI のボタンは、もう押せない', () => {
        const tools = makeTools({
            answers: { 1: { grade: 'A' }, 4: { grade: 'B' } },
            description: { status: 'used', text: 'x' },
            drafted: true,
            examples: [{ seatNumber: 1, grade: 'A' }],
            fairness: { checks: [], answers: {} },
        });
        renderTab(tools);
        expect(screen.getByTestId('grading-rubric-describe-ai-button')).toBeDisabled();
        expect(screen.getByTestId('grading-rubric-describe-ai')).toHaveTextContent('already run');
        fireEvent.click(screen.getByTestId('grading-rubric-steps-head-examples'));
        expect(screen.getByTestId('grading-rubric-propose-ai-button')).toBeDisabled();
        fireEvent.click(screen.getByTestId('grading-rubric-steps-head-fairness'));
        expect(screen.getByTestId('grading-rubric-fairness-ai-button')).toBeDisabled();
        fireEvent.click(screen.getByTestId('grading-rubric-steps-head-sentences'));
        expect(screen.getByTestId('grading-rubric-draft-ai-button')).toBeDisabled();
    });

    test('失敗した AI はもう一度押せる・説明が書いてあれば 2-1 に AI は出さない', () => {
        const { unmount } = renderTab(makeTools({ description: { status: 'failed', text: '' } }));
        expect(screen.getByTestId('grading-rubric-describe-ai-button')).toBeEnabled();
        unmount();
        renderTab(makeTools(), described);
        fireEvent.click(screen.getByTestId('grading-rubric-steps-head-describe'));
        expect(screen.queryByTestId('grading-rubric-describe-ai')).toBeNull();
        expect(screen.getByTestId('grading-rubric-description-text')).toHaveTextContent('サーボを動かす課題');
    });

    test('AI が動いている間は、その小手順のボタンに出す', () => {
        renderTab(makeTools({ proposals: {}, running: 'propose' }), described);
        expect(screen.getByTestId('grading-rubric-propose-ai-button')).toHaveAttribute('aria-busy', 'true');
        expect(screen.queryByTestId('grading-rubric-running')).toBeNull();
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
