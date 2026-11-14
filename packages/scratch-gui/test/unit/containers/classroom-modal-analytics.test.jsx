/* eslint-env jest */
/**
 * 生徒の流れの GA (#1831) のつなぎこみ。見た目のコンポーネントはスタブにして、
 * container が送る classroom_student のイベントだけを見る。
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomModal from '../../../src/containers/classroom-modal.jsx';
import { clearPendingKickRequest } from '../../../src/lib/classroom-kick-request-storage.js';
import { LAST_SEATS_STORAGE_KEY } from '../../../src/lib/classroom-last-seats-storage.js';
import { resetSharedLessonAnalytics } from '../../../src/lib/lessons/lesson-analytics.js';

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
const mockEvent = jest.fn();
jest.mock('../../../src/lib/analytics', () => ({
    __esModule: true,
    default: { event: (...args) => mockEvent(...args) },
}));
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

const lookup = (extra = {}) => ({
    classroomId: 'c1',
    groupId: 'g1',
    className: '1年1組',
    assignmentName: '課題',
    studentCount: 40,
    takenSeats: [3],
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

const studentEvents = () => mockEvent.mock.calls.map(([e]) => e).filter((e) => e.category === 'classroom_student');
const eventsOf = (action) => studentEvents().filter((e) => e.action === action);

// Things that identify a class or a student must never reach GA.
const IDENTIFIERS = ['ABC123', '1年1組', '課題', 'tok', 'm5', 'c1', 'g1'];
const expectNoIdentifiers = () => {
    studentEvents().forEach((event) => {
        Object.values(event).forEach((value) => expect(IDENTIFIERS).not.toContain(value));
        expect(event).not.toHaveProperty('seatNumber');
    });
};

let now;

describe('ClassroomModal GA of the student flow (#1831)', () => {
    beforeEach(() => {
        mockProps = null;
        mockEvent.mockReset();
        mockLookupClassroom.mockReset();
        mockJoinClassroom.mockReset();
        mockVerifySession.mockReset();
        window.localStorage.clear();
        clearPendingKickRequest();
        resetSharedLessonAnalytics();
        now = 1000000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
    });
    afterEach(() => {
        Date.now.mockRestore();
    });

    test('参加コード → 番号選び → 番号を決める、の順に送る（秒・前回の番号か）', async () => {
        window.localStorage.setItem(LAST_SEATS_STORAGE_KEY, JSON.stringify({ 'group:g1': 5 }));
        mockLookupClassroom.mockResolvedValue(lookup());
        mockJoinClassroom.mockResolvedValue(joined(5));
        renderModal();
        await act(async () => {
            await mockProps.onJoinWithCode('ABC123');
        });
        expect(eventsOf('join_code')).toEqual([expect.objectContaining({ result: 'ok' })]);
        expect(eventsOf('seat_view')).toEqual([
            expect.objectContaining({ previous_seat: true, previous_taken: false }),
        ]);
        now += 12000;
        act(() => mockProps.onSelectSeat(5));
        await act(async () => {
            await mockProps.onConfirmJoin();
        });
        expect(eventsOf('seat_select')).toEqual([
            expect.objectContaining({
                result: 'ok',
                via: 'grid',
                seconds: 12,
                is_previous: true,
                after_guide: false,
            }),
        ]);
        // the existing classroom / join event stays as it is
        expect(mockEvent.mock.calls.map(([e]) => e)).toContainEqual(
            expect.objectContaining({ category: 'classroom', action: 'join' }),
        );
        expectNoIdentifiers();
    });

    test('30 秒の案内のあとに決めたら after_guide', async () => {
        mockLookupClassroom.mockResolvedValue(lookup());
        mockJoinClassroom.mockResolvedValue(joined(6));
        renderModal();
        await act(async () => {
            await mockProps.onJoinWithCode('ABC123');
        });
        act(() => mockProps.onSeatIdleGuide());
        expect(eventsOf('seat_idle_guide')).toHaveLength(1);
        act(() => mockProps.onSelectSeat(6));
        await act(async () => {
            await mockProps.onConfirmJoin();
        });
        expect(eventsOf('seat_select')[0]).toMatchObject({ after_guide: true, is_previous: false });
    });

    test('使用中だった番号は result=taken', async () => {
        mockLookupClassroom.mockResolvedValue(lookup());
        mockJoinClassroom.mockRejectedValue({ status: 409 });
        renderModal();
        await act(async () => {
            await mockProps.onJoinWithCode('ABC123');
        });
        act(() => mockProps.onSelectSeat(6));
        await act(async () => {
            await mockProps.onConfirmJoin();
        });
        expect(eventsOf('seat_select')).toEqual([expect.objectContaining({ result: 'taken' })]);
    });

    test('参加コードが見つからない', async () => {
        mockLookupClassroom.mockRejectedValue({ status: 404 });
        renderModal();
        await act(async () => {
            await mockProps.onJoinWithCode('NOPE00');
        });
        expect(eventsOf('join_code')).toEqual([expect.objectContaining({ result: 'not_found' })]);
        expect(eventsOf('seat_view')).toEqual([]);
    });

    test('×・外側・Esc で閉じたら modal_close に段を入れる', async () => {
        mockLookupClassroom.mockResolvedValue(lookup());
        renderModal();
        await act(async () => {
            await mockProps.onJoinWithCode('ABC123');
        });
        act(() => mockProps.onDismiss());
        expect(eventsOf('modal_close')).toEqual([expect.objectContaining({ step: 'seat' })]);
    });

    test('セッションが切れていたら session_end expired', async () => {
        mockVerifySession.mockRejectedValue({ status: 401 });
        renderModal({ role: 'student', sessionToken: 'tok', classroomId: 'c1' });
        await act(async () => {
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        expect(eventsOf('session_end')).toEqual([expect.objectContaining({ reason: 'expired' })]);
    });

    test('先生がログイン中なら classroom_student は送らない', async () => {
        mockLookupClassroom.mockResolvedValue(lookup());
        renderModal({ teacherLoggedIn: true });
        await act(async () => {
            await mockProps.onJoinWithCode('ABC123');
        });
        act(() => mockProps.onDismiss());
        expect(studentEvents()).toEqual([]);
    });
});
