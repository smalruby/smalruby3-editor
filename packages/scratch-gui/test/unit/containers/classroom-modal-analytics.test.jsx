/* eslint-env jest */
/**
 * 生徒の流れの GA (#1831) のつなぎこみ。見た目のコンポーネントはスタブにして、
 * container が送る classroom_student のイベントだけを見る。おかえりなさい（welcome_view）だけは
 * 本物の StudentStatusView を描いて、状態の確かめの成功・失敗の経路を通す。
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomModal from '../../../src/containers/classroom-modal.jsx';
import { clearPendingKickRequest, savePendingKickRequest } from '../../../src/lib/classroom-kick-request-storage.js';
import { LAST_SEATS_STORAGE_KEY } from '../../../src/lib/classroom-last-seats-storage.js';
import { resetClassroomStudentViews } from '../../../src/lib/classroom-student-analytics.js';
import { resetSharedLessonAnalytics } from '../../../src/lib/lessons/lesson-analytics.js';

const mockLookupClassroom = jest.fn();
const mockJoinClassroom = jest.fn();
const mockVerifySession = jest.fn();
const mockCreateKickRequest = jest.fn();
const mockLeaveClassroom = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        lookupClassroom: (...args) => mockLookupClassroom(...args),
        joinClassroom: (...args) => mockJoinClassroom(...args),
        verifySession: (...args) => mockVerifySession(...args),
        createKickRequest: (...args) => mockCreateKickRequest(...args),
        leaveClassroom: (...args) => mockLeaveClassroom(...args),
    },
}));

let mockProps = null;
// The real welcome back screen, so welcome_view goes through the container's status check.
jest.mock('../../../src/components/classroom-modal/classroom-modal.jsx', () => {
    const mockReact = jest.requireActual('react');
    const StudentStatusView = jest.requireActual(
        '../../../src/components/classroom-modal/student-status-view.jsx',
    ).default;
    return {
        __esModule: true,
        default: (props) => {
            mockProps = props;
            if (props.phase !== 'student-status') return null;
            return mockReact.createElement(StudentStatusView, {
                classroomState: props.classroomState,
                isLoading: props.isLoading,
                statusCheckedSeq: props.statusCheckedSeq,
                onContinue: props.onClose,
                onLeaveClassroom: props.onLeaveClassroom,
                onRefreshStudentStatus: props.onRefreshStudentStatus,
                onTrack: props.onTrack,
                onWrongSeat: props.onWrongSeat,
            });
        },
    };
});
jest.mock('../../../src/lib/ruby-to-blocks-converter-hoc.jsx', () => ({
    __esModule: true,
    default: (Component) => Component,
}));
let mockUrlParams = {};
jest.mock('../../../src/lib/url-params.js', () => ({
    getUrlParams: () => mockUrlParams,
    clearClasscode: () => {},
}));
const mockEvent = jest.fn();
jest.mock('../../../src/lib/analytics', () => ({
    __esModule: true,
    default: { event: (...args) => mockEvent(...args) },
}));
jest.mock('../../../src/lib/lessons/open-lessons-library.js', () => ({ openAssignmentLessonsLibrary: () => {} }));
let mockPolling = null;
jest.mock('../../../src/containers/use-kick-request-polling.js', () => ({
    __esModule: true,
    default: (args) => {
        mockPolling = args;
    },
}));
let mockSubmit = {};
jest.mock('../../../src/containers/use-student-submit.js', () => ({ __esModule: true, default: () => mockSubmit }));
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
            classroom: { role: null, sessionToken: null, studentPeerView: null, ...classroom },
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
        mockCreateKickRequest.mockReset();
        mockLeaveClassroom.mockReset();
        mockLeaveClassroom.mockResolvedValue({});
        mockPolling = null;
        mockSubmit = {};
        mockUrlParams = {};
        window.localStorage.clear();
        clearPendingKickRequest();
        resetSharedLessonAnalytics();
        resetClassroomStudentViews();
        now = Date.now();
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

    describe('kick_request', () => {
        const openSeat = async () => {
            mockLookupClassroom.mockResolvedValue(lookup());
            renderModal();
            await act(async () => {
                await mockProps.onJoinWithCode('ABC123');
            });
        };
        const sendRequest = async () => {
            act(() => mockProps.onRequestKick(3));
            await act(async () => {
                await mockProps.onConfirmKickRequest('');
            });
        };

        test('sent は番号選びを出してから、rejected は送ってからの秒', async () => {
            await openSeat();
            mockCreateKickRequest.mockResolvedValue({ requestId: 'r1' });
            now += 5000;
            await sendRequest();
            expect(eventsOf('kick_request')).toEqual([expect.objectContaining({ result: 'sent', seconds: 5 })]);
            now += 20000;
            act(() => mockPolling.onResult('rejected', lookup()));
            expect(eventsOf('kick_request')[1]).toMatchObject({ result: 'rejected', seconds: 20 });
        });

        test('approved は送ってからの秒で、そのあと自動で入るのは seat_select via=kick_approved', async () => {
            await openSeat();
            mockCreateKickRequest.mockResolvedValue({ requestId: 'r1' });
            mockJoinClassroom.mockResolvedValue(joined(3));
            await sendRequest();
            now += 8000;
            await act(async () => {
                mockPolling.onResult('approved', lookup({ takenSeats: [] }));
                for (let i = 0; i < 6; i++) await Promise.resolve();
            });
            expect(eventsOf('kick_request')[1]).toMatchObject({ result: 'approved', seconds: 8 });
            expect(eventsOf('seat_select')).toEqual([
                expect.objectContaining({ result: 'ok', via: 'kick_approved', is_previous: false }),
            ]);
        });

        test('送れなかったら error、ダイアログの「やめる」は canceled', async () => {
            await openSeat();
            mockCreateKickRequest.mockRejectedValue({ status: 500 });
            await sendRequest();
            act(() => mockProps.onCancelKickRequest());
            expect(eventsOf('kick_request').map((e) => e.result)).toEqual(['error', 'canceled']);
        });

        test('答えを受けたら起点を戻す（次の答えには、そのタブで送った時刻が無いので秒を付けない）', async () => {
            await openSeat();
            mockCreateKickRequest.mockResolvedValue({ requestId: 'r1' });
            await sendRequest();
            act(() => mockPolling.onResult('rejected', lookup()));
            // A second request answered after a reload-like gap: the earlier send time must not be reused.
            mockCreateKickRequest.mockResolvedValue({ requestId: 'r2' });
            await sendRequest();
            now += 3000;
            act(() => mockPolling.onResult('rejected', lookup()));
            expect(eventsOf('kick_request').map((e) => [e.result, e.seconds])).toEqual([
                ['sent', 0],
                ['rejected', 0],
                ['sent', 0],
                ['rejected', 3],
            ]);
        });

        test('閉じて開き直したときの答え（このタブで送っていない）には秒を付けない', async () => {
            savePendingKickRequest({
                requestId: 'r1',
                joinCode: 'ABC123',
                seatNumber: 3,
                createdAt: new Date(now).toISOString(),
            });
            mockLookupClassroom.mockResolvedValue(lookup({ takenSeats: [1] }));
            mockJoinClassroom.mockResolvedValue(joined(3));
            renderModal();
            await act(async () => {
                for (let i = 0; i < 6; i++) await Promise.resolve();
            });
            expect(eventsOf('kick_request')).toEqual([
                expect.objectContaining({ result: 'approved', seconds: undefined }),
            ]);
        });
    });

    test('submit_open は来たところ（from）と提出状況（state）を入れ、お願いを消す', async () => {
        mockVerifySession.mockResolvedValue({ valid: true, hasAssignment: false, submission: null });
        mockSubmit = { handleStartSubmit: jest.fn() };
        const store = renderModal({
            role: 'student',
            sessionToken: 'tok',
            classroomId: 'c1',
            submissionStatus: 'submitted',
            studentSubmitRequested: true,
            studentSubmitFrom: 'drawer',
        });
        await act(async () => {
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        expect(eventsOf('submit_open')).toEqual([expect.objectContaining({ from: 'drawer', state: 'resubmit' })]);
        expect(mockSubmit.handleStartSubmit).toHaveBeenCalledTimes(1);
        expect(store.getActions().map((a) => a.type)).toContain('scratch-gui/classroom/CLEAR_STUDENT_SUBMIT_REQUEST');
    });

    describe('modal_close を送らないとき', () => {
        test('提出の送信中は閉じないので送らない', async () => {
            mockSubmit = { isSubmitting: true };
            mockLookupClassroom.mockResolvedValue(lookup());
            const store = renderModal();
            await act(async () => {
                await mockProps.onJoinWithCode('ABC123');
            });
            act(() => mockProps.onDismiss());
            expect(eventsOf('modal_close')).toEqual([]);
            expect(store.getActions().map((a) => a.type)).not.toContain('scratch-gui/classroom/CLOSE_MODAL');
        });

        test('「出席番号がちがう」で席を移っている間は送らない', async () => {
            mockVerifySession.mockResolvedValue({ valid: true, hasAssignment: false, submission: null });
            mockLookupClassroom.mockReturnValue(new Promise(() => {}));
            renderModal({
                role: 'student',
                sessionToken: 'tok',
                classroomId: 'c1',
                joinCode: 'ABC123',
                seatNumber: 3,
            });
            await act(async () => {
                for (let i = 0; i < 6; i++) await Promise.resolve();
            });
            act(() => {
                mockProps.onWrongSeat();
            });
            act(() => mockProps.onDismiss());
            expect(eventsOf('modal_close')).toEqual([]);
        });
    });

    describe('join_code を送らないとき（自動の問い合わせ）', () => {
        test('待っている退室依頼の課題を開き直したとき', async () => {
            savePendingKickRequest({
                requestId: 'r1',
                joinCode: 'ABC123',
                seatNumber: 3,
                createdAt: new Date(now).toISOString(),
            });
            mockLookupClassroom.mockResolvedValue(lookup({ activeKickRequestIds: ['r1'] }));
            renderModal();
            await act(async () => {
                for (let i = 0; i < 6; i++) await Promise.resolve();
            });
            expect(mockLookupClassroom).toHaveBeenCalledWith('ABC123');
            expect(eventsOf('join_code')).toEqual([]);
            expect(eventsOf('seat_view')).toHaveLength(1);
        });

        test('退室させられて番号選びへ戻るとき', async () => {
            mockVerifySession.mockRejectedValue({
                status: 410,
                body: { reason: 'kicked', joinCode: 'ABC123', className: '1年1組', seatNumber: 3 },
            });
            mockLookupClassroom.mockResolvedValue(lookup());
            renderModal({ role: 'student', sessionToken: 'tok', classroomId: 'c1' });
            await act(async () => {
                for (let i = 0; i < 8; i++) await Promise.resolve();
            });
            expect(mockProps.phase).toBe('student-seat');
            expect(eventsOf('join_code')).toEqual([]);
        });
    });

    describe('welcome_view（本物のおかえりなさい・M1）', () => {
        const SESSION = {
            role: 'student',
            sessionToken: 'tok',
            classroomId: 'c1',
            joinCode: 'ABC123',
            seatNumber: 3,
        };
        const settle = () =>
            act(async () => {
                for (let i = 0; i < 8; i++) await Promise.resolve();
            });

        test('状態の確かめが成功したら 1 回送る', async () => {
            mockVerifySession.mockResolvedValue({ valid: true, hasAssignment: false, submission: null });
            renderModal(SESSION);
            await settle();
            expect(eventsOf('welcome_view')).toEqual([expect.objectContaining({ main: 'continue' })]);
        });

        test('退室させられていたら送らない（session_end kicked だけ）', async () => {
            mockVerifySession.mockRejectedValue({
                status: 410,
                body: { reason: 'kicked', joinCode: 'ABC123', className: '1年1組', seatNumber: 3 },
            });
            mockLookupClassroom.mockResolvedValue(lookup());
            renderModal(SESSION);
            await settle();
            expect(eventsOf('welcome_view')).toEqual([]);
            expect(eventsOf('session_end')).toEqual([expect.objectContaining({ reason: 'kicked' })]);
        });

        test('セッションが切れていたら送らない', async () => {
            mockVerifySession.mockRejectedValue({ status: 401 });
            renderModal(SESSION);
            await settle();
            expect(eventsOf('welcome_view')).toEqual([]);
        });

        test('URL で同じ課題に戻ってセッションが切れていたら、送らずに session_end expired（Q1）', async () => {
            mockUrlParams = { classcode: 'ABC123' };
            mockVerifySession.mockRejectedValue({ status: 401 });
            mockLookupClassroom.mockResolvedValue(lookup());
            renderModal(SESSION);
            await settle();
            expect(mockLookupClassroom).toHaveBeenCalledWith('ABC123');
            expect(eventsOf('welcome_view')).toEqual([]);
            expect(eventsOf('session_end')).toEqual([expect.objectContaining({ reason: 'expired' })]);
            expect(eventsOf('join_code')).toEqual([]);
        });

        test('マウントし直しても（PC とスマホの切りかえ）もう一度は送らない', async () => {
            mockVerifySession.mockResolvedValue({ valid: true, hasAssignment: false, submission: null });
            renderModal(SESSION);
            await settle();
            renderModal(SESSION);
            await settle();
            expect(eventsOf('welcome_view')).toHaveLength(1);
        });
    });
});
