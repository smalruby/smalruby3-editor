import { DnclSourceMap } from '../../../../src/lib/dncl/dncl-source-map'
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby'

describe('DnclSourceMap', () => {
  describe('line mapping', () => {
    test('simple 1:1 line mapping', () => {
      const dncl = 'a = 1\nb = 2\nc = 3'
      const result = dnclToRuby(dncl)
      const map = new DnclSourceMap(dncl, result.ruby)

      // DNCL line 1 → Ruby line 1
      expect(map.dnclLineToRubyLine(1)).toBe(1)
      expect(map.dnclLineToRubyLine(2)).toBe(2)
      expect(map.dnclLineToRubyLine(3)).toBe(3)
    })

    test('input expansion: 1 DNCL line → 2 Ruby lines', () => {
      const dncl = 'a = 【外部からの入力】\nb = 2'
      const result = dnclToRuby(dncl)
      const map = new DnclSourceMap(dncl, result.ruby)

      // DNCL line 1 → Ruby lines 1-2
      expect(map.dnclLineToRubyLine(1)).toBe(1)
      // DNCL line 2 → Ruby line 3 (shifted by expansion)
      expect(map.dnclLineToRubyLine(2)).toBe(3)
    })

    test('reverse: Ruby line to DNCL line', () => {
      const dncl = 'a = 【外部からの入力】\nb = 2'
      const result = dnclToRuby(dncl)
      const map = new DnclSourceMap(dncl, result.ruby)

      // Ruby line 1 (ask_and_wait) → DNCL line 1
      expect(map.rubyLineToDnclLine(1)).toBe(1)
      // Ruby line 2 (@a = answer) → DNCL line 1
      expect(map.rubyLineToDnclLine(2)).toBe(1)
      // Ruby line 3 → DNCL line 2
      expect(map.rubyLineToDnclLine(3)).toBe(2)
    })

    test('control flow: 1:1 mapping', () => {
      const dncl = 'もし a > 0 なら\n  a = 1\nを実行する'
      const result = dnclToRuby(dncl)
      const map = new DnclSourceMap(dncl, result.ruby)

      expect(map.dnclLineToRubyLine(1)).toBe(1)
      expect(map.dnclLineToRubyLine(2)).toBe(2)
      expect(map.dnclLineToRubyLine(3)).toBe(3)
    })

    test('blank lines preserved', () => {
      const dncl = 'a = 1\n\nb = 2'
      const result = dnclToRuby(dncl)
      const map = new DnclSourceMap(dncl, result.ruby)

      expect(map.dnclLineToRubyLine(1)).toBe(1)
      expect(map.dnclLineToRubyLine(2)).toBe(2)
      expect(map.dnclLineToRubyLine(3)).toBe(3)
    })
  })

  describe('error position mapping', () => {
    test('maps Ruby error position to DNCL position', () => {
      const dncl = 'a = 【外部からの入力】\nb = 2\nc = error'
      const result = dnclToRuby(dncl)
      const map = new DnclSourceMap(dncl, result.ruby)

      // Error on Ruby line 4 (c = error) → DNCL line 3
      const dnclPos = map.rubyPositionToDncl(4, 1)
      expect(dnclPos.line).toBe(3)
    })
  })
})
