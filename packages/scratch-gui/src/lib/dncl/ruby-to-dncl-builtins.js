// === Smalruby: This file is Smalruby-specific (Ruby→DNCL builtin conversion) ===

import {
  findMatchingClose,
  replaceCall,
  skipString,
  splitArgsAtTopLevel,
} from './paren-utils'
import { ID } from './ruby-to-dncl-identifier'

/**
 * Replace `p(...)` calls only when `p` is standalone (not part of another
 * identifier like `map`, `top`). Uses balanced-paren matching with
 * recursive args processing for same-name nesting.
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

export { convertBuiltins }
