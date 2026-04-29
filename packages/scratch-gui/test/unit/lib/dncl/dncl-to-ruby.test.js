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
        'ask("")\n@a = answer',
      )
    })

    test('input assigned to uppercase variable', () => {
      expect(convert('A = 【外部からの入力】')).toBe(
        'ask("")\n@_var_A_ = answer',
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

    test('四捨五入 (round)', () => {
      expect(convert('a = 四捨五入(x)')).toBe('@a = @x.round')
    })

    test('切り捨て (floor)', () => {
      expect(convert('a = 切り捨て(x)')).toBe('@a = @x.floor')
    })

    test('切り上げ (ceil)', () => {
      expect(convert('a = 切り上げ(x)')).toBe('@a = @x.ceil')
    })

    test('絶対値 (abs)', () => {
      expect(convert('a = 絶対値(x)')).toBe('@a = @x.abs')
    })

    test('平方根 (sqrt)', () => {
      expect(convert('a = 平方根(x)')).toBe('@a = Math.sqrt(@x)')
    })

    test('含む (contains)', () => {
      expect(convert('a = 含む("hello", "ell")')).toBe(
        '@a = "hello".include?("ell")',
      )
    })
  })

  describe('nested function calls', () => {
    test('表示する(乱数(1..10)) keeps closing parens balanced', () => {
      expect(convert('表示する(乱数(1..10))')).toBe('say(rand(1..10), 1)')
    })

    test('表示する(整数(x)) places .to_i inside say argument', () => {
      expect(convert('表示する(整数(x))')).toBe('say(@x.to_i, 1)')
    })

    test('表示する(絶対値(x)) places .abs inside say argument', () => {
      expect(convert('表示する(絶対値(x))')).toBe('say(@x.abs, 1)')
    })

    test('表示する(要素数(A)) keeps array conversion inside say', () => {
      expect(convert('表示する(要素数(Kouka))')).toBe(
        'say(@_array_Kouka_.length, 1)',
      )
    })

    test('表示する with expression containing 乱数', () => {
      expect(convert('表示する(乱数(1..10) + 5)')).toBe(
        'say(rand(1..10) + 5, 1)',
      )
    })

    test('含む with 乱数 as second argument', () => {
      expect(convert('a = 含む(s, 乱数(1..10))')).toBe(
        '@a = @s.include?(rand(1..10))',
      )
    })

    test('含む with 3 args is left unchanged (only 2-arg form is valid)', () => {
      // Identifier conversion still runs (a → @a, b → @b, s → @s),
      // but 含む itself stays as-is to avoid generating malformed Ruby.
      expect(convert('含む(s, a, b)')).toBe('含む(@s, @a, @b)')
    })
  })

  describe('user-defined function calls', () => {
    test('bare function call after definition keeps name without @', () => {
      const dncl = '関数 myfunc(x)\n  返す 5\nと定義する\nmyfunc(3)'
      const ruby = 'def myfunc(x)\n  return 5\nend\nmyfunc(3)'
      expect(convert(dncl)).toBe(ruby)
    })

    test('function call in assignment', () => {
      expect(
        convert('関数 myfunc(x)\n  返す 5\nと定義する\na = myfunc(3)'),
      ).toBe('def myfunc(x)\n  return 5\nend\n@a = myfunc(3)')
    })

    test('function call inside 表示する', () => {
      expect(
        convert('関数 myfunc(x)\n  返す 5\nと定義する\n表示する(myfunc(3))'),
      ).toBe('def myfunc(x)\n  return 5\nend\nsay(myfunc(3), 1)')
    })

    test('function called before definition (forward reference)', () => {
      // detectFunctionNames runs before line conversion, so order should not matter.
      expect(
        convert('myfunc(3)\n関数 myfunc(x)\n  返す 5\nと定義する'),
      ).toBe('myfunc(3)\ndef myfunc(x)\n  return 5\nend')
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

  describe('validation', () => {
    test('@ in variable name returns errors', () => {
      const result = dnclToRuby('@a = 10')
      expect(result.ruby).toBeNull()
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].line).toBe(1)
      expect(result.errors[0].column).toBe(1)
    })

    test('$ in variable name returns errors', () => {
      const result = dnclToRuby('$a = 10')
      expect(result.ruby).toBeNull()
      expect(result.errors).toHaveLength(1)
    })

    test('@ inside string is allowed', () => {
      const result = dnclToRuby('a = "user@example.com"')
      expect(result.ruby).toBe('@a = "user@example.com"')
      expect(result.errors).toHaveLength(0)
    })

    test('@ in comment is allowed', () => {
      const result = dnclToRuby('a = 1 # @todo')
      expect(result.ruby).toBe('@a = 1 # @todo')
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('control flow: if', () => {
    test('simple if', () => {
      expect(convert('もし a > 0 なら\n  a = 1\nを実行する')).toBe(
        'if @a > 0\n  @a = 1\nend',
      )
    })

    test('if-else', () => {
      expect(
        convert(
          'もし a > 0 なら\n  a = 1\nそうでなければ\n  a = 2\nを実行する',
        ),
      ).toBe('if @a > 0\n  @a = 1\nelse\n  @a = 2\nend')
    })

    test('if-elsif-else', () => {
      expect(
        convert(
          'もし a > 0 なら\n  a = 1\nそうでなくもし a > 5 なら\n  a = 2\nそうでなければ\n  a = 3\nを実行する',
        ),
      ).toBe(
        'if @a > 0\n  @a = 1\nelsif @a > 5\n  @a = 2\nelse\n  @a = 3\nend',
      )
    })

    test('if with ならば variant', () => {
      expect(convert('もし a > 0 ならば\n  a = 1\nを実行する')).toBe(
        'if @a > 0\n  @a = 1\nend',
      )
    })
  })

  describe('control flow: for loop', () => {
    test('ascending for loop', () => {
      expect(
        convert(
          'i を 1 から 10 まで 1 ずつ増やしながら\n  表示する(i)\nを繰り返す',
        ),
      ).toBe('@i = 1\nwhile @i <= 10\n  say(@i, 1)\n  @i += 1\nend')
    })

    test('descending for loop', () => {
      expect(
        convert(
          'i を 10 から 0 まで 1 ずつ減らしながら\n  表示する(i)\nを繰り返す',
        ),
      ).toBe('@i = 10\nwhile @i >= 0\n  say(@i, 1)\n  @i += -1\nend')
    })

    test('for loop with expression bounds', () => {
      expect(
        convert(
          'i を 0 から n まで 2 ずつ増やしながら\n  表示する(i)\nを繰り返す',
        ),
      ).toBe('@i = 0\nwhile @i <= @n\n  say(@i, 1)\n  @i += 2\nend')
    })

    test('nested for loops', () => {
      const dncl = [
        'i を 1 から 3 まで 1 ずつ増やしながら',
        '  j を 1 から 3 まで 1 ずつ増やしながら',
        '    表示する(i)',
        '  を繰り返す',
        'を繰り返す',
      ].join('\n')
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
      expect(convert(dncl)).toBe(ruby)
    })
  })

  describe('control flow: while loop', () => {
    test('while loop', () => {
      expect(convert('a > 0 の間\n  a = a - 1\nを繰り返す')).toBe(
        'while @a > 0\n  @a = @a - 1\nend',
      )
    })

    test('while loop with complex condition', () => {
      expect(convert('a > 0 かつ b < 10 の間\n  a = a - 1\nを繰り返す')).toBe(
        'while @a > 0 && @b < 10\n  @a = @a - 1\nend',
      )
    })
  })

  describe('control flow: function', () => {
    test('function definition', () => {
      expect(
        convert('関数 f(x)\n  返す x * 2\nと定義する'),
      ).toBe('def f(x)\n  return @x * 2\nend')
    })

    test('function with multiple params', () => {
      expect(
        convert('関数 add(a, b)\n  返す a + b\nと定義する'),
      ).toBe('def add(a, b)\n  return @a + @b\nend')
    })
  })
})
