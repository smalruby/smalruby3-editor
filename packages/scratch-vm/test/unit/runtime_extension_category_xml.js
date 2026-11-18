const test = require('tap').test;
const Runtime = require('../../src/engine/runtime');

const buildRuntimeWithCategory = () => {
    const rt = new Runtime();
    rt._blockInfo = [
        {
            id: 'meshV2',
            name: 'Mesh',
            color1: '#0FBD8C',
            color2: '#0DA57A',
            menuIconURI: '',
            blockIconURI: '',
            showStatusButton: true,
            blocks: [
                {
                    info: {hideFromPalette: false, filter: undefined},
                    xml: '<block type="meshV2_getSensorValue"/>',
                },
            ],
        },
    ];
    return rt;
};

test('extension category XML carries toolboxitemid so Blockly v12 preserves the real extension id', t => {
    const rt = buildRuntimeWithCategory();
    const xml = rt.getBlocksXML()[0].xml;
    t.match(xml, /toolboxitemid="meshV2"/, 'category XML includes toolboxitemid');
    t.match(xml, /id="meshV2"/, 'category XML preserves legacy id attribute');
    t.match(xml, /showStatusButton="true"/, 'category XML preserves showStatusButton');
    t.end();
});

test('a label block info becomes a flyout label with escaped text', t => {
    const rt = new Runtime();
    const converted = rt._convertForScratchBlocks({blockType: 'label', text: 'Robot <car> & "arm"'}, {id: 'x'});
    t.equal(converted.xml, '<label text="Robot &lt;car&gt; &amp; &quot;arm&quot;"></label>');
    t.notOk(converted.json, 'a label is not a block');
    t.end();
});
