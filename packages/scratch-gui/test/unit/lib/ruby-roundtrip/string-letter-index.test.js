import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    expectRoundTrip,
    makeConverter,
    makeSpriteTarget,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

// A string index that is a variable or an expression must survive the round trip.
// Ruby counts letters from 0 and the "letter (n) of" block from 1, so the index in the
// block is the Ruby index + 1, and the generator turns it back.
describe('Ruby Roundtrip: a variable or an expression as the index of a string', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test('a local variable as the index', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            i = 1
            say("abc"[i])
        `,
        );
    });

    test('an expression as the index', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            i = 1
            say("abc"[i + 1])
        `,
        );
    });

    test('a variable holding a string and a multiplication as the index', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            i = 1
            s = "abc"
            say(s[i])
            say(s[i * 2])
        `,
        );
    });

    test('a number as the index', async () => {
        await expectRoundTrip(converter, target, 'say("abc"[2])');
    });

    const convert = async (code) => {
        await converter.targetCodeToBlocks(target, code);
        await converter.applyTargetBlocks(target);
        return target.blocks._blocks;
    };

    test('the block counts the letter from 1', async () => {
        const blocks = await convert('i = 1\nsay("abc"[i])');
        const letterOf = Object.values(blocks).find((b) => b.opcode === 'operator_letter_of');
        const index = blocks[letterOf.inputs.LETTER.block];
        expect(index.opcode).toBe('operator_add');
        expect(Number(blocks[index.inputs.NUM2.block].fields.NUM.value)).toBe(1);
    });

    test('a block made in the block editor subtracts 1 from the letter', async () => {
        const blocks = await convert('i = 1\nsay("abc"[i])');
        const add = Object.values(blocks).find((b) => b.opcode === 'operator_add');
        // Without the mark, "letter (i + 1) of" is the same as a block made by hand.
        delete target.comments[add.comment];
        add.comment = null;
        RubyGenerator.currentTarget = target;
        const code = RubyGenerator.targetToCode(target, { version: '2' }).trim();
        expect(code).toBe('i = 1\nsay("abc"[(i + 1) - 1])');
    });
});
