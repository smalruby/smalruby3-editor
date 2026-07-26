/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherNotificationsList from '../../../src/components/classroom-teacher-modal/teacher-notifications-list.jsx';

const many = (n) =>
    Array.from({ length: n }, (_, i) => ({
        notificationId: `id-${i}`,
        type: 'admin_message',
        title: `お知らせ${i}`,
        body: `本文${i}`,
        link: { kind: 'classroom', classroomId: `c${i}` },
        readAt: null,
        createdAt: '2026-07-26T00:00:00.000Z',
    }));

const renderList = (notifications, onOpenLink = jest.fn(), onBack = jest.fn()) =>
    render(
        <IntlProvider locale="en">
            <TeacherNotificationsList notifications={notifications} onBack={onBack} onOpenLink={onOpenLink} />
        </IntlProvider>,
    );

describe('TeacherNotificationsList (#1111 レビュー・10件/頁)', () => {
    test('empty state', () => {
        renderList([]);
        expect(screen.getByTestId('classroom-notifications-page-empty')).toBeInTheDocument();
    });

    test('paginates 10 per page and navigates', () => {
        renderList(many(23));
        // page 1: 10 items
        expect(screen.getAllByTestId(/classroom-notification-page-item-/)).toHaveLength(10);
        expect(screen.getByTestId('classroom-notifications-pager')).toHaveTextContent('1 / 3');
        expect(screen.getByTestId('classroom-notifications-prev')).toBeDisabled();

        fireEvent.click(screen.getByTestId('classroom-notifications-next'));
        expect(screen.getByTestId('classroom-notifications-pager')).toHaveTextContent('2 / 3');
        expect(screen.getAllByTestId(/classroom-notification-page-item-/)).toHaveLength(10);

        fireEvent.click(screen.getByTestId('classroom-notifications-next'));
        expect(screen.getByTestId('classroom-notifications-pager')).toHaveTextContent('3 / 3');
        // last page: 3 items
        expect(screen.getAllByTestId(/classroom-notification-page-item-/)).toHaveLength(3);
        expect(screen.getByTestId('classroom-notifications-next')).toBeDisabled();
    });

    test('single page hides nothing and disables both arrows', () => {
        renderList(many(4));
        expect(screen.getByTestId('classroom-notifications-pager')).toHaveTextContent('1 / 1');
        expect(screen.getByTestId('classroom-notifications-prev')).toBeDisabled();
        expect(screen.getByTestId('classroom-notifications-next')).toBeDisabled();
    });

    test('clicking an item forwards its link', () => {
        const onOpenLink = jest.fn();
        renderList(many(3), onOpenLink);
        fireEvent.click(screen.getByTestId('classroom-notification-page-item-id-1'));
        expect(onOpenLink).toHaveBeenCalledWith({ kind: 'classroom', classroomId: 'c1' });
    });

    test('左下の戻るボタンが onBack を呼ぶ (#1111 レビュー)', () => {
        const onBack = jest.fn();
        renderList(many(3), jest.fn(), onBack);
        fireEvent.click(screen.getByTestId('classroom-notifications-back'));
        expect(onBack).toHaveBeenCalled();
    });

    test('空でも戻るボタンは出る', () => {
        renderList([]);
        expect(screen.getByTestId('classroom-notifications-back')).toBeInTheDocument();
    });
});
