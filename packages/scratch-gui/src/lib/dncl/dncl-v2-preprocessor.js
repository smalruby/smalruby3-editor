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
 * Matches a DNCLv2 line-number prefix: `(N)` or the hyphenated form
 * `(00-1)` used by 共通テスト for lines inserted before `(01)`, plus the
 * whitespace after it (so `stripLineNumber` can reuse the same pattern).
 */
const LINE_NUMBER_RE = /^\(\d+(?:-\d+)*\)\s*/

/**
 * Strip the leading `(N) ` (and any trailing whitespace after it) from a
 * line. The line number is purely a presentation aid in DNCLv2 examples
 * — it has no semantic meaning, so we simply discard it.
 * @param {string} line - The source line.
 * @returns {string} The line with any `(N)` prefix removed.
 */
const stripLineNumber = (line) => line.replace(LINE_NUMBER_RE, '')

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
  // 共通テスト samples use both the ASCII `:` and the full-width `：`.
  const trimmed = line.replace(/\s+$/, '')
  if (!trimmed.endsWith(':') && !trimmed.endsWith('：')) return line
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
 * Insert the spaces the line converter needs around a parenthesized
 * condition written flush against its keyword, as in the 共通テスト
 * samples:
 *   `もし( a ) かつ ( b )ならば` → `もし ( a ) かつ ( b ) ならば`
 *   `そうでなくもし(a)ならば`     → `そうでなくもし (a) ならば`
 *   `(a < 3)の間`                → `(a < 3) の間`
 * @param {string} line - The line (colon / 繰り返す suffix already stripped).
 * @returns {string} The line with the keyword spacing normalized.
 */
const normalizeConditionSpacing = (line) => {
  // Indent markers have not been expanded yet, so allow them before the keyword.
  let out = line.replace(/^([\s｜|⎿]*(?:もし|そうでなくもし))\(/, '$1 (')
  if (/^[\s｜|⎿]*(?:もし|そうでなくもし)\s/.test(out)) {
    out = out.replace(/\)(なら|ならば)(\s*)$/, ') $1$2')
  }
  return out.replace(/\)(の間)(\s*)$/, ') $1$2')
}

/**
 * Convert the 共通テスト array declaration `配列変数 X を初期化する` into
 * an empty-array assignment `X = []`, which the array-name detection and
 * line converter already understand.
 * @param {string} line - The source line.
 * @returns {string} The converted line.
 */
const normalizeArrayInit = (line) => line.replace(
    /^([\s｜|⎿]*)配列変数\s+([^\s]+)\s+を初期化する(\s*(?:#.*)?)$/,
    '$1$2 = []$3',
  )

/**
 * Whether the `//` at `idx` starts a comment rather than being the
 * Smalruby DNCL integer-division operator (`a // b`). 共通テスト samples
 * write comments like `n = 1 // 生徒番号`, so `//` counts as a comment
 * only when followed by Japanese text or nothing; ASCII operands such as
 * `10 // 3` keep their division meaning.
 * @param {string} line - The source line.
 * @param {number} idx - Index of the first `/`.
 * @returns {boolean} True when `//` begins a comment.
 */
const isSlashComment = (line, idx) => {
  if (line[idx] !== '/' || line[idx + 1] !== '/') return false
  const rest = line.substring(idx + 2).trimStart()
  return rest === '' || /^[\u0080-\uffff]/.test(rest)
}

/**
 * Convert a `//` line comment (outside string literals) into the `#`
 * comment the rest of the pipeline understands (see `isSlashComment`).
 * @param {string} line - The source line.
 * @returns {string} The line with `//` replaced by `#`.
 */
const normalizeSlashComment = (line) => {
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '"' || ch === "'") {
      i = skipString(line, i, ch)
      continue
    }
    if (ch === '#') return line
    if (isSlashComment(line, i)) {
      return `${line.substring(0, i)}#${line.substring(i + 2)}`
    }
    i++
  }
  return line
}

/**
 * Net bracket depth of a line, ignoring string literals and comments.
 * A positive value means the statement continues on the next line.
 * @param {string} line - The source line.
 * @returns {number} Opening brackets minus closing brackets.
 */
const bracketDepth = (line) => {
  let depth = 0
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '"' || ch === "'") {
      i = skipString(line, i, ch)
      continue
    }
    if (ch === '#' || isSlashComment(line, i)) break
    if (ch === '(' || ch === '[' || ch === '{') depth++
    if (ch === ')' || ch === ']' || ch === '}') depth--
    i++
  }
  return depth
}

/**
 * Join statements that 共通テスト samples wrap onto unnumbered
 * continuation lines, e.g.
 *   `(10)  ｜ 表示する(i, "人目の待ち時間：",`
 *   `      ⎿          Kaishi[i] - Touchaku[i], "分間")`
 * A line is a continuation while the numbered line it belongs to still
 * has an open bracket and the line has no line number of its own. The indent markers
 * of a continuation line are dropped, but its `⎿` count is kept so the
 * caller can still close the blocks it ends.
 * @param {string} source - The raw DNCLv2 source.
 * @returns {Array<{line: string, extraCloseCount: number}>} Logical lines.
 */
