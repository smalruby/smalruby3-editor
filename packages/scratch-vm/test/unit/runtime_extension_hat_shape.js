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
    menuInfo: {},
};

const convert = (rt, blockInfo) => rt._convertForScratchBlocks(blockInfo, categoryInfo);

// Modern Blockly (scratch-blocks v2) drives block coloring from `style` (a named
// theme block-style registered per extension category id) and draws the cap-hat
// shape only for blocks carrying the `shape_hat` extension. The extension-block
// conversion in runtime.js must therefore use `style: categoryInfo.id` and seed
// an `extensions` array, then push `shape_hat` for HAT/EVENT and `monitor_block`
// for monitorable reporters. This mirrors upstream scratch-vm v13.7.2 (the
// baseline that ships scratch-blocks v2.1.19).
test('extension blocks use style + extensions array (modern Blockly)', (t) => {
    const rt = new Runtime();

    const cmd = convert(rt, { opcode: 'doX', blockType: BlockType.COMMAND, text: 'do X', arguments: {} });
    t.equal(cmd.json.style, 'testcat', 'block JSON uses style = categoryInfo.id');
    t.notOk('colour' in cmd.json, 'block JSON no longer carries a raw colour');
    t.ok(Array.isArray(cmd.json.extensions), 'block JSON seeds an extensions array');

    t.end();
});

test('extension HAT/EVENT blocks get the shape_hat extension', (t) => {
    const rt = new Runtime();

    const hat = convert(rt, { opcode: 'whenX', blockType: BlockType.HAT, text: 'when X', arguments: {} });
    t.ok(hat.json.extensions.includes('shape_hat'), 'HAT has shape_hat');
    t.equal(hat.json.previousStatement, undefined, 'HAT has no previous connection');
    t.equal(hat.json.nextStatement, null, 'HAT has a next connection');

    const event = convert(rt, { opcode: 'onX', blockType: BlockType.EVENT, text: 'on X', arguments: {} });
    t.ok(event.json.extensions.includes('shape_hat'), 'EVENT has shape_hat');

    const cmd = convert(rt, { opcode: 'doX', blockType: BlockType.COMMAND, text: 'do X', arguments: {} });
    t.notOk(cmd.json.extensions.includes('shape_hat'), 'COMMAND does not get shape_hat');
    t.equal(cmd.json.previousStatement, null, 'COMMAND keeps its previous connection');

    // a HAT with an icon keeps the icon extension AND gains shape_hat
    const hatWithIcon = convert(rt, {
        opcode: 'whenIcon',
        blockType: BlockType.HAT,
        text: 'when icon',
        arguments: {},
        blockIconURI: 'data:image/png;base64,AAAA',
    });
    t.ok(hatWithIcon.json.extensions.includes('shape_hat'), 'icon HAT has shape_hat');
    t.ok(hatWithIcon.json.extensions.includes('scratch_extension'), 'icon HAT keeps scratch_extension');

    t.end();
});

test('monitorable reporters get the monitor_block extension', (t) => {
    const rt = new Runtime();

    const reporter = convert(rt, { opcode: 'getX', blockType: BlockType.REPORTER, text: 'x', arguments: {} });
    t.ok(reporter.json.extensions.includes('monitor_block'), 'no-input reporter has monitor_block');
    t.notOk('checkboxInFlyout' in reporter.json, 'reporter no longer sets checkboxInFlyout directly');

    const disabled = convert(rt, {
        opcode: 'getY',
        blockType: BlockType.REPORTER,
        text: 'y',
        arguments: {},
        disableMonitor: true,
    });
    t.notOk(disabled.json.extensions.includes('monitor_block'), 'disableMonitor reporter omits monitor_block');

    t.end();
});
