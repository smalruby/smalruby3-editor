/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import SharedAssignmentForm from '../../../src/components/classroom-modal/shared-assignment-form.jsx';

const classroom = (over = {}) => ({
    classroomId: 'c1',
    className: '技術',
    assignmentName: 'ねこあつめ',
    ...over,
});

const defaultProps = () => ({
    selectedClassroom: classroom(),
    isLoading: false,
    onCancel: jest.fn(),
    onShare: jest.fn(),
});

const renderForm = (props) =>
    render(
        <IntlProvider locale="en">
            <SharedAssignmentForm {...defaultProps()} {...props} />
        </IntlProvider>,
    );

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

const fillRequired = () => {
    fireEvent.change(byTestId('shared-form-subject'), {
        target: { value: '技術・家庭（技術分野）' },
    });
    fireEvent.change(byTestId('shared-form-author-name'), { target: { value: 'るびお' } });
    fireEvent.click(byTestId('shared-form-consent'));
};

describe('SharedAssignmentForm (issue #1069)', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('prefills the title from the assignment name and shows the URL guidance (D4)', () => {
        renderForm();
        expect(byTestId('shared-form-title')).toHaveValue('ねこあつめ');
        expect(byTestId('shared-form-url-hint').textContent).toContain('lesson plan');
    });

    test('submit stays disabled until subject, author name and CC BY consent are given (D2)', () => {
        renderForm();
        expect(byTestId('shared-form-submit')).toBeDisabled();
        fillRequired();
        expect(byTestId('shared-form-submit')).not.toBeDisabled();
    });

    test('rejects a non-https supplement URL client-side', () => {
        renderForm();
        fillRequired();
        fireEvent.change(byTestId('shared-form-url'), { target: { value: 'http://example.com' } });
        expect(byTestId('shared-form-url-error')).toBeInTheDocument();
        expect(byTestId('shared-form-submit')).toBeDisabled();
    });

    test('submits the normalized payload (grades sorted, tags parsed, license consent)', () => {
        const onShare = jest.fn();
        renderForm({ onShare });
        fillRequired();
        fireEvent.click(byTestId('shared-form-grade-2'));
        fireEvent.click(byTestId('shared-form-grade-1'));
        fireEvent.change(byTestId('shared-form-tags'), { target: { value: '甲子園, 入門' } });
        fireEvent.change(byTestId('shared-form-url'), {
            target: { value: 'https://docs.google.com/document/d/x/view' },
        });
        fireEvent.click(byTestId('shared-form-submit'));

        expect(onShare).toHaveBeenCalledWith(
            expect.objectContaining({
                classroomId: 'c1',
                title: 'ねこあつめ',
                schoolLevel: 'junior-high',
                grades: [1, 2],
                subject: '技術・家庭（技術分野）',
                tags: ['甲子園', '入門'],
                supplementUrl: 'https://docs.google.com/document/d/x/view',
                authorName: 'るびお',
                licenseConsent: true,
            }),
        );
    });

    test('changing the school level resets subject and grades', () => {
        renderForm();
        fillRequired();
        fireEvent.click(byTestId('shared-form-grade-3'));
        fireEvent.change(byTestId('shared-form-level'), { target: { value: 'high' } });
        expect(byTestId('shared-form-subject')).toHaveValue('');
        expect(byTestId('shared-form-grade-3')).not.toBeChecked();
        // High school vocabulary is offered now.
        expect(byTestId('shared-form-subject').textContent).toContain('情報Ⅰ');
    });

    test('the "other" school level switches the subject to free text input', () => {
        renderForm();
        fireEvent.change(byTestId('shared-form-level'), { target: { value: 'other' } });
        expect(byTestId('shared-form-subject')).not.toBeInTheDocument();
        expect(byTestId('shared-form-subject-free')).toBeInTheDocument();
    });

    test('remembers the author profile for the next share (D6)', () => {
        window.localStorage.setItem(
            'smalruby:sharedAuthorProfile',
            JSON.stringify({ authorName: '記憶済み', authorAffiliation: '島根県' }),
        );
        renderForm();
        expect(byTestId('shared-form-author-name')).toHaveValue('記憶済み');
        expect(byTestId('shared-form-author-affiliation')).toHaveValue('島根県');
    });
});
