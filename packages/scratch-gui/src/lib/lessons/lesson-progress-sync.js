// クラスの課題へ進み具合を送る（#1600）ときの決まりを持つ純粋関数と、本人の確認の答えの保存。
// 決まりは docs/lessons/design.md の「本人の確認」「進み具合の送り方」。
//
// 送り方（推奨で決めた）:
//   - 送るたびに、端末の記録のうち課題のチャレンジを全部まとめて送る（PUT は席 × 課題の 1 件）。
//     サーバーはマージし、保存済みの「できた」は変えず、変わらない送信は書かない。だから、送れなかった分を
//     別に取っておかなくても、次に送るときに自然に入る（オフライン・API の失敗・席に入り直して行が
//     作り直されたときも同じ）。
//   - 最後に送れた中身で足りているときは送らない（席ごとの 1 分 20 回の上限を無駄に使わない）。
//   - 「前」（before）は、本人の確認で一覧に出して「わたしの記録です」と答えた記録。答えと一緒に
//     端末に覚える（はじめての送信が失敗しても、次の送信で同じ「前」を送れる）。
//   - 同意していない記録は送らない（ひとつの決まり・#1600 M1 / M2）: できた日時が答えた日時
//     （decidedAt）以前で、beforeIds に無い記録は、前に使った人のものかもしれない。答えが「わたしの記録です」
//     「記録が無かった」なら、その記録だけについてもう一度聞く（先生があとから課題にチャレンジを足したとき）。
//     「消す」なら黙って捨てる（別のタブが消す前の記録を書き戻したとき）。答えのあとにできた記録はそのまま送る。
//   - 送れない日時（読めない・2020 年より前）の記録は送らない（サーバーが 400 で送信ごと拒むため・FYI1）。
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

// セッショントークンの短いハッシュ（FNV-1a 32bit）。参加した人を見分けるだけに使い、トークンそのものは
// localStorage の答えのキーに残さない
const shortHash = (text) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
};

/**
 * 本人の確認の答えを覚える単位。課題（= classroomId）× 席 × 席に入った人（推奨で決めた・#1600 Q1）。
 * サーバーは席の人が入れ替わる（参加した時刻が変わる）と行を作り直すので、クライアントも参加ごとに
 * 聞き直す。席に入った人は、その端末で参加した時刻（セッションの `joinedAt`。参加するたびに変わる）で
 * 見分け、無ければセッショントークンの短いハッシュで見分ける。同じ生徒が入り直したときも、もう一度聞く。
 * @param {?string} classroomId - 課題の id。
 * @param {?(number|string)} seatNumber - 席番号。
 * @param {object} [occupant] - 席に入った人。
 * @param {?string} [occupant.joinedAt] - 参加した時刻。
 * @param {?string} [occupant.sessionToken] - セッショントークン（joinedAt が無いとき）。
 * @returns {?string} キー。課題・席・人のどれかが分からなければ null。
 */
export const consentKey = (classroomId, seatNumber, { joinedAt = null, sessionToken = null } = {}) => {
    if (!classroomId || seatNumber === null || typeof seatNumber === 'undefined' || seatNumber === '') return null;
    const occupant = joinedAt ? `j${joinedAt}` : sessionToken ? `t${shortHash(sessionToken)}` : null;
    return occupant ? `${classroomId}#${seatNumber}#${occupant}` : null;
};

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

// サーバーが受け付ける日時の下限（`normalizeTimestamp` は 2020-01-01 より前を 400 で拒む）
const MIN_TIMESTAMP_MS = Date.UTC(2020, 0, 1);

/**
 * @param {*} value - 日時（ISO 文字列）。
 * @returns {boolean} サーバーへ送れる日時（読める・2020 年以降）なら true。
 */
export const isSendableTimestamp = (value) => {
    if (typeof value !== 'string') return false;
    const ms = Date.parse(value);
    return Number.isFinite(ms) && ms >= MIN_TIMESTAMP_MS;
};

const timeOf = (value) => {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
};

/**
 * 同意していない記録の id（課題の並び順）。答えが無ければ、課題の記録の全部。答えがあれば、できた日時が
 * 答えた日時以前で beforeIds に無いもの（前に使った人のものかもしれない）。日時が読めない記録も、同意して
 * いないものとして扱う（送らない）。
 * @param {?object} consent - 答え（loadConsent の結果）。
 * @param {object} records - assignmentChallengeRecords の結果。
 * @returns {Array<string>} id。
 */
export const unconsentedIds = (consent, records) => {
    const ids = Object.keys(records);
    if (!consent) return ids;
    const decided = timeOf(consent.decidedAt);
    const before = new Set(consent.beforeIds);
    return ids.filter((id) => {
        if (before.has(id)) return false;
        const done = timeOf(records[id].completedAt);
        return decided === null || done === null || done <= decided;
    });
};

