/* eslint-env jest */
/**
 * 課題詳細の ✕ (#2089): ［授業］へ戻り、開いていた課題の行を開いたままにする。
 * パンくずの「クラス名」で戻るときは、これまでどおり行を開かない。
 */
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import ClassroomTeacherModal from '../../../src/components/classroom-teacher-modal/classroom-teacher-modal.jsx';

jest.mock('../../../src/containers/modal.jsx', () => ({
    __esModule: true,
    default: ({ children }) => <div data-testid="mock-modal">{children}</div>,
}));

let mockDetailProps = null;
jest.mock('../../../src/components/classroom-modal/teacher-class-detail.jsx', () => ({
    __esModule: true,
    default: (props) => {
        mockDetailProps = props;
        return <div data-testid="mock-detail" />;
    },
}));

let mockBoardProps = null;
jest.mock('../../../src/components/classroom-modal/teacher-assignment-board.jsx', () => ({
    __esModule: true,
    default: (props) => {
        mockBoardProps = props;
        return <div data-testid="mock-board" />;
    },
}));

const group = { groupId: 'g1', name: '技術', year: 2026, topics: [] };
const classroom = { classroomId: 'c2', groupId: 'g1', assignmentName: '課題2', joinCode: 'abc234' };

const renderModal = (containerProps) => {
    const props = {
        classrooms: [classroom],
        groups: [group],
        members: [],
        selectedGroup: group,
        onSelectGroup: jest.fn(),
        onShowClassList: jest.fn(),
        onBackToDashboard: jest.fn(),
        ...containerProps,
    };
    const result = render(
        <IntlProvider locale="en">
            <ClassroomTeacherModal containerProps={props} onClose={jest.fn()} />
        </IntlProvider>,
    );
    const rerender = (over) =>
        result.rerender(
            <IntlProvider locale="en">
                <ClassroomTeacherModal containerProps={{ ...props, ...over }} onClose={jest.fn()} />
            </IntlProvider>,
        );
    return { props, rerender };
};

describe('ClassroomTeacherModal — ✕ of the assignment detail (#2089)', () => {
    beforeEach(() => {
        mockDetailProps = null;
        mockBoardProps = null;
    });

    test('passes the unsaved state to the detail', () => {
        renderModal({
            phase: 'teacher-class-detail',
            selectedClassroom: classroom,
            assignmentHasUnsavedChanges: true,
        });
        expect(mockDetailProps.hasUnsavedChanges).toBe(true);
    });

    test('✕ goes back to［授業］with the row of the assignment open (once)', () => {
        const { props, rerender } = renderModal({ phase: 'teacher-class-detail', selectedClassroom: classroom });
        act(() => mockDetailProps.onClose());
        expect(props.onBackToDashboard).toHaveBeenCalled();
        rerender({ phase: 'teacher-dashboard', selectedClassroom: null });
        expect(mockBoardProps.initialTab).toBe('classwork');
        expect(mockBoardProps.initialOpenId).toBe('c2');
        // The board opened the row: the next visit does not open it again.
        act(() => mockBoardProps.onInitialOpenUsed());
        expect(mockBoardProps.initialOpenId).toBe(null);
        expect(mockBoardProps.initialTab).toBe('classwork');
    });

    test('the path link to the class goes back without opening a row', () => {
        const { props, rerender } = renderModal({ phase: 'teacher-class-detail', selectedClassroom: classroom });
        document.querySelector('[data-testid="classroom-breadcrumb-assignments"]').click();
        expect(props.onBackToDashboard).toHaveBeenCalled();
        rerender({ phase: 'teacher-dashboard', selectedClassroom: null });
        expect(mockBoardProps.initialOpenId).toBe(null);
    });
});
