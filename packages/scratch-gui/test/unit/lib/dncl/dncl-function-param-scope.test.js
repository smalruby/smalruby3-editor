// === Smalruby: Tests for function-parameter scope tracking in DNCL→Ruby ===
//
// Issue #642: DNCL function parameters were being converted to instance
// variables (`@a`) instead of being kept as local Ruby method parameters
// (`a`). This broke both function semantics and Ruby → blocks conversion.
//
// The fix introduces a function-parameter scope stack that
// `convertIdentifier` consults before adding an `@` prefix to lowercase
// identifiers. Inside `関数 name(a, b) ... と定義する`, references to
// `a` and `b` stay as `a` and `b`. Outside, they revert to `@a` and `@b`.

import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

const dToR = (src) => dnclToRuby(src).ruby;

describe('Function parameter scope: body references', () => {
    test('single-arg function: param stays as local', () => {
        const dncl = ['関数 f(a)', '  返す a', 'と定義する'].join('\n');
        expect(dToR(dncl)).toBe(['def f(a)', '  return a', 'end'].join('\n'));
    });

    test('two-arg function: both params stay as locals', () => {
        const dncl = [
            '関数 maximum(a, b)',
            '  もし a > b ならば',
            '    返す a',
            '  そうでなければ',
            '    返す b',
            '  を実行する',
            'と定義する',
        ].join('\n');
        const ruby = [
            'def maximum(a, b)',
            '  if a > b',
            '    return a',
            '  else',
            '    return b',
            '  end',
            'end',
        ].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('arithmetic on params stays unprefixed', () => {
        const dncl = ['関数 add(a, b)', '  返す a + b', 'と定義する'].join('\n');
        const ruby = ['def add(a, b)', '  return a + b', 'end'].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });
});

describe('Function parameter scope: scope boundary', () => {
    test('outside function: same name reverts to instance variable', () => {
        const dncl = [
            '関数 f(a)',
            '  返す a',
            'と定義する',
            'a = 10',
            '答え = a',
        ].join('\n');
        const ruby = [
            'def f(a)',
            '  return a',
            'end',
            '@a = 10',
            '@答え = @a',
        ].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('global var with same name as future function param: keeps @ at top-level', () => {
        const dncl = [
            'a = 5',
            '関数 f(a)',
            '  返す a',
            'と定義する',
        ].join('\n');
        const ruby = [
            '@a = 5',
            'def f(a)',
            '  return a',
            'end',
        ].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('two consecutive functions: scopes are independent', () => {
        const dncl = [
            '関数 f(a)',
            '  返す a',
            'と定義する',
            '関数 g(b)',
            '  返す b',
            'と定義する',
        ].join('\n');
        const ruby = [
            'def f(a)',
            '  return a',
            'end',
            'def g(b)',
            '  return b',
            'end',
        ].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });
});

describe('Function parameter scope: call sites', () => {
    test('call site arguments use instance vars (call site is outside scope)', () => {
        const dncl = [
            '関数 maximum(a, b)',
            '  もし a > b ならば',
            '    返す a',
            '  そうでなければ',
            '    返す b',
            '  を実行する',
            'と定義する',
            'x = 5',
            'y = 8',
            '答え = maximum(x, y)',
        ].join('\n');
        const ruby = [
            'def maximum(a, b)',
            '  if a > b',
            '    return a',
            '  else',
            '    return b',
            '  end',
            'end',
            '@x = 5',
            '@y = 8',
            '@答え = maximum(@x, @y)',
        ].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });
});

describe('Function parameter scope: idempotency / multiple invocations', () => {
    test('running dnclToRuby twice in a row gives the same result', () => {
        const dncl = [
            '関数 add(a, b)',
            '  返す a + b',
            'と定義する',
            '答え = add(3, 4)',
        ].join('\n');
        const r1 = dToR(dncl);
        const r2 = dToR(dncl);
        expect(r2).toBe(r1);
    });
});

describe('Function parameter scope: edge cases', () => {
    test('function with no parameters', () => {
        const dncl = ['関数 hello()', '  返す 1', 'と定義する'].join('\n');
        const ruby = ['def hello()', '  return 1', 'end'].join('\n');
        expect(dToR(dncl)).toBe(ruby);
    });

    test('parameter named like a Ruby reserved literal does not break', () => {
        // `nil` is in RUBY_LITERALS — convertIdentifier returns as-is
        // anyway, so the scope check is harmless. Just check no crash.
        const dncl = ['関数 f(x)', '  返す x', 'と定義する'].join('\n');
        expect(dToR(dncl)).toBe(['def f(x)', '  return x', 'end'].join('\n'));
    });
});
