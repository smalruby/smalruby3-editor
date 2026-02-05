const MeshV2 = 'mesh';

/**
 * MeshV2 extension converter
 */
const MeshV2Converter = {
    register: function (converter) {
        converter.registerOnSend('self', MeshV2, 0, params => {
            const {node} = params;

            return converter.createRubyExpressionBlock(MeshV2, node);
        });

        converter.registerOnSend(MeshV2, 'sensor_value', 1, params => {
            const {receiver, args} = params;

            if (!converter.isStringOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'meshV2_getSensorValue', 'value');
            converter.addFieldInput(block, 'NAME', 'meshV2_menu_variableNames', 'variableNames', args[0], ' ');
            return block;
        });
    }
};

export default MeshV2Converter;
