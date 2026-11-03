const path = require('path');
const test = require('tap').test;
const readFileToBuffer = require('../../fixtures/readProjectFile').readFileToBuffer;
const VirtualMachine = require('../../../src/index');

test('mesh v1 to v2 migration integration', (t) => {
    const vm = new VirtualMachine();
    const project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v1_project.json'));

    return vm.loadProject(project, { migrateMeshV1ToV2: true }).then(() => {
        const targets = vm.runtime.targets;
        let foundMeshV2 = false;
        targets.forEach((target) => {
            const blockIds = Object.keys(target.blocks._blocks);
            blockIds.forEach((blockId) => {
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

test('hasMeshV1Project detection', (t) => {
    const vm = new VirtualMachine();
    const meshV1Project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v1_project.json'));
    const meshV2Project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v2_project.json'));

    return vm
        .hasMeshV1Project(meshV1Project)
        .then((hasMeshV1) => {
            t.equal(hasMeshV1, true, 'detects mesh v1 project');
            return vm.hasMeshV1Project(meshV2Project);
        })
        .then((hasMeshV1) => {
            t.equal(hasMeshV1, false, 'does not detect mesh v1 in v2 project');
            t.end();
        });
});

// The legacy mesh runtime (SkyWay) has been removed (#1329). Every load path must migrate
// mesh v1 blocks to v2 inside the VM so nothing tries to load the `mesh` extension anymore.
const assertNoMeshV1 = (t, vm) => {
    t.notOk(vm.extensionManager.isExtensionLoaded('mesh'), 'legacy mesh extension is not loaded');
    t.ok(vm.extensionManager.isExtensionLoaded('meshV2'), 'mesh v2 extension is loaded');
    vm.runtime.targets.forEach((target) => {
        Object.values(target.blocks._blocks).forEach((block) => {
            t.notOk(block.opcode.startsWith('mesh_'), `no legacy mesh block remains: ${block.opcode}`);
        });
    });
};

test('loadProject migrates mesh v1 blocks even without the migrateMeshV1ToV2 option', (t) => {
    const vm = new VirtualMachine();
    const project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v1_project.json'));

    return vm.loadProject(project).then(() => {
        assertNoMeshV1(t, vm);
        t.end();
    });
});

test('addSprite migrates mesh v1 blocks', (t) => {
    const vm = new VirtualMachine();
    const project = JSON.parse(readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v1_project.json')));
    const sprite = project.targets.find((target) => !target.isStage);
    sprite.name = 'mesh v1 sprite';

    return vm
        .loadProject(readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v2_project.json')))
        .then(() => vm.addSprite(JSON.stringify(sprite)))
        .then(() => {
            t.ok(vm.runtime.getSpriteTargetByName('mesh v1 sprite'), 'sprite is added');
            assertNoMeshV1(t, vm);
            t.end();
        });
});

test('shareBlocksToTarget migrates mesh v1 blocks', (t) => {
    const vm = new VirtualMachine();
    const project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v2_project.json'));

    return vm
        .loadProject(project)
        .then(() => {
            const target = vm.runtime.targets.find((x) => !x.isStage);
            const blocks = [
                {
                    id: 'legacy-sensor',
                    opcode: 'mesh_getSensorValue',
                    inputs: {},
                    fields: {},
                    next: null,
                    parent: null,
                    shadow: false,
                    topLevel: true,
                    x: 0,
                    y: 0,
                },
            ];
            return vm.shareBlocksToTarget(blocks, target.id);
        })
        .then(() => {
            assertNoMeshV1(t, vm);
            t.end();
        });
});
