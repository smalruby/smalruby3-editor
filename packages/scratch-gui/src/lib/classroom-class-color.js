/**
 * クラスの色（クラス管理のカードの帯・クラスの見出しの帯。EPIC #1956 Q5）。
 *
 * - 色はクラスごとに**画面の側で**決める（API・データは変えない）。同じクラスはいつも同じ色に
 *   なるよう、クラスの id から決める。
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
 * 並びを変えると既存のクラスの色が変わるので、足すときは末尾に足す。
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
 * クラスの id からクラスの色を選ぶ。
 * id が無いとき（作成前など）は一覧の先頭（主の色と同じ青）にする。
 * @param {string|number|null|undefined} classId - クラス（グループ）の id（`groupId`）
 * @returns {{key: string, source: string, color: string}} 一覧の中の色
 */
const classColorEntryFor = (classId) => {
    if (classId === null || typeof classId === 'undefined' || classId === '') {
        return CLASS_COLORS[0];
    }
    return CLASS_COLORS[hashString(String(classId)) % CLASS_COLORS.length];
};

/**
 * クラスの色（帯の地の色）を返す。
 * @param {string|number|null|undefined} classId - クラス（グループ）の id（`groupId`）
 * @returns {string} 16 進の色（例 `#3373CC`）
 */
const classColorFor = (classId) => classColorEntryFor(classId).color;

/**
 * 帯にそのまま渡せる style（地の色と白い文字）。
 * @param {string|number|null|undefined} classId - クラス（グループ）の id（`groupId`）
 * @returns {{backgroundColor: string, color: string}} React の style
 */
const classColorStyle = (classId) => ({
    backgroundColor: classColorFor(classId),
    color: CLASS_COLOR_TEXT,
});

export { CLASS_COLORS, CLASS_COLOR_TEXT, classColorEntryFor, classColorFor, classColorStyle, hashString };
