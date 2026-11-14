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
 * - assignmentKey: 下の 2 つがどの課題のものか（参加していない間も残す）
 * - dismissedAt: 吹き出しを最後に消した時刻（× ・外を押した・「提出する」を押した）
 * - shownDueAt: いま出している回の「出す時刻」。モーダルを閉じた・リロードしたあとに同じ回を
 *   出し直すときは、新しく出したとは数えない（計測用）
 * - firstShown: 課題ごとの、はじめて吹き出しを出した時刻（{課題: 時刻}。セッションが切れて同じ課題に
 *   入り直しても「はじめて」と数え直さない。計測用）
 */

/** 参加して（またはタブを開いて）から初めて出すまで。 */
const FIRST_REMINDER_MS = 25 * 60 * 1000;
/** 消したあと、もう一度出すまで。 */
const REPEAT_REMINDER_MS = 10 * 60 * 1000;
/** これ以上タブが見えなかったら（PC のスリープなど）、次に見えたときから数え直す。 */
const HIDDEN_RESTART_MS = 60 * 60 * 1000;

const TIME_KEYS = ['tabStartedAt', 'lastVisibleAt', 'restartedAt', 'dismissedAt', 'shownDueAt'];
const ASSIGNMENT_KEYS = ['dismissedAt', 'shownDueAt'];
/** firstShown に覚える課題の数の上限（sessionStorage を大きくしない）。 */
const FIRST_SHOWN_LIMIT = 20;

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
    if (data.firstShown && typeof data.firstShown === 'object' && !Array.isArray(data.firstShown)) {
        const firstShown = {};
        Object.keys(data.firstShown).forEach((key) => {
            if (isTime(data.firstShown[key])) firstShown[key] = data.firstShown[key];
        });
        if (Object.keys(firstShown).length) clock.firstShown = firstShown;
    }
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
 * 時計を課題にあわせる。別の課題に入ったら、前の課題で消した時刻・出している回を忘れる
 * （タブの始まりと、課題ごとのはじめて出した時刻は残す。数え始めは新しい課題の参加の時刻になる）。
 * 参加していない間（null）は何も忘れない（セッションが切れて同じ課題に入り直したときのため）。
 * @param {object} clock - 時計
 * @param {?string} assignmentKey - いまの課題（classroomId）。参加していなければ null
 * @returns {object} 時計（かわらなければ同じオブジェクト）
 */
const clockForAssignment = (clock, assignmentKey) => {
    if (!assignmentKey || clock.assignmentKey === assignmentKey) return clock;
    const next = { ...clock, assignmentKey };
    ASSIGNMENT_KEYS.forEach((key) => delete next[key]);
    return next;
};

/**
 * この課題ではじめて吹き出しを出した時刻。
 * @param {object} clock - 時計
 * @returns {?number} 時刻（ms）。まだ出していなければ null
 */
