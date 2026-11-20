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
