// レッスンの使われ方の GA 計測（docs/lessons/README.md の「GA の計測」）。
// 目的は、人気のないコンテンツと滞在の長いヒントを見つけて見直すこと。
//
// - 送る判断は純粋関数 stepLessonAnalytics（前の状態・今の状態・時刻 → 送るイベント）。
//   レッスンモードの state の変わり目から、チャレンジを開いた・できた・ヒントの 1 ページを見おわった
//   （滞在時間）・レッスン表を開いた、を決める。containers/lesson-analytics.jsx が state を渡して送る。
// - ボタンで決まるもの（正解のプログラムを確認した・ほかのチャレンジへ・レッスンをおえる）は、
//   押したところから sendLessonEvent で送る。
// - 個人を特定するもの（席・ニックネーム・クラス・課題の ID・参加コード・入力した文字）は送らない。
//   送るのはコース・レッスン・チャレンジの id・ページの番号・秒・課題からか（真偽）だけ。
// - 先生（クラス管理にログイン中）のときは送らない（授業の準備で開くと数がゆがむため）。
// - 秒は、タブが裏にあった時間（document.hidden）を引いた「見えていた時間」で測る（activeNow）。
import analytics from '../analytics';

const LESSON_ANALYTICS_CATEGORY = 'lessons';

const LESSON_EVENTS = {
    LIBRARY_OPEN: 'library_open',
    CHALLENGE_OPEN: 'challenge_open',
    CHALLENGE_COMPLETE: 'challenge_complete',
    HINT_VIEW: 'hint_view',
    ANSWER_VIEW: 'answer_view',
    OTHER_CHALLENGE: 'other_challenge',
    LESSON_END: 'lesson_end',
};

const CLOSED_SNAPSHOT = {
    courseId: null,
    lessonId: null,
    challengeId: null,
    fromAssignment: false,
    hintSession: 0,
    hintVisible: false,
    hintIndex: 0,
    justCompletedId: null,
    libraryVisible: false,
    libraryFocus: false,
    teacherLoggedIn: false,
};

// lessons のイベントはいつも 6 つの項目を全部入れる。GTM の data layer は前の push の値を覚えているので、
// 使わない項目を undefined で消さないと、前のイベントの page / seconds などが次のイベントに残る
const EMPTY_PARAMS = {
    course_id: undefined, // eslint-disable-line no-undefined
    lesson_id: undefined, // eslint-disable-line no-undefined
    challenge_id: undefined, // eslint-disable-line no-undefined
    from_assignment: undefined, // eslint-disable-line no-undefined
    page: undefined, // eslint-disable-line no-undefined
    seconds: undefined, // eslint-disable-line no-undefined
};

/**
 * 計測に使う state の写し（比べやすいように平らにする）。
 * @param {object} state - Redux の state。
 * @returns {object} スナップショット。
 */
const lessonAnalyticsSnapshot = (state) => {
    const lessonMode = state.scratchGui.lessonMode;
    return {
        courseId: lessonMode.courseId,
        lessonId: lessonMode.lessonId,
        challengeId: lessonMode.challengeId,
        fromAssignment: Boolean(lessonMode.fromAssignment),
        hintSession: lessonMode.hintSession || 0,
        hintVisible: Boolean(lessonMode.hintVisible),
        hintIndex: lessonMode.hintIndex || 0,
        justCompletedId: lessonMode.justCompletedId,
        libraryVisible: Boolean(state.scratchGui.modals.lessonsLibrary),
        libraryFocus: Boolean(lessonMode.libraryFocusChallengeId),
        teacherLoggedIn: Boolean(state.scratchGui.classroom && state.scratchGui.classroom.teacherLoggedIn),
    };
};

/**
 * @returns {{snapshot: object, openedAt: ?number, page: ?object}} はじめの覚え（レッスンモードの外）。
 */
const createLessonAnalyticsMemo = () => ({ snapshot: CLOSED_SNAPSHOT, openedAt: null, page: null });

/**
 * チャレンジのイベントに付ける id（GA の項目名は snake_case）。
 * @param {?{course: object, lesson: object, challenge: object}} current - いまのチャレンジ。
 * @param {boolean} fromAssignment - クラスの課題から開いたか。
 * @returns {?object} 項目。チャレンジが無ければ null。
 */
