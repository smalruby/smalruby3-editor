// allowedBlocks で「変数」「ブロック定義」の動的カテゴリを絞るとき、入れるプログラム（code・ヒントの
// ブロック）が使うブロックが allowedBlocks に入っているかを確かめるための道具。
// レッスンのチャレンジ（test/unit/lib/lessons/challenge-dynamic-categories.test.js）で使う。
import {
    LIST_OPCODES,
    PROCEDURE_OPCODES,
    VARIABLE_OPCODES,
    allowedBlocksToIds,
} from '../../src/lib/lesson-dynamic-categories';
import RubyToBlocksConverter from '../../src/lib/ruby-to-blocks-converter';

// flyout に並ぶ動的カテゴリのブロック（procedures_prototype は定義の中身なので flyout には無い）
const DYNAMIC_OPCODES = new Set([
    ...VARIABLE_OPCODES,
    ...LIST_OPCODES,
    ...PROCEDURE_OPCODES.filter((opcode) => opcode !== 'procedures_prototype'),
]);

const makeTarget = () => ({
    isStage: false,
    variables: {},
    comments: {},
    getCostumes: () => [{ name: 'costume1' }],
    getSounds: () => [],
    lookupVariableByNameAndType(name, type) {
        return Object.values(this.variables).find((v) => v.name === name && v.type === type);
    },
});

const usedDynamicOpcodes = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: 2, validateAssets: false });
    const res = await converter.targetCodeToBlocks(makeTarget(), code);
    if (!res) throw new Error(`Conversion failed: ${JSON.stringify(converter.errors)}\n${code}`);
    const opcodes = Object.values(converter._context.blocks).map((block) => block.opcode);
    return [...new Set(opcodes.filter((opcode) => DYNAMIC_OPCODES.has(opcode)))].sort();
};

// チャレンジの code / blocks は locale ごとのオブジェクト（{ja, 'ja-Hira', en}）でもよいので、全部の locale を見る
const rubyOf = (value) => {
    if (typeof value === 'string') return [value];
    return value && typeof value === 'object' ? Object.values(value) : [];
};

const codesOf = (item) => {
    const codes = [];
    codes.push(...rubyOf(item.code));
    (item.spriteCodes || []).forEach((sc) => codes.push(...rubyOf(sc.code)));
    (item.steps || []).forEach((step) => {
        // codeType: 'blocks' 以外（Ruby タブで写すコードなど）も、コードタブに切り替えたら同じブロックになる
        if (typeof step.code === 'string') codes.push(step.code);
        // チャレンジのヒントの吹き出しに描くブロック（パレットから探すブロック）
        codes.push(...rubyOf(step.blocks));
    });
    return codes;
};

/**
 * item（deck かチャレンジ）のプログラムが使う動的カテゴリのブロックのうち、allowedBlocks に無いもの。
 * @param {object} item - allowedBlocks と code / spriteCodes / steps を持つ deck かチャレンジ。
 * @returns {Promise<string[]>} 足りない opcode（並べたもの）。
 */
const missingDynamicOpcodes = async (item) => {
    const allowed = allowedBlocksToIds(item.allowedBlocks);
    const missing = new Set();
    for (const code of codesOf(item)) {
        (await usedDynamicOpcodes(code)).forEach((opcode) => {
            if (!allowed.includes(opcode)) missing.add(opcode);
        });
    }
    return [...missing].sort();
};

export { missingDynamicOpcodes };
