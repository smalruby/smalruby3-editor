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
const mockGetLessonProgress = jest.fn();
jest.mock('../../../src/lib/classroom-api.js', () => ({
    __esModule: true,
    default: {
        listClassrooms: (...args) => mockListClassrooms(...args),
        listMembers: (...args) => mockListMembers(...args),
        listSubmissions: (...args) => mockListSubmissions(...args),
        getLessonProgress: (...args) => mockGetLessonProgress(...args),
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

const renderPanel = (extraState = {}) => {
    const store = createStore(combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer }) }), {
        scratchGui: {
            classroom: {
                ...classroomInitialState,
                teacherLoggedIn: true,
                teacherPanelOpen: true,
                teacherLastSelection: { classroomId: 'c1', groupId: 'g1' },
                ...extraState,
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

    test('a logout during the re-auth prompt is not overwritten by the late token', async () => {
        mockListMembers.mockRejectedValueOnce(unauthorized());
        let resolve;
        mockReauth.mockReturnValue(
            new Promise((r) => {
                resolve = r;
            }),
        );
        const store = renderPanel();
        await flush();
        fireEvent.click(screen.getByTestId('classroom-teacher-panel-reauth'));
        await flush();
        // The teacher logs out from the menu bar while the prompt is open.
        mockToken = null;
        await act(async () => resolve('late-token'));
        await flush();
        expect(mockSetCachedToken).not.toHaveBeenCalled();
        expect(mockSaveTeacherToken).not.toHaveBeenCalled();
        expect(store.getState().scratchGui.classroom.teacherModalVisible).toBe(false);
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

describe('ClassroomTeacherPanel のレッスンの課題 (#1603)', () => {
    const lesson = {
        courseId: 'kyou-kara-programmer',
        challengeIds: ['blocks-l1-key-sound'],
        requiredChallengeIds: [],
        completion: { type: 'all' },
        submitWork: false,
        scoring: null,
    };

    beforeEach(() => {
        jest.useFakeTimers();
        mockToken = 'old-token';
        mockListClassrooms.mockReset();
        mockListMembers.mockReset();
        mockListSubmissions.mockReset();
        mockGetLessonProgress.mockReset();
        mockListClassrooms.mockResolvedValue({
            classrooms: [{ classroomId: 'c1', studentCount: 3, hasLesson: true }],
        });
        mockListMembers.mockResolvedValue({
            members: [{ memberId: 'seat-01' }, { memberId: 'seat-02' }],
        });
        mockListSubmissions.mockResolvedValue({ submissions: [] });
        mockGetLessonProgress.mockResolvedValue({
            lesson,
            progress: [
                {
                    memberId: 'seat-01',
                    seatNumber: 1,
                    challenges: { 'blocks-l1-key-sound': { completedAt: new Date().toISOString() } },
                    current: null,
                    updatedAt: new Date().toISOString(),
                },
            ],
        });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('課題クリア・止まっているの数、座席の色、チャレンジの横棒を出す', async () => {
        renderPanel();
        await flush();
        await flush();
        expect(mockGetLessonProgress).toHaveBeenCalledWith('old-token', 'c1');
        expect(screen.getByTestId('classroom-teacher-panel-lesson-cleared').textContent).toBe('Cleared 1 / 2');
        expect(screen.getByTestId('classroom-teacher-panel-lesson-stuck').textContent).toBe('Stuck 0');
        expect(screen.getByTestId('classroom-teacher-panel-seat-1').getAttribute('data-lesson-state')).toBe(
            'cleared',
        );
        expect(screen.getByTestId('classroom-teacher-panel-seat-2').getAttribute('data-lesson-state')).toBe(
            'notStarted',
        );
        expect(screen.getByTestId('classroom-teacher-panel-bar-blocks-l1-key-sound')).toBeTruthy();
        // 座席の色の凡例（#1926）: 空席・まだ・とちゅう・クリア ★
        expect(screen.getByTestId('classroom-teacher-panel-seat-legend-empty')).toBeTruthy();
        expect(screen.getByTestId('classroom-teacher-panel-seat-legend-cleared').textContent).toContain('★');
        expect(screen.getByTestId('classroom-teacher-panel-seat-1').textContent).toContain('★');
        expect(screen.getByTestId('classroom-teacher-panel-seat-2').textContent).not.toContain('★');
        // 作品を出さない課題では「提出」の数を出さない
        expect(screen.queryByTestId('classroom-teacher-panel-submitted')).toBeNull();
    });
});

describe('ClassroomTeacherPanel の座席の色 (#1926)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockToken = 'old-token';
        mockListClassrooms.mockReset();
        mockListMembers.mockReset();
        mockListSubmissions.mockReset();
        mockGetLessonProgress.mockReset();
        mockListClassrooms.mockResolvedValue({ classrooms: [{ classroomId: 'c1', studentCount: 5 }] });
        mockListMembers.mockResolvedValue({
            members: [
                { memberId: 'seat-01' },
                { memberId: 'seat-02', hasSubmission: true, submissionStatus: 'submitted' },
                { memberId: 'seat-03', hasSubmission: true, submissionStatus: 'returned' },
                { memberId: 'seat-05', left: true },
            ],
        });
        mockListSubmissions.mockResolvedValue({ submissions: [] });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('メンバータブと同じ意味の色と、座席の下に凡例を出す', async () => {
        renderPanel();
        await flush();
        await flush();
        const color = (n) => screen.getByTestId(`classroom-teacher-panel-seat-${n}`).getAttribute('data-seat-color');
        expect([1, 2, 3, 4, 5].map(color)).toEqual(['joined', 'submitted', 'returned', 'empty', 'empty']);
        const legend = screen.getByTestId('classroom-teacher-panel-seat-color-legend');
        const kinds = Array.from(
            legend.querySelectorAll('[data-testid^="classroom-teacher-panel-seat-color-legend-"]'),
        ).map((el) => el.getAttribute('data-testid').replace('classroom-teacher-panel-seat-color-legend-', ''));
        expect(kinds).toEqual(['empty', 'joined', 'submitted', 'returned']);
        // 凡例は座席のすぐ下
        const grid = screen.getByTestId('classroom-teacher-panel-grid');
        expect(grid.nextElementSibling).toBe(legend);
        // 空席の言葉はメンバータブと同じ「空席」（#1956 Q12）
        expect(screen.getByTestId('classroom-teacher-panel-seat-color-legend-empty').textContent).toContain('Empty');
        // 退室依頼が無いときは数の札を出さない
        expect(screen.queryByTestId('classroom-teacher-panel-kick-count')).toBeNull();
    });

    test('退室依頼があると、数の札を着席・提出の札と並べて出す (#1964)', async () => {
        renderPanel({
            teacherKickRequests: [
                { requestId: 'r1', classroomId: 'c1', seatNumber: 1, occupantName: 'a' },
                { requestId: 'r2', classroomId: 'c1', seatNumber: 2, occupantName: 'b' },
                { requestId: 'r3', classroomId: 'other', seatNumber: 3, occupantName: 'c' },
            ],
        });
        await flush();
        await flush();
        const tag = screen.getByTestId('classroom-teacher-panel-kick-count');
        expect(tag.textContent).toBe('Kick requests 2');
        expect(tag.parentElement).toBe(screen.getByTestId('classroom-teacher-panel-seated').parentElement);
    });

    test('読み込んだあとに退室依頼が届いて伸びても、パネルを画面の中に戻す (#1964 Q1)', async () => {
        const original = HTMLElement.prototype.getBoundingClientRect;
        const width = window.innerWidth;
        const height = window.innerHeight;
        window.innerWidth = 1300;
        window.innerHeight = 600;
        window.localStorage.setItem('smalruby:classroomTeacherPanelPosition', JSON.stringify({ x: 1000, y: 280 }));
        // 退室依頼 1 件ごとに 80px 伸びるパネル
        HTMLElement.prototype.getBoundingClientRect = function () {
            if (this.getAttribute('data-testid') !== 'classroom-teacher-panel') return original.call(this);
            const kicks = this.querySelectorAll('[data-testid="classroom-teacher-panel-kick-request"]').length;
            const h = 300 + 80 * kicks;
            return { width: 280, height: h, top: 0, left: 0, right: 280, bottom: h, x: 0, y: 0 };
        };
        try {
            const store = renderPanel();
            await flush();
            await flush();
            const panel = screen.getByTestId('classroom-teacher-panel');
            expect(panel.style.transform).toBe('translate(1000px,280px)');
            await act(async () => {
                store.dispatch({
                    type: 'scratch-gui/classroom/SET_TEACHER_KICK_REQUESTS',
                    requests: [1, 2, 3].map((n) => ({ requestId: `r${n}`, classroomId: 'c1', seatNumber: n })),
                });
            });
            await flush();
            // 300 + 80 * 3 = 540px の高さ → 下端が 600 を越えないよう上へ
            expect(panel.style.transform).toBe('translate(1000px,60px)');
        } finally {
            HTMLElement.prototype.getBoundingClientRect = original;
            window.innerWidth = width;
            window.innerHeight = height;
            window.localStorage.removeItem('smalruby:classroomTeacherPanelPosition');
        }
    });
});
