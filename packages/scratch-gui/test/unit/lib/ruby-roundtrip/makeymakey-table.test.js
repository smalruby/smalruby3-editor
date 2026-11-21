/**
 * Makey Makey blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of Makey Makey move into a send table
 * (issue #2090); ruby-roundtrip/extension_makey_makey.test.js stays as the long round trip.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

defineBlockRubyTable('Makey Makey blocks ⇔ Ruby', [
    {
        blocks: `
            makeymakey_whenMakeyKeyPressed(KEY: makeymakey_menu_KEY(KEY = "SPACE"))
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            makey.when_key_pressed("SPACE") do
              move(10)
            end
        `,
    },
    { blocks: 'makeymakey_whenMakeyKeyPressed(KEY: $k)', ruby: 'makey.when_key_pressed($k) do\nend' },
    {
        blocks: 'makeymakey_whenCodePressed(SEQUENCE: makeymakey_menu_SEQUENCE(SEQUENCE = "LEFT UP RIGHT"))',
        ruby: 'makey.when_pressed_in_oder("LEFT UP RIGHT") do\nend',
    },
    // The form of version 1, read in version 2 too.
    {
        blocks: 'makeymakey_whenMakeyKeyPressed(KEY: makeymakey_menu_KEY(KEY = "UP"))',
        ruby: 'self.when(:makey_key_pressed, "UP") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: 'makeymakey_whenCodePressed(SEQUENCE: makeymakey_menu_SEQUENCE(SEQUENCE = "UP DOWN"))',
        ruby: 'self.when(:makey_pressed_in_oder, "UP DOWN") do\nend',
        only: 'toBlocks',
    },
]);
