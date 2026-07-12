/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherClassList from '../../../src/components/classroom-modal/teacher-class-list.jsx';

const group = (over = {}) => ({
    groupId: 'g1',
    name: '2年1組',
    year: 2026,
    status: 'active',
    topics: [],
    googleClassroomCourseId: null,
    role: 'owner',
    ...over,
});

const defaultProps = () => ({
    classrooms: [
        { classroomId: 'c1', groupId: 'g1' },
        { classroomId: 'c2', groupId: 'g1' },
        { classroomId: 'c3', groupId: 'other' },
    ],
    groups: [group()],
    isLoading: false,
    onCreateClassWithAssignment: jest.fn(),
    onSelectGroup: jest.fn(),
    onShowEvaluation: jest.fn(),
});

const renderList = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherClassList {...defaultProps()} {...props} />
        </IntlProvider>,
    );

describe('TeacherClassList', () => {
    test('should render one card per active class with its assignment count', () => {
        renderList({
            groups: [group(), group({ groupId: 'g2', name: '2年2組', status: 'archived' })],
        });
        expect(document.querySelector('[data-testid="classroom-class-card-g1"]')).toBeInTheDocument();
        // Archived classes are hidden from the landing list
        expect(document.querySelector('[data-testid="classroom-class-card-g2"]')).not.toBeInTheDocument();
        expect(document.querySelector('[data-testid="classroom-class-open-g1"]')).toHaveTextContent('2 assignments');
    });

    test('should call onSelectGroup with the group when a card is opened', () => {
        const onSelectGroup = jest.fn();
        renderList({ onSelectGroup });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-open-g1"]'));
        expect(onSelectGroup).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }));
    });

    test('should call onShowEvaluation with the group from the evaluate button', () => {
        const onShowEvaluation = jest.fn();
        renderList({ onShowEvaluation });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-evaluate-g1"]'));
        expect(onShowEvaluation).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }));
    });

    test('should show the empty state when there are no active classes', () => {
        renderList({ groups: [] });
        expect(document.querySelector('[data-testid="classroom-class-list-empty"]')).toBeInTheDocument();
    });

    test('should show co-managed badge for co-teacher classes', () => {
        renderList({ groups: [group({ role: 'co-teacher' })] });
        expect(document.querySelector('[data-testid="classroom-class-card-g1"]')).toHaveTextContent('Co-managed');
    });

    test('should submit the combined creation form only when all fields are filled', () => {
        const onCreateClassWithAssignment = jest.fn();
        renderList({ onCreateClassWithAssignment });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-create"]'));

        const submit = document.querySelector('[data-testid="classroom-class-create-submit"]');
        expect(submit).toBeDisabled();

        fireEvent.change(document.querySelector('[data-testid="classroom-class-create-name"]'), {
            target: { value: ' 3年1組 ' },
        });
        fireEvent.change(document.querySelector('[data-testid="classroom-class-create-count"]'), {
            target: { value: '30' },
        });
        fireEvent.change(document.querySelector('[data-testid="classroom-class-create-assignment"]'), {
            target: { value: 'ねこを動かそう' },
        });
        expect(submit).not.toBeDisabled();

        fireEvent.click(submit);
        expect(onCreateClassWithAssignment).toHaveBeenCalledWith(
            expect.objectContaining({
                name: '3年1組',
                studentCount: 30,
                assignmentName: 'ねこを動かそう',
            }),
        );
    });
});
