import {
  findMatchingClose,
  replaceCall,
  skipString,
  splitArgsAtTopLevel,
} from '../../../../src/lib/dncl/paren-utils'

describe('paren-utils', () => {
  describe('skipString', () => {
    test('skips a simple string', () => {
      // start at opening quote, returns position after closing quote
      expect(skipString('"abc"def', 0, '"')).toBe(5)
    })

    test('handles escaped quotes', () => {
      // \" should not end the string
      expect(skipString('"a\\"b"x', 0, '"')).toBe(6)
    })

    test('returns end position for unterminated string', () => {
      expect(skipString('"unterm', 0, '"')).toBe(7)
    })

    test('works with single quotes', () => {
      expect(skipString("'abc'", 0, "'")).toBe(5)
    })
  })

  describe('findMatchingClose', () => {
    test('finds simple close paren', () => {
      // text[0] is '(', match at index 4
      expect(findMatchingClose('(abc)', 0)).toBe(4)
    })

    test('finds close paren past nested parens', () => {
      // outer '(' at 0, matching ')' at 8
      expect(findMatchingClose('(a(b)c)x', 0)).toBe(6)
    })

    test('handles parens inside strings', () => {
      // The ')' inside "()" is skipped; outer match at end
      expect(findMatchingClose('("a)b")', 0)).toBe(6)
    })

    test('returns -1 for unmatched', () => {
      expect(findMatchingClose('(abc', 0)).toBe(-1)
    })

    test('returns -1 if depth never reaches 0', () => {
      expect(findMatchingClose('((abc)', 0)).toBe(-1)
    })
  })

  describe('replaceCall', () => {
    test('replaces simple call', () => {
      expect(replaceCall('foo(x)', 'foo', (args) => `bar(${args})`)).toBe(
        'bar(x)',
      )
    })

    test('handles nested parens correctly', () => {
      expect(replaceCall('foo(bar(x))', 'foo', (a) => `OUT(${a})`)).toBe(
        'OUT(bar(x))',
      )
    })

    test('handles multiple occurrences left-to-right', () => {
      expect(replaceCall('foo(a) + foo(b)', 'foo', (a) => `X(${a})`)).toBe(
        'X(a) + X(b)',
      )
    })

    test('skips name inside string literal', () => {
      expect(
        replaceCall('"foo(x)" + foo(y)', 'foo', (a) => `Z(${a})`),
      ).toBe('"foo(x)" + Z(y)')
    })

    test('passes args verbatim including nested parens and commas', () => {
      const seen = []
      replaceCall('f(a, g(b, c))', 'f', (args) => {
        seen.push(args)
        return ''
      })
      expect(seen).toEqual(['a, g(b, c)'])
    })

    test('leaves text unchanged if no match', () => {
      expect(replaceCall('hello world', 'foo', () => 'X')).toBe(
        'hello world',
      )
    })

    test('does not match name without following paren', () => {
      expect(replaceCall('foo bar', 'foo', () => 'X')).toBe('foo bar')
    })

    test('handles unmatched open paren by skipping', () => {
      // 'foo(unterminated' should be left as-is
      expect(replaceCall('foo(abc', 'foo', () => 'X')).toBe('foo(abc')
    })

    test('CJK function names work', () => {
      expect(
        replaceCall('表示する(乱数(1..10))', '表示する', (a) => `say(${a}, 1)`),
      ).toBe('say(乱数(1..10), 1)')
    })

    test('recurses into args for same-name nesting', () => {
      // f(f(x)) should fully convert to F(F(x)) in a single call
      expect(replaceCall('f(f(x))', 'f', (a) => `F(${a})`)).toBe('F(F(x))')
    })

    test('handles 3-level same-name nesting', () => {
      expect(
        replaceCall('rand(rand(rand(1..10)))', 'rand', (a) => `R(${a})`),
      ).toBe('R(R(R(1..10)))')
    })

    test('recursion preserves siblings', () => {
      // outer: f(...). args = "x, f(y), z". recurse → "x, F(y), z". transform → "F(x, F(y), z)"
      expect(replaceCall('f(x, f(y), z)', 'f', (a) => `F(${a})`)).toBe(
        'F(x, F(y), z)',
      )
    })
  })

  describe('splitArgsAtTopLevel', () => {
    test('splits single arg', () => {
      expect(splitArgsAtTopLevel('a')).toEqual(['a'])
    })

    test('splits two args', () => {
      expect(splitArgsAtTopLevel('a, b')).toEqual(['a', 'b'])
    })

    test('preserves nested commas inside parens', () => {
      expect(splitArgsAtTopLevel('a, f(b, c), d')).toEqual([
        'a',
        'f(b, c)',
        'd',
      ])
    })

    test('preserves commas inside strings', () => {
      expect(splitArgsAtTopLevel('"a,b", c')).toEqual(['"a,b"', 'c'])
    })

    test('returns empty array for empty input', () => {
      expect(splitArgsAtTopLevel('')).toEqual([])
    })

    test('trims whitespace around args', () => {
      expect(splitArgsAtTopLevel('  a  ,  b  ')).toEqual(['a', 'b'])
    })
  })
})
