// === Smalruby: This file is Smalruby-specific (debug globals for Playwright MCP) ===

/**
 * Update window.smalruby debug globals for browser console and Playwright MCP.
 * @param {object} vm - The Scratch VM instance.
 * @param {object} autoCorrectState - { enabled, settings } for auto-correct.
 */
const updateDebugGlobals = (vm, autoCorrectState) => {
    if (!window.smalruby) window.smalruby = {};
    window.smalruby.vm = vm;
    if (vm.editingTarget) {
        window.smalruby.sprite = vm.editingTarget;
        window.smalruby.blocks = vm.editingTarget.blocks;
        window.smalruby.comments = vm.editingTarget.comments;
    }
    window.smalruby.stage = vm.runtime ? vm.runtime.getTargetForStage() : null;
    window.smalruby.runtime = vm.runtime;
    window.smalruby.autoCorrect = autoCorrectState;
};

export default updateDebugGlobals;
