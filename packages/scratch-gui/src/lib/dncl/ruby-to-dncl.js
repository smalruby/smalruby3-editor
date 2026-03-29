// === Smalruby: This file is Smalruby-specific (Ruby to DNCL reverse transpiler) ===

/**
 * Context for tracking whether the current `end` should become
 * `を実行する`, `を繰り返す`, or `と定義する`.
 * @type {Array<string>}
 */
let blockStack = []

/**
 * Convert a Ruby variable reference back to DNCL name.
 * `@_var_X_` → `X`, `@_array_X_` → `X`, `@x` → `x`.
 * @param {string} segment - Code segment.
 * @returns {string} Segment with Ruby vars converted to DNCL.
 */
const convertVarRefs = (segment) => {
  let result = segment
  // @_array_Name_ → Name
  result = result.replace(/@_array_(\w+)_/g, '$1')
  // @_var_Name_ → Name
  result = result.replace(/@_var_(\w+)_/g, '$1')
  // @name → name (but not @@ or @_ prefixed patterns already handled)
  result = result.replace(/@(\w+)/g, '$1')
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
  result = result.replace(/!(@?\w+)/g, '$1 でない')

  return result
}

/**
 * Convert Ruby built-in method calls back to DNCL.
 * @param {string} line - A line of code.
 * @returns {string} Line with DNCL functions.
 */
const convertBuiltins = (line) => {
  let result = line

  // say(args, 1) → 表示する(args) — remove trailing ", 1"
  result = result.replace(
    /say\((.+),\s*1\)/g,
    (_, args) => `表示する(${args})`,
  )

  // puts(args) / p(args) / print(args) → 表示する(args)
  result = result.replace(
    /(?:puts|print)\(([^)]*)\)/g,
    (_, args) => `表示する(${args})`,
  )
  // p(args) — only match standalone 'p(' to avoid matching 'map(' etc.
  result = result.replace(
    /(?<=^|[^a-zA-Z_])p\(([^)]*)\)/g,
    (_, args) => `表示する(${args})`,
  )

  // expr.to_i → 整数(expr)
  result = result.replace(/(\w+)\.to_i/g, (_, expr) => `整数(${expr})`)

  // expr.to_s → 文字列(expr)
  result = result.replace(/(\w+)\.to_s/g, (_, expr) => `文字列(${expr})`)

  // rand(n) → 乱数(n)
  result = result.replace(/rand\(([^)]*)\)/g, (_, n) => `乱数(${n})`)

  // expr.length → 要素数(expr)
  result = result.replace(/(\w+)\.length/g, (_, expr) => `要素数(${expr})`)

  return result
}

/**
 * Find the end of a string literal.
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

/**
 * Convert a single Ruby line to DNCL.
 * @param {string} line - A single line of Ruby code.
 * @returns {string} The converted DNCL line.
 */
const convertLine = (line) => {
  if (line.trim() === '') return line

  const indentMatch = line.match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1] : ''
  const trimmed = line.trim()

  // Comment
  if (trimmed.startsWith('#')) {
    return line
  }

  // ask_and_wait("") — will be combined with next line
  if (trimmed === 'ask_and_wait("")') {
    return null // sentinel: combine with next line
  }

  // if condition → もし condition ならば
  const ifMatch = trimmed.match(/^if\s+(.+)$/)
  if (ifMatch) {
    blockStack.push('if')
    const condition = processSegments(ifMatch[1])
    return `${indent}もし ${condition} ならば`
  }

  // elsif condition → そうでなくもし condition ならば
  const elsifMatch = trimmed.match(/^elsif\s+(.+)$/)
  if (elsifMatch) {
    const condition = processSegments(elsifMatch[1])
    return `${indent}そうでなくもし ${condition} ならば`
  }

  // else → そうでなければ
  if (trimmed === 'else') {
    return `${indent}そうでなければ`
  }

  // while condition → condition の間
  const whileMatch = trimmed.match(/^while\s+(.+)$/)
  if (whileMatch) {
    blockStack.push('loop')
    const condition = processSegments(whileMatch[1])
    return `${indent}${condition} の間`
  }

  // (from..to).step(step) do |var| → ascending for loop
  const forAscMatch = trimmed.match(
    /^\((.+?)\.\.(.+?)\)\.step\((.+?)\)\s+do\s+\|(\w+)\|$/,
  )
  if (forAscMatch) {
    blockStack.push('loop')
    const [, from, to, step, loopVar] = forAscMatch
    const fromDncl = processSegments(from)
    const toDncl = processSegments(to)
    const stepDncl = processSegments(step)
    return `${indent}${loopVar} を ${fromDncl} から ${toDncl} まで ${stepDncl} ずつ増やしながら`
  }

  // from.step(to, -step) do |var| → descending for loop
  const forDescMatch = trimmed.match(
    /^(.+?)\.step\((.+?),\s*-(.+?)\)\s+do\s+\|(\w+)\|$/,
  )
  if (forDescMatch) {
    blockStack.push('loop')
    const [, from, to, step, loopVar] = forDescMatch
    const fromDncl = processSegments(from)
    const toDncl = processSegments(to)
    const stepDncl = processSegments(step)
    return `${indent}${loopVar} を ${fromDncl} から ${toDncl} まで ${stepDncl} ずつ減らしながら`
  }

  // def name(params) → 関数 name(params)
  const defMatch = trimmed.match(/^def\s+(\w+)\(([^)]*)\)$/)
  if (defMatch) {
    blockStack.push('func')
    return `${indent}関数 ${defMatch[1]}(${defMatch[2]})`
  }

  // return expr → 返す expr
  const returnMatch = trimmed.match(/^return\s+(.+)$/)
  if (returnMatch) {
    const expr = processSegments(returnMatch[1])
    return `${indent}返す ${expr}`
  }

  // end → depends on block context
  if (trimmed === 'end') {
    const blockType = blockStack.pop() || 'if'
    if (blockType === 'loop') {
      return `${indent}を繰り返す`
    }
    if (blockType === 'func') {
      return `${indent}と定義する`
    }
    return `${indent}を実行する`
  }

  // General line: process segments first (var refs, operators),
  // then convert builtins (which produce Japanese keywords)
  let converted = processSegments(line)
  converted = convertBuiltins(converted)

  return converted
}

/**
 * Transpile Ruby source code to DNCL.
 * @param {string} source - The Ruby source code.
 * @returns {object} An object with `dncl` (the transpiled DNCL code).
 */
const rubyToDncl = (source) => {
  blockStack = []

  const lines = source.split('\n')
  const dnclLines = []
  let skipNext = false

  for (let i = 0; i < lines.length; i++) {
    if (skipNext) {
      skipNext = false
      continue
    }

    const result = convertLine(lines[i])

    // Handle ask_and_wait("") + next line assignment → 入力
    if (result === null) {
      // Combine with next line: @var = answer → var = 【外部からの入力】
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const assignMatch = nextLine.match(/^(\s*)(.+?)\s*=\s*answer\s*$/)
        if (assignMatch) {
          const indent = assignMatch[1]
          const varPart = processSegments(assignMatch[2])
          dnclLines.push(`${indent}${varPart} = 【外部からの入力】`)
          skipNext = true
          continue
        }
      }
      // Fallback: just output as-is
      dnclLines.push(lines[i])
      continue
    }

    dnclLines.push(result)
  }

  return {
    dncl: dnclLines.join('\n'),
  }
}

export { rubyToDncl }
