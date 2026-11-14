/**
 * A comment of the user on a block whose Ruby form is kept in `@ruby:*` markers (issue #1857).
 * The converter puts the user's text first and the markers after it, so the generators find the
 * markers wherever they are (block notation: test/unit/helpers/block-notation.js).
 */
import dedent from 'dedent';
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const PUTS = '@ruby:method:puts,@ruby:argument:1:type:Integer';
const INLINE = '@ruby:comment_position:inline';
const INLINE_LAST = '@ruby:comment_position:inline:last';
const EDGE = 'sensing_touchingobject(TOUCHINGOBJECTMENU: sensing_touchingobjectmenu(TOUCHINGOBJECTMENU = "_edge_"))';

/**
 * The notation of a comment text.
 * @param {string} text - The text of the comment.
 * @returns {string} `#"..."`.
 */
const c = (text) => `#${JSON.stringify(text)}`;

const HASH_H = [
    'data_deletealloflist(LIST = @_hash_h_keys_) #"@ruby:hash:literal:1"',
    'data_deletealloflist(LIST = @_hash_h_values_) #"@ruby:hash:literal:values"',
    'data_addtolist(LIST = @_hash_h_keys_, ITEM: ":a") #"@ruby:hash:literal:key:sym"',
    'data_addtolist(LIST = @_hash_h_values_, ITEM: "1") #"@ruby:hash:literal:value"',
].join('\n');

