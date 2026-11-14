// 生徒の参加〜提出の流れ（① 参加 → ② 番号 → ③ はじめる → ④ つくる → ⑤ 提出）の GA 計測（#1831）。
// 目的は、生徒がどの段でつまずいているか・どこを直すとよいかを数で見ること。
// イベントの表とファネルの組み方は docs/classroom/ui-ux.md の「GA の計測」。
//
// - 仕組みはレッスンの計測（lib/lessons/lesson-analytics.js）と同じ。lib/analytics.js で GTM の
//   dataLayer に push し、追加の項目は label に詰めずに dataLayer の変数にする。
// - classroom_student のイベントは、いつも同じ項目（CLASSROOM_STUDENT_PARAM_KEYS）を全部入れる。
//   使わない項目は undefined（前のイベントの値が次のイベントに残らないように）。
// - 送るのは段・種類・結果・秒・真偽だけ。クラス・課題・席番号・ニックネーム・参加コード・
//   セッション・メンバーの id・入力した文字は送らない。決めた項目のほかは buildClassroomStudentEvent が落とす。
// - 先生（クラス管理にログイン中）のときは送らない（授業の準備で開くと数がゆがむため）。
// - 秒は、タブが裏にあった時間を引いた時計（lesson-analytics.js の activeNow）で測る。
// - 計測の失敗は握りつぶし、生徒の動きを止めない。
import analytics from './analytics';
import { studentCurrentStep } from './classroom-student-steps.js';

const CLASSROOM_STUDENT_CATEGORY = 'classroom_student';

const CLASSROOM_STUDENT_EVENTS = {
    JOIN_CODE: 'join_code',
    SEAT_VIEW: 'seat_view',
    SEAT_IDLE_GUIDE: 'seat_idle_guide',
    SEAT_SELECT: 'seat_select',
    KICK_REQUEST: 'kick_request',
    START_VIEW: 'start_view',
    START_CHOOSE: 'start_choose',
    WELCOME_VIEW: 'welcome_view',
    WELCOME_ACTION: 'welcome_action',
    SUBMIT_OPEN: 'submit_open',
    SUBMIT_RESULT: 'submit_result',
    LEAVE_CLASS: 'leave_class',
    SESSION_END: 'session_end',
    MODAL_CLOSE: 'modal_close',
    SUBMIT_REMINDER_SHOWN: 'submit_reminder_shown',
    SUBMIT_REMINDER_DISMISSED: 'submit_reminder_dismissed',
    SUBMIT_REMINDER_SUBMITTED: 'submit_reminder_submitted',
};

// classroom_student のイベントが送る項目（GA の項目名は snake_case）。ここに無い項目は送らない。
// おかえりなさいで押したものは、GA の action と名前がぶつからないように button にする。
const CLASSROOM_STUDENT_PARAM_KEYS = [
    'result',
    'seconds',
    'minutes',
    'previous_seat',
    'previous_taken',
    'is_previous',
    'after_guide',
    'main',
    'others_count',
    'kind',
    'via',
    'others_opened',
    'button',
    'from',
    'state',
    'reason',
    'step',
    'first',
];

// 項目ごとに送ってよい値。文字列の項目は決まった値だけを通し、知らない値は 'other' にする
// （あとで誰かが err.message などを渡しても、そのまま GA に出ないように）。数・真偽の項目は型が違えば送らない。
const NUMBER = 'number';
const BOOLEAN = 'boolean';
const CLASSROOM_STUDENT_PARAM_VALUES = {
    result: [
        'ok',
        'not_found',
        'closed',
        'error',
        'taken',
        'sent',
        'canceled',
        'approved',
        'rejected',
        'confirm',
        'cancel',
        'done',
        'expired',
        'convert_error',
    ],
    seconds: NUMBER,
    minutes: NUMBER,
    previous_seat: BOOLEAN,
    previous_taken: BOOLEAN,
    is_previous: BOOLEAN,
    after_guide: BOOLEAN,
    main: ['current', 'previous', 'starter', 'keep', 'lesson', 'continue', 'this_submission'],
    others_count: NUMBER,
    kind: ['current', 'previous', 'starter', 'keep', 'lesson'],
    via: ['main', 'others', 'grid', 'kick_approved'],
    others_opened: BOOLEAN,
    button: [
        'continue',
        'continue_as_is',
        'this_submission',
        'starter',
        'lesson',
        'assignment',
        'peer',
        'wrong_seat',
        'reload',
        'leave',
    ],
    from: ['menu_bar', 'drawer', 'lessons_library', 'lesson_clear'],
    state: ['first', 'resubmit', 'returned'],
    reason: ['expired', 'kicked', 'close', 'outside', 'submit'],
    step: ['join', 'seat', 'start', 'make', 'submit', 'complete'],
    first: BOOLEAN,
};

