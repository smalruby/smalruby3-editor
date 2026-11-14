/* eslint-env jest */
/**
 * 「提出しよう」の吹き出し (#1835) を出す・しまう時を決めるコンテナ。時計は sessionStorage、
 * 結果は Redux の submitReminderVisible。GA（#1831）の口に出来事を渡す。
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomSubmitReminder, { STORAGE_KEY } from '../../../src/containers/classroom-submit-reminder.jsx';
import { addSubmitReminderListener } from '../../../src/lib/classroom-submit-reminder-events.js';
import classroomReducer, {
    clearClassroomSession,
    closeClassroomModal,
    dismissSubmitReminder,
    openClassroomModal,
    setClassroomSession,
    setSubmissionStatus,
} from '../../../src/reducers/classroom.js';

const MIN = 60 * 1000;
const T0 = Date.parse('2026-11-14T09:00:00.000Z');

const student = (overrides = {}) => ({
    role: 'student',
    classroomId: 'class-1',
    className: '1組',
    assignmentName: '課題',
    joinCode: 'abc123',
    seatNumber: 3,
    memberId: 'm1',
    sessionToken: 'tok',
    joinedAt: new Date(T0).toISOString(),
    ...overrides,
});

const makeStore = () =>
    createStore(
        combineReducers({
            scratchGui: combineReducers({
                classroom: classroomReducer,
                lessonMode: (state = { progress: {} }) => state,
            }),
        }),
    );

let visibility = 'visible';
const setVisibility = (value) => {
    visibility = value;
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
    });
};

const advance = (ms) =>
    act(() => {
        jest.advanceTimersByTime(ms);
    });

/** タイマーを止めた時間を進める（スリープ: その間 setInterval は動かない）。 */
const sleep = (ms) => jest.setSystemTime(Date.now() + ms);

const visible = (store) => store.getState().scratchGui.classroom.submitReminderVisible;

let events;
let unsubscribe;

beforeAll(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
    window.sessionStorage.clear();
    window.localStorage.clear();
    visibility = 'visible';
    events = [];
    unsubscribe = addSubmitReminderListener((e) => events.push(e));
});

afterEach(() => {
    unsubscribe();
    jest.useRealTimers();
});

const mount = (store, sessionOverrides) => {
    if (sessionOverrides !== null) store.dispatch(setClassroomSession(student(sessionOverrides)));
    return render(
        <Provider store={store}>
            <ClassroomSubmitReminder />
        </Provider>,
    );
};

