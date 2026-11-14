/**
 * 「提出しよう」の吹き出し (#1835) の判断。
 *
 * クラスに参加してから時間がたっても作品を出していない生徒に、メニューバーの「提出する」の下へ
 * 吹き出しを出す。決まりは docs/classroom/ui-ux.md の「提出しようの吹き出し」が正。
 *
 * ここは時刻を引数で受ける純粋関数だけを置く（sessionStorage の読み書き・タイマーは
 * containers/classroom-submit-reminder.jsx が持つ）。時計（clock）は sessionStorage に入れる
 * 1 つのオブジェクトで、次の値を持つ（どれも ms epoch）:
 * - tabStartedAt: このタブの始まり（リロードで続く・新しいタブは新しい始まり）
 * - lastVisibleAt: タブが見えていた最後の時刻（長く見えなかったかを測る）
 * - restartedAt: 60 分以上見えなかったあと、数え直した時刻
 * - assignmentKey: 下の 2 つがどの課題のものか
 * - dismissedAt: 吹き出しを最後に消した時刻（× ・外を押した・「提出する」を押した）
 * - firstShownAt: この課題で吹き出しをはじめて出した時刻（計測用）
 */

/** 参加して（またはタブを開いて）から初めて出すまで。 */
const FIRST_REMINDER_MS = 25 * 60 * 1000;
/** 消したあと、もう一度出すまで。 */
const REPEAT_REMINDER_MS = 10 * 60 * 1000;
/** これ以上タブが見えなかったら（PC のスリープなど）、次に見えたときから数え直す。 */
const HIDDEN_RESTART_MS = 60 * 60 * 1000;

const TIME_KEYS = ['tabStartedAt', 'lastVisibleAt', 'restartedAt', 'dismissedAt', 'firstShownAt'];
const ASSIGNMENT_KEYS = ['dismissedAt', 'firstShownAt'];

const isTime = (value) => typeof value === 'number' && Number.isFinite(value);

/**
 * いまの状態で吹き出しを出してよいか（時間は見ない）。
 * @param {object} input - 生徒の状態
 * @param {?string} input.menuKind - メニューバーのボタンの種類（menuSubmitKind の結果）
 * @param {boolean} [input.classroomModalVisible] - クラスの画面（提出確認もこの中）が開いているか
 * @param {boolean} [input.teacherModalVisible] - 先生のクラス管理が開いているか
 * @param {boolean} [input.submitting] - 提出を送信中か
 * @returns {boolean} 出してよければ true
 */
const isSubmitReminderEligible = ({
    menuKind,
    classroomModalVisible = false,
    teacherModalVisible = false,
    submitting = false,
}) =>
    // 「提出する」（未提出）が見えているときだけ。提出済み・返却済みは「出した」、
    // ボタンが無い（参加していない・作品を出さないレッスン・条件の前）なら指す先が無い。
    menuKind === 'submit' && !classroomModalVisible && !teacherModalVisible && !submitting;

/**
 * sessionStorage の文字列から時計を読む。壊れた値は捨てる（吹き出しのために画面を壊さない）。
 * @param {?string} raw - sessionStorage の値
 * @returns {object} 時計
 */
