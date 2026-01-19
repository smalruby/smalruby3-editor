const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const URLSearchParams = require('url').URLSearchParams;
const MeshBlocks = require('../../src/extensions/scratch3_mesh/index.js');
const MeshV2Blocks = require('../../src/extensions/scratch3_mesh_v2/index.js');

const createMockRuntime = () => {
    const runtime = {
        registerPeripheralExtension: () => {},
        on: () => {},
        emit: () => {},
        getOpcodeFunction: () => () => {},
        _primitives: {},
        extensionManager: {
            isExtensionLoaded: () => false
        }
    };
    const stage = {
        variables: {},
        getCustomVars: () => []
    };
    runtime.getTargetForStage = () => stage;
    return runtime;
};

test('Mesh and Mesh V2 Coexistence', t => {
    // Set up global window for utils
    global.window = {
        location: {
            search: '?mesh=test-domain'
        }
    };
    global.URLSearchParams = URLSearchParams;

    const mockRuntime = createMockRuntime();

    t.test('integration: extension IDs are different', st => {
        const meshV1 = new MeshBlocks(mockRuntime);
        const meshV2 = new MeshV2Blocks(mockRuntime);

        const info1 = meshV1.getInfo();
        const info2 = meshV2.getInfo();

        st.equal(info1.id, 'mesh', 'Old Mesh ID is "mesh"');
        st.equal(info2.id, 'meshV2', 'New Mesh ID is "meshV2"');
        st.not(info1.id, info2.id, 'IDs must be unique');
        st.end();
    });

    t.test('integration: block opcodes can overlap without conflict', st => {
        const meshV1 = new MeshBlocks(mockRuntime);
        const meshV2 = new MeshV2Blocks(mockRuntime);

        const info1 = meshV1.getInfo();
        const info2 = meshV2.getInfo();

        // Both extensions have getSensorValue opcode
        const block1 = info1.blocks.find(b => b.opcode === 'getSensorValue');
        const block2 = info2.blocks.find(b => b.opcode === 'getSensorValue');

        st.ok(block1, 'Old Mesh has getSensorValue');
        st.ok(block2, 'New Mesh has getSensorValue');
        st.equal(block1.opcode, block2.opcode, 'Opcodes are allowed to be identical if extension IDs differ');

        // In scratch-vm, the effective opcode becomes extensionId_opcode
        // e.g., mesh_getSensorValue and meshV2_getSensorValue
        const effectiveOpcode1 = `${info1.id}_${block1.opcode}`;
        const effectiveOpcode2 = `${info2.id}_${block2.opcode}`;

        st.not(effectiveOpcode1, effectiveOpcode2, 'Effective opcodes are unique');
        st.equal(effectiveOpcode1, 'mesh_getSensorValue');
        st.equal(effectiveOpcode2, 'meshV2_getSensorValue');
        st.end();
    });

    t.end();
});
