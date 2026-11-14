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
let mockContinueOptions = null;
let mockRefreshContinueOptions = () => Promise.resolve();
jest.mock('../../../src/containers/use-student-assignment.js', () => ({
    __esModule: true,
    default: () => ({
        continueOptions: mockContinueOptions,
        handleJoined: () => Promise.resolve('student-joined'),
        refreshLesson: () => Promise.resolve(),
        refreshContinueOptions: () => mockRefreshContinueOptions(),
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

const renderModal = (classroom, gui = {}) => {
    const store = mockStore({
        scratchGui: {
            classroom: { role: null, sessionToken: null, ...classroom },
            vm: null,
            projectTitle: '',
            lessonMode: { progress: {} },
            ...gui,
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

    test('leaves the welcome back screen when the session turns out dead (#1797)', async () => {
        // A seat the teacher freed and another student took answers 401 (not 410 kicked):
        // without a session the welcome back screen would read 「出席番号null」.
        mockVerifySession.mockRejectedValue({ status: 401, body: {} });
        const store = renderModal(SESSION);
        await act(async () => {
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        expect(store.getActions().map((a) => a.type)).toContain('scratch-gui/classroom/CLEAR_SESSION');
        expect(mockProps.phase).toBe('student-join');
    });

    test('does not show the seat it just freed as in use (#1797)', async () => {
        mockLookupClassroom.mockResolvedValue({ ...lookup(), takenSeats: [3, 5] });
        renderModal(SESSION);
        await act(async () => {
            await mockProps.onWrongSeat();
        });
        expect(mockProps.phase).toBe('student-seat');
        expect(mockProps.takenSeats).toEqual([5]);
    });

    test('a failed lookup keeps the session (looked up before leaving)', async () => {
        mockLookupClassroom.mockRejectedValue({ status: 0 });
        const store = renderModal(SESSION);
        await act(async () => {
            await mockProps.onWrongSeat();
        });
        expect(mockLeaveClassroom).not.toHaveBeenCalled();
        expect(store.getActions().map((a) => a.type)).not.toContain('scratch-gui/classroom/CLEAR_SESSION');
        expect(mockProps.phase).toBe('student-status');
        expect(mockProps.error).toBeTruthy();
        expect(mockProps.isLoading).toBe(false);
    });

    test('a failed leave keeps the session and the student can try again', async () => {
        mockLeaveClassroom.mockRejectedValueOnce({ status: 0 });
        const store = renderModal(SESSION);
        await act(async () => {
            await mockProps.onWrongSeat();
        });
        expect(store.getActions().map((a) => a.type)).not.toContain('scratch-gui/classroom/CLEAR_SESSION');
        expect(mockProps.phase).toBe('student-status');
        expect(mockProps.error).toBeTruthy();
        // retry
        await act(async () => {
            await mockProps.onWrongSeat();
        });
        expect(mockLeaveClassroom).toHaveBeenCalledTimes(2);
        expect(mockProps.phase).toBe('student-seat');
    });

    test('the modal cannot be closed while switching the seat', async () => {
        let finishLeave;
        mockLeaveClassroom.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishLeave = resolve;
                }),
        );
        const store = renderModal(SESSION);
        let pending;
        await act(async () => {
            pending = mockProps.onWrongSeat();
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        expect(mockProps.isLoading).toBe(true);
        act(() => mockProps.onClose());
        expect(store.getActions().map((a) => a.type)).not.toContain('scratch-gui/classroom/CLOSE_MODAL');
        await act(async () => {
            finishLeave({});
            await pending;
        });
        expect(mockProps.phase).toBe('student-seat');
        expect(mockProps.isLoading).toBe(false);
        act(() => mockProps.onClose());
        expect(store.getActions().map((a) => a.type)).toContain('scratch-gui/classroom/CLOSE_MODAL');
    });
});

describe("ClassroomModal: offer this assignment's submission after a reload (#1825)", () => {
    const CURRENT = { classroomId: 'c1', submittedAt: '2026-11-10T01:00:00.000Z', projectUrl: 'https://x/cur.sb3' };
    const emptyVm = { runtime: { targets: [{ blocks: { _blocks: {} } }, { blocks: { _blocks: {} } }] } };
    const settle = () =>
        act(async () => {
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });

    beforeEach(() => {
        mockProps = null;
        mockVerifySession.mockReset();
        mockVerifySession.mockResolvedValue({ valid: true, hasAssignment: true, submission: null });
        mockContinueOptions = { current: CURRENT, previous: null };
        mockRefreshContinueOptions = () => Promise.resolve();
        window.localStorage.clear();
        clearPendingKickRequest();
    });

    test('offers it once the session is confirmed on the untouched new project', async () => {
        renderModal(SESSION, { vm: emptyVm, projectChanged: false });
        await settle();
        expect(mockProps.offerCurrentSubmission).toBe(true);
    });

    test.each([
        ['has blocks', {}, { vm: { runtime: { targets: [{ blocks: { _blocks: { a: {} } } }] } } }],
        ['was changed', {}, { projectChanged: true }],
        ['came from outside', { projectFromOutside: true }, {}],
    ])('does not offer it when the project %s', async (_label, classroom, gui) => {
        renderModal({ ...SESSION, ...classroom }, { vm: emptyVm, projectChanged: false, ...gui });
        await settle();
        expect(mockProps.offerCurrentSubmission).toBe(false);
    });

    test('does not offer the submission already loaded in this tab', async () => {
        renderModal(
            { ...SESSION, studentLoadedSubmission: 'c1:2026-11-10T01:00:00.000Z' },
            { vm: emptyVm, projectChanged: false },
        );
        await settle();
        expect(mockProps.offerCurrentSubmission).toBe(false);
    });

    test('does not offer it when the session check fails', async () => {
        mockVerifySession.mockRejectedValue({ status: 500, body: {} });
        renderModal(SESSION, { vm: emptyVm, projectChanged: false });
        await settle();
        expect(mockProps.offerCurrentSubmission).toBeFalsy();
    });
    test('keeps the screen busy (main button not pressable) until the submissions answer arrives', async () => {
        let answer;
        mockRefreshContinueOptions = () =>
            new Promise((resolve) => {
                answer = resolve;
            });
        renderModal(SESSION, { vm: emptyVm, projectChanged: false });
        await settle();
        // verify-session has answered, the submissions have not: 「つづける」 must not be pressable yet.
        expect(mockVerifySession).toHaveBeenCalled();
        expect(answer).toEqual(expect.any(Function));
        expect(mockProps.isLoading).toBe(true);
        await act(async () => {
            answer();
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        expect(mockProps.isLoading).toBe(false);
        expect(mockProps.offerCurrentSubmission).toBe(true);
    });
});
