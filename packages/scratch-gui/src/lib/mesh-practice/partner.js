// === Smalruby: This file is Smalruby-specific (mesh practice partner: shared definition) ===
// メッシュの練習相手の、データの形と決まり（純粋関数）。レッスンの練習相手（#1638）と
// レッスンの外のひとりで使う練習相手（#1845）の両方が使う置き場。
//
// 練習相手の定義（正規化したあとの形。レッスンの `partner: {name, buttons, replies}` と同じ並び）:
//
//   {
//       name,                                          // 相手の名前（無ければ ''）
//       buttons: [{ label, set, broadcast, value }],   // 押すと相手が変数を変える・メッセージを送る
//       replies: [{ onBroadcast, set, broadcast, value }], // 自動の返事（受け取ったら、変数を変える・送り返す）
//   }
//
// - `set` は `[{name, value}]`（値は文字列。メッシュは文字列で送るため）。
// - `broadcast` はメッセージの名前（無ければ null）、`value` はそのメッセージの値（値なしは ''。#1843）。
// - ボタンを押したとき・受け取ったときは `set` → `broadcast` の順に起きる。
// VM とのつなぎ（ブラウザの中での折り返し）は loopback.js。

/** 練習相手のメッシュのノード ID（本物のノード ID = uuid の 16 進と重ならない名前）。 */
export const MESH_PRACTICE_PARTNER_NODE_ID = 'smalruby-mesh-practice-partner';

/**
 * 待っている返事（メッセージの名前ごとに 1 つ）の上限。本物のメッシュの送るキューの上限
 * （mesh-service.js の MAX_EVENT_QUEUE_SIZE = 100）に合わせる。
 */
export const MAX_PENDING_REPLIES = 100;

/** 自動の返事を返すまでの間（ms）。本物のメッシュの遅れ（およそ 1 秒）より短く、順が分かる長さ。 */
export const REPLY_DELAY_MS = 500;

/** 相手の変数・自動の返事の数の上限（localStorage を使いすぎないため）。 */
export const MAX_PARTNER_VARIABLES = 50;
export const MAX_PARTNER_REPLIES = 50;
/** 変数の名前の長さの上限（Scratch の変数名として現実的な長さ）。 */
export const MAX_VARIABLE_NAME_LENGTH = 100;

/**
 * 値の長さの上限。VM の scratch3_mesh_v2/message-value.js の MAX_MESSAGE_VALUE_LENGTH と、
 * サーバー（infra #1846）の上限と同じ 1,000（JavaScript の length）。
 */
export const MAX_MESSAGE_VALUE_LENGTH = 1000;

/**
 * 値を文字列にして、本物のメッシュと同じ 1,000 文字（JavaScript の length）までに切り詰める
 * （VM の message-value.js の toMessageValue と同じ。サロゲートペアの片方は落とす）。
 * @param {*} value - 値。
 * @returns {string} 送る値。
 */
export const clampValue = (value) => {
    if (value === null || typeof value === 'undefined') return '';
    let text = String(value);
    if (text.length > MAX_MESSAGE_VALUE_LENGTH) {
        text = text.slice(0, MAX_MESSAGE_VALUE_LENGTH);
        const last = text.charCodeAt(text.length - 1);
        if (last >= 0xd800 && last <= 0xdbff) text = text.slice(0, -1);
    }
    return text;
};

// メッセージの名前は Scratch と同じく大文字小文字を区別しない
export const sameMessage = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();

/**
 * 受け取ったときの自動の返事（定義の順）。
 * @param {?object} partner - 正規化した練習相手。
 * @param {string} messageName - 生徒の作品が送ったメッセージの名前。
 * @returns {Array<object>} 返事。
 */
export const repliesFor = (partner, messageName) => {
    if (!partner || !Array.isArray(partner.replies) || typeof messageName !== 'string' || messageName === '') {
        return [];
    }
    return partner.replies.filter((reply) => sameMessage(reply.onBroadcast, messageName));
};

/**
 * メッシュの拡張の接続のようすから、練習相手を動かしてよいか。本物のメッシュでつながっている・
 * つなごうとしているあいだは動かさない（本物のメッシュに混ぜない）。
 * @param {?string} connectionState - 拡張の `connectionState`（無ければ拡張が無い）。
 * @returns {boolean} 動かしてよければ true。
 */
export const practiceAllowed = (connectionState) =>
    !connectionState || connectionState === 'disconnected' || connectionState === 'error';

/**
 * 作品にあるメッセージとステージの（全員用の）変数の名前。練習相手のタブに自動で並べる。
 * @param {?object} stage - ステージのターゲット。
 * @returns {{messages: Array<string>, variables: Array<string>}} 名前（作品の順をあいうえお順にそろえる）。
 */
