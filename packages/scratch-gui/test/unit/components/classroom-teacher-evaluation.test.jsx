/* eslint-env jest */
/**
 * 採点の画面 (#1304 / EPIC #1296 の V1・V2・EPIC #2421 / #2424)。
 *
 * - 採点のタブは採点簿（課題 × 出席番号）から始まる。課題を押すと、その課題の採点を開く。
 * - 課題の採点は「1 提出を読み込む → 2 基準をつくる → 3 全員を採点 → 4 確定 → 5 コメントを下書き →
 *   6 返却」の手順にし、いま押すボタンだけを主ボタンにする (aria-current="step" で pin する。CSS Modules は
 *   jest では空なので class は見られない)。CSV 2 つは「書き出し ▾」にまとめる。
 * - V2: 冒頭の説明は 1 行にし、残りは「詳しく」で開く。
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherClassTabs from '../../../src/components/classroom-modal/teacher-class-tabs.jsx';
import TeacherEvaluation, {
    neighbourSeats,
    pickDetailCell,
} from '../../../src/components/classroom-modal/teacher-evaluation.jsx';
import { COURSES } from '../../../src/lib/lessons/courses.js';

const LESSONS = [{ classroomId: 'c1', assignmentName: '迷路' }];

const baseHandlers = () => ({
    onBack: jest.fn(),
    onExportAuditCsv: jest.fn(),
    onExportEvaluationCsv: jest.fn(),
    onLoadSubmissions: jest.fn(),
    onReturnComments: jest.fn(),
    onRunAi: jest.fn(),
    onSetCellGrade: jest.fn(),
    onSetCellReason: jest.fn(),
    onSetComment: jest.fn(),
});

const evaluationElement = (props = {}, handlers = baseHandlers()) => (
    <IntlProvider locale="en">
        <TeacherEvaluation
            comments={{}}
            currentId="c1"
            evalLessons={LESSONS}
            getCell={() => null}
            seats={[]}
            view="assignment"
            {...handlers}
            {...props}
        />
    </IntlProvider>
);

const renderEvaluation = (props = {}) => {
    const handlers = { ...baseHandlers(), onConfirmGrades: jest.fn(), onVisitRubric: jest.fn() };
    const utils = render(evaluationElement(props, handlers));
    return { ...utils, handlers };
};

const STEP_IDS = [
    'classroom-eval-load',
    'classroom-eval-rubric',
    'classroom-eval-run-grade',
    'classroom-eval-confirm',
    'classroom-eval-run-comment',
    'classroom-eval-return-comments',
];

const currentStepIds = (getByTestId) =>
    STEP_IDS.filter((id) => getByTestId(id).getAttribute('aria-current') === 'step');

describe('TeacherEvaluation steps (#2424)', () => {
    test('the six step buttons are in the footer in order, with the load step current first', () => {
        const { getByTestId } = renderEvaluation();
        const footerButtons = [...getByTestId('classroom-eval-steps').querySelectorAll('button')].map((b) =>
            b.getAttribute('data-testid'),
        );
        expect(footerButtons).toEqual(STEP_IDS);
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-load']);
        expect(getByTestId('classroom-eval-load')).toBeEnabled();
        expect(getByTestId('classroom-eval-run-grade')).toBeDisabled();
    });

    test('after loading, the rubric step is current; once looked at, grading everyone', () => {
        const props = { seats: [1], getCell: () => ({ submitted: true, grade: null }) };
        const { getByTestId, rerender, handlers } = renderEvaluation(props);
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-rubric']);
        fireEvent.click(getByTestId('classroom-eval-rubric'));
        expect(handlers.onVisitRubric).toHaveBeenCalledTimes(1);
        rerender(evaluationElement({ ...props, rubricDone: true }));
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-run-grade']);
        expect(getByTestId('classroom-eval-run-comment')).toBeEnabled();
        expect(getByTestId('classroom-eval-confirm')).toBeDisabled();
    });

    test('after grading, confirming is the current step; after confirming, drafting comments', () => {
        const props = { seats: [1], getCell: () => ({ submitted: true, grade: 'A' }), rubricDone: true };
        const { getByTestId, rerender, handlers } = renderEvaluation(props);
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-confirm']);
        fireEvent.click(getByTestId('classroom-eval-confirm'));
        expect(handlers.onConfirmGrades).toHaveBeenCalledTimes(1);
        rerender(
            evaluationElement({
                ...props,
                gradings: { c1: { grades: {}, confirmedAt: '2026-11-25T00:00:00Z' } },
                onConfirmGrades: jest.fn(),
            }),
        );
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-run-comment']);
        expect(getByTestId('classroom-eval-confirmed')).toHaveTextContent('Confirmed');
    });

    test('after drafting comments, returning is the current step', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
            comments: { '1:c1': 'よくできました' },
        });
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-return-comments']);
    });

    test('blank comment drafts and drafts of other seats / assignments do not count', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            rubricDone: true,
            getCell: () => ({ submitted: true, grade: 'A' }),
            comments: { '1:c1': '   ', '2:c1': 'よくできました', '1:c9': 'よくできました' },
        });
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-confirm']);
    });

    test('every step is disabled while busy', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
            evalProgress: { label: 'x', done: 0, total: 1 },
        });
        for (const id of STEP_IDS) expect(getByTestId(id)).toBeDisabled();
    });

    test('the confirm step shows a spinner while confirming', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
            evalProgress: { kind: 'confirm', assignmentName: '迷路' },
        });
        expect(getByTestId('classroom-eval-confirm-running')).toHaveTextContent('Confirming');
        expect(getByTestId('classroom-eval-progress-text').textContent).toBe('Confirming the grades of 迷路');
    });

    // #2419: the pressed step shows a spinner until it ends, and the message says what runs.
    test('the running step button shows a spinner and short words', () => {
        const { getByTestId, queryByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: null }),
            evalProgress: { kind: 'grade', assignmentName: '迷路', from: 11, to: 20, total: 28 },
        });
        const button = getByTestId('classroom-eval-run-grade');
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(getByTestId('classroom-eval-run-grade-running')).toHaveTextContent('Grading');
        expect(queryByTestId('classroom-eval-load-running')).toBeNull();
        expect(getByTestId('classroom-eval-load')).not.toHaveAttribute('aria-busy');
        const status = getByTestId('classroom-eval-progress');
        expect(status).toHaveAttribute('role', 'status');
        expect(status).toHaveAttribute('aria-busy', 'true');
        expect(getByTestId('classroom-eval-progress-text').textContent).toBe(
            'The AI is grading 迷路 (seats 11–20 of 28)',
        );
        expect(getByTestId('classroom-eval-progress-bar')).toHaveAttribute('data-percent', '36');
    });

    test('loading before the list is read has no bar', () => {
        const { getByTestId, queryByTestId } = renderEvaluation({
            evalProgress: { kind: 'load', assignmentName: '迷路', done: 0, total: null },
        });
        expect(getByTestId('classroom-eval-load-running')).toHaveTextContent('Loading');
        expect(getByTestId('classroom-eval-progress-text').textContent).toBe('Loading the submissions of 迷路');
        expect(queryByTestId('classroom-eval-progress-bar')).toBeNull();
    });

    test('the result is shown once the step ends; a failure is marked', () => {
        const { getByTestId, queryByTestId, rerender } = renderEvaluation({
            evalResult: { kind: 'load', count: 28, lessons: 1 },
        });
        expect(queryByTestId('classroom-eval-progress')).toBeNull();
        expect(getByTestId('classroom-eval-result').textContent).toBe('Loaded 28 submissions.');
        expect(getByTestId('classroom-eval-result')).toHaveAttribute('data-failed', 'false');
        rerender(evaluationElement({ evalResult: { kind: 'return', failed: true, done: 5, total: 28 } }));
        expect(getByTestId('classroom-eval-result')).toHaveAttribute('data-failed', 'true');
        expect(getByTestId('classroom-eval-result').textContent).toBe(
            'Returning the comments stopped on the way (5 of 28 returned).',
        );
    });

    test('opening a work and saving the lesson points use the same message', () => {
        const { getByTestId, rerender } = renderEvaluation({ openingWork: true });
        expect(getByTestId('classroom-eval-progress-text').textContent).toBe('Opening the work');
        rerender(evaluationElement({ scoringSavingId: 'c1' }));
        expect(getByTestId('classroom-eval-progress-text').textContent).toBe('Saving the lesson points of 迷路');
    });

    test('step buttons call their handlers', () => {
        const { getByTestId, handlers } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: null }),
        });
        fireEvent.click(getByTestId('classroom-eval-load'));
        fireEvent.click(getByTestId('classroom-eval-run-grade'));
        fireEvent.click(getByTestId('classroom-eval-run-comment'));
        fireEvent.click(getByTestId('classroom-eval-return-comments'));
        expect(handlers.onLoadSubmissions).toHaveBeenCalledTimes(1);
        expect(handlers.onRunAi.mock.calls).toEqual([['grade'], ['comment']]);
        expect(handlers.onReturnComments).toHaveBeenCalledTimes(1);
    });
});

describe('TeacherEvaluation export menu (V1)', () => {
    test('the two CSVs live in the export menu, closed by default', () => {
        const { getByTestId, queryByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
        });
        const toggle = getByTestId('classroom-eval-export-menu');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(queryByTestId('classroom-eval-export')).toBeNull();
        expect(queryByTestId('classroom-eval-export-audit')).toBeNull();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(getByTestId('classroom-eval-export')).toBeInTheDocument();
        expect(getByTestId('classroom-eval-export-audit')).toBeInTheDocument();
    });

    test('choosing an item runs it and closes the menu', () => {
        const { getByTestId, queryByTestId, handlers } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
        });
        fireEvent.click(getByTestId('classroom-eval-export-menu'));
        fireEvent.click(getByTestId('classroom-eval-export'));
        expect(handlers.onExportEvaluationCsv).toHaveBeenCalledTimes(1);
        expect(queryByTestId('classroom-eval-export')).toBeNull();

        fireEvent.click(getByTestId('classroom-eval-export-menu'));
        fireEvent.click(getByTestId('classroom-eval-export-audit'));
        expect(handlers.onExportAuditCsv).toHaveBeenCalledTimes(1);
    });

    test('a click outside closes the menu', () => {
        const { getByTestId, queryByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
        });
        fireEvent.click(getByTestId('classroom-eval-export-menu'));
        fireEvent.mouseDown(getByTestId('classroom-phase-teacher-evaluation'));
        expect(queryByTestId('classroom-eval-export')).toBeNull();
    });

    test('the export menu cannot open before submissions are loaded', () => {
        const { getByTestId } = renderEvaluation();
        expect(getByTestId('classroom-eval-export-menu')).toBeDisabled();
    });
});

describe('TeacherEvaluation hint (V2)', () => {
    test('shows one line and opens the rest with "More"', () => {
        const { getByTestId, queryByTestId } = renderEvaluation();
        expect(getByTestId('classroom-phase-teacher-evaluation')).toHaveTextContent(
            'AI grades are drafts. You make the final call.',
        );
        expect(queryByTestId('classroom-eval-hint-detail')).toBeNull();

        const more = getByTestId('classroom-eval-hint-toggle');
        expect(more).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(more);
        expect(more).toHaveAttribute('aria-expanded', 'true');
        expect(getByTestId('classroom-eval-hint-detail')).toHaveTextContent('calibrates the AI');

        fireEvent.click(more);
        expect(queryByTestId('classroom-eval-hint-detail')).toBeNull();
    });

    test('タブの行があれば、説明の 1 行はタブの行の右に置き、全文を title に持つ (#1962)', () => {
        const { getByTestId } = renderEvaluation({
            tabs: <TeacherClassTabs selected="grading" onSelect={jest.fn()} />,
        });
        const row = getByTestId('classroom-class-tabs').parentElement;
        const line = getByTestId('classroom-eval-hint-text');
        expect(row).toContainElement(line);
        expect(line).toHaveAttribute('title', 'AI grades are drafts. You make the final call.');
        expect(row).toContainElement(getByTestId('classroom-eval-hint-toggle'));
        // 「詳しく」で開く残りはタブの行の外（下）
        fireEvent.click(getByTestId('classroom-eval-hint-toggle'));
        expect(row).not.toContainElement(getByTestId('classroom-eval-hint-detail'));
    });
});

describe('TeacherEvaluation without the grading criteria (#2455 F2)', () => {
    test('the criteria and the strictness are not on the screen any more', () => {
        const { queryByTestId, getByTestId } = renderEvaluation({ seats: [1] });
        expect(queryByTestId('classroom-eval-settings-summary')).toBeNull();
        expect(queryByTestId('classroom-eval-settings-toggle')).toBeNull();
        expect(queryByTestId('classroom-eval-strictness')).toBeNull();
        // Without a rubric, it says which fixed criteria the AI grades on.
        expect(getByTestId('classroom-eval-no-rubric')).toHaveTextContent('whether it runs');
    });
});

describe('レッスンの点（#1603）', () => {
    test('席の一覧に「Lesson」の点を出し、記録の無い席は —', () => {
        const lessons = [{ classroomId: 'c1', assignmentName: '迷路', hasLesson: true }];
        const { getByTestId } = renderEvaluation({
            evalLessons: lessons,
            seats: [1, 2],
            getCell: (seat) => (seat === 1 ? { submitted: true, grade: 'A' } : null),
            lessonScores: { c1: { total: 100, submitWork: true, scores: { 1: 78 } } },
        });
        expect(getByTestId('classroom-eval-seat-list').parentElement).toHaveTextContent('Lesson');
        expect(getByTestId('classroom-eval-cell-button-1-c1')).toHaveTextContent('78');
        expect(getByTestId('classroom-eval-cell-button-2-c1')).toHaveTextContent('—');
        expect(getByTestId('classroom-eval-tab-student')).toBeInTheDocument();
    });

    test('作品を出さないレッスンの課題は、点だけで［基準］［生徒］のタブを出さない', () => {
        const lessons = [{ classroomId: 'c1', assignmentName: '迷路', hasLesson: true }];
        const { getByTestId, queryByTestId } = renderEvaluation({
            evalLessons: lessons,
            seats: [1],
            lessonScores: { c1: { total: 100, submitWork: false, scores: { 1: 100 } } },
        });
        expect(getByTestId('classroom-eval-cell-button-1-c1')).toHaveTextContent('100');
        expect(queryByTestId('classroom-eval-tab-student')).toBeNull();
    });
});

describe('レッスンの課題の採点の流れ (#1778)', () => {
    // 実在のコースのチャレンジを使う（コースが無いと欄を出さない）
    const lessonSettingOf = (submitWork) => ({
        courseId: COURSES[0].id,
        challengeIds: COURSES[0].lessons[0].challenges.map((c) => c.id),
        requiredChallengeIds: [],
        completion: { type: 'all' },
        submitWork,
        scoring: null,
    });
    const lessonOnly = {
        classroomId: 'lo',
        assignmentName: 'レッスン1',
        hasLesson: true,
        lessonSetting: lessonSettingOf(false),
    };
    const withWork = {
        classroomId: 'lw',
        assignmentName: '迷路',
        hasLesson: true,
        lessonSetting: lessonSettingOf(true),
    };

    test('作品を出さないレッスンの課題だけ: AI の採点ボタンを出さず、①読み込む → ②点を確かめる → ③書き出す', () => {
        const onCheckScoring = jest.fn();
        const { getByTestId, queryByTestId } = renderEvaluation({
            evalLessons: [lessonOnly],
            currentId: 'lo',
            seats: [1],
            onChangeLessonScoring: jest.fn(),
            onCheckScoring,
        });
        expect(queryByTestId('classroom-eval-run-grade')).toBeNull();
        expect(queryByTestId('classroom-eval-return-comments')).toBeNull();
        expect(queryByTestId('classroom-eval-export-menu')).toBeNull();
        expect(getByTestId('classroom-eval-lesson-only-hint')).toHaveTextContent('AI grading is not used');
        expect(getByTestId('classroom-eval-check-points')).toHaveAttribute('aria-current', 'step');
        expect(getByTestId('classroom-eval-lesson-scoring-lo')).toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-eval-check-points'));
        expect(onCheckScoring).toHaveBeenCalled();
    });

    test('点を確かめたら ③書き出す が主ボタン・押すと採点結果の CSV', () => {
        const { getByTestId, handlers } = renderEvaluation({
            evalLessons: [lessonOnly],
            currentId: 'lo',
            seats: [1],
            scoringChecked: true,
            onChangeLessonScoring: jest.fn(),
        });
        expect(getByTestId('classroom-eval-export-lesson')).toHaveAttribute('aria-current', 'step');
        fireEvent.click(getByTestId('classroom-eval-export-lesson'));
        expect(handlers.onExportEvaluationCsv).toHaveBeenCalled();
    });

    test('作品も提出するレッスンの課題: いつもの 6 つの手順のまま・レッスンの点の欄も出す', () => {
        const { getByTestId } = renderEvaluation({
            evalLessons: [withWork],
            currentId: 'lw',
            onChangeLessonScoring: jest.fn(),
        });
        expect(getByTestId('classroom-eval-run-grade')).toBeInTheDocument();
        expect(getByTestId('classroom-eval-lesson-scoring-lw')).toBeInTheDocument();
    });

    test('必須が無いときは、必須の点の欄を使わないと示す', () => {
        const { getByTestId } = renderEvaluation({
            evalLessons: [lessonOnly],
            currentId: 'lo',
            onChangeLessonScoring: jest.fn(),
        });
        expect(getByTestId('classroom-lesson-scoring-required-unused')).toHaveTextContent('nothing is required');
        expect(getByTestId('classroom-lesson-scoring-required')).toBeDisabled();
    });
});

describe('席の一覧と［生徒］の詳細 (#1962・R1・#2424)', () => {
    const student = { innerTab: 'student', onSetInnerTab: jest.fn() };
    const cells = {
        '1:c1': { submitted: true, grade: 'A', reason: '旗で動く', manual: false },
        '2:c1': null,
        '3:c1': { submitted: true, grade: null, reason: '', needsReview: true },
        '4:c1': { submitted: true, grade: 'B', reason: '', manual: true, gradeEdited: true, returned: true },
        // 根拠だけを先生が直したセル: 点は AI のまま
        '5:c1': { submitted: true, grade: 'C', reason: '直した', manual: true, gradeEdited: false },
    };
    const getCell = (seat, id) => cells[`${seat}:${id}`] || null;
    const seats = [1, 2, 3, 4, 5];

    test('一覧は点だけ: 入力欄を置かず、点（無ければ —）のボタンを出す', () => {
        const { getByTestId } = renderEvaluation({ seats, getCell });
        expect(getByTestId('classroom-eval-seat-list').querySelector('select, input, textarea')).toBeNull();
        expect(getByTestId('classroom-eval-cell-button-1-c1')).toHaveTextContent('A');
        expect(getByTestId('classroom-eval-cell-button-1-c1').getAttribute('aria-label')).toBe(
            'Seat 1, 迷路: A (AI draft)',
        );
        expect(getByTestId('classroom-eval-cell-button-3-c1')).toHaveTextContent('—');
        // 点が無いセルは「—」と読まず「未採点」。印（!）の意味も言葉で
        expect(getByTestId('classroom-eval-cell-button-3-c1').getAttribute('aria-label')).toBe(
            'Seat 3, 迷路: Not graded (Needs check)',
        );
        expect(getByTestId('classroom-eval-cell-button-4-c1').getAttribute('aria-label')).toBe(
            'Seat 4, 迷路: B (Returned)',
        );
        // AI の案（確定していない）は言葉でも言う
        expect(getByTestId('classroom-eval-cell-button-1-c1').querySelector('[data-draft="true"]')).not.toBeNull();
        expect(getByTestId('classroom-eval-cell-button-2-c1')).toHaveTextContent('Not submitted');
    });

    test('読み込んだら最初に提出した席を右に出す。欄には見えるラベルがあり、プレースホルダーを使わない', () => {
        const { getByTestId, getByLabelText } = renderEvaluation({ seats, getCell, ...student });
        expect(getByTestId('classroom-eval-detail-title')).toHaveTextContent('Seat 01');
        expect(getByTestId('classroom-eval-cell-button-1-c1')).toHaveAttribute('aria-pressed', 'true');
        expect(getByLabelText('Grade')).toBe(getByTestId('classroom-eval-grade-1-c1'));
        expect(getByLabelText('Reason (teacher only)')).toBe(getByTestId('classroom-eval-reason-1-c1'));
        expect(getByLabelText('Comment to the student')).toBe(getByTestId('classroom-eval-comment-1-c1'));
        expect(getByTestId('classroom-eval-reason-1-c1').getAttribute('placeholder')).toBeFalsy();
        expect(getByTestId('classroom-eval-comment-1-c1').getAttribute('placeholder')).toBeFalsy();
        // AI が出した点（先生がまだ変えていない）には「AI の下書き」
        expect(getByTestId('classroom-eval-detail-ai-draft')).toHaveTextContent('AI draft');
    });

    test('セルを押すとその席を右に出し、欄を変えると席と課題を渡す', () => {
        const { getByTestId, queryByTestId, handlers } = renderEvaluation({ seats, getCell });
        fireEvent.click(getByTestId('classroom-eval-cell-button-4-c1'));
        expect(getByTestId('classroom-eval-detail-title')).toHaveTextContent('Seat 04');
        expect(queryByTestId('classroom-eval-grade-1-c1')).toBeNull();
        // 先生が決めた点には「AI の下書き」を付けない
        expect(queryByTestId('classroom-eval-detail-ai-draft')).toBeNull();
        // 根拠だけを直したセルは、点が AI のままなので「AI の下書き」のまま (#1962 Q1)
        fireEvent.click(getByTestId('classroom-eval-cell-button-5-c1'));
        expect(getByTestId('classroom-eval-detail-ai-draft')).toBeInTheDocument();
        fireEvent.click(getByTestId('classroom-eval-cell-button-4-c1'));
        fireEvent.change(getByTestId('classroom-eval-grade-4-c1'), { target: { value: 'S' } });
        expect(handlers.onSetCellGrade).toHaveBeenCalledWith(4, 'c1', 'S');
        fireEvent.change(getByTestId('classroom-eval-reason-4-c1'), { target: { value: 'よい' } });
        expect(handlers.onSetCellReason).toHaveBeenCalledWith(4, 'c1', 'よい');
        fireEvent.change(getByTestId('classroom-eval-comment-4-c1'), { target: { value: 'いいね' } });
        expect(handlers.onSetComment).toHaveBeenCalledWith(4, 'c1', 'いいね');
    });

    test('‹ › は同じ課題を提出した前後の席へ（出していない席はとばす）', () => {
        const { getByTestId } = renderEvaluation({ seats, getCell, ...student });
        expect(getByTestId('classroom-eval-detail-prev')).toBeDisabled();
        expect(getByTestId('classroom-eval-detail-next')).toHaveTextContent('03 ›');
        fireEvent.click(getByTestId('classroom-eval-detail-next'));
        expect(getByTestId('classroom-eval-detail-title')).toHaveTextContent('Seat 03');
        expect(getByTestId('classroom-eval-detail-prev')).toHaveTextContent('‹ 01');
        // 読み上げの名前にも見える番号を入れる
        expect(getByTestId('classroom-eval-detail-prev').getAttribute('aria-label')).toBe('Previous seat 01');
        expect(getByTestId('classroom-eval-detail-next').getAttribute('aria-label')).toBe('Next seat 04');
        fireEvent.click(getByTestId('classroom-eval-detail-next'));
        fireEvent.click(getByTestId('classroom-eval-detail-next'));
        expect(getByTestId('classroom-eval-detail-title')).toHaveTextContent('Seat 05');
        expect(getByTestId('classroom-eval-detail-next')).toBeDisabled();
        expect(getByTestId('classroom-eval-detail-next').getAttribute('aria-label')).toBe('Next seat');
    });

    test('コメントを書いたセルに印、要確認のセルは「要確認」を右に出す', () => {
        const { getByTestId } = renderEvaluation({ seats, getCell, comments: { '1:c1': 'よくできました' } });
        expect(getByTestId('classroom-eval-cell-button-1-c1')).toHaveTextContent('💬');
        expect(getByTestId('classroom-eval-cell-button-1-c1').getAttribute('aria-label')).toBe(
            'Seat 1, 迷路: A (Comment written, AI draft)',
        );
        expect(getByTestId('classroom-eval-cell-button-4-c1')).not.toHaveTextContent('💬');
        fireEvent.click(getByTestId('classroom-eval-cell-button-3-c1'));
        expect(getByTestId('classroom-eval-detail')).toHaveTextContent('Needs check');
        expect(getByTestId('classroom-eval-comment-3-c1').value).toBe('');
    });

    test.each([
        ['ai', 'Needs check: the AI was unsure'],
        ['shape', 'Needs check: same shape, different grade'],
        ['analysis', 'Needs check: the work could not be read'],
    ])('要確認の理由（%s）を右の列と席の読み上げに出す', (reviewReason, text) => {
        const withReason = (seat, id) => (seat === 3 ? { ...cells['3:c1'], reviewReason } : getCell(seat, id));
        const { getByTestId } = renderEvaluation({ seats, getCell: withReason, ...student });
        expect(getByTestId('classroom-eval-cell-button-3-c1').getAttribute('aria-label')).toBe(
            `Seat 3, 迷路: Not graded (${text})`,
        );
        fireEvent.click(getByTestId('classroom-eval-cell-button-3-c1'));
        const badge = getByTestId('classroom-eval-detail-needs-review');
        expect(badge).toHaveTextContent(text);
        expect(badge).toHaveAttribute('data-reason', reviewReason);
    });

    test('提出が 1 つも無いときは、右の列にそう書く', () => {
        const { getByTestId } = renderEvaluation({ seats: [2], getCell, ...student });
        expect(getByTestId('classroom-eval-detail-empty')).toHaveTextContent('No work has been submitted.');
    });
});

describe('pickDetailCell / neighbourSeats (#1962)', () => {
    const getCell = (seat, id) => (seat === 2 || (seat === 3 && id === 'b') ? { submitted: true } : null);
    test('押したセルが表にあればそれ、無ければ行の順で最初の提出', () => {
        const base = { seats: [1, 2, 3], workIds: ['a', 'b'], getCell };
        expect(pickDetailCell({ ...base, chosen: { seat: 3, classroomId: 'b' } })).toEqual({
            seat: 3,
            classroomId: 'b',
        });
        expect(pickDetailCell({ ...base, chosen: null })).toEqual({ seat: 2, classroomId: 'a' });
        // 課題の選択を外した・提出が無いセルは使わない
        expect(pickDetailCell({ ...base, workIds: ['a'], chosen: { seat: 3, classroomId: 'b' } })).toEqual({
            seat: 2,
            classroomId: 'a',
        });
        expect(pickDetailCell({ ...base, seats: [1], chosen: null })).toBeNull();
    });

    test('前後の席は同じ課題の提出だけを数える', () => {
        expect(neighbourSeats([1, 2, 3], getCell, 'b', 2)).toEqual({ prev: null, next: 3 });
        expect(neighbourSeats([1, 2, 3], getCell, 'b', 3)).toEqual({ prev: 2, next: null });
        expect(neighbourSeats([1, 2, 3], getCell, 'a', 2)).toEqual({ prev: null, next: null });
    });
});

describe('採点を離れるときの確認 (#1923 C4)', () => {
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test.each(['classroom-evaluation-cancel', 'classroom-breadcrumb-class-list'])(
        '%s は requestLeave に onBack を渡す（確かめるかは container が決める）',
        (id) => {
            const onRequestLeave = jest.fn();
            const { handlers } = renderEvaluation({ onRequestLeave, view: 'book' });
            fireEvent.click(byTestId(id));
            expect(onRequestLeave).toHaveBeenCalledWith(handlers.onBack, 'back');
        },
    );

    test('ヘッダーの「クラス管理」は onShowClassList を requestLeave に渡す (#1956)', () => {
        const onRequestLeave = jest.fn();
        const onShowClassList = jest.fn();
        renderEvaluation({ onRequestLeave, onShowClassList });
        fireEvent.click(byTestId('classroom-breadcrumb-class-list'));
        expect(onRequestLeave).toHaveBeenCalledWith(onShowClassList, 'back');
    });

    test('タブの行（tabs）を出す', () => {
        renderEvaluation({ tabs: <div data-testid="the-class-tabs" /> });
        expect(byTestId('the-class-tabs')).toBeInTheDocument();
    });

    test('requestLeave が無ければ、そのまま戻る', () => {
        const { handlers } = renderEvaluation({ view: 'book' });
        fireEvent.click(byTestId('classroom-evaluation-cancel'));
        expect(handlers.onBack).toHaveBeenCalledTimes(1);
    });

    test('読み込んだあとの［読み込む］は、読み込み直しとして requestLeave に渡す', () => {
        const onRequestLeave = jest.fn();
        const { handlers } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: null }),
            onRequestLeave,
        });
        fireEvent.click(byTestId('classroom-eval-load'));
        expect(onRequestLeave).toHaveBeenCalledWith(handlers.onLoadSubmissions, 'reload');
    });

    test('読み込む前の［読み込む］は確かめない', () => {
        const onRequestLeave = jest.fn();
        const { handlers } = renderEvaluation({ onRequestLeave });
        fireEvent.click(byTestId('classroom-eval-load'));
        expect(onRequestLeave).not.toHaveBeenCalled();
        expect(handlers.onLoadSubmissions).toHaveBeenCalledTimes(1);
    });

    test('確かめている間: 手順のボタンの代わりに、文・［採点を続ける］・［書き出し］・［戻る］', () => {
        const onConfirmLeave = jest.fn();
        const onCancelLeave = jest.fn();
        const { handlers } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
            leaveRequest: { kind: 'back' },
            unsavedWork: { grades: true, comments: true },
            onCancelLeave,
            onConfirmLeave,
        });
        expect(byTestId('classroom-eval-leave-confirm-message').textContent).toBe(
            'Grades that could not be saved and comments you have not returned will be lost. Go back?',
        );
        expect(byTestId('classroom-eval-steps')).not.toBeInTheDocument();
        expect(byTestId('classroom-eval-leave-confirm').textContent).toBe('Go back');
        fireEvent.click(byTestId('classroom-eval-leave-export'));
        expect(handlers.onExportEvaluationCsv).toHaveBeenCalledTimes(1);
        fireEvent.click(byTestId('classroom-eval-leave-cancel'));
        expect(onCancelLeave).toHaveBeenCalledTimes(1);
        fireEvent.click(byTestId('classroom-eval-leave-confirm'));
        expect(onConfirmLeave).toHaveBeenCalledTimes(1);
        expect(handlers.onBack).not.toHaveBeenCalled();
    });

    // 文は中身に合わせる（レビュー Q1）: 採点だけ／コメントだけ／両方／AI の途中だけ。
    test.each([
        [{ grades: true, comments: false }, null, 'back', 'Grades that could not be saved will be lost. Go back?'],
        [
            { grades: false, comments: true },
            null,
            'leave',
            'Comments you have not returned will be lost. Leave this screen?',
        ],
        [
            { grades: true, comments: true },
            { label: 'AI', done: 0, total: 1 },
            'leave',
            'Something is still running. Leaving stops it. Grades that could not be saved and comments you have not returned will be lost. ' +
                'Leave this screen?',
        ],
        [
            { grades: false, comments: false },
            { label: 'AI', done: 0, total: 1 },
            'back',
            'Something is still running. Leaving stops it. Go back?',
        ],
        // 読み込み直してもコメントの下書きは残るので、採点だけを言う
        [
            { grades: true, comments: true },
            null,
            'reload',
            'Grades that could not be saved will be lost. Load again?',
        ],
    ])('unsaved %j, busy %j, %s', (unsavedWork, evalProgress, kind, text) => {
        renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
            evalProgress,
            leaveRequest: { kind },
            unsavedWork,
        });
        expect(byTestId('classroom-eval-leave-confirm-message').textContent).toBe(text);
    });

    test('確定のボタンは入口に合わせる（離れる・読み込み直す）', () => {
        const { rerender } = renderEvaluation({ seats: [1], leaveRequest: { kind: 'leave' } });
        expect(byTestId('classroom-eval-leave-confirm').textContent).toBe('Leave');
        rerender(evaluationElement({ leaveRequest: { kind: 'reload' }, seats: [1] }));
        expect(byTestId('classroom-eval-leave-confirm').textContent).toBe('Load again');
    });
});

describe('右の列の［作品を開く］(#1980)', () => {
    const cells = {
        '1:c1': { submissionId: 's1', submitted: true, grade: 'A', projectUrl: 'https://example.invalid/1.sb3' },
        '3:c1': { submissionId: 's3', submitted: true, grade: null, projectUrl: 'https://example.invalid/3.sb3' },
    };
    const getCell = (seat, id) => cells[`${seat}:${id}`] || null;
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('開く処理が無ければボタンを出さない', () => {
        renderEvaluation({ seats: [1, 3], getCell, innerTab: 'student', onSetInnerTab: jest.fn() });
        expect(byTestId('classroom-eval-detail-open-work')).toBeNull();
    });

    test('課題名の横に出し、押すと確かめずに選んだ席と課題を渡す（採点の画面は残るので・#1990）', () => {
        const onOpenWork = jest.fn();
        const onRequestLeave = jest.fn((action) => action());
        renderEvaluation({
            seats: [1, 3],
            getCell,
            onOpenWork,
            onRequestLeave,
            innerTab: 'student',
            onSetInnerTab: jest.fn(),
        });
        const button = byTestId('classroom-eval-detail-open-work');
        expect(button).toHaveTextContent('Open the work');
        expect(button).toBeEnabled();
        fireEvent.click(byTestId('classroom-eval-detail-next'));
        fireEvent.click(byTestId('classroom-eval-detail-open-work'));
        expect(onRequestLeave).not.toHaveBeenCalled();
        expect(onOpenWork).toHaveBeenCalledWith(3, 'c1');
    });

    test('選んだ席を container が持つときは、それを出し、選び直しを container に渡す (#1990)', () => {
        const onChooseCell = jest.fn();
        const onOpenWork = jest.fn();
        renderEvaluation({
            seats: [1, 3],
            getCell,
            onOpenWork,
            chosenCell: { seat: 3, classroomId: 'c1' },
            onChooseCell,
            innerTab: 'student',
            onSetInnerTab: jest.fn(),
        });
        fireEvent.click(byTestId('classroom-eval-detail-open-work'));
        expect(onOpenWork).toHaveBeenCalledWith(3, 'c1');
        fireEvent.click(byTestId('classroom-eval-detail-prev'));
        expect(onChooseCell).toHaveBeenCalledWith({ seat: 1, classroomId: 'c1' });
    });
});

describe('［作品を開く］を押したあと (#1980 FYI2)', () => {
    test('開いている間は押せず「Opening…」と出す', () => {
        const cells = { '1:c1': { submissionId: 's1', submitted: true, grade: 'A' } };
        renderEvaluation({
            seats: [1],
            getCell: (seat, id) => cells[`${seat}:${id}`] || null,
            onOpenWork: jest.fn(),
            openingWork: true,
            innerTab: 'student',
            onSetInnerTab: jest.fn(),
        });
        const button = document.querySelector('[data-testid="classroom-eval-detail-open-work"]');
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('Opening…');
    });
});

describe('採点簿 (#2424)', () => {
    const lessons = [
        { classroomId: 'new', assignmentName: '04_モーター' },
        { classroomId: 'old', assignmentName: '02_LED' },
        { classroomId: 'none', assignmentName: '06_センサー' },
    ];
    const gradings = {
        new: { grades: { 1: { grade: 'B', source: 'ai' }, 3: { grade: 'S', source: 'teacher' } }, confirmedAt: null },
        old: {
            grades: { 1: { grade: 'A', source: 'ai' }, 2: { grade: 'A', source: 'ai' } },
            confirmedAt: '2026-11-20T00:00:00Z',
            rubric: { levels: [{ grade: 'S', text: 'x' }] },
        },
        none: null,
    };
    const book = (props = {}) =>
        renderEvaluation({
            view: 'book',
            currentId: null,
            evalLessons: lessons,
            gradings,
            onOpenAssignment: jest.fn(),
            onShowGradebook: jest.fn(),
            onShowOverall: jest.fn(),
            ...props,
        });

    test('列は渡された順（新しい課題が左）、見出しに状態、いちばん上の行は S/A/B/C の人数', () => {
        const { getByTestId } = book();
        const heads = [...getByTestId('classroom-gradebook').querySelectorAll('thead th')].map((th) =>
            th.getAttribute('data-testid'),
        );
        expect(heads).toEqual([
            null,
            'classroom-gradebook-col-new',
            'classroom-gradebook-col-old',
            'classroom-gradebook-col-none',
        ]);
        expect(getByTestId('classroom-gradebook-col-new')).toHaveTextContent('1 AI drafts, not confirmed');
        expect(getByTestId('classroom-gradebook-col-old')).toHaveTextContent('Rubric・Confirmed 2');
        expect(getByTestId('classroom-gradebook-col-none')).toHaveTextContent('Not graded');
        expect(getByTestId('classroom-gradebook-counts-new')).toHaveTextContent('S1 A0 B1 C0');
        expect(getByTestId('classroom-gradebook-counts-none')).toHaveTextContent('—');
    });

    test('確定していない AI の案は点線（data-draft）、先生の評価・確定した課題はふつう', () => {
        const { getByTestId } = book();
        const cell = (seat, id) => getByTestId(`classroom-gradebook-cell-${seat}-${id}`).querySelector('button');
        expect(cell(1, 'new')).toHaveAttribute('data-draft', 'true');
        expect(cell(1, 'new').getAttribute('aria-label')).toBe('Seat 1, 04_モーター: B (AI draft)');
        expect(cell(3, 'new')).toHaveAttribute('data-draft', 'false');
        expect(cell(1, 'old')).toHaveAttribute('data-draft', 'false');
        expect(cell(2, 'new')).toHaveTextContent('—');
    });

    test('見出しを押すとその課題の採点、セルを押すとその席を選んで開く', () => {
        const onOpenAssignment = jest.fn();
        const { getByTestId } = book({ onOpenAssignment });
        fireEvent.click(getByTestId('classroom-gradebook-open-old'));
        expect(onOpenAssignment).toHaveBeenCalledWith('old');
        fireEvent.click(getByTestId('classroom-gradebook-cell-3-new').querySelector('button'));
        expect(onOpenAssignment).toHaveBeenCalledWith('new', 3);
    });

    test('読んでいる途中の課題は「Loading…」、採点が無ければそう書く', () => {
        const { getByTestId } = book({ gradings: { new: null } });
        expect(getByTestId('classroom-gradebook-col-old')).toHaveTextContent('Loading…');
        expect(getByTestId('classroom-gradebook-empty')).toBeInTheDocument();
    });

    test('［採点簿］［総合評価］の切りかえ。総合評価はまだ準備中', () => {
        const onShowOverall = jest.fn();
        const { getByTestId, rerender } = book({ onShowOverall });
        expect(getByTestId('classroom-gradebook-switch-book')).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(getByTestId('classroom-gradebook-switch-overall'));
        expect(onShowOverall).toHaveBeenCalledTimes(1);
        rerender(
            evaluationElement({
                view: 'overall',
                currentId: null,
                evalLessons: lessons,
                gradings,
                onShowGradebook: jest.fn(),
                onShowOverall,
            }),
        );
        expect(getByTestId('classroom-gradebook-overall')).toBeInTheDocument();
        expect(getByTestId('classroom-gradebook-switch-overall')).toHaveAttribute('aria-pressed', 'true');
    });

    test('課題の採点では［‹ 採点簿］とヘッダーのクラス名で採点簿へ戻り、課題名がヘッダーに入る', () => {
        const onShowGradebook = jest.fn();
        const { getByTestId } = renderEvaluation({ onShowGradebook, evalGroup: { name: '技術', groupId: 'g' } });
        fireEvent.click(getByTestId('classroom-eval-back-to-book'));
        fireEvent.click(getByTestId('classroom-breadcrumb-gradebook'));
        expect(onShowGradebook).toHaveBeenCalledTimes(2);
        expect(getByTestId('classroom-eval-assignment-title')).toHaveTextContent('迷路');
    });

    test('［基準］のタブ: 説明と基準（無ければそう書く）', () => {
        const { getByTestId, rerender } = renderEvaluation({
            evalLessons: [{ classroomId: 'c1', assignmentName: '迷路', assignmentText: 'ゴールまで動かす' }],
        });
        expect(getByTestId('classroom-eval-description')).toHaveTextContent('ゴールまで動かす');
        expect(getByTestId('classroom-eval-no-rubric')).toBeInTheDocument();
        rerender(
            evaluationElement({
                gradings: { c1: { grades: {}, rubric: { levels: [{ grade: 'S', text: '工夫がある' }] } } },
            }),
        );
        expect(getByTestId('classroom-eval-rubric-levels')).toHaveTextContent('工夫がある');
        expect(getByTestId('classroom-eval-description')).toHaveTextContent('No description is written.');
    });

    test('人数: 未提出・AI の案・確定・返却済み。保存の状態と、確定を取り消したことを出す', () => {
        const cells = {
            '1:c1': { submitted: true, grade: 'A' },
            '2:c1': { submitted: true, grade: 'B', gradeEdited: true, returned: true },
        };
        const { getByTestId } = renderEvaluation({
            seats: [1, 2, 3],
            loaded: true,
            getCell: (seat, id) => cells[`${seat}:${id}`] || null,
            gradeSaveState: 'failed',
            unconfirmedByEdit: true,
        });
        expect(getByTestId('classroom-eval-count-notSubmitted')).toHaveTextContent('1');
        expect(getByTestId('classroom-eval-count-drafts')).toHaveTextContent('1');
        expect(getByTestId('classroom-eval-count-confirmed')).toHaveTextContent('0');
        expect(getByTestId('classroom-eval-count-returned')).toHaveTextContent('1');
        expect(getByTestId('classroom-eval-save-state')).toHaveAttribute('data-state', 'failed');
        expect(getByTestId('classroom-eval-unconfirmed')).toBeInTheDocument();
    });

    test('評価の分布 (#2457): S/A/B/C、S+A と S の %（分母は評価のついた人）。目安を外れたら注意', () => {
        const cells = {
            '1:c1': { submitted: true, grade: 'A' },
            '2:c1': { submitted: true, grade: 'B' },
        };
        const getCell = (seat, id) => cells[`${seat}:${id}`] || null;
        const { getByTestId, rerender } = renderEvaluation({ seats: [1, 2, 3], loaded: true, getCell });
        expect(getByTestId('classroom-eval-dist-grade-A')).toHaveTextContent('1');
        expect(getByTestId('classroom-eval-dist-grade-B')).toHaveTextContent('1');
        expect(getByTestId('classroom-eval-dist-sa')).toHaveTextContent('S+A 1 (50%)');
        expect(getByTestId('classroom-eval-dist-sa')).toHaveAttribute('data-ok', 'false');
        expect(getByTestId('classroom-eval-dist-s')).toHaveTextContent('S 0 (0%)');
        expect(getByTestId('classroom-eval-dist-s')).toHaveAttribute('data-ok', 'false');
        expect(getByTestId('classroom-eval-dist-base')).toHaveTextContent('Of 2 graded (1 not submitted');
        // 評価が変わると更新される
        cells['1:c1'] = { submitted: true, grade: 'S' };
        cells['2:c1'] = { submitted: true, grade: 'A' };
        cells['3:c1'] = { submitted: true, grade: 'A' };
        cells['4:c1'] = { submitted: true, grade: 'A' };
        rerender(
            evaluationElement({ seats: [1, 2, 3, 4], loaded: true, getCell: (seat, id) => cells[`${seat}:${id}`] }),
        );
        expect(getByTestId('classroom-eval-dist-sa')).toHaveTextContent('S+A 4 (100%)');
        expect(getByTestId('classroom-eval-dist-sa')).toHaveAttribute('data-ok', 'true');
        expect(getByTestId('classroom-eval-dist-s')).toHaveTextContent('S 1 (25%)');
        expect(getByTestId('classroom-eval-dist-s')).toHaveAttribute('data-ok', 'true');
        expect(getByTestId('classroom-eval-dist-base')).toHaveTextContent('Of 4 graded');
    });
});

describe('［生徒］のスターターから足した台本 (#2424)', () => {
    test('足した台本とまとまりを出し、何も足していなければそう書く', () => {
        const cells = {
            '1:c1': {
                submitted: true,
                grade: 'A',
                added: ['緑の旗が押されたとき\nLED を点ける'],
                groupName: 'LED だけ',
            },
            '2:c1': { submitted: true, grade: 'C', added: [], groupName: 'スターターのまま' },
        };
        const { getByTestId } = renderEvaluation({
            seats: [1, 2],
            getCell: (seat, id) => cells[`${seat}:${id}`] || null,
            innerTab: 'student',
            onSetInnerTab: jest.fn(),
        });
        expect(getByTestId('classroom-eval-added')).toHaveTextContent('LED を点ける');
        expect(getByTestId('classroom-eval-group')).toHaveTextContent('Group: LED だけ');
        fireEvent.click(getByTestId('classroom-eval-cell-button-2-c1'));
        expect(getByTestId('classroom-eval-added')).toHaveTextContent('Nothing that runs was added');
    });
});

describe('［形］のタブ（形の札でまとめて採点）', () => {
    const SWITCH = { tags: ['明るさで LED を切りかえ', 'しきい値 300'], key: '明るさで LED を切りかえ' };
    const SWITCH2 = { tags: ['明るさで LED を切りかえ', 'しきい値 415'], key: '明るさで LED を切りかえ' };
    const BLINK = { tags: ['LED', 'センサーを使わない'], key: 'LED / センサーを使わない' };
    const cells = {
        '1:c1': { submitted: true, grade: 'A', shape: SWITCH, added: ['ずっと'] },
        '2:c1': { submitted: true, grade: 'B', shape: SWITCH2, added: ['ずっと'] },
        '3:c1': { submitted: true, grade: 'B', shape: BLINK, added: [] },
        '4:c1': { submitted: false },
    };
    const getCell = (seat, id) => cells[`${seat}:${id}`] || null;
    const seats = [1, 2, 3, 4];
    const shapeTab = (extra = {}) => ({
        seats,
        getCell,
        innerTab: 'shape',
        onSetInnerTab: jest.fn(),
        onSetSeatsGrade: jest.fn(),
        ...extra,
    });

    test('works of the same tags are one shape, largest first; a split grade is marked', () => {
        const { getByTestId, queryByTestId } = renderEvaluation(shapeTab());
        expect(getByTestId('classroom-eval-tab-shape')).toHaveAttribute('aria-selected', 'true');
        const first = getByTestId('classroom-eval-shape-0');
        // しきい値の数がちがうだけなら同じ形。数は札から外す
        expect(first).toHaveTextContent('明るさで LED を切りかえ');
        // 開くと作品ごとの札（数を含む）が出るので、見出しの行だけを見る
        expect(first.firstChild).not.toHaveTextContent('しきい値');
        expect(first).toHaveTextContent('2 works (01・02)');
        expect(getByTestId('classroom-eval-shape-mixed-0')).toBeInTheDocument();
        expect(queryByTestId('classroom-eval-shape-mixed-1')).toBeNull();
        // 評価が分かれているときは、選ぶまで押せない
        expect(getByTestId('classroom-eval-shape-apply-0')).toBeDisabled();
    });

    test('giving a grade to a shape passes every seat of it', () => {
        const props = shapeTab();
        const { getByTestId } = renderEvaluation(props);
        fireEvent.change(getByTestId('classroom-eval-shape-grade-0'), { target: { value: 'A' } });
        fireEvent.click(getByTestId('classroom-eval-shape-apply-0'));
        expect(props.onSetSeatsGrade).toHaveBeenCalledWith([1, 2], 'c1', 'A');
    });

    test('a work in a shape opens in the［生徒］tab', () => {
        const props = shapeTab();
        const { getByTestId } = renderEvaluation(props);
        fireEvent.click(getByTestId('classroom-eval-shape-work-2'));
        expect(props.onSetInnerTab).toHaveBeenCalledWith('student');
    });

    test('the［生徒］tab shows the tags and the other works of the same shape', () => {
        const { getByTestId } = renderEvaluation(shapeTab({ innerTab: 'student' }));
        expect(getByTestId('classroom-eval-shape-tags')).toHaveTextContent('しきい値 300');
        expect(getByTestId('classroom-eval-same-shape-2')).toHaveTextContent('02 B');
    });

    test('without the handler there is no［形］tab', () => {
        const { queryByTestId } = renderEvaluation({ seats, getCell });
        expect(queryByTestId('classroom-eval-tab-shape')).toBeNull();
    });
});

describe('今日の AI の残り (#2448)', () => {
    test('残りの回数を小さく出す。読めないときは出さない', () => {
        const { getByTestId, queryByTestId, rerender } = renderEvaluation({
            aiQuota: { used: 30, limit: 200, resetsAt: 'r' },
        });
        expect(getByTestId('classroom-eval-ai-quota')).toHaveTextContent("Today's AI left: 170 / 200");
        expect(getByTestId('classroom-eval-ai-quota')).toHaveAttribute('data-low', 'false');
        rerender(evaluationElement({ aiQuota: null }));
        expect(queryByTestId('classroom-eval-ai-quota')).toBeNull();
        rerender(evaluationElement({ aiQuota: { used: 1 } }));
        expect(queryByTestId('classroom-eval-ai-quota')).toBeNull();
    });

    test('20 回以下は注意の色、0 回は日付が変わると使えると添える', () => {
        const { getByTestId, rerender } = renderEvaluation({ aiQuota: { used: 180, limit: 200 } });
        expect(getByTestId('classroom-eval-ai-quota')).toHaveAttribute('data-low', 'true');
        expect(getByTestId('classroom-eval-ai-quota')).not.toHaveTextContent('midnight');
        rerender(evaluationElement({ aiQuota: { used: 200, limit: 200 } }));
        expect(getByTestId('classroom-eval-ai-quota')).toHaveTextContent(
            "Today's AI left: 0 / 200 You can use it again when the date changes (midnight).",
        );
    });
});

describe('［形］のタブを基準づくりの流れに組み込む (#2522)', () => {
    const shapedCell = { submitted: true, grade: 'A', shape: { key: 'k1', tags: ['サーボ'] } };
    const rubricTools = {
        answers: {},
        copyClasses: [],
        description: null,
        examples: [],
        fairness: null,
        groups: [],
        levels: [{ grade: 'B', text: 'サーボを動かす' }],
        loaded: true,
        proposals: {},
        representatives: [],
        running: null,
        savedAt: null,
        savedRubric: null,
        starter: { status: 'ready' },
        works: [],
        loadStarter: jest.fn(),
        handleSaveRubric: jest.fn(() => Promise.resolve(true)),
        handleSetLevel: jest.fn(),
    };
    const LESSON = [{ classroomId: 'c1', assignmentName: '迷路', assignmentText: 'サーボを動かす' }];
    const saveRubric = async (getByTestId) => {
        fireEvent.click(getByTestId('grading-rubric-steps-head-sentences'));
        await act(async () => {
            fireEvent.click(getByTestId('grading-rubric-save'));
        });
    };

    test('［形］のタブの冒頭に、できることと先生がやるとよいことの説明がある', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            loaded: true,
            getCell: () => shapedCell,
            onSetSeatsGrade: jest.fn(),
        });
        fireEvent.click(getByTestId('classroom-eval-tab-shape'));
        expect(getByTestId('classroom-eval-shapes-lead')).toHaveTextContent('grouped by their shape');
        expect(getByTestId('classroom-eval-shapes-todo')).toHaveTextContent('check');
    });

    test('基準を保存したら［形］のタブへ移り、移った理由の一言を出す', async () => {
        const { getByTestId, queryByTestId } = renderEvaluation({
            evalLessons: LESSON,
            seats: [1],
            loaded: true,
            getCell: () => shapedCell,
            rubricTools,
            onSetSeatsGrade: jest.fn(),
        });
        await saveRubric(getByTestId);
        expect(getByTestId('classroom-eval-tab-shape')).toHaveAttribute('aria-selected', 'true');
        expect(getByTestId('classroom-eval-shapes-arrived')).toHaveTextContent('rubric is ready');
        // ほかのタブへ移ると一言は消える（戻っても出ない）
        fireEvent.click(getByTestId('classroom-eval-tab-student'));
        fireEvent.click(getByTestId('classroom-eval-tab-shape'));
        expect(queryByTestId('classroom-eval-shapes-arrived')).toBeNull();
    });

    test('まだ採点していないときの一言は、［全員を採点］のあとに確かめるよう伝える', async () => {
        const { getByTestId } = renderEvaluation({
            evalLessons: LESSON,
            seats: [1],
            loaded: true,
            getCell: () => ({ ...shapedCell, grade: null }),
            rubricTools,
            onSetSeatsGrade: jest.fn(),
        });
        await saveRubric(getByTestId);
        expect(getByTestId('classroom-eval-shapes-arrived')).toHaveTextContent('After [Grade Everyone]');
    });

    test('ほかの課題へ移って戻ると、一言は出ない', async () => {
        const lessons = [...LESSON, { classroomId: 'c2', assignmentName: '信号', assignmentText: 'LED を光らせる' }];
        const props = {
            evalLessons: lessons,
            seats: [1],
            loaded: true,
            getCell: () => shapedCell,
            rubricTools,
            onSetSeatsGrade: jest.fn(),
        };
        const { getByTestId, queryByTestId, rerender } = renderEvaluation(props);
        await saveRubric(getByTestId);
        expect(getByTestId('classroom-eval-shapes-arrived')).toBeInTheDocument();
        rerender(evaluationElement({ ...props, currentId: 'c2' }));
        expect(queryByTestId('classroom-eval-shapes-arrived')).toBeNull();
        rerender(evaluationElement({ ...props, currentId: 'c1' }));
        expect(queryByTestId('classroom-eval-shapes-arrived')).toBeNull();
    });

    test('形の札のある作品が無いときは［基準］のまま', async () => {
        const { getByTestId } = renderEvaluation({
            evalLessons: LESSON,
            seats: [1],
            loaded: true,
            getCell: () => ({ submitted: true, grade: 'A' }),
            rubricTools,
            onSetSeatsGrade: jest.fn(),
        });
        await saveRubric(getByTestId);
        expect(getByTestId('classroom-eval-tab-rubric')).toHaveAttribute('aria-selected', 'true');
    });
});
