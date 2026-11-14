/* eslint-env jest */
/**
 * 「提出しよう」の吹き出し (#1835) の判断。時刻はすべて引数で受ける純粋関数。
 */
import {
    FIRST_REMINDER_MS,
    HIDDEN_RESTART_MS,
    REPEAT_REMINDER_MS,
    clockForAssignment,
    isSubmitReminderDue,
    isSubmitReminderEligible,
    markSubmitReminderDismissed,
    markSubmitReminderShown,
    observeTabVisible,
    parseReminderClock,
    placeReminderBalloon,
    submitReminderCountFrom,
    submitReminderDueAt,
} from '../../../src/lib/classroom-submit-reminder.js';

const MIN = 60 * 1000;
const T0 = Date.parse('2026-11-14T09:00:00.000Z');

describe('定数', () => {
    test('初回 25 分・くり返し 10 分・見えない 60 分で数え直し', () => {
        expect(FIRST_REMINDER_MS).toBe(25 * MIN);
        expect(REPEAT_REMINDER_MS).toBe(10 * MIN);
        expect(HIDDEN_RESTART_MS).toBe(60 * MIN);
    });
});

describe('isSubmitReminderEligible — 出す条件', () => {
    const base = {
        menuKind: 'submit',
        classroomModalVisible: false,
        teacherModalVisible: false,
        submitting: false,
    };
    test('未提出の「提出する」が見えていて、モーダルが閉じていれば出せる', () => {
        expect(isSubmitReminderEligible(base)).toBe(true);
    });
    test('参加していない（ボタンが無い）なら出さない', () => {
        expect(isSubmitReminderEligible({ ...base, menuKind: null })).toBe(false);
    });
    test.each(['submitted', 'returned'])('提出済み・返却済み（%s）なら出さない', (menuKind) => {
        expect(isSubmitReminderEligible({ ...base, menuKind })).toBe(false);
    });
    test('作品を出さないレッスン・条件の前のレッスン（ボタンが出ない = null）では出さない', () => {
        expect(isSubmitReminderEligible({ ...base, menuKind: null })).toBe(false);
    });
    test('クラスのモーダル（提出確認もこの中）が開いていたら出さない', () => {
        expect(isSubmitReminderEligible({ ...base, classroomModalVisible: true })).toBe(false);
    });
    test('先生のモーダルが開いていたら出さない', () => {
        expect(isSubmitReminderEligible({ ...base, teacherModalVisible: true })).toBe(false);
    });
    test('送信中は出さない', () => {
        expect(isSubmitReminderEligible({ ...base, submitting: true })).toBe(false);
    });
});

describe('parseReminderClock — sessionStorage の値を読む', () => {
    test('空・壊れた値は空の時計', () => {
        expect(parseReminderClock(null)).toEqual({});
        expect(parseReminderClock('not json')).toEqual({});
        expect(parseReminderClock('[1,2]')).toEqual({});
        expect(parseReminderClock('"x"')).toEqual({});
    });
    test('数でない時刻は捨てる', () => {
        const raw = JSON.stringify({ tabStartedAt: 'x', lastVisibleAt: T0, assignmentKey: 'c1', dismissedAt: null });
        expect(parseReminderClock(raw)).toEqual({ lastVisibleAt: T0, assignmentKey: 'c1' });
    });
});

