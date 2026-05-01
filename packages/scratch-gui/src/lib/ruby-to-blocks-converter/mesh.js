// `mesh_v1` is the legacy receiver name still emitted by `ruby-generator/mesh.js` for any
// surviving v1 blocks. The Skyway service that backed v1 has shut down (Issue #592), so we
// alias `mesh_v1.*` to mesh v2 blocks here — typing v1 Ruby never produces v1 blocks again.
const LegacyMesh = 'mesh_v1';

const MeshConverter = {
    register: function (converter) {
        converter.registerOnSend('self', LegacyMesh, 0, params => {
            const {node} = params;

            return converter.createRubyExpressionBlock(LegacyMesh, node);
        });

        converter.registerOnSend(LegacyMesh, 'sensor_value', 1, params => {
            const {receiver, args} = params;

            if (!converter.isStringOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'meshV2_getSensorValue', 'value');
            converter.addFieldInput(block, 'NAME', 'meshV2_menu_variableNames', 'variableNames', args[0], ' ');
            return block;
        });
    },
};

export default MeshConverter;
