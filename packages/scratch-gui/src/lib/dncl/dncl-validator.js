// === Smalruby: This file is Smalruby-specific (DNCL source validator) ===

/**
 * Validate DNCL source for forbidden characters. DNCL variables cannot use
 * `@` or `$` prefixes.
 * @param {string} source - The DNCL source code.
 * @returns {Array<object>} Array of error objects with `line`, `column`,
 *   and `message`.
 */
const validateDncl = (source) => {
  const errors = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Skip comments
    const commentIdx = line.indexOf('#')
    const code = commentIdx >= 0 ? line.substring(0, commentIdx) : line
    // Check for @ or $ outside strings
    let inString = false
    let quote = null
    for (let j = 0; j < code.length; j++) {
      if (inString) {
        if (code[j] === '\\') {
          j++
          continue
        }
        if (code[j] === quote) {
          inString = false
        }
        continue
      }
      if (code[j] === '"' || code[j] === "'") {
        inString = true
        quote = code[j]
        continue
      }
      if (code[j] === '@' || code[j] === '$') {
        errors.push({
          line: i + 1,
          column: j + 1,
          message: `日本語モードでは変数に「${code[j]}」は使えません`,
        })
      }
    }
  }
  return errors
}

export { validateDncl }
