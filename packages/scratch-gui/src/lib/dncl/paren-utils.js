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

export { skipString, findMatchingClose, replaceCall, splitArgsAtTopLevel }
