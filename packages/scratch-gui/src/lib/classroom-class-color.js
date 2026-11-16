/**
 * クラスの色（クラス管理のカードの帯・クラスの見出しの帯。EPIC #1956 Q5）。
 *
 * - 色はクラスごとに**画面の側で**決める（API・データは変えない）。その先生のクラスの一覧
 *   （`GET /classroom-groups` の `groups`。アーカイブ済みも含む）を作成日（`createdAt`）の古い順・
 *   同じなら id 順に並べ、その番号で一覧の色を順に割り当てる。8 クラスまでは色が重ならず、
 *   クラスを足しても前のクラスの色は変わらない（アーカイブ済みも並べるので、アーカイブしても
 *   ずれない）。作成日が取れないクラスは id のハッシュで決める。
 * - 帯には白い文字を載せるので、白に 4.5:1 以上の色だけを使う。
 * - 色は Scratch のブロックのなかま（カテゴリ）の濃い色（`colourTertiary`。
 *   docs/design-system/blocks.md）から取る。そのままでは白に 4.5:1 に届かないなかまは、
 *   色相と彩度を変えずに明るさだけを下げ、白に 4.6:1 になったところの色にした
 *   （動き・見た目はそのまま）。
 * - 赤に近いなかま（ブロック定義 `more`・リスト `data_lists`）は使わない。赤は
 *   「いま対処が必要」なときだけに使う（クラス管理の R4）。イベント `event` は暗くすると
 *   制御 `control` と見分けにくいので使わない。
 *
 * 決まりの説明は docs/classroom/ui-ux.md の「クラスの色」と docs/design-system/tokens.md。
 */

/**
 * クラスの色の一覧。`key` はもとにした Scratch のなかま、`source` はそのなかまの
 * `colourTertiary`（オリジナルの色のモード）、`color` は帯に塗る色。
 * この順に割り当てる（1 つめのクラスは主の色と同じ青）。並びを変えると既存のクラスの色が
 * 変わるので、足すときは末尾に足す。
 */
const CLASS_COLORS = Object.freeze([
    Object.freeze({ key: 'motion', source: '#3373CC', color: '#3373CC' }),
    Object.freeze({ key: 'looks', source: '#774DCB', color: '#774DCB' }),
    Object.freeze({ key: 'pen', source: '#0B8E69', color: '#0A8562' }),
    Object.freeze({ key: 'sounds', source: '#BD42BD', color: '#B941B9' }),
    Object.freeze({ key: 'data', source: '#DB6E00', color: '#B75C00' }),
    Object.freeze({ key: 'sensing', source: '#2E8EB8', color: '#287DA2' }),
    Object.freeze({ key: 'operators', source: '#389438', color: '#328532' }),
    Object.freeze({ key: 'control', source: '#CF8B17', color: '#9D6911' }),
]);

/** 帯の上の文字の色。 */
const CLASS_COLOR_TEXT = '#FFFFFF';

/**
 * 文字列の 32 ビットのハッシュ（FNV-1a）。同じ文字列からはいつも同じ値になる。
 * @param {string} text - ハッシュにする文字列
 * @returns {number} 0 以上 2^32 未満の整数
 */
const hashString = (text) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
};

/**
 * 作成日を ms に直す。取れないときは null。
 * @param {object} group - クラス（`{groupId, createdAt}`）
 * @returns {number|null} ms epoch
 */
const createdAtMs = (group) => {
    if (!group || typeof group.createdAt !== 'string') return null;
    const ms = Date.parse(group.createdAt);
    return Number.isNaN(ms) ? null : ms;
};

/**
 * 作成日の古い順（同じなら id 順）に並べたときの、そのクラスの番号。
 * 作成日が取れないクラス・一覧に無いクラスは null。
 * @param {string} groupId - クラスの id
 * @param {Array<object>} groups - その先生のクラスの一覧（アーカイブ済みも含める）
 * @returns {number|null} 0 から始まる番号
 */
const classOrderIndex = (groupId, groups) => {
    if (!Array.isArray(groups)) return null;
    const dated = groups
        .filter((group) => group && group.groupId && createdAtMs(group) !== null)
        .sort((a, b) => createdAtMs(a) - createdAtMs(b) || String(a.groupId).localeCompare(String(b.groupId)));
    const index = dated.findIndex((group) => String(group.groupId) === String(groupId));
    return index < 0 ? null : index;
};

/**
 * クラスの色を選ぶ。一覧の中で作成日が取れればその並びの番号で、取れなければ id のハッシュで選ぶ。
 * id が無いとき（作成前など）は一覧の先頭（主の色と同じ青）にする。
 * @param {string|number|null|undefined} groupId - クラス（グループ）の id
 * @param {Array<object>} [groups] - その先生のクラスの一覧（`{groupId, createdAt}`。アーカイブ済みも含める）
 * @returns {{key: string, source: string, color: string}} 一覧の中の色
 */
const classColorEntryFor = (groupId, groups) => {
    if (groupId === null || typeof groupId === 'undefined' || groupId === '') {
        return CLASS_COLORS[0];
    }
    const index = classOrderIndex(groupId, groups);
    if (index !== null) return CLASS_COLORS[index % CLASS_COLORS.length];
    return CLASS_COLORS[hashString(String(groupId)) % CLASS_COLORS.length];
};

/**
 * クラスの色（帯の地の色）を返す。
 * @param {string|number|null|undefined} groupId - クラス（グループ）の id
 * @param {Array<object>} [groups] - その先生のクラスの一覧（アーカイブ済みも含める）
 * @returns {string} 16 進の色（例 `#3373CC`）
 */
const classColorFor = (groupId, groups) => classColorEntryFor(groupId, groups).color;

/**
 * 帯にそのまま渡せる style（地の色と白い文字）。
 * @param {string|number|null|undefined} groupId - クラス（グループ）の id
 * @param {Array<object>} [groups] - その先生のクラスの一覧（アーカイブ済みも含める）
 * @returns {{backgroundColor: string, color: string}} React の style
 */
const classColorStyle = (groupId, groups) => ({
    backgroundColor: classColorFor(groupId, groups),
    color: CLASS_COLOR_TEXT,
});

export {
    CLASS_COLORS,
    CLASS_COLOR_TEXT,
    classColorEntryFor,
    classColorFor,
    classColorStyle,
    classOrderIndex,
    hashString,
};
