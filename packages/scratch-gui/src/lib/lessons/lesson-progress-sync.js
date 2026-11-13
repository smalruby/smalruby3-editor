// クラスの課題へ進み具合を送る（#1600）ときの決まりを持つ純粋関数と、本人の確認の答えの保存。
// 決まりは docs/lessons/design.md の「本人の確認」「進み具合の送り方」。
//
// 送り方（推奨で決めた）:
//   - 送るたびに、端末の記録のうち課題のチャレンジを全部まとめて送る（PUT は席 × 課題の 1 件）。
//     サーバーはマージし、保存済みの「できた」は変えず、変わらない送信は書かない。だから、送れなかった分を
//     別に取っておかなくても、次に送るときに自然に入る（オフライン・API の失敗・席に入り直して行が
//     作り直されたときも同じ）。
//   - 最後に送れた中身で足りているときは送らない（席ごとの 1 分 20 回の上限を無駄に使わない）。
//   - 「前」（before）は、その課題ではじめて送るときに端末にあった記録。本人の確認の答えと一緒に
//     端末に覚える（はじめての送信が失敗しても、次の送信で同じ「前」を送れる）。
import { assignmentChallengeRecords } from './assignment-progress';
import { COURSES, findChallenge } from './courses';

export const LESSON_PROGRESS_CONSENT_STORAGE_KEY = 'smalruby:lessonAssignmentConsent';
// 覚えておく課題の数の上限（古いものから捨てる。localStorage を際限なく使わない）
export const MAX_CONSENTS = 50;

/** 本人の確認の答え。 */
export const CONSENT_ANSWERS = Object.freeze({
    // 「わたしの記録です」
    MINE: 'mine',
    // 「ちがう」→「消す」（端末のレッスンの記録を空にした）
    CLEARED: 'cleared',
    // はじめて送るとき、端末に課題のチャレンジの記録が無かった（聞いていない）
    NONE: 'none',
});

const ANSWER_VALUES = Object.values(CONSENT_ANSWERS);

/**
 * 本人の確認の答えを覚える単位。課題（= classroomId）× 席。共用のパソコンで、同じ課題に別の席で
 * 参加した人（前に使った人とは別の人）には、もう一度聞く（推奨で決めた）。
 * @param {?string} classroomId - 課題の id。
 * @param {?(number|string)} seatNumber - 席番号。
 * @returns {?string} キー。どちらかが無ければ null。
 */
export const consentKey = (classroomId, seatNumber) =>
    classroomId && seatNumber !== null && typeof seatNumber !== 'undefined' && seatNumber !== ''
        ? `${classroomId}#${seatNumber}`
        : null;

const defaultStorage = () => {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (e) {
        return null;
    }
};

const isConsent = (value) =>
    value !== null &&
    typeof value === 'object' &&
    ANSWER_VALUES.includes(value.answer) &&
    Array.isArray(value.beforeIds) &&
    typeof value.decidedAt === 'string';

/**
 * 覚えている答えを全部読む。読めない・壊れているときは空（落とさない）。
 * @param {?Storage} [storage] - 読む先。
 * @returns {object} `{<consentKey>: {answer, beforeIds, decidedAt}}`。
 */
export const loadConsents = (storage = defaultStorage()) => {
    if (!storage) return {};
    try {
        const parsed = JSON.parse(storage.getItem(LESSON_PROGRESS_CONSENT_STORAGE_KEY));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const consents = {};
        Object.entries(parsed).forEach(([key, value]) => {
            if (isConsent(value)) {
                consents[key] = {
                    answer: value.answer,
                    beforeIds: value.beforeIds.filter((id) => typeof id === 'string'),
                    decidedAt: value.decidedAt,
                };
            }
        });
        return consents;
    } catch (e) {
        return {};
    }
};

/**
 * @param {?string} key - consentKey の結果。
 * @param {?Storage} [storage] - 読む先。
 * @returns {?object} その課題 × 席の答え。まだ無ければ null。
 */
export const loadConsent = (key, storage = defaultStorage()) => (key ? loadConsents(storage)[key] || null : null);

/**
 * 答えを覚える。古いものから捨てて MAX_CONSENTS 件までにする。書けなくても落とさない。
 * @param {string} key - consentKey の結果。
 * @param {object} consent - makeConsent の結果。
 * @param {?Storage} [storage] - 書く先。
 * @returns {boolean} 書けたら true。
 */
