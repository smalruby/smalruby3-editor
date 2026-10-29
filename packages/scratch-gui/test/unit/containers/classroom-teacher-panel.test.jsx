/* eslint-env jest */
/**
 * 先生の「いまの課題の状況」パネルのログイン期限切れ (#1250)。401 で期限切れの文言と
 * 「再認証する」リンクを出し、ポーリングを止める。リンクで再認証に成功したら取り直し、
 * 失敗したらクラス管理画面を開く。401 以外は従来の文言のまま。
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomTeacherPanel from '../../../src/containers/classroom-teacher-panel.jsx';
import classroomReducer, { classroomInitialState } from '../../../src/reducers/classroom.js';

const mockListClassrooms = jest.fn();
const mockListMembers = jest.fn();
const mockListSubmissions = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        listClassrooms: (...args) => mockListClassrooms(...args),
        listMembers: (...args) => mockListMembers(...args),
        listSubmissions: (...args) => mockListSubmissions(...args),
    },
}));

let mockToken = 'old-token';
const mockSetCachedToken = jest.fn((token) => {
    mockToken = token;
});
jest.mock('../../../src/containers/use-teacher-auth.js', () => ({
    getCachedTeacherIdToken: () => mockToken,
    setCachedTeacherIdToken: (token) => mockSetCachedToken(token),
    getCachedTeacherAuthProvider: () => 'google',
}));

const mockReauth = jest.fn();
jest.mock('../../../src/lib/teacher-auth.js', () => ({
    attemptSilentReauth: (...args) => mockReauth(...args),
}));

const mockSaveTeacherToken = jest.fn();
jest.mock('../../../src/lib/classroom-teacher-session.js', () => ({
    ...jest.requireActual('../../../src/lib/classroom-teacher-session.js'),
    saveTeacherToken: (...args) => mockSaveTeacherToken(...args),
}));

const unauthorized = () => Object.assign(new Error('API error 401'), { status: 401 });

const flush = async () => {
    await act(async () => {
        for (let i = 0; i < 6; i++) await Promise.resolve();
    });
};

const renderPanel = () => {
    const store = createStore(combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer }) }), {
        scratchGui: {
            classroom: {
                ...classroomInitialState,
                teacherLoggedIn: true,
                teacherPanelOpen: true,
                teacherLastSelection: { classroomId: 'c1', groupId: 'g1' },
            },
        },
    });
    render(
        <IntlProvider locale="en">
            <Provider store={store}>
                <ClassroomTeacherPanel />
            </Provider>
        </IntlProvider>,
    );
    return store;
};

describe('ClassroomTeacherPanel session expiry (#1250)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockToken = 'old-token';
        [mockListClassrooms, mockListMembers, mockListSubmissions, mockReauth, mockSaveTeacherToken].forEach((m) =>
            m.mockReset(),
        );
        mockSetCachedToken.mockClear();
        mockListClassrooms.mockResolvedValue({ classrooms: [{ classroomId: 'c1', studentCount: 2 }] });
        mockListMembers.mockResolvedValue({ members: [] });
        mockListSubmissions.mockResolvedValue({ submissions: [] });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('a non-401 failure keeps the generic retry message', async () => {
        mockListMembers.mockRejectedValue(Object.assign(new Error('API error 500'), { status: 500 }));
        renderPanel();
        await flush();
        expect(screen.getByTestId('classroom-teacher-panel-error').textContent).toMatch(/It will be retried/);
        expect(screen.queryByTestId('classroom-teacher-panel-reauth')).toBeNull();
    });

    test('a 401 shows the expiry message with a re-auth link and stops polling', async () => {
        mockListMembers.mockRejectedValue(unauthorized());
        renderPanel();
        await flush();
        expect(screen.getByTestId('classroom-teacher-panel-error').textContent).toMatch(/login has expired/);
        expect(screen.getByTestId('classroom-teacher-panel-reauth')).toBeTruthy();
        const calls = mockListMembers.mock.calls.length;
        await act(async () => {
            jest.advanceTimersByTime(120000);
        });
        await flush();
        expect(mockListMembers.mock.calls.length).toBe(calls);
    });

    test('a 401 from the assignment list also shows the expiry message', async () => {
        mockListClassrooms.mockRejectedValue(unauthorized());
        // The poll is still in flight.
        mockListMembers.mockReturnValue(new Promise(() => {}));
        renderPanel();
        await flush();
        expect(screen.getByTestId('classroom-teacher-panel-reauth')).toBeTruthy();
    });

    test('a successful re-auth stores the new token, clears the error and reloads', async () => {
        mockListMembers.mockRejectedValueOnce(unauthorized());
        mockReauth.mockResolvedValue('new-token');
        const store = renderPanel();
        await flush();
        mockListMembers.mockClear();
        mockListClassrooms.mockClear();
        fireEvent.click(screen.getByTestId('classroom-teacher-panel-reauth'));
        await flush();
        expect(mockReauth).toHaveBeenCalledWith('google');
        expect(mockSetCachedToken).toHaveBeenCalledWith('new-token');
        expect(mockSaveTeacherToken).toHaveBeenCalledWith('google', 'new-token');
        expect(screen.queryByTestId('classroom-teacher-panel-error')).toBeNull();
        expect(mockListMembers).toHaveBeenCalledWith('new-token', 'c1');
        expect(mockListClassrooms).toHaveBeenCalledWith('new-token');
        expect(store.getState().scratchGui.classroom.teacherModalVisible).toBe(false);
    });

    test('a failed re-auth opens class management and keeps the message', async () => {
        mockListMembers.mockRejectedValue(unauthorized());
        mockReauth.mockResolvedValue(null);
        const store = renderPanel();
        await flush();
        fireEvent.click(screen.getByTestId('classroom-teacher-panel-reauth'));
        await flush();
        expect(store.getState().scratchGui.classroom.teacherModalVisible).toBe(true);
        expect(screen.getByTestId('classroom-teacher-panel-reauth')).toBeTruthy();
        expect(mockSetCachedToken).not.toHaveBeenCalled();
    });

    test('the link is disabled while the re-auth is running', async () => {
        mockListMembers.mockRejectedValue(unauthorized());
        let resolve;
        mockReauth.mockReturnValue(
            new Promise((r) => {
                resolve = r;
            }),
        );
        renderPanel();
        await flush();
        fireEvent.click(screen.getByTestId('classroom-teacher-panel-reauth'));
        await flush();
        expect(screen.getByTestId('classroom-teacher-panel-reauth').disabled).toBe(true);
        fireEvent.click(screen.getByTestId('classroom-teacher-panel-reauth'));
        expect(mockReauth).toHaveBeenCalledTimes(1);
        await act(async () => resolve(null));
        await flush();
    });

    test('closing class management after a failed re-auth tries the panel again', async () => {
        mockListMembers.mockRejectedValueOnce(unauthorized());
        mockReauth.mockResolvedValue(null);
        const store = renderPanel();
        await flush();
        fireEvent.click(screen.getByTestId('classroom-teacher-panel-reauth'));
        await flush();
        // The teacher logs in again inside the modal, then closes it.
        mockToken = 'modal-token';
        mockListMembers.mockClear();
        await act(async () => {
            store.dispatch({ type: 'scratch-gui/classroom/CLOSE_TEACHER_MODAL' });
        });
        await flush();
        expect(mockListMembers).toHaveBeenCalledWith('modal-token', 'c1');
        expect(screen.queryByTestId('classroom-teacher-panel-error')).toBeNull();
    });
});
