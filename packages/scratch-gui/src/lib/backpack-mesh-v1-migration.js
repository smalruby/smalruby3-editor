// Eager mesh v1 → v2 migration for backpack contents stored in localStorage.
// Skyway (the v1 backend) shut down — see Issue #592. We rewrite any v1 opcodes
// inside scripts and sprite zips at app startup so users never restore v1 blocks
// from the backpack. Once migrated for a given browser, a flag in localStorage
// keeps subsequent runs as a no-op.

const STORAGE_KEY = 'smalrubyBackpack';
const MIGRATED_AT_KEY = 'smalruby:meshV1BackpackMigratedAt';

const decodeBase64 = b64 => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
};

const encodeBase64 = bytes => {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

const migrateScriptItem = (item, vm) => {
    try {
        const decoded = decodeBase64(item.body);
        const json = JSON.parse(new TextDecoder().decode(decoded));
        if (!vm.migrateMeshV1InBackpackBlocks(json)) return false;
        const reEncoded = new TextEncoder().encode(JSON.stringify(json));
        item.body = encodeBase64(reEncoded);
        return true;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Smalruby] failed to migrate backpack script item', item.id, e);
        return false;
    }
};

const migrateSpriteItem = async (item, vm) => {
    try {
        const buf = decodeBase64(item.body).buffer;
        const { changed, buffer } = await vm.migrateMeshV1InBackpackSprite(buf);
        if (!changed) return false;
        // The local `item` reference is exclusively mutated here; suppress the
        // false-positive race-condition warning from require-atomic-updates.
        // eslint-disable-next-line require-atomic-updates
        item.body = encodeBase64(new Uint8Array(buffer));
        return true;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Smalruby] failed to migrate backpack sprite item', item.id, e);
        return false;
    }
};

/**
 * Scan localStorage backpack contents and rewrite any mesh v1 opcodes to mesh v2.
 * Idempotent — sets a "migrated at" flag so subsequent calls are no-ops.
 * @param {VirtualMachine} vm Scratch VM instance (provides the migration helpers).
 * @returns {Promise<number>} Number of migrated items (0 if already migrated or empty).
 */
const migrateMeshV1InLocalStorageBackpack = async vm => {
    if (typeof window === 'undefined' || !window.localStorage) return 0;
    if (window.localStorage.getItem(MIGRATED_AT_KEY)) return 0;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        window.localStorage.setItem(MIGRATED_AT_KEY, new Date().toISOString());
        return 0;
    }
    let backpack;
    try {
        backpack = JSON.parse(raw);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Smalruby] backpack localStorage entry is not valid JSON; skipping migration', e);
        window.localStorage.setItem(MIGRATED_AT_KEY, new Date().toISOString());
        return 0;
    }
    if (!Array.isArray(backpack)) {
        window.localStorage.setItem(MIGRATED_AT_KEY, new Date().toISOString());
        return 0;
    }

    let count = 0;
    for (const item of backpack) {
        if (!item || typeof item !== 'object') continue;
        let changed = false;
        if (item.type === 'script') {
            changed = migrateScriptItem(item, vm);
        } else if (item.type === 'sprite') {
            changed = await migrateSpriteItem(item, vm);
        }
        if (changed) count += 1;
    }
    if (count > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(backpack));
    }
    window.localStorage.setItem(MIGRATED_AT_KEY, new Date().toISOString());
    return count;
};

export { migrateMeshV1InLocalStorageBackpack, STORAGE_KEY, MIGRATED_AT_KEY };
