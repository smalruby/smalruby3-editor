// クラスの課題へレッスンの進み具合を送る（#1600・D8 / D9）。決まりは docs/lessons/design.md の
// 「本人の確認」「進み具合の送り方」、送る中身・答えの保存は lib/lessons/lesson-progress-sync.js。
//
// 送るとき（定期的には送らない）:
//   - 課題のチャレンジが「できた」とき（端末の記録が増えたとき）
//   - 課題のチャレンジを開いたとき（current）
//   - クラスの画面を開いたとき（lessonMode.progressSendRequest が増えたとき）・課題に参加したとき
// 1 回の送信は席 × 課題の 1 件。最後に送れた中身で足りているときは送らない。送れなかったときは
// 何も取っておかず、次に送るときに端末の記録からまとめて送り直す。
//
// その課題 × 席ではじめて送るとき、端末に課題のチャレンジの記録があれば、送る前に本人の確認を出す。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import LessonProgressConfirm, {
    CONFIRM_STEPS,
} from '../components/lesson-progress-confirm/lesson-progress-confirm.jsx';
import classroomAPI from '../lib/classroom-api.js';
import { assignmentChallengeRecords } from '../lib/lessons/assignment-progress.js';
import {
    CONSENT_ANSWERS,
    SEND_FAILURES,
    buildProgressPayload,
    classifySendFailure,
    confirmationItems,
    consentKey,
    currentChallengeOf,
    isCoveredBy,
    loadConsent,
    makeConsent,
    mergeAcked,
    needsConfirmation,
    saveConsent,
} from '../lib/lessons/lesson-progress-sync.js';
import { clearProgress } from '../reducers/lesson-mode.js';

const now = () => new Date().toISOString();

