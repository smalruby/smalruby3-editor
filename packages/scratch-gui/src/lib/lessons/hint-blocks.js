// ヒントの吹き出しに描くブロックを、Ruby（チャレンジの `steps[].blocks`）から作る。
// 変換はいまの `code` と同じ Ruby → ブロック変換（ruby-to-blocks-converter）で、作った
// ブロックは VM の target には入れず、Blockly の XML にして読み取り専用ワークスペースに描く。
import RubyToBlocksConverter from '../ruby-to-blocks-converter';
import { blocksToXml } from './blocks-xml';

// 作品にある、引数の無い定義ブロックの名前（「ことばを予想する AI」の「文をつくる」など）
const targetProcedureNames = (target) => {
    const blocks = target && target.blocks && target.blocks._blocks;
    if (!blocks) return [];
    return Object.values(blocks)
        .filter((b) => b.opcode === 'procedures_prototype' && b.mutation && !/ %[sbn]/.test(b.mutation.proccode))
        .map((b) => b.mutation.proccode);
};

/**
 * Ruby の中で定義している、引数の無い定義ブロックの名前（`def 名前` / `without_screen_refresh def 名前`）。
 * 作品に最初から入れるプログラム（`setup.code`）から、ヒントの Ruby が呼べる名前を集めるのに使う。
 * @param {?string} code - Ruby のコード。
 * @returns {Array<string>} 名前。
 */
export const procedureNamesInCode = (code) =>
    Array.from(String(code || '').matchAll(/^\s*(?:without_screen_refresh\s+)?def\s+([^\s(]+)\s*$/gm), (m) => m[1]);

// ヒントの Ruby が自分で定義していない名前だけ、空の定義を前に足す（呼び出しを定義ブロックの呼び出しとして変換するため）
// Ruby のメソッドの名前にできるか（空白などを含む名前の定義ブロックは、名前だけで呼ぶ Ruby にならないので足さない）
const RUBY_METHOD_NAME = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const procedureStubs = (names, code) => {
    const defined = procedureNamesInCode(code);
    return [...new Set(names)]
        .filter((name) => RUBY_METHOD_NAME.test(name) && code.includes(name) && !defined.includes(name))
        .map((name) => `def ${name}\nend\n`)
        .join('\n');
};

// 定義（ハット）の下にあるブロックを除く（足した空の定義は描かない）
const withoutDefinitions = (blocks) => {
    const topOf = (block) => {
        let current = block;
        while (current && current.parent && blocks[current.parent]) current = blocks[current.parent];
        return current;
    };
    return Object.fromEntries(
        Object.entries(blocks).filter(([, block]) => topOf(block).opcode !== 'procedures_definition'),
    );
};

/**
 * Ruby をブロックの XML にする。
 * 既定では音・コスチューム・背景の名前が作品に無くてもエラーにしない（ヒントは「Owl の音を鳴らす」の
 * ように、これから足すものを描く）。`options.validateAssets: true` なら確かめる（「プログラムを入れる」の
 * 前に、入れたら変換に失敗するかを見る）。
 * 作品にある定義ブロック（引数の無いもの）の呼び出しも描ける（ヒントの Ruby には定義を書かずに「文をつくる」と
 * 書く）。名前は `options.procedures`、無ければ `target` の定義ブロックから取る。
 * @param {?object} vm - Scratch VM（変数・拡張機能の参照に使う。null でもよい）。
 * @param {?object} target - 変換の文脈にする target（スプライトかステージ。null でもよい）。
 * @param {string} code - Ruby のコード。
 * @param {?object} intl - react-intl の intl（エラー文言の翻訳。null でもよい）。
 * @param {object} [options] - 変換のオプション（`version` = Ruby のバージョン、`validateAssets` = 音などを確かめるか、
 *   `procedures` = 呼べる定義ブロックの名前）。
 * @returns {Promise<{xml: ?string, errors: Array<object>}>} 変換できたら `xml`、できなければ `errors`。
 */
export const rubyToBlocksXml = async (vm, target, code, intl, options = { version: '2' }) => {
    const { procedures, ...converterOptions } = options;
    const stubs = procedureStubs(procedures || targetProcedureNames(target), code);
    const converter = new RubyToBlocksConverter(vm, { validateAssets: false, ...converterOptions });
    if (intl) converter.setTranslatorFunction(intl.formatMessage);
    const ok = await converter.targetCodeToBlocks(target, stubs ? `${stubs}\n${code}` : code);
    if (!ok) return { xml: null, errors: converter.errors };
    // 条件の穴の `false` は変換で空の穴になる（`if false` = 「もし <  > なら」）
    return { xml: blocksToXml(stubs ? withoutDefinitions(converter.blocks) : converter.blocks), errors: [] };
};
