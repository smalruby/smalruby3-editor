/* eslint-env jest */
/**
 * 生徒のハートビート hook (issue #1197) — 参加中は一定間隔で lastActiveAt を更新し、
 * タブ非表示の間は止め、kick (410) / セッション失効 (401) で止める。
 */
import { act, renderHook } from '@testing-library/react';
import useClassroomHeartbeat from '../../../src/containers/use-classroom-heartbeat.js';

const mockHeartbeat = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        heartbeat: (...args) => mockHeartbeat(...args),
    },
}));

const INTERVAL = 1000;

const setHidden = (hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
};

const httpError = (status) => {
    const err = new Error(`API error ${status}`);
    err.status = status;
    return err;
};

// Let the rejected heartbeat promise settle so the hook can react to it.
const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

describe('useClassroomHeartbeat (issue #1197)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockHeartbeat.mockReset().mockResolvedValue(null);
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('セッションが無ければ呼ばない', () => {
        renderHook(() => useClassroomHeartbeat({ sessionToken: null, intervalMs: INTERVAL }));
        act(() => jest.advanceTimersByTime(INTERVAL * 3));
        expect(mockHeartbeat).not.toHaveBeenCalled();
    });

    test('参加中は開始時に 1 回、以後は間隔ごとに呼ぶ', () => {
        renderHook(() => useClassroomHeartbeat({ sessionToken: 'tok', intervalMs: INTERVAL }));
        expect(mockHeartbeat).toHaveBeenCalledTimes(1);
        expect(mockHeartbeat).toHaveBeenCalledWith('tok');
        act(() => jest.advanceTimersByTime(INTERVAL));
        expect(mockHeartbeat).toHaveBeenCalledTimes(2);
        act(() => jest.advanceTimersByTime(INTERVAL * 2));
        expect(mockHeartbeat).toHaveBeenCalledTimes(4);
    });

    test('タブが非表示の間は止め、表示に戻ったらすぐ再開する', () => {
        renderHook(() => useClassroomHeartbeat({ sessionToken: 'tok', intervalMs: INTERVAL }));
        expect(mockHeartbeat).toHaveBeenCalledTimes(1);

        act(() => setHidden(true));
        act(() => jest.advanceTimersByTime(INTERVAL * 5));
        expect(mockHeartbeat).toHaveBeenCalledTimes(1);

        act(() => setHidden(false));
        expect(mockHeartbeat).toHaveBeenCalledTimes(2);
        act(() => jest.advanceTimersByTime(INTERVAL));
        expect(mockHeartbeat).toHaveBeenCalledTimes(3);
    });

    test('非表示のまま開始したら呼ばない', () => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        renderHook(() => useClassroomHeartbeat({ sessionToken: 'tok', intervalMs: INTERVAL }));
        act(() => jest.advanceTimersByTime(INTERVAL * 3));
        expect(mockHeartbeat).not.toHaveBeenCalled();
    });

    test('kick (410) されたら止め、タブを表示し直しても再開しない', async () => {
        mockHeartbeat.mockRejectedValueOnce(httpError(410));
        renderHook(() => useClassroomHeartbeat({ sessionToken: 'tok', intervalMs: INTERVAL }));
        await flush();

        act(() => jest.advanceTimersByTime(INTERVAL * 3));
        act(() => setHidden(true));
        act(() => setHidden(false));
        expect(mockHeartbeat).toHaveBeenCalledTimes(1);
    });

    test('セッション失効 (401) でも止める', async () => {
        mockHeartbeat.mockRejectedValueOnce(httpError(401));
        renderHook(() => useClassroomHeartbeat({ sessionToken: 'tok', intervalMs: INTERVAL }));
        await flush();
        act(() => jest.advanceTimersByTime(INTERVAL * 3));
        expect(mockHeartbeat).toHaveBeenCalledTimes(1);
    });

    test('一時的な失敗 (ネットワーク / 5xx) では止めない', async () => {
        const netError = new Error('Failed to fetch');
        netError.isNetworkError = true;
        mockHeartbeat.mockRejectedValueOnce(netError).mockRejectedValueOnce(httpError(503));
        renderHook(() => useClassroomHeartbeat({ sessionToken: 'tok', intervalMs: INTERVAL }));
        await flush();
        act(() => jest.advanceTimersByTime(INTERVAL));
        await flush();
        act(() => jest.advanceTimersByTime(INTERVAL));
        expect(mockHeartbeat).toHaveBeenCalledTimes(3);
    });

    test('新しいセッション (再参加) では kick 後でも再開する', async () => {
        mockHeartbeat.mockRejectedValueOnce(httpError(410));
        const { rerender } = renderHook(
            ({ token }) => useClassroomHeartbeat({ sessionToken: token, intervalMs: INTERVAL }),
            { initialProps: { token: 'old' } },
        );
        await flush();
        rerender({ token: 'new' });
        expect(mockHeartbeat).toHaveBeenLastCalledWith('new');
        act(() => jest.advanceTimersByTime(INTERVAL));
        expect(mockHeartbeat).toHaveBeenCalledTimes(3);
    });

    test('退出 (セッション消去) とアンマウントでタイマーを止める', () => {
        const { rerender, unmount } = renderHook(
            ({ token }) => useClassroomHeartbeat({ sessionToken: token, intervalMs: INTERVAL }),
            { initialProps: { token: 'tok' } },
        );
        rerender({ token: null });
        act(() => jest.advanceTimersByTime(INTERVAL * 3));
        expect(mockHeartbeat).toHaveBeenCalledTimes(1);

        rerender({ token: 'tok' });
        unmount();
        act(() => jest.advanceTimersByTime(INTERVAL * 3));
        act(() => setHidden(false));
        expect(mockHeartbeat).toHaveBeenCalledTimes(2);
    });
});
