/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { classColorFor } from '../../../src/lib/classroom-class-color.js';
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
    onOpenUngrouped: jest.fn(),
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

    test('shows a failed create in the dialog, not behind it', () => {
        const { rerender } = renderList();
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-class-create'));
        rerender(
            <IntlProvider locale="en">
                <TeacherClassList {...defaultProps()} error="Network error" />
            </IntlProvider>,
        );
        const errors = document.querySelectorAll('[data-testid="classroom-error"]');
        expect(errors).toHaveLength(1);
        expect(byTestId('classroom-class-create-dialog')).toContainElement(errors[0]);
    });

    test('shows "Loading…" next to the create button while loading', () => {
        renderList({ isLoading: true });
        expect(document.querySelector('[data-testid="classroom-class-list-loading"]')).toHaveTextContent('Loading');
    });

    test('shows no loading text when idle', () => {
        renderList();
        expect(document.querySelector('[data-testid="classroom-class-list-loading"]')).toBeNull();
    });

    test('summarizes the class on its card: students, with the generative AI as a small label', () => {
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
        expect(document.querySelector('[data-testid="classroom-class-genai-g1"]')).toHaveTextContent(
            'Generative AI: Gemini',
        );
    });

    test('leaves the generative AI out of the summary when it is not used', () => {
        renderList({ groups: [group({ studentCount: 8, genai: { enabled: false } })] });
        const summary = document.querySelector('[data-testid="classroom-class-summary-g1"]');
        expect(summary).toHaveTextContent('8 students');
        expect(document.querySelector('[data-testid="classroom-class-card-g1"]')).not.toHaveTextContent(
            'Generative AI',
        );
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

    test('shows the name, then the year and section on the class color band (#1959)', () => {
        renderList({ groups: [group({ name: '技術', section: '2年1組' })] });
        const band = document.querySelector('[data-testid="classroom-class-band-g1"]');
        expect(band).toHaveTextContent('技術');
        expect(band).toHaveTextContent('2026 school year・2年1組');
        // The color comes from classColorFor (the class's place among the teacher's classes).
        expect(band).toHaveStyle({ backgroundColor: classColorFor('g1', [group()]), color: '#FFFFFF' });
        // The full label stays readable when the name is cut with「…」.
        expect(document.querySelector('[data-testid="classroom-class-open-g1"]')).toHaveAttribute(
            'title',
            '技術 2026年度 / 2年1組',
        );
    });

    test('titles the list 「Classes」 (#1956 Q12)', () => {
        renderList();
        expect(document.querySelector('[data-testid="classroom-phase-teacher-class-list"] h2')).toHaveTextContent(
            /^Classes$/,
        );
    });

    test('shows the next lesson date of the class, or why there is none', () => {
        const day = 24 * 60 * 60 * 1000;
        const later = new Date(Date.now() + 3 * day).toISOString();
        const sooner = new Date(Date.now() + 1 * day).toISOString();
        renderList({
            classrooms: [
                { classroomId: 'c1', groupId: 'g1', assignmentName: 'Later', sortDate: later },
                { classroomId: 'c2', groupId: 'g1', assignmentName: 'Sooner', sortDate: sooner },
                { classroomId: 'c3', groupId: 'g2', assignmentName: 'Past', sortDate: '2020-04-01T00:00:00.000Z' },
            ],
            groups: [group(), group({ groupId: 'g2' }), group({ groupId: 'g3' })],
        });
        expect(document.querySelector('[data-testid="classroom-class-next-g1"]')).toHaveTextContent(
            /^Next lesson .+: Sooner$/,
        );
        expect(document.querySelector('[data-testid="classroom-class-next-g2"]')).toHaveTextContent(
            'No upcoming lesson',
        );
        expect(document.querySelector('[data-testid="classroom-class-next-g3"]')).toHaveTextContent(
            'No assignments yet',
        );
    });

    test('puts Archive in the card ⋮ menu behind a confirmation (#1959)', async () => {
        const onUpdateGroup = jest.fn(() => Promise.resolve(true));
        renderList({ onUpdateGroup });
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        // Not on the card itself.
        expect(byTestId('classroom-class-archive-g1')).toBeNull();
        fireEvent.click(byTestId('classroom-class-menu-g1'));
        fireEvent.click(byTestId('classroom-class-archive-g1'));
        expect(onUpdateGroup).not.toHaveBeenCalled();
        expect(byTestId('classroom-class-archive-dialog')).toBeInTheDocument();
        fireEvent.click(byTestId('classroom-class-archive-cancel'));
        expect(byTestId('classroom-class-archive-dialog')).toBeNull();
        expect(onUpdateGroup).not.toHaveBeenCalled();
        // Cancelling gives the focus back to the card's ⋮.
        expect(document.activeElement).toBe(byTestId('classroom-class-menu-g1'));

        fireEvent.click(byTestId('classroom-class-menu-g1'));
        fireEvent.click(byTestId('classroom-class-archive-g1'));
        await act(async () => {
            fireEvent.click(byTestId('classroom-class-archive-confirm'));
        });
        expect(onUpdateGroup).toHaveBeenCalledWith('g1', { status: 'archived' });
        expect(byTestId('classroom-class-archive-dialog')).toBeNull();
        // The card may be gone: the focus goes to the title.
        expect(document.activeElement).toBe(document.querySelector('h2'));
    });

    test('keeps the archive confirmation open with the error when archiving fails', async () => {
        let finish;
        const onUpdateGroup = jest.fn(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        const { rerender } = renderList({ onUpdateGroup });
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-class-menu-g1'));
        fireEvent.click(byTestId('classroom-class-archive-g1'));
        fireEvent.click(byTestId('classroom-class-archive-confirm'));
        // While waiting, the buttons cannot be pressed.
        expect(byTestId('classroom-class-archive-confirm')).toBeDisabled();
        expect(byTestId('classroom-class-archive-cancel')).toBeDisabled();
        await act(async () => {
            finish(false);
        });
        rerender(
            <IntlProvider locale="en">
                <TeacherClassList {...defaultProps()} error="Could not save" onUpdateGroup={onUpdateGroup} />
            </IntlProvider>,
        );
        expect(byTestId('classroom-class-archive-dialog')).toBeInTheDocument();
        expect(byTestId('classroom-class-archive-dialog')).toHaveTextContent('Could not save');
        expect(byTestId('classroom-class-archive-confirm')).not.toBeDisabled();
    });

    test('goes back to the classes when the last archived class is restored', () => {
        const { rerender } = renderList({ groups: [group(), group({ groupId: 'g2', status: 'archived' })] });
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-show-archived'));
        expect(byTestId('classroom-archived-class-list')).toBeInTheDocument();
        rerender(
            <IntlProvider locale="en">
                <TeacherClassList {...defaultProps()} groups={[group(), group({ groupId: 'g2' })]} />
            </IntlProvider>,
        );
        expect(byTestId('classroom-class-list')).toBeInTheDocument();
        // A class archived again later does not reopen the archived view by itself.
        rerender(
            <IntlProvider locale="en">
                <TeacherClassList {...defaultProps()} groups={[group(), group({ groupId: 'g2', status: 'archived' })]} />
            </IntlProvider>,
        );
        expect(byTestId('classroom-archived-class-list')).toBeNull();
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
        // Rubytee asks for its own confirmation.
        expect(byTestId('classroom-class-settings-save')).toBeDisabled();
        fireEvent.click(byTestId('classroom-class-ai-rubytee-confirm'));
        fireEvent.click(byTestId('classroom-class-settings-save'));

        expect(onUpdateGroup).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({
                genai: { enabled: true, service: 'gemini', url: 'https://gemini.google.com/app', confirmed: true },
                rubytee: { enabled: true, confirmed: true },
            }),
        );
    });

    test('a class that turned Rubytee on before the confirmation existed asks for it on the next save', () => {
        const onUpdateGroup = jest.fn();
        renderList({ groups: [group({ rubytee: { enabled: true } })], onUpdateGroup });
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-class-settings-open-g1'));
        expect(byTestId('classroom-class-ai-rubytee')).toBeChecked();
        expect(byTestId('classroom-class-ai-rubytee-unconfirmed')).toBeInTheDocument();
        fireEvent.change(byTestId('classroom-class-settings-section'), { target: { value: '2年3組' } });
        expect(byTestId('classroom-class-settings-save')).toBeDisabled();

        fireEvent.click(byTestId('classroom-class-ai-rubytee-confirm'));
        fireEvent.click(byTestId('classroom-class-settings-save'));
        expect(onUpdateGroup).toHaveBeenCalledWith(
            'g1',
            expect.objectContaining({ section: '2年3組', rubytee: { enabled: true, confirmed: true } }),
        );
    });

    test('when a confirmation is missing, the footer says which one and takes the teacher to it', () => {
        renderList();
        const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
        fireEvent.click(byTestId('classroom-class-settings-open-g1'));
        expect(byTestId('classroom-class-settings-save-hint')).toBeNull();

        fireEvent.click(byTestId('classroom-class-ai-service-gemini'));
        const genaiHint = byTestId('classroom-class-settings-save-hint');
        expect(genaiHint).toHaveTextContent('generative AI');
        byTestId('classroom-class-ai-confirm').scrollIntoView = jest.fn();
        fireEvent.click(genaiHint);
        expect(byTestId('classroom-class-ai-confirm')).toHaveFocus();
        fireEvent.click(byTestId('classroom-class-ai-confirm'));
        expect(byTestId('classroom-class-settings-save-hint')).toBeNull();

        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        const hint = byTestId('classroom-class-settings-save-hint');
        expect(hint).toHaveTextContent('Rubytee');
        const scrollIntoView = jest.fn();
        byTestId('classroom-class-ai-rubytee-confirm').scrollIntoView = scrollIntoView;
        fireEvent.click(hint);
        expect(scrollIntoView).toHaveBeenCalled();
        expect(byTestId('classroom-class-ai-rubytee-confirm')).toHaveFocus();

        fireEvent.click(byTestId('classroom-class-ai-rubytee-confirm'));
        expect(byTestId('classroom-class-settings-save-hint')).toBeNull();
        expect(byTestId('classroom-class-settings-save')).toBeEnabled();
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

describe('TeacherClassList — 「確認が必要な課題」 band (#1959)', () => {
    const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

    test('lists the assignments with submissions not returned and opens one on its members', () => {
        const onOpenUngrouped = jest.fn();
        renderList({
            classrooms: [
                { classroomId: 'c1', groupId: 'g1', assignmentName: 'Cat', unreturnedCount: 12 },
                { classroomId: 'c2', groupId: 'g1', assignmentName: 'Chat', unreturnedCount: 0 },
            ],
            onOpenUngrouped,
        });
        expect(byTestId('classroom-review-item-c1')).toHaveTextContent('2年1組・Cat');
        expect(byTestId('classroom-review-item-c1')).toHaveTextContent('Not returned 12');
        // An assignment whose submissions are all returned is left out.
        expect(byTestId('classroom-review-item-c2')).toBeNull();
        fireEvent.click(byTestId('classroom-review-open-c1'));
        expect(onOpenUngrouped).toHaveBeenCalledWith('c1', { tab: 'members' });
    });

    test('says so when every count is there and zero', () => {
        renderList({ classrooms: [{ classroomId: 'c1', groupId: 'g1', unreturnedCount: 0 }] });
        expect(byTestId('classroom-review-none')).toHaveTextContent('Every submission has been returned.');
    });

    test('is hidden when the API has no counts (older API)', () => {
        renderList({
            classrooms: [
                { classroomId: 'c1', groupId: 'g1', unreturnedCount: 3 },
                { classroomId: 'c2', groupId: 'g1' },
            ],
        });
        expect(byTestId('classroom-review-band')).toBeNull();
    });
});