const lessonEventIds = (current, fromAssignment) =>
    current
        ? {
              course_id: current.course.id,
              lesson_id: current.lesson.id,
              challenge_id: current.challenge.id,
              from_assignment: Boolean(fromAssignment),
          }
        : null;

const snapshotIds = (snapshot) => ({
    course_id: snapshot.courseId,
    lesson_id: snapshot.lessonId,
    challenge_id: snapshot.challengeId,
    from_assignment: Boolean(snapshot.fromAssignment),
});

/**
 * GA に送るチャレンジのイベント（analytics.event に渡す形）。label はチャレンジ id。
 * @param {string} action - LESSON_EVENTS の値。
 * @param {object} ids - lessonEventIds の結果。
 * @param {object} [params] - 足す項目（page・seconds）。
 * @returns {object} イベント。
 */
const buildLessonEvent = (action, ids, params = {}) => ({
    category: LESSON_ANALYTICS_CATEGORY,
    action,
    label: ids.challenge_id,
    ...EMPTY_PARAMS,
    ...ids,
    ...params,
});

const secondsBetween = (from, to) => Math.max(0, Math.round((to - from) / 1000));

/**
 * 状態の変わり目から送るイベントを決める（純粋関数）。
 * ヒントの滞在時間は、そのページを出してから、次・前のページ・閉じる・「できた！」・チャレンジを閉じる／
 * 別のチャレンジを開くまで。見おわったときに 1 回送る。
 * @param {object} memo - 前の覚え（createLessonAnalyticsMemo / 前回の結果の memo）。
 * @param {object} next - 今のスナップショット（lessonAnalyticsSnapshot）。
 * 先生（`teacherLoggedIn`）のときは覚えだけ進めて、何も送らない。
 * @param {number} now - 今の時刻（ms）。タブが裏にあった時間を引いた時計（activeNow）を渡す。
 * @returns {{memo: object, events: Array<object>}} 次の覚えと送るイベント。
 */
const stepLessonAnalytics = (memo, next, now) => {
    const prev = memo.snapshot;
    const events = [];
    let { openedAt, page } = memo;

    if (next.libraryVisible && !prev.libraryVisible) {
        events.push({
            category: LESSON_ANALYTICS_CATEGORY,
            action: LESSON_EVENTS.LIBRARY_OPEN,
            label: next.libraryFocus ? 'next' : 'menu',
            ...EMPTY_PARAMS,
        });
    }

    const opened =
        next.challengeId !== null && (next.challengeId !== prev.challengeId || next.hintSession !== prev.hintSession);
    const pageKey =
        next.challengeId !== null && next.hintVisible
            ? `${next.challengeId}|${next.hintSession}|${next.hintIndex}`
            : null;

    // 見ていたページが変わった・閉じた → そのページの滞在時間を送る（できた！より先に）
    if (page && (page.key !== pageKey || opened)) {
        events.push(
            buildLessonEvent(LESSON_EVENTS.HINT_VIEW, page.ids, {
                page: page.index + 1,
                seconds: secondsBetween(page.at, now),
            }),
        );
        page = null;
    }

    if (opened) {
        openedAt = now;
        events.push(buildLessonEvent(LESSON_EVENTS.CHALLENGE_OPEN, snapshotIds(next)));
    } else if (next.challengeId === null) {
        openedAt = null;
    }

    const completedNow = next.challengeId !== null && next.justCompletedId === next.challengeId;
    const completedBefore = !opened && prev.justCompletedId === next.challengeId;
    if (completedNow && !completedBefore) {
        events.push(
            buildLessonEvent(LESSON_EVENTS.CHALLENGE_COMPLETE, snapshotIds(next), {
                seconds: secondsBetween(openedAt === null ? now : openedAt, now),
            }),
        );
    }

    if (pageKey !== null && !page) {
        page = { key: pageKey, index: next.hintIndex, at: now, ids: snapshotIds(next) };
    }

    return { memo: { snapshot: next, openedAt, page }, events: next.teacherLoggedIn ? [] : events };
};

