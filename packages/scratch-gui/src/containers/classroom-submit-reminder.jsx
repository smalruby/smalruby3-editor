/**
 * 「提出しよう」の吹き出し (#1835) を出す・しまう時を決める（画面には何も描かない）。
 *
 * 判断は lib/classroom-submit-reminder.js の純粋関数。ここは時計を sessionStorage に置き、
 * タブが見えている間だけ定期に確かめ、結果を Redux（submitReminderVisible）に書く。
 * 吹き出し・ドロワー・☰ の点はその値を読むだけ。GA の口は lib/classroom-submit-reminder-events.js。
 */
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { emitSubmitReminderEvent } from '../lib/classroom-submit-reminder-events.js';
import {
    clockForAssignment,
    firstShownAtOf,
    isSubmitReminderEligible,
    markSubmitReminderDismissed,
    markSubmitReminderShown,
    observeTabVisible,
    parseReminderClock,
    submitReminderCountFrom,
    submitReminderShowing,
} from '../lib/classroom-submit-reminder.js';
import { setSubmitReminderVisible } from '../reducers/classroom.js';
import useMenuSubmitKind from './use-menu-submit-kind.js';

/** sessionStorage のキー。タブごと（リロードで続く・新しいタブは空）。 */
const STORAGE_KEY = 'smalruby:classroomSubmitReminder';
/** 見えている間に確かめる間隔。25 分・10 分に対して十分に細かい。 */
const TICK_MS = 15 * 1000;
const MINUTE_MS = 60 * 1000;

const readClock = () => {
    try {
        return parseReminderClock(window.sessionStorage.getItem(STORAGE_KEY));
    } catch (_e) {
        return {};
    }
};

const writeClock = (clock) => {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clock));
    } catch (_e) {
        // 使えない環境（プライベートモードなど）では、このページを開いている間だけ数える
    }
};

const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * @returns {null} 何も描かない
 */
const ClassroomSubmitReminder = () => {
    const dispatch = useDispatch();
    const classroom = useSelector((state) => state.scratchGui.classroom) || {};
    const menuKind = useMenuSubmitKind();
    const joined = !!(classroom.role === 'student' && classroom.sessionToken);
    const eligible = isSubmitReminderEligible({
        menuKind,
        classroomModalVisible: !!classroom.modalVisible,
        teacherModalVisible: !!classroom.teacherModalVisible,
        submitting: !!classroom.studentSubmitting,
    });
    const assignmentKey = joined ? classroom.classroomId || null : null;
    const joinedAt = joined ? classroom.joinedAt : null;
    const visible = !!classroom.submitReminderVisible;

    // sessionStorage が使えないときの控え（読み書きできれば毎回 sessionStorage が正）
    const memoryClock = useRef(null);
    const loadClock = useCallback(() => {
        const stored = readClock();
        return Object.keys(stored).length || !memoryClock.current ? stored : memoryClock.current;
    }, []);
    const saveClock = useCallback((clock) => {
        memoryClock.current = clock;
        writeClock(clock);
    }, []);

    const latest = useRef({});
    latest.current = { eligible, assignmentKey, joinedAt, visible };

    const evaluate = useCallback(() => {
        if (isHidden()) return;
        const now = Date.now();
        const { eligible: canShow, assignmentKey: key, joinedAt: joinedTime, visible: shown } = latest.current;
        let clock = clockForAssignment(observeTabVisible(loadClock(), now), key);
        const { due, dueAt, resumed } = submitReminderShowing({
            now,
            eligible: canShow,
            clock,
            joinedAt: joinedTime,
        });
        if (due && !shown) {
            // 同じ回の出し直し（モーダルを閉じた・リロードした）は resumed: true で知らせる。
            // #1831 は resumed でないものだけを「出した回数」に数える（docs/classroom/ui-ux.md）。
            const first = !resumed && firstShownAtOf(clock) === null;
            if (!resumed) clock = markSubmitReminderShown(clock, now, dueAt);
            const countFrom = submitReminderCountFrom({ clock, joinedAt: joinedTime });
            emitSubmitReminderEvent({
                type: 'shown',
                first,
                resumed,
                minutesSinceStart: Math.round((now - countFrom) / MINUTE_MS),
            });
        }
        saveClock(clock);
        if (due !== shown) dispatch(setSubmitReminderVisible(due));
    }, [dispatch, loadClock, saveClock]);

    // 開いたときに「このタブの始まり」を決める。条件が変わったら（モーダルを閉じた・提出した・
    // 課題がかわった）すぐ確かめ直す。
    useEffect(() => {
        evaluate();
    }, [evaluate, eligible, assignmentKey, joinedAt]);

    // 参加している間だけ、見えているときに定期で確かめる。隠れる直前は「最後に見えた時刻」を残す
    // （そこから 60 分以上たって見えたら数え直す。スリープで timer が止まっても同じに扱える）。
    useEffect(() => {
        if (!joined) return;
        const timer = setInterval(evaluate, TICK_MS);
        const handleVisibility = () => {
            if (isHidden()) {
                saveClock(observeTabVisible(loadClock(), Date.now()));
            } else {
                evaluate();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [joined, evaluate, loadClock, saveClock]);

    // 消したら（× ・外を押した・「提出する」）時刻を残す。ここから 10 分後にもう一度出す。
    const dismissCount = classroom.submitReminderDismissCount || 0;
    const lastDismissCount = useRef(dismissCount);
    useEffect(() => {
        if (dismissCount === lastDismissCount.current) return;
        lastDismissCount.current = dismissCount;
        const now = Date.now();
        saveClock(markSubmitReminderDismissed(clockForAssignment(loadClock(), latest.current.assignmentKey), now));
        emitSubmitReminderEvent({ type: 'dismissed', reason: classroom.submitReminderDismissReason || null });
    }, [dismissCount, classroom.submitReminderDismissReason, loadClock, saveClock]);

    // 吹き出しを出したあとで提出したら知らせる（何分後に出したかを GA で見るため）。
    const submitted = joined && !!classroom.submissionStatus;
    const wasSubmitted = useRef(submitted);
    useEffect(() => {
        const before = wasSubmitted.current;
        wasSubmitted.current = submitted;
        if (before || !submitted) return;
        const firstShownAt = firstShownAtOf(clockForAssignment(loadClock(), latest.current.assignmentKey));
        if (firstShownAt === null) return;
        emitSubmitReminderEvent({
            type: 'submitted_after_shown',
            minutesSinceShown: Math.round((Date.now() - firstShownAt) / MINUTE_MS),
        });
    }, [submitted, loadClock]);

    return null;
};

export default ClassroomSubmitReminder;
export { STORAGE_KEY, TICK_MS };
