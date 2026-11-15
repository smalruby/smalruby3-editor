/* eslint-env jest */
/**
 * 採点の画面 (#1304 / EPIC #1296 の V1・V2)。
 *
 * - V1: 「1 提出を読み込む → 2 AIで採点 → 3 コメントを下書き → 4 コメントを返却」の手順にし、
 *   いま押すボタンだけを主ボタンにする (aria-current="step" で pin する。CSS Modules は jest では
 *   空なので class は見られない)。CSV 2 つは「書き出し ▾」にまとめる。
 * - V2: 冒頭の説明は 1 行にし、残りは「詳しく」で開く。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherEvaluation, { currentEvalStep } from '../../../src/components/classroom-modal/teacher-evaluation.jsx';
import { COURSES } from '../../../src/lib/lessons/courses.js';

const LESSONS = [{ classroomId: 'c1', assignmentName: '迷路' }];

const renderEvaluation = (props = {}) => {
    const handlers = {
        onBack: jest.fn(),
        onChangeRubricAxis: jest.fn(),
        onExportAuditCsv: jest.fn(),
        onExportEvaluationCsv: jest.fn(),
        onLoadSubmissions: jest.fn(),
        onReturnComments: jest.fn(),
        onRunAi: jest.fn(),
        onSetCellGrade: jest.fn(),
        onSetCellReason: jest.fn(),
        onSetComment: jest.fn(),
        onSetStrictness: jest.fn(),
        onToggleLesson: jest.fn(),
    };
    const utils = render(
        <IntlProvider locale="en">
            <TeacherEvaluation
                comments={{}}
                evalLessons={LESSONS}
                getCell={() => null}
                rubricAxes={[]}
                seats={[]}
                selectedLessonIds={['c1']}
                strictness="standard"
                {...handlers}
                {...props}
            />
        </IntlProvider>,
    );
    return { ...utils, handlers };
};

const STEP_IDS = [
    'classroom-eval-load',
    'classroom-eval-run-grade',
    'classroom-eval-run-comment',
    'classroom-eval-return-comments',
];

const currentStepIds = (getByTestId) =>
    STEP_IDS.filter((id) => getByTestId(id).getAttribute('aria-current') === 'step');

describe('currentEvalStep', () => {
    test('walks load → grade → comment → return', () => {
        expect(currentEvalStep({ loaded: false, hasGrades: false, hasComments: false })).toBe('load');
        expect(currentEvalStep({ loaded: true, hasGrades: false, hasComments: false })).toBe('grade');
        expect(currentEvalStep({ loaded: true, hasGrades: true, hasComments: false })).toBe('comment');
        expect(currentEvalStep({ loaded: true, hasGrades: true, hasComments: true })).toBe('return');
    });

    test('drafted comments move to the return step even without grades', () => {
        expect(currentEvalStep({ loaded: true, hasGrades: false, hasComments: true })).toBe('return');
    });

    test('nothing to load means the load step stays current', () => {
        expect(currentEvalStep({ loaded: false, hasGrades: true, hasComments: true })).toBe('load');
    });
});

describe('TeacherEvaluation steps (V1)', () => {
    test('the four step buttons are in the footer in order, with the load step current first', () => {
        const { getByTestId } = renderEvaluation();
        const footerButtons = [...getByTestId('classroom-eval-steps').querySelectorAll('button')].map((b) =>
            b.getAttribute('data-testid'),
        );
        expect(footerButtons).toEqual(STEP_IDS);
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-load']);
        expect(getByTestId('classroom-eval-load')).toBeEnabled();
        expect(getByTestId('classroom-eval-run-grade')).toBeDisabled();
    });

    test('after loading, AI grading is the current step', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: null }),
        });
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-run-grade']);
        expect(getByTestId('classroom-eval-run-comment')).toBeEnabled();
    });

    test('after grading, drafting comments is the current step', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
        });
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-run-comment']);
    });

    test('after drafting comments, returning is the current step', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
            comments: { '1:c1': 'よくできました' },
        });
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-return-comments']);
    });

    test('blank comment drafts do not count as drafted', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
            comments: { '1:c1': '   ' },
        });
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-run-comment']);
    });

    test('drafts left over from a previous load (other seats / unselected lessons) do not count', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: 'A' }),
            comments: { '2:c1': 'よくできました', '1:c9': 'よくできました' },
        });
        expect(currentStepIds(getByTestId)).toEqual(['classroom-eval-run-comment']);
    });

    test('the load step needs at least one selected assignment', () => {
        const { getByTestId } = renderEvaluation({ selectedLessonIds: [] });
        expect(getByTestId('classroom-eval-load')).toBeDisabled();
    });

    test('every step is disabled while busy', () => {
        const { getByTestId } = renderEvaluation({
            seats: [1],
            getCell: () => ({ submitted: true, grade: null }),
            evalProgress: { label: 'x', done: 0, total: 1 },
        });
        for (const id of STEP_IDS) expect(getByTestId(id)).toBeDisabled();
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
});

describe('TeacherEvaluation grading settings (R3 / R6)', () => {
    const AXES = [
        { name: '動くこと', description: 'a' },
        { name: '工夫', description: 'b' },
    ];

    test('shows the current criteria and strictness on one line, closed by default', () => {
        const { getByTestId, queryByTestId } = renderEvaluation({ rubricAxes: AXES, strictness: 'strict' });
        const summary = getByTestId('classroom-eval-settings-summary');
        expect(summary).toHaveTextContent('動くこと・工夫');
        expect(summary).toHaveTextContent('Strict');
        expect(queryByTestId('classroom-eval-settings')).toBeNull();
        expect(queryByTestId('classroom-eval-axis-name-0')).toBeNull();
    });

    test('"Change" opens the fields with visible headers; editing calls the handlers', () => {
        const { getByTestId, handlers } = renderEvaluation({ rubricAxes: AXES });
        const toggle = getByTestId('classroom-eval-settings-toggle');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(getByTestId('classroom-eval-settings')).toHaveTextContent('Criterion');
        expect(getByTestId('classroom-eval-settings')).toHaveTextContent('What it looks for');

        fireEvent.change(getByTestId('classroom-eval-axis-name-1'), { target: { value: 'アイデア' } });
        expect(handlers.onChangeRubricAxis).toHaveBeenCalledWith(1, 'name', 'アイデア');
        fireEvent.change(getByTestId('classroom-eval-strictness'), { target: { value: 'lenient' } });
        expect(handlers.onSetStrictness).toHaveBeenCalledWith('lenient');
    });
});

describe('レッスンの点の列（#1603）', () => {
    test('作品の列の横に「Lesson」の列を出し、記録の無い席は —', () => {
        const lessons = [{ classroomId: 'c1', assignmentName: '迷路', hasLesson: true }];
        const { getByTestId } = renderEvaluation({
            evalLessons: lessons,
            seats: [1, 2],
            lessonScores: { c1: { total: 100, submitWork: true, scores: { 1: 78 } } },
        });
        expect(getByTestId('classroom-eval-lesson-head-c1')).toHaveTextContent('Lesson');
        expect(getByTestId('classroom-eval-lesson-score-1-c1')).toHaveTextContent('78');
        expect(getByTestId('classroom-eval-lesson-score-2-c1')).toHaveTextContent('—');
        expect(getByTestId('classroom-eval-cell-1-c1')).toBeInTheDocument();
    });

    test('作品を出さないレッスンの課題は作品の列を出さない', () => {
        const lessons = [{ classroomId: 'c1', assignmentName: '迷路', hasLesson: true }];
        const { queryByTestId } = renderEvaluation({
            evalLessons: lessons,
            seats: [1],
            lessonScores: { c1: { total: 100, submitWork: false, scores: { 1: 100 } } },
        });
        expect(queryByTestId('classroom-eval-cell-1-c1')).toBeNull();
        expect(queryByTestId('classroom-eval-lesson-score-1-c1')).toHaveTextContent('100');
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

    test('作品を出さないレッスンの課題だけ: AI の観点・厳しさを出さず、①読み込む → ②点を確かめる → ③書き出す', () => {
        const onCheckScoring = jest.fn();
        const { getByTestId, queryByTestId } = renderEvaluation({
            evalLessons: [lessonOnly],
            selectedLessonIds: ['lo'],
            seats: [1],
            onChangeLessonScoring: jest.fn(),
            onCheckScoring,
        });
        expect(queryByTestId('classroom-eval-settings-summary')).toBeNull();
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
            selectedLessonIds: ['lo'],
            seats: [1],
            scoringChecked: true,
            onChangeLessonScoring: jest.fn(),
        });
        expect(getByTestId('classroom-eval-export-lesson')).toHaveAttribute('aria-current', 'step');
        fireEvent.click(getByTestId('classroom-eval-export-lesson'));
        expect(handlers.onExportEvaluationCsv).toHaveBeenCalled();
    });

    test('作品も提出するレッスンの課題: いまの 4 つの手順のまま・レッスンの点の欄も出す', () => {
        const { getByTestId, queryByTestId } = renderEvaluation({
            evalLessons: [withWork],
            selectedLessonIds: ['lw'],
            onChangeLessonScoring: jest.fn(),
        });
        expect(getByTestId('classroom-eval-run-grade')).toBeInTheDocument();
        expect(getByTestId('classroom-eval-settings-summary')).toBeInTheDocument();
        expect(queryByTestId('classroom-eval-mixed-note')).toBeNull();
        expect(getByTestId('classroom-eval-lesson-scoring-lw')).toBeInTheDocument();
    });

    test('混ぜて選んだ: AI の流れで、レッスンだけの課題には AI を使わないと示す', () => {
        const { getByTestId } = renderEvaluation({
            evalLessons: [withWork, lessonOnly],
            selectedLessonIds: ['lw', 'lo'],
        });
        expect(getByTestId('classroom-eval-run-grade')).toBeInTheDocument();
        expect(getByTestId('classroom-eval-mixed-note')).toHaveTextContent('AI is not used for レッスン1');
    });

    test('必須が無いときは、必須の点の欄を使わないと示す', () => {
        const { getByTestId } = renderEvaluation({
            evalLessons: [lessonOnly],
            selectedLessonIds: ['lo'],
            onChangeLessonScoring: jest.fn(),
        });
        expect(getByTestId('classroom-lesson-scoring-required-unused')).toHaveTextContent('nothing is required');
        expect(getByTestId('classroom-lesson-scoring-required')).toBeDisabled();
    });
});

describe('採点の表のラベル (#1924 C5・R1)', () => {
    const cell = { submitted: true, grade: 'A', reason: '旗で動く' };
    test('課題の列の見出しに、セルの中の 3 つの欄の名前を出す', () => {
        const { getByTestId } = renderEvaluation({ seats: [1], getCell: () => cell });
        expect(getByTestId('classroom-eval-head-fields-c1').textContent).toBe(
            'Grade / Reason (teacher only) / Comment to the student',
        );
    });

    test('セルの 3 つの欄に名前があり、プレースホルダーを名前の代わりにしない', () => {
        const { getByTestId } = renderEvaluation({ seats: [1], getCell: () => cell });
        // The seat is in the name: 40 rows have the same three fields (#1924 FYI2).
        expect(getByTestId('classroom-eval-grade-1-c1').getAttribute('aria-label')).toBe('Seat 1: Grade');
        const reason = getByTestId('classroom-eval-reason-1-c1');
        expect(reason.getAttribute('aria-label')).toBe('Seat 1: Reason (teacher only)');
        expect(reason.getAttribute('placeholder')).toBeFalsy();
        const comment = getByTestId('classroom-eval-comment-1-c1');
        expect(comment.getAttribute('aria-label')).toBe('Seat 1: Comment to the student');
        expect(comment.getAttribute('placeholder')).toBeFalsy();
    });
});

describe('採点を離れるときの確認 (#1923 C4)', () => {
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test.each(['classroom-evaluation-cancel', 'classroom-breadcrumb-class-list'])(
        '%s は requestLeave に onBack を渡す（確かめるかは container が決める）',
        (id) => {
            const onRequestLeave = jest.fn();
            const { handlers } = renderEvaluation({ onRequestLeave });
            fireEvent.click(byTestId(id));
            expect(onRequestLeave).toHaveBeenCalledWith(handlers.onBack, 'back');
        },
    );

    test('requestLeave が無ければ、そのまま戻る', () => {
        const { handlers } = renderEvaluation();
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
            'Grades you have not exported and comments you have not returned will be lost. Go back?',
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
        [{ grades: true, comments: false }, null, 'back', 'Grades you have not exported will be lost. Go back?'],
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
            'The AI is still working. Grades you have not exported and comments you have not returned will be lost. ' +
                'Leave this screen?',
        ],
        [
            { grades: false, comments: false },
            { label: 'AI', done: 0, total: 1 },
            'back',
            'The AI is still working. Go back?',
        ],
        // 読み込み直してもコメントの下書きは残るので、採点だけを言う
        [{ grades: true, comments: true }, null, 'reload', 'Grades you have not exported will be lost. Load again?'],
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
        rerender(
            <IntlProvider locale="en">
                <TeacherEvaluation
                    comments={{}}
                    evalLessons={LESSONS}
                    getCell={() => null}
                    leaveRequest={{ kind: 'reload' }}
                    rubricAxes={[]}
                    seats={[1]}
                    selectedLessonIds={['c1']}
                    strictness="standard"
                    onBack={jest.fn()}
                    onChangeRubricAxis={jest.fn()}
                    onExportAuditCsv={jest.fn()}
                    onExportEvaluationCsv={jest.fn()}
                    onLoadSubmissions={jest.fn()}
                    onReturnComments={jest.fn()}
                    onRunAi={jest.fn()}
                    onSetCellGrade={jest.fn()}
                    onSetCellReason={jest.fn()}
                    onSetComment={jest.fn()}
                    onSetStrictness={jest.fn()}
                    onToggleLesson={jest.fn()}
                />
            </IntlProvider>,
        );
        expect(byTestId('classroom-eval-leave-confirm').textContent).toBe('Load again');
    });
});
