/**
 * "Item (k) of list" and "letter (k) of" ⇔ Ruby `[@k - 1]` (issue #2115).
 * A block made in the block editor with the index `k` is written `[@k - 1]` (Ruby counts from 0).
 * Converting `[@k - 1]` back must give the index `k` again, not "((k - 1) + 1)". The other
 * indexes keep the `+ 1` with `@ruby:array:index` (block notation: test/unit/helpers/block-notation.js).
 */
import dedent from 'dedent';
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const LIST_A = [
    'data_deletealloflist(LIST = @a) #"@ruby:array:literal:2"',
    'data_addtolist(LIST = @a, ITEM: "1") #"@ruby:array:literal:element"',
    'data_addtolist(LIST = @a, ITEM: "2") #"@ruby:array:literal:element"',
].join('\n');
const RUBY_A = '@a = [1, 2]';

const LIST_B = [
    'data_deletealloflist(LIST = @b) #"@ruby:array:literal:1"',
    'data_addtolist(LIST = @b, ITEM: "1") #"@ruby:array:literal:element"',
].join('\n');
const RUBY_B = '@b = [1]';

const SET_S = 'data_setvariableto(VARIABLE = @s, VALUE: "abc")';
const RUBY_S = '@s = "abc"';

const rows = (blocks, ruby) => ({ blocks, ruby });

defineBlockRubyTable(
    'An index written `x - 1` is the index x of the block',
    [
        rows(`${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: @k))`, `${RUBY_A}\nsay(@a[@k - 1])`),
        rows(`${LIST_A}\ndata_replaceitemoflist(LIST = @a, INDEX: @k, ITEM: "3")`, `${RUBY_A}\n@a[@k - 1] = 3`),
        rows(`${LIST_A}\ndata_insertatlist(LIST = @a, INDEX: @k, ITEM: "3")`, `${RUBY_A}\n@a.insert(@k - 1, 3)`),
        rows(`${LIST_A}\ndata_deleteoflist(LIST = @a, INDEX: @k)`, `${RUBY_A}\n@a.delete_at(@k - 1)`),
        rows(
            `${SET_S}\nlooks_say(MESSAGE: operator_letter_of(STRING: @s, LETTER: @k))`,
            `${RUBY_S}\nsay(@s[@k - 1])`,
        ),
        rows('looks_say(MESSAGE: operator_letter_of(STRING: "abc", LETTER: @k))', 'say("abc"[@k - 1])'),
        {
            name: 'a random number as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: operator_random(FROM: 1, TO: @n)))`,
                `${RUBY_A}\nsay(@a[rand(1..@n) - 1])`,
            ),
        },
        {
            name: 'an expression as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: operator_add(NUM1: @k, NUM2: 1)))`,
                `${RUBY_A}\nsay(@a[@k + 1 - 1])`,
            ),
        },
        {
            name: 'a subtraction as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: operator_subtract(NUM1: @k, NUM2: 1)))`,
                `${RUBY_A}\nsay(@a[@k - 1 - 1])`,
            ),
        },
        {
            name: 'an item of a list as the index of a list',
            ...rows(
                `${LIST_A}\n${LIST_B}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: data_itemoflist(LIST = @b, INDEX: @k)))`,
                `${RUBY_A}\n${RUBY_B}\nsay(@a[@b[@k - 1] - 1])`,
            ),
        },
        {
            name: 'a letter as the index of a letter',
            ...rows(
                `${SET_S}\nlooks_say(MESSAGE: operator_letter_of(STRING: @s, LETTER: operator_letter_of(STRING: @s, LETTER: @k)))`,
                `${RUBY_S}\nsay(@s[@s[@k - 1] - 1])`,
            ),
        },

        {
            name: 'the length of the list as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: data_lengthoflist(LIST = @a)))`,
                `${RUBY_A}\nsay(@a[@a.length - 1])`,
            ),
        },
        {
            // "delete (length of a) of a" is written `delete_at(-1)`, so `@a.length - 1` keeps its form.
            name: 'delete_at the length of the list minus 1',
            ...rows(
                `${LIST_A}\ndata_deleteoflist(LIST = @a, INDEX: operator_add(NUM1: operator_subtract(NUM1: data_lengthoflist(LIST = @a), NUM2: 1), NUM2: 1) #"@ruby:array:index")`,
                `${RUBY_A}\n@a.delete_at(@a.length - 1)`,
            ),
        },

        // The other indexes are as before: Ruby's index + 1, with the mark.
        {
            name: 'a number as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: operator_add(NUM1: 0, NUM2: 1) #"@ruby:array:index"))`,
                `${RUBY_A}\nsay(@a[0])`,
            ),
        },
        {
            name: 'a variable as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: operator_add(NUM1: @k, NUM2: 1) #"@ruby:array:index"))`,
                `${RUBY_A}\nsay(@a[@k])`,
            ),
        },
        {
            name: 'a variable minus 2 as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: operator_add(NUM1: operator_subtract(NUM1: @k, NUM2: 2), NUM2: 1) #"@ruby:array:index"))`,
                `${RUBY_A}\nsay(@a[@k - 2])`,
            ),
        },
        {
            // `3 - 1` is not changed into the index 3: Ruby would come back as `@a[2]`.
            name: 'a number minus 1 as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: operator_add(NUM1: operator_subtract(NUM1: 3, NUM2: 1), NUM2: 1) #"@ruby:array:index"))`,
                `${RUBY_A}\nsay(@a[3 - 1])`,
            ),
        },
        {
            name: 'a variable minus 1.0 as the index',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: data_itemoflist(LIST = @a, INDEX: operator_add(NUM1: operator_subtract(NUM1: @k, NUM2: 1.0), NUM2: 1) #"@ruby:array:index"))`,
                `${RUBY_A}\nsay(@a[@k - 1.0])`,
            ),
        },
    ],
    { versions: ['2'] },
);

describe('Ruby Roundtrip: an index written `x - 1` (issue #2115)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    const blocksOf = async (code) => {
        await converter.targetCodeToBlocks(target, code);
        await converter.applyTargetBlocks(target);
        return Object.values(target.blocks._blocks);
    };

    test.each([
        [
            'a local variable',
            dedent`
            k = 1
            a = [1, 2]
            say(a[k - 1])
            say("abc"[k - 1])
        `,
        ],
        [
            'an argument of a method',
            dedent`
            def pick(k)
              @a = [1, 2]
              say(@a[k - 1])
              say("abc"[k - 1])
            end
        `,
        ],
        [
            'the place of an item in a list',
            dedent`
            @a = [1, 2]
            say(@a[@a.index(2) - 1])
        `,
        ],
    ])('%s as the index comes back the same and has no "+ 1"', async (_name, code) => {
        const blocks = await blocksOf(code);
        const marked = blocks.filter(
            (b) =>
                b.opcode === 'operator_add' && b.comment && /@ruby:array:index/.test(target.comments[b.comment].text),
        );
        expect(marked).toEqual([]);

        ({ target, runtime } = makeSpriteTarget());
        converter = makeConverter(target, runtime, { version: '2' });
        expect(await rubyToBlocksToRuby(converter, target, code)).toEqual(code);
    });
});
