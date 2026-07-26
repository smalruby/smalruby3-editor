/**
 * お知らせセンター (notification center, EPIC #1111).
 *
 * クラス管理タイトルバー右上、アバターの左に置く**白一色のベル**ボタン
 * （+ 未読バッジ）。クリックでドロップダウンパネルを開き、**先頭 5 件**の
 * お知らせを表示。6 件以上あるときは「すべて見る」で全件一覧ページへ遷移。
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import styles from './classroom-teacher-modal.css';

const PANEL_PREVIEW_COUNT = 5;

const messages = defineMessages({
    buttonLabel: {
        defaultMessage: 'Notifications',
        description: 'Aria label for the notification bell button in the class management title bar',
        id: 'gui.classroom.notifications.buttonLabel',
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

const TeacherNotifications = ({ isOpen, notifications, unreadCount, onOpenLink, onShowAll, onToggle }) => {
    const intl = useIntl();
    const preview = notifications.slice(0, PANEL_PREVIEW_COUNT);
    const hasMore = notifications.length > PANEL_PREVIEW_COUNT;

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
                        <React.Fragment>
                            <ul className={styles.notificationsList}>
                                {preview.map((notification) => (
                                    <NotificationItem
                                        key={notification.notificationId}
                                        notification={notification}
                                        onOpenLink={onOpenLink}
                                    />
                                ))}
                            </ul>
                            {hasMore && (
                                <button
                                    className={styles.notificationsSeeAll}
                                    data-testid="classroom-notifications-see-all"
                                    type="button"
                                    onClick={onShowAll}
                                >
                                    <FormattedMessage
                                        defaultMessage="See all ({count})"
                                        description="Link to the full notification list page"
                                        id="gui.classroom.notifications.seeAll"
                                        values={{ count: notifications.length }}
                                    />
                                </button>
                            )}
                        </React.Fragment>
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
    onShowAll: PropTypes.func.isRequired,
    onToggle: PropTypes.func.isRequired,
};

export default TeacherNotifications;
