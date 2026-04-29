// === Smalruby: This file is Smalruby-specific (DNCL to Ruby transpiler) ===

/**
 * Map an identifier from DNCL to Ruby variable name.
 * - Lowercase identifiers → `@name`
 * - Uppercase identifiers with array value → `@_array_Name_`
 * - Uppercase identifiers without array value → `@_var_Name_`
 * @param {string} name - The DNCL identifier.
 * @param {boolean} isArray - Whether the identifier is used as an array.
 * @returns {string} The Ruby variable name.
 */
const mapVarName = (name, isArray = false) => {
  if (/^[A-Z]/.test(name)) {
    return isArray ? `@_array_${name}_` : `@_var_${name}_`
  }
  return `@${name}`
}

/**
 * Check if a character is the start of an identifier.
 * @param {string} ch - The character to check.
 * @returns {boolean} True if the character starts an identifier.
 */
const isIdentStart = (ch) =>
  /[a-zA-Z_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(ch)

/**
 * Check if a character is part of an identifier.
 * @param {string} ch - The character to check.
 * @returns {boolean} True if the character is part of an identifier.
 */
const isIdentChar = (ch) =>
  /[a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(ch)

/**
 * Known DNCL keywords that should NOT be treated as variable references.
 */
const DNCL_KEYWORDS = new Set([
  '表示する',
  '含む',
  '要素数',
  '整数',
  '文字列',
  '乱数',
  '四捨五入',
  '切り捨て',
  '切り上げ',
  '絶対値',
  '平方根',
  '真',
  '偽',
  'かつ',
  'または',
  'でない',
  'もし',
  'なら',
  'ならば',
  'そうでなければ',
  'そうでなくもし',
  'を実行する',
  'の間',
  'を繰り返す',
  'から',
  'まで',
  'ずつ',
  '増やしながら',
  '減らしながら',
  '関数',
  '返す',
  'と定義する',
])

/**
 * Known Ruby/numeric literals and built-in names that should not be
 * prefixed with `@`.
 */
const RUBY_LITERALS = new Set([
  'true',
  'false',
  'nil',
  'answer',
  'say',
  'rand',
  'ask_and_wait',
  'return',
  'if',
  'elsif',
  'else',
  'end',
  'while',
  'do',
  'def',
  'to_i',
  'to_s',
  'to_f',
  'length',
  'step',
  'round',
  'floor',
  'ceil',
  'abs',
  'include?',
  'Math',
])

/**
 * Track which uppercase identifiers are arrays within a conversion.
 * @type {Set<string>}
 */
let arrayNames = new Set()

/**
 * Stack tracking for-loop state for increment insertion at `を繰り返す`.
 * Each entry: { varName, stepRuby, ascending, indent }
 * @type {Array<object>}
 */
let forLoopStack = []

/**
 * Detect array names from the full source before line-by-line conversion.
 * An uppercase identifier assigned to an array literal is an array name.
 * @param {string} source - The full DNCL source code.
 */
const detectArrayNames = (source) => {
  arrayNames = new Set()
  const lines = source.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Match: UppercaseName = [...]
    const assignMatch = trimmed.match(
      /^([A-Z][a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]*)\s*(?:=|←)\s*\[/,
    )
    if (assignMatch) {
      arrayNames.add(assignMatch[1])
    }
    // Match: UppercaseName[...] (array access)
    const accessMatches = trimmed.matchAll(
      /([A-Z][a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]*)\[/g,
    )
    for (const m of accessMatches) {
      arrayNames.add(m[1])
    }
    // Match: 要素数(UppercaseName)
    const lenMatch = trimmed.match(
      /要素数\(([A-Z][a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]*)\)/,
    )
    if (lenMatch) {
      arrayNames.add(lenMatch[1])
    }
  }
}

/**
 * Check if a name is a known array.
 * @param {string} name - The identifier to check.
 * @returns {boolean} True if the name is a known array.
 */
const isArrayName = (name) => arrayNames.has(name)

/**
 * Convert a single DNCL token/identifier to its Ruby equivalent.
 * @param {string} name - The identifier.
 * @returns {string} The Ruby variable reference.
 */
const convertIdentifier = (name) => {
  if (DNCL_KEYWORDS.has(name)) return name
  if (RUBY_LITERALS.has(name)) return name
  if (/^\d/.test(name)) return name
  if (/^[A-Z]/.test(name)) {
    return mapVarName(name, isArrayName(name))
  }
  return `@${name}`
}

/**
 * Find the end of a string literal starting at position i.
 * @param {string} line - The source line.
 * @param {number} start - Starting position (at the opening quote).
 * @param {string} quote - The quote character.
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
        if (!arrayNames.has(name)) {
          arrayNames.add(name)
        }
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
 * Process a line, splitting it into string/non-string parts.
 * Apply conversions only to non-string parts.
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

/**
 * Find the matching close paren for an open paren at `openParenPos`.
 * Skips parens inside string literals.
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
 * @param {string} text - Source text.
 * @param {string} name - Function name to match (e.g. `表示する`).
 * @param {Function} transform - Receives the raw args string between the
 *   matching parens and returns the full replacement text.
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
      const args = text.substring(openPos + 1, closePos)
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
 * Convert DNCL built-in function calls to Ruby equivalents. Uses balanced
 * paren matching so nested calls (e.g. `表示する(乱数(1..10))`) are
 * correctly delimited.
 * @param {string} text - Text that may contain DNCL function calls.
 * @returns {string} Text with functions converted to Ruby.
 */
const convertBuiltinFunctions = (text) => {
  let result = text

  // 表示する(...) → say(..., 1)
  result = replaceCall(result, '表示する', (args) => `say(${args}, 1)`)

  // 含む(str, sub) → str.include?(sub) — only the 2-arg form is valid;
  // any other arity is left unchanged so we don't emit malformed Ruby.
  result = replaceCall(result, '含む', (args) => {
    const parts = splitArgsAtTopLevel(args)
    if (parts.length === 2) {
      return `${parts[0]}.include?(${parts[1]})`
    }
    return `含む(${args})`
  })

  // 要素数(Name) → Name.length
  result = replaceCall(result, '要素数', (args) => `${args}.length`)

  // 整数(expr) → expr.to_i
  result = replaceCall(result, '整数', (args) => `${args}.to_i`)

  // 文字列(expr) → expr.to_s
  result = replaceCall(result, '文字列', (args) => `${args}.to_s`)

  // 乱数(n) → rand(n)
  result = replaceCall(result, '乱数', (args) => `rand(${args})`)

  // Math functions
  result = replaceCall(result, '四捨五入', (args) => `${args}.round`)
  result = replaceCall(result, '切り捨て', (args) => `${args}.floor`)
  result = replaceCall(result, '切り上げ', (args) => `${args}.ceil`)
  result = replaceCall(result, '絶対値', (args) => `${args}.abs`)
  result = replaceCall(result, '平方根', (args) => `Math.sqrt(${args})`)

  return result
}

/**
 * Convert a single DNCL line to Ruby.
 * @param {string} line - A single line of DNCL code.
 * @returns {string} The converted Ruby line.
 */
const convertLine = (line) => {
  if (line.trim() === '') return line

  // Preserve indentation
  const indentMatch = line.match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1] : ''
  const trimmed = line.trim()

  // Comment line
  if (trimmed.startsWith('#')) {
    return line
  }

  // Convert Japanese bracket strings first
  let converted = convertJapaneseStrings(line)

  // Apply all builtin function conversions
  converted = convertBuiltinFunctions(converted)

  // Handle control flow keywords (line-level patterns)
  // もし condition なら/ならば → if condition
  const ifMatch = trimmed.match(/^もし\s+(.+?)\s+(?:なら|ならば)$/)
  if (ifMatch) {
    let condition = convertJapaneseStrings(convertArrow(ifMatch[1]))
    condition = convertBuiltinFunctions(condition)
    condition = processSegments(condition)
    return `${indent}if ${condition}`
  }

  // そうでなくもし condition なら/ならば → elsif condition
  const elsifMatch = trimmed.match(
    /^そうでなくもし\s+(.+?)\s+(?:なら|ならば)$/,
  )
  if (elsifMatch) {
    let condition = convertJapaneseStrings(convertArrow(elsifMatch[1]))
    condition = convertBuiltinFunctions(condition)
    condition = processSegments(condition)
    return `${indent}elsif ${condition}`
  }

  // そうでなければ → else
  if (trimmed === 'そうでなければ') {
    return `${indent}else`
  }

  // を実行する → end
  if (trimmed === 'を実行する') {
    return `${indent}end`
  }

  // を繰り返す → end (with for-loop increment insertion)
  if (trimmed === 'を繰り返す') {
    if (forLoopStack.length > 0) {
      const top = forLoopStack[forLoopStack.length - 1]
      // Check if this end matches the innermost for-loop by indent level
      if (top.indent === indent) {
        forLoopStack.pop()
        const stepExpr = top.ascending ? top.stepRuby : `-${top.stepRuby}`
        const bodyIndent = `${indent}  `
        return `${bodyIndent}${top.varName} += ${stepExpr}\n${indent}end`
      }
    }
    return `${indent}end`
  }

  // と定義する → end
  if (trimmed === 'と定義する') {
    return `${indent}end`
  }

  // i を N1 から N2 まで N3 ずつ増やしながら → @i = N1 + while @i <= N2
  const forAscMatch = trimmed.match(
    /^(\w+)\s+を\s+(.+?)\s+から\s+(.+?)\s+まで\s+(.+?)\s+ずつ増やしながら$/,
  )
  if (forAscMatch) {
    const [, loopVar, from, to, step] = forAscMatch
    const varName = convertIdentifier(loopVar)
    const fromRuby = processSegments(from)
    const toRuby = processSegments(to)
    const stepRuby = processSegments(step)
    forLoopStack.push({ varName, stepRuby, ascending: true, indent })
    return `${indent}${varName} = ${fromRuby}\n${indent}while ${varName} <= ${toRuby}`
  }

  // i を N1 から N2 まで N3 ずつ減らしながら → @i = N1 + while @i >= N2
  const forDescMatch = trimmed.match(
    /^(\w+)\s+を\s+(.+?)\s+から\s+(.+?)\s+まで\s+(.+?)\s+ずつ減らしながら$/,
  )
  if (forDescMatch) {
    const [, loopVar, from, to, step] = forDescMatch
    const varName = convertIdentifier(loopVar)
    const fromRuby = processSegments(from)
    const toRuby = processSegments(to)
    const stepRuby = processSegments(step)
    forLoopStack.push({ varName, stepRuby, ascending: false, indent })
    return `${indent}${varName} = ${fromRuby}\n${indent}while ${varName} >= ${toRuby}`
  }

  // condition の間 → while condition
  const whileMatch = trimmed.match(/^(.+?)\s+の間$/)
  if (whileMatch) {
    let condition = convertJapaneseStrings(convertArrow(whileMatch[1]))
    condition = convertBuiltinFunctions(condition)
    condition = processSegments(condition)
    return `${indent}while ${condition}`
  }

  // 関数 name(params) → def name(params)
  const funcMatch = trimmed.match(/^関数\s+(\w+)\(([^)]*)\)$/)
  if (funcMatch) {
    return `${indent}def ${funcMatch[1]}(${funcMatch[2]})`
  }

  // 返す expr → return expr
  const returnMatch = trimmed.match(/^返す\s+(.+)$/)
  if (returnMatch) {
    let expr = convertJapaneseStrings(convertArrow(returnMatch[1]))
    expr = convertBuiltinFunctions(expr)
    expr = processSegments(expr)
    return `${indent}return ${expr}`
  }

  // Handle ← assignment → =
  converted = converted.replace(/\s*←\s*/g, ' = ')

  // Handle 【外部からの入力】
  const inputMatch = converted.match(
    /^(\s*)(.+?)\s*=\s*【外部からの入力】\s*$/,
  )
  if (inputMatch) {
    const inputIndent = inputMatch[1]
    const varPart = inputMatch[2].trim()
    const processedVar = processSegments(varPart)
    return `${inputIndent}ask("")\n${inputIndent}${processedVar} = answer`
  }

  // Process segments (strings vs code)
  converted = processSegments(converted)

  return converted
}

/**
 * Transpile DNCL source code to Ruby.
 * @param {string} source - The DNCL source code.
 * @returns {object} An object with `ruby` (the transpiled Ruby code) and
 *   `sourceMap` (placeholder for future source mapping).
 */
/**
 * Validate DNCL source for forbidden characters.
 * DNCL variables cannot use `@` or `$` prefixes.
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
  forLoopStack = []

  const lines = source.split('\n')
  const rubyLines = lines.map((line) => convertLine(line))

  return {
    ruby: rubyLines.join('\n'),
    errors: [],
    sourceMap: null,
  }
}

export { dnclToRuby }
