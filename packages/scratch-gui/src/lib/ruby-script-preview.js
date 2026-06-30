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
