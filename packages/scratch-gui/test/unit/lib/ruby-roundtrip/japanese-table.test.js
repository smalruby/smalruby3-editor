/**
 * Japanese mode ⇔ Ruby ⇔ blocks, as a table (issue #2095, J0 of docs/ruby-editor/converter-roadmap.md).
 * Each row also runs Japanese → Ruby → blocks and blocks → Ruby → Japanese (the `ja` column of
 * test/unit/helpers/block-ruby-table.js), so the Ruby the Japanese mode makes stays a part of the
 * Ruby the converter takes. Notation: test/unit/helpers/block-notation.js.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const PUTS = '#"@ruby:method:puts"';

defineBlockRubyTable('Japanese mode ⇔ Ruby ⇔ blocks', [
    { ja: 'x = 1', ruby: '@x = 1', blocks: 'data_setvariableto(VARIABLE = @x, VALUE: "1")' },
    {
        name: 'the arrow assignment is read and written as =',
        ja: 'x ← 1',
        jaOnly: 'jaToBlocks',
        ruby: '@x = 1',
        blocks: 'data_setvariableto(VARIABLE = @x, VALUE: "1")',
    },
    {
        ja: 'x = x * 2 - 1',
        ruby: '@x = @x * 2 - 1',
        blocks: `data_setvariableto(VARIABLE = @x, VALUE: operator_subtract(
            NUM1: operator_multiply(NUM1: @x, NUM2: 2), NUM2: 1))`,
    },
    {
        ja: 'x = 7 % 2',
        ruby: '@x = 7 % 2',
        blocks: 'data_setvariableto(VARIABLE = @x, VALUE: operator_mod(NUM1: 7, NUM2: 2))',
    },
    {
        name: '÷ is the integer division',
        ja: 'x = 7 ÷ 2',
        ruby: '@x = (7 / 2).to_i',
        blocks: `data_setvariableto(VARIABLE = @x, VALUE: operator_mathop(OPERATOR = "floor",
            NUM: operator_divide(NUM1: 7, NUM2: 2)) #"@ruby:method:to_i")`,
    },
    {
        name: 'a name that starts with a capital letter',
        ja: 'Kosu = 3',
        ruby: '@_var_Kosu_ = 3',
        blocks: 'data_setvariableto(VARIABLE = @_var_Kosu_, VALUE: "3")',
    },
    {
        name: 'true is written as 真',
        ja: 'x = 真',
        ruby: '@x = true',
        blocks: 'data_setvariableto(VARIABLE = @x, VALUE: operator_equals(OPERAND1: "1", OPERAND2: "1") #"@ruby:literal:true:1")',
    },
    {
        name: 'an array',
        ja: 'Data = [1, 2]',
        ruby: '@_array_Data_ = [1, 2]',
        blocks: `
            data_deletealloflist(LIST = @_array_Data_) #"@ruby:array:literal:2"
            data_addtolist(LIST = @_array_Data_, ITEM: "1") #"@ruby:array:literal:element"
            data_addtolist(LIST = @_array_Data_, ITEM: "2") #"@ruby:array:literal:element"
        `,
    },
    {
        name: 'an element of an array (indexes from 0)',
        ja: 'x = Data[1]',
        ruby: '@x = @_array_Data_[1]',
        blocks: `data_setvariableto(VARIABLE = @x, VALUE: data_itemoflist(LIST = @_array_Data_,
            INDEX: operator_add(NUM1: 1, NUM2: 1) #"@ruby:array:index"))`,
    },
    {
        ja: 'Data[0] = 5',
        ruby: '@_array_Data_[0] = 5',
        blocks: `data_replaceitemoflist(LIST = @_array_Data_,
            INDEX: operator_add(NUM1: 0, NUM2: 1) #"@ruby:array:index", ITEM: "5")`,
    },
    {
        ja: 'x = 要素数(Data)',
        ruby: '@x = @_array_Data_.length',
        blocks: 'data_setvariableto(VARIABLE = @x, VALUE: data_lengthoflist(LIST = @_array_Data_))',
    },
    {
        ja: 'x = 整数(y)',
        ruby: '@x = @y.to_i',
        blocks: 'data_setvariableto(VARIABLE = @x, VALUE: operator_mathop(OPERATOR = "floor", NUM: @y) #"@ruby:method:to_i")',
    },
    {
        name: '乱数(n) is from 0 to n - 1',
        ja: 'x = 乱数(10)',
        ruby: '@x = rand(10)',
        blocks: 'data_setvariableto(VARIABLE = @x, VALUE: operator_random(FROM: 0, TO: 9) #"@ruby:rand:n")',
    },
    {
        name: 'two assignments on a line (a fix of the Japanese mode)',
        ja: 'a ← 1, b ← 2',
        jaOnly: 'jaToBlocks',
        ruby: `
            @a = 1
            @b = 2
        `,
        blocks: `
            data_setvariableto(VARIABLE = @a, VALUE: "1")
            data_setvariableto(VARIABLE = @b, VALUE: "2")
        `,
    },
    { ja: '表示する(x)', ruby: 'puts(@x)', blocks: `looks_sayforsecs(MESSAGE: @x, SECS: 1) ${PUTS}` },
    {
        name: '表示する with two values',
        ja: '表示する("合計", x)',
        ruby: 'puts("合計" + @x.to_s)',
        blocks: `looks_sayforsecs(MESSAGE: operator_join(STRING1: "合計",
            STRING2: operator_join(STRING1: @x, STRING2: "") #"@ruby:method:to_s"), SECS: 1) ${PUTS}`,
    },
    {
        name: 'an input',
        ja: 'x = 【外部からの入力】',
        ruby: `
            ask("")
            @x = answer
        `,
        blocks: `
            sensing_askandwait(QUESTION: "")
            data_setvariableto(VARIABLE = @x, VALUE: sensing_answer)
        `,
    },
    {
        ja: `
            もし x > 0 ならば
              表示する(x)
            を実行する
        `,
        ruby: `
            if @x > 0
              puts(@x)
            end
        `,
        blocks: `control_if(CONDITION: operator_gt(OPERAND1: @x, OPERAND2: "0")) {
            looks_sayforsecs(MESSAGE: @x, SECS: 1) ${PUTS}
        }`,
    },
    {
        name: 'the standard form of もし (with : and ⎿) is read',
        ja: `
            もし x > 0 ならば:
            ⎿ 表示する(x)
        `,
        jaOnly: 'jaToBlocks',
        ruby: `
            if @x > 0
              puts(@x)
            end
        `,
        blocks: `control_if(CONDITION: operator_gt(OPERAND1: @x, OPERAND2: "0")) {
            looks_sayforsecs(MESSAGE: @x, SECS: 1) ${PUTS}
        }`,
    },
    {
        ja: `
            もし x > 0 ならば
              表示する(x)
            そうでなければ
              表示する(y)
            を実行する
        `,
        ruby: `
            if @x > 0
              puts(@x)
            else
              puts(@y)
            end
        `,
        blocks: `control_if_else(CONDITION: operator_gt(OPERAND1: @x, OPERAND2: "0")) {
            looks_sayforsecs(MESSAGE: @x, SECS: 1) ${PUTS}
        } {
            looks_sayforsecs(MESSAGE: @y, SECS: 1) ${PUTS}
        }`,
    },
    {
        name: 'かつ',
        ja: `
            もし x > 0 かつ x < 9 ならば
              表示する(x)
            を実行する
        `,
        ruby: `
            if @x > 0 && @x < 9
              puts(@x)
            end
        `,
        blocks: `control_if(CONDITION: operator_and(OPERAND1: operator_gt(OPERAND1: @x, OPERAND2: "0"),
            OPERAND2: operator_lt(OPERAND1: @x, OPERAND2: "9"))) {
            looks_sayforsecs(MESSAGE: @x, SECS: 1) ${PUTS}
        }`,
    },
    {
        name: 'の間 を繰り返す',
        ja: `
            x < 3 の間
              x = x + 1
            を繰り返す
        `,
        ruby: `
            while @x < 3
              @x = @x + 1
            end
        `,
        blocks: `control_repeat_until(CONDITION: operator_not(OPERAND: operator_lt(OPERAND1: @x, OPERAND2: "3"))) {
            data_setvariableto(VARIABLE = @x, VALUE: operator_add(NUM1: @x, NUM2: 1))
        } #"@ruby:syntax:while"`,
    },
    {
        name: 'a counting loop',
        ja: `
            i を 1 から 3 まで 1 ずつ増やしながら
              表示する(i)
            を繰り返す
        `,
        ruby: `
            @i = 1
            while @i <= 3
              puts(@i)
              @i += 1
            end
        `,
        blocks: `
            data_setvariableto(VARIABLE = @i, VALUE: "1")
            control_repeat_until(CONDITION: operator_not(OPERAND: operator_or(
                OPERAND1: operator_lt(OPERAND1: @i, OPERAND2: "3") #"@ruby:operator:<=:1",
                OPERAND2: operator_equals(OPERAND1: @i, OPERAND2: "3") #"@ruby:operator:<=:1"
            ) #"@ruby:operator:<=:1")) {
              looks_sayforsecs(MESSAGE: @i, SECS: 1) ${PUTS}
              data_changevariableby(VARIABLE = @i, VALUE: 1)
            } #"@ruby:syntax:while"
        `,
    },
    {
        name: 'a counting loop down',
        ja: `
            i を 3 から 1 まで 1 ずつ減らしながら
              表示する(i)
            を繰り返す
        `,
        ruby: `
            @i = 3
            while @i >= 1
              puts(@i)
              @i += -1
            end
        `,
        blocks: `
            data_setvariableto(VARIABLE = @i, VALUE: "3")
            control_repeat_until(CONDITION: operator_not(OPERAND: operator_or(
                OPERAND1: operator_gt(OPERAND1: @i, OPERAND2: "1") #"@ruby:operator:>=:1",
                OPERAND2: operator_equals(OPERAND1: @i, OPERAND2: "1") #"@ruby:operator:>=:1"
            ) #"@ruby:operator:>=:1")) {
              looks_sayforsecs(MESSAGE: @i, SECS: 1) ${PUTS}
              data_changevariableby(VARIABLE = @i, VALUE: -1)
            } #"@ruby:syntax:while"
        `,
    },
    {
        name: 'line numbers are read and not written',
        ja: `
            (1) x = 1
            (2) 表示する(x)
        `,
        jaOnly: 'jaToBlocks',
        ruby: `
            @x = 1
            puts(@x)
        `,
        blocks: `
            data_setvariableto(VARIABLE = @x, VALUE: "1")
            looks_sayforsecs(MESSAGE: @x, SECS: 1) ${PUTS}
        `,
    },
]);
