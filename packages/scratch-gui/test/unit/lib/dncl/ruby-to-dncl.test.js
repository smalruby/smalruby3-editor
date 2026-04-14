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

    test('ask + answer → 入力', () => {
      expect(convert('ask("")\n@a = answer')).toBe(
        'a = 【外部からの入力】',
      )
    })

    test('ask_and_wait + answer → 入力 (legacy)', () => {
      expect(convert('ask_and_wait("")\n@a = answer')).toBe(
        'a = 【外部からの入力】',
      )
    })

    test('puts → 表示する', () => {
      expect(convert('puts(@a)')).toBe('表示する(a)')
    })

    test('print → 表示する', () => {
      expect(convert('print(@a)')).toBe('表示する(a)')
    })

    test('p → 表示する', () => {
      expect(convert('p(@a)')).toBe('表示する(a)')
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

    test('.round → 四捨五入()', () => {
      expect(convert('@a = @x.round')).toBe('a = 四捨五入(x)')
    })

    test('.floor → 切り捨て()', () => {
      expect(convert('@a = @x.floor')).toBe('a = 切り捨て(x)')
    })

    test('.ceil → 切り上げ()', () => {
      expect(convert('@a = @x.ceil')).toBe('a = 切り上げ(x)')
    })

    test('.abs → 絶対値()', () => {
      expect(convert('@a = @x.abs')).toBe('a = 絶対値(x)')
    })

    test('Math.sqrt() → 平方根()', () => {
      expect(convert('@a = Math.sqrt(@x)')).toBe('a = 平方根(x)')
    })

    test('.include?() → 含む()', () => {
      expect(convert('@a = @x.include?("ell")')).toBe('a = 含む(x, "ell")')
    })
  })

  describe('display: say with any duration', () => {
    test('say with 1 second', () => {
      expect(convert('say(@a, 1)')).toBe('表示する(a)')
    })

    test('say with 2 seconds', () => {
      expect(convert('say(@a, 2)')).toBe('表示する(a)')
    })

    test('say with 0.5 seconds', () => {
      expect(convert('say(@a, 0.5)')).toBe('表示する(a)')
    })
  })

  describe('control flow: until', () => {
    test('until loop converts to でない の間', () => {
      expect(convert('until @a > 10\n  @a = @a + 1\nend')).toBe(
        'a > 10 でない の間\n  a = a + 1\nを繰り返す',
      )
    })
  })

  describe('control flow: N.times', () => {
    test('N.times converts to for loop', () => {
      expect(convert('10.times do\n  @a = @a + 1\nend')).toBe(
        '_ を 1 から 10 まで 1 ずつ増やしながら\n  a = a + 1\nを繰り返す',
      )
    })
  })

  describe('control flow: if', () => {
    test('simple if', () => {
      expect(convert('if @a > 0\n  @a = 1\nend')).toBe(
        'もし a > 0 ならば\n  a = 1\nを実行する',
      )
    })

    test('if-else', () => {
      expect(
        convert('if @a > 0\n  @a = 1\nelse\n  @a = 2\nend'),
      ).toBe('もし a > 0 ならば\n  a = 1\nそうでなければ\n  a = 2\nを実行する')
    })

    test('if-elsif-else', () => {
      expect(
        convert(
          'if @a > 0\n  @a = 1\nelsif @a > 5\n  @a = 2\nelse\n  @a = 3\nend',
        ),
      ).toBe(
        'もし a > 0 ならば\n  a = 1\nそうでなくもし a > 5 ならば\n  a = 2\nそうでなければ\n  a = 3\nを実行する',
      )
    })
  })

  describe('control flow: for loop (step syntax)', () => {
    test('ascending step for loop', () => {
      expect(convert('(1..10).step(1) do |i|\n  say(@i, 1)\nend')).toBe(
        'i を 1 から 10 まで 1 ずつ増やしながら\n  表示する(i)\nを繰り返す',
      )
    })

    test('descending step for loop', () => {
      expect(convert('10.step(0, -1) do |i|\n  say(@i, 1)\nend')).toBe(
        'i を 10 から 0 まで 1 ずつ減らしながら\n  表示する(i)\nを繰り返す',
      )
    })
  })

  describe('control flow: for loop (while pattern)', () => {
    test('ascending while-based for loop', () => {
      const ruby = '@i = 1\nwhile @i <= 10\n  say(@i, 1)\n  @i += 1\nend'
      expect(convert(ruby)).toBe(
        'i を 1 から 10 まで 1 ずつ増やしながら\n  表示する(i)\nを繰り返す',
      )
    })

    test('descending while-based for loop', () => {
      const ruby = '@i = 10\nwhile @i >= 0\n  say(@i, 1)\n  @i += -1\nend'
      expect(convert(ruby)).toBe(
        'i を 10 から 0 まで 1 ずつ減らしながら\n  表示する(i)\nを繰り返す',
      )
    })

    test('ascending while-based for loop with step 2', () => {
      const ruby = '@i = 0\nwhile @i <= @n\n  say(@i, 1)\n  @i += 2\nend'
      expect(convert(ruby)).toBe(
        'i を 0 から n まで 2 ずつ増やしながら\n  表示する(i)\nを繰り返す',
      )
    })

    test('nested while-based for loops', () => {
      const ruby = [
        '@i = 1',
        'while @i <= 3',
        '  @j = 1',
        '  while @j <= 3',
        '    say(@i, 1)',
        '    @j += 1',
        '  end',
        '  @i += 1',
        'end',
      ].join('\n')
      const dncl = [
        'i を 1 から 3 まで 1 ずつ増やしながら',
        '  j を 1 から 3 まで 1 ずつ増やしながら',
        '    表示する(i)',
        '  を繰り返す',
        'を繰り返す',
      ].join('\n')
      expect(convert(ruby)).toBe(dncl)
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
