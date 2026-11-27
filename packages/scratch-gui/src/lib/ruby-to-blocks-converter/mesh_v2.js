import { Variable } from './constants';
import Primitive from './primitive';
import { menuInputArg, registerSendTable } from './send-table';

const MeshV2 = 'mesh';

// The name of a variable shared by the mesh: any string, or any block.
const sensorNameArg = () =>
    menuInputArg('NAME', 'meshV2_menu_variableNames', 'variableNames', ' ', { anyBlock: true });

/**
 * The rows of `sensor_value` on a receiver (`mesh`, or the old `mesh_v1` of mesh.js).
 * @param {string} receiver - The name of the receiver.
 * @returns {object} The row.
 */
const sensorValueRow = (receiver) => ({
    receiver,
    changesReceiver: true,
    name: 'sensor_value',
    opcode: 'meshV2_getSensorValue',
    type: 'value',
    args: [sensorNameArg()],
});

// The calls of `mesh.xxx` that map one to one onto a block (send-table.js). `broadcast` (a message
// of the project and a value) stays a handler.
const MESH_V2_SENDS = [
    sensorValueRow(MeshV2),
    { receiver: MeshV2, changesReceiver: true, name: 'message_value', opcode: 'meshV2_messageValue', type: 'value' },
];

/**
 * MeshV2 extension converter
 */
const MeshV2Converter = {
    sends: MESH_V2_SENDS,

    register: function (converter) {
        converter.registerOnSend('self', MeshV2, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(MeshV2, node);
        });

        registerSendTable(converter, MESH_V2_SENDS);

        // mesh.broadcast("メッセージ1", 値) → 「(メッセージ1 ▼) といっしょに ( ) を送る」(#1843)
        converter.registerOnSend(MeshV2, 'broadcast', 2, (params) => {
            const { receiver, args } = params;

            if (!converter.isStringOrBlock(args[0])) return null;
            let value = args[1];
            if (converter.isNumber(value)) {
                // 値は文字列で送る。数はそのまま数字の文字列にする（受け取った側で数として読める）
                value = new Primitive('str', String(value.value), value.node);
            }
            if (!converter.isStringOrBlock(value)) return null;

            // メッセージのドロップダウンは標準の「送る」と同じ event_broadcast_menu
            const menuBlock = converter.createBlock('event_broadcast_menu', 'value', { shadow: true });
            const broadcastMsg = converter.isString(args[0])
                ? converter.lookupOrCreateBroadcastMsg(args[0])
                : converter.defaultBroadcastMsg();
            converter.addField(menuBlock, 'BROADCAST_OPTION', broadcastMsg.name, {
                id: broadcastMsg.id,
                variableType: Variable.BROADCAST_MESSAGE_TYPE,
            });

            const block = converter.changeRubyExpressionBlock(receiver, 'meshV2_broadcastWithValue', 'statement');
            converter.addInput(
                block,
                'BROADCAST_INPUT',
                converter.isString(args[0]) ? menuBlock : args[0],
                menuBlock,
            );
            converter.addTextInput(block, 'VALUE', value, 'こんにちは');
            return block;
        });
    },
};

export { sensorValueRow };
export default MeshV2Converter;
