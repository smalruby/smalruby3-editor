// === Smalruby: This file is Smalruby-specific (Ruby script preview code generation) ===
import RubyGenerator from './ruby-generator'

/**
 * Generate the final Ruby code for a single target, including require
 * statements and class wrapping.
 * @param {object} target - The editing target (sprite or stage).
 * @param {string} version - Ruby version ('1' or '2').
 * @returns {string} The generated Ruby code.
 */
export const generatePreviewCode = (target, version) => {
  if (!target) return ''

  return RubyGenerator.targetToCode(target, {
    requires: ['smalruby3'],
    withSpriteNew: true,
    version,
  })
}
