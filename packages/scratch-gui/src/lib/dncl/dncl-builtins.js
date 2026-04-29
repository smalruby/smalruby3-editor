// === Smalruby: This file is Smalruby-specific (DNCL→Ruby builtin conversion) ===

import { replaceCall, splitArgsAtTopLevel } from './paren-utils'

/**
 * Convert DNCL built-in function calls to Ruby equivalents. Uses balanced
 * paren matching so nested calls (e.g. `表示する(乱数(1..10))`) are
 * correctly delimited.
 *
 * `replaceCall` recurses into args before transforming so same-name nesting
 * (e.g. `乱数(乱数(...))`) is handled in a single call.
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

export { convertBuiltinFunctions }
