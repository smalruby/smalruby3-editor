const path = require('path');
const test = require('tap').test;
const readFileToBuffer = require('../../fixtures/readProjectFile').readFileToBuffer;
const VirtualMachine = require('../../../src/index');

test('mesh v1 to v2 migration integration', t => {
    const vm = new VirtualMachine();
    const project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v1_project.json'));

    return vm.loadProject(project, { migrateMeshV1ToV2: true }).then(() => {
        const targets = vm.runtime.targets;
        let foundMeshV2 = false;
        targets.forEach(target => {
            const blockIds = Object.keys(target.blocks._blocks);
            blockIds.forEach(blockId => {
                const block = target.blocks._blocks[blockId];
                if (block.opcode && block.opcode.startsWith('mesh_')) {
                    t.fail(`Found legacy mesh block: ${block.opcode}`);
                }
                if (block.opcode && block.opcode.startsWith('meshV2_')) {
                    foundMeshV2 = true;
                }
            });
        });
        t.ok(foundMeshV2, 'Found at least one meshV2 block after migration');
        t.end();
    });
});

test('hasMeshV1Project detection', t => {
    const vm = new VirtualMachine();
    const meshV1Project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v1_project.json'));
    const meshV2Project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v2_project.json'));

    return vm
        .hasMeshV1Project(meshV1Project)
        .then(hasMeshV1 => {
            t.equal(hasMeshV1, true, 'detects mesh v1 project');
            return vm.hasMeshV1Project(meshV2Project);
        })
        .then(hasMeshV1 => {
            t.equal(hasMeshV1, false, 'does not detect mesh v1 in v2 project');
            t.end();
        });
});