describe('observeTabVisible — このタブの始まりと、長く見えなかったときの数え直し', () => {
    test('新しいタブ（空の時計）は、いまがこのタブの始まり', () => {
        expect(observeTabVisible({}, T0)).toEqual({ tabStartedAt: T0, lastVisibleAt: T0 });
    });
    test('リロード（始まりが残っている）は始まりを変えない', () => {
        const clock = { tabStartedAt: T0, lastVisibleAt: T0 + 30 * MIN };
        expect(observeTabVisible(clock, T0 + 30 * MIN + 5000)).toEqual({
            tabStartedAt: T0,
            lastVisibleAt: T0 + 30 * MIN + 5000,
        });
    });
    test('60 分より短く見えなかったときは数え直さない（その間も数える）', () => {
        const clock = { tabStartedAt: T0, lastVisibleAt: T0 + 5 * MIN };
        const next = observeTabVisible(clock, T0 + 5 * MIN + 59 * MIN);
        expect(next.restartedAt).toBeUndefined();
        expect(next.lastVisibleAt).toBe(T0 + 64 * MIN);
    });
    test('60 分以上見えなかった（スリープなど）ら、いまから数え直す', () => {
        const clock = { tabStartedAt: T0, lastVisibleAt: T0 + 5 * MIN };
        const next = observeTabVisible(clock, T0 + 5 * MIN + 60 * MIN);
        expect(next.restartedAt).toBe(T0 + 65 * MIN);
        expect(next.tabStartedAt).toBe(T0);
    });
    test('ほかの値（課題ごとの記録）は残す', () => {
        const clock = { tabStartedAt: T0, lastVisibleAt: T0, assignmentKey: 'c1', dismissedAt: T0 + MIN };
        expect(observeTabVisible(clock, T0 + 2 * MIN)).toMatchObject({ assignmentKey: 'c1', dismissedAt: T0 + MIN });
    });
});

describe('clockForAssignment — 課題がかわったら課題ごとの記録を忘れる', () => {
    const clock = {
        tabStartedAt: T0,
        lastVisibleAt: T0,
        assignmentKey: 'c1',
        dismissedAt: T0 + 30 * MIN,
        firstShownAt: T0 + 25 * MIN,
    };
    test('同じ課題ならそのまま', () => {
        expect(clockForAssignment(clock, 'c1')).toBe(clock);
    });
    test('別の課題なら消した時刻・出した時刻を忘れる（タブの始まりは残す）', () => {
        expect(clockForAssignment(clock, 'c2')).toEqual({ tabStartedAt: T0, lastVisibleAt: T0, assignmentKey: 'c2' });
    });
});

describe('submitReminderCountFrom — 数え始め', () => {
    test('タブの始まりのほうがあと（参加してからリロード・翌週に開いたタブ）', () => {
        expect(
            submitReminderCountFrom({
                clock: { tabStartedAt: T0 + 10 * MIN },
                joinedAt: new Date(T0).toISOString(),
            }),
        ).toBe(T0 + 10 * MIN);
    });
    test('参加した時刻のほうがあと（タブのとちゅうで参加した）', () => {
        expect(
            submitReminderCountFrom({
                clock: { tabStartedAt: T0 },
                joinedAt: new Date(T0 + 40 * MIN).toISOString(),
            }),
        ).toBe(T0 + 40 * MIN);
    });
    test('数え直した時刻がいちばんあとならそれ', () => {
        expect(
            submitReminderCountFrom({
                clock: { tabStartedAt: T0, restartedAt: T0 + 90 * MIN },
                joinedAt: new Date(T0 + 40 * MIN).toISOString(),
            }),
        ).toBe(T0 + 90 * MIN);
    });
    test('参加した時刻が無い・読めないときはタブの始まり', () => {
        expect(submitReminderCountFrom({ clock: { tabStartedAt: T0 }, joinedAt: null })).toBe(T0);
        expect(submitReminderCountFrom({ clock: { tabStartedAt: T0 }, joinedAt: 'bad' })).toBe(T0);
    });
    test('何も無ければ null', () => {
        expect(submitReminderCountFrom({ clock: {}, joinedAt: null })).toBeNull();
    });
});