// 知らない文字列の値の置きかえ
const OTHER_VALUE = 'other';

/**
 * 1 つの項目の値を、送ってよい形にする。
 * @param {string} key - 項目名。
 * @param {*} value - 値。
 * @returns {string|number|boolean|undefined} 送る値（送らないなら undefined）。
 */
const allowedValue = (key, value) => {
    const allowed = CLASSROOM_STUDENT_PARAM_VALUES[key];
    if (allowed === NUMBER) return typeof value === 'number' && Number.isFinite(value) ? value : undefined; // eslint-disable-line no-undefined
    if (allowed === BOOLEAN) return typeof value === 'boolean' ? value : undefined; // eslint-disable-line no-undefined
    if (typeof value !== 'string') return undefined; // eslint-disable-line no-undefined
    return allowed.includes(value) ? value : OTHER_VALUE;
};

/**
 * GA に送るイベント（analytics.event に渡す形）。決めた項目だけを入れ、使わない項目は undefined にする。
 * 値は項目ごとに決めた値だけを通す（CLASSROOM_STUDENT_PARAM_VALUES。知らない文字列は 'other'）。
 * @param {string} action - CLASSROOM_STUDENT_EVENTS の値。
 * @param {object} [params] - 項目（CLASSROOM_STUDENT_PARAM_KEYS のもの。ほかは落とす）。
 * @returns {object} イベント。
 */
const buildClassroomStudentEvent = (action, params = {}) => {
    const event = {
        category: CLASSROOM_STUDENT_CATEGORY,
        action,
        label: undefined, // eslint-disable-line no-undefined
    };
    CLASSROOM_STUDENT_PARAM_KEYS.forEach((key) => {
        event[key] = allowedValue(key, params[key]);
    });
    return event;
};

/**
 * イベントを送る。先生がログイン中なら送らない。計測の失敗で生徒の動きを止めない。
 * @param {string} action - CLASSROOM_STUDENT_EVENTS の値。
 * @param {object} [params] - 項目。
 * @param {object} [options] - オプション。
 * @param {boolean} [options.teacherLoggedIn] - 先生がクラス管理にログイン中か（そのときは送らない）。
 * @param {Function} [options.send] - 送る関数（テスト用。既定は analytics.event）。
 */
const sendClassroomStudentEvent = (action, params = {}, { teacherLoggedIn = false, send = analytics.event } = {}) => {
    if (teacherLoggedIn) return;
    try {
        send(buildClassroomStudentEvent(action, params));
    } catch (_e) {
        // 計測に失敗しても生徒の動きは止めない
    }
};

/**
 * はじまりからの秒（四捨五入）。はじまりが無ければ undefined（その項目は送らない）。
 * @param {?number} from - はじまりの時刻（ms。activeNow の時計）。
 * @param {number} now - 今の時刻（ms。activeNow の時計）。
 * @returns {number|undefined} 秒。
 */
const secondsSince = (from, now) => {
    if (typeof from !== 'number') return undefined; // eslint-disable-line no-undefined
    return Math.max(0, Math.round((now - from) / 1000));
};

/**
 * 参加コードを送った結果。
 * @param {?object} err - lookupClassroom が投げたもの（うまくいったら null）。
 * @returns {string} ok / not_found / closed / error
 */
const joinCodeResult = (err) => {
    if (!err) return 'ok';
    const msg = err.message || '';
    if (err.isNetworkError) return 'error';
    if (err.status === 404 || msg.includes('Invalid join code')) return 'not_found';
    if (err.status === 410 || msg.includes('no longer active')) return 'closed';
    return 'error';
};

/**
 * 番号選びを出したときの項目。前回の番号そのものは送らない（あるか・使用中かだけ）。
 * @param {?number} previousSeat - この PC が前回この課題に参加した番号。
 * @param {Array<number>} takenSeats - 使用中の番号。
 * @returns {{previous_seat: boolean, previous_taken: boolean}} 項目。
 */
const seatViewParams = (previousSeat, takenSeats) => {
    const hasPrevious = typeof previousSeat === 'number';
    return {
        previous_seat: hasPrevious,
        previous_taken: hasPrevious && (takenSeats || []).includes(previousSeat),
    };
};

