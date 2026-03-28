/**
 * @fileoverview
 * Utilities for migrating projects from the legacy mesh extension to meshV2.
 */

/**
 * Detect if the project contains any legacy mesh blocks.
 * @param {object} projectJSON The project JSON to check.
 * @returns {boolean} True if legacy mesh blocks are found.
 */
const detectMeshV1Blocks = projectJSON => {
    if (!projectJSON.targets) return false;
    for (const target of projectJSON.targets) {
        for (const blockId in target.blocks) {
            const block = target.blocks[blockId];
            if (block.opcode && block.opcode.startsWith('mesh_')) {
                return true;
            }
        }
    }
    return false;
};

const detectKoshien = projectJSON => {
    if (Array.isArray(projectJSON.extensions)) {
        return projectJSON.extensions.indexOf('koshien') !== -1;
    }
    return false;
};

/**
 * Migrate the project JSON from legacy mesh to meshV2.
 * @param {object} projectJSON The project JSON to migrate.
 * @returns {object} The migrated project JSON.
 */
const migrateMeshV1Blocks = projectJSON => {
    const newProjectJSON = JSON.parse(JSON.stringify(projectJSON));

    // Update extensions
    if (Array.isArray(newProjectJSON.extensions)) {
        newProjectJSON.extensions = newProjectJSON.extensions.map(ext => (ext === 'mesh' ? 'meshV2' : ext));
        if (newProjectJSON.extensions.indexOf('meshV2') === -1) {
            newProjectJSON.extensions.push('meshV2');
        }
    } else {
        newProjectJSON.extensions = ['meshV2'];
    }

    // Update opcodes
    for (const target of newProjectJSON.targets) {
        for (const blockId in target.blocks) {
            const block = target.blocks[blockId];
            if (block.opcode && block.opcode.startsWith('mesh_')) {
                block.opcode = block.opcode.replace('mesh_', 'meshV2_');
            }
        }
    }

    return newProjectJSON;
};

module.exports = {
    detectMeshV1Blocks,
    detectKoshien,
    migrateMeshV1Blocks,
};
