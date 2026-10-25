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
   *
   * Out-of-range Ruby lines are clamped to the first / last Ruby line. The
   * Ruby code is usually longer than the DNCL source, so returning the Ruby
   * line number unchanged would point at an unrelated or missing DNCL line.
   * @param {number} rubyLine - 1-based Ruby line number.
   * @returns {number} 1-based DNCL line number.
   */
  rubyLineToDnclLine(rubyLine) {
    const lastIdx = this._rubyToDncl.length - 1
    if (lastIdx < 0) {
      return rubyLine
    }
    const idx = Math.min(Math.max(rubyLine - 1, 0), lastIdx)
    return this._rubyToDncl[idx]
  }

  /**
   * Move conversion errors from their Ruby lines to the matching DNCL lines.
   *
   * Ruby columns have no DNCL counterpart, so each error is set to cover the
   * whole DNCL line (`column: 0`, `source: null`).
   * @param {Array<object>} errors - Errors with a 0-based Ruby `row`.
   * @returns {Array<object>} Copies of the errors with a 0-based DNCL `row`.
   */
  rubyErrorsToDncl(errors) {
    return errors.map((err) => ({
      ...err,
      row: this.rubyLineToDnclLine(err.row + 1) - 1,
      column: 0,
      source: null,
    }))
  }
}

export { DnclSourceMap }
