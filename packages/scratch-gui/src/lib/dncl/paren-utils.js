// === Smalruby: This file is Smalruby-specific (DNCL paren utilities) ===

/**
 * Find the end of a string literal starting at position `start`.
 * Handles escape sequences (`\\X`) by skipping the escaped character.
 * Returns the position immediately after the closing quote, or the end of
 * the line if the string is unterminated.
 * @param {string} line - The source line.
 * @param {number} start - Starting position (at the opening quote).
 * @param {string} quote - The quote character (`"` or `'`).
 * @returns {number} The position after the closing quote.
 */
const skipString = (line, start, quote) => {
  let i = start + 1
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2
      continue
    }
    if (line[i] === quote) {
      return i + 1
    }
    i++
  }
  return i
}

/**
 * Find the matching close paren for an open paren at `openParenPos`.
 * Skips parens inside string literals (single or double quoted).
 * @param {string} text - The text to scan.
 * @param {number} openParenPos - Position of the open paren `(`.
 * @returns {number} Position of the matching close paren, or -1 if unmatched.
 */
const findMatchingClose = (text, openParenPos) => {
  let depth = 1
  let i = openParenPos + 1
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' || ch === "'") {
      i = skipString(text, i, ch)
      continue
    }
    if (ch === '(') {
      depth++
    } else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

/**
 * Replace `name(...)` calls with the result of `transform(args)`.
 * Uses balanced-paren matching so nested function calls don't confuse the
 * boundary. Skips occurrences inside string literals.
 *
 * Args are processed recursively before being passed to `transform`, so
 * nested same-name calls (e.g. `f(f(x))`) are handled in a single call.
 * @param {string} text - Source text.
 * @param {string} name - Function name to match (e.g. `表示する`).
 * @param {Function} transform - Receives the raw args string (after
 *   recursive processing of any same-name calls inside) and returns the
 *   full replacement text.
 * @returns {string} Text with all occurrences of `name(...)` transformed.
 */
const replaceCall = (text, name, transform) => {
  let result = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(text, i, ch)
      result += text.substring(i, end)
      i = end
      continue
    }
    if (text.startsWith(name, i) && text[i + name.length] === '(') {
      const openPos = i + name.length
      const closePos = findMatchingClose(text, openPos)
      if (closePos === -1) {
        result += ch
        i++
        continue
      }
      const rawArgs = text.substring(openPos + 1, closePos)
      // Recursively process so nested same-name calls (f(f(x))) work.
      const args = replaceCall(rawArgs, name, transform)
      result += transform(args)
      i = closePos + 1
      continue
    }
    result += ch
    i++
  }
  return result
}

/**
 * Split function args by top-level commas (depth 0). Skips commas inside
 * nested parens or string literals.
 * @param {string} args - The args string between the outer parens.
 * @returns {Array<string>} Array of trimmed argument strings.
 */
const splitArgsAtTopLevel = (args) => {
  const parts = []
  let depth = 0
  let current = ''
  let i = 0
  while (i < args.length) {
    const ch = args[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(args, i, ch)
      current += args.substring(i, end)
      i = end
      continue
    }
    if (ch === '(') {
      depth++
      current += ch
      i++
      continue
    }
    if (ch === ')') {
      depth--
      current += ch
      i++
      continue
    }
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      i++
      continue
    }
    current += ch
    i++
  }
  if (current.length > 0 || parts.length > 0) {
    parts.push(current.trim())
  }
  return parts
}

/**
 * Wrap every top-level `/` in `line` with `.to_i` so that DNCL division
 * truncates like Ruby integer-division. Skips occurrences inside string
 * literals and inside the `//` integer-divide alias (which is handled
 * elsewhere). Operands are determined by walking outward across balanced
 * parens / brackets and stopping at lower-precedence boundaries (operators,
 * commas, assignment, statement edges).
 *
 * Examples:
 *   `a / b`             → `(a / b).to_i`
 *   `(a + b) / c`       → `((a + b) / c).to_i`
 *   `a + b / c`         → `a + (b / c).to_i`
 *   `Data[i + 1] / 2`   → `(Data[i + 1] / 2).to_i`
 *   `a / b * c`         → `(a / b).to_i * c`
 * @param {string} line - A Ruby-form line (post DNCL transforms).
 * @returns {string} The line with every `/` wrapped in `.to_i`.
 */
