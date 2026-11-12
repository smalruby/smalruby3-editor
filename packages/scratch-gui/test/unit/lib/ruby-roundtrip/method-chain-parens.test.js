// === Smalruby: This file is Smalruby-specific (method chain round trip without extra parentheses) ===
/**
 * A call on the result of a call: `@a.length.round` is `(@a.length).round` in Ruby, so the
 * receiver needs no parentheses. The generators asked for the receiver with the order of the
 * call itself, so they came back as `(@a.length).round` (issue #1675). Each case also converts
 * the generated Ruby once more and checks that the blocks are the same as the blocks of the
 * original code, so dropping the parentheses does not change the meaning. Parentheses around a
 * receiver that is an operator expression (`(a + 1).to_s`) change the meaning and stay.
 */
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

/**
 * The blocks of the target as trees without ids, so two conversions can be compared.
 * @param {object} target - The target the converter wrote to.
 * @returns {Array<object>} One tree per script, in order.
 */
const blockTrees = (target) => {
    const blocks = target.blocks._blocks;
    const tree = (id) => {
        const block = blocks[id];
        if (!block) return null;
        const inputs = {};
        Object.keys(block.inputs || {})
            .sort()
            .forEach((name) => {
                inputs[name] = tree(block.inputs[name].block);
            });
        const fields = {};
        Object.keys(block.fields || {})
            .sort()
            .forEach((name) => {
                fields[name] = block.fields[name].value;
            });
        const comment = block.comment ? target.comments[block.comment]?.text : undefined;
        return { opcode: block.opcode, fields, inputs, comment, next: tree(block.next) };
    };
    return Object.keys(blocks)
        .filter((id) => blocks[id].topLevel)
        .map(tree);
};

const convert = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    setupRubyGenerator();
    const converter = makeConverter(target, runtime, { version: '2' });
    const ruby = await rubyToBlocksToRuby(converter, target, code);
    return { ruby, trees: blockTrees(target) };
};

/**
 * The generated Ruby is the source itself, and converting it again gives the same blocks.
 * @param {string} code - The Ruby source.
 */
const expectStableRoundTrip = async (code) => {
    const first = await convert(code);
    expect(first.ruby).toBe(code);
    const second = await convert(first.ruby);
    expect(second.trees).toEqual(first.trees);
};

describe('Ruby Roundtrip: method chain without extra parentheses (issue #1675)', () => {
    test.each([
        ['length.round', '@a = ["x"]\nsay(@a.length.round)'],
        ['index.to_s', '@a = ["x"]\nsay(@a.index("x").to_s)'],
        ['keys.length', '@h = {"x" => 1}\nsay(@h.keys.length)'],
        ['element.to_s', '@a = ["x"]\nsay(@a[0].to_s)'],
        ['index.to_s.length', '@a = ["x"]\nsay(@a.index("x").to_s.length)'],
        ['answer.length', 'say(answer.length)'],
        ['values.length', '@h = {"x" => 1}\nsay(@h.values.length)'],
        ['length.to_s', '@a = ["x"]\nsay(@a.length.to_s)'],
        ['to_s.length', 'a = 1\nsay(a.to_s.length)'],
        ['element.length', '@a = ["x"]\nsay(@a[0].length)'],
        ['to_i.to_s', 'a = 1\nsay(a.to_i.to_s)'],
        ['abs of call', '@a = ["x"]\nsay(@a.length.abs)'],
        ['reverse.length', 'a = "xy"\nsay(a.reverse.length)'],
        ['letter of call', '@a = ["xy"]\nsay(@a[0][1])'],
        ['bare chain', '@a = ["x"]\n\n@a.length.round'],
        ['abs then +', 'a = 1\nsay(a.abs + 1)'],
        ['10 ** call', '@a = ["x"]\nsay(10 ** @a.length)'],
        ['times on call', '@a = ["x"]\n@a.length.times do\n  move(10)\nend'],
        ['each on keys', '@h = {"x" => 1}\n@h.keys.each do |k|\n  say(k)\nend'],
    ])('%s', async (_name, code) => {
        await expectStableRoundTrip(code);
    });

    // Parentheses around an operator expression change the meaning.
    test.each([
        ['+ then to_s', 'a = 1\nsay((a + 1).to_s)'],
        ['- then round', 'a = 1\nsay((a - 1).round)'],
        ['* then length', 'a = 1\nsay((a * 2).to_s.length)'],
        ['+ then abs', 'a = 1\nsay((a + 1).abs)'],
        ['+ then floor', 'a = 1\nsay((a + 1).floor)'],
        ['** then round', 'a = 1\nsay((10 ** a).round)'],
        ['10 ** +', 'a = 1\nsay(10 ** (a + 1))'],
        ['string * then length', 'a = "x"\nsay((a * 3).length)'],
        ['string + then length', 'a = "x"\nsay((a + "y").length)'],
        ['+ then times', 'a = 1\n(a + 1).times do\n  move(10)\nend'],
    ])('keeps parentheses: %s', async (_name, code) => {
        await expectStableRoundTrip(code);
    });

    // Every receiver with every call.
    const receivers = ['@a.length', '@a[0]', '@a.index("x")', 'a.to_s', '(a + 1)', '(a * 2)', '(a - 1)', '(a / 2)'];
    const calls = ['.to_s', '.round', '.abs', '.floor', '.to_s.length'];
    test.each(receivers.flatMap((receiver) => calls.map((call) => `${receiver}${call}`)))(
        'combination %s',
        async (expr) => {
            await expectStableRoundTrip(`@a = ["x"]\na = 1\nsay(${expr})`);
        },
    );
});