const LessonProgressSync = () => {
    const dispatch = useDispatch();
    const role = useSelector((state) => state.scratchGui.classroom.role);
    const sessionToken = useSelector((state) => state.scratchGui.classroom.sessionToken);
    const classroomId = useSelector((state) => state.scratchGui.classroom.classroomId);
    const seatNumber = useSelector((state) => state.scratchGui.classroom.seatNumber);
    const joinedAt = useSelector((state) => state.scratchGui.classroom.joinedAt);
    const studentLesson = useSelector((state) => state.scratchGui.classroom.studentLesson);
    const progress = useSelector((state) => state.scratchGui.lessonMode.progress);
    const challengeId = useSelector((state) => state.scratchGui.lessonMode.challengeId);
    const sendRequest = useSelector((state) => state.scratchGui.lessonMode.progressSendRequest);

    const lesson = role === 'student' && sessionToken ? studentLesson || null : null;
    const key = lesson ? consentKey(classroomId, seatNumber, { joinedAt, sessionToken }) : null;
    const records = useMemo(() => assignmentChallengeRecords(lesson, progress), [lesson, progress]);

    // 開いているチャレンジと、開いた日時（チャレンジが変わったときに決める）
    const openedRef = useRef({ challengeId: null, openedAt: null });
    if (openedRef.current.challengeId !== challengeId) {
        openedRef.current = { challengeId, openedAt: challengeId ? now() : null };
    }
    const current = currentChallengeOf(lesson, challengeId, openedRef.current.openedAt);

    // 送る関数は最新の値を見る（送信中に変わった分は、送信のあとにもう一度送る）
    const latestRef = useRef(null);
    latestRef.current = { lesson, key, sessionToken, classroomId, progress, current };

    // 最後に送れた中身（セッションごと）・送るのをやめたセッション・送信中か
    const ackedRef = useRef({});
    const stoppedRef = useRef(new Set());
    const inFlightRef = useRef(false);
    const againRef = useRef(false);
    // localStorage に書けない端末でも、開いているあいだは同じ答えを使う
    const consentCacheRef = useRef({});

    // 本人の確認（null なら出さない）
    const [confirmStep, setConfirmStep] = useState(null);

    const consentOf = useCallback((k) => loadConsent(k) || consentCacheRef.current[k] || null, []);
    const rememberConsent = useCallback((k, consent) => {
        consentCacheRef.current[k] = consent;
        saveConsent(k, consent);
    }, []);

    const send = useCallback(async () => {
        const latest = latestRef.current;
        if (!latest.lesson || !latest.key || !latest.sessionToken || !latest.classroomId) return;
        if (stoppedRef.current.has(latest.sessionToken)) return;
        const latestRecords = assignmentChallengeRecords(latest.lesson, latest.progress);
        let consent = consentOf(latest.key);
        // 同意していない記録（はじめて・先生があとから足したチャレンジの前の記録）があれば、送る前に聞く。
        // 答えが「消す」なら聞かずに、その記録を送らない（buildProgressPayload が外す）
        if (needsConfirmation(latest.lesson, consent, latestRecords)) {
            setConfirmStep((step) => step || CONFIRM_STEPS.ASK);
            return;
        }
        if (!consent) {
            consent = makeConsent(CONSENT_ANSWERS.NONE, [], now());
            rememberConsent(latest.key, consent);
        }
        const payload = buildProgressPayload(latest.lesson, latest.progress, consent, latest.current);
        const token = latest.sessionToken;
        if (isCoveredBy(payload, ackedRef.current[token] || null)) return;
        if (inFlightRef.current) {
            againRef.current = true;
            return;
        }
        inFlightRef.current = true;
        try {
            await classroomAPI.putLessonProgress(token, latest.classroomId, payload);
            ackedRef.current[token] = mergeAcked(ackedRef.current[token] || null, payload);
        } catch (error) {
            // 送れなかった分は端末の記録に残っているので、次に送るときにまとめて送る
            if (classifySendFailure(error) === SEND_FAILURES.STOP) stoppedRef.current.add(token);
        } finally {
            // 送信中は inFlightRef が true のままなので、ほかの送信と競り合わない（誤検知）
            // eslint-disable-next-line require-atomic-updates
            inFlightRef.current = false;
        }
        if (againRef.current) {
            againRef.current = false;
            send();
        }
    }, [consentOf, rememberConsent]);

    const recordsSignature = Object.keys(records).sort().join(',');
    const currentSignature = current ? `${current.challengeId}@${current.openedAt}` : '';
    const lessonSignature = lesson ? lesson.challengeIds.join(',') : '';
    useEffect(() => {
        if (key) send();
    }, [key, sessionToken, lessonSignature, recordsSignature, currentSignature, sendRequest, send]);

    // 課題から抜けたら、本人の確認も閉じる
    useEffect(() => {
        if (!key) setConfirmStep(null);
    }, [key]);

    // 一覧に出している記録（「わたしの記録です」で「前」にするのは、これだけ・FYI3）
    const shownItems = confirmStep && key ? confirmationItems(lesson, records, consentOf(key)) : [];
    const shownIdsRef = useRef([]);
    shownIdsRef.current = shownItems.map((item) => item.id);

    const handleMine = useCallback(() => {
        const latest = latestRef.current;
        if (latest.key) {
            const previous = consentOf(latest.key);
            rememberConsent(latest.key, makeConsent(CONSENT_ANSWERS.MINE, shownIdsRef.current, now(), previous));
        }
        setConfirmStep(null);
        send();
    }, [consentOf, rememberConsent, send]);

    const handleClear = useCallback(() => {
        const latest = latestRef.current;
        if (latest.key) {
            const previous = consentOf(latest.key);
            rememberConsent(latest.key, makeConsent(CONSENT_ANSWERS.CLEARED, [], now(), previous));
        }
        setConfirmStep(null);
        dispatch(clearProgress());
    }, [consentOf, dispatch, rememberConsent]);

    const handleNotMine = useCallback(() => setConfirmStep(CONFIRM_STEPS.CONFIRM_CLEAR), []);
    const handleBack = useCallback(() => setConfirmStep(CONFIRM_STEPS.ASK), []);
    // ×で閉じたときは答えない（次に送るときにもう一度聞く。それまで送らない）
    const handleClose = useCallback(() => setConfirmStep(null), []);

    if (!confirmStep || !key) return null;
    return (
        <LessonProgressConfirm
            items={shownItems}
            step={confirmStep}
            onBack={handleBack}
            onClear={handleClear}
            onClose={handleClose}
            onMine={handleMine}
            onNotMine={handleNotMine}
        />
    );
};

export default LessonProgressSync;
