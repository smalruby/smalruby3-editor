// === Smalruby: This file is Smalruby-specific (Ruby→DNCL identifier conversion) ===

import { skipString } from './paren-utils'

/** Regex character class for identifiers: word chars + CJK (hiragana, katakana, kanji). */
const ID = '\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF'

/**
 * Convert a Ruby variable reference back to DNCL name.
 * `@_var_X_` → `X`, `@_array_X_` → `X`, `@x` → `x`.
 * @param {string} segment - Code segment.
 * @returns {string} Segment with Ruby vars converted to DNCL.
 */
const convertVarRefs = (segment) => {
  let result = segment
  // @_array_Name_ → Name
  result = result.replace(new RegExp(`@_array_([${ID}]+)_`, 'g'), '$1')
  // @_var_Name_ → Name
  result = result.replace(new RegExp(`@_var_([${ID}]+)_`, 'g'), '$1')
  // @name → name (but not @@ or @_ prefixed patterns already handled)
  result = result.replace(new RegExp(`@([${ID}]+)`, 'g'), '$1')
  return result
}

/**
 * Convert Ruby operators back to DNCL operators.
 * @param {string} segment - Code segment outside strings.
 * @returns {string} Segment with DNCL operators.
 */
const convertOperators = (segment) => {
  let result = segment
  result = result.replace(/(?<=\s|^)&&(?=\s|$)/g, 'かつ')
  result = result.replace(/(?<=\s|^)\|\|(?=\s|$)/g, 'または')
  result = result.replace(/(?<=\s|^)true(?=\s|$)/g, '真')
  result = result.replace(/(?<=\s|^)false(?=\s|$)/g, '偽')

  // !expr → expr でない (handle @-prefixed vars too)
  result = result.replace(new RegExp(`!(@?[${ID}]+)`, 'g'), '$1 でない')

  return result
}

/**
 * Process a line, applying conversions only outside strings and comments.
 * @param {string} line - A line of code.
 * @returns {string} The converted line.
 */
const processSegments = (line) => {
  let result = ''
  let i = 0

  while (i < line.length) {
    if (line[i] === '#') {
      result += line.substring(i)
      break
    }
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i]
      const end = skipString(line, i, quote)
      result += line.substring(i, end)
      i = end
      continue
    }
    let segEnd = i
    while (segEnd < line.length) {
      if (
        line[segEnd] === '"' ||
        line[segEnd] === "'" ||
        line[segEnd] === '#'
      ) {
        break
      }
      segEnd++
    }
    if (segEnd > i) {
      let segment = line.substring(i, segEnd)
      segment = convertOperators(segment)
      segment = convertVarRefs(segment)
      result += segment
      i = segEnd
    }
  }

  return result
}

export { ID, convertOperators, convertVarRefs, processSegments }
