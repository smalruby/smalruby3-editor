/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { MeshStatusPopupContainer } from '../../../src/containers/mesh-status-popup.jsx';

// #1844 review M2: listNodesInGroup (via refreshGroupNodes) is asked only while the
// window is open — on open, on connect, and every 30 seconds — never while it is closed.

const makeVm = (connectionState = 'connected') => {
    const vm = new EventEmitter();
    const ext = {
        connectionState,
        refreshGroupNodes: jest.fn(() => Promise.resolve([])),
        getStatusSnapshot: jest.fn(() => ({
            connected: ext.connectionState === 'connected',
            groupId: ext.connectionState === 'connected' ? 'g1' : null,
            useWebSocket: true,
            groupLabel: 'かな',
            nodeCount: 1,
            selfId: 'self',
            inClassroom: false,
            nodes: [],
            history: [],
        })),
    };
    vm.runtime = { peripheralExtensions: { meshV2: ext } };
    return { vm, ext };
};

const renderContainer = (props) => {
    const all = { isOpen: false, onClose: jest.fn(), onOpenConnection: jest.fn(), ...props };
    const utils = render(
        <IntlProvider locale="en">
            <MeshStatusPopupContainer {...all} />
        </IntlProvider>,
    );
    const rerender = (next) =>
        utils.rerender(
            <IntlProvider locale="en">
                <MeshStatusPopupContainer {...all} {...next} />
            </IntlProvider>,
        );
    return { ...utils, rerender };
};

const advance = async (ms) => {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
};

describe('MeshStatusPopupContainer node list requests (#1844)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('asks nothing while closed, once on open, every 30 seconds while open, and stops on close', async () => {
        const { vm, ext } = makeVm();
        const { rerender, queryByTestId } = renderContainer({ vm });
        await advance(120000);
        expect(ext.refreshGroupNodes).not.toHaveBeenCalled();
        expect(ext.getStatusSnapshot).not.toHaveBeenCalled();
        expect(queryByTestId('mesh-status-popup')).toBeNull();

        await act(async () => rerender({ isOpen: true }));
        expect(ext.refreshGroupNodes).toHaveBeenCalledTimes(1);
        expect(queryByTestId('mesh-status-popup')).toBeInTheDocument();
        await advance(29999);
        expect(ext.refreshGroupNodes).toHaveBeenCalledTimes(1);
        await advance(1);
        expect(ext.refreshGroupNodes).toHaveBeenCalledTimes(2);
        await advance(30000);
        expect(ext.refreshGroupNodes).toHaveBeenCalledTimes(3);

        await act(async () => rerender({ isOpen: false }));
        await advance(120000);
        expect(ext.refreshGroupNodes).toHaveBeenCalledTimes(3);
        expect(vm.listenerCount('PERIPHERAL_CONNECTED')).toBe(0);
    });

    test('asks once on connect while open, and not while not connected', async () => {
        const { vm, ext } = makeVm('disconnected');
        renderContainer({ vm, isOpen: true });
        await advance(60000);
        expect(ext.refreshGroupNodes).not.toHaveBeenCalled();
        ext.connectionState = 'connected';
        await act(async () => vm.emit('PERIPHERAL_CONNECTED'));
        expect(ext.refreshGroupNodes).toHaveBeenCalledTimes(1);
    });

    test('a closed window does not listen for connect', async () => {
        const { vm, ext } = makeVm('connected');
        renderContainer({ vm });
        await act(async () => vm.emit('PERIPHERAL_CONNECTED'));
        expect(ext.refreshGroupNodes).not.toHaveBeenCalled();
    });
});
