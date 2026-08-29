/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherShareStep from '../../../src/components/classroom-modal/teacher-share-step.jsx';

const defaultProps = (over = {}) => ({
    classroom: { classroomId: 'c1', assignmentName: 'ねこを動かそう', className: '技術' },
    isLoading: false,
    lastShared: null,
    onCancel: jest.fn(),
    onShare: jest.fn(),
    ...over,
});

const renderStep = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherShareStep {...defaultProps()} {...props} />
        </IntlProvider>,
    );

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

describe('TeacherShareStep (#1109)', () => {
    test('defaults to limited (合言葉) mode and shares with visibility:limited', () => {
        const onShare = jest.fn();
        renderStep({ onShare });
        // Title prefilled from the assignment name.
        expect(byTestId('classroom-share-limited-title').value).toBe('ねこを動かそう');
        fireEvent.click(byTestId('classroom-share-limited-submit'));
        expect(onShare).toHaveBeenCalledWith({
            classroomId: 'c1',
            title: 'ねこを動かそう',
            visibility: 'limited',
        });
    });

    test('the limited submit is disabled when the title is empty', () => {
        renderStep({ classroom: { classroomId: 'c1', assignmentName: '', className: '' } });
        expect(byTestId('classroom-share-limited-submit')).toBeDisabled();
    });

    test('switching to public shows the full SharedAssignmentForm', () => {
        renderStep();
        expect(byTestId('shared-form')).not.toBeInTheDocument();
        fireEvent.click(byTestId('classroom-share-mode-public'));
        expect(byTestId('shared-form')).toBeInTheDocument();
    });

    test('after a limited share, the passcode is shown and Close calls onCancel', () => {
        const onCancel = jest.fn();
        renderStep({ lastShared: { title: 'ねこを動かそう', visibility: 'limited', passcode: 'crehle' }, onCancel });
        expect(byTestId('classroom-share-passcode-value')).toHaveTextContent('crehle');
        fireEvent.click(byTestId('classroom-share-done'));
        expect(onCancel).toHaveBeenCalled();
    });

    test('after a public share (no passcode), shows the published confirmation', () => {
        renderStep({ lastShared: { title: 'ねこを動かそう', visibility: 'public' } });
        expect(byTestId('classroom-share-passcode')).not.toBeInTheDocument();
        expect(byTestId('shared-form-success')).toHaveTextContent('ねこを動かそう');
    });
});
