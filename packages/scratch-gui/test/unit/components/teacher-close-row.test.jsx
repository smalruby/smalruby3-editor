/* eslint-env jest */
/**
 * 「✕ ＋ 見出し」の行 (#2089): 1 つの物を編集する画面の本文の上に置き、✕ で開いた元へ戻る。
 * 保存していない変更があれば、✕ は先に「変更を破棄しますか？」と聞く（N3 = A）。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherAssignmentBoard from '../../../src/components/classroom-modal/teacher-assignment-board.jsx';
import TeacherClassDetail from '../../../src/components/classroom-modal/teacher-class-detail.jsx';
import TeacherCloseRow from '../../../src/components/classroom-modal/teacher-close-row.jsx';
import TeacherPostAssignment from '../../../src/components/classroom-modal/teacher-post-assignment.jsx';

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const inIntl = (node) => render(<IntlProvider locale="en">{node}</IntlProvider>);

describe('TeacherCloseRow', () => {
    test('✕ goes back at once when nothing is unsaved', () => {
        const onClose = jest.fn();
        inIntl(<TeacherCloseRow closeLabel="Back to the assignments" title="Task" onClose={onClose} />);
        const close = byTestId('classroom-close-row-close');
        expect(close).toHaveAttribute('aria-label', 'Back to the assignments');
        expect(byTestId('classroom-close-row-title').textContent).toBe('Task');
        fireEvent.click(close);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(byTestId('classroom-close-row-discard-message')).not.toBeInTheDocument();
    });

    test('with unsaved changes ✕ asks first; Cancel stays', () => {
        const onClose = jest.fn();
        inIntl(
            <TeacherCloseRow unsaved closeLabel="Back" title="Task" onClose={onClose}>
                <button data-testid="end-button" type="button" />
            </TeacherCloseRow>,
        );
        fireEvent.click(byTestId('classroom-close-row-close'));
        expect(onClose).not.toHaveBeenCalled();
        expect(byTestId('classroom-close-row-discard-message').textContent).toBe(
            'Discard the changes? The changes you have not saved will be lost.',
        );
        // The question takes the place of the row's end while it is asked.
        expect(byTestId('end-button')).not.toBeInTheDocument();
        fireEvent.click(byTestId('classroom-close-row-discard-cancel'));
        expect(onClose).not.toHaveBeenCalled();
        expect(byTestId('classroom-close-row-discard-message')).not.toBeInTheDocument();
        expect(byTestId('end-button')).toBeInTheDocument();
    });

    test('with unsaved changes, Discard goes back', () => {
        const onClose = jest.fn();
        inIntl(<TeacherCloseRow unsaved closeLabel="Back" title="Task" onClose={onClose} />);
        fireEvent.click(byTestId('classroom-close-row-close'));
        fireEvent.click(byTestId('classroom-close-row-discard'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('without onClose there is no ✕', () => {
        inIntl(<TeacherCloseRow title="Task" />);
        expect(byTestId('classroom-close-row')).toBeInTheDocument();
        expect(byTestId('classroom-close-row-close')).not.toBeInTheDocument();
    });
});

describe('TeacherClassDetail — ✕ の行 (#2089)', () => {
    const classroom = {
        classroomId: 'c1',
        className: '2年1組',
        assignmentName: '課題1',
        joinCode: 'ABCDEF',
        studentCount: 3,
    };
    const editor = {
        editorPages: [{ text: 'p' }],
        starterMode: 'none',
        isSaving: false,
        peerView: 'none',
        meshGroupLimit: 6,
        onAddPage: jest.fn(),
        onAttachPageImage: jest.fn(),
        onChangePageText: jest.fn(),
        onMovePage: jest.fn(),
        onRemovePage: jest.fn(),
        onRemovePageImage: jest.fn(),
        onRemoveStarter: jest.fn(),
        onUseCurrentProject: jest.fn(),
        onUseFile: jest.fn(),
    };
    const renderDetail = (props) =>
        inIntl(
            <TeacherClassDetail
                isLoading={false}
                members={[]}
                selectedClassroom={classroom}
                onCopyInviteLink={jest.fn()}
                onDeleteClassroom={jest.fn()}
                onDeleteMember={jest.fn()}
                onDownloadAll={jest.fn()}
                onOpenSubmission={jest.fn()}
                onRefresh={jest.fn()}
                onReturnSubmission={jest.fn()}
                onSelectMember={jest.fn()}
                onUpdateAssignmentName={jest.fn()}
                {...props}
            />,
        );

    test('the row holds ✕, the assignment name and the join code', () => {
        const onClose = jest.fn();
        renderDetail({ onClose });
        const row = byTestId('classroom-close-row');
        expect(row).toContainElement(byTestId('classroom-detail-assignment-name'));
        expect(row).toContainElement(byTestId('classroom-detail-join-code'));
        expect(byTestId('classroom-close-row-close')).toHaveAttribute('aria-label', 'Back to the assignments');
        fireEvent.click(byTestId('classroom-close-row-close'));
        expect(onClose).toHaveBeenCalled();
    });

    test('［課題を保存］is in the row on the description tab only', () => {
        const onSave = jest.fn();
        renderDetail({
            assignmentEditor: { ...editor, onSave },
            detailEntry: { tab: 'description', seq: 1 },
            onClose: jest.fn(),
        });
        expect(byTestId('classroom-close-row')).toContainElement(byTestId('classroom-assignment-save'));
        fireEvent.click(byTestId('classroom-assignment-save'));
        expect(onSave).toHaveBeenCalled();
        fireEvent.click(byTestId('classroom-tab-members'));
        expect(byTestId('classroom-assignment-save')).not.toBeInTheDocument();
    });

    test('unsaved changes: ✕ asks, and Discard goes back', () => {
        const onClose = jest.fn();
        renderDetail({ hasUnsavedChanges: true, onClose });
        fireEvent.click(byTestId('classroom-close-row-close'));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(byTestId('classroom-close-row-discard'));
        expect(onClose).toHaveBeenCalled();
    });
});

describe('TeacherAssignmentBoard — ✕ の行 (#2089)', () => {
    const group = { groupId: 'g1', name: '技術', year: 2026, topics: [] };
    const classrooms = [
        { classroomId: 'c1', assignmentName: '課題1', joinCode: 'abc234', groupId: 'g1', createdAt: '2026-07-01' },
        { classroomId: 'c2', assignmentName: '課題2', joinCode: 'def567', groupId: 'g1', createdAt: '2026-07-02' },
    ];
    const renderBoard = (props) =>
        inIntl(
            <TeacherAssignmentBoard
                allClassrooms={classrooms}
                allGroups={[group]}
                archivedClassrooms={[]}
                classrooms={classrooms}
                group={group}
                isLoading={false}
                onCreateAssignmentInClass={jest.fn()}
                onDownloadClassAll={jest.fn()}
                onRestoreClassroom={jest.fn()}
                onReuseAssignment={jest.fn()}
                onSelectClassroom={jest.fn()}
                onShowClassList={jest.fn()}
                onUpdateAssignmentMeta={jest.fn()}
                onUpdateGroup={jest.fn()}
                onUpdateGroupTopics={jest.fn()}
                {...props}
            />,
        );

    beforeEach(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    test('back from the detail: the row of that assignment is open on［授業］', () => {
        const onInitialOpenUsed = jest.fn();
        const onLoadAssignmentSummary = jest.fn(() => Promise.resolve(null));
        renderBoard({ initialOpenId: 'c2', initialTab: 'classwork', onInitialOpenUsed, onLoadAssignmentSummary });
        expect(byTestId('classroom-board-row-toggle-c2')).toHaveAttribute('aria-expanded', 'true');
        expect(byTestId('classroom-board-row-toggle-c1')).toHaveAttribute('aria-expanded', 'false');
        expect(onLoadAssignmentSummary).toHaveBeenCalledWith(classrooms[1]);
        expect(onInitialOpenUsed).toHaveBeenCalledTimes(1);
    });

    test('「課題を作成」: ✕ goes back to the assignments', () => {
        renderBoard({ initialTab: 'classwork' });
        fireEvent.click(byTestId('classroom-board-create-menu'));
        fireEvent.click(byTestId('classroom-board-create'));
        expect(byTestId('classroom-board-create-view')).toBeInTheDocument();
        expect(byTestId('classroom-close-row-close')).toHaveAttribute('aria-label', 'Back to the assignments');
        fireEvent.click(byTestId('classroom-close-row-close'));
        expect(byTestId('classroom-board-create-view')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-list')).toBeInTheDocument();
    });

    test('「課題を再利用」: ✕ goes back to the assignments', () => {
        renderBoard({ initialTab: 'classwork' });
        fireEvent.click(byTestId('classroom-board-create-menu'));
        fireEvent.click(byTestId('classroom-board-reuse'));
        expect(byTestId('classroom-board-reuse-view')).toBeInTheDocument();
        fireEvent.click(byTestId('classroom-close-row-close'));
        expect(byTestId('classroom-board-reuse-view')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-list')).toBeInTheDocument();
    });

    test('クラスの設定: ✕ goes back to the tab it was opened from', () => {
        renderBoard({ initialTab: 'stream' });
        fireEvent.click(byTestId('classroom-board-class-settings'));
        expect(byTestId('classroom-board-settings-view')).toBeInTheDocument();
        expect(byTestId('classroom-close-row-title').textContent).toBe('Class settings');
        expect(byTestId('classroom-close-row-close')).toHaveAttribute('aria-label', 'Back to the class');
        fireEvent.click(byTestId('classroom-close-row-close'));
        expect(byTestId('classroom-board-settings-view')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-tab-stream')).toHaveAttribute('aria-selected', 'true');
    });
});

describe('TeacherPostAssignment — ✕ の行 (#2089)', () => {
    test('✕ goes back to the assignment detail', () => {
        const onBack = jest.fn();
        inIntl(
            <TeacherPostAssignment
                isLoading={false}
                selectedClassroom={{ assignmentName: 'ねこ', className: '技術' }}
                onBack={onBack}
                onPostAssignment={jest.fn()}
            />,
        );
        expect(byTestId('classroom-close-row-title').textContent).toBe('Post assignment to Google Classroom');
        expect(byTestId('classroom-close-row-close')).toHaveAttribute('aria-label', 'Back to the assignment');
        fireEvent.click(byTestId('classroom-close-row-close'));
        expect(onBack).toHaveBeenCalled();
    });
});
