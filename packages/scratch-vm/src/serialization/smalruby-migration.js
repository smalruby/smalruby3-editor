/**
 * @fileoverview
 * Utilities for migrating projects from the legacy mesh extension to meshV2.
 */

const JSZip = require('jszip');

const MESH_V1_OPCODE_PREFIX = 'mesh_';
const MESH_V2_OPCODE_PREFIX = 'meshV2_';

/**
 * Rewrite a single block's opcode in place if it belongs to legacy mesh.
 * @param {object} block The block JSON.
 * @returns {boolean} True if the block was modified.
 */
const migrateBlockOpcode = (block) => {
    if (!block || typeof block.opcode !== 'string') return false;
    if (!block.opcode.startsWith(MESH_V1_OPCODE_PREFIX)) return false;
    block.opcode = MESH_V2_OPCODE_PREFIX + block.opcode.slice(MESH_V1_OPCODE_PREFIX.length);
    return true;
};

/**
 * Detect if the project contains any legacy mesh blocks.
 * @param {object} projectJSON The project JSON to check.
 * @returns {boolean} True if legacy mesh blocks are found.
 */
const detectMeshV1Blocks = (projectJSON) => {
    if (!projectJSON.targets) return false;
    for (const target of projectJSON.targets) {
        for (const blockId in target.blocks) {
            const block = target.blocks[blockId];
            if (block.opcode && block.opcode.startsWith(MESH_V1_OPCODE_PREFIX)) {
                return true;
            }
        }
    }
    return false;
};

const detectKoshien = (projectJSON) => {
    if (Array.isArray(projectJSON.extensions)) {
        return projectJSON.extensions.indexOf('koshien') !== -1;
    }
    return false;
};

/**
 * Rewrite mesh v1 opcodes in place inside a sb3-style blocks object ({blockId: block}).
 * @param {object} blocksObject The blocks object to mutate.
 * @returns {boolean} True if any block was modified.
 */
const migrateMeshV1InBlocksObject = (blocksObject) => {
    if (!blocksObject || typeof blocksObject !== 'object') return false;
    let changed = false;
    for (const blockId in blocksObject) {
        if (migrateBlockOpcode(blocksObject[blockId])) changed = true;
    }
    return changed;
};

/**
 * Rewrite mesh v1 opcodes in place inside an array of block JSON
 * (backpack "code" payloads use this shape).
 * @param {Array<object>} blockArray The array of block JSON to mutate.
 * @returns {boolean} True if any block was modified.
 */
const migrateMeshV1InBlockArray = (blockArray) => {
    if (!Array.isArray(blockArray)) return false;
    let changed = false;
    for (const block of blockArray) {
        if (migrateBlockOpcode(block)) changed = true;
    }
    return changed;
};

/**
 * Migrate the project JSON from legacy mesh to meshV2.
 * @param {object} projectJSON The project JSON to migrate.
 * @returns {object} The migrated project JSON.
 */
const migrateMeshV1Blocks = (projectJSON) => {
    const newProjectJSON = JSON.parse(JSON.stringify(projectJSON));

    // Update extensions
    if (Array.isArray(newProjectJSON.extensions)) {
        newProjectJSON.extensions = newProjectJSON.extensions.map((ext) => (ext === 'mesh' ? 'meshV2' : ext));
        if (newProjectJSON.extensions.indexOf('meshV2') === -1) {
            newProjectJSON.extensions.push('meshV2');
        }
    } else {
        newProjectJSON.extensions = ['meshV2'];
    }

    // Update opcodes
    if (Array.isArray(newProjectJSON.targets)) {
        for (const target of newProjectJSON.targets) {
            migrateMeshV1InBlocksObject(target.blocks);
        }
    }

    return newProjectJSON;
};

/**
 * Migrate a sprite3 zip buffer (used by backpack sprite payloads). The zip's
 * sprite.json `blocks` and `extensions` fields are rewritten if mesh v1 is found.
 * @param {ArrayBuffer | Uint8Array} zipInput The sprite3 zip buffer.
 * @returns {Promise<{changed: boolean, buffer: ArrayBuffer | Uint8Array}>}
 *     Resolves with the new buffer (re-zipped only if changed). When unchanged,
 *     the original buffer reference is returned to avoid wasted work.
 */
const migrateMeshV1InSprite3Zip = async (zipInput) => {
    const zip = await JSZip.loadAsync(zipInput);
    const spriteJsonFile = zip.file('sprite.json');
    if (!spriteJsonFile) return { changed: false, buffer: zipInput };
    const spriteJsonStr = await spriteJsonFile.async('string');
    const spriteJson = JSON.parse(spriteJsonStr);

    let changed = false;
    if (spriteJson.blocks && migrateMeshV1InBlocksObject(spriteJson.blocks)) {
        changed = true;
    }
    if (Array.isArray(spriteJson.extensions)) {
        const replaced = spriteJson.extensions.map((ext) => (ext === 'mesh' ? 'meshV2' : ext));
        if (replaced.some((ext, i) => ext !== spriteJson.extensions[i])) {
            spriteJson.extensions = replaced;
            if (spriteJson.extensions.indexOf('meshV2') === -1) {
                spriteJson.extensions.push('meshV2');
            }
            changed = true;
        }
    }

    if (!changed) return { changed: false, buffer: zipInput };

    zip.file('sprite.json', JSON.stringify(spriteJson));
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    return { changed: true, buffer };
};

module.exports = {
    detectMeshV1Blocks,
    detectKoshien,
    migrateMeshV1Blocks,
    migrateMeshV1InBlockArray,
    migrateMeshV1InBlocksObject,
    migrateMeshV1InSprite3Zip,
};
