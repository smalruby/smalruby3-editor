// ヒントの吹き出しに描くブロックを、Ruby（チャレンジの `steps[].blocks`）から作る。
// 変換はいまの `code` と同じ Ruby → ブロック変換（ruby-to-blocks-converter）で、作った
// ブロックは VM の target には入れず、Blockly の XML にして読み取り専用ワークスペースに描く。

import RubyToBlocksConverter from '../ruby-to-blocks-converter';
import { blocksToXml } from './blocks-xml';

/**
 * Ruby をブロックの XML にする。
 * @param {?object} vm - Scratch VM（変数・拡張機能の参照に使う。null でもよい）。
 * @param {?object} target - 変換の文脈にする target（スプライトかステージ。null でもよい）。
 * @param {string} code - Ruby のコード。
 * @param {?object} intl - react-intl の intl（エラー文言の翻訳。null でもよい）。
 * @param {object} [options] - 変換のオプション（`version` = Ruby のバージョン）。
 * @returns {Promise<{xml: ?string, errors: Array<object>}>} 変換できたら `xml`、できなければ `errors`。
 */
export const rubyToBlocksXml = async (vm, target, code, intl, options = { version: '2' }) => {
    const converter = new RubyToBlocksConverter(vm, options);
    if (intl) converter.setTranslatorFunction(intl.formatMessage);
    const ok = await converter.targetCodeToBlocks(target, code);
    if (!ok) return { xml: null, errors: converter.errors };
    return { xml: blocksToXml(converter.blocks), errors: [] };
};
