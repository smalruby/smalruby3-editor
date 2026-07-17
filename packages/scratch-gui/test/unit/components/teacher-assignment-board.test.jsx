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
