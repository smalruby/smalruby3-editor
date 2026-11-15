import { Variable } from './constants';
import Primitive from './primitive';

const MeshV2 = 'mesh';

/**
 * MeshV2 extension converter
 */
const MeshV2Converter = {
    register: function (converter) {
        converter.registerOnSend('self', MeshV2, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(MeshV2, node);
        });

        converter.registerOnSend(MeshV2, 'sensor_value', 1, (params) => {
            const { receiver, args } = params;

            if (!converter.isStringOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'meshV2_getSensorValue', 'value');
            converter.addFieldInput(block, 'NAME', 'meshV2_menu_variableNames', 'variableNames', args[0], ' ');
            return block;
        });

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

        // mesh.message_value → 「メッセージの値」(#1843)
        converter.registerOnSend(MeshV2, 'message_value', 0, (params) => {
            const { receiver } = params;

            return converter.changeRubyExpressionBlock(receiver, 'meshV2_messageValue', 'value');
        });
    },
};

export default MeshV2Converter;
