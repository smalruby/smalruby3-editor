/* eslint-env jest */
import {
    KOSHIEN_MOCK_MAPS,
    STORAGE_KEY,
    loadKoshienMockConfig,
    normalizeKoshienMockConfig,
    saveKoshienMockConfig,
    wireKoshienMockConfig,
} from '../../../src/lib/koshien-mock-config';

describe('koshien-mock-config', () => {
    beforeEach(() => window.localStorage.clear());

    test('exposes the bundled practice maps', () => {
        expect(KOSHIEN_MOCK_MAPS.length).toBeGreaterThanOrEqual(3);
        for (const map of KOSHIEN_MOCK_MAPS) {
            expect(typeof map.id).toBe('string');
            expect(map.rows).toHaveLength(17);
        }
    });

    test('load returns valid defaults when nothing is saved', () => {
        expect(loadKoshienMockConfig()).toEqual({
            mapId: KOSHIEN_MOCK_MAPS[0].id,
            side: 1,
            rival: 'goal',
        });
    });

    test('save + load round-trips valid settings', () => {
        saveKoshienMockConfig({ mapId: 'canal', side: 2, rival: 'stop' });
        expect(loadKoshienMockConfig()).toEqual({ mapId: 'canal', side: 2, rival: 'stop' });
    });

    test('normalize clamps unknown values to safe defaults', () => {
        expect(normalizeKoshienMockConfig({ mapId: 'nope', side: 9, rival: 'cheat' })).toEqual({
            mapId: KOSHIEN_MOCK_MAPS[0].id,
            side: 1,
            rival: 'goal',
        });
    });

    test('load survives corrupted storage', () => {
        window.localStorage.setItem(STORAGE_KEY, '{not json');
        expect(loadKoshienMockConfig().side).toBe(1);
    });

    test('wire installs the runtime getter', () => {
        const vm = { runtime: {} };
        saveKoshienMockConfig({ mapId: 'maze', side: 2, rival: 'random' });
        wireKoshienMockConfig(vm);
        expect(vm.runtime.getKoshienMockConfig()).toEqual({
            mapId: 'maze',
            side: 2,
            rival: 'random',
        });
        expect(() => wireKoshienMockConfig(null)).not.toThrow();
    });
});
