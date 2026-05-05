// === Smalruby: DNCLv2 → Smalruby DNCL pre-processor ===
//
// Normalizes DNCLv2 syntax (the form used in 共通テスト 例題, see
// https://nodai2hitc.github.io/ictl_example/) into the existing Smalruby
// DNCL form so that the existing DNCL → Ruby pipeline can handle the
// rest unchanged.
//
// Phase 3 covers (current file):
//   - Line numbers (`(1) `, `(20) ...`)
//   - Trailing colon `:` on control-flow lines
//   - 「繰り返す」 suffix on `の間繰り返す` / `増やしながら繰り返す` /
//     `減らしながら繰り返す`
//   - Comma-separated multi-assignment (`a = X , b = Y` → 2 lines)
//   - `and` / `or` → `かつ` / `または`
//
// Phase 4 (separate commit) will add `｜` / `⎿` indent markers and
// the implicit `end` insertion based on `⎿` count.
//
// See Issue #640.

import { skipString } from './paren-utils'

/**
 * Strip the leading `(N) ` (and any trailing whitespace after it) from a
 * line. The line number is purely a presentation aid in DNCLv2 examples
 * — it has no semantic meaning, so we simply discard it.
 * @param {string} line - The source line.
 * @returns {string} The line with any `(N)` prefix removed.
 */
const stripLineNumber = (line) => line.replace(/^\(\d+\)\s*/, '')

/**
 * Walk `line` and return the offsets of every character that is OUTSIDE
 * any string literal. Used by transformations that should ignore content
 * inside `"..."` / `'...'`.
 * @param {string} line - The source line.
 * @returns {Set<number>} Indices into `line` that are outside string literals.
 */
const outsideStringIndices = (line) => {
  const result = new Set()
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(line, i, ch)
      i = end
      continue
    }
    result.add(i)
    i++
  }
  return result
}

/**
 * Strip the trailing colon `:` on DNCLv2 control-flow line endings.
 * Only colons at end-of-line are stripped; embedded colons (e.g. inside
 * a string or hash literal) are left alone.
 * @param {string} line - A line that may end with `:`.
 * @returns {string} The line without its trailing colon.
 */
const stripTrailingColon = (line) => {
  // Trim trailing whitespace, check for `:`, and only strip if the colon
  // sits outside any string literal.
  const trimmed = line.replace(/\s+$/, '')
  if (!trimmed.endsWith(':')) return line
  const colonIdx = trimmed.length - 1
  const outside = outsideStringIndices(trimmed)
  if (!outside.has(colonIdx)) return line
  // Only strip when the colon follows one of the DNCL control-flow keywords.
  // We match by checking for the keyword immediately before the colon.
  const beforeColon = trimmed.substring(0, colonIdx).replace(/\s+$/, '')
  const triggers = [
    'なら',
    'ならば',
    'そうでなければ',
    'の間繰り返す',
    'の間',
    '増やしながら繰り返す',
    '増やしながら',
    '減らしながら繰り返す',
    '減らしながら',
    'を定義する',
    'と定義する',
    'を実行する',
    'を繰り返す',
  ]
  if (!triggers.some((t) => beforeColon.endsWith(t))) return line
  // Preserve any whitespace that followed the original colon.
  const trailing = line.substring(trimmed.length)
  return `${beforeColon}${trailing}`
}

/**
 * Normalize the DNCLv2 「繰り返す」 suffix to the Smalruby DNCL form. So:
 *   `条件 の間繰り返す` → `条件 の間`
 *   `i を ... 増やしながら繰り返す` → `i を ... 増やしながら`
 *   `i を ... 減らしながら繰り返す` → `i を ... 減らしながら`
 *
 * Only transforms when the suffix is at end-of-line, after one of the
 * loop opener keywords. Lines that already use the Smalruby form are
 * left alone (idempotent).
 * @param {string} line - The line to normalize.
 * @returns {string} The line with the 繰り返す suffix removed if applicable.
 */
const normalizeKurikaesuSuffix = (line) => line.replace(
    /(の間|ずつ増やしながら|ずつ減らしながら)繰り返す(\s*)$/,
    '$1$2',
  )

/**
 * Split a comma-separated multi-assignment line into multiple lines.
 *
 *   `hidari = 0 , migi = kazu - 1`
 *   → [ 'hidari = 0', 'migi = kazu - 1' ]
 *
 * Only splits when:
 *   - There is at least one top-level comma (depth 0, outside strings)
 *   - Every comma-separated piece contains a top-level `=`
 *
 * The leading indent is preserved on every output line.
 * @param {string} line - The line to inspect.
 * @returns {string} The original line, or multiple lines joined with `\n`.
 */