export const saveConsent = (key, consent, storage = defaultStorage()) => {
    if (!storage || !key || !isConsent(consent)) return false;
    const consents = { ...loadConsents(storage), [key]: consent };
    const keys = Object.keys(consents).sort((a, b) => consents[a].decidedAt.localeCompare(consents[b].decidedAt));
    keys.slice(0, Math.max(0, keys.length - MAX_CONSENTS)).forEach((k) => delete consents[k]);
    try {
        storage.setItem(LESSON_PROGRESS_CONSENT_STORAGE_KEY, JSON.stringify(consents));
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * 答えを作る。「わたしの記録です」なら、いま端末にある課題のチャレンジの記録を「前」にする。
 * @param {string} answer - CONSENT_ANSWERS のどれか。
 * @param {object} records - assignmentChallengeRecords の結果（答えたときのもの）。
 * @param {string} decidedAt - 答えた日時（ISO 文字列）。
 * @returns {object} `{answer, beforeIds, decidedAt}`。
 */
export const makeConsent = (answer, records, decidedAt) => ({
    answer,
    beforeIds: answer === CONSENT_ANSWERS.MINE ? Object.keys(records).sort() : [],
    decidedAt,
});

/**
 * 送る前に本人の確認を出すか。まだ答えていない課題 × 席で、端末に課題のチャレンジの記録があるとき。
 * @param {?object} consent - loadConsent の結果。
 * @param {object} records - assignmentChallengeRecords の結果。
 * @returns {boolean} 聞くなら true。
 */
export const needsConfirmation = (consent, records) => !consent && Object.keys(records).length > 0;

/**
 * 本人の確認に出す記録の一覧（課題の並び順・知らないチャレンジは除く）。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {object} records - assignmentChallengeRecords の結果。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {Array<{id: string, name: object, completedAt: string}>} 一覧（name はメッセージ記述子）。
 */
export const confirmationItems = (lesson, records, courses = COURSES) => {
    if (!lesson) return [];
    return lesson.challengeIds
        .filter((id) => records[id])
        .map((id) => ({ id, found: findChallenge(id, courses) }))
        .filter(({ found }) => found)
        .map(({ id, found }) => ({ id, name: found.challenge.name, completedAt: records[id].completedAt }));
};

/**
 * いまやっているチャレンジ（current）。課題のチャレンジを開いているときだけ。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {?string} challengeId - 開いているチャレンジ id。
 * @param {?string} openedAt - 開いた日時（ISO 文字列）。
 * @returns {?{challengeId: string, openedAt: string}} current。無ければ null（送らない）。
 */
export const currentChallengeOf = (lesson, challengeId, openedAt) =>
    lesson && challengeId && openedAt && lesson.challengeIds.includes(challengeId) ? { challengeId, openedAt } : null;

/**
 * 送る中身（PUT /classrooms/{id}/lesson-progress の本文）。課題のチャレンジの記録を全部と、
 * 開いているときだけ current（閉じたときに null は送らない。先生の表は「できた」を優先して見せる）。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {object} progress - 端末の記録。
 * @param {object} consent - 答え（beforeIds を「前」にする）。
 * @param {?object} current - currentChallengeOf の結果。
 * @returns {{challenges: object, current: (object|undefined)}} 本文。
 */
export const buildProgressPayload = (lesson, progress, consent, current) => {
    const before = new Set(consent ? consent.beforeIds : []);
    const challenges = {};
    Object.entries(assignmentChallengeRecords(lesson, progress)).forEach(([id, { completedAt }]) => {
        challenges[id] = { completedAt, before: before.has(id) };
    });
    const payload = { challenges };
    if (current) payload.current = current;
    return payload;
};

/**
 * 最後に送れた中身で、こんどの中身が足りているか（足りていれば送らない）。
 * チャレンジは「できた」が増えていなければ足りている（サーバーは一度できたものを変えない）。
 * current は送るときに、最後に送れたものと同じなら足りている。
 * @param {object} payload - buildProgressPayload の結果。
 * @param {?object} acked - 最後に送れた中身（無ければ null）。
 * @returns {boolean} 送らなくてよければ true。
 */
export const isCoveredBy = (payload, acked) => {
    if (!acked) return false;
    const covered = Object.keys(payload.challenges).every((id) => acked.challenges[id]);
    if (!covered) return false;
    if (!payload.current) return true;
    const last = acked.current;
    return Boolean(
        last && last.challengeId === payload.current.challengeId && last.openedAt === payload.current.openedAt,
    );
};

/**
 * 最後に送れた中身に、いま送れた中身を合わせる。
 * @param {?object} acked - 最後に送れた中身。
 * @param {object} payload - いま送れた中身。
 * @returns {object} 合わせた中身。
 */
export const mergeAcked = (acked, payload) => ({
    challenges: { ...(acked ? acked.challenges : {}), ...payload.challenges },
    current: payload.current || (acked ? acked.current : null) || null,
});

/** 送れなかったときにどうするか。 */
export const SEND_FAILURES = Object.freeze({
    // 次に送るときにもう一度（オフライン・429・5xx・400（1 分 20 回の上限など）・409）
    RETRY: 'retry',
    // このセッションでは送るのをやめる（期限切れ・kick（410）・認証（401/403）・課題が無い（404））。
    // 端末の記録はそのまま残す
    STOP: 'stop',
});

/**
 * @param {*} error - classroom-api の例外（`status` を持つ）。
 * @returns {string} SEND_FAILURES のどれか。
 */
export const classifySendFailure = (error) => {
    const status = error && error.status;
    return status === 401 || status === 403 || status === 404 || status === 410
        ? SEND_FAILURES.STOP
        : SEND_FAILURES.RETRY;
};
