/* eslint-env jest */
/**
 * お知らせセンター hook (EPIC #1111) — 1 日 1 回取得（コスト削減）、
 * localStorage キャッシュ、開封で既読化、リセット。
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import useTeacherNotifications from '../../../src/containers/use-teacher-notifications.js';

const mockListNotifications = jest.fn();
const mockMarkNotificationsRead = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        listNotifications: (...args) => mockListNotifications(...args),
        markNotificationsRead: (...args) => mockMarkNotificationsRead(...args),
    },
}));

// dev-bypass token 相当（JWT でないので email 判定は null → teacher='' 扱い）。
const TOKEN = 'tok';
const STORAGE_KEY = 'smalruby:classroomNotifications';
const todayStr = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const notice = (id, over = {}) => ({
    notificationId: id,
    type: 'admin_message',
    title: 'お知らせ',
    body: '本文',
    link: null,
    readAt: null,
    createdAt: '2026-07-26T00:00:00.000Z',
    ...over,
});

const handleTeacher401 = jest.fn();

describe('useTeacherNotifications (EPIC #1111 / 日次取得)', () => {
    beforeEach(() => {
        window.localStorage.clear();
        mockListNotifications.mockReset().mockResolvedValue({ notifications: [], unreadCount: 0 });
        mockMarkNotificationsRead.mockReset().mockResolvedValue({ updated: 0 });
    });

    test('idToken が無ければ取得しない', () => {
        renderHook(() => useTeacherNotifications({ idToken: null, handleTeacher401 }));
        expect(mockListNotifications).not.toHaveBeenCalled();
    });

    test('その日はじめてのオープンで 1 回だけ取得しキャッシュする', async () => {
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result } = renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));
        expect(mockListNotifications).toHaveBeenCalledTimes(1);
        const cache = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        expect(cache.date).toBe(todayStr());
        expect(cache.unreadCount).toBe(1);
    });

    test('同じ日の再オープンは API を叩かずキャッシュから復元する（コスト削減）', async () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                date: todayStr(),
                teacher: '',
                notifications: [notice('n1')],
                unreadCount: 1,
            }),
        );
        const { result } = renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));
        expect(mockListNotifications).not.toHaveBeenCalled();
        expect(result.current.notifications).toHaveLength(1);
    });

    test('別日のキャッシュなら取り直す', async () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                date: '2000-01-01',
                teacher: '',
                notifications: [],
                unreadCount: 0,
            }),
        );
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(mockListNotifications).toHaveBeenCalledTimes(1));
    });

    test('ポーリングしない（時間が経っても再取得されない）', async () => {
        jest.useFakeTimers();
        try {
            mockListNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 });
            renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
            await waitFor(() => expect(mockListNotifications).toHaveBeenCalledTimes(1));
            await act(async () => {
                jest.advanceTimersByTime(10 * 60 * 1000);
            });
            expect(mockListNotifications).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });

    test('開封でバッジを消し既読を永続化。キャッシュの未読も 0 になる', async () => {
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result } = renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));

        act(() => result.current.handleToggleNotifications());
        expect(result.current.isOpen).toBe(true);
        expect(result.current.unreadCount).toBe(0);
        expect(mockMarkNotificationsRead).toHaveBeenCalledWith(TOKEN);
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).unreadCount).toBe(0);

        // 既読 0 件の再オープンでは再送しない。
        act(() => result.current.handleToggleNotifications());
        act(() => result.current.handleToggleNotifications());
        expect(mockMarkNotificationsRead).toHaveBeenCalledTimes(1);
    });

    test('取得時 401 はサイレント再認証へ', async () => {
        const err = new Error('expired');
        err.status = 401;
        mockListNotifications.mockRejectedValue(err);
        const on401 = jest.fn();
        renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401: on401 }));
        await waitFor(() => expect(on401).toHaveBeenCalled());
    });

    test('resetNotifications は in-memory を消すがキャッシュは残す', async () => {
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result } = renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));
        act(() => result.current.resetNotifications());
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
        expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });
});
