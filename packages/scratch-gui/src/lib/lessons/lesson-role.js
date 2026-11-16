// === Smalruby: This file is Smalruby-specific (lesson pair roles: how the role is chosen) ===
// ペアでやるチャレンジの役をどう決めるか（#2061・先生の判断 p2・p3）。
//
// - 役はチャレンジごとに決める。生徒が自分で選んだ役だけを端末に覚え、次の役のあるチャレンジを開いたときに
//   それを最初に選んでおく（「前回はシマネコの役」と出す）。既定（シマラビの役）や出席番号で決まった役は覚えない
//   （一度も選んでいない生徒に「前回は…」を出さない）。読むのも書くのもコンテナ（reducer は端末に触らない）。
// - クラスで出席番号のペアにつながっていれば、出席番号の小さい人がシマラビの役（変えられる）。同じペアで前に
//   選んだ役を覚えていれば、そちらを使う（ペアで決めて入れかえた役を、次のチャレンジで戻さない）。
// - 何も覚えていない・ひとりのときはシマラビの役。
// - 決め方は覚えている役と、いまのつながりだけで決まる。チャレンジをどの順にやっても同じ（3-2 を先にやった、
//   のような前提を置かない）。
import { parseGroupName } from '@smalruby/scratch-vm/src/extensions/scratch3_mesh_v2/seat-naming';
import { DEFAULT_ROLE, ROLES, isRole } from './role-swap';

/** 端末に覚える前回の役のキー。 */
export const LESSON_ROLE_STORAGE_KEY = 'smalruby:lessonRole';

/** 役をどう決めたか。課題バーの「前回は…」「出席番号で決めた役」の表示に使う。 */
export const ROLE_SOURCES = Object.freeze({
    // 何も覚えていない・ひとり（シマラビの役）
    DEFAULT: 'default',
    // 前のチャレンジで使った役
    REMEMBERED: 'remembered',
    // クラスの出席番号のペア（小さい人がシマラビの役）
    SEAT: 'seat',
    // このチャレンジで生徒が選んだ
    CHOSEN: 'chosen',
});

const isSeat = (value) => Number.isInteger(value) && value > 0;

/**
 * ペアの印（出席番号を小さい順に「-」でつないだもの）。2 人のペアでなければ null。
 * @param {Array<number>} seats - 出席番号。
 * @returns {?string} 例 `'3-7'`。
 */
export const pairKeyOf = (seats) => {
    const unique = [...new Set((seats || []).filter(isSeat))].sort((a, b) => a - b);
    return unique.length === 2 ? unique.join('-') : null;
};

/**
 * メッシュのグループ名（「出席番号でつながる」で作ったもの）から、そのグループの出席番号を取り出す。
 * グループ名の決まりは scratch-vm の seat-naming.js（ホストの出席番号 `host=` と、選んだ出席番号 `seats=`）。
 * @param {?string} groupName - つながっているグループの名前。
 * @returns {Array<number>} 出席番号（小さい順）。出席番号のグループでなければ空。
 */
export const seatsOfGroupName = (groupName) => {
    const info = parseGroupName(groupName);
    if (!info) return [];
    const seats = [...(info.seats || []), info.host].filter(isSeat);
    return [...new Set(seats)].sort((a, b) => a - b);
};

/**
 * 出席番号のペアで決まる役（小さい人がシマラビの役）。自分がペアに入っていなければ null。
 * @param {?number} mySeat - 自分の出席番号。
 * @param {Array<number>} groupSeats - つながっているグループの出席番号。
 * @returns {?string} 役。
 */
export const seatRoleFor = (mySeat, groupSeats) => {
    if (!isSeat(mySeat) || !pairKeyOf(groupSeats) || !groupSeats.includes(mySeat)) return null;
    return mySeat === Math.min(...groupSeats) ? ROLES.SHIMARABY : ROLES.SHIMACAT;
};

/**
 * 役のあるチャレンジを開くときの役を決める（純粋関数）。
 * @param {object} context - いまの状態。
 * @param {?{role: string, pair: ?string}} context.remembered - 端末に覚えている前回の役。
 * @param {?number} [context.mySeat] - クラスでの自分の出席番号（クラスの外は null）。
 * @param {Array<number>} [context.groupSeats] - つながっているメッシュのグループの出席番号。
 * @returns {{role: string, source: string, pair: ?string}} 役・決め方・ペアの印。
 */
export const resolveChallengeRole = ({ remembered = null, mySeat = null, groupSeats = [] } = {}) => {
    const memory = remembered && isRole(remembered.role) ? remembered : null;
    const seatRole = seatRoleFor(mySeat, groupSeats);
    if (seatRole) {
        const pair = pairKeyOf(groupSeats);
        if (memory && memory.pair === pair) return { role: memory.role, source: ROLE_SOURCES.REMEMBERED, pair };
        return { role: seatRole, source: ROLE_SOURCES.SEAT, pair };
    }
    if (memory) return { role: memory.role, source: ROLE_SOURCES.REMEMBERED, pair: memory.pair || null };
    return { role: DEFAULT_ROLE, source: ROLE_SOURCES.DEFAULT, pair: null };
};

const defaultStorage = () => (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);

/**
 * 端末に覚えている前回の役を読む。読めない・壊れているときは null。
 * @param {?Storage} [storage] - 読む先（テスト用。既定は localStorage）。
 * @returns {?{role: string, pair: ?string}} 前回の役。
 */
export const loadRememberedRole = (storage = defaultStorage()) => {
    if (!storage) return null;
    try {
        const value = JSON.parse(storage.getItem(LESSON_ROLE_STORAGE_KEY));
        if (!value || !isRole(value.role)) return null;
        return { role: value.role, pair: typeof value.pair === 'string' ? value.pair : null };
    } catch (_e) {
        return null;
    }
};

/**
 * 生徒が選んだ役を、次のチャレンジのために覚える（選んだときだけ呼ぶ）。書けないときは何もしない（役は覚えなくても動く）。
 * @param {{role: string, pair: ?string}} value - 役とペアの印。
 * @param {?Storage} [storage] - 書く先（テスト用。既定は localStorage）。
 */
export const saveRememberedRole = ({ role, pair = null }, storage = defaultStorage()) => {
    if (!storage || !isRole(role)) return;
    try {
        storage.setItem(LESSON_ROLE_STORAGE_KEY, JSON.stringify({ role, pair: pair || null }));
    } catch (_e) {
        // 書けなくても、このチャレンジの役はそのまま使える
    }
};