describe('submitReminderDueAt / isSubmitReminderDue — 回数', () => {
    test('まだ消していなければ、数え始めから 25 分', () => {
        expect(submitReminderDueAt({ countFrom: T0, dismissedAt: null })).toBe(T0 + 25 * MIN);
    });
    test('消したら、消したときから 10 分', () => {
        expect(submitReminderDueAt({ countFrom: T0, dismissedAt: T0 + 27 * MIN })).toBe(T0 + 37 * MIN);
    });
    test('数え直しより前に消した記録は使わない（数え直しから 25 分）', () => {
        expect(submitReminderDueAt({ countFrom: T0 + 90 * MIN, dismissedAt: T0 + 30 * MIN })).toBe(T0 + 115 * MIN);
    });
    test('数え始めが無ければ出さない', () => {
        expect(submitReminderDueAt({ countFrom: null, dismissedAt: null })).toBeNull();
    });

    const input = (now, extra = {}) => ({
        now,
        eligible: true,
        clock: { tabStartedAt: T0, assignmentKey: 'c1' },
        joinedAt: new Date(T0).toISOString(),
        ...extra,
    });
    test('24 分 59 秒では出さず、25 分で出す', () => {
        expect(isSubmitReminderDue(input(T0 + 25 * MIN - 1000))).toBe(false);
        expect(isSubmitReminderDue(input(T0 + 25 * MIN))).toBe(true);
    });
    test('出す条件を満たさなければ時間がたっても出さない', () => {
        expect(isSubmitReminderDue(input(T0 + 60 * MIN, { eligible: false }))).toBe(false);
    });
    test('消したあとは 10 分ごとにもう一度出す', () => {
        let clock = { tabStartedAt: T0, assignmentKey: 'c1' };
        // 25 分で出す → 26 分で × → 36 分まで出さない → 36 分で出す → 40 分で × → 50 分で出す
        expect(isSubmitReminderDue(input(T0 + 25 * MIN, { clock }))).toBe(true);
        clock = markSubmitReminderDismissed(clock, T0 + 26 * MIN);
        expect(isSubmitReminderDue(input(T0 + 30 * MIN, { clock }))).toBe(false);
        expect(isSubmitReminderDue(input(T0 + 36 * MIN - 1000, { clock }))).toBe(false);
        expect(isSubmitReminderDue(input(T0 + 36 * MIN, { clock }))).toBe(true);
        clock = markSubmitReminderDismissed(clock, T0 + 40 * MIN);
        expect(isSubmitReminderDue(input(T0 + 49 * MIN, { clock }))).toBe(false);
        expect(isSubmitReminderDue(input(T0 + 50 * MIN, { clock }))).toBe(true);
    });
    test('提出したら（条件を満たさなくなったら）、その課題ではもう出さない', () => {
        expect(isSubmitReminderDue(input(T0 + 200 * MIN, { eligible: false }))).toBe(false);
    });
    test('リロードしても数え続ける（時計は sessionStorage から戻る）', () => {
        const stored = JSON.stringify({ tabStartedAt: T0, lastVisibleAt: T0 + 20 * MIN, assignmentKey: 'c1' });
        let clock = parseReminderClock(stored);
        clock = observeTabVisible(clock, T0 + 20 * MIN + 3000);
        expect(isSubmitReminderDue(input(T0 + 25 * MIN, { clock }))).toBe(true);
    });
    test('新しいタブはそのタブの始まりから数える（前に参加していても）', () => {
        const opened = T0 + 7 * 24 * 60 * MIN;
        const clock = observeTabVisible({}, opened);
        expect(isSubmitReminderDue(input(opened + 24 * MIN, { clock }))).toBe(false);
        expect(isSubmitReminderDue(input(opened + 25 * MIN, { clock }))).toBe(true);
    });
    test('タブのとちゅうで参加したら、参加してから 25 分', () => {
        const joinedAt = new Date(T0 + 30 * MIN).toISOString();
        expect(isSubmitReminderDue(input(T0 + 50 * MIN, { joinedAt }))).toBe(false);
        expect(isSubmitReminderDue(input(T0 + 55 * MIN, { joinedAt }))).toBe(true);
    });
    test('課題がかわったら、前の課題で消した記録を使わず、新しい参加から 25 分', () => {
        let clock = markSubmitReminderDismissed({ tabStartedAt: T0, assignmentKey: 'c1' }, T0 + 26 * MIN);
        clock = clockForAssignment(clock, 'c2');
        const joinedAt = new Date(T0 + 30 * MIN).toISOString();
        expect(isSubmitReminderDue(input(T0 + 36 * MIN, { clock, joinedAt }))).toBe(false);
        expect(isSubmitReminderDue(input(T0 + 55 * MIN, { clock, joinedAt }))).toBe(true);
    });
    test('60 分以上スリープしたら、起きたときから 25 分（前に消した記録も使わない）', () => {
        let clock = markSubmitReminderDismissed(
            { tabStartedAt: T0, lastVisibleAt: T0 + 26 * MIN, assignmentKey: 'c1' },
            T0 + 26 * MIN,
        );
        const woke = T0 + 26 * MIN + 61 * MIN;
        clock = observeTabVisible(clock, woke);
        expect(isSubmitReminderDue(input(woke, { clock }))).toBe(false);
        expect(isSubmitReminderDue(input(woke + 24 * MIN, { clock }))).toBe(false);
        expect(isSubmitReminderDue(input(woke + 25 * MIN, { clock }))).toBe(true);
    });
    test('60 分より短く隠れていた間も数える', () => {
        let clock = { tabStartedAt: T0, lastVisibleAt: T0 + 5 * MIN, assignmentKey: 'c1' };
        clock = observeTabVisible(clock, T0 + 30 * MIN);
        expect(isSubmitReminderDue(input(T0 + 30 * MIN, { clock }))).toBe(true);
    });
});