defineBlockRubyTable('A comment of the user on a block with markers', [
    // A method kept in @ruby:method (looks.js).
    {
        blocks: `looks_sayforsecs(MESSAGE: "1", SECS: 1) ${c(`うしろ\n${INLINE}\n${PUTS}`)}`,
        ruby: 'puts(1) # うしろ',
    },
    {
        blocks: `looks_sayforsecs(MESSAGE: "1", SECS: 1) ${c(`前\n${PUTS}`)}`,
        ruby: `
            # 前
            puts(1)
        `,
    },
    {
        blocks: `looks_sayforsecs(MESSAGE: "1", SECS: 1) ${c(`前1\n前2\nうしろ\n${INLINE_LAST}\n${PUTS}`)}`,
        ruby: `
            # 前1
            # 前2
            puts(1) # うしろ
        `,
    },
    {
        blocks: `looks_sayforsecs(MESSAGE: "a", SECS: 1) ${c(`うしろ\n${INLINE}\n@ruby:method:print`)}`,
        ruby: 'print("a") # うしろ',
    },
    {
        blocks: `looks_sayforsecs(MESSAGE: "1", SECS: 1) ${c(`うしろ\n${INLINE}\n@ruby:method:p,@ruby:argument:1:type:Integer`)}`,
        ruby: 'p(1) # うしろ',
    },
    // A symbol kept in @ruby:symbol (looks.js).
    {
        blocks: `looks_say(MESSAGE: "hello") ${c(`うしろ\n${INLINE}\n@ruby:symbol:hello`)}`,
        ruby: 'say(:hello) # うしろ',
    },
    {
        blocks: `looks_think(MESSAGE: "hello") ${c(`前\n@ruby:symbol:hello`)}`,
        ruby: `
            # 前
            think(:hello)
        `,
    },
    // A local variable kept in @ruby:lvar (data.js).
    {
        blocks: `data_setvariableto(VARIABLE = @_a_1_, VALUE: "1") ${c(`うしろ\n${INLINE}\n@ruby:lvar:a:1`)}`,
        ruby: 'a = 1 # うしろ',
    },
    {
        blocks: `data_setvariableto(VARIABLE = @_a_1_, VALUE: "1") ${c('前\n@ruby:lvar:a:1')}`,
        ruby: `
            # 前
            a = 1
        `,
    },
    // `case` / `when` kept in @ruby:syntax:case (control.js). Only toRuby: a comment before `case`
    // goes to the block of the subject when converted (P14).
    {
        blocks: `control_if(CONDITION: operator_equals(OPERAND1: @a, OPERAND2: "1") #"@ruby:syntax:case:@a:1") {
            looks_say(MESSAGE: "1")
        } ${c(`前\n@ruby:syntax:case:@a:1`)}`,
        ruby: `
            # 前
            case @a
            when 1
              say("1")
            end
        `,
        only: 'toRuby',
    },
    // The markers of the converter that are read anywhere already keep working.
    {
        blocks: `control_if(CONDITION: ${EDGE}) { motion_movesteps(STEPS: 10) } ${c(`うしろ\n${INLINE}\n@ruby:syntax:if_modifier`)}`,
        ruby: 'move(10) if touching?("_edge_") # うしろ',
    },
    {
        blocks: `motion_turnright(DEGREES: 10) ${c(`うしろ\n${INLINE}\n@ruby:operator:+=`)}`,
        ruby: 'self.direction += 10 # うしろ',
    },
    // A comment that the user added on the blocks screen to a reporter with markers: the comment is
    // written on the line before, and the markers still give the Ruby form.
    {
        blocks: `looks_say(MESSAGE: operator_join(STRING1: @a, STRING2: "") ${c('メモ\n@ruby:method:to_s')})`,
        ruby: `
            # メモ
            say(@a.to_s)
        `,
        only: 'toRuby',
    },
    {
        blocks: `looks_say(MESSAGE: operator_mathop(OPERATOR = "floor", NUM: @a) ${c('メモ\n@ruby:method:to_i')})`,
        ruby: `
            # メモ
            say(@a.to_i)
        `,
        only: 'toRuby',
    },
    {
        blocks: `looks_say(MESSAGE: operator_join(STRING1: "hello", STRING2: "") ${c('メモ\n@ruby:symbol:hello')})`,
        ruby: `
            # メモ
            say(:hello.to_s)
        `,
        only: 'toRuby',
    },
    {
        blocks: `data_setvariableto(VARIABLE = @a, VALUE: sensing_answer ${c('メモ\n@ruby:method:gets')})`,
        ruby: `
            # メモ
            @a = gets
        `,
        only: 'toRuby',
    },
    // A comment of the user that only mentions a marker is not a marker.
    {
        blocks: `looks_say(MESSAGE: "hello") ${c('前 @ruby:symbol:hello')}`,
        ruby: `
            # 前 @ruby:symbol:hello
            say("hello")
        `,
        only: 'toRuby',
    },
    // A line of the user that starts with `@ruby:` is read as a marker; the converter's marker after
    // it wins (review of #1857, FYI1).
    {
        blocks: `looks_say(MESSAGE: "hello") ${c(`@ruby:symbol:bye\n${INLINE}\n@ruby:symbol:hello`)}`,
        ruby: 'say(:hello)',
        only: 'toRuby',
    },
    // The source of the subject of `case` runs to the end of the line: `@ruby:` in it after a space or a
    // comma does not start another marker (review of #1857, M1).
    {
        blocks: `control_if(CONDITION: operator_equals(OPERAND1: "a @ruby:b", OPERAND2: "x") ${c('@ruby:syntax:case:"a @ruby:b":1')}) {
            motion_movesteps(STEPS: 1)
        } ${c('@ruby:syntax:case:"a @ruby:b":1')}`,
        ruby: `
            case "a @ruby:b"
            when "x"
              move(1)
            end
        `,
    },
    {
        blocks: `control_if(CONDITION: operator_equals(OPERAND1: "a,@ruby:b", OPERAND2: "x") ${c('@ruby:syntax:case:"a,@ruby:b":1')}) {
            motion_movesteps(STEPS: 1)
        } ${c('@ruby:syntax:case:"a,@ruby:b":1')}`,
        ruby: `
            case "a,@ruby:b"
            when "x"
              move(1)
            end
        `,
    },
    {
        blocks: `control_if(CONDITION: operator_equals(OPERAND1: "a @ruby:b", OPERAND2: "x") ${c('@ruby:syntax:case:"a @ruby:b":1')}) {
            motion_movesteps(STEPS: 1)
        } ${c('前\n@ruby:syntax:case:"a @ruby:b":1')}`,
        ruby: `
            # 前
            case "a @ruby:b"
            when "x"
              move(1)
            end
        `,
        only: 'toRuby',
    },
    // The other generators that read markers (review of #1857, FYI2).
    {
        blocks: `control_if(CONDITION: operator_not(OPERAND: ${EDGE})) { motion_movesteps(STEPS: 1) } ${c('前\n@ruby:syntax:unless')}`,
        ruby: `
            # 前
            unless touching?("_edge_")
              move(1)
            end
        `,
        only: 'toRuby',
    },
    {
        blocks: `control_if_else(CONDITION: operator_not(OPERAND: ${EDGE})) { motion_movesteps(STEPS: 1) } { motion_movesteps(STEPS: 2) } ${c(`うしろ\n${INLINE}\n@ruby:syntax:unless_else`)}`,
        ruby: `
            unless touching?("_edge_")
              move(1)
            else
              move(2)
            end # うしろ
        `,
        only: 'toRuby',
    },
    {
        blocks: `control_if(CONDITION: operator_not(OPERAND: ${EDGE})) { motion_movesteps(STEPS: 10) } ${c(`うしろ\n${INLINE}\n@ruby:syntax:unless_modifier`)}`,
        ruby: 'move(10) unless touching?("_edge_") # うしろ',
    },
    {
        blocks: `control_repeat_until(CONDITION: operator_not(OPERAND: operator_lt(OPERAND1: @a, OPERAND2: "3"))) {
            motion_movesteps(STEPS: 1)
        } ${c('前\n@ruby:syntax:while')}`,
        ruby: `
            # 前
            while @a < 3
              move(1)
            end
        `,
        only: 'toRuby',
    },
    {
        blocks: `control_if_else(CONDITION: operator_equals(OPERAND1: @a, OPERAND2: "1")) {
            motion_movesteps(STEPS: 1)
        } {
            control_if(CONDITION: operator_equals(OPERAND1: @a, OPERAND2: "2")) {
                motion_movesteps(STEPS: 2)
            } ${c('メモ\n@ruby:syntax:elsif:1')}
        } ${c('前\n@ruby:syntax:elsif:1')}`,
        ruby: `
            # 前
            if @a == 1
              move(1)
            elsif @a == 2
              move(2)
            end
        `,
        only: 'toRuby',
    },
    {
        blocks: `control_forever { motion_movesteps(STEPS: 1) } ${c('前\n@ruby:method:wait')}`,
        ruby: `
            # 前
            loop do
              move(1)
              wait
            end
        `,
    },
    {
        blocks: `control_create_clone_of(CLONE_OPTION: control_create_clone_of_menu(CLONE_OPTION = "_myself_")) ${c(`うしろ\n${INLINE}\n@ruby:method:clone`)}`,
        ruby: 'clone # うしろ',
    },
    {
        blocks: `control_create_clone_of(CLONE_OPTION: control_create_clone_of_menu(CLONE_OPTION = "_myself_")) ${c('前\n@ruby:method:clone')}`,
        ruby: `
            # 前
            clone
        `,
    },
    // `>=` / `<=` / `!=` keep the same marker on their blocks; a comment of the user on the outer one.
    {
        blocks: `data_setvariableto(VARIABLE = @b, VALUE: operator_or(OPERAND1: operator_gt(OPERAND1: @a, OPERAND2: "1") #"@ruby:operator:>=:1", OPERAND2: operator_equals(OPERAND1: @a, OPERAND2: "1") #"@ruby:operator:>=:1") ${c('メモ\n@ruby:operator:>=:1')})`,
        ruby: `
            # メモ
            @b = @a >= 1
        `,
        only: 'toRuby',
    },
    {
        blocks: `data_setvariableto(VARIABLE = @b, VALUE: operator_or(OPERAND1: operator_lt(OPERAND1: @a, OPERAND2: "1") #"@ruby:operator:<=:1", OPERAND2: operator_equals(OPERAND1: @a, OPERAND2: "1") #"@ruby:operator:<=:1") ${c('メモ\n@ruby:operator:<=:1')})`,
        ruby: `
            # メモ
            @b = @a <= 1
        `,
        only: 'toRuby',
    },
    {
        blocks: `data_setvariableto(VARIABLE = @b, VALUE: operator_not(OPERAND: operator_equals(OPERAND1: @a, OPERAND2: "1") #"@ruby:operator:!=:1") ${c('メモ\n@ruby:operator:!=:1')})`,
        ruby: `
            # メモ
            @b = @a != 1
        `,
        only: 'toRuby',
    },
    // data-list.js: a local array, `delete_at(-1)` and a hash.
    {
        blocks: `data_deletealloflist(LIST = @_a_1_) #"@ruby:lvar:a:1,@ruby:array:literal:1"
            data_addtolist(LIST = @_a_1_, ITEM: "1") #"@ruby:array:literal:element"
            data_addtolist(LIST = @_a_1_, ITEM: "2") ${c(`うしろ\n${INLINE}\n@ruby:lvar:a:1`)}`,
        ruby: `
            a = [1]
            a.push(2) # うしろ
        `,
    },
    {
        blocks: `data_deletealloflist(LIST = @a) #"@ruby:array:literal:1"
            data_addtolist(LIST = @a, ITEM: "1") #"@ruby:array:literal:element"
            data_deleteoflist(LIST = @a, INDEX: data_lengthoflist(LIST = @a)) ${c(`うしろ\n${INLINE}\n@ruby:array:delete_at:last`)}`,
        ruby: `
            @a = [1]
            @a.delete_at(-1) # うしろ
        `,
    },
    {
        blocks: `${HASH_H}
            data_deleteoflist(LIST = @_hash_h_values_, INDEX: data_itemnumoflist(LIST = @_hash_h_keys_, ITEM: ":a")) ${c('前\n@ruby:hash:set:sym')}
            data_deleteoflist(LIST = @_hash_h_keys_, INDEX: data_itemnumoflist(LIST = @_hash_h_keys_, ITEM: ":a")) #"@ruby:hash:set:delete:key"
            data_addtolist(LIST = @_hash_h_keys_, ITEM: ":a") #"@ruby:hash:set:push:key"
            data_addtolist(LIST = @_hash_h_values_, ITEM: "2") #"@ruby:hash:set:push:value"`,
        ruby: `
            @h = {a: 1}
            # 前
            @h[:a] = 2
        `,
    },
    {
        blocks: `${HASH_H}
            looks_say(MESSAGE: data_itemoflist(LIST = @_hash_h_values_, INDEX: data_itemnumoflist(LIST = @_hash_h_keys_, ITEM: ":a")) ${c('メモ\n@ruby:hash:get:sym')})`,
        ruby: `
            @h = {a: 1}
            # メモ
            say(@h[:a])
        `,
        only: 'toRuby',
    },
    // smalruby-ruby.js: the name of a block parameter.
    {
        blocks: `smalrubyRuby_numberMethodWithBlock(METHOD = "times", RECEIVER: 3) {
            motion_movesteps(STEPS: smalrubyRuby_blockParam(PARAM = "_1") #"@ruby:lvar:i:1")
        } ${c('前\n@ruby:block_param:1:i')}`,
        ruby: `
            # 前
            3.times do |i|
              move(i)
            end
        `,
    },
]);

// procedure.js reads `@ruby:return` of a call to a method with a return value. Custom blocks have a
// mutation, which the table cannot show, so these are round trips only.
describe('A comment of the user on a call to a method with a return value', () => {
    test.each([
        [
            'before an assignment',
            dedent`
                def bar(n)
                  return n + 1
                end

                # 前
                @a = bar(1)
            `,
        ],
        [
            'after an assignment',
            dedent`
                def bar(n)
                  return n + 1
                end

                @a = bar(1) # うしろ
            `,
        ],
        [
            'before a say',
            dedent`
                def bar(n)
                  return n + 1
                end

                # 前
                say(bar(1))
            `,
        ],
    ])('%s comes back the same', async (_name, code) => {
        const { target, runtime } = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, { version: '2' });
        expect(await rubyToBlocksToRuby(converter, target, code)).toBe(code);
    });
});
