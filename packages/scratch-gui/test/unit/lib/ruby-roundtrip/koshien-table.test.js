/**
 * Smalruby Koshien blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of `koshien` that map one to one onto a
 * block move into a send table (issue #2090). The errors of a coordinate out of the map are in
 * ruby-to-blocks-converter/koshien.test.js; the calls with keywords or lists are in
 * ruby-roundtrip/extension_koshien*.test.js.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const target = (name, coordinate) => `koshien_targetCoordinate(TARGET = "${name}", COORDINATE = "${coordinate}")`;

const targetRows = ['player', 'other_player', 'enemy', 'goal'].flatMap((name) => [
    { blocks: `looks_say(MESSAGE: ${target(name, 'position')})`, ruby: `say(koshien.${name})` },
    { blocks: `looks_say(MESSAGE: ${target(name, 'x')})`, ruby: `say(koshien.${name}_x)` },
    { blocks: `looks_say(MESSAGE: ${target(name, 'y')})`, ruby: `say(koshien.${name}_y)` },
]);

const rows = [
    { blocks: 'koshien_getMapArea(POSITION: "3:4")', ruby: 'koshien.get_map_area("3:4")' },
    { blocks: 'koshien_getMapArea(POSITION: $p)', ruby: 'koshien.get_map_area($p)' },
    { blocks: 'looks_say(MESSAGE: koshien_map(POSITION: "0:16"))', ruby: 'say(koshien.map("0:16"))' },
    { blocks: 'koshien_moveTo(POSITION: "16:16")', ruby: 'koshien.move_to("16:16")' },
    { blocks: 'koshien_setItem(ITEM = "dynamite", POSITION: "1:2")', ruby: 'koshien.set_dynamite("1:2")' },
    { blocks: 'koshien_setItem(ITEM = "bomb", POSITION: $p)', ruby: 'koshien.set_bomb($p)' },
    { blocks: 'looks_say(MESSAGE: koshien_mapAll)', ruby: 'say(koshien.map_all)' },
    ...targetRows,
    { blocks: 'koshien_turnOver', ruby: 'koshien.turn_over' },
    {
        blocks: 'looks_say(MESSAGE: koshien_positionOf(POSITION: "5:6", COORDINATE = "x"))',
        ruby: 'say(koshien.position_of_x("5:6"))',
    },
    {
        blocks: 'looks_say(MESSAGE: koshien_positionOf(POSITION: $p, COORDINATE = "y"))',
        ruby: 'say(koshien.position_of_y($p))',
    },
    { blocks: 'looks_say(MESSAGE: koshien_object(OBJECT = "water"))', ruby: 'say(koshien.object("water"))' },
    { blocks: 'koshien_setMessage(MESSAGE: "hello")', ruby: 'koshien.set_message("hello")' },
    { blocks: 'koshien_setMessage(MESSAGE: $m)', ruby: 'koshien.set_message($m)' },
];

defineBlockRubyTable('Smalruby Koshien blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'Smalruby Koshien blocks ⇔ Ruby (stage)',
    [{ blocks: 'koshien_moveTo(POSITION: "1:1")', ruby: 'koshien.move_to("1:1")' }],
    { stage: true },
);