const splitMultiAssignment = (line) => {
  const indentMatch = line.match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1] : ''
  const body = line.substring(indent.length)
  if (body.length === 0) return line

  // Walk the body, tracking depth + strings, and collect top-level commas.
  const parts = []
  let current = ''
  let depth = 0
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(body, i, ch)
      current += body.substring(i, end)
      i = end
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++
      current += ch
      i++
      continue
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--
      current += ch
      i++
      continue
    }
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      i++
      continue
    }
    current += ch
    i++
  }
  parts.push(current)

  if (parts.length < 2) return line

  // Every part must contain a top-level `=` (depth 0, outside strings).
  // Otherwise we likely have a function call or a single expression with
  // top-level commas, and shouldn't split.
  const hasTopLevelEquals = (part) => {
    let d = 0
    let j = 0
    while (j < part.length) {
      const c = part[j]
      if (c === '"' || c === "'") {
        const end = skipString(part, j, c)
        j = end
        continue
      }
      if (c === '(' || c === '[' || c === '{') {
        d++
        j++
        continue
      }
      if (c === ')' || c === ']' || c === '}') {
        d--
        j++
        continue
      }
      if (c === '=' && d === 0) {
        // Make sure this is `=` (assignment) not `==`, `<=`, `>=`, `!=`.
        const prev = part[j - 1]
        const next = part[j + 1]
        if (prev !== '=' && prev !== '<' && prev !== '>' && prev !== '!' && next !== '=') {
          return true
        }
      }
      j++
    }
    return false
  }
  if (!parts.every(hasTopLevelEquals)) return line

  return parts.map((p) => `${indent}${p.trim()}`).join('\n')
}

/**
 * Replace standalone `and` / `or` with `かつ` / `または`. Only matches
 * whole-word occurrences outside string literals — `bandwidth` and
 * `ordinary` stay as-is.
 * @param {string} line - The line to transform.
 * @returns {string} The line with `and` / `or` replaced.
 */
const normalizeAndOr = (line) => {
  let result = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(line, i, ch)
      result += line.substring(i, end)
      i = end
      continue
    }
    // Match `and` or `or` as whole word: bounded by whitespace, line edge,
    // or a non-identifier character.
    const isWordBoundary = (idx) => {
      if (idx < 0 || idx >= line.length) return true
      const c = line[idx]
      return !/[a-zA-Z0-9_]/.test(c)
    }
    if (
      line.startsWith('and', i) &&
      isWordBoundary(i - 1) &&
      isWordBoundary(i + 3)
    ) {
      result += 'かつ'
      i += 3
      continue
    }
    if (
      line.startsWith('or', i) &&
      isWordBoundary(i - 1) &&
      isWordBoundary(i + 2)
    ) {
      result += 'または'
      i += 2
      continue
    }
    result += ch
    i++
  }
  return result
}

/**
 * Process the leading indent zone of `body` to expand `｜` / `⎿`
 * markers. Each marker (with its surrounding whitespace) becomes 2
 * spaces of indent, so 1 marker = 1 indent level (= 2 spaces of Ruby
 * indent).
 *
 * Returns the rewritten line plus the count of `⎿` markers, which the
 * caller uses to decide how many block-closer lines to emit after the
 * current line.
 * @param {string} body - The line content (already free of `(N)` prefix).
 * @returns {{ line: string, closeCount: number }} The processed line and
 *   the number of blocks the next outdent should close.
 */
const processIndentMarkers = (body) => {
  // Find the prefix consisting of leading whitespace + ｜ / ⎿ markers.
  const m = body.match(/^([\s｜⎿]*)(.*)$/)
  if (!m) return { line: body, closeCount: 0 }
  const prefix = m[1]
  const rest = m[2]
  const markers = prefix.match(/[｜⎿]/g) || []
  if (markers.length === 0) return { line: body, closeCount: 0 }
  const closeCount = markers.filter((c) => c === '⎿').length
  const newPrefix = ' '.repeat(2 * markers.length)
  return { line: `${newPrefix}${rest}`, closeCount }
}