/**
 * 提出の確認を開いたときの、この課題の提出状況。
 * @param {?string} submissionStatus - submitted / returned / それ以外。
 * @returns {string} first / resubmit / returned
 */
const submitOpenState = (submissionStatus) => {
    if (submissionStatus === 'returned') return 'returned';
    if (submissionStatus === 'submitted') return 'resubmit';
    return 'first';
};

/**
 * おかえりなさいの主ボタン。
 * @param {object} input - 主ボタンの決め方（student-status-view.jsx と同じ）。
 * @param {boolean} [input.mainIsLesson] - 「レッスンを続ける」
 * @param {boolean} [input.mainIsCurrent] - 「この課題で出した作品から続ける」
 * @param {boolean} [input.mainIsStarter] - 「スタータープロジェクトから始める」
 * @returns {string} lesson / this_submission / starter / continue
 */
const welcomeMain = ({ mainIsLesson = false, mainIsCurrent = false, mainIsStarter = false } = {}) => {
    if (mainIsLesson) return 'lesson';
    if (mainIsCurrent) return 'this_submission';
    if (mainIsStarter) return 'starter';
    return 'continue';
};

/**
 * モーダルを ×・外側・Esc で閉じたときの段（帯の段。どこで離れたか）。
 * @param {object} input - studentCurrentStep と同じ。
 * @returns {?string} 段の名前・'complete'。生徒の画面でなければ null。
 */
const modalCloseStep = (input) => studentCurrentStep(input);

/**
 * 「提出しよう」の吹き出しの出来事（classroom-submit-reminder-events.js）を GA のイベントにする。
 * 「出した回数」には resumed でないものだけを数える（docs/classroom/ui-ux.md）ので、出し直しは送らない。
 * @param {?object} event - 吹き出しの出来事。
 * @returns {?{action: string, params: object}} 送るもの。送らないなら null。
 */
const submitReminderGaEvent = (event) => {
    if (!event) return null;
    if (event.type === 'shown') {
        if (event.resumed) return null;
        return {
            action: CLASSROOM_STUDENT_EVENTS.SUBMIT_REMINDER_SHOWN,
            params: { first: !!event.first, minutes: event.minutesSinceStart },
        };
    }
    if (event.type === 'dismissed') {
        return { action: CLASSROOM_STUDENT_EVENTS.SUBMIT_REMINDER_DISMISSED, params: { reason: event.reason } };
    }
    if (event.type === 'submitted_after_shown') {
        return {
            action: CLASSROOM_STUDENT_EVENTS.SUBMIT_REMINDER_SUBMITTED,
            params: { minutes: event.minutesSinceShown },
        };
    }
    return null;
};

// --- 画面を出したイベントの重ね送りを防ぐ覚え ---
// PC 表示とスマホ表示の切りかえ（<GUI> と <MobileGui> の入れかえ）や、課題パネルのページの行き来では、
// クラスの画面のコンポーネントがマウントし直される。そのたびに seat_view / start_view / welcome_view を
// 送ると数がふくらむので、「最後に出した画面」とその時刻をモジュールに 1 つ持つ（レッスンの計測と同じ考え）。
// 同じ画面がもう一度出ても送らず、秒は最初に出した時刻から測る。クラスの画面を閉じたら覚えを消す。
let lastView = null;

/**
 * 画面を出したことを覚える。直前に覚えた画面と同じなら、送らずに最初の時刻を返す。
 * @param {string} view - 画面の名前（seat / start / welcome）。
 * @param {number} now - 今の時刻（ms。activeNow の時計）。
 * @returns {{send: boolean, at: number}} 送るか・その画面を出した時刻。
 */
const noteClassroomStudentView = (view, now) => {
    if (lastView && lastView.view === view) return { send: false, at: lastView.at };
    lastView = { view, at: now };
    return { send: true, at: now };
};

/** クラスの画面を閉じた: 画面を出した覚えを消す（次に開いたら、また送る）。 */
const resetClassroomStudentViews = () => {
    lastView = null;
};

export {
    CLASSROOM_STUDENT_CATEGORY,
    CLASSROOM_STUDENT_EVENTS,
    CLASSROOM_STUDENT_PARAM_KEYS,
    CLASSROOM_STUDENT_PARAM_VALUES,
    buildClassroomStudentEvent,
    joinCodeResult,
    modalCloseStep,
    noteClassroomStudentView,
    resetClassroomStudentViews,
    seatViewParams,
    secondsSince,
    sendClassroomStudentEvent,
    submitOpenState,
    submitReminderGaEvent,
    welcomeMain,
};
