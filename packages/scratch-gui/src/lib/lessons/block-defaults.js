// === Smalruby: This file is Smalruby-specific (initial values of the lesson palette blocks) ===
//
// チャレンジの allowedBlocks の項目は、opcode の文字列のほかに
//   { opcode, fields: {NAME: value}, inputs: {NAME: value} }
// の形でも書ける。fields / inputs はパレットに出すブロックの初期値（仕様の `[1 ▼]` や `(3)`）。
//   - fields: ブロックそのもののフィールド（「[1 ▼] キーが押されたとき」の KEY_OPTION など）
//   - inputs: 入力の影（shadow）のフィールド（数・文字・音や背景のメニュー）
// 値は文字列・数か、locale ごとの `{ja, 'ja-Hira', en}`（courses.js の localizeCode と同じ選び方）。
// 書かないブロックはツールボックスの初期値のまま。
import { localizeCode } from './courses';

/**
 * allowedBlocks の項目 1 つの opcode。
 * @param {?(string|object)} entry - opcode の文字列か `{opcode, fields, inputs}`。
 * @returns {?string} opcode。無ければ null。
 */
const allowedBlockOpcode = (entry) => {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry.opcode === 'string') return entry.opcode;
    return null;
};

const resolveValues = (values, locale) => {
    const resolved = {};
    Object.entries(values || {}).forEach(([name, value]) => {
        const text = typeof value === 'number' ? String(value) : localizeCode(value, locale);
        if (text !== null) resolved[name] = text;
    });
    return resolved;
};

/**
 * allowedBlocks から、初期値を持つブロックの初期値を opcode ごとに集める。
 * @param {?object} allowedBlocks - deck / チャレンジの `{category: [entry]}`。
 * @param {string} locale - いまの locale。
 * @returns {?object} `{opcode: {fields, inputs}}`（値は文字列）。初期値が 1 つも無ければ null。
 */
const allowedBlockDefaults = (allowedBlocks, locale) => {
    if (!allowedBlocks) return null;
    const defaults = {};
    Object.values(allowedBlocks).forEach((entries) => {
        if (!Array.isArray(entries)) return;
        entries.forEach((entry) => {
            if (!entry || typeof entry !== 'object' || !allowedBlockOpcode(entry)) return;
            const fields = resolveValues(entry.fields, locale);
            const inputs = resolveValues(entry.inputs, locale);
            if (Object.keys(fields).length === 0 && Object.keys(inputs).length === 0) return;
            defaults[entry.opcode] = { fields, inputs };
        });
    });
    return Object.keys(defaults).length > 0 ? defaults : null;
};

const childrenNamed = (element, tag, name) =>
    Array.from(element.children).filter((c) => c.tagName.toLowerCase() === tag && c.getAttribute('name') === name);

/**
 * ブロックの要素 1 つに初期値を入れる（要素を書きかえる）。
 * @param {Element} block - `<block>` の要素。
 * @param {{fields: object, inputs: object}} def - そのブロックの初期値。
 */
const applyToBlock = (block, def) => {
    Object.entries(def.fields || {}).forEach(([name, value]) => {
        let field = childrenNamed(block, 'field', name)[0];
        if (!field) {
            // ツールボックスの XML に書いていないフィールド（ブロック定義の既定を使うもの）は足す
            field = block.ownerDocument.createElementNS(block.namespaceURI, 'field');
            field.setAttribute('name', name);
            block.insertBefore(field, block.firstChild);
        }
        field.textContent = value;
    });
    Object.entries(def.inputs || {}).forEach(([name, value]) => {
        const input = childrenNamed(block, 'value', name)[0];
        const shadow = input && Array.from(input.children).find((c) => c.tagName.toLowerCase() === 'shadow');
        const field = shadow && Array.from(shadow.children).find((c) => c.tagName.toLowerCase() === 'field');
        // 影の無い入力（「もし」の六角形の穴など）は、どの影を置くか決められないので何もしない
        if (field) field.textContent = value;
    });
};

const applyToElement = (element, defaults) => {
    if ((element.tagName || '').toLowerCase() !== 'block') return;
    const def = defaults[element.getAttribute('type')];
    if (def) applyToBlock(element, def);
};

/**
 * ツールボックスの XML の、カテゴリ直下のブロックに初期値を入れる。
 * @param {string} xml - makeToolboxXML の XML。
 * @param {?object} defaults - allowedBlockDefaults の戻り値。
 * @returns {string} 初期値を入れた XML。初期値が無い・XML が読めないときは xml のまま。
 */
const applyBlockDefaultsToToolboxXml = (xml, defaults) => {
    if (!defaults || typeof xml !== 'string') return xml;
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return xml;
    Array.from(doc.getElementsByTagName('category')).forEach((category) =>
        Array.from(category.children).forEach((element) => applyToElement(element, defaults)),
    );
    return new XMLSerializer().serializeToString(doc);
};

/**
 * 動的カテゴリ（変数・ブロック定義）の flyout の中身に初期値を入れる。
 * @param {Array.<Element>} xmlList - カテゴリのコールバックが返す要素の配列。
 * @param {?object} defaults - allowedBlockDefaults の戻り値。
 * @returns {Array.<Element>} xmlList（要素を書きかえて返す）。
 */
const applyBlockDefaultsToElements = (xmlList, defaults) => {
    if (defaults && Array.isArray(xmlList)) xmlList.forEach((element) => applyToElement(element, defaults));
    return xmlList;
};

export { allowedBlockDefaults, allowedBlockOpcode, applyBlockDefaultsToElements, applyBlockDefaultsToToolboxXml };
