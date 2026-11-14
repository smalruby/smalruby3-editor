/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { MeshStatusButton } from '../../../src/components/mesh-status-button/mesh-status-button.jsx';
import MeshStatusPopup from '../../../src/components/mesh-status-popup/mesh-status-popup.jsx';
import reducer, { closeMeshV2StatusPopup, openMeshV2StatusPopup } from '../../../src/reducers/mesh-v2.js';

const renderIntl = (ui) => render(<IntlProvider locale="en">{ui}</IntlProvider>);

const connectedSnapshot = (overrides = {}) => ({
    connected: true,
    useWebSocket: true,
    groupLabel: 'いしかたうん',
    nodeCount: 2,
    selfId: 'self',
    inClassroom: false,
    nodes: [
        { id: 'self', seat: null, isSelf: true, lastDataAt: null, variables: [] },
        {
            id: 'p1',
            seat: null,
            isSelf: false,
            lastDataAt: new Date(2026, 10, 14, 10, 0, 5).getTime(),
            variables: [{ name: 'score', value: '42', at: 1 }],
        },
    ],
    history: [],
    ...overrides,
});

const history = (n) =>
    Array.from({ length: n }, (_v, i) => ({
        direction: i % 2 ? 'sent' : 'received',
        name: `m${i}`,
        value: i % 3 ? `v${i}` : '',
        nodeId: i % 2 ? 'self' : 'p1',
        at: new Date(2026, 10, 14, 10, 0, i).getTime(),
    }));

describe('mesh status reducer (#1844)', () => {
    test('opens and closes the window', () => {
        let state = reducer(undefined, { type: '@@INIT' });
        expect(state.statusPopupOpen).toBe(false);
        state = reducer(state, openMeshV2StatusPopup());
        expect(state.statusPopupOpen).toBe(true);
        state = reducer(state, closeMeshV2StatusPopup());
        expect(state.statusPopupOpen).toBe(false);
    });
});

describe('MeshStatusPopup (#1844)', () => {
    test('shows the connection, group, count and each node with its variables', () => {
        const { getByTestId, getAllByTestId } = renderIntl(
            <MeshStatusPopup onClose={jest.fn()} peers={{ p1: 1 }} snapshot={connectedSnapshot()} />,
        );
        expect(getByTestId('mesh-status-connection')).toHaveTextContent('Connected (WebSocket)');
        expect(getByTestId('mesh-status-group')).toHaveTextContent('【いしかたうん】');
        expect(getByTestId('mesh-status-count')).toHaveTextContent('2 people');
        const nodes = getAllByTestId('mesh-status-node');
        expect(nodes[0]).toHaveTextContent('You');
        expect(nodes[0]).toHaveTextContent('No variables yet');
        expect(nodes[1]).toHaveTextContent('Partner 1');
        expect(nodes[1]).toHaveTextContent('score');
        expect(nodes[1]).toHaveTextContent('42');
        expect(nodes[1]).toHaveTextContent('10:00:05');
    });

    test('labels nodes by seat in a class', () => {
        const snapshot = connectedSnapshot({
            selfId: 'aas03',
            inClassroom: true,
            nodes: [
                { id: 'aas03', seat: 3, isSelf: true, lastDataAt: null, variables: [] },
                { id: 'bbs12', seat: 12, isSelf: false, lastDataAt: null, variables: [] },
            ],
        });
        const { getAllByTestId } = renderIntl(<MeshStatusPopup onClose={jest.fn()} peers={{}} snapshot={snapshot} />);
        const nodes = getAllByTestId('mesh-status-node');
        expect(nodes[0]).toHaveTextContent('No. 03 (you)');
        expect(nodes[1]).toHaveTextContent('No. 12');
    });

    test('polling and not connected; the connect button opens the connection', () => {
        const { getByTestId, rerender } = renderIntl(
            <MeshStatusPopup onClose={jest.fn()} peers={{}} snapshot={connectedSnapshot({ useWebSocket: false })} />,
        );
        expect(getByTestId('mesh-status-connection')).toHaveTextContent('polling');
        const onConnect = jest.fn();
        rerender(
            <IntlProvider locale="en">
                <MeshStatusPopup
                    onClose={jest.fn()}
                    onConnect={onConnect}
                    peers={{}}
                    snapshot={connectedSnapshot({ connected: false, nodes: [] })}
                />
            </IntlProvider>,
        );
        expect(getByTestId('mesh-status-connection')).toHaveTextContent('Not connected');
        fireEvent.click(getByTestId('mesh-status-connect'));
        expect(onConnect).toHaveBeenCalledTimes(1);
    });

    test('history shows 3 items, newest first, and expands to 50', () => {
        const { getByTestId, getAllByTestId } = renderIntl(
            <MeshStatusPopup
                onClose={jest.fn()}
                peers={{ p1: 1 }}
                snapshot={connectedSnapshot({ history: history(60) })}
            />,
        );
        fireEvent.click(getByTestId('mesh-status-tab-history'));
        let items = getAllByTestId('mesh-status-history-item');
        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent('m0');
        expect(items[0]).toHaveTextContent('Received');
        expect(items[0]).toHaveTextContent('Partner 1');
        expect(items[0]).toHaveTextContent('(no value)');
        expect(items[1]).toHaveTextContent('Sent');
        expect(items[1]).toHaveTextContent('You');
        expect(items[1]).toHaveTextContent('v1');
        fireEvent.click(getByTestId('mesh-status-history-expand'));
        items = getAllByTestId('mesh-status-history-item');
        expect(items).toHaveLength(50);
    });

    test('empty history and close', () => {
        const onClose = jest.fn();
        const { getByTestId } = renderIntl(
            <MeshStatusPopup onClose={onClose} peers={{}} snapshot={connectedSnapshot()} />,
        );
        fireEvent.click(getByTestId('mesh-status-tab-history'));
        expect(getByTestId('mesh-status-history-empty')).toHaveTextContent('No messages yet');
        fireEvent.click(getByTestId('mesh-status-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('the header drags the window', () => {
        const { getByTestId } = renderIntl(
            <MeshStatusPopup onClose={jest.fn()} peers={{}} snapshot={connectedSnapshot()} />,
        );
        const popup = getByTestId('mesh-status-popup');
        const before = { left: parseFloat(popup.style.left), top: parseFloat(popup.style.top) };
        act(() => {
            // jsdom has no PointerEvent; a MouseEvent named pointerdown carries clientX/Y.
            getByTestId('mesh-status-drag-handle').dispatchEvent(
                new MouseEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 100, button: 0 }),
            );
        });
        act(() => {
            window.dispatchEvent(new MouseEvent('pointermove', { clientX: 400, clientY: 150 }));
            window.dispatchEvent(new MouseEvent('pointerup', {}));
        });
        expect(parseFloat(popup.style.left)).toBe(before.left - 100);
        expect(parseFloat(popup.style.top)).toBe(before.top + 50);
    });
});

