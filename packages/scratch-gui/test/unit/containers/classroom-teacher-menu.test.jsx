/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomTeacherMenu from '../../../src/containers/classroom-teacher-menu.jsx';
import classroomReducer, { openTeacherModal, setTeacherLoggedIn } from '../../../src/reducers/classroom.js';

let mockCachedToken = null;
const mockRestore = jest.fn();
const mockLogout = jest.fn();
jest.mock('../../../src/containers/use-teacher-auth.js', () => ({
    getCachedTeacherIdToken: () => mockCachedToken,
    setCachedTeacherIdToken: (t) => {
        mockCachedToken = t;
    },
    restoreTeacherLogin: (...args) => mockRestore(...args),
    logoutCachedTeacher: () => mockLogout(),
}));

const mockLoadDaily = jest.fn();
jest.mock('../../../src/containers/use-teacher-notifications.js', () => ({
    loadDailyNotifications: (...args) => mockLoadDaily(...args),
}));

let mockUrlParams = {};
jest.mock('../../../src/lib/url-params.js', () => ({
    getUrlParams: () => mockUrlParams,
}));

const TEACHER_KEY = 'smalruby:classroomTeacher';

const renderMenu = () => {
    const store = createStore(combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer }) }));
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <ClassroomTeacherMenu />
            </IntlProvider>
        </Provider>,
    );
    return store;
};

describe('ClassroomTeacherMenu container (#1199)', () => {
    beforeEach(() => {
        window.localStorage.clear();
        mockCachedToken = null;
        mockUrlParams = {};
        mockRestore.mockReset();
        mockLogout.mockReset();
        mockLoadDaily.mockReset().mockResolvedValue({ notifications: [], unreadCount: 0 });
    });

    test('renders nothing and restores nothing without a persisted login', async () => {
        renderMenu();
        await act(async () => {});
        expect(mockRestore).not.toHaveBeenCalled();
        expect(screen.queryByTestId('classroom-teacher-menu-button')).not.toBeInTheDocument();
    });

    test('restores a persisted login silently and shows the menu', async () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'microsoft' }));
        mockRestore.mockResolvedValue('restored-token');
        mockLoadDaily.mockResolvedValue({ notifications: [], unreadCount: 2 });
        const store = renderMenu();
        await waitFor(() => expect(screen.getByTestId('classroom-teacher-menu-button')).toBeInTheDocument());
        expect(mockRestore).toHaveBeenCalledWith('microsoft');
        await waitFor(() => expect(store.getState().scratchGui.classroom.teacherUnreadCount).toBe(2));
        expect(screen.getByTestId('classroom-teacher-menu-badge')).toBeInTheDocument();
    });

    test('stays logged out when silent re-auth fails (no error shown)', async () => {
        window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ provider: 'google' }));
        mockRestore.mockResolvedValue(null);
        const store = renderMenu();
        await act(async () => {});
        expect(store.getState().scratchGui.classroom.teacherLoggedIn).toBe(false);
        expect(screen.queryByTestId('classroom-teacher-menu-button')).not.toBeInTheDocument();
    });

    test('logs in from ?devlogin= without silent re-auth', async () => {
        mockUrlParams = { devlogin: 'dev-secret' };
        renderMenu();
        await waitFor(() => expect(screen.getByTestId('classroom-teacher-menu-button')).toBeInTheDocument());
        expect(mockRestore).not.toHaveBeenCalled();
        expect(mockCachedToken).toBe('dev-secret');
        expect(mockLoadDaily).toHaveBeenCalledWith('dev-secret');
    });

    test('menu items request a jump in the teacher modal', async () => {
        const store = renderMenu();
        act(() => {
            store.dispatch(setTeacherLoggedIn(true));
        });
        fireEvent.click(screen.getByTestId('classroom-teacher-menu-button'));
        fireEvent.click(screen.getByTestId('classroom-teacher-menu-class-list'));
        const state = store.getState().scratchGui.classroom;
        expect(state.teacherModalVisible).toBe(true);
        expect(state.teacherNavTarget).toBe('class-list');
    });

    test('logout clears the login and closes the teacher modal', async () => {
        const store = renderMenu();
        act(() => {
            store.dispatch(setTeacherLoggedIn(true));
            store.dispatch(openTeacherModal());
        });
        fireEvent.click(screen.getByTestId('classroom-teacher-menu-button'));
        fireEvent.click(screen.getByTestId('classroom-teacher-menu-logout'));
        expect(mockLogout).toHaveBeenCalled();
        const state = store.getState().scratchGui.classroom;
        expect(state.teacherLoggedIn).toBe(false);
        expect(state.teacherModalVisible).toBe(false);
        expect(screen.queryByTestId('classroom-teacher-menu-button')).not.toBeInTheDocument();
    });
});
