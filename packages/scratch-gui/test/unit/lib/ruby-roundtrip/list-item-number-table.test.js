/**
 * "Item # of (x) in list" ⇔ Ruby (issue #2125).
 * The block counts from 1 and gives 0 when the item is not in the list, but Ruby's `index` counts
 * from 0 and gives nil. A block made in the block editor is written `(@a.index(x) || -1) + 1`, which
 * has the same value, and comes back as the same block. `@a.index(x)` written in Ruby stays
 * "(item # of x in a) - 1" with `@ruby:array:index` (block notation: test/unit/helpers/block-notation.js).
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const LIST_A = [
    'data_deletealloflist(LIST = @a) #"@ruby:array:literal:1"',
    'data_addtolist(LIST = @a, ITEM: "x") #"@ruby:array:literal:element"',
].join('\n');
const RUBY_A = '@a = ["x"]';

const LIST_B = [
    'data_deletealloflist(LIST = @b) #"@ruby:array:literal:1"',
    'data_addtolist(LIST = @b, ITEM: "y") #"@ruby:array:literal:element"',
].join('\n');
const RUBY_B = '@b = ["y"]';

const NUM_OF_X = 'data_itemnumoflist(LIST = @a, ITEM: "x")';

const rows = (blocks, ruby) => ({ blocks, ruby });

defineBlockRubyTable(
    'Item # of (x) in list has the value of the block in Ruby',
    [
        rows(`${LIST_A}\nlooks_say(MESSAGE: ${NUM_OF_X})`, `${RUBY_A}\nsay((@a.index("x") || -1) + 1)`),
        rows(
            `${LIST_A}\ndata_setvariableto(VARIABLE = @n, VALUE: ${NUM_OF_X})`,
            `${RUBY_A}\n@n = (@a.index("x") || -1) + 1`,
        ),
        {
            name: 'in a multiplication',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: operator_multiply(NUM1: ${NUM_OF_X}, NUM2: 2))`,
                `${RUBY_A}\nsay(((@a.index("x") || -1) + 1) * 2)`,
            ),
        },
        {
            name: 'plus 1',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: operator_add(NUM1: ${NUM_OF_X}, NUM2: 1))`,
                `${RUBY_A}\nsay((@a.index("x") || -1) + 1 + 1)`,
            ),
        },
        {
            name: 'as the index of another list',
            ...rows(
                `${LIST_A}\n${LIST_B}\nlooks_say(MESSAGE: data_itemoflist(LIST = @b, INDEX: ${NUM_OF_X}))`,
                `${RUBY_A}\n${RUBY_B}\nsay(@b[(@a.index("x") || -1) + 1 - 1])`,
            ),
        },
        {
            name: 'in a comparison',
            ...rows(
                `${LIST_A}\ncontrol_if(CONDITION: operator_equals(OPERAND1: ${NUM_OF_X}, OPERAND2: "0")) { looks_say(MESSAGE: "none") }`,
                `${RUBY_A}\nif (@a.index("x") || -1) + 1 == 0\n  say("none")\nend`,
            ),
        },

        // `@a.index(x)` written in Ruby keeps Ruby's value: "(item # of x in a) - 1".
        {
            name: 'index written in Ruby',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: operator_subtract(NUM1: ${NUM_OF_X}, NUM2: 1) #"@ruby:array:index")`,
                `${RUBY_A}\nsay(@a.index("x"))`,
            ),
        },
        {
            // `x || -1` is -1 when the item is not in the list, the same as "(item # of x) - 1".
            name: 'index or -1 written in Ruby',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: operator_subtract(NUM1: ${NUM_OF_X}, NUM2: 1) #"@ruby:array:index:or")`,
                `${RUBY_A}\nsay(@a.index("x") || -1)`,
            ),
        },
        {
            name: 'index or -1 times 2',
            ...rows(
                `${LIST_A}\nlooks_say(MESSAGE: operator_multiply(NUM1: operator_subtract(NUM1: ${NUM_OF_X}, NUM2: 1) #"@ruby:array:index:or", NUM2: 2))`,
                `${RUBY_A}\nsay((@a.index("x") || -1) * 2)`,
            ),
        },
    ],
    { versions: ['2'] },
);
