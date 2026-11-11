// === Smalruby: This file is Smalruby-specific (lesson / tutorial allowedBlocks for dynamic categories) ===
//
// 「変数」「ブロック定義」は scratch-blocks が flyout を開くたびに中身を作る動的カテゴリ
// （toolbox XML では `custom="VARIABLE"` / `custom="PROCEDURE"` の空の category）なので、
// only_blocks の絞り込み（make-toolbox-xml の filterBlocks）が効かない。
// レッスンのチャレンジ・チュートリアルの allowedBlocks で絞るときは、
//   - カテゴリそのものを出すか（toolbox XML 側・isDynamicCategoryAllowed）
//   - flyout の中身をどこまで出すか（カテゴリのコールバック側・filterDynamicCategoryXmlList）
// をここで決める。
import { allowedBlockOpcode } from './lessons/block-defaults';

/** 変数カテゴリのうち、ふつうの変数のブロック。 */
const VARIABLE_OPCODES = [
    'data_variable',
    'data_setvariableto',
    'data_changevariableby',
    'data_showvariable',
    'data_hidevariable',
];

/** 変数カテゴリのうち、リストのブロック。 */
const LIST_OPCODES = [
    'data_listcontents',
    'data_addtolist',
    'data_deleteoflist',
    'data_deletealloflist',
    'data_insertatlist',
    'data_replaceitemoflist',
    'data_itemoflist',
    'data_itemnumoflist',
    'data_lengthoflist',
    'data_listcontainsitem',
    'data_showlist',
    'data_hidelist',
];

/** 「ブロック定義」カテゴリのブロック。 */
const PROCEDURE_OPCODES = ['procedures_definition', 'procedures_prototype', 'procedures_call'];

const CATEGORY_OPCODES = {
    variables: [...VARIABLE_OPCODES, ...LIST_OPCODES],
    myBlocks: PROCEDURE_OPCODES,
};

/**
 * allowedBlocks（deck / チャレンジの `{category: [opcode]}`）を opcode の配列にする。項目は opcode の
 * 文字列か、初期値を持つ `{opcode, fields, inputs}`（lessons/block-defaults.js）。
 * @param {?object} allowedBlocks - deck と同じ形の allowedBlocks。
 * @returns {?Array.<string>} opcode の配列。allowedBlocks が無ければ null。
 */
const allowedBlocksToIds = (allowedBlocks) => {
    if (!allowedBlocks) return null;
    const ids = [];
    Object.values(allowedBlocks).forEach((blocks) => {
        if (Array.isArray(blocks)) ids.push(...blocks.map(allowedBlockOpcode).filter(Boolean));
    });
    return ids;
};

const anyAllowed = (opcodes, allowedIds) => opcodes.some((opcode) => allowedIds.includes(opcode));

/**
 * 動的カテゴリをパレットに出すか。そのカテゴリのブロックが 1 つでも allowedBlocks にあれば出す。
 * @param {string} category - `variables` か `myBlocks`。
 * @param {?Array.<string>} allowedIds - 許可された opcode。null なら絞り込みなし。
 * @returns {boolean} 出すなら true。
 */
const isDynamicCategoryAllowed = (category, allowedIds) => {
    if (!allowedIds) return true;
    const opcodes = CATEGORY_OPCODES[category];
    if (!opcodes) return true;
    return anyAllowed(opcodes, allowedIds);
};

/**
 * flyout の要素 1 つを残すか。
 * @param {Element} element - scratch-blocks のカテゴリコールバックが返した要素。
 * @param {Array.<string>} allowedIds - 許可された opcode。
 * @returns {boolean} 残すなら true。
 */
const keepFlyoutElement = (element, allowedIds) => {
    const tag = (element.tagName || '').toLowerCase();
    if (tag === 'block') {
        const type = element.getAttribute('type');
        // 変数・リストのレポーターは、モニターのチェックボックスを持つ。scratch-blocks は作った
        // 変数・リストをこのチェックボックスでステージに出すので、「作る」ボタンを出すなら一緒に残す
        // （残さないと、リストを作ってもステージに箱が出ない）
        if (type === 'data_variable') return anyAllowed(VARIABLE_OPCODES, allowedIds);
        if (type === 'data_listcontents') return anyAllowed(LIST_OPCODES, allowedIds);
        return allowedIds.includes(type);
    }
    if (tag === 'button') {
        // 「変数を作る」は変数のブロック、「リストを作る」はリストのブロックが
        // 1 つでもあれば出す。作らないと変数のブロックが flyout に並ばないため。
        switch (element.getAttribute('callbackKey')) {
            case 'CREATE_VARIABLE':
                return anyAllowed(VARIABLE_OPCODES, allowedIds);
            case 'CREATE_LIST':
                return anyAllowed(LIST_OPCODES, allowedIds);
            case 'CREATE_PROCEDURE':
                return anyAllowed(PROCEDURE_OPCODES, allowedIds);
            default:
                return true;
        }
    }
    // sep / label などはそのまま
    return true;
};

/**
 * 動的カテゴリのコールバックが返した flyout の中身を allowedBlocks で絞る。
 * 先頭・末尾・連続する sep は落とす。
 * @param {Array.<Element>} xmlList - getVariablesCategory / getProceduresCategory の戻り値。
 * @param {?Array.<string>} allowedIds - 許可された opcode。null なら絞らない。
 * @returns {Array.<Element>} 絞った flyout の中身。
 */
const filterDynamicCategoryXmlList = (xmlList, allowedIds) => {
    if (!allowedIds || !Array.isArray(xmlList)) return xmlList;
    const isSep = (element) => (element.tagName || '').toLowerCase() === 'sep';
    const result = [];
    xmlList
        .filter((element) => keepFlyoutElement(element, allowedIds))
        .forEach((element) => {
            // 先頭と、続けて並ぶ sep は落とす
            if (isSep(element) && (result.length === 0 || isSep(result[result.length - 1]))) return;
            result.push(element);
        });
    // 末尾の sep も落とす
    while (result.length > 0 && isSep(result[result.length - 1])) result.pop();
    return result;
};

export {
    LIST_OPCODES,
    PROCEDURE_OPCODES,
    VARIABLE_OPCODES,
    allowedBlocksToIds,
    filterDynamicCategoryXmlList,
    isDynamicCategoryAllowed,
};
