/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherPostAssignment from '../../../src/components/classroom-modal/teacher-post-assignment.jsx';

const defaultProps = (over = {}) => ({
    error: null,
    errorTitle: null,
    isLoading: false,
    group: { name: '技術', year: 2026, section: null },
    selectedClassroom: { assignmentName: 'ねこを動かそう', className: '技術' },
    onBack: jest.fn(),
    onPostAssignment: jest.fn().mockResolvedValue({ alternateLink: 'https://classroom.google.com/x' }),
    ...over,
});

const renderPost = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherPostAssignment {...defaultProps()} {...props} />
        </IntlProvider>,
    );

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

describe('TeacherPostAssignment', () => {
    test('shows the class label in the class-detail format (name + year), no "Target:" prefix', () => {
        renderPost();
        const phase = byTestId('classroom-phase-teacher-post-assignment');
        expect(phase.textContent).toContain('技術 2026年度');
        expect(phase.textContent).not.toContain('Target:');
    });

    test('the submit button is disabled until a title is entered', () => {
        renderPost({ selectedClassroom: { assignmentName: '', className: '技術' } });
        const submit = byTestId('classroom-post-assignment-submit');
        expect(submit).toBeDisabled();
        fireEvent.change(byTestId('classroom-post-assignment-title'), { target: { value: 'ねこ' } });
        expect(submit).not.toBeDisabled();
    });

    test('the cancel button behaves like back', () => {
        const onBack = jest.fn();
        renderPost({ onBack });
        fireEvent.click(byTestId('classroom-post-assignment-cancel'));
        expect(onBack).toHaveBeenCalled();
    });

    test('does not render a legacy back button (breadcrumb + cancel replace it)', () => {
        renderPost();
        expect(byTestId('classroom-back')).not.toBeInTheDocument();
    });

    test('after posting, shows the success view with a link to Google Classroom and a back button', async () => {
        const onBack = jest.fn();
        const onPostAssignment = jest
            .fn()
            .mockResolvedValue({ alternateLink: 'https://classroom.google.com/c/abc' });
        renderPost({ onBack, onPostAssignment });

        fireEvent.click(byTestId('classroom-post-assignment-submit'));

        await waitFor(() => expect(byTestId('classroom-post-assignment-success')).toBeInTheDocument());
        const link = byTestId('classroom-view-posted-assignment');
        expect(link).toHaveAttribute('href', 'https://classroom.google.com/c/abc');

        fireEvent.click(byTestId('classroom-post-assignment-done'));
        expect(onBack).toHaveBeenCalled();
    });
});
