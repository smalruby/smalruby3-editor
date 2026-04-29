// === Smalruby: This file is Smalruby-specific (DNCL to Ruby transpiler) ===

import { convertLine, resetForLoopStack } from './dncl-line-converter'
import { detectArrayNames, detectFunctionNames } from './dncl-state'
import { validateDncl } from './dncl-validator'

/**
 * Transpile DNCL source code to Ruby.
 * @param {string} source - The DNCL source code.
 * @returns {object} An object with `ruby` (the transpiled Ruby code or
 *   `null` on validation error), `errors` (array of validation errors),
 *   and `sourceMap` (placeholder for future source mapping).
 */
const dnclToRuby = (source) => {
  const errors = validateDncl(source)
  if (errors.length > 0) {
    return {
      ruby: null,
      errors,
      sourceMap: null,
    }
  }

  detectArrayNames(source)
  detectFunctionNames(source)
  resetForLoopStack()

  const lines = source.split('\n')
  const rubyLines = lines.map((line) => convertLine(line))

  return {
    ruby: rubyLines.join('\n'),
    errors: [],
    sourceMap: null,
  }
}

export { dnclToRuby }
