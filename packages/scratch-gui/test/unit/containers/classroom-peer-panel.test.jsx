/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomPeerPanel from '../../../src/containers/classroom-peer-panel.jsx';
import classroomReducer, {
    closeStudentPeerPanel,
    openStudentPeerPanel,
    setClassroomSession,
} from '../../../src/reducers/classroom.js';

const mockListPeers = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: { listPeerSubmissions: (...args) => mockListPeers(...args) },
}));

// CSS Modules: return the class name itself so the seat classes can be checked (#1926).
jest.mock(
    '../../__mocks__/styleMock.js',
    () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) }),
);

const SUBMISSIONS = [
    {
        seatNumber: 2,
        submittedAt: '2026-10-26T00:00:00Z',
        thumbnailUrl: 'https://s3/2-thumb.png',
        screenshotUrls: ['https://s3/2-a.png'],
        screenshotLabels: ['Cat'],
    },
];

const renderPanel = () => {
    const store = createStore(combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer }) }));
    store.dispatch(
        setClassroomSession({
            role: 'student',
            classroomId: 'c1',
            className: 'A',
            assignmentName: 'X',
            joinCode: 'ABC123',
            seatNumber: 3,
            memberId: 'seat-03',
            sessionToken: 'st',
        }),
    );
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <ClassroomPeerPanel />
            </IntlProvider>
        </Provider>,
    );
    return store;
};

describe('ClassroomPeerPanel (#1210)', () => {
    beforeEach(() => {
        mockListPeers.mockReset();
        window.localStorage.clear();
    });

    test('should render nothing and not fetch while closed', () => {
        renderPanel();
        expect(screen.queryByTestId('classroom-peer-panel')).toBeNull();
        expect(mockListPeers).not.toHaveBeenCalled();
    });

    test('should fetch once on open and open a submitted seat in the viewer', async () => {
        mockListPeers.mockResolvedValue({ peerView: 'always', submissions: SUBMISSIONS });
        const store = renderPanel();
        act(() => store.dispatch(openStudentPeerPanel()));
        await waitFor(() => expect(screen.getByTestId('classroom-peer-panel-seat-2')).toBeEnabled());
        expect(mockListPeers).toHaveBeenCalledTimes(1);
        expect(mockListPeers).toHaveBeenCalledWith('st', 'c1');
        expect(screen.getByTestId('classroom-peer-panel-seat-1')).toBeDisabled();
        expect(screen.getByTestId('classroom-peer-panel-seat-3')).toBeDisabled();
        expect(screen.getByTestId('classroom-peer-panel-hint')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByTestId('classroom-peer-panel-seat-2'));
        });
        expect(screen.getByTestId('classroom-peer-viewer')).toBeInTheDocument();
        // Still one request: the list is fresh, and nothing polls.
        expect(mockListPeers).toHaveBeenCalledTimes(1);
        expect(store.getState().scratchGui.classroom.studentPeerView).toBe('always');

        fireEvent.click(screen.getByTestId('classroom-peer-viewer-close'));
        expect(screen.queryByTestId('classroom-peer-viewer')).toBeNull();
    });

    test('should keep the viewer inside a window narrowed after the GUI mounted', async () => {
        const width = window.innerWidth;
        try {
            // The default viewer position comes from the window at mount time.
            window.innerWidth = 2000;
            mockListPeers.mockResolvedValue({ peerView: 'always', submissions: SUBMISSIONS });
            const store = renderPanel();
            window.innerWidth = 1000;
            act(() => store.dispatch(openStudentPeerPanel()));
            await waitFor(() => expect(screen.getByTestId('classroom-peer-panel-seat-2')).toBeEnabled());
            await act(async () => {
                fireEvent.click(screen.getByTestId('classroom-peer-panel-seat-2'));
            });
            const transform = screen.getByTestId('classroom-peer-viewer').style.transform;
            const x = Number(/translate\((-?[\d.]+)px/.exec(transform)[1]);
            expect(x).toBeLessThanOrEqual(1000);
        } finally {
            window.innerWidth = width;
        }
    });

    test('should read the list again from the refresh button', async () => {
        mockListPeers.mockResolvedValue({ peerView: 'always', submissions: [] });
        const store = renderPanel();
        act(() => store.dispatch(openStudentPeerPanel()));
        await waitFor(() => expect(screen.getByTestId('classroom-peer-panel-refresh')).toBeEnabled());
        await act(async () => {
            fireEvent.click(screen.getByTestId('classroom-peer-panel-refresh'));
        });
        expect(mockListPeers).toHaveBeenCalledTimes(2);
    });

    test('should say "submit to see" and remember the setting on 403 not-submitted', async () => {
        const err = Object.assign(new Error('x'), { status: 403, body: { reason: 'not-submitted' } });
        mockListPeers.mockRejectedValue(err);
        const store = renderPanel();
        act(() => store.dispatch(openStudentPeerPanel()));
        await waitFor(() =>
            expect(screen.getByTestId('classroom-peer-panel-error')).toHaveAttribute('data-error', 'notSubmitted'),
        );
        expect(store.getState().scratchGui.classroom.studentPeerView).toBe('afterSubmit');
    });

    test('should remember "off" on 403 peer-view-off', async () => {
        const err = Object.assign(new Error('x'), { status: 403, body: { reason: 'peer-view-off' } });
        mockListPeers.mockRejectedValue(err);
        const store = renderPanel();
        act(() => store.dispatch(openStudentPeerPanel()));
        await waitFor(() =>
            expect(screen.getByTestId('classroom-peer-panel-error')).toHaveAttribute('data-error', 'off'),
        );
        expect(store.getState().scratchGui.classroom.studentPeerView).toBe('none');
        act(() => store.dispatch(closeStudentPeerPanel()));
        expect(screen.queryByTestId('classroom-peer-panel')).toBeNull();
    });

    test('未提出の席は押せない淡い灰（押せる空席の白い点線にしない）、提出済みは提出済みの緑 (#1926)', async () => {
        mockListPeers.mockResolvedValue({ peerView: 'always', submissions: SUBMISSIONS });
        const store = renderPanel();
        act(() => {
            store.dispatch(openStudentPeerPanel());
        });
        await waitFor(() => expect(screen.getByTestId('classroom-peer-panel-seat-2')).toBeEnabled());
        const seat1 = screen.getByTestId('classroom-peer-panel-seat-1');
        expect(seat1).toHaveClass('seatNotSubmitted');
        expect(seat1).not.toHaveClass('seatEmpty');
        expect(seat1.dataset.seatColor).toBe('notSubmitted');
        const seat2 = screen.getByTestId('classroom-peer-panel-seat-2');
        expect(seat2).toHaveClass('seatSubmitted');
        expect(seat2.dataset.seatColor).toBe('submitted');
        // 自分の席（3）は押せず、点線ではなく実線の枠のクラス
        expect(screen.getByTestId('classroom-peer-panel-seat-3')).toHaveClass('seatOwn');
    });
});
