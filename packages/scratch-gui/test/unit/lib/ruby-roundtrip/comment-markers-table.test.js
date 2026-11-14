/**
 * A comment of the user on a block whose Ruby form is kept in `@ruby:*` markers (issue #1857).
 * The converter puts the user's text first and the markers after it, so the generators find the
 * markers wherever they are (block notation: test/unit/helpers/block-notation.js).
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

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
]);
