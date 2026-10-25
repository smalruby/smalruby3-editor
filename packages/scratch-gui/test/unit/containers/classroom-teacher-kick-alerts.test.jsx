/* eslint-env jest */
/**
 * 先生向けの退室依頼トースト (#1200)。新しい依頼で画面下部に 30 秒出て消えること、
 * 承認 / 却下で既存 API を呼ぶこと、メニューの件数（Redux）に反映されることを確認する。
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomTeacherKickAlerts from '../../../src/containers/classroom-teacher-kick-alerts.jsx';
import classroomReducer, { classroomInitialState } from '../../../src/reducers/classroom.js';

const mockListPending = jest.fn();
const mockApprove = jest.fn();
const mockReject = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        listPendingKickRequests: (...args) => mockListPending(...args),
        approveKickRequest: (...args) => mockApprove(...args),
        rejectKickRequest: (...args) => mockReject(...args),
    },
}));
jest.mock('../../../src/containers/use-teacher-auth.js', () => ({
    getCachedTeacherIdToken: () => 'teacher-token',
}));

const REQUEST = {
    requestId: 'r1',
    classroomId: 'c1',
    className: '1組',
    assignmentName: '迷路',
    groupId: 'g1',
    seatNumber: 7,
    reason: '番号をまちがえた',
    occupantName: 'たろう',
    createdAt: '2026-10-25T10:00:00.000Z',
};

const flush = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

const renderAlerts = (classroom = {}) => {
    const store = createStore(combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer }) }), {
        scratchGui: { classroom: { ...classroomInitialState, teacherLoggedIn: true, ...classroom } },
    });
    render(
        <IntlProvider locale="en">
            <Provider store={store}>
                <ClassroomTeacherKickAlerts />
            </Provider>
        </IntlProvider>,
    );
    return store;
};

describe('ClassroomTeacherKickAlerts (#1200)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockListPending.mockReset();
        mockApprove.mockReset();
        mockReject.mockReset();
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('shows a new request with the seat, message and current occupant', async () => {
        mockListPending.mockResolvedValue({ requests: [REQUEST], activeAssignmentCount: 1 });
        const store = renderAlerts();
        await flush();
        expect(screen.getByTestId('classroom-teacher-kick-toast')).toBeTruthy();
        expect(screen.getByText(/Seat 7/)).toBeTruthy();
        expect(screen.getByText(/たろう/)).toBeTruthy();
        expect(screen.getByTestId('classroom-teacher-kick-toast-reason').textContent).toContain('番号をまちがえた');
        expect(store.getState().scratchGui.classroom.teacherKickRequests).toHaveLength(1);
    });

    test('hides the toast after 30 seconds but keeps the count for the menu', async () => {
        mockListPending.mockResolvedValue({ requests: [REQUEST], activeAssignmentCount: 1 });
        const store = renderAlerts();
        await flush();
        await act(async () => {
            jest.advanceTimersByTime(30000);
        });
        expect(screen.queryByTestId('classroom-teacher-kick-toast')).toBeNull();
        expect(store.getState().scratchGui.classroom.teacherKickRequests).toHaveLength(1);
    });

    test('summarizes several requests instead of stacking them', async () => {
        mockListPending.mockResolvedValue({
            requests: [REQUEST, { ...REQUEST, requestId: 'r2', seatNumber: 8 }],
            activeAssignmentCount: 1,
        });
        renderAlerts();
        await flush();
        expect(screen.getAllByTestId('classroom-teacher-kick-toast-request')).toHaveLength(1);
        fireEvent.click(screen.getByTestId('classroom-teacher-kick-toast-show-all'));
        expect(screen.getAllByTestId('classroom-teacher-kick-toast-request')).toHaveLength(2);
    });

    test('approve calls the existing approve API and removes the request', async () => {
        mockListPending.mockResolvedValue({ requests: [REQUEST], activeAssignmentCount: 1 });
        mockApprove.mockResolvedValue(null);
        const store = renderAlerts();
        await flush();
        fireEvent.click(screen.getByTestId('classroom-teacher-kick-toast-approve'));
        await flush();
        expect(mockApprove).toHaveBeenCalledWith('teacher-token', 'c1', 'r1');
        expect(store.getState().scratchGui.classroom.teacherKickRequests).toEqual([]);
        expect(screen.queryByTestId('classroom-teacher-kick-toast')).toBeNull();
    });

    test('reject calls the existing DELETE API', async () => {
        mockListPending.mockResolvedValue({ requests: [REQUEST], activeAssignmentCount: 1 });
        mockReject.mockResolvedValue(null);
        renderAlerts();
        await flush();
        fireEvent.click(screen.getByTestId('classroom-teacher-kick-toast-reject'));
        await flush();
        expect(mockReject).toHaveBeenCalledWith('teacher-token', 'c1', 'r1');
    });

    test('"later" hides the toast; the menu list reopens it', async () => {
        mockListPending.mockResolvedValue({ requests: [REQUEST], activeAssignmentCount: 1 });
        const store = renderAlerts();
        await flush();
        fireEvent.click(screen.getByTestId('classroom-teacher-kick-toast-later'));
        expect(screen.queryByTestId('classroom-teacher-kick-toast')).toBeNull();
        act(() => {
            store.dispatch({ type: 'scratch-gui/classroom/OPEN_TEACHER_KICK_LIST' });
        });
        expect(screen.getByTestId('classroom-teacher-kick-toast')).toBeTruthy();
    });

    test('open assignment jumps through the teacher menu navigation', async () => {
        mockListPending.mockResolvedValue({ requests: [REQUEST], activeAssignmentCount: 1 });
        const store = renderAlerts();
        await flush();
        fireEvent.click(screen.getByTestId('classroom-teacher-kick-toast-open'));
        const state = store.getState().scratchGui.classroom;
        expect(state.teacherLastSelection).toEqual({ classroomId: 'c1', groupId: 'g1' });
        expect(state.teacherNavTarget).toBe('current-assignment');
        expect(state.teacherModalVisible).toBe(true);
    });

    test('does nothing while logged out', async () => {
        renderAlerts({ teacherLoggedIn: false });
        await flush();
        expect(mockListPending).not.toHaveBeenCalled();
    });
});
