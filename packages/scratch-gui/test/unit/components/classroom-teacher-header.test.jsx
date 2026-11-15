/* eslint-env jest */
/**
 * クラス管理の骨組み (#1958 / EPIC #1956 Q2・Q3):
 * - 紫のヘッダーに「← エディタに戻る｜クラス管理 › クラス名 › 課題名」。画面ごとのパンくずは
 *   ポータルでヘッダーへ運ばれる。
 * - クラスの中のタブ「ストリーム / 授業 / 採点」。採点の画面からほかのタブへ移るときは、
 *   書き出していない採点の確認 (#1948) を通る。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherBreadcrumbs, {
    BreadcrumbSlotContext,
} from '../../../src/components/classroom-modal/teacher-breadcrumbs.jsx';
import TeacherClassTabs from '../../../src/components/classroom-modal/teacher-class-tabs.jsx';
import ClassroomTeacherModal from '../../../src/components/classroom-teacher-modal/classroom-teacher-modal.jsx';

jest.mock('../../../src/containers/modal.jsx', () => ({
    __esModule: true,
    default: ({ children }) => <div data-testid="mock-modal">{children}</div>,
}));

let mockEvaluationProps = null;
jest.mock('../../../src/components/classroom-modal/teacher-evaluation.jsx', () => ({
    __esModule: true,
    default: (props) => {
        mockEvaluationProps = props;
        return <div data-testid="mock-evaluation">{props.tabs}</div>;
    },
}));

jest.mock('../../../src/components/classroom-modal/teacher-class-detail.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid="mock-detail" />,
}));

jest.mock('../../../src/components/classroom-teacher-modal/teacher-login-phase.jsx', () => ({
    __esModule: true,
    default: () => <div data-testid="mock-login" />,
}));

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const group = { groupId: 'g1', name: '技術', year: 2026, topics: [] };

const renderModal = (containerProps, onClose = jest.fn()) => {
    render(
        <IntlProvider locale="en">
            <ClassroomTeacherModal
                containerProps={{
                    classrooms: [],
                    groups: [group],
                    members: [],
                    onSelectGroup: jest.fn(),
                    onShowClassList: jest.fn(),
                    onBackToDashboard: jest.fn(),
                    ...containerProps,
                }}
                onClose={onClose}
            />
        </IntlProvider>,
    );
    return onClose;
};

describe('TeacherBreadcrumbs', () => {
    test('draws in place without a header', () => {
        render(<TeacherBreadcrumbs items={[{ label: 'A', onClick: jest.fn(), testId: 'a' }, { label: 'B' }]} />);
        expect(byTestId('classroom-breadcrumbs').textContent).toBe('A›B');
        expect(byTestId('a').tagName).toBe('BUTTON');
    });

    test('is carried into the header slot', () => {
        const slot = document.createElement('div');
        document.body.appendChild(slot);
        render(
            <div data-testid="screen">
                <BreadcrumbSlotContext.Provider value={slot}>
                    <TeacherBreadcrumbs items={[{ label: 'A' }]} />
                </BreadcrumbSlotContext.Provider>
            </div>,
        );
        expect(slot.textContent).toBe('A');
        expect(byTestId('screen').textContent).toBe('');
        slot.remove();
    });

    test('draws nothing until the header is mounted', () => {
        render(
            <BreadcrumbSlotContext.Provider value={null}>
                <TeacherBreadcrumbs items={[{ label: 'A' }]} />
            </BreadcrumbSlotContext.Provider>,
        );
        expect(byTestId('classroom-breadcrumbs')).not.toBeInTheDocument();
    });
});

describe('TeacherClassTabs', () => {
    const renderTabs = (props) =>
        render(
            <IntlProvider locale="en">
                <TeacherClassTabs selected="stream" onSelect={jest.fn()} {...props} />
            </IntlProvider>,
        );

    test('three tabs, the selected one marked', () => {
        renderTabs({ selected: 'grading' });
        expect(byTestId('classroom-board-tab-stream')).toHaveAttribute('aria-selected', 'false');
        expect(byTestId('classroom-board-tab-classwork')).toHaveAttribute('aria-selected', 'false');
        expect(byTestId('classroom-board-tab-grading')).toHaveAttribute('aria-selected', 'true');
    });

    test('choosing another tab reports it; the selected one does nothing', () => {
        const onSelect = jest.fn();
        renderTabs({ onSelect });
        fireEvent.click(byTestId('classroom-board-tab-stream'));
        expect(onSelect).not.toHaveBeenCalled();
        fireEvent.click(byTestId('classroom-board-tab-grading'));
        expect(onSelect).toHaveBeenCalledWith('grading');
    });

    test('［⚙ クラスの設定］ only with a handler', () => {
        const onOpenSettings = jest.fn();
        renderTabs({ onOpenSettings });
        fireEvent.click(byTestId('classroom-board-class-settings'));
        expect(onOpenSettings).toHaveBeenCalled();
    });

    test('no settings button without a handler', () => {
        renderTabs();
        expect(byTestId('classroom-board-class-settings')).not.toBeInTheDocument();
    });
});

describe('ClassroomTeacherModal — the header (#1956 Q2)', () => {
    test('「エディタに戻る」 closes the modal (the container asks first on the grading screen)', () => {
        const onClose = renderModal({ phase: 'teacher-login' });
        fireEvent.click(byTestId('classroom-teacher-back-to-editor'));
        expect(onClose).toHaveBeenCalled();
    });

    test('the assignment detail shows 「クラス管理 › クラス名 › 課題名」 in the header', () => {
        const onShowClassList = jest.fn();
        const onBackToDashboard = jest.fn();
        renderModal({
            phase: 'teacher-class-detail',
            selectedGroup: group,
            selectedClassroom: { classroomId: 'c1', groupId: 'g1', assignmentName: 'ねこを動かそう' },
            onShowClassList,
            onBackToDashboard,
        });
        const header = byTestId('classroom-teacher-header');
        expect(header).toContainElement(byTestId('classroom-breadcrumbs'));
        expect(byTestId('classroom-breadcrumbs').textContent).toBe('Class Management›技術 2026年度›ねこを動かそう');
        expect(byTestId('classroom-breadcrumb-assignment-name')).toHaveAttribute('aria-current', 'page');
        fireEvent.click(byTestId('classroom-breadcrumb-assignments'));
        expect(onBackToDashboard).toHaveBeenCalled();
        fireEvent.click(byTestId('classroom-breadcrumb-class-list'));
        expect(onShowClassList).toHaveBeenCalled();
    });
});

describe('ClassroomTeacherModal — the grading tab (#1956 Q3・#1948)', () => {
    const makeEvaluation = () => ({
        evalGroup: group,
        handleRequestLeave: jest.fn(),
        handleBackFromEvaluation: jest.fn(),
    });

    test('［採点］ is selected on the grading screen', () => {
        renderModal({ phase: 'teacher-evaluation', evaluation: makeEvaluation() });
        expect(byTestId('classroom-board-tab-grading')).toHaveAttribute('aria-selected', 'true');
    });

    test('another tab asks first, then opens the class on that tab', () => {
        const evaluation = makeEvaluation();
        const onSelectGroup = jest.fn();
        renderModal({ phase: 'teacher-evaluation', evaluation, onSelectGroup });
        fireEvent.click(byTestId('classroom-board-tab-classwork'));
        expect(evaluation.handleRequestLeave).toHaveBeenCalledWith(expect.any(Function), 'leave');
        expect(onSelectGroup).not.toHaveBeenCalled();
        // The teacher answered「離れる」 (or nothing was lost): the action runs.
        evaluation.handleRequestLeave.mock.calls[0][0]();
        expect(evaluation.handleBackFromEvaluation).toHaveBeenCalled();
        expect(onSelectGroup).toHaveBeenCalledWith(group);
    });

    test('the cancel goes back to the class when it was opened from the class', () => {
        const evaluation = makeEvaluation();
        const onSelectGroup = jest.fn();
        renderModal({ phase: 'teacher-evaluation', evaluation, onSelectGroup, selectedGroup: group });
        mockEvaluationProps.onBack();
        expect(evaluation.handleBackFromEvaluation).toHaveBeenCalled();
        expect(onSelectGroup).toHaveBeenCalledWith(group);
    });

    test('opened from a class card, the cancel goes back to the cards', () => {
        const evaluation = makeEvaluation();
        const onSelectGroup = jest.fn();
        renderModal({ phase: 'teacher-evaluation', evaluation, onSelectGroup, selectedGroup: null });
        mockEvaluationProps.onBack();
        expect(evaluation.handleBackFromEvaluation).toHaveBeenCalled();
        expect(onSelectGroup).not.toHaveBeenCalled();
    });

    test('「クラス管理」 leaves the grading screen for the class list', () => {
        const evaluation = makeEvaluation();
        const onShowClassList = jest.fn();
        renderModal({ phase: 'teacher-evaluation', evaluation, onShowClassList });
        mockEvaluationProps.onShowClassList();
        expect(evaluation.handleBackFromEvaluation).toHaveBeenCalled();
        expect(onShowClassList).toHaveBeenCalled();
    });
});
