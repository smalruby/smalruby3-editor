// === Smalruby: This file is Smalruby-specific (DNCL to Ruby transpiler) ===

import { convertLine, resetForLoopStack } from './dncl-line-converter'
import { DnclSourceMap } from './dncl-source-map'
import {
  detectArrayNames,
  detectFunctionNames,
  resetFunctionScopes,
} from './dncl-state'
import { dnclV2PreprocessWithLineMap } from './dncl-v2-preprocessor'
import { findDnclBlockErrors, validateDncl } from './dncl-validator'

/**
 * Transpile DNCL source code to Ruby.
 *
 * The source is first run through `dnclV2PreprocessWithLineMap` to normalize
 * any DNCLv2 syntax (line numbers, trailing colons, `繰り返す` suffix,
 * comma-separated multi-assignment, `and`/`or`, etc.) into the existing
 * Smalruby DNCL form. Pure Smalruby DNCL passes through unchanged.
 *
 * Both the pre-processor and the line converter may change the line count
 * (joined / split lines, added closers, 2-line input and counting loops), so
 * the line correspondence is tracked line by line instead of being guessed
 * from the sources afterwards.
 * @param {string} source - The DNCL source code.
 * @returns {object} An object with `ruby` (the transpiled Ruby code or
 *   `null` on validation error), `errors` (array of validation errors whose
 *   `line` is the DNCL source line), and `sourceMap` (a `DnclSourceMap`
 *   between `source` and `ruby`, or `null` on validation error), and
 *   `blockErrors` (a missing or extra closer said in the words of DNCL, on
 *   DNCL source lines; the Ruby is still made, and these are shown instead
 *   of the converter's missing / extra `end` when it fails — Issue #1419).
 */
const dnclToRuby = (source) => {
  const { source: normalized, lineMap } = dnclV2PreprocessWithLineMap(source)
  const sourceLineCount = source.split('\n').length

  const errors = validateDncl(normalized)
  if (errors.length > 0) {
    return {
      ruby: null,
      errors: errors.map((err) => ({
        ...err,
        line: lineMap[err.line - 1] || err.line,
      })),
      sourceMap: null,
      blockErrors: [],
    }
  }

  detectArrayNames(normalized)
  detectFunctionNames(normalized)
  resetForLoopStack()
  resetFunctionScopes()

  const lines = normalized.split('\n')
  const rubyLines = []
  const rubyToDncl = []
  lines.forEach((line, idx) => {
    for (const rubyLine of convertLine(line).split('\n')) {
      rubyLines.push(rubyLine)
      rubyToDncl.push(lineMap[idx])
    }
  })

  return {
    ruby: rubyLines.join('\n'),
    errors: [],
    sourceMap: new DnclSourceMap(rubyToDncl, sourceLineCount),
    blockErrors: findDnclBlockErrors(normalized).map((err) => ({
      ...err,
      line: lineMap[err.line - 1] || err.line,
    })),
  }
}

export { dnclToRuby }
