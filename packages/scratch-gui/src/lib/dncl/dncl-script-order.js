// === Smalruby: This file is Smalruby-specific (the order of the scripts in the Japanese tab) ===
import RubyGenerator from '../ruby-generator';

/**
 * The Ruby the Japanese tab shows for the blocks of a target (issue #2550).
 *
 * The Ruby of the Ruby tab puts the function definitions first, since Ruby calls a method only
 * after it is defined. The Japanese tab keeps the scripts in the order they were written, so a
 * function defined after the main program stays after it after a trip through the code tab.
 *
 * Only Ruby generated from the blocks of the target is put back in that order: other Ruby (text
 * the editor holds that the blocks do not have yet) is returned as it is.
 * @param {object} target - The target the Ruby was generated from (null when there is none).
 * @param {string} code - The Ruby of the Ruby tab.
 * @param {string|number} version - The Ruby version the code was generated for.
 * @returns {string} The Ruby to turn into Japanese.
 */
const rubyInScriptOrder = (target, code, version) => {
    if (!target || !target.blocks) return code;
    if (RubyGenerator.targetToCode(target, { version }) !== code) return code;
    return RubyGenerator.targetToCode(target, { version, keepScriptOrder: true });
};

export { rubyInScriptOrder };
