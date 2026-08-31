/* eslint-env jest */
/**
 * クラス管理サブ画面の共通レイアウト / 共通ボタン (#1125)。
 *
 * 「新しい画面はこれをベースに作ればスタイルがそろう」を守るため、スロット
 * (パンくず・タイトル・説明・エラー・本文・フッター) の描画順と、共通ボタンの
 * variant → クラスの対応を pin する。順序が崩れると画面ごとにレイアウトが
 * ばらける (#1121 / #1122 の再発) ので、DOM 順そのものをテストする。
 *
 * CSS Modules は jest では空オブジェクト (styleMock) なので、実際の class 文字列は
 * 検証できない。代わりに variant → styles のキー対応をデータとして export し、
 * それを pin する。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import ClassroomButton, {
    BUTTON_VARIANT_STYLE_KEYS,
} from '../../../src/components/classroom-modal/classroom-button.jsx';
import TeacherAssignmentBoard from '../../../src/components/classroom-modal/teacher-assignment-board.jsx';
import TeacherEvaluation from '../../../src/components/classroom-modal/teacher-evaluation.jsx';
import { TeacherScreen, TeacherSubView } from '../../../src/components/classroom-modal/teacher-view-layout.jsx';

describe('TeacherScreen (#1125)', () => {
    const renderScreen = (props) =>
        render(
            <TeacherScreen testId="classroom-phase-x" title="タイトル" {...props}>
                <p data-testid="body">{'本文'}</p>
            </TeacherScreen>,
        );

    test('renders breadcrumbs, title, hint, error, body and footer in this order', () => {
        const { getByTestId } = renderScreen({
            breadcrumbs: [{ label: 'クラス一覧', onClick: jest.fn(), testId: 'crumb-list' }, { label: '評価' }],
            error: 'こわれました',
            footer: <button data-testid="footer-button">{'もどる'}</button>,
            hint: 'せつめい',
        });
        const root = getByTestId('classroom-phase-x');
        expect(Array.from(root.children).map((el) => el.tagName.toLowerCase())).toEqual([
            'nav',
            'h2',
            'p',
            'div',
            'p',
            'div',
        ]);
        expect(root).toHaveTextContent('タイトル');
        expect(root).toHaveTextContent('せつめい');
        expect(getByTestId('classroom-error')).toHaveTextContent('こわれました');
        expect(getByTestId('crumb-list')).toBeInTheDocument();
        expect(getByTestId('footer-button')).toBeInTheDocument();
    });

    test('omits optional slots entirely when not given', () => {
        const { getByTestId, queryByTestId } = renderScreen();
        const root = getByTestId('classroom-phase-x');
        expect(Array.from(root.children).map((el) => el.tagName.toLowerCase())).toEqual(['h2', 'p']);
        expect(queryByTestId('classroom-breadcrumbs')).not.toBeInTheDocument();
        expect(queryByTestId('classroom-error')).not.toBeInTheDocument();
    });

    test('lets a panel screen replace the default wrapper class', () => {
        const { getByTestId } = render(
            <TeacherScreen className="class-list" testId="classroom-phase-y" title="t">
                {null}
            </TeacherScreen>,
        );
        expect(getByTestId('classroom-phase-y')).toHaveClass('class-list');
    });
});

describe('TeacherSubView (#1125)', () => {
    test('renders the sub view container with title, hint, body and footer', () => {
        const { getByTestId } = render(
            <TeacherSubView
                footer={<button data-testid="sub-footer-button">{'キャンセル'}</button>}
                hint="サブ画面のせつめい"
                testId="classroom-sub"
                title="サブ画面"
            >
                <p data-testid="sub-body">{'本文'}</p>
            </TeacherSubView>,
        );
        const root = getByTestId('classroom-sub');
        expect(root.tagName.toLowerCase()).toBe('div');
        expect(Array.from(root.children).map((el) => el.tagName.toLowerCase())).toEqual(['div', 'p', 'p', 'div']);
        expect(getByTestId('sub-body')).toBeInTheDocument();
        expect(getByTestId('sub-footer-button')).toBeInTheDocument();
    });

    test('renders as a form and forwards onSubmit when as="form"', () => {
        const onSubmit = jest.fn((e) => e.preventDefault());
        const { getByTestId } = render(
            <TeacherSubView as="form" testId="classroom-sub-form" title="サブ画面" onSubmit={onSubmit}>
                <button data-testid="submit" type="submit">
                    {'つくる'}
                </button>
            </TeacherSubView>,
        );
        const root = getByTestId('classroom-sub-form');
        expect(root.tagName.toLowerCase()).toBe('form');
        fireEvent.click(getByTestId('submit'));
        expect(onSubmit).toHaveBeenCalled();
    });
});

describe('ClassroomButton (#1125)', () => {
    test('maps every variant to a shared button style key', () => {
        expect(BUTTON_VARIANT_STYLE_KEYS).toEqual({
            danger: 'dangerButton',
            primary: 'primaryButton',
            secondary: 'secondaryButton',
        });
    });

    test('defaults to type=button so it never submits a form by accident', () => {
        const { getByTestId } = render(<ClassroomButton dataTestId="b">{'x'}</ClassroomButton>);
        expect(getByTestId('b')).toHaveAttribute('type', 'button');
        expect(getByTestId('b')).toHaveTextContent('x');
    });

    test('forwards click, disabled and extra class names', () => {
        const onClick = jest.fn();
        const { getByTestId } = render(
            <div>
                <ClassroomButton className="eval-cancel" dataTestId="b" onClick={onClick}>
                    {'x'}
                </ClassroomButton>
                <ClassroomButton dataTestId="b-disabled" disabled onClick={onClick}>
                    {'y'}
                </ClassroomButton>
            </div>,
        );
        expect(getByTestId('b')).toHaveClass('eval-cancel');
        fireEvent.click(getByTestId('b'));
        fireEvent.click(getByTestId('b-disabled'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});

/**
 * 共通レイアウトに載せ替えた画面が、以前と同じ data-testid のまま描画できること。
 * (課題ボードと評価画面はこれまで unit テストが無かったので、載せ替えの足場として置く)
 */
describe('screens built on the shared layout (#1125)', () => {
    const wrap = (el) => render(<IntlProvider locale="en">{el}</IntlProvider>);

    test('the assignment board keeps its testid and breadcrumbs', () => {
        const { getByTestId } = wrap(
            <TeacherAssignmentBoard
                classrooms={[]}
                group={{ groupId: 'g1', name: 'A', year: 2026 }}
                onCreateAssignmentInClass={jest.fn()}
                onReuseAssignment={jest.fn()}
                onSelectClassroom={jest.fn()}
                onShowClassList={jest.fn()}
                onUpdateAssignmentMeta={jest.fn()}
                onUpdateGroupTopics={jest.fn()}
            />,
        );
        expect(getByTestId('classroom-board')).toBeInTheDocument();
        expect(getByTestId('classroom-breadcrumbs')).toBeInTheDocument();
    });

    test('the evaluation screen keeps its testid and footer buttons', () => {
        const { getByTestId } = wrap(
            <TeacherEvaluation
                comments={{}}
                evalLessons={[]}
                getCell={() => null}
                rubricAxes={[]}
                seats={[]}
                selectedLessonIds={[]}
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
            />,
        );
        expect(getByTestId('classroom-phase-teacher-evaluation')).toBeInTheDocument();
        expect(getByTestId('classroom-evaluation-cancel')).toBeInTheDocument();
        expect(getByTestId('classroom-eval-run-grade')).toBeInTheDocument();
    });
});
