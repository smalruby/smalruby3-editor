/**
 * Mesh blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js). It fixes the
 * output of the converter before `mesh.sensor_value` / `mesh.message_value` (and the old
 * `mesh_v1.sensor_value`) move into a send table (issue #2090). `mesh.broadcast(...)` stays a
 * handler (ruby-to-blocks-converter/mesh_v2.test.js).
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const name = (value) => `meshV2_menu_variableNames(variableNames = "${value}")`;

const rows = [
    {
        blocks: `looks_say(MESSAGE: meshV2_getSensorValue(NAME: ${name('score')}))`,
        ruby: 'say(mesh.sensor_value("score"))',
    },
    { blocks: 'looks_say(MESSAGE: meshV2_getSensorValue(NAME: $n))', ruby: 'say(mesh.sensor_value($n))' },
    { blocks: 'looks_say(MESSAGE: meshV2_messageValue)', ruby: 'say(mesh.message_value)' },
    // The old receiver of the removed mesh v1 makes the blocks of mesh v2.
    {
        blocks: `looks_say(MESSAGE: meshV2_getSensorValue(NAME: ${name('score')}))`,
        ruby: 'say(mesh_v1.sensor_value("score"))',
        only: 'toBlocks',
    },
    {
        blocks: 'looks_say(MESSAGE: meshV2_getSensorValue(NAME: $n))',
        ruby: 'say(mesh_v1.sensor_value($n))',
        only: 'toBlocks',
    },
];

defineBlockRubyTable('Mesh blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'Mesh blocks ⇔ Ruby (stage)',
    [{ blocks: 'data_setvariableto(VARIABLE = $v, VALUE: meshV2_messageValue)', ruby: '$v = mesh.message_value' }],
    { stage: true },
);
