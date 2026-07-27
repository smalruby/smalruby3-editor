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

// teacherEmailFromToken をモック（実装は JWT デコード）。既定は非空 email を
// 返し、キャッシュキーが立つようにする。空キーのテストで null に差し替える。
const mockEmailFromToken = jest.fn(() => TEACHER_EMAIL);
jest.mock('../../../src/lib/classroom-class-label.js', () => ({
    teacherEmailFromToken: (...args) => mockEmailFromToken(...args),
}));

const TOKEN = 'tok';
const TEACHER_EMAIL = 'teacher@example.com';
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
        mockEmailFromToken.mockReset().mockReturnValue(TEACHER_EMAIL);
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
                teacher: TEACHER_EMAIL,
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
                teacher: TEACHER_EMAIL,
                notifications: [],
                unreadCount: 0,
            }),
        );
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(mockListNotifications).toHaveBeenCalledTimes(1));
    });

    test('email 不明（空キー）ならキャッシュを使わず毎回取得する（共有PC取り違え防止）', async () => {
        mockEmailFromToken.mockReturnValue(null); // dev-bypass 等の非 JWT トークン
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ date: todayStr(), teacher: '', notifications: [notice('x')], unreadCount: 9 }),
        );
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result } = renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(mockListNotifications).toHaveBeenCalledTimes(1));
        expect(result.current.unreadCount).toBe(1);
        // 空キーではキャッシュを書かない（他の空キー先生と共有されないように）。
        const cache = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        expect(cache.notifications[0].notificationId).toBe('x');
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

    test('開くだけでは既読にしない（自動既読を廃止・レビュー指摘）', async () => {
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result } = renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));

        act(() => result.current.handleToggleNotifications());
        expect(result.current.isOpen).toBe(true);
        // バッジは残る。API も呼ばない。
        expect(result.current.unreadCount).toBe(1);
        expect(mockMarkNotificationsRead).not.toHaveBeenCalled();
    });

    test('handleMarkAllRead でバッジを消し既読を永続化。キャッシュとドットも既読に', async () => {
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result } = renderHook(() => useTeacherNotifications({ idToken: TOKEN, handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));

        act(() => result.current.handleMarkAllRead());
        expect(result.current.unreadCount).toBe(0);
        expect(result.current.notifications[0].readAt).toBeTruthy();
        expect(mockMarkNotificationsRead).toHaveBeenCalledWith(TOKEN);
        const cache = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        expect(cache.unreadCount).toBe(0);
        expect(cache.notifications[0].readAt).toBeTruthy();

        // 既読 0 件で再度呼んでも API を再送しない。
        act(() => result.current.handleMarkAllRead());
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
