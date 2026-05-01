import JSZip from 'jszip';
import {
    migrateMeshV1InLocalStorageBackpack,
    STORAGE_KEY,
    MIGRATED_AT_KEY,
} from '../../../src/lib/backpack-mesh-v1-migration';

const decodeB64 = b64 => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

const encodeB64 = bytes => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

const makeFakeVm = () => ({
    migrateMeshV1InBackpackBlocks: jest.fn(blocks => {
        let changed = false;
        if (Array.isArray(blocks)) {
            for (const b of blocks) {
                if (b && typeof b.opcode === 'string' && b.opcode.startsWith('mesh_')) {
                    b.opcode = `meshV2_${b.opcode.slice('mesh_'.length)}`;
                    changed = true;
                }
            }
        }
        return changed;
    }),
    migrateMeshV1InBackpackSprite: jest.fn(async buf => {
        const zip = await JSZip.loadAsync(buf);
        const json = JSON.parse(await zip.file('sprite.json').async('string'));
        let changed = false;
        if (json.blocks) {
            for (const id in json.blocks) {
                const b = json.blocks[id];
                if (b.opcode && b.opcode.startsWith('mesh_')) {
                    b.opcode = `meshV2_${b.opcode.slice('mesh_'.length)}`;
                    changed = true;
                }
            }
        }
        if (!changed) return { changed: false, buffer: buf };
        zip.file('sprite.json', JSON.stringify(json));
        const newBuf = await zip.generateAsync({ type: 'arraybuffer' });
        return { changed: true, buffer: newBuf };
    }),
});

const makeScriptItem = (id, opcodes) => {
    const blocks = opcodes.map((opcode, i) => ({ opcode, id: `b${i}` }));
    return {
        id,
        type: 'script',
        mime: 'application/json',
        name: 'code',
        body: encodeB64(new TextEncoder().encode(JSON.stringify(blocks))),
        thumbnail: '',
    };
};

const makeSpriteItem = async (id, opcodes) => {
    const zip = new JSZip();
    const blocks = {};
    opcodes.forEach((opcode, i) => {
        blocks[`b${i}`] = { opcode };
    });
    zip.file('sprite.json', JSON.stringify({ name: 'sprite1', blocks, extensions: ['mesh'] }));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    return {
        id,
        type: 'sprite',
        mime: 'application/zip',
        name: 'sprite1',
        body: encodeB64(new Uint8Array(buf)),
        thumbnail: '',
    };
};

describe('migrateMeshV1InLocalStorageBackpack', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('returns 0 and sets flag when backpack is empty', async () => {
        const vm = makeFakeVm();
        const count = await migrateMeshV1InLocalStorageBackpack(vm);
        expect(count).toBe(0);
        expect(localStorage.getItem(MIGRATED_AT_KEY)).toBeTruthy();
        expect(vm.migrateMeshV1InBackpackBlocks).not.toHaveBeenCalled();
    });

    test('rewrites v1 opcodes inside script items', async () => {
        const item = makeScriptItem('s1', ['mesh_getSensorValue', 'motion_movesteps']);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([item]));

        const count = await migrateMeshV1InLocalStorageBackpack(makeFakeVm());
        expect(count).toBe(1);

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const blocks = JSON.parse(new TextDecoder().decode(decodeB64(stored[0].body)));
        expect(blocks[0].opcode).toBe('meshV2_getSensorValue');
        expect(blocks[1].opcode).toBe('motion_movesteps');
        expect(localStorage.getItem(MIGRATED_AT_KEY)).toBeTruthy();
    });

    test('rewrites v1 opcodes inside sprite zip items', async () => {
        const item = await makeSpriteItem('sp1', ['mesh_getSensorValue', 'motion_movesteps']);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([item]));

        const count = await migrateMeshV1InLocalStorageBackpack(makeFakeVm());
        expect(count).toBe(1);

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const zip = await JSZip.loadAsync(decodeB64(stored[0].body).buffer);
        const json = JSON.parse(await zip.file('sprite.json').async('string'));
        expect(json.blocks.b0.opcode).toBe('meshV2_getSensorValue');
        expect(json.blocks.b1.opcode).toBe('motion_movesteps');
    });

    test('skips items already migrated and reports correct count', async () => {
        const v1 = makeScriptItem('s1', ['mesh_getSensorValue']);
        const v2 = makeScriptItem('s2', ['meshV2_getSensorValue']);
        const other = makeScriptItem('s3', ['motion_movesteps']);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([v1, v2, other]));

        const count = await migrateMeshV1InLocalStorageBackpack(makeFakeVm());
        expect(count).toBe(1);
    });

    test('is a no-op once the migrated-at flag is set', async () => {
        const item = makeScriptItem('s1', ['mesh_getSensorValue']);
        localStorage.setItem(STORAGE_KEY, JSON.stringify([item]));
        localStorage.setItem(MIGRATED_AT_KEY, '2026-05-01T00:00:00.000Z');

        const vm = makeFakeVm();
        const count = await migrateMeshV1InLocalStorageBackpack(vm);
        expect(count).toBe(0);
        expect(vm.migrateMeshV1InBackpackBlocks).not.toHaveBeenCalled();

        // Body left unchanged because we skipped the migration.
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const blocks = JSON.parse(new TextDecoder().decode(decodeB64(stored[0].body)));
        expect(blocks[0].opcode).toBe('mesh_getSensorValue');
    });

    test('sets flag and skips on malformed JSON in storage', async () => {
        localStorage.setItem(STORAGE_KEY, 'not-json');
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const count = await migrateMeshV1InLocalStorageBackpack(makeFakeVm());
        expect(count).toBe(0);
        expect(localStorage.getItem(MIGRATED_AT_KEY)).toBeTruthy();
        warn.mockRestore();
    });
});
