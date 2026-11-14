/**
 * Define Ruby code generator for MeshV2 Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.meshV2_menu_variableNames = function (block) {
        const name = Generator.quote_(Generator.getFieldValue(block, 'variableNames') || ' ');
        return [name, Generator.ORDER_ATOMIC];
    };

    Generator.meshV2_getSensorValue = function (block) {
        const name = Generator.valueToCode(block, 'NAME', Generator.ORDER_NONE) || '" "';
        return [`mesh.sensor_value(${name})`, Generator.ORDER_ATOMIC];
    };

    Generator.meshV2_broadcastWithValue = function (block) {
        const message = Generator.valueToCode(block, 'BROADCAST_INPUT', Generator.ORDER_NONE) || null;
        const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || '""';
        return `mesh.broadcast(${message}, ${value})\n`;
    };

    Generator.meshV2_messageValue = function () {
        return ['mesh.message_value', Generator.ORDER_ATOMIC];
    };

    return Generator;
}
