/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherNotifications from '../../../src/components/classroom-teacher-modal/teacher-notifications.jsx';

const notification = (over = {}) => ({
    notificationId: '2026-07-25T01:00:00.000Z#n1',
    type: 'admin_message',
    title: '運営からのお知らせ',
    body: 'この課題、みんなの課題に共有しませんか？',
    link: { kind: 'classroom', classroomId: 'c1' },
    readAt: null,
    createdAt: '2026-07-25T01:00:00.000Z',
    ...over,
});

const defaultProps = () => ({
    isOpen: false,
    notifications: [],
    unreadCount: 0,
    onMarkAllRead: jest.fn(),
    onOpenLink: jest.fn(),
    onShowAll: jest.fn(),
    onToggle: jest.fn(),
});

const many = (n) =>
    Array.from({ length: n }, (_, i) => notification({ notificationId: `id-${i}`, title: `お知らせ${i}` }));

const renderNotifications = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherNotifications {...defaultProps()} {...props} />
        </IntlProvider>,
    );

describe('TeacherNotifications (EPIC #1111)', () => {
    test('renders the bell without a badge when everything is read', () => {
        renderNotifications({});
        expect(screen.getByTestId('classroom-notifications-button')).toBeInTheDocument();
        expect(screen.queryByTestId('classroom-notifications-badge')).not.toBeInTheDocument();
        expect(screen.queryByTestId('classroom-notifications-panel')).not.toBeInTheDocument();
    });

    test('shows the unread badge (9+ past nine) and toggles on click', () => {
        const onToggle = jest.fn();
        renderNotifications({ unreadCount: 3, onToggle });
        expect(screen.getByTestId('classroom-notifications-badge')).toHaveTextContent('3');
        fireEvent.click(screen.getByTestId('classroom-notifications-button'));
        expect(onToggle).toHaveBeenCalled();
    });

    test('caps the badge at 9+', () => {
        renderNotifications({ unreadCount: 12 });
        expect(screen.getByTestId('classroom-notifications-badge')).toHaveTextContent('9+');
    });

    test('open panel with no items shows the empty state', () => {
        renderNotifications({ isOpen: true });
        expect(screen.getByTestId('classroom-notifications-panel')).toBeInTheDocument();
        expect(screen.getByTestId('classroom-notifications-empty')).toBeInTheDocument();
    });

    test('lists items with unread dots and forwards the link on click', () => {
        const onOpenLink = jest.fn();
        const unread = notification();
        const read = notification({
            notificationId: '2026-07-24T01:00:00.000Z#n0',
            readAt: '2026-07-24T02:00:00.000Z',
            title: '既読のお知らせ',
        });
        renderNotifications({ isOpen: true, notifications: [unread, read], onOpenLink });

        const unreadItem = screen.getByTestId(`classroom-notification-item-${unread.notificationId}`);
        expect(unreadItem).toHaveTextContent('運営からのお知らせ');
        expect(unreadItem).toHaveTextContent('この課題、みんなの課題に共有しませんか？');
        // Only the unread item carries the dot.
        expect(screen.getAllByTestId('classroom-notification-unread-dot')).toHaveLength(1);

        fireEvent.click(unreadItem);
        expect(onOpenLink).toHaveBeenCalledWith({ kind: 'classroom', classroomId: 'c1' });
    });

    test('パネルは先頭5件のみプレビュー表示する (#1111)', () => {
        renderNotifications({ isOpen: true, notifications: many(8) });
        expect(screen.getAllByTestId(/classroom-notification-item-/)).toHaveLength(5);
    });

    test('⋯メニューから「すべて既読にする」「お知らせを開く」を選べる (#1111 レビュー)', () => {
        const onMarkAllRead = jest.fn();
        const onShowAll = jest.fn();
        renderNotifications({ isOpen: true, notifications: many(3), unreadCount: 3, onMarkAllRead, onShowAll });
        // メニューは閉じている。
        expect(screen.queryByTestId('classroom-notifications-menu')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('classroom-notifications-menu-button'));
        // すべて既読にする
        fireEvent.click(screen.getByTestId('classroom-notifications-mark-all-read'));
        expect(onMarkAllRead).toHaveBeenCalled();
        // 再度開いて お知らせを開く
        fireEvent.click(screen.getByTestId('classroom-notifications-menu-button'));
        fireEvent.click(screen.getByTestId('classroom-notifications-open-all'));
        expect(onShowAll).toHaveBeenCalled();
    });

    test('未読0なら「すべて既読にする」は無効。1件でも一覧は件数に依らず開ける', () => {
        renderNotifications({ isOpen: true, notifications: many(1), unreadCount: 0 });
        fireEvent.click(screen.getByTestId('classroom-notifications-menu-button'));
        expect(screen.getByTestId('classroom-notifications-mark-all-read')).toBeDisabled();
        expect(screen.getByTestId('classroom-notifications-open-all')).toBeEnabled();
    });
});
