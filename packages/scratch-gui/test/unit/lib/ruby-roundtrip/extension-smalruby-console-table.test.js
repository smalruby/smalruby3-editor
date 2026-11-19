// === Smalruby: This file is Smalruby-specific (console blocks ⇔ Ruby table) ===
/**
 * The console blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * `console.puts` / `console.gets` are the Ruby of the console blocks, which the Japanese mode
 * writes for `表示する` and `【外部からの入力】` (docs/dncl/design.md, chapter 5). Ruby's own
 * `puts` stays "say" (looks_sayforsecs): Ruby's `puts` is not the console.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

defineBlockRubyTable('Console blocks ⇔ Ruby', [
    { blocks: 'smalrubyConsole_print(TEXT: "こんにちは")', ruby: 'console.puts("こんにちは")' },
    { blocks: 'smalrubyConsole_print(TEXT: @x)', ruby: 'console.puts(@x)' },
    {
        name: 'a number stays a number in the Ruby',
        blocks: 'smalrubyConsole_print(TEXT: "3") #"@ruby:argument:1:type:Integer"',
        ruby: 'console.puts(3)',
    },
    {
        blocks: 'smalrubyConsole_print(TEXT: "1.5") #"@ruby:argument:1:type:Float"',
        ruby: 'console.puts(1.5)',
    },
    {
        blocks: 'data_setvariableto(VARIABLE = @x, VALUE: smalrubyConsole_input)',
        ruby: '@x = console.gets',
    },
    {
        blocks: 'smalrubyConsole_print(TEXT: operator_join(STRING1: "答えは", STRING2: smalrubyConsole_input))',
        ruby: 'console.puts("答えは" + console.gets)',
    },
    {
        name: "Ruby's puts is still say",
        blocks: 'looks_sayforsecs(MESSAGE: @x, SECS: 1) #"@ruby:method:puts"',
        ruby: 'puts(@x)',
    },
]);