const parseReminderClock = (raw) => {
    if (typeof raw !== 'string') return {};
    let data;
    try {
        data = JSON.parse(raw);
    } catch (_e) {
        return {};
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const clock = {};
    TIME_KEYS.forEach((key) => {
        if (isTime(data[key])) clock[key] = data[key];
    });
    if (typeof data.assignmentKey === 'string') clock.assignmentKey = data.assignmentKey;
    return clock;
};

/**
 * タブが見えていることを記録する（見えている間の定期の確かめ・見えるようになったとき・
 * 隠れる直前に呼ぶ）。新しいタブなら始まりを決め、60 分以上見えていなかったら数え直す。
 * 60 分より短く隠れていた間は、そのまま数える。
 * @param {object} clock - 時計
 * @param {number} now - いまの時刻（ms）
 * @returns {object} 新しい時計
 */
const observeTabVisible = (clock, now) => {
    const next = { ...clock, lastVisibleAt: now };
    if (!isTime(clock.tabStartedAt)) next.tabStartedAt = now;
    if (isTime(clock.lastVisibleAt) && now - clock.lastVisibleAt >= HIDDEN_RESTART_MS) {
        next.restartedAt = now;
    }
    return next;
};

/**
 * 時計を課題にあわせる。課題がかわったら、前の課題で消した・出した記録を忘れる
 * （タブの始まりは残す。数え始めは新しい課題の参加の時刻になる）。
 * @param {object} clock - 時計
 * @param {?string} assignmentKey - いまの課題（classroomId）
 * @returns {object} 時計（かわらなければ同じオブジェクト）
 */
const clockForAssignment = (clock, assignmentKey) => {
    if (clock.assignmentKey === assignmentKey) return clock;
    const next = { ...clock };
    ASSIGNMENT_KEYS.forEach((key) => delete next[key]);
    if (assignmentKey) next.assignmentKey = assignmentKey;
    else delete next.assignmentKey;
    return next;
};

/**
 * 数え始め。「このタブの始まり」「この課題に参加した時刻」「数え直した時刻」のいちばんあと。
 * @param {object} input - 入力
 * @param {object} input.clock - 時計
 * @param {?string} input.joinedAt - この課題に参加した時刻（ISO 文字列）
 * @returns {?number} 数え始め（ms）。分からなければ null
 */
const submitReminderCountFrom = ({ clock, joinedAt }) => {
    const joined = typeof joinedAt === 'string' ? Date.parse(joinedAt) : NaN;
    const times = [clock.tabStartedAt, clock.restartedAt, joined].filter(isTime);
    return times.length ? Math.max(...times) : null;
};

/**
 * 次に吹き出しを出す時刻。まだ消していなければ数え始めから 25 分、消したら消したときから 10 分。
 * 数え始めより前に消した記録（数え直す前のもの）は使わない。
 * @param {object} input - 入力
 * @param {?number} input.countFrom - 数え始め（ms）
 * @param {?number} input.dismissedAt - 最後に消した時刻（ms）
 * @returns {?number} 出す時刻（ms）。数え始めが無ければ null
 */
const submitReminderDueAt = ({ countFrom, dismissedAt }) => {
    if (!isTime(countFrom)) return null;
    if (isTime(dismissedAt) && dismissedAt >= countFrom) return dismissedAt + REPEAT_REMINDER_MS;
    return countFrom + FIRST_REMINDER_MS;
};

/**
 * いま吹き出しを出すか。
 * @param {object} input - 入力
 * @param {number} input.now - いまの時刻（ms）
 * @param {boolean} input.eligible - isSubmitReminderEligible の結果
 * @param {object} input.clock - いまの課題にあわせた時計
 * @param {?string} input.joinedAt - この課題に参加した時刻（ISO 文字列）
 * @returns {boolean} 出すなら true
 */
const isSubmitReminderDue = ({ now, eligible, clock, joinedAt }) => {
    if (!eligible) return false;
    const dueAt = submitReminderDueAt({
        countFrom: submitReminderCountFrom({ clock, joinedAt }),
        dismissedAt: clock.dismissedAt,
    });
    return isTime(dueAt) && now >= dueAt;
};

/**
 * 吹き出しを出したことを記録する（はじめて出した時刻だけを覚える）。
 * @param {object} clock - 時計
 * @param {number} now - いまの時刻（ms）
 * @returns {object} 新しい時計
 */
const markSubmitReminderShown = (clock, now) =>
    isTime(clock.firstShownAt) ? clock : { ...clock, firstShownAt: now };

/**
 * 吹き出しを消したことを記録する（ここから 10 分後にもう一度出す）。
 * @param {object} clock - 時計
 * @param {number} now - いまの時刻（ms）
 * @returns {object} 新しい時計
 */
const markSubmitReminderDismissed = (clock, now) => ({ ...clock, dismissedAt: now });

/** 吹き出しと周りのすき間（px）。 */
const BALLOON_GAP = 8;

const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * メニューバーの吹き出しを置く場所を決める。「提出する」の下で、ほかの操作（ボタン・タブ・リンク・
 * 入力欄）に重ならないいちばん上に置く（コードの場所やステージの絵の上には重なってよい）。
 * 横は「提出する」の右端にそろえ、画面からはみ出さないようにずらす。
 * @param {object} input - 入力（どれも画面の座標・px）
 * @param {{left: number, right: number, bottom: number}} input.anchor - 「提出する」のボタン
 * @param {number} input.start - いちばん上に置ける位置（メニューバーの下）
 * @param {{width: number, height: number}} input.size - 吹き出しの大きさ
 * @param {Array<{left: number, right: number, top: number, bottom: number}>} input.obstacles - 重ねない操作
 * @param {{width: number, height: number}} input.viewport - 画面の大きさ
 * @returns {{left: number, top: number, arrowLeft: number}} 置く場所と、しっぽの位置（吹き出しの左端から）
 */
const placeReminderBalloon = ({ anchor, start, size, obstacles, viewport }) => {
    const maxLeft = Math.max(BALLOON_GAP, viewport.width - size.width - BALLOON_GAP);
    const left = Math.min(Math.max(BALLOON_GAP, anchor.right - size.width), maxLeft);
    const center = (anchor.left + anchor.right) / 2 - left;
    const arrowLeft = Math.min(Math.max(16, center), size.width - 16);
    let top = start + BALLOON_GAP;
    // 重なる操作があれば、その下へずらしていく（下に余りが無ければいちばん上に置く）。
    for (let i = 0; i <= obstacles.length; i++) {
        const box = { left, right: left + size.width, top, bottom: top + size.height };
        const hits = obstacles.filter((o) => intersects(box, o));
        if (hits.length === 0) return { left, top, arrowLeft };
        top = Math.max(...hits.map((o) => o.bottom)) + BALLOON_GAP;
        if (top + size.height > viewport.height - BALLOON_GAP) break;
    }
    return { left, top: start + BALLOON_GAP, arrowLeft };
};

export {
    BALLOON_GAP,
    placeReminderBalloon,
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
    submitReminderCountFrom,
    submitReminderDueAt,
};
