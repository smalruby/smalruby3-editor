/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import ClassroomTeacherMenu from '../../../src/components/classroom-teacher-menu/classroom-teacher-menu.jsx';

const renderMenu = (props) =>
    render(
        <IntlProvider locale="en">
            <ClassroomTeacherMenu
                items={[
                    { id: 'current-assignment', badge: false },
                    { id: 'class-list', badge: false },
                    { id: 'notifications', badge: false },
                    { id: 'logout', badge: false },
                ]}
                open={false}
                onOpen={jest.fn()}
                onRequestClose={jest.fn()}
                onSelect={jest.fn()}
                {...props}
            />
        </IntlProvider>,
    );

describe('ClassroomTeacherMenu (#1199)', () => {
    test('shows the label and opens on click', () => {
        const onOpen = jest.fn();
        renderMenu({ onOpen });
        expect(screen.getByTestId('classroom-teacher-menu-label')).toHaveTextContent('Class Management');
        expect(screen.queryByTestId('classroom-teacher-menu-class-list')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('classroom-teacher-menu-button'));
        expect(onOpen).toHaveBeenCalled();
    });

    test('lists the items when open and reports the chosen one', () => {
        const onSelect = jest.fn();
        renderMenu({ open: true, onSelect });
        ['current-assignment', 'class-list', 'notifications', 'logout'].forEach((id) =>
            expect(screen.getByTestId(`classroom-teacher-menu-${id}`)).toBeInTheDocument(),
        );
        fireEvent.click(screen.getByTestId('classroom-teacher-menu-class-list'));
        expect(onSelect).toHaveBeenCalledWith('class-list');
    });

    test('shows the "!" badge only with unread notifications', () => {
        const { unmount } = renderMenu();
        expect(screen.queryByTestId('classroom-teacher-menu-badge')).not.toBeInTheDocument();
        unmount();
        renderMenu({
            open: true,
            items: [
                { id: 'class-list', badge: false },
                { id: 'notifications', badge: true },
                { id: 'logout', badge: false },
            ],
        });
        expect(screen.getByTestId('classroom-teacher-menu-badge')).toHaveTextContent('!');
        expect(screen.getByTestId('classroom-teacher-menu-notifications-badge')).toBeInTheDocument();
    });
});
