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

// The mesh v1 extension (and skyway-js) has been removed. Loads that do not pass
// migrateMeshV1ToV2 (e.g. the default project fetcher or teacher submissions) must still
// rewrite v1 blocks instead of trying to load "mesh" as an extension URL.
const collectOpcodes = (vm) =>
    vm.runtime.targets.flatMap((target) =>
        Object.keys(target.blocks._blocks).map((blockId) => target.blocks._blocks[blockId].opcode),
    );

test('mesh v1 project loads as v2 even without migrateMeshV1ToV2', (t) => {
    const vm = new VirtualMachine();
    const project = readFileToBuffer(path.resolve(__dirname, '../../fixtures/mesh_v1_project.json'));

    return vm.loadProject(project).then(() => {
        const opcodes = collectOpcodes(vm);
        t.notOk(
            opcodes.some((opcode) => opcode.startsWith('mesh_')),
            'no legacy mesh blocks remain',
        );
        t.ok(
            opcodes.some((opcode) => opcode.startsWith('meshV2_')),
            'legacy blocks were rewritten to meshV2',
        );
        t.notOk(vm.extensionManager.isExtensionLoaded('mesh'), 'legacy mesh extension is not loaded');
        t.ok(vm.extensionManager.isExtensionLoaded('meshV2'), 'meshV2 extension is loaded');
        t.end();
    });
});

test('project whose extensions list still has "mesh" but no mesh blocks loads', (t) => {
    const vm = new VirtualMachine();
    const project = require('../../fixtures/mesh_v1_project.json');
    const json = JSON.parse(JSON.stringify(project));
    json.targets.forEach((target) => {
        target.blocks = {};
    });

    return vm.loadProject(json).then(() => {
        t.notOk(vm.extensionManager.isExtensionLoaded('mesh'), 'legacy mesh extension is not loaded');
        t.end();
    });
});

test('sprite with mesh v1 blocks is added as v2', (t) => {
    const vm = new VirtualMachine();
    const project = require('../../fixtures/mesh_v1_project.json');
    const emptyProject = JSON.parse(JSON.stringify(project));
    emptyProject.extensions = [];
    emptyProject.targets = emptyProject.targets.filter((target) => target.isStage);
    emptyProject.targets[0].blocks = {};
    const sprite = JSON.parse(JSON.stringify(project.targets.find((target) => !target.isStage)));
    sprite.extensions = ['mesh'];

    return vm
        .loadProject(emptyProject)
        .then(() => vm.addSprite(JSON.stringify(sprite)))
        .then(() => {
            const opcodes = collectOpcodes(vm);
            t.notOk(
                opcodes.some((opcode) => opcode.startsWith('mesh_')),
                'no legacy mesh blocks remain',
            );
            t.ok(
                opcodes.some((opcode) => opcode.startsWith('meshV2_')),
                'legacy blocks were rewritten to meshV2',
            );
            t.notOk(vm.extensionManager.isExtensionLoaded('mesh'), 'legacy mesh extension is not loaded');
            t.end();
        });
});
