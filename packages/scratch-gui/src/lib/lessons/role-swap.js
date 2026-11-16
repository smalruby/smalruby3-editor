// === Smalruby: This file is Smalruby-specific (lesson pair roles: name swap) ===
// ペアでやるチャレンジの役（シマラビの役 / シマネコの役・#2061）。シマネコの役を選ぶと、チャレンジを
// 「名前を入れかえた形」（鏡の形）にして出す: 課題・ヒントの文・ヒントのブロック・答え・最初から入っている
// プログラム・練習相手で、シマラビ ↔ シマネコ（ja / ja-Hira / en。`shimaraby_` ↔ `shimacat_`、コスチュームの
// `shimaraby-a` ↔ `shimacat-a`、鳴らす音の Chirp ↔ Meow）を入れかえる。生徒が頭の中でしていた入れかえを
// 画面がする。判定（goal）は両方の役の名前をもう通すので入れかえない（先生の判断 p4）。
//
// 役は、役のあるチャレンジ（`roles: true`）だけが持つ。みんな同じ名前を使う段（3-2・4-4・4-5）は入れかえない。
// 文言（message descriptor）はここでは文字にできないので、`roleSwapped: true` の印を付け、出すときに
// formatRoleMessage が文字にしてから入れかえる。自動の入れかえで不自然になる文は、`<id>.asShimacat` の
// 文言を足せばそれを使う（印は付けない）。
import { ja } from './lessons.locale';

/** 役。 */
export const ROLES = Object.freeze({
    SHIMARABY: 'shimaraby',
    SHIMACAT: 'shimacat',
});

/** ひとりのとき・何も覚えていないときの役。 */
export const DEFAULT_ROLE = ROLES.SHIMARABY;

/**
 * @param {*} role - 役かもしれない値。
 * @returns {boolean} 役の値か。
 */
export const isRole = (role) => role === ROLES.SHIMARABY || role === ROLES.SHIMACAT;

/**
 * @param {string} role - 役。
 * @returns {string} 相手の役。
 */
export const otherRole = (role) => (role === ROLES.SHIMACAT ? ROLES.SHIMARABY : ROLES.SHIMACAT);

// 入れかえる語の組（どちらの向きにも）。シマラビとシマネコの名前（ja と ja-Hira は同じカタカナ）、en の名前と、
// 変数・メッセージ・コスチュームの名前に入る小文字の名前、スプライトの音（シマラビは Chirp、シマネコは Meow）
const SWAP_PAIRS = [
    ['シマラビ', 'シマネコ'],
    ['Shimaraby', 'Shimacat'],
    ['shimaraby', 'shimacat'],
    ['Chirp', 'Meow'],
];
const SWAP_TABLE = new Map(
    SWAP_PAIRS.flatMap(([a, b]) => [
        [a, b],
        [b, a],
    ]),
);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SWAP_PATTERN = new RegExp(
    [...SWAP_TABLE.keys()]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join('|'),
    'g',
);

/**
 * 文字の中のシマラビとシマネコ（と、その名前の入った変数・メッセージ・コスチューム・音の名前）を入れかえる。
 * ほかの名前（ミミなど）は変えない。2 回入れかえると元にもどる。
 * @param {string} text - 文字。
 * @returns {string} 入れかえた文字。
 */
export const swapRoleText = (text) =>
    typeof text === 'string' ? text.replace(SWAP_PATTERN, (word) => SWAP_TABLE.get(word)) : text;

const isMessageDescriptor = (value) =>
    Boolean(value) && typeof value === 'object' && typeof value.id === 'string' && 'defaultMessage' in value;

const isPlainObject = (value) =>
    Boolean(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

// シマネコの役のために手で書いた文言の id（`<id>.asShimacat`）
const ROLE_OVERRIDE_SUFFIX = '.asShimacat';

const swapMessage = (descriptor, messages) => {
    // 入れかえたものをもう一度入れかえると元にもどる
    if (descriptor.roleSwapOf) return descriptor.roleSwapOf;
    if (descriptor.roleSwapped) {
        const { roleSwapped, ...original } = descriptor;
        return original;
    }
    const overrideId = `${descriptor.id}${ROLE_OVERRIDE_SUFFIX}`;
    if (messages && Object.prototype.hasOwnProperty.call(messages, overrideId)) {
        return { id: overrideId, defaultMessage: messages[overrideId], roleSwapOf: descriptor };
    }
    return { ...descriptor, roleSwapped: true };
};

const swapValue = (value, messages) => {
    if (typeof value === 'string') return swapRoleText(value);
    if (Array.isArray(value)) return value.map((item) => swapValue(item, messages));
    if (isMessageDescriptor(value)) return swapMessage(value, messages);
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, swapValue(item, messages)]));
    }
    // RegExp・画像の URL 以外のもの・関数などはそのまま
    return value;
};

// チャレンジの中で入れかえないもの。id・番号・カード・判定（両方の役の名前をもう通す）・クイズ（役に関係ない）・
// レッスン表に出す名前（役を選ぶ前に出る）・指す場所などの印
const KEEP_KEYS = new Set([
    'id',
    'number',
    'name',
    'card',
    'goal',
    'quiz',
    'mode',
    'codeTarget',
    'activityDiagram',
    'roles',
    'image',
]);

/**
 * チャレンジを、名前を入れかえた形（鏡の形）にする。2 回入れかえると元にもどる。
 * @param {object} challenge - チャレンジ（defineChallenge の形）。
 * @param {object} [messages] - 文言の表（`<id>.asShimacat` を探す。既定は ja）。
 * @returns {object} 入れかえたチャレンジ（元のチャレンジは変えない）。
 */
export const swapChallengeRoles = (challenge, messages = ja) =>
    Object.fromEntries(
        Object.entries(challenge).map(([key, value]) => [
            key,
            KEEP_KEYS.has(key) ? value : swapValue(value, messages),
        ]),
    );

// チャレンジの定義は変わらないので、入れかえた形は 1 回だけ作る（参照が変わらないように。パレット・図の
// 作り直しは参照の変化で起きる）
const swappedCache = new WeakMap();

/**
 * その役で出すチャレンジ。役の無いチャレンジ・シマラビの役はそのまま、シマネコの役は入れかえた形。
 * @param {object} challenge - チャレンジ。
 * @param {?string} role - 役（無ければシマラビの役）。
 * @returns {object} 出すチャレンジ（同じ役なら同じ参照）。
 */
export const challengeForRole = (challenge, role) => {
    if (!challenge || !challenge.roles || role !== ROLES.SHIMACAT) return challenge;
    let swapped = swappedCache.get(challenge);
    if (!swapped) {
        swapped = swapChallengeRoles(challenge);
        swappedCache.set(challenge, swapped);
    }
    return swapped;
};

/**
 * 文言を文字にする。入れかえの印（`roleSwapped`）があれば、文字にしてから名前を入れかえる。
 * @param {object} intl - react-intl の intl。
 * @param {object} descriptor - message descriptor。
 * @param {object} [values] - 文言に入れる値。
 * @returns {string} 文字。
 */
export const formatRoleMessage = (intl, descriptor, values) => {
    if (!descriptor) return '';
    const { roleSwapped, roleSwapOf, ...plain } = descriptor;
    const text = intl.formatMessage(plain, values);
    return roleSwapped ? swapRoleText(text) : text;
};
