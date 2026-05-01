const test = require('tap').test;
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');
const {
    detectMeshV1Blocks,
    detectKoshien,
    migrateMeshV1Blocks,
    migrateMeshV1InBlockArray,
    migrateMeshV1InBlocksObject,
    migrateMeshV1InSprite3Zip,
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

test('migrateMeshV1InBlockArray rewrites in place', t => {
    const blocks = [
        { opcode: 'mesh_getSensorValue', inputs: {}, fields: {} },
        { opcode: 'mesh_menu_variableNames', inputs: {}, fields: {} },
        { opcode: 'motion_movesteps', inputs: {}, fields: {} },
    ];
    const changed = migrateMeshV1InBlockArray(blocks);
    t.equal(changed, true, 'reports changed');
    t.equal(blocks[0].opcode, 'meshV2_getSensorValue', 'rewrites first opcode');
    t.equal(blocks[1].opcode, 'meshV2_menu_variableNames', 'rewrites second opcode');
    t.equal(blocks[2].opcode, 'motion_movesteps', 'leaves unrelated opcodes alone');
    t.end();
});

test('migrateMeshV1InBlockArray returns false on no-op', t => {
    const blocks = [{ opcode: 'meshV2_getSensorValue' }, { opcode: 'motion_movesteps' }];
    t.equal(migrateMeshV1InBlockArray(blocks), false, 'no v1 opcodes -> no change');
    t.equal(migrateMeshV1InBlockArray(null), false, 'null input -> no change');
    t.equal(migrateMeshV1InBlockArray('not-an-array'), false, 'non-array input -> no change');
    t.end();
});

test('migrateMeshV1InBlocksObject rewrites in place', t => {
    const blocks = {
        a: { opcode: 'mesh_getSensorValue' },
        b: { opcode: 'mesh_menu_variableNames' },
        c: { opcode: 'motion_movesteps' },
    };
    const changed = migrateMeshV1InBlocksObject(blocks);
    t.equal(changed, true, 'reports changed');
    t.equal(blocks.a.opcode, 'meshV2_getSensorValue', 'rewrites a');
    t.equal(blocks.b.opcode, 'meshV2_menu_variableNames', 'rewrites b');
    t.equal(blocks.c.opcode, 'motion_movesteps', 'leaves c alone');
    t.end();
});

test('migrateMeshV1InSprite3Zip rewrites sprite.json', async t => {
    const original = new JSZip();
    original.file(
        'sprite.json',
        JSON.stringify({
            name: 'スプライト1',
            blocks: {
                x: { opcode: 'mesh_getSensorValue' },
                y: { opcode: 'mesh_menu_variableNames' },
                z: { opcode: 'motion_movesteps' },
            },
            extensions: ['mesh'],
        }),
    );
    original.file('asset/foo.svg', '<svg/>');
    const buffer = await original.generateAsync({ type: 'arraybuffer' });

    const { changed, buffer: newBuffer } = await migrateMeshV1InSprite3Zip(buffer);
    t.equal(changed, true, 'reports changed');
    t.not(newBuffer, buffer, 'returns a new buffer');

    const reloaded = await JSZip.loadAsync(newBuffer);
    const spriteJson = JSON.parse(await reloaded.file('sprite.json').async('string'));
    t.equal(spriteJson.blocks.x.opcode, 'meshV2_getSensorValue', 'rewrites x');
    t.equal(spriteJson.blocks.y.opcode, 'meshV2_menu_variableNames', 'rewrites y');
    t.equal(spriteJson.blocks.z.opcode, 'motion_movesteps', 'leaves z alone');
    t.ok(spriteJson.extensions.includes('meshV2'), 'extensions has meshV2');
    t.notOk(spriteJson.extensions.includes('mesh'), 'extensions does not have mesh');
    t.ok(reloaded.file('asset/foo.svg'), 'preserves other zip entries');
});

test('migrateMeshV1InSprite3Zip is no-op for v2 sprite', async t => {
    const original = new JSZip();
    original.file(
        'sprite.json',
        JSON.stringify({
            blocks: { x: { opcode: 'meshV2_getSensorValue' } },
            extensions: ['meshV2'],
        }),
    );
    const buffer = await original.generateAsync({ type: 'arraybuffer' });

    const { changed, buffer: newBuffer } = await migrateMeshV1InSprite3Zip(buffer);
    t.equal(changed, false, 'reports unchanged');
    t.equal(newBuffer, buffer, 'returns the same buffer reference');
});
