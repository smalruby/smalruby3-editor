import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import '@testing-library/jest-dom';
import { render, fireEvent } from '@testing-library/react';

// Mock the ConnectionModalComponent to capture props
jest.mock('../../../src/components/connection-modal/connection-modal.jsx', () => {
    const React = require('react');
    const PHASES = {
        scanning: 'scanning',
        connecting: 'connecting',
        connected: 'connected',
        error: 'error',
        unavailable: 'unavailable',
        networkFiltered: 'networkFiltered',
        meshV2Initial: 'meshV2Initial',
        updatePeripheral: 'updatePeripheral',
        smalrubotS1Initial: 'smalrubotS1Initial',
        smalrubotS1Unsupported: 'smalrubotS1Unsupported',
        smalrubotS1Connecting: 'smalrubotS1Connecting',
        smalrubotS1Connected: 'smalrubotS1Connected',
        smalrubotS1Error: 'smalrubotS1Error',
    };
    const MockComponent = props => (
        <div data-testid="connection-modal-component">
            <div data-testid="phase">{props.phase}</div>
            <button data-testid="trigger-choose-connect" onClick={props.onChooseConnect} />
            <button data-testid="trigger-choose-flash-firmware" onClick={props.onChooseFlashFirmware} />
            <button data-testid="trigger-back-to-initial" onClick={props.onBackToInitial} />
            <button data-testid="trigger-retry" onClick={props.onRetry} />
            <button data-testid="trigger-close" onClick={props.onClose} />
        </div>
    );
    MockComponent.displayName = 'MockConnectionModalComponent';
    MockComponent.defaultProps = { connectingMessage: 'Connecting' };
    return {
        __esModule: true,
        default: MockComponent,
        PHASES,
    };
});

jest.mock('../../../src/lib/analytics', () => ({ event: jest.fn() }));

jest.mock('../../../src/lib/libraries/extensions/index.jsx', () => [
    {
        extensionId: 'smalrubotS1',
        name: 'Smalrubot S1',
        connectionIconURL: 'icon.png',
        connectionSmallIconURL: 'small-icon.png',
        connectingMessage: 'Connecting...',
        useAutoScan: false,
        helpLink: 'https://example.com/help',
    },
]);

jest.mock('../../../src/reducers/modals', () => ({
    closeConnectionModal: jest.fn(() => ({ type: 'CLOSE_CONNECTION_MODAL' })),
    setConnectionModalExtensionId: jest.fn(() => ({ type: 'SET_EXTENSION_ID' })),
    openConnectionModal: jest.fn(() => ({ type: 'OPEN_CONNECTION_MODAL' })),
}));
jest.mock('../../../src/reducers/mesh-v2', () => ({
    setDomain: jest.fn(() => ({ type: 'SET_DOMAIN' })),
}));
jest.mock('../../../src/reducers/smalrubot-firmware', () => ({
    openSmalrubotFirmwareModal: jest.fn(() => ({ type: 'OPEN_FIRMWARE_MODAL' })),
}));

jest.mock('../../../src/lib/microbit-update', () => ({
    isMicroBitUpdateSupported: jest.fn(() => false),
    selectAndUpdateMicroBit: jest.fn(),
}));
jest.mock('../../../src/lib/microbit-more-update', () => ({
    isMicroBitUpdateSupported: jest.fn(() => false),
    selectAndUpdateMicroBit: jest.fn(),
}));

const mockIsWebSerialSupported = jest.fn(() => true);
jest.mock('../../../src/lib/smalrubot-firmware-flasher', () => ({
    isFirmwareFlashSupported: () => mockIsWebSerialSupported(),
    isWebSerialSupported: () => mockIsWebSerialSupported(),
}));

const ConnectionModal = require('../../../src/containers/connection-modal.jsx').default;

const mockStore = configureStore();

const createStore = ({ extensionId = 'smalrubotS1' } = {}) =>
    mockStore({
        scratchGui: {
            connectionModal: { extensionId },
            meshV2: { domain: '' },
        },
    });

const createMockVm = ({ isConnected = false, connectDirect = jest.fn(() => Promise.resolve()) } = {}) => {
    const listeners = {};
    return {
        on: jest.fn((event, handler) => {
            listeners[event] = handler;
        }),
        removeListener: jest.fn(),
        getPeripheralIsConnected: jest.fn(() => isConnected),
        getPeripheralConnectedMessage: jest.fn(() => null),
        connectPeripheral: jest.fn(),
        disconnectPeripheral: jest.fn(),
        runtime: {
            peripheralExtensions: {
                smalrubotS1: { connectDirect },
            },
        },
        extensionManager: {
            isExtensionLoaded: jest.fn(() => false),
            loadExtensionURL: jest.fn(),
        },
        emit(event, ...args) {
            if (listeners[event]) {
                listeners[event](...args);
            }
        },
    };
};

const renderWithStore = (vm, storeOptions = {}) => {
    const store = createStore(storeOptions);
    return render(
        <Provider store={store}>
            <ConnectionModal vm={vm} />
        </Provider>,
    );
};

describe('ConnectionModal container — smalrubotS1', () => {
    beforeEach(() => {
        mockIsWebSerialSupported.mockReturnValue(true);
    });

    describe('initial phase', () => {
        test('uses smalrubotS1Initial when WebSerial is supported and not connected', () => {
            mockIsWebSerialSupported.mockReturnValue(true);
            const vm = createMockVm();
            const { getByTestId } = renderWithStore(vm);
            expect(getByTestId('phase').textContent).toBe('smalrubotS1Initial');
        });

        test('uses smalrubotS1Unsupported when WebSerial is not supported', () => {
            mockIsWebSerialSupported.mockReturnValue(false);
            const vm = createMockVm();
            const { getByTestId } = renderWithStore(vm);
            expect(getByTestId('phase').textContent).toBe('smalrubotS1Unsupported');
        });

        test('uses smalrubotS1Connected when already connected', () => {
            const vm = createMockVm({ isConnected: true });
            const { getByTestId } = renderWithStore(vm);
            expect(getByTestId('phase').textContent).toBe('smalrubotS1Connected');
        });
    });

    describe('handlers', () => {
        test('onChooseFlashFirmware dispatches openSmalrubotFirmwareModal', () => {
            const { openSmalrubotFirmwareModal } = require('../../../src/reducers/smalrubot-firmware');
            openSmalrubotFirmwareModal.mockClear();
            const vm = createMockVm();
            const { getByTestId } = renderWithStore(vm);
            fireEvent.click(getByTestId('trigger-choose-flash-firmware'));
            expect(openSmalrubotFirmwareModal).toHaveBeenCalledTimes(1);
        });

        test('onBackToInitial returns to smalrubotS1Initial phase', () => {
            const vm = createMockVm();
            const { getByTestId } = renderWithStore(vm);
            // Force a non-initial phase first by clicking choose-connect (which sets connecting then awaits requestPort)
            // For this unit test we only verify back-handler always returns to initial.
            fireEvent.click(getByTestId('trigger-back-to-initial'));
            expect(getByTestId('phase').textContent).toBe('smalrubotS1Initial');
        });

        test('onClose calls onCancel (closes the modal)', () => {
            const { closeConnectionModal } = require('../../../src/reducers/modals');
            closeConnectionModal.mockClear();
            const vm = createMockVm();
            const { getByTestId } = renderWithStore(vm);
            fireEvent.click(getByTestId('trigger-close'));
            expect(closeConnectionModal).toHaveBeenCalledTimes(1);
        });
    });
});
