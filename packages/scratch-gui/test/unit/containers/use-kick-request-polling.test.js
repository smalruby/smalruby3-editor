/* eslint-env jest */
/**
 * 退室依頼の承認待ちポーリング (#1198) — 依頼が生きている間・タブ表示中だけ
 * lookup し、承認 / 却下 / 期限切れを通知する。
 */
import { act, renderHook } from '@testing-library/react';
import useKickRequestPolling from '../../../src/containers/use-kick-request-polling.js';
import { savePendingKickRequest, clearPendingKickRequest } from '../../../src/lib/classroom-kick-request-storage.js';

const mockLookupClassroom = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        lookupClassroom: (...args) => mockLookupClassroom(...args),
    },
}));

const PENDING = {
    requestId: 'r1',
    joinCode: 'ABC123',
    seatNumber: 7,
    createdAt: new Date().toISOString(),
};

const setVisibility = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
};

// Let the awaited lookup promise settle inside the fake-timer world.
const flush = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

describe('useKickRequestPolling (#1198)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockLookupClassroom.mockReset();
        window.localStorage.clear();
        savePendingKickRequest(PENDING);
        setVisibility('visible');
    });

    afterEach(() => {
        jest.useRealTimers();
        clearPendingKickRequest();
    });

    test('reports approved when the requested seat becomes free', async () => {
        mockLookupClassroom.mockResolvedValue({ takenSeats: [1], activeKickRequestIds: [] });
        const onResult = jest.fn();
        renderHook(() => useKickRequestPolling({ pending: PENDING, enabled: true, hasSession: false, onResult }));
        await act(async () => {
            jest.advanceTimersByTime(5000);
        });
        await flush();
        expect(mockLookupClassroom).toHaveBeenCalledWith('ABC123');
        expect(onResult).toHaveBeenCalledWith('approved', { takenSeats: [1], activeKickRequestIds: [] });
    });

    test('keeps polling while waiting and stops after the answer', async () => {
        mockLookupClassroom
            .mockResolvedValueOnce({ takenSeats: [7], activeKickRequestIds: ['r1'] })
            .mockResolvedValueOnce({ takenSeats: [7], activeKickRequestIds: [] });
        const onResult = jest.fn();
        renderHook(() => useKickRequestPolling({ pending: PENDING, enabled: true, hasSession: false, onResult }));
        await act(async () => {
            jest.advanceTimersByTime(5000);
        });
        await flush();
        expect(onResult).toHaveBeenLastCalledWith('waiting', expect.anything());
        await act(async () => {
            jest.advanceTimersByTime(5000);
        });
        await flush();
        expect(onResult).toHaveBeenLastCalledWith('rejected', expect.anything());
        await act(async () => {
            jest.advanceTimersByTime(20000);
        });
        await flush();
        expect(mockLookupClassroom).toHaveBeenCalledTimes(2);
    });

    test('does not poll while the tab is hidden, and checks at once when shown again', async () => {
        mockLookupClassroom.mockResolvedValue({ takenSeats: [7], activeKickRequestIds: ['r1'] });
        const onResult = jest.fn();
        renderHook(() => useKickRequestPolling({ pending: PENDING, enabled: true, hasSession: false, onResult }));
        act(() => setVisibility('hidden'));
        await act(async () => {
            jest.advanceTimersByTime(60000);
        });
        await flush();
        expect(mockLookupClassroom).not.toHaveBeenCalled();
        act(() => setVisibility('visible'));
        await act(async () => {
            jest.advanceTimersByTime(0);
        });
        await flush();
        expect(mockLookupClassroom).toHaveBeenCalledTimes(1);
    });

    test('does not poll once the student has joined or when disabled', async () => {
        const onResult = jest.fn();
        const { rerender } = renderHook((props) => useKickRequestPolling({ pending: PENDING, onResult, ...props }), {
            initialProps: { enabled: true, hasSession: true },
        });
        await act(async () => {
            jest.advanceTimersByTime(10000);
        });
        rerender({ enabled: false, hasSession: false });
        await act(async () => {
            jest.advanceTimersByTime(10000);
        });
        expect(mockLookupClassroom).not.toHaveBeenCalled();
    });

    test('reports expired without calling the server once the stored request is gone', async () => {
        clearPendingKickRequest();
        const onResult = jest.fn();
        renderHook(() => useKickRequestPolling({ pending: PENDING, enabled: true, hasSession: false, onResult }));
        await act(async () => {
            jest.advanceTimersByTime(5000);
        });
        expect(onResult).toHaveBeenCalledWith('expired', null);
        expect(mockLookupClassroom).not.toHaveBeenCalled();
    });
});
