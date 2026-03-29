import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby'

describe('dnclToRuby', () => {
  const convert = (code) => dnclToRuby(code).ruby

  describe('variable assignment', () => {
    test('lowercase variable', () => {
      expect(convert('a = 3')).toBe('@a = 3')
    })

    test('uppercase variable (scalar)', () => {
      expect(convert('A = 3')).toBe('@_var_A_ = 3')
    })

    test('uppercase variable with arrow assignment', () => {
      expect(convert('A ← 3')).toBe('@_var_A_ = 3')
    })

    test('lowercase variable with arrow assignment', () => {
      expect(convert('a ← 3')).toBe('@a = 3')
    })

    test('uppercase array variable', () => {
      expect(convert('Kouka = [1, 5, 10]')).toBe('@_array_Kouka_ = [1, 5, 10]')
    })

    test('lowercase array variable stays as-is', () => {
      expect(convert('data = [1, 2, 3]')).toBe('@data = [1, 2, 3]')
    })

    test('compound assignment', () => {
      expect(convert('a = a + 1')).toBe('@a = @a + 1')
    })

    test('uppercase variable reference in expression', () => {
      expect(convert('a = A + 1')).toBe('@a = @_var_A_ + 1')
    })
  })

  describe('operators', () => {
    test('division with ÷', () => {
      expect(convert('a = 10 ÷ 3')).toBe('@a = 10 / 3')
    })

    test('integer division with //', () => {
      expect(convert('a = 10 // 3')).toBe('@a = (10 / 3).to_i')
    })

    test('comparison ≦', () => {
      expect(convert('a = x ≦ 10')).toBe('@a = @x <= 10')
    })

    test('comparison ≧', () => {
      expect(convert('a = x ≧ 10')).toBe('@a = @x >= 10')
    })

    test('logical かつ', () => {
      expect(convert('a = x かつ y')).toBe('@a = @x && @y')
    })

    test('logical または', () => {
      expect(convert('a = x または y')).toBe('@a = @x || @y')
    })

    test('logical でない', () => {
      expect(convert('a = x でない')).toBe('@a = !@x')
    })

    test('boolean 真', () => {
      expect(convert('a = 真')).toBe('@a = true')
    })

    test('boolean 偽', () => {
      expect(convert('a = 偽')).toBe('@a = false')
    })
  })

  describe('表示する (display)', () => {
    test('single argument', () => {
      expect(convert('表示する(a)')).toBe('say(@a, 1)')
    })

    test('multiple arguments', () => {
      expect(convert('表示する(a, b, c)')).toBe('say(@a, @b, @c, 1)')
    })

    test('string argument', () => {
      expect(convert('表示する("hello")')).toBe('say("hello", 1)')
    })

    test('expression argument', () => {
      expect(convert('表示する(a + 1)')).toBe('say(@a + 1, 1)')
    })
  })

  describe('入力 (input)', () => {
    test('input assigned to lowercase variable', () => {
      expect(convert('a = 【外部からの入力】')).toBe(
        'ask_and_wait("")\n@a = answer',
      )
    })

    test('input assigned to uppercase variable', () => {
      expect(convert('A = 【外部からの入力】')).toBe(
        'ask_and_wait("")\n@_var_A_ = answer',
      )
    })
  })

  describe('array operations', () => {
    test('array element access with uppercase name', () => {
      expect(convert('a = Kouka[0]')).toBe('@a = @_array_Kouka_[0]')
    })

    test('array element assignment', () => {
      expect(convert('Kouka[0] = 100')).toBe('@_array_Kouka_[0] = 100')
    })

    test('要素数 (element count)', () => {
      expect(convert('a = 要素数(Kouka)')).toBe('@a = @_array_Kouka_.length')
    })
  })

  describe('string literals', () => {
    test('preserves string content', () => {
      expect(convert('a = "hello world"')).toBe('@a = "hello world"')
    })

    test('Japanese bracket strings', () => {
      expect(convert('a = 「テスト」')).toBe('@a = "テスト"')
    })
  })

  describe('built-in functions', () => {
    test('整数 (integer cast)', () => {
      expect(convert('a = 整数(x)')).toBe('@a = @x.to_i')
    })

    test('文字列 (string cast)', () => {
      expect(convert('a = 文字列(x)')).toBe('@a = @x.to_s')
    })

    test('乱数 (random)', () => {
      expect(convert('a = 乱数(10)')).toBe('@a = rand(10)')
    })
  })

  describe('multiline', () => {
    test('multiple statements', () => {
      expect(convert('a = 1\nb = 2')).toBe('@a = 1\n@b = 2')
    })

    test('preserves blank lines', () => {
      expect(convert('a = 1\n\nb = 2')).toBe('@a = 1\n\n@b = 2')
    })

    test('preserves indentation', () => {
      expect(convert('  a = 1')).toBe('  @a = 1')
    })
  })

  describe('comments', () => {
    test('line comment with #', () => {
      expect(convert('# これはコメント')).toBe('# これはコメント')
    })

    test('inline comment', () => {
      expect(convert('a = 1 # コメント')).toBe('@a = 1 # コメント')
    })
  })
})
