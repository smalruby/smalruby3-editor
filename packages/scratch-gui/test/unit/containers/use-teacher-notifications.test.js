/* eslint-env jest */
/**
 * お知らせセンター hook (EPIC #1111) — interval lifecycle, mark-read-on-open
 * badge behavior and reset. The classroom API singleton is mocked module-wide.
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

const notice = (id, over = {}) => ({
    notificationId: id,
    type: 'admin_message',
    title: 'お知らせ',
    body: '本文',
    link: null,
    readAt: null,
    createdAt: '2026-07-25T00:00:00.000Z',
    ...over,
});

describe('useTeacherNotifications (EPIC #1111)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockListNotifications.mockReset().mockResolvedValue({ notifications: [], unreadCount: 0 });
        mockMarkNotificationsRead.mockReset().mockResolvedValue({ updated: 0 });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const handleTeacher401 = jest.fn();

    test('does not fetch without an idToken', () => {
        renderHook(() => useTeacherNotifications({ idToken: null, handleTeacher401 }));
        expect(mockListNotifications).not.toHaveBeenCalled();
    });

    test('fetches on login and refreshes on the interval', async () => {
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result, unmount } = renderHook(() => useTeacherNotifications({ idToken: 'tok', handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));
        expect(mockListNotifications).toHaveBeenCalledTimes(1);

        await act(async () => {
            jest.advanceTimersByTime(60 * 1000);
        });
        expect(mockListNotifications).toHaveBeenCalledTimes(2);

        // Unmount stops the interval (no further calls).
        unmount();
        await act(async () => {
            jest.advanceTimersByTime(5 * 60 * 1000);
        });
        expect(mockListNotifications).toHaveBeenCalledTimes(2);
    });

    test('opening the panel clears the badge and persists mark-read once', async () => {
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result } = renderHook(() => useTeacherNotifications({ idToken: 'tok', handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));

        act(() => {
            result.current.handleToggleNotifications();
        });
        expect(result.current.isOpen).toBe(true);
        expect(result.current.unreadCount).toBe(0);
        expect(mockMarkNotificationsRead).toHaveBeenCalledTimes(1);
        expect(mockMarkNotificationsRead).toHaveBeenCalledWith('tok');

        // Closing and re-opening with nothing unread does not re-send.
        act(() => {
            result.current.handleToggleNotifications();
        });
        act(() => {
            result.current.handleToggleNotifications();
        });
        expect(mockMarkNotificationsRead).toHaveBeenCalledTimes(1);
    });

    test('a 401 on load triggers the silent re-auth handler', async () => {
        const err = new Error('expired');
        err.status = 401;
        mockListNotifications.mockRejectedValue(err);
        const on401 = jest.fn();
        renderHook(() => useTeacherNotifications({ idToken: 'tok', handleTeacher401: on401 }));
        await waitFor(() => expect(on401).toHaveBeenCalled());
    });

    test('non-401 load errors are swallowed (notices are auxiliary)', async () => {
        const err = new Error('boom');
        err.status = 500;
        mockListNotifications.mockRejectedValue(err);
        const { result } = renderHook(() => useTeacherNotifications({ idToken: 'tok', handleTeacher401 }));
        await act(async () => {});
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
    });

    test('resetNotifications clears everything (logout)', async () => {
        mockListNotifications.mockResolvedValue({ notifications: [notice('n1')], unreadCount: 1 });
        const { result } = renderHook(() => useTeacherNotifications({ idToken: 'tok', handleTeacher401 }));
        await waitFor(() => expect(result.current.unreadCount).toBe(1));
        act(() => {
            result.current.handleToggleNotifications();
        });
        act(() => {
            result.current.resetNotifications();
        });
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
        expect(result.current.isOpen).toBe(false);
    });
});
