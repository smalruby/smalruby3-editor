const test = require('tap').test;
const Runtime = require('../../src/engine/runtime');
const BlockType = require('../../src/extension-support/block-type');

const categoryInfo = {
    id: 'testcat',
    name: 'Test',
    color1: '#111111',
    color2: '#222222',
    color3: '#333333',
    blocks: [],
    customFieldTypes: {},
    menus: [],
    menuInfo: {}
};

const convert = (rt, blockInfo) => rt._convertForScratchBlocks(blockInfo, categoryInfo);

// Modern Blockly (scratch-blocks v2) only draws the cap-hat shape for blocks
// carrying the `shape_hat` extension. Verify the extension-block conversion adds
// it for HAT/EVENT blocks (so e.g. koshien connect_game renders as a hat) and
// does not turn COMMAND blocks into hats.
test('extension HAT/EVENT blocks get the shape_hat extension', t => {
    const rt = new Runtime();

    const hat = convert(rt, {opcode: 'whenX', blockType: BlockType.HAT, text: 'when X', arguments: {}});
    t.ok(hat.json.extensions, 'HAT has an extensions array');
    t.ok(hat.json.extensions.includes('shape_hat'), 'HAT has shape_hat');
    t.equal(hat.json.previousStatement, undefined, 'HAT has no previous connection');
    t.equal(hat.json.nextStatement, null, 'HAT has a next connection');

    const event = convert(rt, {opcode: 'onX', blockType: BlockType.EVENT, text: 'on X', arguments: {}});
    t.ok(event.json.extensions.includes('shape_hat'), 'EVENT has shape_hat');

    const cmd = convert(rt, {opcode: 'doX', blockType: BlockType.COMMAND, text: 'do X', arguments: {}});
    t.notOk(
        cmd.json.extensions && cmd.json.extensions.includes('shape_hat'),
        'COMMAND does not get shape_hat'
    );
    t.equal(cmd.json.previousStatement, null, 'COMMAND keeps its previous connection');

    // a HAT with an icon keeps the icon extension AND gains shape_hat
    const hatWithIcon = convert(rt, {
        opcode: 'whenIcon',
        blockType: BlockType.HAT,
        text: 'when icon',
        arguments: {},
        blockIconURI: 'data:image/png;base64,AAAA'
    });
    t.ok(hatWithIcon.json.extensions.includes('shape_hat'), 'icon HAT has shape_hat');
    t.ok(hatWithIcon.json.extensions.includes('scratch_extension'), 'icon HAT keeps scratch_extension');

    t.end();
});
