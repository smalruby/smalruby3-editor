import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl'

describe('rubyToDncl', () => {
  const convert = (code) => rubyToDncl(code).dncl

  describe('variable assignment', () => {
    test('lowercase variable', () => {
      expect(convert('@a = 3')).toBe('a = 3')
    })

    test('uppercase scalar variable', () => {
      expect(convert('@_var_A_ = 3')).toBe('A = 3')
    })

    test('uppercase array variable', () => {
      expect(convert('@_array_Kouka_ = [1, 5, 10]')).toBe(
        'Kouka = [1, 5, 10]',
      )
    })

    test('variable reference in expression', () => {
      expect(convert('@a = @_var_A_ + 1')).toBe('a = A + 1')
    })
  })

  describe('operators', () => {
    test('logical &&', () => {
      expect(convert('@a = @x && @y')).toBe('a = x かつ y')
    })

    test('logical ||', () => {
      expect(convert('@a = @x || @y')).toBe('a = x または y')
    })

    test('logical !', () => {
      expect(convert('@a = !@x')).toBe('a = x でない')
    })

    test('boolean true', () => {
      expect(convert('@a = true')).toBe('a = 真')
    })

    test('boolean false', () => {
      expect(convert('@a = false')).toBe('a = 偽')
    })
  })

  describe('display and input', () => {
    test('say → 表示する', () => {
      expect(convert('say(@a, 1)')).toBe('表示する(a)')
    })

    test('say with multiple args', () => {
      expect(convert('say(@a, @b, @c, 1)')).toBe('表示する(a, b, c)')
    })

    test('ask_and_wait + answer → 入力', () => {
      expect(convert('ask_and_wait("")\n@a = answer')).toBe(
        'a = 【外部からの入力】',
      )
    })
  })

  describe('built-in functions', () => {
    test('.to_i → 整数()', () => {
      expect(convert('@a = @x.to_i')).toBe('a = 整数(x)')
    })

    test('.to_s → 文字列()', () => {
      expect(convert('@a = @x.to_s')).toBe('a = 文字列(x)')
    })

    test('rand() → 乱数()', () => {
      expect(convert('@a = rand(10)')).toBe('a = 乱数(10)')
    })

    test('.length → 要素数()', () => {
      expect(convert('@a = @_array_Kouka_.length')).toBe('a = 要素数(Kouka)')
    })
  })

  describe('control flow: if', () => {
    test('simple if', () => {
      expect(convert('if @a > 0\n  @a = 1\nend')).toBe(
        'もし a > 0 なら\n  a = 1\nを実行する',
      )
    })

    test('if-else', () => {
      expect(
        convert('if @a > 0\n  @a = 1\nelse\n  @a = 2\nend'),
      ).toBe('もし a > 0 なら\n  a = 1\nそうでなければ\n  a = 2\nを実行する')
    })

    test('if-elsif-else', () => {
      expect(
        convert(
          'if @a > 0\n  @a = 1\nelsif @a > 5\n  @a = 2\nelse\n  @a = 3\nend',
        ),
      ).toBe(
        'もし a > 0 なら\n  a = 1\nそうでなくもし a > 5 なら\n  a = 2\nそうでなければ\n  a = 3\nを実行する',
      )
    })
  })

  describe('control flow: for loop', () => {
    test('ascending for loop', () => {
      expect(convert('(1..10).step(1) do |i|\n  say(@i, 1)\nend')).toBe(
        'i を 1 から 10 まで 1 ずつ増やしながら\n  表示する(i)\nを繰り返す',
      )
    })

    test('descending for loop', () => {
      expect(convert('10.step(0, -1) do |i|\n  say(@i, 1)\nend')).toBe(
        'i を 10 から 0 まで 1 ずつ減らしながら\n  表示する(i)\nを繰り返す',
      )
    })
  })

  describe('control flow: while loop', () => {
    test('while loop', () => {
      expect(convert('while @a > 0\n  @a = @a - 1\nend')).toBe(
        'a > 0 の間\n  a = a - 1\nを繰り返す',
      )
    })
  })

  describe('control flow: function', () => {
    test('function definition', () => {
      expect(convert('def f(x)\n  return @x * 2\nend')).toBe(
        '関数 f(x)\n  返す x * 2\nと定義する',
      )
    })
  })

  describe('comments', () => {
    test('preserves comments', () => {
      expect(convert('# コメント')).toBe('# コメント')
    })
  })

  describe('multiline', () => {
    test('preserves blank lines', () => {
      expect(convert('@a = 1\n\n@b = 2')).toBe('a = 1\n\nb = 2')
    })
  })
})
