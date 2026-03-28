import { LegacyStorage } from '../../../src/lib/legacy-storage';

const STORAGE_KEY = 'smalrubyBackpack';

describe('LegacyStorage - setBackpackHost', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('registers webstore for remote host', () => {
        const storage = new LegacyStorage();
        const addWebStoreSpy = jest.spyOn(storage.scratchStorage, 'addWebStore');

        storage.setBackpackHost('https://backpack.example.com');

        expect(addWebStoreSpy).toHaveBeenCalled();
    });

    test('only registers webstore once for the same storage instance', () => {
        const storage = new LegacyStorage();
        const addWebStoreSpy = jest.spyOn(storage.scratchStorage, 'addWebStore');

        storage.setBackpackHost('https://backpack.example.com');
        const callsAfterFirst = addWebStoreSpy.mock.calls.length;

        storage.setBackpackHost('https://backpack2.example.com');
        const callsAfterSecond = addWebStoreSpy.mock.calls.length;

        expect(callsAfterFirst).toBe(1);
        expect(callsAfterSecond).toBe(1);
    });

    test('getBackpackAssetURL returns data: URL from localStorage when host is localStorage', () => {
        const items = [
            {
                id: 'abc123',
                mime: 'image/svg+xml',
                body: 'PHN2Zy8+', // base64 of '<svg/>'
            },
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

        const storage = new LegacyStorage();
        const addWebStoreSpy = jest.spyOn(storage.scratchStorage, 'addWebStore');

        storage.setBackpackHost('localStorage');

        // Capture the URL getter registered with addWebStore
        const registeredGetter = addWebStoreSpy.mock.calls[0][1];

        // The getter should return a data: URL for a known localStorage asset
        const url = registeredGetter({ assetId: 'abc123', dataFormat: 'svg' });
        expect(url).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    });

    test('getBackpackAssetURL returns false for unknown localStorage asset', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));

        const storage = new LegacyStorage();
        const addWebStoreSpy = jest.spyOn(storage.scratchStorage, 'addWebStore');

        storage.setBackpackHost('localStorage');

        const registeredGetter = addWebStoreSpy.mock.calls[0][1];
        const url = registeredGetter({ assetId: 'unknown', dataFormat: 'svg' });
        expect(url).toBe(false);
    });

    test('getBackpackAssetURL returns path URL for remote host', () => {
        const storage = new LegacyStorage();
        const addWebStoreSpy = jest.spyOn(storage.scratchStorage, 'addWebStore');

        storage.setBackpackHost('https://backpack.example.com');

        const registeredGetter = addWebStoreSpy.mock.calls[0][1];
        const url = registeredGetter({ assetId: 'abc123', dataFormat: 'svg' });
        expect(url).toBe('https://backpack.example.com/abc123.svg');
    });
});
