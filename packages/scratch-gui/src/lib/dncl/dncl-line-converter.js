// === Smalruby: This file is Smalruby-specific (DNCL→Ruby line converter) ===

import { convertBuiltinFunctions } from './dncl-builtins'
import {
  convertArrow,
  convertIdentifier,
  convertJapaneseStrings,
  processSegments,
} from './dncl-identifier-converter'

/**
 * Stack tracking for-loop state for increment insertion at `を繰り返す`.
 * Each entry: { varName, stepRuby, ascending, indent }. Reset via
 * `resetForLoopStack` at the start of each conversion.
 * @type {Array<object>}
 */
let forLoopStack = []

/**
 * Reset the for-loop stack. Called at the beginning of `dnclToRuby`.
 */
const resetForLoopStack = () => {
  forLoopStack = []
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

export { convertLine, resetForLoopStack }
