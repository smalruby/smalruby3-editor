// === Smalruby: This file is Smalruby-specific (Ruby to DNCL reverse transpiler) ===

import {
  findMatchingClose,
  replaceCall,
  skipString,
  splitArgsAtTopLevel,
} from './paren-utils'

/** Regex character class for identifiers: word chars + CJK (hiragana, katakana, kanji). */
const ID = '\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF'

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
 * Replace `p(...)` calls only when `p` is standalone (not part of another
 * identifier like `map`, `top`). Uses balanced-paren matching with recursive
 * args processing for same-name nesting.
 * @param {string} text - Source text.
 * @returns {string} Text with `p(...)` calls converted to `表示する(...)`.
 */
const replaceStandalonePCall = (text) => {
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
    if (ch === 'p' && text[i + 1] === '(') {
      const prevChar = i > 0 ? text[i - 1] : ''
      const isStandalone = !prevChar || !/[a-zA-Z_]/.test(prevChar)
      if (isStandalone) {
        const closePos = findMatchingClose(text, i + 1)
        if (closePos !== -1) {
          const rawArgs = text.substring(i + 2, closePos)
          // Recurse so `p(p(x))` fully converts.
          const args = replaceStandalonePCall(rawArgs)
          result += `表示する(${args})`
          i = closePos + 1
          continue
        }
      }
    }
    result += ch
    i++
  }
  return result
}

/**
 * Convert Ruby built-in method calls back to DNCL. Uses balanced-paren
 * matching for prefix-call forms so nested same-name calls work.
 *
 * Postfix-with-args forms (`.include?`) and postfix-no-args forms
 * (`.to_i`, `.length` etc.) still use regex because they have a different
 * shape. Same-name nesting on postfix calls is a known limitation.
 * @param {string} line - A line of code.
 * @returns {string} Line with DNCL functions.
 */
