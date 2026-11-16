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
import TeacherClassTabs from '../../../src/components/classroom-modal/teacher-class-tabs.jsx';
import TeacherEvaluation, {
    currentEvalStep,
    neighbourSeats,
    pickDetailCell,
} from '../../../src/components/classroom-modal/teacher-evaluation.jsx';
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

describe('採点簿の表と右の詳細 (#1962・R1)', () => {
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

    test('表は点だけ: セルに入力欄を置かず、点（無ければ —）のボタンを出す', () => {
        const { getByTestId } = renderEvaluation({ seats, getCell });
        const cell = getByTestId('classroom-eval-cell-1-c1');
        expect(cell.querySelector('select, input, textarea')).toBeNull();
        expect(getByTestId('classroom-eval-cell-button-1-c1')).toHaveTextContent('A');
        expect(getByTestId('classroom-eval-cell-button-1-c1').getAttribute('aria-label')).toBe('Seat 1, 迷路: A');
        expect(getByTestId('classroom-eval-cell-button-3-c1')).toHaveTextContent('—');
        // 点が無いセルは「—」と読まず「未採点」。印（!）の意味も言葉で
        expect(getByTestId('classroom-eval-cell-button-3-c1').getAttribute('aria-label')).toBe(
            'Seat 3, 迷路: Not graded (Needs check)',
        );
        expect(getByTestId('classroom-eval-cell-button-4-c1').getAttribute('aria-label')).toBe(
            'Seat 4, 迷路: B (Returned)',
        );
        expect(getByTestId('classroom-eval-cell-2-c1')).toHaveTextContent('×');
    });

    test('読み込んだら最初に提出した席を右に出す。欄には見えるラベルがあり、プレースホルダーを使わない', () => {
        const { getByTestId, getByLabelText } = renderEvaluation({ seats, getCell });
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
        const { getByTestId } = renderEvaluation({ seats, getCell });
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
            'Seat 1, 迷路: A (Comment written)',
        );
        expect(getByTestId('classroom-eval-cell-button-4-c1')).not.toHaveTextContent('💬');
        fireEvent.click(getByTestId('classroom-eval-cell-button-3-c1'));
        expect(getByTestId('classroom-eval-detail')).toHaveTextContent('Needs check');
        expect(getByTestId('classroom-eval-comment-3-c1').value).toBe('');
    });

    test('提出が 1 つも無いときは、右の列にそう書く', () => {
        const { getByTestId } = renderEvaluation({ seats: [2], getCell });
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
            const { handlers } = renderEvaluation({ onRequestLeave });
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
            'The AI is still working. Leaving stops it. Grades you have not exported and comments you have not returned will be lost. ' +
                'Leave this screen?',
        ],
        [
            { grades: false, comments: false },
            { label: 'AI', done: 0, total: 1 },
            'back',
            'The AI is still working. Leaving stops it. Go back?',
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

describe('右の列の［作品を開く］(#1980)', () => {
    const cells = {
        '1:c1': { submissionId: 's1', submitted: true, grade: 'A', projectUrl: 'https://example.invalid/1.sb3' },
        '3:c1': { submissionId: 's3', submitted: true, grade: null, projectUrl: 'https://example.invalid/3.sb3' },
    };
    const getCell = (seat, id) => cells[`${seat}:${id}`] || null;
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('開く処理が無ければボタンを出さない', () => {
        renderEvaluation({ seats: [1, 3], getCell });
        expect(byTestId('classroom-eval-detail-open-work')).toBeNull();
    });

    test('課題名の横に出し、押すと確かめずに選んだ席と課題を渡す（採点の画面は残るので・#1990）', () => {
        const onOpenWork = jest.fn();
        const onRequestLeave = jest.fn((action) => action());
        renderEvaluation({ seats: [1, 3], getCell, onOpenWork, onRequestLeave });
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
        });
        const button = document.querySelector('[data-testid="classroom-eval-detail-open-work"]');
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('Opening…');
    });
});
