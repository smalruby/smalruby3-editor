const tap = require('tap');

// Test hiraganaToHex conversion
// The mapping: い→0, し→1, か→2, た→3, う→4, ん→5, て→6, と→7
//              の→8, つ→9, は→a, こ→b, に→c, な→d, く→e, き→f

const {
    hiraganaToHex,
    MESH_ID_LABEL_CHARACTERS,
    MESH_ID_LABEL_REVERSE
} = require('../../../../src/extensions/scratch3_mesh_v2/name-search-utils');

tap.test('MESH_ID_LABEL_REVERSE has all 16 hiragana characters', t => {
    const expectedChars = ['い', 'し', 'か', 'た', 'う', 'ん', 'て', 'と',
        'の', 'つ', 'は', 'こ', 'に', 'な', 'く', 'き'];
    expectedChars.forEach(char => {
        t.ok(MESH_ID_LABEL_REVERSE[char] !== undefined,
            `${char} should be in reverse mapping`);
    });
    t.equal(Object.keys(MESH_ID_LABEL_REVERSE).length, 16);
    t.end();
});

tap.test('MESH_ID_LABEL_REVERSE is consistent with MESH_ID_LABEL_CHARACTERS', t => {
    Object.entries(MESH_ID_LABEL_CHARACTERS).forEach(([hex, hiragana]) => {
        t.equal(MESH_ID_LABEL_REVERSE[hiragana], hex,
            `reverse of ${hiragana} should be ${hex}`);
    });
    t.end();
});

tap.test('hiraganaToHex converts single character', t => {
    t.equal(hiraganaToHex('い'), '0');
    t.equal(hiraganaToHex('し'), '1');
    t.equal(hiraganaToHex('き'), 'f');
    t.end();
});

tap.test('hiraganaToHex converts 6-character string', t => {
    // しかたうんて → 123456
    t.equal(hiraganaToHex('しかたうんて'), '123456');
    // いいいいいい → 000000
    t.equal(hiraganaToHex('いいいいいい'), '000000');
    // きききききき → ffffff
    t.equal(hiraganaToHex('きききききき'), 'ffffff');
    t.end();
});

tap.test('hiraganaToHex returns null for invalid characters', t => {
    t.equal(hiraganaToHex('あ'), null, 'あ is not in mapping');
    t.equal(hiraganaToHex('しかたX'), null, 'X is not in mapping');
    t.equal(hiraganaToHex('ABC'), null, 'ASCII not in mapping');
    t.end();
});

tap.test('hiraganaToHex returns null for empty/null input', t => {
    t.equal(hiraganaToHex(''), null);
    t.equal(hiraganaToHex(null), null);
    t.equal(hiraganaToHex(undefined), null);
    t.end();
});

tap.test('hiraganaToHex round-trips with makeMeshIdLabel pattern', t => {
    // Simulate what makeMeshIdLabel does: hex → hiragana
    const hexPrefix = 'abcdef';
    const hiragana = [...hexPrefix].map(c => MESH_ID_LABEL_CHARACTERS[c]).join('');
    // Then reverse: hiragana → hex
    const result = hiraganaToHex(hiragana);
    t.equal(result, hexPrefix, 'round-trip should preserve value');
    t.end();
});