export const listProjectMeshItems = (stage) => {
    const messages = [];
    const variables = [];
    const all = stage && stage.variables ? stage.variables : {};
    Object.keys(all).forEach((id) => {
        const v = all[id];
        if (!v || typeof v.name !== 'string' || v.name === '') return;
        if (v.type === 'broadcast_msg') messages.push(v.name);
        else if (v.type === '' && !v.isCloud) variables.push(v.name);
    });
    const byName = (a, b) => a.localeCompare(b, 'ja');
    return { messages: [...new Set(messages)].sort(byName), variables: [...new Set(variables)].sort(byName) };
};

// ---- ひとりで使う練習相手（#1845）の設定 ----

/**
 * ひとりで使う練習相手の、ブラウザに覚える設定（作品には入れない・EPIC #1842 Q9）。
 *   {
 *       variables: [{name, value}],  // 相手の変数（value が null = まだ値を入れていない）
 *       buttons: [{broadcast, value}], // メッセージごとに最後に入れた値（「送る」の横の欄）
 *       replies: [{onBroadcast, broadcast, value}], // 「X を受け取ったら Y（値）を送り返す」
 *   }
 * @returns {object} 空の設定。
 */
export const emptySettings = () => ({ variables: [], buttons: [], replies: [] });

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nameOf = (value) => (typeof value === 'string' ? value.trim().slice(0, MAX_VARIABLE_NAME_LENGTH) : '');
const valueOf = (value) => (typeof value === 'string' || typeof value === 'number' ? clampValue(value) : '');

/**
 * localStorage から読んだもの（壊れているかもしれない）を、使える設定にそろえる。
 * @param {*} raw - 読んだもの。
 * @returns {object} 設定。
 */
export const sanitizeSettings = (raw) => {
    if (!isPlainObject(raw)) return emptySettings();
    const seen = new Set();
    const variables = (Array.isArray(raw.variables) ? raw.variables : [])
        .filter(isPlainObject)
        .map((v) => ({
            name: nameOf(v.name),
            value: v.value === null || typeof v.value === 'undefined' ? null : valueOf(v.value),
        }))
        .filter((v) => {
            if (v.name === '' || seen.has(v.name)) return false;
            seen.add(v.name);
            return true;
        })
        .slice(0, MAX_PARTNER_VARIABLES);
    const seenButtons = new Set();
    const buttons = (Array.isArray(raw.buttons) ? raw.buttons : [])
        .filter(isPlainObject)
        .map((b) => ({ broadcast: nameOf(b.broadcast), value: valueOf(b.value) }))
        .filter((b) => {
            const key = b.broadcast.toUpperCase();
            if (b.broadcast === '' || seenButtons.has(key)) return false;
            seenButtons.add(key);
            return true;
        })
        .slice(0, MAX_PARTNER_REPLIES * 2);
    const replies = (Array.isArray(raw.replies) ? raw.replies : [])
        .filter(isPlainObject)
        .map((r) => ({ onBroadcast: nameOf(r.onBroadcast), broadcast: nameOf(r.broadcast), value: valueOf(r.value) }))
        .filter((r) => r.onBroadcast !== '' && r.broadcast !== '')
        .slice(0, MAX_PARTNER_REPLIES);
    return { variables, buttons, replies };
};

/**
 * 相手の変数の一覧: 作品の変数（相手も同じ作品を動かしている想定）と、相手のために作った変数。
 * @param {object} settings - 設定。
 * @param {Array<string>} projectVariables - 作品のステージの変数の名前。
 * @returns {Array<{name: string, value: ?string, created: boolean}>} 作品の変数 → 作った変数の順。
 */
export const partnerVariableRows = (settings, projectVariables) => {
    const values = new Map(settings.variables.map((v) => [v.name, v.value]));
    const rows = projectVariables.map((name) => ({
        name,
        value: values.has(name) ? values.get(name) : null,
        created: false,
    }));
    settings.variables.forEach((v) => {
        if (!projectVariables.includes(v.name)) rows.push({ name: v.name, value: v.value, created: true });
    });
    return rows;
};

/**
 * 相手の変数に値を入れる（無ければ足す）。
 * @param {object} settings - 設定。
 * @param {string} name - 変数の名前。
 * @param {?string} value - 値（null = 値なしで作るだけ）。
 * @returns {object} 新しい設定（足せなければ元のまま）。
 */
