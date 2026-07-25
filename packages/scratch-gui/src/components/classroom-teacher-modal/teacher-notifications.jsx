/**
 * お知らせセンター (notification center, EPIC #1111).
 *
 * A 🔔 button pinned to the teacher modal's title bar (top-right, next to
 * logout) with an unread badge, and a dropdown panel listing the notices the
 * operators sent to this teacher. Clicking a notice jumps to the linked view
 * (e.g. the assignment board of the referenced classroom).
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import styles from './classroom-teacher-modal.css';

const messages = defineMessages({
    buttonLabel: {
        defaultMessage: 'Notifications',
        description: 'Aria label for the notification bell button in the class management title bar',
        id: 'gui.classroom.notifications.buttonLabel',
    },
});

// ローカルタイムで表示する（ISO の slice だと UTC のまま出て日本では 9 時間
// ずれる — レビュー指摘）。兄弟コンポーネントの toLocaleString 慣行に合わせる。
const formatDateTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
};

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

const TeacherNotifications = ({ isOpen, notifications, unreadCount, onOpenLink, onToggle }) => {
    const intl = useIntl();

    return (
        <React.Fragment>
            <button
                aria-label={intl.formatMessage(messages.buttonLabel)}
                className={styles.titleBarNotifications}
                data-testid="classroom-notifications-button"
                type="button"
                onClick={onToggle}
            >
                <span aria-hidden="true">{'🔔'}</span>
                {unreadCount > 0 && (
                    <span className={styles.notificationsBadge} data-testid="classroom-notifications-badge">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            {isOpen && (
                <div className={styles.notificationsPanel} data-testid="classroom-notifications-panel">
                    <div className={styles.notificationsHeader}>
                        <FormattedMessage
                            defaultMessage="Notifications"
                            description="Heading of the notification center panel"
                            id="gui.classroom.notifications.title"
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
                            {notifications.map((notification) => (
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
    onOpenLink: PropTypes.func.isRequired,
    onToggle: PropTypes.func.isRequired,
};

export default TeacherNotifications;
