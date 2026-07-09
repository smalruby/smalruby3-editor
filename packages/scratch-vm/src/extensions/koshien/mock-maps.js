/**
 * Original 17x17 practice maps bundled with the Koshien mock game.
 *
 * These maps were designed for Smalruby (they are NOT competition maps) but
 * follow the same conventions a real match map does, so an AI debugged here
 * behaves the same way in a real match:
 *   - 17x17 field surrounded by an unbreakable wall border,
 *   - exactly one goal cell reachable from both start cells without
 *     breaking any wall,
 *   - beneficial (a-e) and harmful (A-D) items placed on open cells.
 *
 * Cell characters: 0 space, 1/2 unbreakable wall, 3 goal, 4 water,
 * 5 breakable wall; a-e beneficial items, A-D harmful items (an item cell
 * is an open space with the item on it).
 */

const MOCK_MAPS = [
    {
        id: 'meadow',
        name: 'そうげん (meadow)',
        starts: [[3, 2], [13, 2]],
        rows: [
            '22222222222222222',
            '20000000000000001',
            '20000000000000001',
            '20220222022202201',
            '2000000000000c001',
            '20a00000000000001',
            '20005550005550001',
            '2000500b000500001',
            '20005000000500A01',
            '20005000300500001',
            '2B005000000500001',
            '20005550005550001',
            '20000000d00000001',
            '20000000000000001',
            '204440000000444e1',
            '2000000C000000001',
            '21111111111111111'
        ]
    },
    {
        id: 'canal',
        name: 'すいろ (canal)',
        starts: [[1, 1], [15, 15]],
        rows: [
            '22222222222222222',
            '20000400000040001',
            '20a00400b00040c01',
            '20000400000040001',
            '24444400000044441',
            '20000000000000001',
            '20000005550000001',
            '2000A005e50000B01',
            '20000005350000001',
            '20000005050000001',
            '20000000000000001',
            '24444000000444441',
            '20000400000040001',
            '20d00400C00040b01',
            '20000400000040D01',
            '20000400000040001',
            '21111111111111111'
        ]
    },
    {
        id: 'vault',
        name: 'くら (vault)',
        starts: [[8, 1], [8, 15]],
        rows: [
            '22222222222222222',
            '20000000000000001',
            '20111110001111101',
            '2000000000000a001',
            '20b00555555500001',
            '20005000000500001',
            '20005000000500c01',
            '20005003000000001',
            '20005000000500001',
            '2A005000000500001',
            '20005555555500001',
            '2000000e000000001',
            '20111110001111101',
            '2000000000000B001',
            '20d00000000000001',
            '2000000C000000d01',
            '21111111111111111'
        ]
    },
    {
        id: 'maze',
        name: 'めいろ (maze)',
        starts: [[1, 15], [15, 1]],
        rows: [
            '22222222222222222',
            '20000000000000001',
            '20111011111101101',
            '2000100a000100001',
            '21010111101011101',
            '2001000000010b001',
            '20110101110110101',
            '20010c0100A100101',
            '21010101310101011',
            '20010101010101001',
            '20110101010101101',
            '2001010001d100001',
            '20010111110111011',
            '2011000B000000001',
            '20010111011011101',
            '20e0000001000C001',
            '21111111111111111'
        ]
    }
];

/**
 * Look up a bundled map by id, falling back to the first map.
 * @param {string} mapId - the map id.
 * @returns {object} - the map definition.
 */
const findMockMap = mapId => MOCK_MAPS.find(m => m.id === mapId) || MOCK_MAPS[0];

module.exports = {
    MOCK_MAPS,
    findMockMap
};
