/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherAssignmentBoard from '../../../src/components/classroom-modal/teacher-assignment-board.jsx';

const classroom = (over = {}) => ({
    classroomId: 'c1',
    className: '技術',
    assignmentName: '課題1',
    joinCode: 'abc234',
    groupId: 'g1',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...over,
});

const defaultProps = () => ({
    allClassrooms: [],
    allGroups: [],
    archivedClassrooms: [],
    classrooms: [classroom()],
    group: { groupId: 'g1', name: '技術', year: 2026, topics: [] },
    isLoading: false,
    onCreateAssignmentInClass: jest.fn(),
    onDownloadClassAll: jest.fn(),
    onRestoreClassroom: jest.fn(),
    onReuseAssignment: jest.fn(),
    onSelectClassroom: jest.fn(),
    onShowClassList: jest.fn(),
    onUpdateAssignmentMeta: jest.fn(),
    onUpdateGroupTopics: jest.fn(),
});

const renderBoard = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherAssignmentBoard {...defaultProps()} {...props} />
        </IntlProvider>,
    );

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

describe('TeacherAssignmentBoard — archived assignments section (issue #1051)', () => {
    test('shows no archived section when nothing is archived', () => {
        renderBoard();
        expect(byTestId('classroom-board-archived-section')).not.toBeInTheDocument();
    });

    test('archived assignments are revealed by the toggle with their retention date', () => {
        renderBoard({
            archivedClassrooms: [
                classroom({
                    classroomId: 'c2',
                    assignmentName: '課題2',
                    status: 'archived',
                    expiresAt: '2026-09-29T00:00:00.000Z',
                }),
            ],
        });

        // Collapsed by default.
        expect(byTestId('classroom-board-archived-section')).toBeInTheDocument();
        expect(byTestId('classroom-board-archived-list')).not.toBeInTheDocument();

        fireEvent.click(byTestId('classroom-board-archived-toggle'));
        expect(byTestId('classroom-board-archived-row-c2')).toBeInTheDocument();
        expect(byTestId('classroom-board-archived-row-c2').textContent).toContain('課題2');
        expect(byTestId('classroom-board-archived-row-c2').textContent).toContain('Kept until');
    });

    test('restore button reports the classroomId to onRestoreClassroom', () => {
        const props = defaultProps();
        props.archivedClassrooms = [classroom({ classroomId: 'c2', status: 'archived' })];
        renderBoard(props);

        fireEvent.click(byTestId('classroom-board-archived-toggle'));
        fireEvent.click(byTestId('classroom-board-restore-c2'));

        expect(props.onRestoreClassroom).toHaveBeenCalledWith('c2');
    });

    test('archived rows are sorted newest first by sortDate/createdAt', () => {
        renderBoard({
            archivedClassrooms: [
                classroom({ classroomId: 'old', createdAt: '2026-05-01T00:00:00.000Z' }),
                classroom({ classroomId: 'new', createdAt: '2026-07-01T00:00:00.000Z' }),
            ],
        });
        fireEvent.click(byTestId('classroom-board-archived-toggle'));
        const rows = Array.from(
            document.querySelectorAll('[data-testid^="classroom-board-archived-row-"]'),
        ).map((el) => el.getAttribute('data-testid'));
        expect(rows).toEqual(['classroom-board-archived-row-new', 'classroom-board-archived-row-old']);
    });
});

describe('TeacherAssignmentBoard — class-wide bulk download (issue #1055)', () => {
    test('the header button downloads active and archived assignments together', () => {
        const props = defaultProps();
        props.classrooms = [classroom()];
        props.archivedClassrooms = [classroom({ classroomId: 'c2', status: 'archived' })];
        props.onDownloadClassAll = jest.fn();
        renderBoard(props);

        fireEvent.click(byTestId('classroom-board-download-class'));

        expect(props.onDownloadClassAll).toHaveBeenCalledWith(
            props.group,
            expect.arrayContaining([
                expect.objectContaining({ classroomId: 'c1' }),
                expect.objectContaining({ classroomId: 'c2' }),
            ]),
        );
    });

    test('shows progress and disables the button while downloading', () => {
        renderBoard({ downloadProgress: { current: 2, total: 5 } });
        const button = byTestId('classroom-board-download-class');
        expect(button).toBeDisabled();
        expect(button.textContent).toContain('2/5');
    });
});

