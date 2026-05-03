/**
 * Integration-style unit test for meshV2 connected message display.
 *
 * Tests the full flow: ConnectionModal container receives PERIPHERAL_CONNECTED
 * event → state.connectedMessage updated → ConnectedStep displays the message.
 *
 * This is a regression test for issue #132:
 * "meshV2 connection modal does not show group name after connecting"
 */
import '@testing-library/jest-dom';
import { render, act } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ConnectionModal from '../../../src/containers/connection-modal.jsx';

// Use the real ConnectionModalComponent but mock sub-steps to avoid full render complexity
jest.mock('../../../src/components/connection-modal/connection-modal.jsx', () => {
    const React = require('react');
    const ConnectedStep = require('../../../src/components/connection-modal/connected-step.jsx').default;
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
    const MockConnectionModalComponent = (props) => (
        <div data-testid="modal">
            {props.phase === PHASES.connected && (
                <ConnectedStep
                    connectedMessage={props.connectedMessage}
                    connectionIconURL={props.connectionIconURL || 'icon.png'}
                    onCancel={props.onCancel}
                    onDisconnect={props.onDisconnect}
                />
            )}
        </div>
    );
    MockConnectionModalComponent.displayName = 'MockConnectionModalComponent';
    MockConnectionModalComponent.defaultProps = { connectingMessage: 'Connecting' };
    return {
        __esModule: true,
        default: MockConnectionModalComponent,
        PHASES,
    };
});

jest.mock('../../../src/lib/analytics', () => ({ event: jest.fn() }));

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

jest.mock('../../../src/reducers/modals', () => ({
    closeConnectionModal: jest.fn(() => ({ type: 'CLOSE_CONNECTION_MODAL' })),
    setConnectionModalExtensionId: jest.fn(() => ({ type: 'SET_EXTENSION_ID' })),
    openConnectionModal: jest.fn(() => ({ type: 'OPEN_CONNECTION_MODAL' })),
}));
jest.mock('../../../src/reducers/mesh-v2', () => ({
    setDomain: jest.fn(() => ({ type: 'SET_DOMAIN' })),
}));
jest.mock('../../../src/lib/microbit-update', () => ({
    isMicroBitUpdateSupported: jest.fn(() => false),
    selectAndUpdateMicroBit: jest.fn(),
}));
jest.mock('../../../src/lib/microbit-more-update', () => ({
    isMicroBitUpdateSupported: jest.fn(() => false),
    selectAndUpdateMicroBit: jest.fn(),
}));

const mockStore = configureStore();

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

const renderModal = (vm) => {
    const store = mockStore({
        scratchGui: {
            connectionModal: { extensionId: 'meshV2' },
            meshV2: { domain: '' },
        },
    });
    return render(
        <IntlProvider locale="en" messages={{}}>
            <Provider store={store}>
                <ConnectionModal vm={vm} />
            </Provider>
        </IntlProvider>,
    );
};

describe('meshV2 connected message display (regression: issue #132)', () => {
    test('displays group name after creating a group (registeredHost)', () => {
        const vm = createMockVm({ isConnected: false, connectedMessage: null });
        const { getByText, queryByText } = renderModal(vm);

        // Initially not in connected phase, so "Connected" text is not shown
        expect(queryByText('Connected')).toBeNull();

        // Simulate: user creates a group → VM connects → emits PERIPHERAL_CONNECTED
        vm.getPeripheralConnectedMessage.mockReturnValue('Registered Host Mesh [ABC-123]');
        act(() => {
            vm.emit('PERIPHERAL_CONNECTED');
        });

        // After connection, the group name should be displayed
        expect(getByText('Registered Host Mesh [ABC-123]')).toBeInTheDocument();
        expect(queryByText('Connected')).toBeNull();
    });

    test('displays group name after joining a group (joinedMesh)', () => {
        const vm = createMockVm({ isConnected: false, connectedMessage: null });
        const { getByText, queryByText } = renderModal(vm);

        // Simulate: user joins a group → VM connects → emits PERIPHERAL_CONNECTED
        vm.getPeripheralConnectedMessage.mockReturnValue('Joined Mesh [XYZ-789]');
        act(() => {
            vm.emit('PERIPHERAL_CONNECTED');
        });

        // After connection, the joined group name should be displayed
        expect(getByText('Joined Mesh [XYZ-789]')).toBeInTheDocument();
        expect(queryByText('Connected')).toBeNull();
    });

    test('displays default "Connected" when already connected without a connectedMessage', () => {
        // When the modal opens while already connected but no message is available
        const vm = createMockVm({ isConnected: true, connectedMessage: null });
        const { getByText } = renderModal(vm);

        // Should fall back to "Connected"
        expect(getByText('Connected')).toBeInTheDocument();
    });

    test('displays group name when modal opens while already connected', () => {
        // When the modal opens while already connected with an existing message
        const vm = createMockVm({
            isConnected: true,
            connectedMessage: 'Registered Host Mesh [EXISTING]',
        });
        const { getByText, queryByText } = renderModal(vm);

        expect(getByText('Registered Host Mesh [EXISTING]')).toBeInTheDocument();
        expect(queryByText('Connected')).toBeNull();
    });
});