/**
 * 本人の確認に出す記録の一覧（課題の並び順・この版のコースに無いチャレンジは除く）。同意していない
 * 記録だけを出す（はじめては課題の記録の全部、聞き直しは新しく出てきたものだけ）。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {object} records - assignmentChallengeRecords の結果。
 * @param {?object} consent - 答え（はじめては null）。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {Array<{id: string, name: object, completedAt: string}>} 一覧（name はメッセージ記述子）。
 */
export const confirmationItems = (lesson, records, consent, courses = COURSES) => {
    if (!lesson) return [];
    const pending = new Set(unconsentedIds(consent, records));
    return lesson.challengeIds
        .filter((id) => pending.has(id))
        .map((id) => ({ id, found: findChallenge(id, courses) }))
        .filter(({ found }) => found)
        .map(({ id, found }) => ({ id, name: found.challenge.name, completedAt: records[id].completedAt }));
};

/**
 * 送る前に本人の確認を出すか。同意していない記録のうち、一覧に出せるもの（この版のコースにある
 * チャレンジ）があるとき。答えが「消す」なら聞かない（黙って捨てる）。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {?object} consent - 答え（loadConsent の結果）。
 * @param {object} records - assignmentChallengeRecords の結果。
 * @param {Array} [courses] - コース（テスト用）。
 * @returns {boolean} 聞くなら true。
 */
export const needsConfirmation = (lesson, consent, records, courses = COURSES) =>
    !(consent && consent.answer === CONSENT_ANSWERS.CLEARED) &&
    confirmationItems(lesson, records, consent, courses).length > 0;

/**
 * 答えを作る。前の答えがあれば（聞き直し）、答えた日時はそのまま（答えたあとにできた記録を「前より前」に
 * しない）、beforeIds は合わせる。
 *   - MINE: 一覧に出した記録（shownIds）を「前」にする（出していない記録には同意していない・FYI3）
 *   - NONE: はじめて送るとき、聞く記録が無かった
 *   - CLEARED: 端末の記録を空にした。答えた日時を今にして、それより前の記録は（別のタブが書き戻しても）送らない
 * @param {string} answer - CONSENT_ANSWERS のどれか。
 * @param {Array<string>} shownIds - 一覧に出した記録の id（MINE のとき）。
 * @param {string} decidedAt - 答えた日時（ISO 文字列）。
 * @param {?object} [previous] - 前の答え。
 * @returns {object} `{answer, beforeIds, decidedAt}`。
 */
export const makeConsent = (answer, shownIds, decidedAt, previous = null) => {
    const beforeIds = new Set(previous ? previous.beforeIds : []);
    if (answer === CONSENT_ANSWERS.MINE) shownIds.forEach((id) => beforeIds.add(id));
    return {
        answer,
        beforeIds: [...beforeIds].sort(),
        decidedAt: previous && answer !== CONSENT_ANSWERS.CLEARED ? previous.decidedAt : decidedAt,
    };
};

/**
 * いまやっているチャレンジ（current）。課題のチャレンジを開いているときだけ。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {?string} challengeId - 開いているチャレンジ id。
 * @param {?string} openedAt - 開いた日時（ISO 文字列）。
 * @returns {?{challengeId: string, openedAt: string}} current。無ければ null（送らない）。
 */
export const currentChallengeOf = (lesson, challengeId, openedAt) =>
    lesson && challengeId && isSendableTimestamp(openedAt) && lesson.challengeIds.includes(challengeId)
        ? { challengeId, openedAt }
        : null;

/**
 * 送る中身（PUT /classrooms/{id}/lesson-progress の本文）。課題のチャレンジの記録のうち、同意したもの
 * （beforeIds にある・答えたあとにできた）を全部と、開いているときだけ current（閉じたときに null は
 * 送らない。先生の表は「できた」を優先して見せる）。同意していない記録・送れない日時の記録は外す。
 * @param {?object} lesson - normalizeAssignmentLesson の結果。
 * @param {object} progress - 端末の記録。
 * @param {object} consent - 答え（beforeIds を「前」にする）。
 * @param {?object} current - currentChallengeOf の結果。
 * @returns {{challenges: object, current: (object|undefined)}} 本文。
 */
export const buildProgressPayload = (lesson, progress, consent, current) => {
    const records = assignmentChallengeRecords(lesson, progress);
    const skipped = new Set(unconsentedIds(consent, records));
    const before = new Set(consent ? consent.beforeIds : []);
    const challenges = {};
    Object.entries(records).forEach(([id, { completedAt }]) => {
        if (skipped.has(id) || !isSendableTimestamp(completedAt)) return;
        challenges[id] = { completedAt, before: before.has(id) };
    });
    const payload = { challenges };
    if (current && isSendableTimestamp(current.openedAt)) payload.current = current;
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
