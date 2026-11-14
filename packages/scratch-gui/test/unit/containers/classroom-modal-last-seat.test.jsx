/* eslint-env jest */
/**
 * 前回の番号（localStorage `smalruby:classroom:lastSeats`）のつなぎこみ (#1796)。
 * 見た目のコンポーネントはスタブにして、container が渡す props と保存の中身だけを見る。
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomModal from '../../../src/containers/classroom-modal.jsx';
import { clearPendingKickRequest, savePendingKickRequest } from '../../../src/lib/classroom-kick-request-storage.js';
import { LAST_SEATS_STORAGE_KEY } from '../../../src/lib/classroom-last-seats-storage.js';

const mockLookupClassroom = jest.fn();
const mockJoinClassroom = jest.fn();
const mockVerifySession = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        lookupClassroom: (...args) => mockLookupClassroom(...args),
        joinClassroom: (...args) => mockJoinClassroom(...args),
        verifySession: (...args) => mockVerifySession(...args),
        leaveClassroom: () => Promise.resolve(),
    },
}));

let mockProps = null;
jest.mock('../../../src/components/classroom-modal/classroom-modal.jsx', () => ({
    __esModule: true,
    default: (props) => {
        mockProps = props;
        return null;
    },
}));
jest.mock('../../../src/lib/ruby-to-blocks-converter-hoc.jsx', () => ({
    __esModule: true,
    default: (Component) => Component,
}));
jest.mock('../../../src/lib/url-params.js', () => ({
    getUrlParams: () => ({}),
    clearClasscode: () => {},
}));
jest.mock('../../../src/lib/analytics', () => ({ __esModule: true, default: { event: () => {} } }));
jest.mock('../../../src/lib/lessons/open-lessons-library.js', () => ({ openAssignmentLessonsLibrary: () => {} }));
jest.mock('../../../src/containers/use-kick-request-polling.js', () => ({ __esModule: true, default: () => {} }));
jest.mock('../../../src/containers/use-student-submit.js', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('../../../src/containers/use-student-assignment.js', () => ({
    __esModule: true,
    default: () => ({
        handleJoined: () => Promise.resolve('student-joined'),
        refreshLesson: () => Promise.resolve(),
    }),
}));

const mockStore = configureStore();

const renderModal = (classroom = {}) => {
    const store = mockStore({
        scratchGui: {
            classroom: { role: null, sessionToken: null, ...classroom },
            vm: null,
            projectTitle: '',
            lessonMode: { progress: {} },
        },
    });
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <ClassroomModal />
            </IntlProvider>
        </Provider>,
    );
    return store;
};

const flush = () =>
    act(async () => {
        for (let i = 0; i < 6; i++) await Promise.resolve();
    });

const lookup = (extra = {}) => ({
    classroomId: 'c1',
    groupId: 'g1',
    className: '1年1組',
    assignmentName: '課題',
    studentCount: 40,
    takenSeats: [],
    activeKickRequestIds: [],
    expiresAt: null,
    ...extra,
});

const joined = (seatNumber) => ({
    classroomId: 'c1',
    className: '1年1組',
    assignmentName: '課題',
    seatNumber,
    memberId: `m${seatNumber}`,
    sessionToken: 'tok',
    hasAssignment: false,
});

const storedSeats = () => JSON.parse(window.localStorage.getItem(LAST_SEATS_STORAGE_KEY) || '{}');

describe('ClassroomModal previous seat (#1796)', () => {
    beforeEach(() => {
        mockProps = null;
        mockLookupClassroom.mockReset();
        mockJoinClassroom.mockReset();
        mockVerifySession.mockReset();
        window.localStorage.clear();
        clearPendingKickRequest();
    });

    test('the lookup recalls the seat saved for the class', async () => {
        window.localStorage.setItem(LAST_SEATS_STORAGE_KEY, JSON.stringify({ 'group:g1': 3 }));
        mockLookupClassroom.mockResolvedValue(lookup({ classroomId: 'c2' }));
        renderModal();
        await act(async () => {
            await mockProps.onJoinWithCode('ABC123');
        });
        expect(mockProps.phase).toBe('student-seat');
        expect(mockProps.previousSeat).toBe(3);
        expect(mockProps.selectedSeat).toBeNull();
    });

    test('an assignment outside a class is remembered by its own id', async () => {
        window.localStorage.setItem(LAST_SEATS_STORAGE_KEY, JSON.stringify({ 'group:g1': 3, 'assignment:c9': 8 }));
        mockLookupClassroom.mockResolvedValue(lookup({ groupId: null, classroomId: 'c9' }));
        renderModal();
        await act(async () => {
            await mockProps.onJoinWithCode('ABC123');
        });
        expect(mockProps.previousSeat).toBe(8);
    });

    test('joining saves the seat under the class', async () => {
        mockLookupClassroom.mockResolvedValue(lookup());
        mockJoinClassroom.mockResolvedValue(joined(5));
        renderModal();
        await act(async () => {
            await mockProps.onJoinWithCode('ABC123');
        });
        act(() => mockProps.onSelectSeat(5));
        await act(async () => {
            await mockProps.onConfirmJoin();
        });
        expect(mockJoinClassroom).toHaveBeenCalledWith('ABC123', 5);
        expect(storedSeats()).toEqual({ 'group:g1': 5 });
    });

    test('the automatic join after an approved kick request saves the seat too', async () => {
        savePendingKickRequest({
            requestId: 'r1',
            joinCode: 'ABC123',
            seatNumber: 7,
            createdAt: new Date().toISOString(),
        });
        // Seat 7 is free again: the teacher approved the request.
        mockLookupClassroom.mockResolvedValue(lookup({ takenSeats: [1] }));
        mockJoinClassroom.mockResolvedValue(joined(7));
        renderModal();
        await flush();
        expect(mockJoinClassroom).toHaveBeenCalledWith('ABC123', 7);
        expect(storedSeats()).toEqual({ 'group:g1': 7 });
    });

    test('a seat the student was removed from is forgotten', async () => {
        window.localStorage.setItem(LAST_SEATS_STORAGE_KEY, JSON.stringify({ 'group:g1': 3, 'group:g2': 4 }));
        mockVerifySession.mockRejectedValue({
            status: 410,
            body: { reason: 'kicked', joinCode: 'ABC123', className: '1年1組', seatNumber: 3 },
        });
        // The student who asked for seat 3 has already joined it.
        mockLookupClassroom.mockResolvedValue(lookup({ takenSeats: [3] }));
        renderModal({ role: 'student', sessionToken: 'old', classroomId: 'c1', joinCode: 'ABC123', seatNumber: 3 });
        await flush();
        expect(mockLookupClassroom).toHaveBeenCalledWith('ABC123');
        expect(mockProps.phase).toBe('student-seat');
        expect(mockProps.previousSeat).toBeNull();
        expect(storedSeats()).toEqual({ 'group:g2': 4 });
    });
});
