// 既存のチュートリアル deck とレッスンのチャレンジで、入れるプログラム（steps の code・deck の code）を
// ブロックにしたとき使う「変数」「ブロック定義」カテゴリのブロックが allowedBlocks に入っているか。
// 入っていないと、allowedBlocks による動的カテゴリの絞り込み（lesson-dynamic-categories.js）で
// そのカテゴリや中のブロックが消え、チュートリアルを進められなくなる。
import { LIST_OPCODES, PROCEDURE_OPCODES, VARIABLE_OPCODES } from '../../../src/lib/lesson-dynamic-categories';
import { COURSES } from '../../../src/lib/lessons/courses';
import decks from '../../../src/lib/libraries/decks/index.jsx';
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

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

const allowedIds = (allowedBlocks) => Object.values(allowedBlocks).flat();

const codesOf = (item) => {
    const codes = [];
    if (typeof item.code === 'string') codes.push(item.code);
    (item.spriteCodes || []).forEach((sc) => typeof sc.code === 'string' && codes.push(sc.code));
    (item.steps || []).forEach((step) => {
        // codeType: 'blocks' 以外（Ruby タブで写すコードなど）も、コードタブに切り替えたら同じブロックになる
        if (typeof step.code === 'string') codes.push(step.code);
        // チャレンジのヒントの吹き出しに描くブロック（パレットから探すブロック）
        if (typeof step.blocks === 'string') codes.push(step.blocks);
    });
    return codes;
};

const deckCases = Object.entries(decks)
    .filter(([, deck]) => deck.allowedBlocks)
    .map(([id, deck]) => [`deck ${id}`, deck]);

const challengeCases = [];
Object.values(COURSES || {}).forEach((course) =>
    (course.lessons || []).forEach((lesson) =>
        (lesson.challenges || []).forEach((challenge) => {
            if (challenge.allowedBlocks) challengeCases.push([`challenge ${challenge.id}`, challenge]);
        }),
    ),
);

describe('allowedBlocks covers the variables / my blocks used by the code', () => {
    test('there are decks and challenges to check', () => {
        expect(deckCases.length).toBeGreaterThan(0);
        expect(challengeCases.length).toBeGreaterThan(0);
    });

    test.each([...deckCases, ...challengeCases])('%s', async (name, item) => {
        const allowed = allowedIds(item.allowedBlocks);
        const missing = new Set();
        for (const code of codesOf(item)) {
            (await usedDynamicOpcodes(code)).forEach((opcode) => {
                if (!allowed.includes(opcode)) missing.add(opcode);
            });
        }
        expect([...missing].sort()).toEqual([]);
    });
});
