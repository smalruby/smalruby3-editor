import { autoCorrect, defaultSettings } from '../../src/lib/auto-correct'

// Integration tests for auto-correct feature
// These test realistic Ruby code scenarios end-to-end

describe('auto-correct integration', () => {
  describe('realistic Ruby code patterns', () => {
    test('should fix fullwidth quotes in puts statement', () => {
      const input = 'ｐｕｔｓ（＂こんにちは＂）'
      const result = autoCorrect(input, defaultSettings)
      expect(result).toBe('puts("こんにちは")')
    })

    test('should fix fullwidth assignment with variable', () => {
      const input = 'ｘ　＝　１０'
      const result = autoCorrect(input, defaultSettings)
      expect(result).toBe('x = 10')
    })

    test('should fix multiline Smalruby program', () => {
      const input = [
        'ｓｅｌｆ．Ｘ座標　＝　１００',
        'ｓｅｌｆ．Ｙ座標　＝　ー５０',
        'ｐｕｔｓ（ｓｅｌｆ．Ｘ座標）',
      ].join('\n')
      const expected = ['self.X座標 = 100', 'self.Y座標 = ー50', 'puts(self.X座標)'].join('\n')
      expect(autoCorrect(input, defaultSettings)).toBe(expected)
    })

    test('should fix fullwidth comparison operators', () => {
      const input = 'ｉｆ　ｘ　＞＝　１０'
      const result = autoCorrect(input, defaultSettings)
      expect(result).toBe('if x >= 10')
    })

    test('should fix fullwidth array syntax', () => {
      const input = '配列　＝　［１，　２，　３］'
      const result = autoCorrect(input, defaultSettings)
      expect(result).toBe('配列 = [1, 2, 3]')
    })

    test('should fix fullwidth hash syntax', () => {
      const input = 'ハッシュ　＝　｛ＡＢＣ：　１２３｝'
      const result = autoCorrect(input, defaultSettings)
      expect(result).toBe('ハッシュ = {ABC: 123}')
    })

    test('should fix smart double quotes in puts statement', () => {
      const input = 'puts \u201Cハロー\u201D'
      const result = autoCorrect(input, defaultSettings)
      expect(result).toBe('puts "ハロー"')
    })

    test('should fix smart single quotes', () => {
      const input = 'x = \u2018hello\u2019'
      const result = autoCorrect(input, defaultSettings)
      expect(result).toBe("x = 'hello'")
    })

    test('should fix minus sign U+2212', () => {
      const input = 'result = 10 \u2212 3'
      const result = autoCorrect(input, defaultSettings)
      expect(result).toBe('result = 10 - 3')
    })

    test('should fix fullwidth method definition', () => {
      const input = ['ｄｅｆ　ｍｅｔｈｏｄ（ａ，　ｂ）', '　　ａ　＋　ｂ', 'ｅｎｄ'].join('\n')
      const expected = ['def method(a, b)', '  a + b', 'end'].join('\n')
      expect(autoCorrect(input, defaultSettings)).toBe(expected)
    })
  })

  describe('string content preservation with replaceInStrings off', () => {
    const settingsNoStrings = { ...defaultSettings, replaceInStrings: false }

    test('should not modify string content but fix surrounding code', () => {
      const input = 'ｐｕｔｓ "ＡＢＣ１２３"'
      const result = autoCorrect(input, settingsNoStrings)
      expect(result).toBe('puts "ＡＢＣ１２３"')
    })

    test('should handle multiple strings on same line', () => {
      const input = "ｐｕｔｓ 'Ａ' ＋ 'Ｂ'"
      const result = autoCorrect(input, settingsNoStrings)
      expect(result).toBe("puts 'Ａ' + 'Ｂ'")
    })

    test('should handle code between strings', () => {
      const input = 'ｘ ＝ "Ａ" ＋ ｙ ＋ "Ｂ"'
      const result = autoCorrect(input, settingsNoStrings)
      expect(result).toBe('x = "Ａ" + y + "Ｂ"')
    })

    test('should preserve content inside smart-quoted strings', () => {
      const input = 'ｐｕｔｓ \u201CＡＢＣ\u201D'
      const result = autoCorrect(input, settingsNoStrings)
      // Smart quotes become halfwidth, but content inside is preserved
      expect(result).toBe('puts "ＡＢＣ"')
    })
  })

  describe('selective settings', () => {
    test('should only convert numbers when only numbers enabled', () => {
      const settings = {
        ...defaultSettings,
        fullwidthAlpha: false,
        fullwidthSymbols: false,
        fullwidthSpace: false,
      }
      const input = 'ｘ　＝　１０'
      const result = autoCorrect(input, settings)
      expect(result).toBe('ｘ　＝　10')
    })

    test('should only convert alpha when only alpha enabled', () => {
      const settings = {
        ...defaultSettings,
        fullwidthNumbers: false,
        fullwidthSymbols: false,
        fullwidthSpace: false,
      }
      const input = 'ｘ　＝　１０'
      const result = autoCorrect(input, settings)
      expect(result).toBe('x　＝　１０')
    })
  })

  describe('escape handling in strings', () => {
    test('should preserve escaped fullwidth chars', () => {
      const input = '"\\１ ＋ ２"'
      const result = autoCorrect(input, defaultSettings)
      // \１ stays as-is, but ＋ and ２ are converted
      expect(result).toBe('"\\１ + 2"')
    })

    test('should handle double escaped backslash', () => {
      const input = '"\\\\１"'
      const result = autoCorrect(input, defaultSettings)
      // \\\\ is escaped backslash, so １ should be converted
      expect(result).toBe('"\\\\1"')
    })
  })

  describe('performance with large input', () => {
    test('should handle 1000-line program efficiently', () => {
      const lines = []
      for (let i = 0; i < 1000; i++) {
        lines.push(`ｘ＿${i}　＝　${i}`)
      }
      const input = lines.join('\n')
      const start = Date.now()
      const result = autoCorrect(input, defaultSettings)
      const elapsed = Date.now() - start

      // Should complete in under 500ms
      expect(elapsed).toBeLessThan(500)
      // Verify first and last lines converted
      const resultLines = result.split('\n')
      expect(resultLines[0]).toMatch(/^x_0 = 0$/)
      expect(resultLines[999]).toMatch(/^x_999 = 999$/)
    })
  })
})
