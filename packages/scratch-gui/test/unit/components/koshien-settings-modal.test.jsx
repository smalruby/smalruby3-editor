/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
// eslint-disable-next-line import/first
import KoshienSettingsModal from '../../../src/components/koshien-settings-modal/koshien-settings-modal.jsx';
// eslint-disable-next-line import/first
import { loadKoshienConnection } from '../../../src/lib/koshien-connection.js';

// Avoid react-modal portal/store complexity: render the modal body inline.
jest.mock('../../../src/containers/modal.jsx', () => {
    const FakeModal = ({ children }) => <div data-testid="koshien-settings-modal">{children}</div>;
    return FakeModal;
});

const renderModal = (props) =>
    render(
        <IntlProvider locale="en">
            <KoshienSettingsModal onRequestClose={jest.fn()} {...props} />
        </IntlProvider>,
    );

describe('KoshienSettingsModal', () => {
    beforeEach(() => window.localStorage.clear());

    test('renders endpoint / side / game-code fields', () => {
        const { getByTestId } = renderModal();
        expect(getByTestId('koshien-settings-endpoint')).toBeInTheDocument();
        expect(getByTestId('koshien-settings-side')).toBeInTheDocument();
        expect(getByTestId('koshien-settings-game-code')).toBeInTheDocument();
    });

    test('save persists settings, wires the vm runtime getter, and closes', () => {
        const onRequestClose = jest.fn();
        const vm = { runtime: {} };
        const { getByTestId } = renderModal({ onRequestClose, vm });

        fireEvent.change(getByTestId('koshien-settings-endpoint'), {
            target: { value: 'http://x:3000' },
        });
        fireEvent.change(getByTestId('koshien-settings-side'), { target: { value: '2' } });
        fireEvent.change(getByTestId('koshien-settings-game-code'), { target: { value: 'g1' } });
        fireEvent.click(getByTestId('koshien-settings-save'));

        expect(loadKoshienConnection()).toEqual({ endpoint: 'http://x:3000', side: 2, gameCode: 'g1' });
        expect(typeof vm.runtime.getKoshienRemoteOptions).toBe('function');
        expect(vm.runtime.getKoshienRemoteOptions().endpoint).toBe('http://x:3000');
        expect(onRequestClose).toHaveBeenCalled();
    });

    test('the save button is present and the test button is disabled until an endpoint is entered', () => {
        const { getByTestId } = renderModal();
        expect(getByTestId('koshien-settings-save')).toBeInTheDocument();
        expect(getByTestId('koshien-settings-test')).toBeDisabled();
        fireEvent.change(getByTestId('koshien-settings-endpoint'), {
            target: { value: 'http://x:3000' },
        });
        expect(getByTestId('koshien-settings-test')).not.toBeDisabled();
    });
});
