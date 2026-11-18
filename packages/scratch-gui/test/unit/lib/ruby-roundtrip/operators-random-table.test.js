// === Smalruby: This file is Smalruby-specific (pick random blocks ⇔ Ruby table) ===
/**
 * "pick random" blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * `rand(n)` with an integer of 1 or more is "pick random (0) to (n - 1)" with the `@ruby:rand:n`
 * marker (issue #2042). The edits by a user are in ruby-roundtrip/rand-integer.test.js.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

defineBlockRubyTable('Pick random blocks ⇔ Ruby', [
    { blocks: 'operator_random(FROM: 1, TO: 10)', ruby: 'rand(1..10)' },
    { blocks: 'operator_random(FROM: 0, TO: 9) #"@ruby:rand:n"', ruby: 'rand(10)' },
    { blocks: 'operator_random(FROM: 0, TO: 0) #"@ruby:rand:n"', ruby: 'rand(1)' },
    { blocks: 'operator_random(FROM: 1, TO: 9) #"@ruby:rand:n"', ruby: 'rand(1..9)', only: 'toRuby' },
]);
