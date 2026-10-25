/* eslint-env jest */
/**
 * 先生の未処理退室依頼のポーリング (#1200) — ログイン中・タブ表示中だけ 10 秒ごとに
 * 問い合わせ、表示に戻ったらすぐ 1 回問い合わせ、エラーが続くと間隔を伸ばす。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherKickRequestPolling from '../../../src/containers/use-teacher-kick-request-polling.js';

const mockListPending = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        listPendingKickRequests: (...args) => mockListPending(...args),
    },
}));
jest.mock('../../../src/containers/use-teacher-auth.js', () => ({
    getCachedTeacherIdToken: () => 'teacher-token',
}));

const setVisibility = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
};

const flush = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

const advance = async (ms) => {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
    await flush();
};

describe('useTeacherKickRequestPolling (#1200)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockListPending.mockReset();
        mockListPending.mockResolvedValue({ requests: [], activeAssignmentCount: 1 });
        setVisibility('visible');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('asks right away on login, then every interval', async () => {
        const onRequests = jest.fn();
        renderHook(() => useTeacherKickRequestPolling({ loggedIn: true, onRequests, intervalMs: 10000 }));
        await flush();
        expect(mockListPending).toHaveBeenCalledTimes(1);
        expect(mockListPending).toHaveBeenCalledWith('teacher-token');
        expect(onRequests).toHaveBeenCalledWith({ requests: [], activeAssignmentCount: 1 });
        await advance(9999);
        expect(mockListPending).toHaveBeenCalledTimes(1);
        await advance(1);
        expect(mockListPending).toHaveBeenCalledTimes(2);
    });

    test('does not poll while logged out', async () => {
        renderHook(() => useTeacherKickRequestPolling({ loggedIn: false, onRequests: jest.fn(), intervalMs: 10000 }));
        await advance(60000);
        expect(mockListPending).not.toHaveBeenCalled();
    });

    test('stops while hidden and asks immediately when visible again', async () => {
        renderHook(() => useTeacherKickRequestPolling({ loggedIn: true, onRequests: jest.fn(), intervalMs: 10000 }));
        await flush();
        expect(mockListPending).toHaveBeenCalledTimes(1);
        act(() => setVisibility('hidden'));
        await advance(60000);
        expect(mockListPending).toHaveBeenCalledTimes(1);
        act(() => setVisibility('visible'));
        await flush();
        expect(mockListPending).toHaveBeenCalledTimes(2);
    });

    test('backs off after an error', async () => {
        mockListPending.mockRejectedValue(new Error('network'));
        renderHook(() => useTeacherKickRequestPolling({ loggedIn: true, onRequests: jest.fn(), intervalMs: 10000 }));
        await flush();
        expect(mockListPending).toHaveBeenCalledTimes(1);
        await advance(10000);
        expect(mockListPending).toHaveBeenCalledTimes(1);
        await advance(10000);
        expect(mockListPending).toHaveBeenCalledTimes(2);
    });
});