const firstShownAtOf = (clock) => {
    const time = clock.firstShown && clock.assignmentKey ? clock.firstShown[clock.assignmentKey] : null;
    return isTime(time) ? time : null;
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
const isSubmitReminderDue = ({ now, eligible, clock, joinedAt }) =>
    submitReminderShowing({ now, eligible, clock, joinedAt }).due;

/**
 * いまの「出す回」。モーダルを閉じたあと・リロードしたあとに、同じ回をもう一度出すだけなら
 * resumed（新しく出したとは数えない）。
 * @param {object} input - isSubmitReminderDue と同じ
 * @param {number} input.now - いまの時刻（ms）
 * @param {boolean} input.eligible - isSubmitReminderEligible の結果
 * @param {object} input.clock - いまの課題にあわせた時計
 * @param {?string} input.joinedAt - この課題に参加した時刻（ISO 文字列）
 * @returns {{due: boolean, dueAt: ?number, resumed: boolean}} 出すか・その回の出す時刻・出し直しか
 */
const submitReminderShowing = ({ now, eligible, clock, joinedAt }) => {
    const dueAt = submitReminderDueAt({
        countFrom: submitReminderCountFrom({ clock, joinedAt }),
        dismissedAt: clock.dismissedAt,
    });
    const due = !!eligible && isTime(dueAt) && now >= dueAt;
    return { due, dueAt: isTime(dueAt) ? dueAt : null, resumed: due && clock.shownDueAt === dueAt };
};

/**
 * 吹き出しを出したことを記録する。いまの回の出す時刻と、この課題ではじめて出した時刻（最初の 1 回だけ）を覚える。
 * @param {object} clock - 時計
 * @param {number} now - いまの時刻（ms）
 * @param {?number} [dueAt] - いまの回の出す時刻（submitReminderShowing の dueAt）
 * @returns {object} 新しい時計
 */
const markSubmitReminderShown = (clock, now, dueAt = null) => {
    const next = { ...clock };
    if (isTime(dueAt)) next.shownDueAt = dueAt;
    const key = clock.assignmentKey;
    if (key && firstShownAtOf(clock) === null) {
        const keys = Object.keys(clock.firstShown || {}).filter((k) => k !== key);
        const firstShown = {};
        keys.slice(-(FIRST_SHOWN_LIMIT - 1)).forEach((k) => {
            firstShown[k] = clock.firstShown[k];
        });
        firstShown[key] = now;
        next.firstShown = firstShown;
    }
    return next;
};

/**
 * 吹き出しを消したことを記録する（ここから 10 分後にもう一度出す）。
 * @param {object} clock - 時計
 * @param {number} now - いまの時刻（ms）
 * @returns {object} 新しい時計
 */
const markSubmitReminderDismissed = (clock, now) => ({ ...clock, dismissedAt: now });

/** 吹き出しと周りのすき間（px）。 */
const BALLOON_GAP = 8;
/** メニューバーのすぐ下から、下へずらしてよい量（px）。これより離れると、しっぽがほかの物を指して見える。 */
const MAX_BALLOON_SHIFT = 56;

const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * メニューバーの吹き出しを置く場所を決める。「提出する」の下で、ほかの操作（ボタン・タブ・リンク・
 * 入力欄）に重ならないいちばん上に置く（コードの場所やステージの絵の上には重なってよい）。
 * 下へずらすのは MAX_BALLOON_SHIFT まで。その中に置けなければ null（吹き出しの代わりに小さな点を出す）。
 * 横は「提出する」の右端にそろえ、画面からはみ出さないようにずらす。
 * @param {object} input - 入力（どれも画面の座標・px）
 * @param {{left: number, right: number, bottom: number}} input.anchor - 「提出する」のボタン
 * @param {number} input.start - いちばん上に置ける位置（メニューバーの下）
 * @param {{width: number, height: number}} input.size - 吹き出しの大きさ
 * @param {Array<{left: number, right: number, top: number, bottom: number}>} input.obstacles - 重ねない操作
 * @param {{width: number, height: number}} input.viewport - 画面の大きさ
 * @returns {?{left: number, top: number, arrowLeft: number}} 置く場所と、しっぽの位置（吹き出しの左端から）。
 *   置けなければ null
 */
const placeReminderBalloon = ({ anchor, start, size, obstacles, viewport }) => {
    const { left, right } = reminderBalloonColumn({ anchor, size, viewport });
    const center = (anchor.left + anchor.right) / 2 - left;
    const arrowLeft = Math.min(Math.max(16, center), size.width - 16);
    const first = start + BALLOON_GAP;
    const last = Math.min(first + MAX_BALLOON_SHIFT, viewport.height - BALLOON_GAP - size.height);
    // 試す高さ: いちばん上・操作のすぐ下（上限の中）・上限そのもの
    const tops = [first, ...obstacles.map((o) => o.bottom + BALLOON_GAP), last]
        .filter((top) => top >= first && top <= last)
        .sort((a, b) => a - b);
    const top = tops.find((t) => {
        const box = { left, right, top: t, bottom: t + size.height };
        return !obstacles.some((o) => intersects(box, o));
    });
    return typeof top === 'number' ? { left, top, arrowLeft } : null;
};

/**
 * 吹き出しを置く列（横の範囲）。重なりを測る相手をこの列の操作だけに絞るのにも使う。
 * @param {object} input - 入力
 * @param {{left: number, right: number}} input.anchor - 「提出する」のボタン
 * @param {{width: number}} input.size - 吹き出しの大きさ
 * @param {{width: number}} input.viewport - 画面の大きさ
 * @returns {{left: number, right: number}} 列の左右
 */
const reminderBalloonColumn = ({ anchor, size, viewport }) => {
    const maxLeft = Math.max(BALLOON_GAP, viewport.width - size.width - BALLOON_GAP);
    const left = Math.min(Math.max(BALLOON_GAP, anchor.right - size.width), maxLeft);
    return { left, right: left + size.width };
};

export {
    BALLOON_GAP,
    MAX_BALLOON_SHIFT,
    placeReminderBalloon,
    reminderBalloonColumn,
    firstShownAtOf,
    submitReminderShowing,
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
