/**
 * お知らせセンター hook — EPIC #1111.
 *
 * Admin → teacher notices shown behind the 🔔 button in the class management
 * title bar. Notices are fetched on login and refreshed on a slow interval;
 * opening the panel marks everything read (the badge clears) while the
 * just-fetched readAt values keep the unread dots visible for that viewing.
 */
import { useCallback, useEffect, useState } from 'react';
import classroomAPI from '../lib/classroom-api.js';

// Slow poll: notices are low-urgency guidance from the operators, so one
// refresh a minute is plenty (the classroom list already polls every 30s —
// this stays separate to keep the hooks decoupled).
const NOTIFICATIONS_REFRESH_INTERVAL_MS = 60 * 1000;

/**
 * @param {object} params - hook dependencies
 * @param {string} params.idToken - teacher ID token (null before login)
 * @param {Function} params.handleTeacher401 - 401 handler from auth hook
 * @returns {object} notification state and handlers
 */
const useTeacherNotifications = ({ idToken, handleTeacher401 }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const loadNotifications = useCallback(async () => {
        if (!idToken) return;
        try {
            const data = await classroomAPI.listNotifications(idToken);
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch (err) {
            // Notices are auxiliary — swallow load errors quietly so a
            // notification outage can never break class management. Only a
            // 401 matters (session expiry → silent re-auth).
            if (err.status === 401) {
                await handleTeacher401();
            }
        }
    }, [idToken, handleTeacher401]);

    useEffect(() => {
        if (!idToken) {
            return () => {};
        }
        loadNotifications();
        const timer = setInterval(loadNotifications, NOTIFICATIONS_REFRESH_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [idToken, loadNotifications]);

    const handleToggleNotifications = useCallback(() => {
        setIsOpen((prev) => {
            const next = !prev;
            if (next && unreadCount > 0) {
                // Opening the panel = the teacher saw everything: clear the
                // badge immediately and persist server-side (best effort —
                // a failure just resurfaces the badge on the next poll).
                setUnreadCount(0);
                classroomAPI.markNotificationsRead(idToken).catch(() => {});
            }
            return next;
        });
    }, [idToken, unreadCount]);

    const handleCloseNotifications = useCallback(() => setIsOpen(false), []);

    /** Reset state (logout / go-to-login). */
    const resetNotifications = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
        setIsOpen(false);
    }, []);

    return {
        notifications,
        unreadCount,
        isOpen,
        handleToggleNotifications,
        handleCloseNotifications,
        resetNotifications,
        loadNotifications,
    };
};

export default useTeacherNotifications;
