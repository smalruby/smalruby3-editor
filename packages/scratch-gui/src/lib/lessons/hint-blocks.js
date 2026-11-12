// ヒントの吹き出しに描くブロックを、Ruby（チャレンジの `steps[].blocks`）から作る。
// 変換はいまの `code` と同じ Ruby → ブロック変換（ruby-to-blocks-converter）で、作った
// ブロックは VM の target には入れず、Blockly の XML にして読み取り専用ワークスペースに描く。
import RubyToBlocksConverter from '../ruby-to-blocks-converter';
import { blocksToXml } from './blocks-xml';

/**
 * Ruby をブロックの XML にする。
 * 既定では音・コスチューム・背景の名前が作品に無くてもエラーにしない（ヒントは「Owl の音を鳴らす」の
 * ように、これから足すものを描く）。`options.validateAssets: true` なら確かめる（「プログラムを入れる」の
 * 前に、入れたら変換に失敗するかを見る）。
 * @param {?object} vm - Scratch VM（変数・拡張機能の参照に使う。null でもよい）。
 * @param {?object} target - 変換の文脈にする target（スプライトかステージ。null でもよい）。
 * @param {string} code - Ruby のコード。
 * @param {?object} intl - react-intl の intl（エラー文言の翻訳。null でもよい）。
 * @param {object} [options] - 変換のオプション（`version` = Ruby のバージョン、`validateAssets` = 音などを確かめるか）。
 * @returns {Promise<{xml: ?string, errors: Array<object>}>} 変換できたら `xml`、できなければ `errors`。
 */
export const rubyToBlocksXml = async (vm, target, code, intl, options = { version: '2' }) => {
    const converter = new RubyToBlocksConverter(vm, { validateAssets: false, ...options });
    if (intl) converter.setTranslatorFunction(intl.formatMessage);
    const ok = await converter.targetCodeToBlocks(target, code);
    if (!ok) return { xml: null, errors: converter.errors };
    // 条件の穴の `false` は変換で空の穴になる（`if false` = 「もし <  > なら」）
    return { xml: blocksToXml(converter.blocks), errors: [] };
};
