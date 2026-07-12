/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
// eslint-disable-next-line import/first
import KoshienSettingsModal from '../../../src/components/koshien-settings-modal/koshien-settings-modal.jsx';
// eslint-disable-next-line import/first
import { loadKoshienMockConfig } from '../../../src/lib/koshien-mock-config.js';

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

    test('renders map / side / rival / turn-interval fields and the save button', () => {
        const { getByTestId } = renderModal();
        expect(getByTestId('koshien-settings-map')).toBeInTheDocument();
        expect(getByTestId('koshien-settings-side')).toBeInTheDocument();
        expect(getByTestId('koshien-settings-rival')).toBeInTheDocument();
        expect(getByTestId('koshien-settings-turn-interval')).toBeInTheDocument();
        expect(getByTestId('koshien-settings-save')).toBeInTheDocument();
    });

    test('save persists settings, wires the vm runtime getter, and closes', () => {
        const onRequestClose = jest.fn();
        const vm = { runtime: {} };
        const { getByTestId } = renderModal({ onRequestClose, vm });

        fireEvent.change(getByTestId('koshien-settings-map'), { target: { value: 'canal' } });
        fireEvent.change(getByTestId('koshien-settings-side'), { target: { value: '2' } });
        fireEvent.change(getByTestId('koshien-settings-rival'), { target: { value: 'stop' } });
        fireEvent.change(getByTestId('koshien-settings-turn-interval'), { target: { value: '1.5' } });
        fireEvent.click(getByTestId('koshien-settings-save'));

        expect(loadKoshienMockConfig()).toEqual({
            mapId: 'canal',
            side: 2,
            rival: 'stop',
            turnInterval: 1.5,
        });
        expect(typeof vm.runtime.getKoshienMockConfig).toBe('function');
        expect(vm.runtime.getKoshienMockConfig().mapId).toBe('canal');
        expect(onRequestClose).toHaveBeenCalled();
    });

    test('reloads previously saved settings as the initial values', () => {
        window.localStorage.setItem(
            'smalruby:koshienMockConfig',
            JSON.stringify({ mapId: 'maze', side: 2, rival: 'random', turnInterval: 2 }),
        );
        const { getByTestId } = renderModal();
        expect(getByTestId('koshien-settings-map')).toHaveValue('maze');
        expect(getByTestId('koshien-settings-side')).toHaveValue('2');
        expect(getByTestId('koshien-settings-rival')).toHaveValue('random');
        expect(getByTestId('koshien-settings-turn-interval')).toHaveValue(2);
    });
});