/**
 * ボタンで決まるイベントを送る。計測の失敗でレッスンを止めない。
 * @param {string} action - LESSON_EVENTS の値。
 * @param {?{course: object, lesson: object, challenge: object}} current - いまのチャレンジ（無ければ送らない）。
 * @param {object} [options] - オプション。
 * @param {boolean} [options.fromAssignment] - クラスの課題から開いたか。
 * @param {boolean} [options.teacherLoggedIn] - 先生がログイン中か（そのときは送らない）。
 * @param {Function} [send] - 送る関数（テスト用。既定は analytics.event）。
 */
const sendLessonEvent = (
    action,
    current,
    { fromAssignment = false, teacherLoggedIn = false } = {},
    send = analytics.event,
) => {
    const ids = lessonEventIds(current, fromAssignment);
    if (!ids || teacherLoggedIn) return;
    try {
        send(buildLessonEvent(action, ids));
    } catch (_e) {
        // 計測に失敗してもレッスンは止めない
    }
};

/**
 * タブが裏にあった時間を引いた時計（ms）。hiddenSince は裏になった時刻（いま見えていれば null）。
 * @param {number} now - 今の時刻（ms）。
 * @param {number} hiddenTotal - これまでに裏にあった時間の合計（ms。いまの裏の分はふくまない）。
 * @param {?number} hiddenSince - いま裏にあるなら、裏になった時刻（ms）。
 * @returns {number} 見えていた時間だけ進む時計（ms）。
 */
const activeTime = (now, hiddenTotal, hiddenSince) =>
    now - hiddenTotal - (hiddenSince === null ? 0 : Math.max(0, now - hiddenSince));

// 画面に GUI は 1 つだけなので、覚えと見えていた時間はモジュールに 1 つ持つ。コンテナに持つと、
// PC 表示とスマホ表示の切りかえ（<GUI> と <MobileGui> の入れかえ）でマウントし直したときに最初に戻り、
// challenge_open が二重に送られ、見ていたヒントのページの滞在時間が消える
let sharedMemo = createLessonAnalyticsMemo();
const visibility = { installed: false, hiddenTotal: 0, hiddenSince: null };

const getSharedLessonAnalyticsMemo = () => sharedMemo;

const setSharedLessonAnalyticsMemo = (memo) => {
    sharedMemo = memo;
};

/**
 * タブの表示・非表示を見張り始める（1 回だけ）。document が無い環境では何もしない。
 * @param {?object} [doc] - document（テスト用）。
 * @param {Function} [now] - 時計（テスト用）。
 */
const installVisibilityTracking = (doc = typeof document === 'undefined' ? null : document, now = Date.now) => {
    if (visibility.installed || !doc || typeof doc.addEventListener !== 'function') return;
    visibility.installed = true;
    if (doc.hidden) visibility.hiddenSince = now();
    doc.addEventListener('visibilitychange', () => {
        const t = now();
        if (doc.hidden) {
            if (visibility.hiddenSince === null) visibility.hiddenSince = t;
        } else if (visibility.hiddenSince !== null) {
            visibility.hiddenTotal += Math.max(0, t - visibility.hiddenSince);
            visibility.hiddenSince = null;
        }
    });
};

/**
 * @param {number} [now] - 今の時刻（ms）。
 * @returns {number} タブが裏にあった時間を引いた時計（ms）。
 */
const activeNow = (now = Date.now()) => activeTime(now, visibility.hiddenTotal, visibility.hiddenSince);

/** テスト用: 覚えと見えていた時間を最初に戻す（見張りは外さない）。 */
const resetSharedLessonAnalytics = () => {
    sharedMemo = createLessonAnalyticsMemo();
    visibility.hiddenTotal = 0;
    visibility.hiddenSince = null;
};

export {
    LESSON_ANALYTICS_CATEGORY,
    LESSON_EVENTS,
    activeNow,
    activeTime,
    buildLessonEvent,
    createLessonAnalyticsMemo,
    getSharedLessonAnalyticsMemo,
    installVisibilityTracking,
    resetSharedLessonAnalytics,
    setSharedLessonAnalyticsMemo,
    lessonAnalyticsSnapshot,
    lessonEventIds,
    sendLessonEvent,
    stepLessonAnalytics,
};