export const withVariable = (settings, name, value) => {
    const n = nameOf(name);
    if (n === '') return settings;
    const v = value === null ? null : clampValue(value);
    const index = settings.variables.findIndex((one) => one.name === n);
    if (index >= 0) {
        if (v === null) return settings;
        const variables = settings.variables.slice();
        variables[index] = { name: n, value: v };
        return { ...settings, variables };
    }
    if (settings.variables.length >= MAX_PARTNER_VARIABLES) return settings;
    return { ...settings, variables: settings.variables.concat({ name: n, value: v }) };
};

/**
 * @param {object} settings - 設定。
 * @param {string} name - 消す変数の名前。
 * @returns {object} 新しい設定。
 */
export const withoutVariable = (settings, name) => ({
    ...settings,
    variables: settings.variables.filter((v) => v.name !== name),
});

/**
 * メッセージの「送る」の横の値を覚える。
 * @param {object} settings - 設定。
 * @param {string} broadcast - メッセージの名前。
 * @param {string} value - 値。
 * @returns {object} 新しい設定。
 */
export const withButtonValue = (settings, broadcast, value) => {
    const b = nameOf(broadcast);
    if (b === '') return settings;
    const others = settings.buttons.filter((one) => !sameMessage(one.broadcast, b));
    const v = clampValue(value);
    return { ...settings, buttons: v === '' ? others : others.concat({ broadcast: b, value: v }) };
};

/**
 * @param {object} settings - 設定。
 * @param {string} broadcast - メッセージの名前。
 * @returns {string} 覚えている値（無ければ ''）。
 */
export const buttonValueFor = (settings, broadcast) => {
    const found = settings.buttons.find((one) => sameMessage(one.broadcast, broadcast));
    return found ? found.value : '';
};

/**
 * 自動の返事を足す。同じ組み合わせはひとつにする。
 * @param {object} settings - 設定。
 * @param {{onBroadcast: string, broadcast: string, value: string}} reply - 返事。
 * @returns {object} 新しい設定（足せなければ元のまま）。
 */
export const withReply = (settings, reply) => {
    const r = {
        onBroadcast: nameOf(reply.onBroadcast),
        broadcast: nameOf(reply.broadcast),
        value: valueOf(reply.value),
    };
    if (r.onBroadcast === '' || r.broadcast === '' || settings.replies.length >= MAX_PARTNER_REPLIES) return settings;
    const dup = settings.replies.some(
        (one) =>
            sameMessage(one.onBroadcast, r.onBroadcast) &&
            sameMessage(one.broadcast, r.broadcast) &&
            one.value === r.value,
    );
    return dup ? settings : { ...settings, replies: settings.replies.concat(r) };
};

/**
 * @param {object} settings - 設定。
 * @param {number} index - 消す返事の番号。
 * @returns {object} 新しい設定。
 */
export const withoutReply = (settings, index) => ({
    ...settings,
    replies: settings.replies.filter((_, i) => i !== index),
});

/**
 * 設定を、折り返し（loopback.js）が読む練習相手の定義にする。
 * @param {object} settings - 設定。
 * @returns {object} `{name, buttons: [], replies: [{onBroadcast, set, broadcast, value}]}`。
 */
export const partnerFromSettings = (settings) => ({
    name: '',
    buttons: [],
    replies: settings.replies.map((r) => ({
        onBroadcast: r.onBroadcast,
        set: [],
        broadcast: r.broadcast,
        value: r.value,
    })),
});

/**
 * 「状態」のタブに、練習相手を「相手」の 1 人として足す（つないでいないあいだだけ）。
 * @param {?object} snapshot - VM の getStatusSnapshot()。
 * @param {{selfVariables: Array<{name, value}>, partnerData: object}} practice - 自分の変数と、
 *   remoteData の練習相手の値（`{name: {value, timestamp}}`）。
 * @returns {?object} 練習中のスナップショット（`practice: true`）。
 */
export const withPracticeNodes = (snapshot, { selfVariables, partnerData }) => {
    if (!snapshot || snapshot.connected) return snapshot;
    const data = partnerData || {};
    const variables = Object.keys(data)
        .sort()
        .map((name) => ({ name, value: data[name].value, at: data[name].timestamp }));
    const lastDataAt = variables.reduce((max, v) => (Number.isFinite(v.at) && v.at > max ? v.at : max), 0);
    const self = {
        id: snapshot.selfId,
        seat: null,
        isSelf: true,
        lastDataAt: null,
        variables: selfVariables
            .slice()
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
            .map((v) => ({ name: v.name, value: String(v.value), at: null })),
    };
    const partner = {
        id: MESH_PRACTICE_PARTNER_NODE_ID,
        seat: null,
        isSelf: false,
        lastDataAt: lastDataAt || null,
        variables,
    };
    return { ...snapshot, practice: true, nodeCount: 2, nodes: [self, partner] };
};
