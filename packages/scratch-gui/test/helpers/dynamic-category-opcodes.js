// allowedBlocks で「変数」「ブロック定義」の動的カテゴリを絞るとき、入れるプログラム（code・ヒントの
// ブロック）が使うブロックが allowedBlocks に入っているかを確かめるための道具。
// レッスンのチャレンジ（test/unit/lib/lessons/challenge-dynamic-categories.test.js）で使う。
import {
    LIST_OPCODES,
    PROCEDURE_OPCODES,
    VARIABLE_OPCODES,
    allowedBlocksToIds,
} from '../../src/lib/lesson-dynamic-categories';
import { procedureNamesInCode } from '../../src/lib/lessons/hint-blocks';
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

const convertedOpcodes = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: 2, validateAssets: false });
    const res = await converter.targetCodeToBlocks(makeTarget(), code);
    if (!res) throw new Error(`Conversion failed: ${JSON.stringify(converter.errors)}\n${code}`);
    return Object.values(converter._context.blocks).map((block) => block.opcode);
};

// `procedures` は作品に最初からある定義ブロックの名前（ヒントの Ruby は名前だけで呼ぶ）。空の定義を足して変換し、
// 足した定義の分のブロックは数えない
const usedDynamicOpcodes = async (code, procedures = []) => {
    const defined = procedureNamesInCode(code);
    const stubs = procedures
        .filter((name) => !defined.includes(name))
        .map((name) => `def ${name}\nend\n`)
        .join('\n');
    const opcodes = await convertedOpcodes(stubs ? `${stubs}\n${code}` : code);
    const stubOpcodes = stubs ? new Set(await convertedOpcodes(stubs)) : new Set();
    return [...new Set(opcodes.filter((opcode) => DYNAMIC_OPCODES.has(opcode) && !stubOpcodes.has(opcode)))].sort();
};

// チャレンジの code / blocks は locale ごとのオブジェクト（{ja, 'ja-Hira', en}）でもよいので、全部の locale を見る
const rubyByLocale = (value) => {
    if (typeof value === 'string') return [[null, value]];
    return value && typeof value === 'object' ? Object.entries(value) : [];
};

const localeCode = (value, locale) => {
    if (typeof value === 'string') return value;
    return value && typeof value === 'object' && locale ? value[locale] || '' : '';
};

// 最初から入っているプログラム（setup.code）にあるかたまり（空の行で分けた def・スクリプト）は、生徒がパレットから
// 置かないので除く（「ことばを予想する AI」のできあがりの AI）
const withoutGiven = (code, given) =>
    given
        ? code
              .split(/\n\s*\n/)
              .filter((chunk) => !given.includes(chunk.trim()))
              .join('\n\n')
        : code;

const codesOf = (item) => {
    const codes = [];
    const setupCode = item.setup && item.setup.code;
    const proceduresOf = (locale) => procedureNamesInCode(localeCode(setupCode, locale));
    rubyByLocale(item.code).forEach(([locale, code]) =>
        codes.push({ code: withoutGiven(code, localeCode(setupCode, locale)), procedures: proceduresOf(locale) }),
    );
    (item.spriteCodes || []).forEach((sc) => rubyByLocale(sc.code).forEach(([, code]) => codes.push({ code })));
    (item.steps || []).forEach((step) => {
        // codeType: 'blocks' 以外（Ruby タブで写すコードなど）も、コードタブに切り替えたら同じブロックになる
        if (typeof step.code === 'string') codes.push({ code: step.code });
        // チャレンジのヒントの吹き出しに描くブロック（パレットから探すブロック）
        rubyByLocale(step.blocks).forEach(([locale, code]) => codes.push({ code, procedures: proceduresOf(locale) }));
    });
    return codes.filter(({ code }) => code.trim() !== '');
};

/**
 * item（deck かチャレンジ）のプログラムが使う動的カテゴリのブロックのうち、allowedBlocks に無いもの。
 * @param {object} item - allowedBlocks と code / spriteCodes / steps を持つ deck かチャレンジ。
 * @returns {Promise<string[]>} 足りない opcode（並べたもの）。
 */
const missingDynamicOpcodes = async (item) => {
    const allowed = allowedBlocksToIds(item.allowedBlocks);
    const missing = new Set();
    for (const { code, procedures } of codesOf(item)) {
        (await usedDynamicOpcodes(code, procedures)).forEach((opcode) => {
            if (!allowed.includes(opcode)) missing.add(opcode);
        });
    }
    return [...missing].sort();
};

export { missingDynamicOpcodes };
