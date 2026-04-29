// === Smalruby: This file is Smalruby-specific (DNCL→Ruby identifier conversion) ===

import { DNCL_KEYWORDS, RUBY_LITERALS } from './dncl-keywords'
import {
  addArrayName,
  isArrayName,
  isFunctionName,
  mapVarName,
} from './dncl-state'
import { skipString } from './paren-utils'

/**
 * Check if a character is the start of an identifier.
 * @param {string} ch - The character to check.
 * @returns {boolean} True if the character starts an identifier.
 */
const isIdentStart = (ch) =>
  /[a-zA-Z_぀-ゟ゠-ヿ一-鿿]/.test(ch)

/**
 * Check if a character is part of an identifier.
 * @param {string} ch - The character to check.
 * @returns {boolean} True if the character is part of an identifier.
 */
const isIdentChar = (ch) =>
  /[a-zA-Z0-9_぀-ゟ゠-ヿ一-鿿]/.test(ch)

/**
 * Convert a single DNCL token/identifier to its Ruby equivalent.
 * @param {string} name - The identifier.
 * @returns {string} The Ruby variable reference.
 */
const convertIdentifier = (name) => {
  if (DNCL_KEYWORDS.has(name)) return name
  if (RUBY_LITERALS.has(name)) return name
  if (isFunctionName(name)) return name
  if (/^\d/.test(name)) return name
  if (/^[A-Z]/.test(name)) {
    return mapVarName(name, isArrayName(name))
  }
  return `@${name}`
}

/**
 * Convert Japanese bracket strings 「...」 to "..." in a line.
 * @param {string} line - The source line.
 * @returns {string} The line with converted strings.
 */
const convertJapaneseStrings = (line) => line.replace(/「([^」]*)」/g, '"$1"')

/**
 * Convert arrow assignment ← to = in a string.
 * @param {string} str - The string to convert.
 * @returns {string} The string with arrows replaced.
 */
const convertArrow = (str) => str.replace(/\s*←\s*/g, ' = ')

/**
 * Convert operators in a line segment (outside strings).
 * @param {string} segment - A code segment outside of strings.
 * @returns {string} The segment with converted operators.
 */
const convertOperators = (segment) => {
  let result = segment

  // Integer division // must be converted before single /
  result = result.replace(
    /(\S+)\s*\/\/\s*(\S+)/g,
    (_, left, right) => `(${left} / ${right}).to_i`,
  )

  result = result.replace(/÷/g, '/')
  result = result.replace(/≦/g, '<=')
  result = result.replace(/≧/g, '>=')

  // Japanese logical/boolean keywords (no \b for CJK characters)
  result = result.replace(/(?<=\s|^)かつ(?=\s|$)/g, '&&')
  result = result.replace(/(?<=\s|^)または(?=\s|$)/g, '||')
  result = result.replace(/(?<=\s|^)真(?=\s|$)/g, 'true')
  result = result.replace(/(?<=\s|^)偽(?=\s|$)/g, 'false')

  // でない is postfix: "expr でない" → "!expr"
  result = result.replace(/(\S+)\s+でない/g, (_, expr) => `!${expr}`)

  return result
}

/**
 * Convert identifiers in a code segment, adding @ prefix for variables.
 * @param {string} segment - A code segment.
 * @returns {string} The segment with converted identifiers.
 */
const convertIdentifiers = (segment) => {
  let result = ''
  let i = 0
  let afterDot = false

  while (i < segment.length) {
    if (segment[i] === '.') {
      result += '.'
      afterDot = true
      i++
      continue
    }

    if (isIdentStart(segment[i])) {
      let name = ''
      while (i < segment.length && isIdentChar(segment[i])) {
        name += segment[i]
        i++
      }

      // After '.', don't add @ prefix (e.g., .to_i, .length)
      if (afterDot) {
        result += name
        afterDot = false
        continue
      }

      // Check for array access: Name[...]
      if (/^[A-Z]/.test(name) && i < segment.length && segment[i] === '[') {
        addArrayName(name)
        result += mapVarName(name, true)
        continue
      }

      result += convertIdentifier(name)
      afterDot = false
      continue
    }

    afterDot = false
    result += segment[i]
    i++
  }

  return result
}

/**
 * Process a line, splitting it into string/non-string parts. Apply
 * conversions only to non-string parts.
 * @param {string} line - A single line of code.
 * @returns {string} The converted line.
 */
const processSegments = (line) => {
  let result = ''
  let i = 0

  while (i < line.length) {
    if (line[i] === '#') {
      // Rest is a comment, pass through
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
    // Collect non-string segment
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
      segment = convertIdentifiers(segment)
      result += segment
      i = segEnd
    }
  }

  return result
}

export {
  convertArrow,
  convertIdentifier,
  convertJapaneseStrings,
  convertOperators,
  processSegments,
}
