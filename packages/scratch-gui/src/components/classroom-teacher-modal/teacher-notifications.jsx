/**
 * お知らせセンター (notification center, EPIC #1111).
 *
 * クラス管理タイトルバー右上、アバターの左に置く**白一色のベル**ボタン
 * （+ 未読バッジ）。クリックでドロップダウンパネルを開き、**先頭 5 件**の
 * お知らせを表示。ヘッダーの ⋯ メニューから「すべて既読にする」「お知らせを
 * 開く（全件一覧ページ）」を選べる（件数に関係なく一覧へ行ける・レビュー指摘）。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import styles from './classroom-teacher-modal.css';

const PANEL_PREVIEW_COUNT = 5;

const messages = defineMessages({
    buttonLabel: {
        defaultMessage: 'Notifications',
        description: 'Aria label for the notification bell button in the class management title bar',
        id: 'gui.classroom.notifications.buttonLabel',
    },
    menuLabel: {
        defaultMessage: 'Notification menu',
        description: 'Aria label for the three-dot menu in the notification panel',
        id: 'gui.classroom.notifications.menuLabel',
    },
});

// ローカルタイムで表示する（ISO の slice だと UTC のまま出て日本では 9 時間
// ずれる）。兄弟コンポーネントの toLocaleString 慣行に合わせる。
const formatDateTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
};

// 白一色のベル SVG（絵文字 🔔 は主張が強いのでやめる — レビュー指摘）。
const BellIcon = () => (
    <svg aria-hidden="true" className={styles.bellIcon} viewBox="0 0 24 24" width="20" height="20">
        <path
            d="M12 2.5a5.5 5.5 0 0 0-5.5 5.5v3.2l-1.4 2.8A1 1 0 0 0 6 15.5h12a1 1 0 0 0 .9-1.5L17.5 11.2V8A5.5 5.5 0 0 0 12 2.5Zm0 19a2.6 2.6 0 0 0 2.5-2h-5a2.6 2.6 0 0 0 2.5 2Z"
            fill="currentColor"
        />
    </svg>
);

const NotificationItem = ({ notification, onOpenLink }) => {
    const handleClick = useCallback(() => {
        onOpenLink(notification.link);
    }, [onOpenLink, notification.link]);

    return (
        <li>
            <button
                className={styles.notificationItem}
                data-testid={`classroom-notification-item-${notification.notificationId}`}
                type="button"
                onClick={handleClick}
            >
                <span className={styles.notificationTitle}>
                    {!notification.readAt && (
                        <span
                            className={styles.notificationUnreadDot}
                            data-testid="classroom-notification-unread-dot"
                        />
                    )}
                    {notification.title}
                </span>
                {notification.body ? <span className={styles.notificationBody}>{notification.body}</span> : null}
                <span className={styles.notificationDate}>{formatDateTime(notification.createdAt)}</span>
            </button>
        </li>
    );
};

NotificationItem.propTypes = {
    notification: PropTypes.shape({
        notificationId: PropTypes.string.isRequired,
        title: PropTypes.string,
        body: PropTypes.string,
        link: PropTypes.object,
        readAt: PropTypes.string,
        createdAt: PropTypes.string,
    }).isRequired,
    onOpenLink: PropTypes.func.isRequired,
};

// パネルヘッダーの ⋯ メニュー（すべて既読にする / お知らせを開く）。
const PanelMenu = ({ unreadCount, onMarkAllRead, onShowAll }) => {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return () => {};
        const onDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const toggle = useCallback(() => setOpen((o) => !o), []);
    const handleMark = useCallback(() => {
        setOpen(false);
        onMarkAllRead();
    }, [onMarkAllRead]);
    const handleOpen = useCallback(() => {
        setOpen(false);
        onShowAll();
    }, [onShowAll]);

    return (
        <div className={styles.notificationsMenu} ref={ref}>
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={intl.formatMessage(messages.menuLabel)}
                className={styles.notificationsMenuButton}
                data-testid="classroom-notifications-menu-button"
                type="button"
                onClick={toggle}
            >
                {'⋯'}
            </button>
            {open && (
                <div className={styles.notificationsMenuPopup} data-testid="classroom-notifications-menu" role="menu">
                    <button
                        className={styles.notificationsMenuItem}
                        data-testid="classroom-notifications-mark-all-read"
                        disabled={unreadCount === 0}
                        role="menuitem"
                        type="button"
                        onClick={handleMark}
                    >
                        <FormattedMessage
                            defaultMessage="Mark all as read"
                            description="Menu item to mark all notifications read"
                            id="gui.classroom.notifications.markAllRead"
                        />
                    </button>
                    <button
                        className={styles.notificationsMenuItem}
                        data-testid="classroom-notifications-open-all"
                        role="menuitem"
                        type="button"
                        onClick={handleOpen}
                    >
                        <FormattedMessage
                            defaultMessage="Open notifications"
                            description="Menu item to open the full notification list page"
                            id="gui.classroom.notifications.openAll"
                        />
                    </button>
                </div>
            )}
        </div>
    );
};

PanelMenu.propTypes = {
    unreadCount: PropTypes.number.isRequired,
    onMarkAllRead: PropTypes.func.isRequired,
    onShowAll: PropTypes.func.isRequired,
};

const TeacherNotifications = ({
    isOpen,
    notifications,
    unreadCount,
    onMarkAllRead,
    onOpenLink,
    onShowAll,
    onToggle,
}) => {
    const intl = useIntl();
    const preview = notifications.slice(0, PANEL_PREVIEW_COUNT);

    return (
        <React.Fragment>
            <button
                aria-label={intl.formatMessage(messages.buttonLabel)}
                className={styles.titleBarNotifications}
                data-testid="classroom-notifications-button"
                type="button"
                onClick={onToggle}
            >
                <BellIcon />
                {unreadCount > 0 && (
                    <span className={styles.notificationsBadge} data-testid="classroom-notifications-badge">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            {isOpen && (
                <div className={styles.notificationsPanel} data-testid="classroom-notifications-panel">
                    <div className={styles.notificationsHeader}>
                        <span>
                            <FormattedMessage
                                defaultMessage="Notifications"
                                description="Heading of the notification center panel"
                                id="gui.classroom.notifications.title"
                            />
                        </span>
                        <PanelMenu
                            unreadCount={unreadCount}
                            onMarkAllRead={onMarkAllRead}
                            onShowAll={onShowAll}
                        />
                    </div>
                    {notifications.length === 0 ? (
                        <div className={styles.notificationsEmpty} data-testid="classroom-notifications-empty">
                            <FormattedMessage
                                defaultMessage="No notifications yet"
                                description="Shown when the teacher has no notifications"
                                id="gui.classroom.notifications.empty"
                            />
                        </div>
                    ) : (
                        <ul className={styles.notificationsList}>
                            {preview.map((notification) => (
                                <NotificationItem
                                    key={notification.notificationId}
                                    notification={notification}
                                    onOpenLink={onOpenLink}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </React.Fragment>
    );
};

TeacherNotifications.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.object).isRequired,
    unreadCount: PropTypes.number.isRequired,
    onMarkAllRead: PropTypes.func.isRequired,
    onOpenLink: PropTypes.func.isRequired,
    onShowAll: PropTypes.func.isRequired,
    onToggle: PropTypes.func.isRequired,
};

export default TeacherNotifications;
