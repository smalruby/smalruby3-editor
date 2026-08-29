/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherPasscodeImport from '../../../src/components/classroom-modal/teacher-passcode-import.jsx';

const defaultProps = (over = {}) => ({
    group: { groupId: 'g1' },
    isLoading: false,
    lookup: null,
    error: null,
    onCancel: jest.fn(),
    onImport: jest.fn(),
    onLookup: jest.fn(),
    ...over,
});

const renderImport = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherPasscodeImport {...defaultProps()} {...props} />
        </IntlProvider>,
    );

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

describe('TeacherPasscodeImport (#1109)', () => {
    test('the check button is disabled until a passcode is entered, then looks it up', () => {
        const onLookup = jest.fn();
        renderImport({ onLookup });
        expect(byTestId('classroom-passcode-lookup')).toBeDisabled();
        fireEvent.change(byTestId('classroom-passcode-input'), { target: { value: 'crehle' } });
        expect(byTestId('classroom-passcode-lookup')).not.toBeDisabled();
        fireEvent.click(byTestId('classroom-passcode-lookup'));
        expect(onLookup).toHaveBeenCalledWith('crehle');
    });

    test('after a lookup, shows the preview and imports into the class', () => {
        const onImport = jest.fn();
        renderImport({ lookup: { title: 'ねこを動かそう' }, onImport });
        expect(byTestId('classroom-passcode-preview')).toHaveTextContent('ねこを動かそう');
        fireEvent.change(byTestId('classroom-passcode-input'), { target: { value: 'crehle' } });
        fireEvent.click(byTestId('classroom-passcode-import'));
        expect(onImport).toHaveBeenCalledWith('crehle', 'g1');
    });

    test('shows an error message', () => {
        renderImport({ error: '合言葉が見つかりません' });
        expect(byTestId('classroom-passcode-error')).toHaveTextContent('合言葉が見つかりません');
    });
});
