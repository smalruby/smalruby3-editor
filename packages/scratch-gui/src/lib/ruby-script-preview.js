// === Smalruby: This file is Smalruby-specific (Ruby script preview code generation) ===
import RubyGenerator from './ruby-generator';

/**
 * Whether the stage contributes anything to the program: any non-broadcast
 * variable/list (which needs initialization) or any script. Used to avoid
 * emitting an empty `Stage.new(...) do end` / `class Stage` when the stage has
 * nothing for the previewed sprite to depend on.
 * @param {object} stage - The stage target.
 * @returns {boolean} True if the stage should be included in the preview.
 */
const stageHasContent = (stage) => {
    if (!stage) return false;
    const hasVariables =
        stage.variables && Object.keys(stage.variables).some((id) => stage.variables[id].type !== 'broadcast_msg');
    if (hasVariables) return true;
    const scripts = stage.blocks && typeof stage.blocks.getScripts === 'function' ? stage.blocks.getScripts() : [];
    return scripts.length > 0;
};

/**
 * Generate the final Ruby code for the editing target, including require
 * statements and class wrapping.
 *
 * When editing a sprite, the stage is emitted first so that global variables
 * and lists (created as "for all sprites", e.g. a koshien result list such as
 * `$最短経路`) are initialized in the stage's def initialize. Otherwise sending
 * only the sprite would leave those globals as nil at runtime. (Issue #827)
 * @param {object} target - The editing target (sprite or stage).
 * @param {string} version - Ruby version ('1' or '2').
 * @returns {string} The generated Ruby code.
 */
export const generatePreviewCode = (target, version) => {
    if (!target) return '';

    const options = {
        requires: ['smalruby3'],
        withSpriteNew: true,
        version,
    };

    const stage =
        target.runtime && typeof target.runtime.getTargetForStage === 'function'
            ? target.runtime.getTargetForStage()
            : null;

    // Stage first so its global initialization runs before the sprite. If the
    // editing target is itself the stage, emit it alone. Skip an empty stage so
    // the preview is not cluttered with an initializer-less Stage.
    const targets = stage && stage !== target && stageHasContent(stage) ? [stage, target] : [target];

    return RubyGenerator.targetsToCode(targets, options);
};

/**
 * Generate the final Ruby code for the WHOLE project (stage + every sprite),
 * i.e. the complete AI program — the same thing "Save AI" writes to a `.rb`
 * file. This is what koshien actually runs, so features that play the project
 * (e.g. "Test AI") must use this, not a single editing target's slice.
 *
 * The stage is emitted first (index 0) so its global initialization runs before
 * the sprites, then sprites in their sprite-pane order. Unsaved Ruby-tab edits
 * for the currently edited target are honored via `options.targetsCode` (the
 * raw Ruby is injected verbatim, exactly as the save path does), so testing
 * reflects what the user sees even before the edits are converted back to
 * blocks.
 * @param {object} vm - The Scratch VM (provides `runtime.targets`).
 * @param {object} params - Project state needed to order and complete targets.
 * @param {object} params.stage - The stage descriptor (`{id}`) from redux.
 * @param {object} params.sprites - Map of sprite id -> `{id, order}` from redux.
 * @param {string} params.version - Ruby version ('1' or '2').
 * @param {object} [params.rubyCode] - Pending Ruby-tab state
 *   (`{modified, code, target}`). When modified, the raw code is injected for
 *   its target so unsaved edits are included.
 * @param {boolean} [params.forSave] - Generate in the save format (adds
 *   `.with_screen_refresh` to loops on Ruby v2). Off for the preview/test
 *   format that the game viewer URL has always used.
 * @returns {string} The generated Ruby code for the whole project.
 */
export const generateProjectCode = (vm, { stage, sprites, version, rubyCode, forSave = false } = {}) => {
    if (!vm || !vm.runtime || !Array.isArray(vm.runtime.targets) || !stage) return '';

    const idToTarget = {};
    vm.runtime.targets.forEach((target) => {
        idToTarget[target.id] = target;
    });

    // Stage at index 0, sprites at `order + 1` (mirrors the save path so that
    // "Test AI" and "Save AI" generate the identical set of targets).
    const targets = [idToTarget[stage.id]];
    for (const id in sprites) {
        targets[sprites[id].order + 1] = idToTarget[id];
    }

    const options = {
        requires: ['smalruby3'],
        withSpriteNew: true,
        version,
    };
    if (forSave) {
        options.forSave = true;
    }
    if (rubyCode && rubyCode.modified && rubyCode.target) {
        options.targetsCode = { [rubyCode.target.id]: rubyCode.code };
    }

    return RubyGenerator.targetsToCode(targets.filter(Boolean), options);
};
