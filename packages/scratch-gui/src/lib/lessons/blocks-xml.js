// VM 形式のブロック（Ruby → ブロック変換の出力 `converter.blocks`）を Blockly が読める XML に
// する。scratch-vm の Blocks#toXML と同じ形だが、VM の target に入れずに描くため（ヒントの
// 吹き出しの読み取り専用ワークスペース）ここで純粋関数として持つ。コメントは描かない。

const XML_NS = 'http://www.w3.org/1999/xhtml';

const escapeXml = (value) =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const mutationToXml = (mutation) => {
    let xml = `<${mutation.tagName}`;
    Object.keys(mutation).forEach((prop) => {
        if (prop === 'children' || prop === 'tagName') return;
        const value = prop === 'blockInfo' ? JSON.stringify(mutation[prop]) : mutation[prop];
        xml += ` ${prop}="${escapeXml(value)}"`;
    });
    xml += '>';
    (mutation.children || []).forEach((child) => {
        xml += mutationToXml(child);
    });
    return `${xml}</${mutation.tagName}>`;
};

const hasBlock = (blocks, id) => Object.prototype.hasOwnProperty.call(blocks, id);

const blockToXml = (blocks, blockId) => {
    const block = blocks[blockId];
    // 変換の出力には無いブロックを指す next / input が残ることがある（scratch-vm と同じく無視）
    if (!block) return '';
    const tagName = block.shadow ? 'shadow' : 'block';
    let xml = `<${tagName} id="${escapeXml(block.id)}" type="${escapeXml(block.opcode)}">`;
    if (block.mutation) xml += mutationToXml(block.mutation);
    Object.keys(block.inputs || {}).forEach((name) => {
        const input = block.inputs[name];
        if (!input.block && !input.shadow) return;
        xml += `<value name="${escapeXml(input.name)}">`;
        if (input.block) xml += blockToXml(blocks, input.block);
        // 隠れたシャドウ（ブロックが乗っている入力）は後ろに書く
        if (input.shadow && input.shadow !== input.block) xml += blockToXml(blocks, input.shadow);
        xml += '</value>';
    });
    Object.keys(block.fields || {}).forEach((name) => {
        const field = block.fields[name];
        xml += `<field name="${escapeXml(field.name)}"`;
        if (field.id) xml += ` id="${escapeXml(field.id)}"`;
        if (typeof field.variableType === 'string') xml += ` variabletype="${escapeXml(field.variableType)}"`;
        xml += `>${typeof field.value === 'string' ? escapeXml(field.value) : field.value}</field>`;
    });
    if (block.next && hasBlock(blocks, block.next)) xml += `<next>${blockToXml(blocks, block.next)}</next>`;
    return `${xml}</${tagName}>`;
};

/**
 * ブロックの集合（id → VM 形式のブロック）を、先頭のブロック（`topLevel` で shadow でないもの）
 * ごとのスクリプトとして `<xml>` に書く。位置（x / y）は書かない（描く側が並べる）。
 * @param {?object} blocks - `converter.blocks` と同じ形。
 * @returns {string} Blockly の `<xml>` 文字列。
 */
export const blocksToXml = (blocks) => {
    const all = blocks || {};
    const scripts = Object.keys(all)
        .filter((id) => all[id].topLevel && !all[id].shadow)
        .map((id) => blockToXml(all, id))
        .join('');
    return `<xml xmlns="${XML_NS}">${scripts}</xml>`;
};

// `false` の Ruby の印（ruby-to-blocks-converter の visitFalseNode が付けるコメント）
const FALSE_LITERAL_COMMENT = /^@ruby:literal:false:/;

/**
 * 条件の穴に入った `false`（変換では「0 < 0」のブロックになる）を外して、空の穴にする。
 * ブロック → Ruby は空の穴を `if false` と書くので、ヒントの吹き出しでは `if false` を
 * 「もし <  > なら」（空の穴）として描く。外したブロックとその影も集合から消す。
 * @param {?object} blocks - `converter.blocks` と同じ形（変更しない）。
 * @param {?object} comments - 変換のコメント（コメント id → `{text}`）。
 * @returns {object} 空の穴にしたブロックの集合。
 */
export const emptyFalseConditions = (blocks, comments) => {
    const all = { ...(blocks || {}) };
    const isFalseLiteral = (block) => {
        const comment = block && block.comment && comments ? comments[block.comment] : null;
        return Boolean(comment) && FALSE_LITERAL_COMMENT.test(comment.text || '');
    };
    const remove = (id) => {
        const block = all[id];
        if (!block) return;
        delete all[id];
        Object.values(block.inputs || {}).forEach((input) => {
            if (input.block) remove(input.block);
            if (input.shadow && input.shadow !== input.block) remove(input.shadow);
        });
    };
    Object.keys(all).forEach((id) => {
        const block = all[id];
        const condition = block && block.inputs && block.inputs.CONDITION;
        if (!condition || !isFalseLiteral(all[condition.block])) return;
        const inputs = { ...block.inputs };
        delete inputs.CONDITION;
        all[id] = { ...block, inputs };
        remove(condition.block);
    });
    return all;
};
