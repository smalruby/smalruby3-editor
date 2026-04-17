const test = require('tap').test;
const path = require('path');
const fs = require('fs');
const {
    detectMeshV1Blocks,
    detectKoshien,
    migrateMeshV1Blocks,
    migrateStringMethodBlocks,
} = require('../../src/serialization/smalruby-migration');

const meshV1Project = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../fixtures/mesh_v1_project.json'), 'utf8'),
);
const meshV2Project = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../fixtures/mesh_v2_project.json'), 'utf8'),
);

test('detectMeshV1Blocks', t => {
    t.equal(detectMeshV1Blocks(meshV1Project), true, 'detects mesh v1 blocks');
    t.equal(detectMeshV1Blocks(meshV2Project), false, 'does not detect mesh v1 blocks in v2 project');
    t.equal(detectMeshV1Blocks({ targets: [] }), false, 'does not detect mesh v1 blocks in empty project');
    t.end();
});

test('detectKoshien', t => {
    t.equal(detectKoshien({ extensions: ['koshien'] }), true, 'detects koshien extension');
    t.equal(detectKoshien({ extensions: ['meshV2'] }), false, 'does not detect koshien if not present');
    t.equal(detectKoshien({}), false, 'does not detect koshien in project without extensions');
    t.end();
});

test('migrateMeshV1Blocks', t => {
    const migrated = migrateMeshV1Blocks(meshV1Project);

    t.not(migrated, meshV1Project, 'returns a new object');

    // Check extensions
    t.ok(migrated.extensions.includes('meshV2'), 'extensions includes meshV2');
    t.notOk(migrated.extensions.includes('mesh'), 'extensions does not include mesh');

    // Check opcodes
    let foundMeshV2 = false;
    migrated.targets.forEach(target => {
        Object.values(target.blocks).forEach(block => {
            if (typeof block.opcode === 'string') {
                t.notOk(block.opcode.startsWith('mesh_'), `opcode ${block.opcode} should not start with mesh_`);
                if (block.opcode.startsWith('meshV2_')) {
                    foundMeshV2 = true;
                }
            }
        });
    });
    t.ok(foundMeshV2, 'found at least one meshV2 block');

    t.end();
});

test('migrateStringMethodBlocks', t => {
    const project = {
        targets: [{
            blocks: {
                a: {opcode: 'smalrubyRuby_stringMethodR'},
                b: {opcode: 'smalrubyRuby_stringMethodC'},
                c: {opcode: 'smalrubyRuby_methodR'},
                d: {opcode: 'motion_movesteps'},
            }
        }]
    };
    migrateStringMethodBlocks(project);
    t.equal(project.targets[0].blocks.a.opcode, 'smalrubyRuby_methodR', 'stringMethodR migrated');
    t.equal(project.targets[0].blocks.b.opcode, 'smalrubyRuby_methodC', 'stringMethodC migrated');
    t.equal(project.targets[0].blocks.c.opcode, 'smalrubyRuby_methodR', 'methodR unchanged');
    t.equal(project.targets[0].blocks.d.opcode, 'motion_movesteps', 'unrelated unchanged');
    t.end();
});
