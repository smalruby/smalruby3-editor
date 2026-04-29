// === Smalruby: This file is Smalruby-specific (Ruby→DNCL line converter) ===

import { convertBuiltins } from './ruby-to-dncl-builtins'
import { ID, processSegments } from './ruby-to-dncl-identifier'

/**
 * Convert a single Ruby line to DNCL.
 *
 * `blockStack` is a stack of block-context strings (`'if'`, `'loop'`,
 * `'func'`) used to translate `end` to the right DNCL terminator. The
 * caller (`rubyToDncl`) owns the stack so for-loop detection (which lives
 * outside this function) can interleave its own entries on the same stack.
 * @param {string} line - A single line of Ruby code.
 * @param {Array<string|object>} blockStack - Mutable block-context stack.
 * @returns {string|null} The converted DNCL line, or `null` for ask/answer
 *   sentinel lines that the caller must combine with the next line.
 */
const convertLine = (line, blockStack) => {
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
 * If detected, return for-loop info; the step is unknown until `end` is
 * reached.
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

export { convertLine, detectForLoopPattern }
