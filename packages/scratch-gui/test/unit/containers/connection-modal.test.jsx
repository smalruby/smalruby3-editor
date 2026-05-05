import '@testing-library/jest-dom';
import { render, act } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ConnectionModal from '../../../src/containers/connection-modal.jsx';

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
    };
    const MockComponent = (props) => (
        <div data-testid="connection-modal-component">
            <div data-testid="connected-message">{props.connectedMessage}</div>
            <div data-testid="phase">{props.phase}</div>
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

// Mock analytics
jest.mock('../../../src/lib/analytics', () => ({
    event: jest.fn(),
}));

// Mock extension data
jest.mock('../../../src/lib/libraries/extensions/index.jsx', () => [
    {
        extensionId: 'meshV2',
        name: 'Mesh V2',
        connectionIconURL: 'icon.png',
        connectionSmallIconURL: 'small-icon.png',
        connectionTipIconURL: 'tip-icon.png',
        connectingMessage: 'Connecting...',
        useAutoScan: false,
    },
]);

// Mock reducers
jest.mock('../../../src/reducers/modals', () => ({
    closeConnectionModal: jest.fn(() => ({ type: 'CLOSE_CONNECTION_MODAL' })),
    setConnectionModalExtensionId: jest.fn(() => ({ type: 'SET_EXTENSION_ID' })),
    openConnectionModal: jest.fn(() => ({ type: 'OPEN_CONNECTION_MODAL' })),
}));
jest.mock('../../../src/reducers/mesh-v2', () => ({
    setDomain: jest.fn(() => ({ type: 'SET_DOMAIN' })),
}));

// Mock microbit-update
jest.mock('../../../src/lib/microbit-update', () => ({
    isMicroBitUpdateSupported: jest.fn(() => false),
    selectAndUpdateMicroBit: jest.fn(),
}));
jest.mock('../../../src/lib/microbit-more-update', () => ({
    isMicroBitUpdateSupported: jest.fn(() => false),
    selectAndUpdateMicroBit: jest.fn(),
}));

const mockStore = configureStore();

const createStore = ({ extensionId = 'meshV2', domain = '' } = {}) =>
    mockStore({
        scratchGui: {
            connectionModal: { extensionId },
            meshV2: { domain },
        },
    });

const createMockVm = ({ isConnected = false, connectedMessage = null } = {}) => {
    const listeners = {};
    const vm = {
        on: jest.fn((event, handler) => {
            listeners[event] = handler;
        }),
        removeListener: jest.fn(),
        getPeripheralIsConnected: jest.fn(() => isConnected),
        getPeripheralConnectedMessage: jest.fn(() => connectedMessage),
        connectPeripheral: jest.fn(),
        disconnectPeripheral: jest.fn(),
        runtime: {
            peripheralExtensions: {
                meshV2: { setDomain: jest.fn() },
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
    return vm;
};

const renderWithStore = (vm, storeOptions = {}) => {
    const store = createStore(storeOptions);
    return render(
        <Provider store={store}>
            <ConnectionModal vm={vm} />
        </Provider>,
    );
};

describe('ConnectionModal container', () => {
    describe('state.connectedMessage initialization', () => {
        test('initializes connectedMessage from vm.getPeripheralConnectedMessage when already connected', () => {
            const vm = createMockVm({
                isConnected: true,
                connectedMessage: 'Registered Host Mesh [ABC]',
            });
            const { getByTestId } = renderWithStore(vm);

            expect(vm.getPeripheralConnectedMessage).toHaveBeenCalledWith('meshV2');
            expect(getByTestId('connected-message').textContent).toBe('Registered Host Mesh [ABC]');
        });

        test('initializes connectedMessage as empty string when not connected', () => {
            const vm = createMockVm({ isConnected: false, connectedMessage: null });
            const { getByTestId } = renderWithStore(vm);

            expect(getByTestId('connected-message').textContent).toBe('');
        });
    });

    describe('meshV2 domain handling on modal open', () => {
        test('shows meshV2Initial phase when not connected', () => {
            const vm = createMockVm({ isConnected: false });
            const { getByTestId } = renderWithStore(vm, { domain: 'cached-domain' });

            // Should show meshV2Initial phase (domain input visible)
            expect(getByTestId('phase').textContent).toBe('meshV2Initial');
        });

        test('preserves cached domain in Redux when modal opens', () => {
            const { setDomain } = require('../../../src/reducers/mesh-v2');
            setDomain.mockClear();

            const vm = createMockVm({ isConnected: false });
            renderWithStore(vm, { domain: 'cached-domain' });

            // Should NOT reset domain on modal open (preserves user's previous input)
            expect(setDomain).not.toHaveBeenCalledWith(null);
        });
    });

    describe('handleConnected updates connectedMessage', () => {
        test('updates connectedMessage from vm after PERIPHERAL_CONNECTED event', () => {
            const vm = createMockVm({
                isConnected: false,
                connectedMessage: null,
            });
            const { getByTestId } = renderWithStore(vm);

            // Initially no connected message
            expect(getByTestId('connected-message').textContent).toBe('');

            // Simulate connection: update mock to return message, then emit event
            vm.getPeripheralConnectedMessage.mockReturnValue('Joined Mesh [XYZ]');
            act(() => {
                vm.emit('PERIPHERAL_CONNECTED');
            });

            expect(vm.getPeripheralConnectedMessage).toHaveBeenCalledWith('meshV2');
            expect(getByTestId('connected-message').textContent).toBe('Joined Mesh [XYZ]');
        });
    });
});
