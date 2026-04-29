// === Smalruby: This file is Smalruby-specific (Ruby to DNCL reverse transpiler) ===

import {
  convertLine,
  detectForLoopPattern,
} from './ruby-to-dncl-line-converter'
import { ID, processSegments } from './ruby-to-dncl-identifier'

/**
 * Transpile Ruby source code to DNCL.
 * @param {string} source - The Ruby source code.
 * @returns {object} An object with `dncl` (the transpiled DNCL code).
 */
const rubyToDncl = (source) => {
  // Stack of block contexts. String entries (`'if'`, `'loop'`, `'func'`)
  // are pushed by `convertLine`; object entries `{ type: 'for', info }`
  // are pushed here for while-based for-loop detection.
  const blockStack = []

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
      const varRef = assignMatch[1]
      const exprRaw = assignMatch[2].trim()

      // Peek at next line for while pattern
      if (i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim()
        const nextIndentMatch = lines[i + 1].match(/^(\s*)/)
        const nextIndent = nextIndentMatch ? nextIndentMatch[1] : ''

        const forInfo = detectForLoopPattern(
          {
            indent,
            varName: processSegments(varRef),
            varRef,
            expr: processSegments(exprRaw),
          },
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
      if (
        typeof top === 'object' &&
        top.type === 'for' &&
        top.info.indent === indent
      ) {
        blockStack.pop()
        const info = top.info
        // Check last body line for increment: varName += step
        const lastLine =
          dnclLines.length > 0 ? dnclLines[dnclLines.length - 1].trim() : ''
        const incMatch = lastLine.match(/^(.+?)\s*\+=\s*(.+)$/)
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

    const result = convertLine(line, blockStack)

    // Handle ask("") or ask_and_wait("") + next line assignment → 入力
    if (result === null) {
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
