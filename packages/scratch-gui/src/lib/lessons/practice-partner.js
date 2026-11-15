// === Smalruby: This file is Smalruby-specific (lesson mesh practice partner: definition) ===
// メッシュの練習相手（チャレンジの `partner`）の定義を読む純粋関数。定義はデータだけで、
// チャレンジごとにコードを書かない（docs/lessons/design.md の「メッシュの練習相手」）:
//
//   partner: {
//       name,                                   // 相手の名前
//       buttons: [{ label, set, broadcast }],   // パネルのボタン（押すと相手が変数を変える・合図を送る）
//       replies: [{ onBroadcast, set, broadcast }], // 自動の返事（合図を受け取ったら、変数を変える・合図を送る）
//   }
//
// - `name` / `label` / `broadcast` / `onBroadcast` は文字列か、locale ごとの `{ja, 'ja-Hira', en}`
//   （作品の中の名前は locale で変わるため。`code` と同じ `localizeCode` で選ぶ）。
// - `set` は共有する変数を変える `{ variable, value }`（複数なら配列）。`variable` は文字列か locale ごとの
//   文字列、`value` は文字列か数か `{ fromVariable: '名前' }`（生徒の作品の変数の、押したときの値。名前は文字列か
//   locale ごと。変数が無ければ空文字）。メッシュの共有する変数（「〜のセンサー値」）として相手の値になる。
// - ボタンを押したとき・合図を受け取ったときは、`set` → `broadcast` の順に起きる。
// VM とのつなぎ（ブラウザの中での折り返し）は practice-loopback.js。
import { localizeCode } from './courses';

/** 練習相手のメッシュのノード ID（本物のノード ID と重ならない名前）。 */
export const PRACTICE_PARTNER_NODE_ID = 'smalruby-lesson-practice-partner';

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const isScalar = (value) => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));

/**
 * 文字列か locale ごとの文字列から、いまの locale のものを選ぶ。
 * @param {?(string|number|object)} value - 文字列・数・`{ja, 'ja-Hira', en}`。
 * @param {string} locale - いまの locale。
 * @returns {?string} 文字列。無い・空なら null。
 */
const localizeText = (value, locale) => {
    const text = typeof value === 'number' ? String(value) : localizeCode(value, locale);
    return typeof text === 'string' && text !== '' ? text : null;
};

/**
 * `set` の 1 つの値を読む。文字列・数はそのまま、`{fromVariable}` は生徒の変数の名前（値は押したときに読む）。
 * @param {*} value - `set` の `value`。
 * @param {string} locale - いまの locale。
 * @returns {?({value: string}|{fromVariable: string})} 値。使えない形なら null。
 */
const normalizeValue = (value, locale) => {
    if (isScalar(value)) return { value: String(value) };
    if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, 'fromVariable')) {
        const fromVariable = localizeText(value.fromVariable, locale);
        return fromVariable === null ? null : { fromVariable };
    }
    return null;
};

/**
 * `set`（`{variable, value}` か、その配列）を `[{name, value}]` にする（`{fromVariable}` の値は
 * `[{name, fromVariable}]`）。
 * @param {?(object|Array<object>)} set - `set` の定義。
 * @param {string} locale - いまの locale。
 * @returns {Array<{name: string, value: (string|undefined), fromVariable: (string|undefined)}>} 変える変数
 *   （値は文字列。メッシュは文字列で送るため）。
 */
const normalizeSet = (set, locale) =>
    (Array.isArray(set) ? set : [set])
        .filter(isPlainObject)
        .map((one) => {
            const value = normalizeValue(one.value, locale);
            return value ? { name: localizeText(one.variable, locale), ...value } : null;
        })
        .filter((one) => one !== null && one.name !== null);

const normalizeAction = (def, locale) => ({
    set: normalizeSet(def.set, locale),
    broadcast: localizeText(def.broadcast, locale),
});

/**
 * 練習相手の定義を、いまの locale で読みやすい形にそろえる。
 * @param {?object} partner - チャレンジの `partner`。
 * @param {string} locale - いまの locale。
 * @returns {?object} `{name, buttons: [{label, set, broadcast}], replies: [{onBroadcast, set, broadcast}]}`。
 *   定義が無い・ボタンも自動の返事も無いときは null（練習相手を出さない）。
 */
export const normalizePartner = (partner, locale) => {
    if (!isPlainObject(partner)) return null;
    const buttons = (Array.isArray(partner.buttons) ? partner.buttons : [])
        .filter(isPlainObject)
        .map((button) => ({ label: localizeText(button.label, locale), ...normalizeAction(button, locale) }))
        .filter((button) => button.label !== null);
    const replies = (Array.isArray(partner.replies) ? partner.replies : [])
        .filter(isPlainObject)
        .map((reply) => ({ onBroadcast: localizeText(reply.onBroadcast, locale), ...normalizeAction(reply, locale) }))
        .filter((reply) => reply.onBroadcast !== null && (reply.set.length > 0 || reply.broadcast !== null));
    if (buttons.length === 0 && replies.length === 0) return null;
    return { name: localizeText(partner.name, locale) || '', buttons, replies };
};

// 合図の名前は Scratch と同じく大文字小文字を区別しない
const sameMessage = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();

/**
 * 合図を受け取ったときの自動の返事（定義の順）。
 * @param {?object} normalized - `normalizePartner` の結果。
 * @param {string} messageName - 生徒の作品が送った合図の名前。
 * @returns {Array<object>} 返事（`{onBroadcast, set, broadcast}`）。
 */
export const repliesFor = (normalized, messageName) => {
    if (!normalized || typeof messageName !== 'string' || messageName === '') return [];
    return normalized.replies.filter((reply) => sameMessage(reply.onBroadcast, messageName));
};

/**
 * 練習相手のパネルに出す「相手に届いたもの」の 1 行（D3）。最後に届いたのが合図なら合図の名前（同じ名前の
 * 共有する変数があれば、その値も。このコースは変数と合図に同じ名前を使う）、変数なら「名前 = 値」。
 * @param {?{last: ?{kind: string, name: string}, values: object}} received - 届いたもの。`last` は最後に
 *   届いたもの（`kind` = 'message' / 'variable'）、`values` は共有する変数の名前 → 最後の値。
 * @returns {?string} 1 行。まだ何も届いていなければ null。
 */
export const receivedSummary = (received) => {
    if (!received || !received.last) return null;
    const { last, values = {} } = received;
    if (last.kind === 'variable') return `${last.name} = ${values[last.name] ?? ''}`;
    const sameName = Object.keys(values).find((name) => sameMessage(name, last.name));
    return typeof sameName === 'string' ? `${last.name} = ${values[sameName]}` : last.name;
};

/**
 * メッシュの拡張の接続のようすから、練習のモードを動かしてよいか。本物のメッシュでつながっている・
 * つなごうとしているあいだは動かさない（本物のメッシュに混ぜない）。
 * @param {?string} connectionState - 拡張の `connectionState`（無ければ拡張が無い）。
 * @returns {boolean} 動かしてよければ true。
 */
export const practiceAllowed = (connectionState) =>
    !connectionState || connectionState === 'disconnected' || connectionState === 'error';
