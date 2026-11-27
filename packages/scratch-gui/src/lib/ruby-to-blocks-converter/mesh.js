// `mesh_v1` is the legacy receiver name that old Ruby scripts may still contain. The Skyway
// service that backed v1 has shut down and the v1 extension itself has been removed, so we
// alias `mesh_v1.*` to mesh v2 blocks here — typing v1 Ruby never produces v1 blocks again.
import { sensorValueRow } from './mesh_v2';
import { registerSendTable } from './send-table';

const LegacyMesh = 'mesh_v1';

const MESH_SENDS = [sensorValueRow(LegacyMesh)];

const MeshConverter = {
    sends: MESH_SENDS,

    register: function (converter) {
        converter.registerOnSend('self', LegacyMesh, 0, (params) => {
            const { node } = params;

            return converter.createRubyExpressionBlock(LegacyMesh, node);
        });

        registerSendTable(converter, MESH_SENDS);
    },
};

export default MeshConverter;