const wrapIntegerDivisions = (line) => {
  // Operator characters that, if they appear as the FIRST char of the
  // captured left operand, indicate we walked into a no-op sequence —
  // skip wrapping in that case. `(` / `[` / `{` are NOT boundaries because
  // a parenthesized / indexed expression is a valid left operand.
  const INVALID_LEFT_FIRST = new Set([
    '+',
    '-',
    '*',
    '/',
    '%',
    '<',
    '>',
    '=',
    '!',
    '&',
    '|',
    '?',
    ':',
    ',',
    ';',
    '\n',
  ])

  // Walk LEFT from `endExclusive - 1` in `s` to find the start of the
  // operand. Skips balanced (), [], {} and string literals.
  const findLeftOperandStart = (s, endExclusive) => {
    let i = endExclusive - 1
    while (i >= 0 && /\s/.test(s[i])) i--
    if (i < 0) return null
    while (i >= 0) {
      const ch = s[i]
      if (ch === ')' || ch === ']' || ch === '}') {
        const close = ch
        const open = close === ')' ? '(' : close === ']' ? '[' : '{'
        let depth = 1
        i--
        while (i >= 0 && depth > 0) {
          const c = s[i]
          if (c === '"' || c === "'") {
            // Skip string backwards.
            i--
            while (i >= 0 && s[i] !== c) {
              if (i > 0 && s[i - 1] === '\\') i--
              i--
            }
            i--
            continue
          }
          if (c === close) depth++
          else if (c === open) depth--
          i--
        }
        // i is one before the matching open; continue back to absorb
        // any preceding identifier (function/array name) or chained dot.
        continue
      }
      if (/[\w@$.]/.test(ch)) {
        i--
        continue
      }
      // Stop at boundary or whitespace before boundary.
      break
    }
    // i is one before the operand's first char.
    let start = i + 1
    // Trim leading whitespace.
    while (start < endExclusive && /\s/.test(s[start])) start++
    return start
  }

  // Walk RIGHT from `startInclusive` in `s` to find the index just past
  // the end of the operand. Skips balanced parens / strings.
  const findRightOperandEnd = (s, startInclusive) => {
    let i = startInclusive
    while (i < s.length && /\s/.test(s[i])) i++
    if (i >= s.length) return null
    // Optional unary +/- sign.
    if (s[i] === '+' || s[i] === '-') i++
    while (i < s.length) {
      const ch = s[i]
      if (ch === '(' || ch === '[' || ch === '{') {
        const open = ch
        const close = open === '(' ? ')' : open === '[' ? ']' : '}'
        let depth = 1
        i++
        while (i < s.length && depth > 0) {
          const c = s[i]
          if (c === '"' || c === "'") {
            i = skipString(s, i, c)
            continue
          }
          if (c === open) depth++
          else if (c === close) depth--
          i++
        }
        continue
      }
      if (ch === '"' || ch === "'") {
        i = skipString(s, i, ch)
        continue
      }
      if (/[\w@$.]/.test(ch)) {
        i++
        continue
      }
      break
    }
    return i
  }

  // Iteratively wrap each `/` (left-to-right). After each wrap, the
  // result string changes length so we re-scan from the start.
  let s = line
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '"' || ch === "'") {
      i = skipString(s, i, ch)
      continue
    }
    if (ch === '#') {
      // Rest of line is a comment.
      break
    }
    if (ch === '/' && s[i - 1] !== '/' && s[i + 1] !== '/') {
      // Skip if this `/` is already inside a `(... / ...).to_i` we
      // produced earlier — detect by checking the trailing `.to_i`.
      // We only care that the left/right operand isn't itself a
      // freshly-generated wrapper.
      const leftStart = findLeftOperandStart(s, i)
      const rightEnd = findRightOperandEnd(s, i + 1)
      if (leftStart === null || rightEnd === null || leftStart >= i) {
        i++
        continue
      }
      const leftOperand = s.substring(leftStart, i).trimEnd()
      const rightOperand = s.substring(i + 1, rightEnd).trimStart()
      // Skip if leftOperand is empty or starts with a non-operand char.
      if (!leftOperand || INVALID_LEFT_FIRST.has(leftOperand[0])) {
        i++
        continue
      }
      // Already wrapped? Detect the surrounding `(... / ...).to_i` shape
      // produced by an earlier pass (or by the `//` rewrite upstream) so we
      // don't emit `((... / ...).to_i).to_i`.
      if (
        leftStart > 0 &&
        s[leftStart - 1] === '(' &&
        s.substring(rightEnd, rightEnd + 6) === ').to_i'
      ) {
        i = rightEnd + 6
        continue
      }
      const replacement = `(${leftOperand} / ${rightOperand}).to_i`
      s = s.substring(0, leftStart) + replacement + s.substring(rightEnd)
      // Resume scanning AFTER the inserted `.to_i` so we don't re-process
      // the same `/`.
      i = leftStart + replacement.length
      continue
    }
    i++
  }
  return s
}

