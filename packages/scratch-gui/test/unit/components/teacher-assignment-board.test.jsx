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

describe('TeacherAssignmentBoard — retention badge (issue #1052)', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const inDays = (days) => new Date(Date.now() + days * DAY).toISOString();

    test('shows no badge while the deadline is far away', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: inDays(60) })] });
        expect(byTestId('classroom-board-expiry-c1')).not.toBeInTheDocument();
    });

    test('shows a days-left badge within 30 days of deletion', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: inDays(20) })] });
        const badge = byTestId('classroom-board-expiry-c1');
        expect(badge).toBeInTheDocument();
        expect(badge.textContent).toContain('20 days left');
    });

    test('shows the badge for assignments without a deadline never', () => {
        renderBoard({ classrooms: [classroom({ expiresAt: null })] });
        expect(byTestId('classroom-board-expiry-c1')).not.toBeInTheDocument();
    });
});
