// === Smalruby: This file is Smalruby-specific (DNCL to Ruby transpiler) ===

import { convertLine, resetForLoopStack } from './dncl-line-converter'
import {
  detectArrayNames,
  detectFunctionNames,
  resetFunctionScopes,
} from './dncl-state'
import { dnclV2Preprocess } from './dncl-v2-preprocessor'
import { validateDncl } from './dncl-validator'

/**
 * Transpile DNCL source code to Ruby.
 *
 * The source is first run through `dnclV2Preprocess` to normalize any
 * DNCLv2 syntax (line numbers, trailing colons, `繰り返す` suffix,
 * comma-separated multi-assignment, `and`/`or`, etc.) into the existing
 * Smalruby DNCL form. Pure Smalruby DNCL passes through unchanged.
 * @param {string} source - The DNCL source code.
 * @returns {object} An object with `ruby` (the transpiled Ruby code or
 *   `null` on validation error), `errors` (array of validation errors),
 *   and `sourceMap` (placeholder for future source mapping).
 */
const dnclToRuby = (source) => {
  const normalized = dnclV2Preprocess(source)

  const errors = validateDncl(normalized)
  if (errors.length > 0) {
    return {
      ruby: null,
      errors,
      sourceMap: null,
    }
  }

  detectArrayNames(normalized)
  detectFunctionNames(normalized)
  resetForLoopStack()
  resetFunctionScopes()

  const lines = normalized.split('\n')
  const rubyLines = lines.map((line) => convertLine(line))

  return {
    ruby: rubyLines.join('\n'),
    errors: [],
    sourceMap: null,
  }
}

export { dnclToRuby }