/**
 * Inverse of `wrapIntegerDivisions`: strip `(EXPR).to_i` when EXPR contains
 * a top-level `/`. DNCL division is integer division by convention so the
 * explicit `.to_i` is redundant — preserving it would surface as
 * `整数((... / ...))` after the standard `.to_i → 整数()` rewrite, which
 * obscures the original intent.
 *
 * Examples:
 *   `(a / b).to_i`             → `a / b`
 *   `(Data[i] / 2).to_i`       → `Data[i] / 2`
 *   `(answer).to_i`            → `(answer).to_i` (no `/`, untouched)
 *   `(a + (b / c).to_i).to_i`  → `(a + (b / c).to_i).to_i` (outer EXPR
 *     contains no top-level `/`; the inner one is reachable on its own and
 *     gets stripped on a subsequent pass)
 * @param {string} line - Ruby-form line.
 * @returns {string} Line with redundant int-division `.to_i` wrappers stripped.
 */
const stripIntegerDivisionToI = (line) => {
  const containsTopLevelSlash = (s) => {
    let depth = 0
    let i = 0
    while (i < s.length) {
      const ch = s[i]
      if (ch === '"' || ch === "'") {
        i = skipString(s, i, ch)
        continue
      }
      if (ch === '(' || ch === '[' || ch === '{') depth++
      else if (ch === ')' || ch === ']' || ch === '}') depth--
      else if (
        ch === '/' &&
        depth === 0 &&
        s[i - 1] !== '/' &&
        s[i + 1] !== '/'
      ) {
        return true
      }
      i++
    }
    return false
  }

  let result = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(line, i, ch)
      result += line.substring(i, end)
      i = end
      continue
    }
    if (ch === '(') {
      const close = findMatchingClose(line, i)
      if (close !== -1 && line.substring(close + 1, close + 6) === '.to_i') {
        const inner = line.substring(i + 1, close)
        if (containsTopLevelSlash(inner)) {
          // Recursively strip nested wrappers in `inner` before emitting.
          result += stripIntegerDivisionToI(inner)
          i = close + 6 // past `.to_i`
          continue
        }
      }
    }
    result += ch
    i++
  }
  return result
}

export {
  skipString,
  findMatchingClose,
  replaceCall,
  splitArgsAtTopLevel,
  wrapIntegerDivisions,
  stripIntegerDivisionToI,
}
