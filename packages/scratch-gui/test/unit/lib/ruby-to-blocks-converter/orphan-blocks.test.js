/**
 * Ruby → Blocks must not leave a block that is attached to nothing (#1522).
 *
 * Such a block is not drawn on the workspace and is never turned back into Ruby, but it is
 * saved in the project. It used to come from:
 * - a local variable assignment (`a = false`): the value was converted twice (once while
 *   looking for a `a=` writer method), and the first result was left behind
 *   (`0 < 0` with an extra `@ruby:literal:false:N` comment);
 * - `wait` removed from a loop / `wait until`: its `text` block kept pointing at it;
 * - `case x`: the subject was converted once more than the number of `when`s.
 */
import dedent from 'dedent';

import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

/**
 * Describe the blocks and comments that are attached to nothing.
 * @param {object} blocks - Blocks by ID.
 * @param {object} comments - Comments by ID.
 * @returns {string[]} One line per problem (empty when there is none).
 */
const findOrphans = (blocks, comments) => {
    const problems = [];
    Object.values(blocks).forEach((b) => {
        if (b.parent && !blocks[b.parent]) {
            problems.push(`${b.opcode}: parent ${b.parent} does not exist`);
        } else if (!b.topLevel && !b.parent) {
            problems.push(`${b.opcode}: no parent and not top level`);
        } else if (b.parent) {
            const parent = blocks[b.parent];
            const referred =
                parent.next === b.id ||
                Object.values(parent.inputs).some((i) => i.block === b.id || i.shadow === b.id);
            if (!referred) problems.push(`${b.opcode}: ${parent.opcode} does not refer to it`);
        }
    });
    Object.values(comments).forEach((c) => {
        if (c.blockId && !blocks[c.blockId]) {
            problems.push(`comment "${c.text}": block ${c.blockId} does not exist`);
        }
    });
    return problems;
};

const convert = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    const converter = makeConverter(target, runtime, { version: '2' });
    const ruby = await rubyToBlocksToRuby(converter, target, code);
    return { converter, target, ruby };
};

const commentTexts = (converter) => Object.values(converter._context.comments).map((c) => c.text);

describe('RubyToBlocksConverter: no orphan blocks', () => {
    beforeEach(() => {
        setupRubyGenerator();
    });

    test.each([
        ['local variable = false', 'a = false'],
        ['local variable = true', 'a = true'],
        ['local variable = comparison', 'a = 1 < 2'],
        ['local variable = reporter', 'a = x'],
        ['local variable = nested reporters', 'a = (x + 1) * 2'],
        ['local variable = string method', 'a = "abc".length'],
        ['local variable read after assignment', 'a = false\nb = a'],
        ['global variable = false', '$g = false'],
        ['instance variable = false', '@i = false'],
        ['local variable op-assign', 'a = 1\na += x'],
        ['wait until', 'wait until x > 10'],
        [
            'wait in loop',
            dedent`
                loop do
                  move(10)
                  wait
                end
            `,
        ],
        [
            'wait in repeat',
            dedent`
                repeat(3) do
                  move(10)
                  wait
                end
            `,
        ],
        [
            'case',
            dedent`
                case x
                when 1
                  move(10)
                when 2
                  move(20)
                else
                  move(30)
                end
            `,
        ],
        [
            'case with a local variable',
            dedent`
                a = 1
                case a
                when 1
                  move(10)
                end
            `,
        ],
    ])('%s', async (_name, code) => {
        const { converter, target } = await convert(code);
        expect(findOrphans(converter._context.blocks, converter._context.comments)).toEqual([]);
        expect(findOrphans(target.blocks._blocks, target.comments)).toEqual([]);
    });

    test.each([
        ['a = false', '@ruby:literal:false:'],
        ['a = true', '@ruby:literal:true:'],
        ['$g = false', '@ruby:literal:false:'],
    ])('%s leaves exactly one literal comment', async (code, prefix) => {
        const { converter } = await convert(code);
        const literalComments = commentTexts(converter).filter((t) => t.startsWith(prefix));
        expect(literalComments).toEqual([`${prefix}1`]);
    });

    test('a case leaves one case comment per when and on the if blocks only', async () => {
        const { converter } = await convert(dedent`
            case x
            when 1
              move(10)
            end
        `);
        const caseComments = commentTexts(converter).filter((t) => t.startsWith('@ruby:syntax:case:'));
        // one on the `if` block, one on its `=` condition
        expect(caseComments).toHaveLength(2);
    });

    test('wait until has no SUBSTACK input', async () => {
        const { converter } = await convert('wait until x > 10');
        const [block] = Object.values(converter._context.blocks).filter(
            (b) => b.opcode === 'control_wait_until',
        );
        expect(Object.keys(block.inputs)).toEqual(['CONDITION']);
    });

    test('a local variable set from an argument that is later used as a boolean', async () => {
        // The first visit of `x` (looking for an `a=` writer) registered its argument block;
        // dropping that block must also drop its ID, or making `x` boolean reads undefined.
        const code = dedent`
            def foo(x)
              a = x
              if x
                move(10)
              end
            end
        `;
        const { converter, target, ruby } = await convert(code);
        expect(ruby).toBe(code);
        expect(findOrphans(converter._context.blocks, converter._context.comments)).toEqual([]);
        expect(findOrphans(target.blocks._blocks, target.comments)).toEqual([]);
    });

    describe('Ruby → Blocks → Ruby is unchanged', () => {
        test.each([
            'a = false',
            'a = true',
            'a = 1 < 2',
            'a = x',
            'a = false\nb = a',
            '$g = false',
            '@i = false',
            'wait until x > 10',
            dedent`
                loop do
                  move(10)
                  wait
                end
            `,
            dedent`
                case x
                when 1
                  move(10)
                else
                  move(30)
                end
            `,
        ])('%s', async (code) => {
            const { ruby } = await convert(code);
            expect(ruby).toBe(code);
        });
    });
});
