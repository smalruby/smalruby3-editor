// === Smalruby: This file is Smalruby-specific (module sync across sprites) ===
import RubyGenerator from './ruby-generator';
import { targetCodeToBlocks } from './ruby-to-blocks-converter';

/**
 * Get module names from a target's procedure block comments.
 * @param {object} target - A Scratch RenderedTarget
 * @returns {Set<string>} Set of module names found in the target
 */
export const getModuleNamesFromTarget = target => {
    const moduleNames = new Set();
    if (!target || !target.comments) return moduleNames;

    for (const commentId in target.comments) {
        const comment = target.comments[commentId];
        const match = comment.text && comment.text.match(/^@ruby:module_source:(.+)$/);
        if (match) {
            moduleNames.add(match[1]);
        }
    }
    return moduleNames;
};

/**
 * Find all other targets that include a given module.
 * @param {object} vm - Scratch VM
 * @param {string} moduleName - Module name to search for
 * @param {string} excludeTargetId - Target ID to exclude from results
 * @returns {Array<object>} Targets that have the module
 */
export const findTargetsWithModule = (vm, moduleName, excludeTargetId) => {
    const targets = [];
    for (const target of vm.runtime.targets) {
        if (target.id === excludeTargetId) continue;
        if (!target.comments) continue;

        for (const commentId in target.comments) {
            const comment = target.comments[commentId];
            if (comment.text === `@ruby:module_source:${moduleName}`) {
                targets.push(target);
                break;
            }
        }
    }
    return targets;
};

/**
 * Generate Ruby code for a single target (without require statements).
 * @param {object} target - A Scratch RenderedTarget
 * @param {string} version - Ruby version ('1' or '2')
 * @returns {string} Generated Ruby code
 */
export const generateTargetCode = (target, version) => {
    RubyGenerator.initTargets({});
    return RubyGenerator.targetToCode_(target, {
        version,
    });
};

/**
 * Extract a module definition (module Name ... end) from Ruby code.
 * @param {string} code - Ruby code
 * @param {string} moduleName - Module name to extract
 * @returns {string|null} The module definition code, or null if not found
 */
export const extractModuleCode = (code, moduleName) => {
    const regex = new RegExp(`^module ${moduleName}\\n[\\s\\S]*?^end\\n`, 'm');
    const match = code.match(regex);
    return match ? match[0] : null;
};

/**
 * Replace a module definition in Ruby code with a new one.
 * @param {string} code - Original Ruby code
 * @param {string} moduleName - Module name to replace
 * @param {string} newModuleCode - New module definition
 * @returns {string} Updated Ruby code
 */
export const replaceModuleCode = (code, moduleName, newModuleCode) => {
    const regex = new RegExp(`^module ${moduleName}\\n[\\s\\S]*?^end\\n`, 'm');
    return code.replace(regex, newModuleCode);
};

/**
 * Sync module changes from a source target to all other targets that include the same modules.
 * Called after Ruby→Blocks conversion completes on the source target.
 * @param {object} vm - Scratch VM
 * @param {object} sourceTarget - The target whose code was just converted
 * @param {object} intl - react-intl instance for error translation
 * @param {string} version - Ruby version ('1' or '2')
 * @returns {Promise<void>}
 */
export const syncModules = async (vm, sourceTarget, intl, version) => {
    // 1. Find which modules exist in the source target
    const moduleNames = getModuleNamesFromTarget(sourceTarget);
    if (moduleNames.size === 0) return;

    // 2. Generate Ruby code from source target to get current module definitions
    const sourceCode = generateTargetCode(sourceTarget, version);

    // 3. For each module, sync to other targets
    for (const moduleName of moduleNames) {
        const newModuleCode = extractModuleCode(sourceCode, moduleName);
        if (!newModuleCode) continue;

        const otherTargets = findTargetsWithModule(vm, moduleName, sourceTarget.id);

        for (const target of otherTargets) {
            // Generate Ruby from the other target's current blocks
            const targetCode = generateTargetCode(target, version);

            // Replace the old module definition with the new one
            const updatedCode = replaceModuleCode(targetCode, moduleName, newModuleCode);
            if (updatedCode === targetCode) continue; // No change

            // Re-convert the updated code to blocks and apply
            const converter = await targetCodeToBlocks(vm, target, updatedCode, intl, { version });
            if (converter.result) {
                await converter.apply();
            }
        }
    }
};