describe('ClassroomSubmitReminder (#1835)', () => {
    test('開いたら「このタブの始まり」を sessionStorage に覚える', () => {
        mount(makeStore(), null);
        expect(JSON.parse(window.sessionStorage.getItem(STORAGE_KEY))).toMatchObject({ tabStartedAt: T0 });
    });

    test('参加して 25 分で出し、出したことを知らせる', () => {
        const store = makeStore();
        mount(store, {});
        advance(24 * MIN);
        expect(visible(store)).toBe(false);
        advance(1 * MIN);
        expect(visible(store)).toBe(true);
        expect(events).toEqual([{ type: 'shown', first: true, minutesSinceStart: 25 }]);
    });

    test('参加していなければ出さない', () => {
        const store = makeStore();
        mount(store, null);
        advance(60 * MIN);
        expect(visible(store)).toBe(false);
    });

    test('クラスの画面（提出確認）が開いている間は出さず、閉じたらすぐ出す', () => {
        const store = makeStore();
        mount(store, {});
        act(() => {
            store.dispatch(openClassroomModal());
        });
        advance(30 * MIN);
        expect(visible(store)).toBe(false);
        act(() => {
            store.dispatch(closeClassroomModal());
        });
        expect(visible(store)).toBe(true);
    });

    test('出ているときにモーダルを開いたらしまう（消したことにはしない）', () => {
        const store = makeStore();
        mount(store, {});
        advance(25 * MIN);
        act(() => {
            store.dispatch(openClassroomModal());
        });
        expect(visible(store)).toBe(false);
        expect(events.filter((e) => e.type === 'dismissed')).toEqual([]);
    });

    test('消したら 10 分後にもう一度出す', () => {
        const store = makeStore();
        mount(store, {});
        advance(25 * MIN);
        act(() => {
            store.dispatch(dismissSubmitReminder('close'));
        });
        expect(visible(store)).toBe(false);
        expect(events[1]).toEqual({ type: 'dismissed', reason: 'close' });
        advance(9 * MIN);
        expect(visible(store)).toBe(false);
        advance(1 * MIN);
        expect(visible(store)).toBe(true);
        expect(events[2]).toMatchObject({ type: 'shown', first: false });
    });

    test('提出したらしまい、その課題ではもう出さない。出したあとで提出したことを知らせる', () => {
        const store = makeStore();
        mount(store, {});
        advance(25 * MIN);
        advance(5 * MIN);
        act(() => {
            store.dispatch(setSubmissionStatus('submitted', new Date().toISOString()));
        });
        expect(visible(store)).toBe(false);
        expect(events).toContainEqual({ type: 'submitted_after_shown', minutesSinceShown: 5 });
        advance(120 * MIN);
        expect(visible(store)).toBe(false);
    });

    test('出す前に提出したら「出したあとの提出」は知らせない', () => {
        const store = makeStore();
        mount(store, {});
        advance(10 * MIN);
        act(() => {
            store.dispatch(setSubmissionStatus('submitted', new Date().toISOString()));
        });
        expect(events).toEqual([]);
    });

    test('リロードしても数え続ける（sessionStorage のタブの始まりから）', () => {
        window.sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ tabStartedAt: T0 - 20 * MIN, lastVisibleAt: T0 - 5000 }),
        );
        const store = makeStore();
        mount(store, { joinedAt: new Date(T0 - 30 * MIN).toISOString() });
        advance(4 * MIN);
        expect(visible(store)).toBe(false);
        advance(1 * MIN);
        expect(visible(store)).toBe(true);
    });

    test('新しいタブ（sessionStorage が空）は、前に参加していてもタブの始まりから 25 分', () => {
        const store = makeStore();
        mount(store, { joinedAt: new Date(T0 - 7 * 24 * 60 * MIN).toISOString() });
        expect(visible(store)).toBe(false);
        advance(25 * MIN);
        expect(visible(store)).toBe(true);
    });

    test('タブのとちゅうで参加したら、参加してから 25 分', () => {
        const store = makeStore();
        mount(store, null);
        advance(40 * MIN);
        act(() => {
            store.dispatch(setClassroomSession(student({ joinedAt: new Date().toISOString() })));
        });
        advance(24 * MIN);
        expect(visible(store)).toBe(false);
        advance(1 * MIN);
        expect(visible(store)).toBe(true);
    });

    test('課題がかわったら、新しい課題に参加してから 25 分', () => {
        const store = makeStore();
        mount(store, {});
        advance(25 * MIN);
        act(() => {
            store.dispatch(dismissSubmitReminder('close'));
        });
        advance(5 * MIN);
        act(() => {
            store.dispatch(clearClassroomSession());
            store.dispatch(
                setClassroomSession(student({ classroomId: 'class-2', joinedAt: new Date().toISOString() })),
            );
        });
        advance(10 * MIN);
        expect(visible(store)).toBe(false);
        advance(15 * MIN);
        expect(visible(store)).toBe(true);
    });

    test('60 分より短く隠れていた間も数える', () => {
        const store = makeStore();
        mount(store, {});
        advance(10 * MIN);
        setVisibility('hidden');
        advance(20 * MIN);
        expect(visible(store)).toBe(false);
        setVisibility('visible');
        expect(visible(store)).toBe(true);
    });

    test('60 分以上隠れていたら、次に見えたときから数え直す', () => {
        const store = makeStore();
        mount(store, {});
        advance(10 * MIN);
        setVisibility('hidden');
        advance(60 * MIN);
        setVisibility('visible');
        expect(visible(store)).toBe(false);
        advance(24 * MIN);
        expect(visible(store)).toBe(false);
        advance(1 * MIN);
        expect(visible(store)).toBe(true);
    });

    test('60 分以上スリープしたら（タイマーが止まっていても）、起きたときから数え直す', () => {
        const store = makeStore();
        mount(store, {});
        advance(10 * MIN);
        sleep(70 * MIN);
        advance(15 * 1000);
        expect(visible(store)).toBe(false);
        advance(24 * MIN);
        expect(visible(store)).toBe(false);
        advance(1 * MIN);
        expect(visible(store)).toBe(true);
    });
});