describe('markSubmitReminderShown / markSubmitReminderDismissed', () => {
    test('はじめて出した時刻は最初の 1 回だけ覚える', () => {
        let clock = markSubmitReminderShown({ assignmentKey: 'c1' }, T0);
        clock = markSubmitReminderShown(clock, T0 + 10 * MIN);
        expect(clock.firstShownAt).toBe(T0);
    });
    test('消した時刻は毎回あたらしくする', () => {
        let clock = markSubmitReminderDismissed({ assignmentKey: 'c1' }, T0);
        clock = markSubmitReminderDismissed(clock, T0 + 10 * MIN);
        expect(clock.dismissedAt).toBe(T0 + 10 * MIN);
    });
});

describe('placeReminderBalloon — メニューバーの吹き出しを置く場所', () => {
    const anchor = { left: 840, right: 920, top: 8, bottom: 40 };
    const size = { width: 256, height: 52 };
    const viewport = { width: 1300, height: 600 };
    test('重なる操作が無ければ、メニューバーのすぐ下で「提出する」の右端にそろえる', () => {
        expect(placeReminderBalloon({ anchor, start: 48, size, obstacles: [], viewport })).toEqual({
            left: 664,
            top: 56,
            arrowLeft: 216,
        });
    });
    test('タブの段のリンクに重なるなら、その下へずらす', () => {
        const obstacles = [
            { left: 600, right: 700, top: 54, bottom: 76 },
            { left: 0, right: 100, top: 54, bottom: 76 },
        ];
        expect(placeReminderBalloon({ anchor, start: 48, size, obstacles, viewport }).top).toBe(84);
    });
    test('ずらした先でも重なれば、さらに下へ', () => {
        const obstacles = [
            { left: 600, right: 700, top: 54, bottom: 76 },
            { left: 900, right: 940, top: 90, bottom: 120 },
        ];
        expect(placeReminderBalloon({ anchor, start: 48, size, obstacles, viewport }).top).toBe(128);
    });
    test('下に置ける場所が無ければ、いちばん上に置く', () => {
        const obstacles = [{ left: 0, right: 1300, top: 50, bottom: 590 }];
        expect(placeReminderBalloon({ anchor, start: 48, size, obstacles, viewport }).top).toBe(56);
    });
    test('画面の左端からはみ出さない', () => {
        const place = placeReminderBalloon({
            anchor: { left: 60, right: 120, top: 8, bottom: 40 },
            start: 48,
            size,
            obstacles: [],
            viewport,
        });
        expect(place.left).toBe(8);
        expect(place.arrowLeft).toBe(82);
    });
    test('しっぽは吹き出しの中に収める', () => {
        const place = placeReminderBalloon({
            anchor: { left: 1290, right: 1300, top: 8, bottom: 40 },
            start: 48,
            size,
            obstacles: [],
            viewport,
        });
        expect(place.left).toBe(1036);
        expect(place.arrowLeft).toBe(240);
    });
});