describe('TeacherAssignmentBoard — share entry (#1109)', () => {
    const sharedStub = (over = {}) => ({
        shareTarget: null,
        showCatalog: false,
        lastShared: null,
        lastImported: null,
        handleOpenShareFor: jest.fn(),
        handleCloseShareForm: jest.fn(),
        handleShareAssignment: jest.fn(),
        handleOpenCatalog: jest.fn(),
        ...over,
    });

    test('a 共有 button appears only for assignments with content, and opens the share step', () => {
        const shared = sharedStub();
        renderBoard({ shared, classrooms: [classroom({ hasAssignment: true })] });
        const btn = byTestId('classroom-board-share-c1');
        expect(btn).toBeInTheDocument();
        fireEvent.click(btn);
        expect(shared.handleOpenShareFor).toHaveBeenCalledWith(expect.objectContaining({ classroomId: 'c1' }));
    });

    test('no 共有 button when the assignment has no content (説明/スターターなし)', () => {
        const shared = sharedStub();
        renderBoard({ shared, classrooms: [classroom({ hasAssignment: false })] });
        expect(byTestId('classroom-board-share-c1')).not.toBeInTheDocument();
    });

    test('with a shareTarget the share step replaces the board body', () => {
        const shared = sharedStub({ shareTarget: classroom() });
        renderBoard({ shared });
        expect(byTestId('classroom-phase-share-step')).toBeInTheDocument();
        // The create action bar is hidden while sharing.
        expect(byTestId('classroom-board-create')).not.toBeInTheDocument();
    });

    test('no 共有 button when the shared hook is absent', () => {
        renderBoard();
        expect(byTestId('classroom-board-share-c1')).not.toBeInTheDocument();
    });
});

describe('TeacherAssignmentBoard — retention notice (issue #1052)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const inDays = (days) => new Date(Date.now() + days * DAY).toISOString();

    test('shows no retention notice while the deadline is far away', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: inDays(60) })] });
        expect(byTestId('classroom-board-expiry-c1')).not.toBeInTheDocument();
    });

    test('shows the auto-delete notice with a download button within 30 days', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: inDays(20) })] });
        const notice = byTestId('classroom-board-expiry-c1');
        expect(notice).toBeInTheDocument();
        expect(notice.textContent).toContain('deleted automatically');
        expect(byTestId('classroom-board-download-c1')).toBeInTheDocument();
    });

    test('the row download button downloads that one assignment', () => {
        const onDownloadClassAll = jest.fn();
        renderBoard({
            classrooms: [classroom({ expiresAt: inDays(5) })],
            onDownloadClassAll,
        });
        fireEvent.click(byTestId('classroom-board-download-c1'));
        expect(onDownloadClassAll).toHaveBeenCalledWith(
            expect.objectContaining({ groupId: 'g1' }),
            [expect.objectContaining({ classroomId: 'c1' })],
        );
    });

    test('never shows the notice for assignments without a deadline', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: null })] });
        expect(byTestId('classroom-board-expiry-c1')).not.toBeInTheDocument();
    });
});

describe('TeacherAssignmentBoard — reuse excludes archived (review feedback)', () => {
    test('reuse candidates and the class filter exclude archived classes and assignments', () => {
        const allGroups = [
            { groupId: 'g1', name: 'A', year: 2026, status: 'active', topics: [] },
            { groupId: 'gArch', name: 'B', year: 2026, status: 'archived', topics: [] },
        ];
        const allClassrooms = [
            { classroomId: 'active1', groupId: 'g1', assignmentName: 'A課題', status: 'active' },
            { classroomId: 'archAssign', groupId: 'g1', assignmentName: 'アーカイブ課題', status: 'archived' },
            { classroomId: 'inArchGroup', groupId: 'gArch', assignmentName: 'アーカイブ組の課題', status: 'active' },
        ];
        renderBoard({
            group: { groupId: 'g1', name: 'A', year: 2026, topics: [] },
            allGroups,
            allClassrooms,
        });
        fireEvent.click(byTestId('classroom-board-reuse'));

        // Only the active assignment of an active class is a candidate.
        expect(byTestId('classroom-board-reuse-copy-active1')).toBeInTheDocument();
        expect(byTestId('classroom-board-reuse-copy-archAssign')).not.toBeInTheDocument();
        expect(byTestId('classroom-board-reuse-copy-inArchGroup')).not.toBeInTheDocument();

        // The class filter lists only the active class.
        const values = [...byTestId('classroom-board-reuse-filter').options].map((o) => o.value);
        expect(values).toContain('g1');
        expect(values).not.toContain('gArch');
    });
});
