/* eslint-env jest */
/**
 * モーダルを閉じている間の退室依頼の見張り (#1198)。gui.jsx に常時マウントされるため、
 * classroom reducer を持たない埋め込みでも落ちないこと、承認でモーダルを開き直すことを確認する。
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomKickRequestWatcher from '../../../src/containers/classroom-kick-request-watcher.jsx';
import { savePendingKickRequest, clearPendingKickRequest } from '../../../src/lib/classroom-kick-request-storage.js';
import { KICK_REQUEST_POLL_INTERVAL_MS } from '../../../src/lib/classroom-seat-selection.js';

const mockLookupClassroom = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        lookupClassroom: (...args) => mockLookupClassroom(...args),
    },
}));

const mockStore = configureStore();

const renderWatcher = (scratchGui) => {
    const store = mockStore({ scratchGui });
    render(
        <Provider store={store}>
            <ClassroomKickRequestWatcher />
        </Provider>,
    );
    return store;
};

describe('ClassroomKickRequestWatcher (#1198)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockLookupClassroom.mockReset();
        clearPendingKickRequest();
    });

    afterEach(() => {
        clearPendingKickRequest();
        jest.useRealTimers();
    });

    test('should render without the classroom reducer', () => {
        expect(() => renderWatcher({})).not.toThrow();
    });

    test('should reopen the classroom modal when the seat is freed', async () => {
        savePendingKickRequest({
            requestId: 'r1',
            joinCode: 'ABC123',
            seatNumber: 7,
            createdAt: new Date().toISOString(),
        });
        mockLookupClassroom.mockResolvedValue({ takenSeats: [], activeKickRequestIds: [] });
        const store = renderWatcher({ classroom: { sessionToken: null } });

        await act(async () => {
            jest.advanceTimersByTime(KICK_REQUEST_POLL_INTERVAL_MS);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(mockLookupClassroom).toHaveBeenCalledWith('ABC123');
        expect(store.getActions().map((a) => a.type)).toContain('scratch-gui/classroom/OPEN_MODAL');
    });
});
