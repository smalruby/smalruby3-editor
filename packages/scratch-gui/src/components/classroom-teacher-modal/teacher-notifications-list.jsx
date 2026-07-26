/**
 * お知らせ全件一覧ページ（#1111 レビュー）。
 *
 * ドロップダウンパネルは先頭 5 件だけを見せ、「すべて見る」でこのページへ。
 * ここでは取得済みのお知らせ（1 日 1 回取得の最大 50 件）を **10 件ずつ
 * ページネーション**して表示する。追加の API は叩かない（コスト削減）。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './classroom-teacher-modal.css';

const PAGE_SIZE = 10;

const formatDateTime = iso => {
    if (!iso) return '';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
};

const NotificationRow = ({ notification, onOpenLink }) => {
    const handleClick = useCallback(() => onOpenLink(notification.link), [onOpenLink, notification.link]);
    return (
        <li>
            <button
                className={styles.notificationPageItem}
                data-testid={`classroom-notification-page-item-${notification.notificationId}`}
                type="button"
                onClick={handleClick}
            >
                <span className={styles.notificationTitle}>
                    {!notification.readAt && <span className={styles.notificationUnreadDot} />}
                    {notification.title}
                </span>
                {notification.body ? <span className={styles.notificationBody}>{notification.body}</span> : null}
                <span className={styles.notificationDate}>{formatDateTime(notification.createdAt)}</span>
            </button>
        </li>
    );
};

NotificationRow.propTypes = {
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

const TeacherNotificationsList = ({ notifications, onOpenLink }) => {
    const [page, setPage] = useState(0);
    const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages - 1);
    const start = clampedPage * PAGE_SIZE;
    const pageItems = notifications.slice(start, start + PAGE_SIZE);

    const handlePrev = useCallback(() => setPage(p => Math.max(0, p - 1)), []);
    const handleNext = useCallback(() => setPage(p => Math.min(totalPages - 1, p + 1)), [totalPages]);

    return (
        <div className={styles.notificationsPage} data-testid="classroom-notifications-page">
            <h2 className={styles.notificationsPageTitle}>
                <FormattedMessage
                    defaultMessage="Notifications"
                    description="Heading of the full notification list page"
                    id="gui.classroom.notifications.title"
                />
            </h2>
            {notifications.length === 0 ? (
                <p className={styles.notificationsEmpty} data-testid="classroom-notifications-page-empty">
                    <FormattedMessage
                        defaultMessage="No notifications yet"
                        description="Shown when the teacher has no notifications"
                        id="gui.classroom.notifications.empty"
                    />
                </p>
            ) : (
                <React.Fragment>
                    <ul className={styles.notificationsPageList} data-testid="classroom-notifications-page-list">
                        {pageItems.map(notification => (
                            <NotificationRow
                                key={notification.notificationId}
                                notification={notification}
                                onOpenLink={onOpenLink}
                            />
                        ))}
                    </ul>
                    <div className={styles.notificationsPager} data-testid="classroom-notifications-pager">
                        <button
                            data-testid="classroom-notifications-prev"
                            disabled={clampedPage === 0}
                            type="button"
                            onClick={handlePrev}
                        >{'←'}</button>
                        <span className={styles.notificationsPagerLabel}>
                            <FormattedMessage
                                defaultMessage="{current} / {total}"
                                description="Notification list page indicator"
                                id="gui.classroom.notifications.pageIndicator"
                                values={{ current: clampedPage + 1, total: totalPages }}
                            />
                        </span>
                        <button
                            data-testid="classroom-notifications-next"
                            disabled={clampedPage >= totalPages - 1}
                            type="button"
                            onClick={handleNext}
                        >{'→'}</button>
                    </div>
                </React.Fragment>
            )}
        </div>
    );
};

TeacherNotificationsList.propTypes = {
    notifications: PropTypes.arrayOf(PropTypes.object).isRequired,
    onOpenLink: PropTypes.func.isRequired,
};

export default TeacherNotificationsList;