const joinContinuationLines = (source) => {
  const rawLines = source.split('\n')
  const result = []
  let i = 0
  while (i < rawLines.length) {
    let line = rawLines[i]
    let extraCloseCount = 0
    // Only numbered DNCLv2 lines wrap; in un-numbered code an unclosed
    // bracket is a typo and must not swallow the rest of the program.
    let depth = LINE_NUMBER_RE.test(line) ? bracketDepth(line) : 0
    while (
      depth > 0 &&
      i + 1 < rawLines.length &&
      !LINE_NUMBER_RE.test(rawLines[i + 1].trimStart())
    ) {
      i++
      const m = rawLines[i].match(/^([\s｜|⎿]*)(.*)$/)
      extraCloseCount += (m[1].match(/⎿/g) || []).length
      const rest = m[2].trim()
      line = `${line.replace(/\s+$/, '')} ${rest}`
      depth += bracketDepth(rest)
    }
    result.push({ line, extraCloseCount })
    i++
  }
  return result
}

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
  // Find the prefix consisting of leading whitespace + indent markers.
  // We accept BOTH the full-width pipe `｜` (U+FF5C, used in DNCLv2 sources)
  // and the ASCII pipe `|` (U+007C). The Smalruby auto-correct feature
  // (on by default) converts `｜` to `|` on input, so the marker that
  // reaches us may be either one. The hook character `⎿` (U+23BF, Box
  // Drawing) is in a Unicode block auto-correct doesn't touch.
  const m = body.match(/^([\s｜|⎿]*)(.*)$/)
  if (!m) return { line: body, closeCount: 0 }
  const prefix = m[1]
  const rest = m[2]
  const markers = prefix.match(/[｜|⎿]/g) || []
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
 * Explicit Smalruby DNCL block closers (a line consisting of just one of these).
 */
const EXPLICIT_CLOSERS = new Set(['を実行する', 'を繰り返す', 'と定義する'])

/**
 * Whether the line continues an `if` block (`そうでなくもし` / `そうでなければ`)
 * instead of starting a new statement.
 * @param {string} body - The line content with indent stripped.
 * @returns {boolean} True for an else / else-if line.
 */
const isIfContinuation = (body) =>
  body === 'そうでなければ' || /^そうでなくもし\s/.test(body)

/**
 * Visual width of a leading indent. A tab counts as 4 columns and the
 * full-width space (U+3000) as 2, so mixed indentation still compares sensibly.
 * @param {string} indent - Leading whitespace.
 * @returns {number} The indent width in columns.
 */
const indentWidth = (indent) => {
  let width = 0
  for (const ch of indent) {
    if (ch === '\t') width += 4
    else if (ch === '\u3000') width += 2
    else width += 1
  }
  return width
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
  // `//` comments are a 共通テスト notation, so only numbered DNCLv2 lines
  // get them; un-numbered Smalruby DNCL keeps `合計 // 個数` as division.
  const numbered = LINE_NUMBER_RE.test(line)
  let out = stripLineNumber(line)
  if (numbered) out = normalizeSlashComment(out)
  out = normalizeArrayInit(out)
  out = stripTrailingColon(out)
  out = normalizeKurikaesuSuffix(out)
  out = normalizeConditionSpacing(out)
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
  const emitCloser = (block) =>
    out.push(`${block.indent}${closerForBlockType(block.type)}`)
  // Close indentation-style blocks (opener ends with `:`, body indented, no
  // `⎿` and no closer line, as in 共通テスト code typed without the `｜` /
  // `⎿` markers) once a line at the opener's indent or shallower appears.
  const closeByIndent = (width, body) => {
    const explicit = EXPLICIT_CLOSERS.has(body)
    while (stack.length > 0) {
      const top = stack[stack.length - 1]
      if (top.colon && !top.hasBody) {
        if (width > top.width) {
          top.hasBody = true
          return
        }
        // No indented body: the block is closed some other way.
        top.colon = false
      }
      if (!top.colon) {
        if (explicit) stack.pop()
        return
      }
      if (width > top.width) return
      if (width === top.width && explicit) {
        stack.pop()
        return
      }
      if (width === top.width && top.type === 'if' && isIfContinuation(body)) {
        return
      }
      emitCloser(stack.pop())
    }
  }
  for (const { line: rawLine, extraCloseCount } of joinContinuationLines(
    source,
  )) {
    // Phase 3 per-line transformations (may produce `\n` from multi-assignment).
    const phase3 = preprocessLine(rawLine)
    const colonOpener = /[:：]\s*$/.test(rawLine) && !/[:：]\s*$/.test(phase3)
    const pieces = phase3.split('\n')
    for (const [pieceIdx, line] of pieces.entries()) {
      const { line: marked, closeCount: markerCloseCount } =
        processIndentMarkers(line)
      // `⎿` markers on joined continuation lines close blocks after the
      // whole logical line, i.e. after its last piece.
      const closeCount =
        markerCloseCount +
        (pieceIdx === pieces.length - 1 ? extraCloseCount : 0)
      // Detect block opener AFTER marker stripping so the indent reflects
      // the expanded form.
      const indentMatch = marked.match(/^(\s*)/)
      const indent = indentMatch ? indentMatch[1] : ''
      const body = marked.substring(indent.length).replace(/\s+$/, '')
      const width = indentWidth(indent)
      if (body !== '' && !body.startsWith('#')) closeByIndent(width, body)
      out.push(marked)
      const type = detectBlockType(body)
      if (type) {
        stack.push({ type, indent, width, colon: colonOpener, hasBody: false })
      }
      // Emit closers for each `⎿` on this line.
      for (let i = 0; i < closeCount; i++) {
        const popped = stack.pop()
        if (!popped) break
        emitCloser(popped)
      }
    }
  }
  // Indentation-style blocks still open at the end of the program.
  while (stack.length > 0) {
    const top = stack[stack.length - 1]
    if (!top.colon || !top.hasBody) break
    emitCloser(stack.pop())
  }
  return out.join('\n')
}

export { dnclV2Preprocess }
