/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherAvatarMenu from '../../../src/components/classroom-teacher-modal/teacher-avatar-menu.jsx';

const renderMenu = (props) =>
    render(
        <IntlProvider locale="en">
            <TeacherAvatarMenu email="kouji.takao@example.com" onLogout={jest.fn()} {...props} />
        </IntlProvider>,
    );

describe('TeacherAvatarMenu (#1111 レビュー)', () => {
    test('shows initials and a caret; popup is closed initially', () => {
        renderMenu();
        expect(screen.getByTestId('classroom-avatar-initials')).toHaveTextContent('KT');
        expect(screen.queryByTestId('classroom-avatar-popup')).not.toBeInTheDocument();
    });

    test('click opens the popup with email + logout; logout fires', () => {
        const onLogout = jest.fn();
        renderMenu({ onLogout });
        fireEvent.click(screen.getByTestId('classroom-avatar-button'));
        expect(screen.getByTestId('classroom-avatar-popup')).toBeInTheDocument();
        expect(screen.getByTestId('classroom-avatar-email')).toHaveTextContent('kouji.takao@example.com');
        fireEvent.click(screen.getByTestId('classroom-teacher-logout'));
        expect(onLogout).toHaveBeenCalled();
        // logout closes the popup
        expect(screen.queryByTestId('classroom-avatar-popup')).not.toBeInTheDocument();
    });

    test('Escape closes the popup', () => {
        renderMenu();
        fireEvent.click(screen.getByTestId('classroom-avatar-button'));
        expect(screen.getByTestId('classroom-avatar-popup')).toBeInTheDocument();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByTestId('classroom-avatar-popup')).not.toBeInTheDocument();
    });

    test('falls back to ? with no email', () => {
        renderMenu({ email: null });
        expect(screen.getByTestId('classroom-avatar-initials')).toHaveTextContent('?');
    });
});