const convertBuiltins = (line) => {
  let result = line

  // say(args, N) → 表示する(args). Strip the trailing duration argument
  // (any number) but only at the top-level comma to handle nested calls.
  result = replaceCall(result, 'say', (args) => {
    const parts = splitArgsAtTopLevel(args)
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].trim()
      if (/^\d+(?:\.\d+)?$/.test(last)) {
        const messageArgs = parts.slice(0, -1).join(', ')
        return `表示する(${messageArgs})`
      }
    }
    return `表示する(${args})`
  })

  // puts(args) / print(args) → 表示する(args)
  result = replaceCall(result, 'puts', (args) => `表示する(${args})`)
  result = replaceCall(result, 'print', (args) => `表示する(${args})`)

  // p(args) — only match standalone `p(` to avoid `map(`, etc.
  result = replaceStandalonePCall(result)

  // Math.sqrt(expr) → 平方根(expr)
  result = replaceCall(result, 'Math.sqrt', (expr) => `平方根(${expr})`)

  // expr.include?(sub) → 含む(expr, sub)
  // NOTE: same-name nesting (s.include?(t.include?(x))) is not handled by
  // this regex (postfix-with-args form). This is a known limitation.
  result = result.replace(
    new RegExp(`("[^"]*"|[${ID}]+)\\.include\\?\\(([^)]*)\\)`, 'g'),
    (_, expr, sub) => `含む(${expr}, ${sub})`,
  )

  // Postfix-no-args methods. expr is matched as a word identifier; nested
  // calls like `rand(...).to_i` are not handled (known limitation).
  result = result.replace(
    new RegExp(`([${ID}]+)\\.to_i`, 'g'),
    (_, expr) => `整数(${expr})`,
  )
  result = result.replace(
    new RegExp(`([${ID}]+)\\.to_s`, 'g'),
    (_, expr) => `文字列(${expr})`,
  )
  result = result.replace(
    new RegExp(`([${ID}]+)\\.round`, 'g'),
    (_, expr) => `四捨五入(${expr})`,
  )
  result = result.replace(
    new RegExp(`([${ID}]+)\\.floor`, 'g'),
    (_, expr) => `切り捨て(${expr})`,
  )
  result = result.replace(
    new RegExp(`([${ID}]+)\\.ceil`, 'g'),
    (_, expr) => `切り上げ(${expr})`,
  )
  result = result.replace(
    new RegExp(`([${ID}]+)\\.abs`, 'g'),
    (_, expr) => `絶対値(${expr})`,
  )

  // rand(n) → 乱数(n)
  result = replaceCall(result, 'rand', (n) => `乱数(${n})`)

  // expr.length → 要素数(expr)
  result = result.replace(
    new RegExp(`([${ID}]+)\\.length`, 'g'),
    (_, expr) => `要素数(${expr})`,
  )

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

  // ask("") or ask_and_wait("") — will be combined with next line
  if (trimmed === 'ask("")' || trimmed === 'ask_and_wait("")') {
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

  // until condition → condition でない の間
  const untilMatch = trimmed.match(/^until\s+(.+)$/)
  if (untilMatch) {
    blockStack.push('loop')
    const condition = processSegments(untilMatch[1])
    return `${indent}${condition} でない の間`
  }

  // N.times do → i を 1 から N まで 1 ずつ増やしながら
  const timesMatch = trimmed.match(/^(.+?)\.times\s+do$/)
  if (timesMatch) {
    blockStack.push('loop')
    const count = processSegments(timesMatch[1])
    return `${indent}_ を 1 から ${count} まで 1 ずつ増やしながら`
  }

  // (from..to).step(step) do |var| → ascending for loop
  const forAscMatch = trimmed.match(
    new RegExp(
      `^\\((.+?)\\.\\.(.+?)\\)\\.step\\((.+?)\\)\\s+do\\s+\\|([${ID}]+)\\|$`,
    ),
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
    new RegExp(
      `^(.+?)\\.step\\((.+?),\\s*-(.+?)\\)\\s+do\\s+\\|([${ID}]+)\\|$`,
    ),
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
  const defMatch = trimmed.match(
    new RegExp(`^def\\s+([${ID}]+)\\(([^)]*)\\)$`),
  )
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
 * Try to detect a while-based for-loop pattern:
 *   `@var` = from  (pending assignment)
 *   while `@var` <= to  OR  while `@var` >= to
 *
 * If detected, push a for-loop context and return the DNCL header placeholder.
 * The step is unknown until `end` is reached.
 * @param {object} pending - The buffered assignment.
 * @param {string} whileLine - The current `while` line (trimmed).
 * @param {string} whileIndent - The indent of the while line.
 * @returns {object|null} For-loop info or null if not a for-loop pattern.
 */
const detectForLoopPattern = (pending, whileLine, whileIndent) => {
  if (!pending) return null
  if (pending.indent !== whileIndent) return null

  // Match: while @var <= expr  or  while @var >= expr
  const whileMatch = whileLine.match(
    new RegExp(`^while\\s+(@[${ID}]+)\\s*(<=|>=)\\s*(.+)$`),
  )
  if (!whileMatch) return null
  if (whileMatch[1] !== pending.varRef) return null

  const ascending = whileMatch[2] === '<='
  return {
    varName: pending.varName,
    varRef: pending.varRef,
    from: pending.expr,
    to: processSegments(whileMatch[3]),
    ascending,
    indent: whileIndent,
    headerIndex: -1, // will be set by caller
  }
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

    const line = lines[i]
    const trimmed = line.trim()
    const indentMatch = line.match(/^(\s*)/)
    const indent = indentMatch ? indentMatch[1] : ''

    // Check if this is an assignment that could be a for-loop init
    const assignMatch = trimmed.match(
      new RegExp(`^(@[${ID}]+)\\s*=\\s*(.+)$`),
    )
    if (assignMatch && !trimmed.includes('answer')) {
      // Extract var name for DNCL display (strip @, @_var_, @_array_)
      const varRef = assignMatch[1]
      const exprRaw = assignMatch[2].trim()

      // Peek at next line for while pattern
      if (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim()
        const nextIndentMatch = lines[i + 1].match(/^(\s*)/)
        const nextIndent = nextIndentMatch ? nextIndentMatch[1] : ''

        const forInfo = detectForLoopPattern(
          { indent, varName: processSegments(varRef), varRef, expr: processSegments(exprRaw) },
          nextTrimmed,
          nextIndent,
        )
        if (forInfo) {
          // This is a for-loop! Output header placeholder, skip the while line
          forInfo.headerIndex = dnclLines.length
          blockStack.push({ type: 'for', info: forInfo })
          dnclLines.push('__FOR_HEADER_PLACEHOLDER__')
          skipNext = true
          continue
        }
      }

    }

    // Handle `end` for for-loop BEFORE calling convertLine
    // (convertLine would pop from blockStack and misidentify the block type)
    if (trimmed === 'end' && blockStack.length > 0) {
      const top = blockStack[blockStack.length - 1]
      if (typeof top === 'object' && top.type === 'for' && top.info.indent === indent) {
        blockStack.pop()
        const info = top.info
        // Check last body line for increment: varName += step
        const lastLine = dnclLines.length > 0 ? dnclLines[dnclLines.length - 1].trim() : ''
        const incMatch = lastLine.match(
          /^(.+?)\s*\+=\s*(.+)$/,
        )
        if (incMatch && incMatch[1] === info.varName) {
          // Remove the increment line from output
          dnclLines.pop()
          const stepExpr = incMatch[2].trim()

          // Determine step value and direction
          let step
          let ascending = info.ascending
          const negMatch = stepExpr.match(/^-(.+)$/)
          if (negMatch) {
            step = negMatch[1]
            ascending = false
          } else {
            step = stepExpr
          }

          const direction = ascending ? '増やしながら' : '減らしながら'
          const header = `${indent}${info.varName} を ${info.from} から ${info.to} まで ${step} ずつ${direction}`
          dnclLines[info.headerIndex] = header
        }
        dnclLines.push(`${indent}を繰り返す`)
        continue
      }
    }

    const result = convertLine(line)

    // Handle ask("") or ask_and_wait("") + next line assignment → 入力
    if (result === null) {
      // Combine with next line: @var = answer → var = 【外部からの入力】
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const answerMatch = nextLine.match(/^(\s*)(.+?)\s*=\s*answer\s*$/)
        if (answerMatch) {
          const answerIndent = answerMatch[1]
          const varPart = processSegments(answerMatch[2])
          dnclLines.push(`${answerIndent}${varPart} = 【外部からの入力】`)
          skipNext = true
          continue
        }
      }
      // Fallback: just output as-is
      dnclLines.push(line)
      continue
    }

    dnclLines.push(result)
  }

  return {
    dncl: dnclLines.join('\n'),
  }
}

export { rubyToDncl }
