import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby'
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl'

/**
 * Round-trip test: DNCL → Ruby → DNCL
 * Verifies that converting DNCL to Ruby and back produces the same DNCL.
 */
describe('DNCL round-trip (DNCL → Ruby → DNCL)', () => {
  const roundtrip = (dncl) => {
    const ruby = dnclToRuby(dncl).ruby
    const result = rubyToDncl(ruby).dncl
    return result
  }

  describe('variables', () => {
    test('lowercase variable assignment', () => {
      expect(roundtrip('a = 3')).toBe('a = 3')
    })

    test('uppercase scalar variable', () => {
      expect(roundtrip('A = 3')).toBe('A = 3')
    })

    test('uppercase array variable', () => {
      expect(roundtrip('Kouka = [1, 5, 10]')).toBe('Kouka = [1, 5, 10]')
    })
  })

  describe('operators', () => {
    test('boolean true/false', () => {
      expect(roundtrip('a = 真')).toBe('a = 真')
      expect(roundtrip('a = 偽')).toBe('a = 偽')
    })

    test('logical operators', () => {
      expect(roundtrip('a = x かつ y')).toBe('a = x かつ y')
      expect(roundtrip('a = x または y')).toBe('a = x または y')
    })
  })

  describe('display and input', () => {
    test('表示する round-trips', () => {
      expect(roundtrip('表示する(a)')).toBe('表示する(a)')
    })

    test('入力 round-trips', () => {
      expect(roundtrip('a = 【外部からの入力】')).toBe('a = 【外部からの入力】')
    })
  })

  describe('control flow', () => {
    test('simple if', () => {
      const dncl = 'もし a > 0 なら\n  a = 1\nを実行する'
      expect(roundtrip(dncl)).toBe(dncl)
    })

    test('if-else', () => {
      const dncl =
        'もし a > 0 なら\n  a = 1\nそうでなければ\n  a = 2\nを実行する'
      expect(roundtrip(dncl)).toBe(dncl)
    })

    test('while loop', () => {
      const dncl = 'a > 0 の間\n  a = a - 1\nを繰り返す'
      expect(roundtrip(dncl)).toBe(dncl)
    })

    test('ascending for loop', () => {
      const dncl =
        'i を 1 から 10 まで 1 ずつ増やしながら\n  表示する(i)\nを繰り返す'
      expect(roundtrip(dncl)).toBe(dncl)
    })

    test('descending for loop', () => {
      const dncl =
        'i を 10 から 0 まで 1 ずつ減らしながら\n  表示する(i)\nを繰り返す'
      expect(roundtrip(dncl)).toBe(dncl)
    })

    test('function definition', () => {
      const dncl = '関数 f(x)\n  返す x * 2\nと定義する'
      expect(roundtrip(dncl)).toBe(dncl)
    })
  })

  describe('built-in functions', () => {
    test('整数 round-trips', () => {
      expect(roundtrip('a = 整数(x)')).toBe('a = 整数(x)')
    })

    test('文字列 round-trips', () => {
      expect(roundtrip('a = 文字列(x)')).toBe('a = 文字列(x)')
    })

    test('乱数 round-trips', () => {
      expect(roundtrip('a = 乱数(10)')).toBe('a = 乱数(10)')
    })
  })

  describe('comments and blank lines', () => {
    test('preserves comments', () => {
      expect(roundtrip('# コメント')).toBe('# コメント')
    })

    test('preserves blank lines', () => {
      expect(roundtrip('a = 1\n\nb = 2')).toBe('a = 1\n\nb = 2')
    })
  })
})
