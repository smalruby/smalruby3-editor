/* eslint-env jest */
/**
 * 先生用フローティングパネルのポーリング (#1203) — パネルを開いている間・タブ表示中だけ
 * 30 秒ごとにメンバーと提出を取得する。閉じる/非表示で止まり、手動更新もできる。
 */
import { act, renderHook } from '@testing-library/react';
import useTeacherPanelPolling from '../../../src/containers/use-teacher-panel-polling.js';

const mockListMembers = jest.fn();
const mockListSubmissions = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        listMembers: (...args) => mockListMembers(...args),
        listSubmissions: (...args) => mockListSubmissions(...args),
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
        await Promise.resolve();
    });
};

const advance = async (ms) => {
    await act(async () => {
        jest.advanceTimersByTime(ms);
    });
    await flush();
};

const baseProps = { open: true, loggedIn: true, classroomId: 'c1', intervalMs: 30000 };

describe('useTeacherPanelPolling (#1203)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockListMembers.mockReset();
        mockListSubmissions.mockReset();
        mockListMembers.mockResolvedValue({ members: [{ memberId: 'seat-01', nickname: 'a' }] });
        mockListSubmissions.mockResolvedValue({
            submissions: [{ memberId: 'seat-01', submissionId: 's1', submittedAt: '2026-10-25T00:00:00Z' }],
        });
        setVisibility('visible');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('fetches right away when opened, then every interval', async () => {
        const onMembers = jest.fn();
        renderHook(() => useTeacherPanelPolling({ ...baseProps, onMembers }));
        await flush();
        expect(mockListMembers).toHaveBeenCalledTimes(1);
        expect(mockListMembers).toHaveBeenCalledWith('teacher-token', 'c1');
        expect(mockListSubmissions).toHaveBeenCalledWith('teacher-token', 'c1');
        expect(onMembers).toHaveBeenCalledWith('c1', [
            expect.objectContaining({ memberId: 'seat-01', hasSubmission: true }),
        ]);
        await advance(29999);
        expect(mockListMembers).toHaveBeenCalledTimes(1);
        await advance(1);
        expect(mockListMembers).toHaveBeenCalledTimes(2);
    });

    test('does not poll while the panel is closed', async () => {
        renderHook(() => useTeacherPanelPolling({ ...baseProps, open: false, onMembers: jest.fn() }));
        await advance(60000);
        expect(mockListMembers).not.toHaveBeenCalled();
    });

    test('stops when the panel closes', async () => {
        const { rerender } = renderHook((props) => useTeacherPanelPolling(props), {
            initialProps: { ...baseProps, onMembers: jest.fn() },
        });
        await flush();
        expect(mockListMembers).toHaveBeenCalledTimes(1);
        rerender({ ...baseProps, open: false, onMembers: jest.fn() });
        await advance(90000);
        expect(mockListMembers).toHaveBeenCalledTimes(1);
    });

    test('pauses while the tab is hidden and asks again on return', async () => {
        renderHook(() => useTeacherPanelPolling({ ...baseProps, onMembers: jest.fn() }));
        await flush();
        expect(mockListMembers).toHaveBeenCalledTimes(1);
        act(() => setVisibility('hidden'));
        await advance(90000);
        expect(mockListMembers).toHaveBeenCalledTimes(1);
        act(() => setVisibility('visible'));
        await flush();
        expect(mockListMembers).toHaveBeenCalledTimes(2);
    });

    test('refresh() fetches now', async () => {
        const onMembers = jest.fn();
        const { result } = renderHook(() => useTeacherPanelPolling({ ...baseProps, onMembers }));
        await flush();
        await act(async () => {
            await result.current.refresh();
        });
        expect(mockListMembers).toHaveBeenCalledTimes(2);
    });

    test('reports errors without stopping', async () => {
        mockListMembers.mockRejectedValueOnce(new Error('network'));
        const onMembers = jest.fn();
        const onError = jest.fn();
        renderHook(() => useTeacherPanelPolling({ ...baseProps, onMembers, onError }));
        await flush();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onMembers).not.toHaveBeenCalled();
        await advance(30000);
        expect(onMembers).toHaveBeenCalledTimes(1);
    });
});
