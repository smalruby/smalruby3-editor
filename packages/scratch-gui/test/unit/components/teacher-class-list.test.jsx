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
    onUpdateGroup: jest.fn(),
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

    test('should submit with the first assignment being optional (class-only creation)', () => {
        const onCreateClassWithAssignment = jest.fn();
        renderList({ onCreateClassWithAssignment });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-create"]'));

        const submit = document.querySelector('[data-testid="classroom-class-create-submit"]');
        expect(submit).toBeDisabled();

        fireEvent.change(document.querySelector('[data-testid="classroom-class-create-name"]'), {
            target: { value: ' 技術 ' },
        });
        fireEvent.change(document.querySelector('[data-testid="classroom-class-create-count"]'), {
            target: { value: '30' },
        });
        // Assignment name empty — the class can still be created
        expect(submit).not.toBeDisabled();
        expect(submit).toHaveTextContent('Create the class only');

        fireEvent.change(document.querySelector('[data-testid="classroom-class-create-section"]'), {
            target: { value: '2年1組' },
        });
        fireEvent.click(submit);
        expect(onCreateClassWithAssignment).toHaveBeenCalledWith(
            expect.objectContaining({
                name: '技術',
                section: '2年1組',
                studentCount: 30,
                assignmentName: null,
            }),
        );
    });

    test('should show the class label with year and section', () => {
        renderList({ groups: [group({ name: '技術', section: '2年1組' })] });
        expect(document.querySelector('[data-testid="classroom-class-open-g1"]')).toHaveTextContent(
            '技術 2026年度 / 2年1組',
        );
    });

    test('should open inline settings and save the edited fields', () => {
        const onUpdateGroup = jest.fn();
        renderList({ onUpdateGroup });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-open-g1"]'));
        expect(document.querySelector('[data-testid="classroom-class-settings-g1"]')).toBeInTheDocument();

        fireEvent.change(document.querySelector('[data-testid="classroom-class-settings-section"]'), {
            target: { value: '2年3組' },
        });
        fireEvent.change(document.querySelector('[data-testid="classroom-class-settings-co-teacher-input"]'), {
            target: { value: 'co@example.com' },
        });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-add-co-teacher"]'));
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-save"]'));

        expect(onUpdateGroup).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({
                name: '2年1組',
                section: '2年3組',
                coTeacherEmails: ['co@example.com'],
            }),
        );
        // The form closes back to the card
        expect(document.querySelector('[data-testid="classroom-class-settings-g1"]')).not.toBeInTheDocument();
    });
});

describe('TeacherClassList — archived classes section (issue #1051)', () => {
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('shows no archived section when every class is active', () => {
        renderList();
        expect(byTestId('classroom-show-archived')).not.toBeInTheDocument();
    });

    test('archived classes are revealed by the toggle with a restore button', () => {
        renderList({
            groups: [group(), group({ groupId: 'g2', name: '2年2組', status: 'archived' })],
        });

        fireEvent.click(byTestId('classroom-show-archived'));
        expect(byTestId('classroom-archived-class-list')).toBeInTheDocument();
        expect(byTestId('classroom-class-card-g2')).toBeInTheDocument();
        expect(byTestId('classroom-class-card-g2')).toHaveTextContent('Archived');
        expect(byTestId('classroom-class-restore-g2')).toBeInTheDocument();
    });

    test('restore button unarchives the class via onUpdateGroup', () => {
        const onUpdateGroup = jest.fn();
        renderList({
            groups: [group({ groupId: 'g2', status: 'archived' })],
            onUpdateGroup,
        });

        fireEvent.click(byTestId('classroom-show-archived'));
        fireEvent.click(byTestId('classroom-class-restore-g2'));

        expect(onUpdateGroup).toHaveBeenCalledWith('g2', { status: 'active' });
    });

    test('archiving from settings requires an explicit confirmation step', () => {
        const onUpdateGroup = jest.fn();
        renderList({ onUpdateGroup });

        fireEvent.click(byTestId('classroom-class-settings-open-g1'));
        // First click arms the confirmation instead of archiving.
        fireEvent.click(byTestId('classroom-class-settings-archive'));
        expect(onUpdateGroup).not.toHaveBeenCalled();
        expect(byTestId('classroom-class-settings-archive-confirm-message')).toBeInTheDocument();

        // Second click actually archives.
        fireEvent.click(byTestId('classroom-class-settings-archive'));
        expect(onUpdateGroup).toHaveBeenCalledWith('g1', { status: 'archived' });
    });

    test('the confirmation can be cancelled without archiving', () => {
        const onUpdateGroup = jest.fn();
        renderList({ onUpdateGroup });

        fireEvent.click(byTestId('classroom-class-settings-open-g1'));
        fireEvent.click(byTestId('classroom-class-settings-archive'));
        fireEvent.click(byTestId('classroom-class-settings-archive-cancel'));

        expect(onUpdateGroup).not.toHaveBeenCalled();
        expect(byTestId('classroom-class-settings-archive-confirm-message')).not.toBeInTheDocument();
    });

    test('unarchiving from settings stays immediate (no confirmation)', () => {
        const onUpdateGroup = jest.fn();
        renderList({
            groups: [group({ groupId: 'g2', status: 'archived' })],
            onUpdateGroup,
        });

        fireEvent.click(byTestId('classroom-show-archived'));
        fireEvent.click(byTestId('classroom-class-settings-open-g2'));
        fireEvent.click(byTestId('classroom-class-settings-archive'));

        expect(onUpdateGroup).toHaveBeenCalledWith('g2', { status: 'active' });
    });
});
