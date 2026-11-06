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
