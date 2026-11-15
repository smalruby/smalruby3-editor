/**
 * `return nil` / `return :a` came back as written, but left a text block that no script reaches: the value
 * was made a text block and put in the input with a `0` shadow behind it, and that shadow was left over
 * (issue #1866). The value is now the text of the input itself, as `return ""` is.
 */
import dedent from 'dedent';
import { readBlocks } from '../../helpers/block-notation';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const RETURN_VARIABLE = '_return_foo_';

/**
 * The text in the input of the blocks that set the return variable of `foo` from `return`.
 * @param {object} target - The target the converter wrote to.
 * @returns {Array<string>} The texts, in no particular order.
 */
const returnTexts = (target) => {
    const blocks = target.blocks._blocks;
    return Object.values(blocks)
        .filter((b) => b.opcode === 'data_setvariableto' && b.fields.VARIABLE.value === RETURN_VARIABLE)
        .filter((b) => {
            const comment = b.comment && target.comments[b.comment];
            return comment && comment.text.startsWith('@ruby:syntax:return');
        })
        .map((b) => blocks[b.inputs.VALUE.block].fields.TEXT.value);
};

describe('Ruby Roundtrip: return nil / return :a leave no block behind', () => {
    test.each([
        ['return nil', 'def foo\n  return nil\nend', ['']],
        ['return :a', 'def foo\n  return :a\nend', ['a']],
        [
            'return nil and :b in one method',
            dedent`
                def foo(n)
                  return nil if n > 1
                  return :b
                end
            `,
            ['', 'b'],
        ],
        ['return (nil)', 'def foo\n  return (nil)\nend', ['']],
        ['return (:a)', 'def foo\n  return (:a)\nend', ['a']],
    ])('%s', async (_name, code, texts) => {
        const { target, stage, runtime } = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, { version: '2' });
        expect(await rubyToBlocksToRuby(converter, target, code)).toBe(code);
        expect(() => readBlocks(target, stage)).not.toThrow();
        expect(returnTexts(target).sort()).toEqual([...texts].sort());
    });
});