/**
 * Determine the block type opened by the given DNCL line, if any.
 * Recognizes the line patterns AFTER Phase 3 normalization (so `:`
 * and `繰り返す` suffixes are already stripped).
 *
 * `そうでなくもし` and `そうでなければ` are NOT new blocks — they're
 * continuations of an existing `if` block — so they return `null`.
 * @param {string} body - The line content with indent stripped.
 * @returns {string|null} `'if'`, `'loop'`, `'func'`, or `null`.
 */
const detectBlockType = (body) => {
  // Continuations: not new blocks.
  if (/^そうでなくもし\s+.*\s+(?:なら|ならば)$/.test(body)) return null
  if (body === 'そうでなければ') return null
  // Openers.
  if (/^もし\s+.*\s+(?:なら|ならば)$/.test(body)) return 'if'
  if (/\sの間$/.test(body)) return 'loop'
  if (/\sずつ(?:増やしながら|減らしながら)$/.test(body)) return 'loop'
  if (/^関数\s+\w+\s*\(/.test(body)) return 'func'
  return null
}

/**
 * Map a block type to its DNCL closer keyword.
 * @param {string} type - `'if'`, `'loop'`, or `'func'`.
 * @returns {string} The matching closer keyword.
 */
const closerForBlockType = (type) => {
  if (type === 'loop') return 'を繰り返す'
  if (type === 'func') return 'と定義する'
  return 'を実行する'
}

/**
 * Convert a DNCLv2 function-definition opener to the Smalruby form:
 *   `NAME(ARGS) を定義する` → `関数 NAME(ARGS)`
 *
 * Only matches at end-of-line so `a = "calc(x) を定義する"` is left alone.
 * The trailing whitespace (if any) after `を定義する` is preserved.
 * @param {string} line - The line to inspect.
 * @returns {string} The converted line.
 */
const normalizeFunctionDefOpener = (line) => 
  // Match: identifier + `(...)` + spaces + `を定義する` at end of line.
  // The function name uses ASCII identifier chars + CJK ranges, matching
  // what the existing DNCL converter accepts.
   line.replace(
    /^(\s*)([a-zA-Z_぀-ゟ゠-ヿ一-鿿][a-zA-Z0-9_぀-ゟ゠-ヿ一-鿿]*\s*\([^)]*\))\s+を定義する(\s*)$/,
    '$1関数 $2$3',
  )


/**
 * Run the DNCLv2 pre-processor on a single line. Applies all Phase 3
 * per-line transformations and returns the result; indent-marker /
 * `⎿`-based close handling lives in `dnclV2Preprocess` (which has the
 * multi-line block stack).
 * @param {string} line - The source line.
 * @returns {string} The pre-processed line (may contain `\n` if a
 *   comma-separated multi-assignment was split).
 */
const preprocessLine = (line) => {
  let out = stripLineNumber(line)
  out = stripTrailingColon(out)
  out = normalizeKurikaesuSuffix(out)
  out = normalizeFunctionDefOpener(out)
  out = normalizeAndOr(out)
  out = splitMultiAssignment(out)
  return out
}

/**
 * Pre-process a multi-line DNCLv2 source string into Smalruby DNCL form.
 * See file header for the complete list of normalizations.
 *
 * Phase 4 piece (this multi-line pass): walk the source while tracking
 * an open-block stack. For each `⎿` on a line, emit the matching closer
 * (`を実行する` / `を繰り返す` / `と定義する`) at the popped block's
 * indent. Lines without `⎿` are passed through; explicit Smalruby
 * closers (`を実行する` etc.) still work.
 * @param {string} source - The DNCLv2 source.
 * @returns {string} The pre-processed source.
 */
const dnclV2Preprocess = (source) => {
  const stack = []
  const out = []
  for (const rawLine of source.split('\n')) {
    // Phase 3 per-line transformations (may produce `\n` from multi-assignment).
    const phase3 = preprocessLine(rawLine)
    for (const line of phase3.split('\n')) {
      const { line: marked, closeCount } = processIndentMarkers(line)
      out.push(marked)
      // Detect block opener AFTER marker stripping so the indent reflects
      // the expanded form.
      const indentMatch = marked.match(/^(\s*)/)
      const indent = indentMatch ? indentMatch[1] : ''
      const body = marked.substring(indent.length)
      const type = detectBlockType(body)
      if (type) stack.push({ type, indent })
      // Emit closers for each `⎿` on this line.
      for (let i = 0; i < closeCount; i++) {
        const popped = stack.pop()
        if (!popped) break
        out.push(`${popped.indent}${closerForBlockType(popped.type)}`)
      }
    }
  }
  return out.join('\n')
}

export { dnclV2Preprocess }
