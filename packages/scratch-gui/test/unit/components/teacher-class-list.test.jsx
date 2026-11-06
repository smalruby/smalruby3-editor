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

    test('opens a small "Create a class" dialog over the class list with labelled fields', () => {
        renderList();
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-class-create'));

        const dialog = byTestId('classroom-class-create-dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('role', 'dialog');
        // The class list stays behind the dialog (no screen transition).
        expect(byTestId('classroom-class-list')).toBeInTheDocument();
        // Every field has a visible label (R1), not just a placeholder.
        for (const field of ['name', 'section', 'year', 'count']) {
            const input = byTestId(`classroom-class-create-${field}`);
            expect(input.closest('label')).not.toBeNull();
        }
        expect(dialog).toHaveTextContent('Class name (required)');
        expect(dialog).toHaveTextContent('Section');
        expect(dialog).toHaveTextContent('School year');
        expect(dialog).toHaveTextContent('Number of students (seat numbers)');
        // The first-assignment field is gone (K3).
        expect(byTestId('classroom-class-create-assignment')).toBeNull();
    });

    test('submits only the class fields with fixed Cancel / Create buttons', () => {
        const onCreateClassWithAssignment = jest.fn();
        renderList({ onCreateClassWithAssignment });
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-class-create'));

        const submit = byTestId('classroom-class-create-submit');
        expect(submit).toBeDisabled();
        expect(submit).toHaveTextContent(/^Create$/);
        expect(byTestId('classroom-class-create-cancel')).toHaveTextContent(/^Cancel$/);

        fireEvent.change(byTestId('classroom-class-create-name'), { target: { value: ' 技術 ' } });
        fireEvent.change(byTestId('classroom-class-create-count'), { target: { value: '30' } });
        expect(submit).not.toBeDisabled();
        // The button label never changes with the input.
        expect(submit).toHaveTextContent(/^Create$/);

        fireEvent.change(byTestId('classroom-class-create-section'), { target: { value: '1組' } });
        fireEvent.click(submit);
        expect(onCreateClassWithAssignment).toHaveBeenCalledWith({
            name: '技術',
            year: expect.any(Number),
            section: '1組',
            studentCount: 30,
        });
    });

    test.each([
        ['cancel', (byTestId) => fireEvent.click(byTestId('classroom-class-create-cancel'))],
        ['Escape', (byTestId) => fireEvent.keyDown(byTestId('classroom-class-create-dialog'), { key: 'Escape' })],
    ])('closes and resets the create dialog when it is left by %s', (_label, leave) => {
        renderList();
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-class-create'));
        const defaultYear = byTestId('classroom-class-create-year').value;
        fireEvent.change(byTestId('classroom-class-create-name'), { target: { value: '技術' } });
        fireEvent.change(byTestId('classroom-class-create-year'), { target: { value: '2030' } });
        fireEvent.change(byTestId('classroom-class-create-section'), { target: { value: '2年1組' } });
        fireEvent.change(byTestId('classroom-class-create-count'), { target: { value: '30' } });
        leave(byTestId);
        expect(byTestId('classroom-class-create-dialog')).toBeNull();

        fireEvent.click(byTestId('classroom-class-create'));
        expect(byTestId('classroom-class-create-name').value).toBe('');
        expect(byTestId('classroom-class-create-year').value).toBe(defaultYear);
        expect(byTestId('classroom-class-create-section').value).toBe('');
        expect(byTestId('classroom-class-create-count').value).toBe('');
    });

    test('shows "Loading…" next to the create button while loading', () => {
        renderList({ isLoading: true });
        expect(document.querySelector('[data-testid="classroom-class-list-loading"]')).toHaveTextContent('Loading');
    });

    test('shows no loading text when idle', () => {
        renderList();
        expect(document.querySelector('[data-testid="classroom-class-list-loading"]')).toBeNull();
    });

    test('summarizes the class on its card: students and the generative AI', () => {
        renderList({
            groups: [
                group({
                    studentCount: 8,
                    genai: { enabled: true, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: true },
                }),
            ],
        });
        const summary = document.querySelector('[data-testid="classroom-class-summary-g1"]');
        expect(summary).toHaveTextContent('8 students');
        expect(summary).toHaveTextContent('Generative AI: Gemini');
    });

    test('leaves the generative AI out of the summary when it is not used', () => {
        renderList({ groups: [group({ studentCount: 8, genai: { enabled: false } })] });
        const summary = document.querySelector('[data-testid="classroom-class-summary-g1"]');
        expect(summary).toHaveTextContent('8 students');
        expect(summary).not.toHaveTextContent('Generative AI');
    });

    test('labels the year, section and student count in the class settings (K1)', () => {
        renderList({ groups: [group({ studentCount: 30, section: '1組' })] });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-open-g1"]'));
        for (const field of ['name', 'year', 'section', 'count']) {
            const input = document.querySelector(`[data-testid="classroom-class-settings-${field}"]`);
            expect(input.closest('label')).not.toBeNull();
        }
        const form = document.querySelector('[data-testid="classroom-class-settings-g1"]');
        expect(form).toHaveTextContent('School year');
        expect(form).toHaveTextContent('Number of students (seat numbers)');
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

    test('saves the class AI settings once the conditions are confirmed, with the preview beside the form', () => {
        const onUpdateGroup = jest.fn();
        renderList({ onUpdateGroup });
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-class-settings-open-g1'));
        expect(byTestId('classroom-class-ai-preview')).toBeInTheDocument();
        expect(byTestId('classroom-class-ai-preview-consult')).toBeNull();

        fireEvent.click(byTestId('classroom-class-ai-service-gemini'));
        expect(byTestId('classroom-class-ai-preview-consult')).toBeInTheDocument();
        // The teacher has to confirm the conditions before saving.
        expect(byTestId('classroom-class-settings-save')).toBeDisabled();
        fireEvent.click(byTestId('classroom-class-ai-confirm'));
        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        fireEvent.click(byTestId('classroom-class-settings-save'));

        expect(onUpdateGroup).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({
                genai: { enabled: true, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: true },
                rubytee: { enabled: true },
            }),
        );
    });

    test('increasing the student count saves immediately without a warning', () => {
        const onUpdateGroup = jest.fn();
        renderList({ groups: [group({ studentCount: 30 })], onUpdateGroup });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-open-g1"]'));
        fireEvent.change(document.querySelector('[data-testid="classroom-class-settings-count"]'), {
            target: { value: '35' },
        });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-save"]'));

        expect(document.querySelector('[data-testid="classroom-class-settings-decrease-confirm-message"]'))
            .not.toBeInTheDocument();
        expect(onUpdateGroup).toHaveBeenCalledWith('g1', expect.objectContaining({ studentCount: 35 }));
    });

    test('decreasing the student count warns first, then saves on confirm', () => {
        const onUpdateGroup = jest.fn();
        renderList({ groups: [group({ studentCount: 30 })], onUpdateGroup });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-open-g1"]'));
        fireEvent.change(document.querySelector('[data-testid="classroom-class-settings-count"]'), {
            target: { value: '20' },
        });

        // First save shows the warning and does NOT call the API.
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-save"]'));
        expect(onUpdateGroup).not.toHaveBeenCalled();
        expect(document.querySelector('[data-testid="classroom-class-settings-decrease-confirm-message"]'))
            .toBeInTheDocument();

        // Confirming saves the reduced count.
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-save"]'));
        expect(onUpdateGroup).toHaveBeenCalledWith('g1', expect.objectContaining({ studentCount: 20 }));
    });

    test('cancelling the decrease warning keeps the count and calls nothing', () => {
        const onUpdateGroup = jest.fn();
        renderList({ groups: [group({ studentCount: 30 })], onUpdateGroup });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-open-g1"]'));
        fireEvent.change(document.querySelector('[data-testid="classroom-class-settings-count"]'), {
            target: { value: '20' },
        });
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-save"]'));
        fireEvent.click(document.querySelector('[data-testid="classroom-class-settings-cancel"]'));

        expect(onUpdateGroup).not.toHaveBeenCalled();
        expect(document.querySelector('[data-testid="classroom-class-settings-decrease-confirm-message"]'))
            .not.toBeInTheDocument();
        // The form stays open (only the warning was dismissed).
        expect(document.querySelector('[data-testid="classroom-class-settings-g1"]')).toBeInTheDocument();
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

    test('pressing Archive hides cancel/save and shows only archive yes/no (review feedback)', () => {
        renderList();
        fireEvent.click(byTestId('classroom-class-settings-open-g1'));
        expect(byTestId('classroom-class-settings-cancel')).toBeInTheDocument();
        expect(byTestId('classroom-class-settings-save')).toBeInTheDocument();

        fireEvent.click(byTestId('classroom-class-settings-archive'));
        // Only the archive yes/no buttons remain.
        expect(byTestId('classroom-class-settings-cancel')).not.toBeInTheDocument();
        expect(byTestId('classroom-class-settings-save')).not.toBeInTheDocument();
        expect(byTestId('classroom-class-settings-archive-cancel')).toBeInTheDocument();
        expect(byTestId('classroom-class-settings-archive')).toBeInTheDocument();

        // "Keep the class" restores cancel/save.
        fireEvent.click(byTestId('classroom-class-settings-archive-cancel'));
        expect(byTestId('classroom-class-settings-cancel')).toBeInTheDocument();
        expect(byTestId('classroom-class-settings-save')).toBeInTheDocument();
    });

    test('archived classes have no settings button — only restore (review feedback)', () => {
        renderList({ groups: [group({ groupId: 'g2', status: 'archived' })] });
        fireEvent.click(byTestId('classroom-show-archived'));
        expect(byTestId('classroom-class-settings-open-g2')).not.toBeInTheDocument();
        expect(byTestId('classroom-class-restore-g2')).toBeInTheDocument();
    });
});
