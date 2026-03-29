// === Smalruby: This file is Smalruby-specific (DNCL ↔ Ruby source map) ===

/**
 * Source map for DNCL ↔ Ruby line position mapping.
 *
 * Most DNCL lines map 1:1 to Ruby lines. The main exception is
 * `【外部からの入力】` which expands to 2 Ruby lines (ask_and_wait + assignment).
 * This class tracks line offsets caused by such expansions.
 */
class DnclSourceMap {
  /**
   * Build a source map from DNCL and Ruby sources.
   * @param {string} dnclSource - The original DNCL source code.
   * @param {string} rubySource - The transpiled Ruby source code.
   */
  constructor(dnclSource, rubySource) {
    const dnclLines = dnclSource.split('\n')
    const rubyLines = rubySource.split('\n')

    // dnclToRuby[i] = the Ruby line number (1-based) corresponding to
    // DNCL line i+1 (1-based)
    this._dnclToRuby = []

    // rubyToDncl[i] = the DNCL line number (1-based) corresponding to
    // Ruby line i+1 (1-based)
    this._rubyToDncl = []

    // Build mapping by comparing line counts
    let rubyLine = 1
    for (let dnclIdx = 0; dnclIdx < dnclLines.length; dnclIdx++) {
      const dnclLineNum = dnclIdx + 1
      this._dnclToRuby.push(rubyLine)

      // Detect input expansion: check if this DNCL line contains 【外部からの入力】
      const isInput = /【外部からの入力】/.test(dnclLines[dnclIdx])

      if (isInput) {
        // This DNCL line maps to 2 Ruby lines
        this._rubyToDncl.push(dnclLineNum) // ask_and_wait
        rubyLine++
        this._rubyToDncl.push(dnclLineNum) // @var = answer
        rubyLine++
      } else {
        this._rubyToDncl.push(dnclLineNum)
        rubyLine++
      }
    }

    // Fill remaining Ruby lines if any (shouldn't happen normally)
    while (this._rubyToDncl.length < rubyLines.length) {
      this._rubyToDncl.push(
        this._rubyToDncl.length > 0
          ? this._rubyToDncl[this._rubyToDncl.length - 1]
          : 1,
      )
    }
  }

  /**
   * Map a DNCL line number to a Ruby line number.
   * @param {number} dnclLine - 1-based DNCL line number.
   * @returns {number} 1-based Ruby line number.
   */
  dnclLineToRubyLine(dnclLine) {
    const idx = dnclLine - 1
    if (idx < 0 || idx >= this._dnclToRuby.length) {
      return dnclLine
    }
    return this._dnclToRuby[idx]
  }

  /**
   * Map a Ruby line number to a DNCL line number.
   * @param {number} rubyLine - 1-based Ruby line number.
   * @returns {number} 1-based DNCL line number.
   */
  rubyLineToDnclLine(rubyLine) {
    const idx = rubyLine - 1
    if (idx < 0 || idx >= this._rubyToDncl.length) {
      return rubyLine
    }
    return this._rubyToDncl[idx]
  }

  /**
   * Map a Ruby position (line, column) to a DNCL position.
   * @param {number} rubyLine - 1-based Ruby line number.
   * @param {number} rubyColumn - 1-based Ruby column number.
   * @returns {object} Object with `line` and `column` (1-based).
   */
  rubyPositionToDncl(rubyLine, rubyColumn) {
    return {
      line: this.rubyLineToDnclLine(rubyLine),
      column: rubyColumn,
    }
  }
}

export { DnclSourceMap }
