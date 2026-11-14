/* eslint-env jest */
/**
 * おかえりなさいの画面の「出席番号がちがう」(#1794)。見た目のコンポーネントはスタブにして、
 * container が呼ぶ API・dispatch・渡す props だけを見る。
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomModal from '../../../src/containers/classroom-modal.jsx';
import { clearPendingKickRequest } from '../../../src/lib/classroom-kick-request-storage.js';
import { LAST_SEATS_STORAGE_KEY } from '../../../src/lib/classroom-last-seats-storage.js';

const mockLookupClassroom = jest.fn();
const mockJoinClassroom = jest.fn();
const mockVerifySession = jest.fn();
const mockLeaveClassroom = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        lookupClassroom: (...args) => mockLookupClassroom(...args),
        joinClassroom: (...args) => mockJoinClassroom(...args),
        verifySession: (...args) => mockVerifySession(...args),
        leaveClassroom: (...args) => mockLeaveClassroom(...args),
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
        refreshContinueOptions: () => Promise.resolve(),
        setHasAssignment: () => {},
    }),
}));

const mockStore = configureStore();

const SESSION = {
    role: 'student',
    sessionToken: 'tok',
    classroomId: 'c1',
    joinCode: 'ABC123',
    seatNumber: 3,
    className: '1年1組',
};

const renderModal = (classroom) => {
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

const lookup = () => ({
    classroomId: 'c1',
    groupId: 'g1',
    className: '1年1組',
    assignmentName: '課題',
    studentCount: 40,
    takenSeats: [],
    activeKickRequestIds: [],
    expiresAt: null,
});

describe('ClassroomModal: wrong seat on the welcome back screen (#1794)', () => {
    beforeEach(() => {
        mockProps = null;
        mockLookupClassroom.mockReset();
        mockJoinClassroom.mockReset();
        mockVerifySession.mockReset();
        mockLeaveClassroom.mockReset();
        mockVerifySession.mockResolvedValue({ valid: true, hasAssignment: false, submission: null });
        mockLeaveClassroom.mockResolvedValue({});
        mockLookupClassroom.mockResolvedValue(lookup());
        window.localStorage.clear();
        clearPendingKickRequest();
    });

    test('opens on the welcome back screen while joined', async () => {
        renderModal(SESSION);
        await act(async () => {
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        expect(mockProps.phase).toBe('student-status');
    });

    test("frees the seat, goes to the same assignment's seat selection and forgets that seat", async () => {
        window.localStorage.setItem(LAST_SEATS_STORAGE_KEY, JSON.stringify({ 'group:g1': 3, 'group:g2': 4 }));
        const store = renderModal(SESSION);
        await act(async () => {
            await mockProps.onWrongSeat();
        });
        expect(mockLeaveClassroom).toHaveBeenCalledWith('tok', 'c1');
        expect(store.getActions().map((a) => a.type)).toContain('scratch-gui/classroom/CLEAR_SESSION');
        expect(mockLookupClassroom).toHaveBeenCalledWith('ABC123');
        expect(mockProps.phase).toBe('student-seat');
        expect(mockProps.previousSeat).toBeNull();
        expect(JSON.parse(window.localStorage.getItem(LAST_SEATS_STORAGE_KEY))).toEqual({ 'group:g2': 4 });
    });

    test('still reaches the seat selection when leaving fails', async () => {
        mockLeaveClassroom.mockRejectedValue(new Error('network'));
        renderModal(SESSION);
        await act(async () => {
            await mockProps.onWrongSeat();
        });
        expect(mockProps.phase).toBe('student-seat');
    });
});
