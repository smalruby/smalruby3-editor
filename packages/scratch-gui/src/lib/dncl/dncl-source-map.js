// === Smalruby: This file is Smalruby-specific (DNCL ↔ Ruby source map) ===

/**
 * Source map for DNCL ↔ Ruby line position mapping.
 *
 * DNCL and Ruby lines do not correspond 1:1: the DNCLv2 pre-processor joins
 * continuation lines, splits multi-assignments and adds block closers, and
 * the line converter expands input lines and counting loops into 2 Ruby
 * lines. The map is therefore built from the per-line correspondence that
 * `dnclToRuby` records while converting (use `dnclToRuby(dncl).sourceMap`).
 */
class DnclSourceMap {
  /**
   * Build a source map from the Ruby → DNCL line correspondence.
   * @param {Array<number>} rubyToDncl - `rubyToDncl[i]` is the 1-based DNCL
   *   line of Ruby line i+1.
   * @param {number} dnclLineCount - Number of lines in the DNCL source.
   */
  constructor(rubyToDncl, dnclLineCount) {
    // rubyToDncl[i] = the DNCL line number (1-based) corresponding to
    // Ruby line i+1 (1-based)
    this._rubyToDncl = rubyToDncl.slice()

    // dnclToRuby[i] = the first Ruby line number (1-based) corresponding to
    // DNCL line i+1 (1-based)
    this._dnclToRuby = new Array(dnclLineCount).fill(null)
    this._rubyToDncl.forEach((dnclLine, idx) => {
      const dnclIdx = dnclLine - 1
      if (
        dnclIdx >= 0 &&
        dnclIdx < dnclLineCount &&
        this._dnclToRuby[dnclIdx] === null
      ) {
        this._dnclToRuby[dnclIdx] = idx + 1
      }
    })
    // DNCL lines without their own Ruby line (continuation lines joined into
    // the line above) point at the Ruby line of the nearest line above.
    let previous = 1
    for (let i = 0; i < this._dnclToRuby.length; i++) {
      if (this._dnclToRuby[i] === null) {
        this._dnclToRuby[i] = previous
      } else {
        previous = this._dnclToRuby[i]
      }
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
