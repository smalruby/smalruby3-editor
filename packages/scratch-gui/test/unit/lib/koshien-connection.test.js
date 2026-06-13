import {
    loadKoshienConnection,
    saveKoshienConnection,
    buildKoshienRemoteOptions,
    wireKoshienRemoteOptions,
    testKoshienConnection,
    STORAGE_KEY,
} from '../../../src/lib/koshien-connection';

describe('koshien-connection', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('save then load round-trips and normalizes side', () => {
        saveKoshienConnection({ endpoint: 'http://x:3000', side: '2', gameCode: 'g1' });
        expect(loadKoshienConnection()).toEqual({ endpoint: 'http://x:3000', side: 2, gameCode: 'g1' });
        saveKoshienConnection({ endpoint: 'http://x:3000', side: 'weird' });
        expect(loadKoshienConnection().side).toBe(1);
    });

    test('buildKoshienRemoteOptions returns null with no endpoint, options when set', () => {
        expect(buildKoshienRemoteOptions()).toBeNull();
        saveKoshienConnection({ endpoint: 'http://x:3000', side: 2, gameCode: 'g1' });
        const opts = buildKoshienRemoteOptions();
        expect(opts.endpoint).toBe('http://x:3000');
        expect(opts.side).toBe(2);
        expect(opts.gameCode).toBe('g1');
        expect(typeof opts.playerId).toBe('string');
        expect(opts.playerId.length).toBeGreaterThan(0);
        // playerId is stable across calls
        expect(buildKoshienRemoteOptions().playerId).toBe(opts.playerId);
    });

    test('wireKoshienRemoteOptions installs the getter on the runtime', () => {
        const vm = { runtime: {} };
        wireKoshienRemoteOptions(vm);
        expect(typeof vm.runtime.getKoshienRemoteOptions).toBe('function');
        expect(vm.runtime.getKoshienRemoteOptions()).toBeNull();
        saveKoshienConnection({ endpoint: 'http://y:3000' });
        expect(vm.runtime.getKoshienRemoteOptions().endpoint).toBe('http://y:3000');
    });

    test('loadKoshienConnection tolerates corrupt storage', () => {
        window.localStorage.setItem(STORAGE_KEY, '{not json');
        expect(loadKoshienConnection()).toEqual({});
    });

    test('testKoshienConnection reports reachable on response, unreachable on throw', async () => {
        const okFetch = () => Promise.resolve({ status: 401 });
        await expect(testKoshienConnection('http://x:3000', okFetch)).resolves.toEqual({
            ok: true,
            message: 'reachable (status 401)',
        });
        const badFetch = () => Promise.reject(new Error('network down'));
        const res = await testKoshienConnection('http://x:3000', badFetch);
        expect(res.ok).toBe(false);
        expect(res.message).toMatch(/network down/);
    });
});