describe('MeshStatusPopup keyboard and focus (#1844 review FYI1)', () => {
    test('Escape closes the window', () => {
        const onClose = jest.fn();
        const { getByTestId } = renderIntl(
            <MeshStatusPopup onClose={onClose} peers={{}} snapshot={connectedSnapshot()} />,
        );
        fireEvent.keyDown(getByTestId('mesh-status-tab-status'), { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('focus moves into the window on open and back to the opener on close', () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { getByTestId, unmount } = renderIntl(
            <MeshStatusPopup onClose={jest.fn()} peers={{}} snapshot={connectedSnapshot()} />,
        );
        expect(getByTestId('mesh-status-popup')).toHaveFocus();
        unmount();
        expect(opener).toHaveFocus();
        opener.remove();
    });

    test('tabs follow the tabs pattern and the arrow keys switch them', () => {
        const { getByTestId } = renderIntl(
            <MeshStatusPopup onClose={jest.fn()} peers={{}} snapshot={connectedSnapshot()} />,
        );
        const statusTab = getByTestId('mesh-status-tab-status');
        const historyTab = getByTestId('mesh-status-tab-history');
        const panel = getByTestId('mesh-status-panel');
        expect(statusTab).toHaveAttribute('role', 'tab');
        expect(statusTab).toHaveAttribute('aria-controls', panel.id);
        expect(historyTab).toHaveAttribute('aria-controls', panel.id);
        expect(panel).toHaveAttribute('role', 'tabpanel');
        expect(panel).toHaveAttribute('aria-labelledby', statusTab.id);
        expect(statusTab).toHaveAttribute('tabindex', '0');
        expect(historyTab).toHaveAttribute('tabindex', '-1');
        fireEvent.keyDown(statusTab, { key: 'ArrowRight' });
        expect(historyTab).toHaveAttribute('aria-selected', 'true');
        expect(historyTab).toHaveFocus();
        expect(panel).toHaveAttribute('aria-labelledby', historyTab.id);
        fireEvent.keyDown(historyTab, { key: 'ArrowLeft' });
        expect(statusTab).toHaveAttribute('aria-selected', 'true');
        expect(statusTab).toHaveFocus();
    });
});

describe('MeshStatusButton (#1844)', () => {
    const makeVm = (loaded, state = 'disconnected') => {
        const vm = new EventEmitter();
        vm.loaded = loaded;
        vm.extensionManager = { isExtensionLoaded: (id) => id === 'meshV2' && vm.loaded };
        vm.runtime = { peripheralExtensions: { meshV2: { connectionState: state } } };
        return vm;
    };

    test('is hidden without the mesh extension and appears when it is added', () => {
        const vm = makeVm(false);
        const { queryByTestId } = renderIntl(<MeshStatusButton onToggle={jest.fn()} vm={vm} />);
        expect(queryByTestId('mesh-status-button')).toBeNull();
        jest.useFakeTimers();
        // EXTENSION_ADDED comes before isExtensionLoaded() turns true (as in the real VM)
        act(() => {
            vm.emit('EXTENSION_ADDED');
            vm.loaded = true;
        });
        act(() => {
            jest.runOnlyPendingTimers();
        });
        jest.useRealTimers();
        expect(queryByTestId('mesh-status-button')).toBeInTheDocument();
        expect(queryByTestId('mesh-status-button-disconnected')).toBeInTheDocument();
        act(() => {
            vm.runtime.peripheralExtensions.meshV2.connectionState = 'connected';
            vm.emit('PERIPHERAL_CONNECTED');
        });
        expect(queryByTestId('mesh-status-button-connected')).toBeInTheDocument();
    });

    test('clicking toggles the window', () => {
        const onToggle = jest.fn();
        const { getByTestId } = renderIntl(<MeshStatusButton onToggle={onToggle} vm={makeVm(true)} />);
        fireEvent.click(getByTestId('mesh-status-button'));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});
