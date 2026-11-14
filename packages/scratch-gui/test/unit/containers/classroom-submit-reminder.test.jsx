/* eslint-env jest */
/**
 * 「提出しよう」の吹き出し (#1835) を出す・しまう時を決めるコンテナ。時計は sessionStorage、
 * 結果は Redux の submitReminderVisible。GA（#1831）の口に出来事を渡す。
 */
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomMenuSubmitButton from '../../../src/components/classroom-modal/classroom-menu-submit-button.jsx';
import ClassroomSubmitReminder, { STORAGE_KEY } from '../../../src/containers/classroom-submit-reminder.jsx';
import analytics from '../../../src/lib/analytics';
import { addSubmitReminderListener } from '../../../src/lib/classroom-submit-reminder-events.js';
import classroomReducer, {
    clearClassroomSession,
    closeClassroomModal,
    dismissSubmitReminder,
    openClassroomModal,
    setClassroomSession,
    setSubmissionStatus,
    setTeacherLoggedIn,
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
        expect(events).toEqual([{ type: 'shown', first: true, resumed: false, minutesSinceStart: 25 }]);
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
        expect(events[2]).toMatchObject({ type: 'shown', first: false, resumed: false });
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

    // Q2: 同じ回の出し直しは「新しく出した」と数えない（#1831 の回数を正しくする）。
    describe('出した回数の数え方', () => {
        const shownEvents = () => events.filter((e) => e.type === 'shown');

        test('モーダルを開いて閉じて出し直したときは resumed: true（新しく出したとは数えない）', () => {
            const store = makeStore();
            mount(store, {});
            advance(25 * MIN);
            for (let i = 0; i < 3; i++) {
                act(() => {
                    store.dispatch(openClassroomModal());
                });
                act(() => {
                    store.dispatch(closeClassroomModal());
                });
            }
            expect(visible(store)).toBe(true);
            expect(shownEvents().map((e) => e.resumed)).toEqual([false, true, true, true]);
            expect(shownEvents().filter((e) => !e.resumed)).toHaveLength(1);
        });

        test('出したあとにリロードしても、同じ回は resumed: true', () => {
            const store = makeStore();
            const view = mount(store, {});
            advance(25 * MIN);
            view.unmount();
            act(() => {
                store.dispatch({ type: 'scratch-gui/classroom/SET_SUBMIT_REMINDER_VISIBLE', visible: false });
            });
            advance(1 * MIN);
            mount(store, null);
            expect(visible(store)).toBe(true);
            expect(shownEvents()).toEqual([
                { type: 'shown', first: true, resumed: false, minutesSinceStart: 25 },
                { type: 'shown', first: false, resumed: true, minutesSinceStart: 26 },
            ]);
        });

        test('セッションが切れて同じ課題に入り直しても、first: true をもう一度出さない', () => {
            const store = makeStore();
            mount(store, {});
            advance(25 * MIN);
            act(() => {
                store.dispatch(clearClassroomSession());
            });
            act(() => {
                store.dispatch(setClassroomSession(student({ joinedAt: new Date().toISOString() })));
            });
            advance(25 * MIN);
            expect(shownEvents().map((e) => e.first)).toEqual([true, false]);
        });

        test('別の課題では first: true になる', () => {
            const store = makeStore();
            mount(store, {});
            advance(25 * MIN);
            act(() => {
                store.dispatch(clearClassroomSession());
                store.dispatch(
                    setClassroomSession(student({ classroomId: 'class-2', joinedAt: new Date().toISOString() })),
                );
            });
            advance(25 * MIN);
            expect(shownEvents().map((e) => e.first)).toEqual([true, true]);
        });
    });

    // Q1: 「提出する」→「やめる」のあとは、マウスでもキーボードでも 10 分たつまで出さない。
    describe('「提出する」を押して「やめる」', () => {
        let rects;
        let box;
        beforeEach(() => {
            rects = jest.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}]);
            box = jest
                .spyOn(Element.prototype, 'getBoundingClientRect')
                .mockReturnValue({ left: 10, right: 100, top: 8, bottom: 40, width: 90, height: 32 });
        });
        afterEach(() => {
            rects.mockRestore();
            box.mockRestore();
        });

        const mountWithButton = (store) => {
            store.dispatch(setClassroomSession(student()));
            return render(
                <Provider store={store}>
                    <IntlProvider locale="en">
                        <ClassroomSubmitReminder />
                        <ClassroomMenuSubmitButton />
                    </IntlProvider>
                </Provider>,
            );
        };

        test.each([
            ['マウス', true],
            ['キーボード（Enter / Space は pointerdown 無しの click）', false],
        ])('%s: 押す → やめる → 10 分たつまで出さない', (_label, withPointer) => {
            const store = makeStore();
            const { getByTestId, queryByTestId } = mountWithButton(store);
            advance(25 * MIN);
            expect(queryByTestId('classroom-submit-reminder')).not.toBeNull();
            const button = getByTestId('classroom-menu-submit');
            if (withPointer) fireEvent.pointerDown(button);
            fireEvent.click(button);
            expect(store.getState().scratchGui.classroom.modalVisible).toBe(true);
            expect(store.getState().scratchGui.classroom.submitReminderDismissCount).toBe(1);
            expect(store.getState().scratchGui.classroom.submitReminderDismissReason).toBe('submit');
            // 提出確認の「やめる」
            act(() => {
                store.dispatch(closeClassroomModal());
            });
            expect(visible(store)).toBe(false);
            advance(9 * MIN);
            expect(visible(store)).toBe(false);
            advance(1 * MIN);
            expect(visible(store)).toBe(true);
            expect(events.filter((e) => e.type === 'dismissed')).toEqual([{ type: 'dismissed', reason: 'submit' }]);
            expect(events.filter((e) => e.type === 'shown').map((e) => e.resumed)).toEqual([false, false]);
        });
    });
});

describe('ClassroomSubmitReminder の GA (#1831)', () => {
    let gaEvents;
    let spy;
    beforeEach(() => {
        gaEvents = [];
        spy = jest.spyOn(analytics, 'event').mockImplementation((e) => gaEvents.push(e));
    });
    afterEach(() => spy.mockRestore());

    test('出したら submit_reminder_shown（はじめてか・何分後か）を送る', () => {
        const store = makeStore();
        mount(store, {});
        advance(25 * MIN);
        const shown = gaEvents.filter((e) => e.action === 'submit_reminder_shown');
        expect(shown).toHaveLength(1);
        expect(shown[0]).toMatchObject({ category: 'classroom_student', first: true, minutes: 25 });
    });

    test('先生がログイン中なら送らない', () => {
        const store = makeStore();
        store.dispatch(setTeacherLoggedIn(true));
        mount(store, {});
        advance(25 * MIN);
        expect(gaEvents.filter((e) => e.category === 'classroom_student')).toEqual([]);
    });
});
