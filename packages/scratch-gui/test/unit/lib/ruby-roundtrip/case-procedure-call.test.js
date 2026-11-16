// === Smalruby: This file is Smalruby-specific (method calls with a return value inside case, issue #2014) ===
/**
 * Two calls of a method that returns a value in one line inside `case` (`say(foo(1) + foo(2))`).
 * The pre-pass that counts the calls did not look inside `when` and `else`, so no variable saved the
 * value of the first call: the line came back as `say(foo(2) + @_return_foo_)` (issue #2014).
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

const FOO = dedent`
    def self.foo(a)
      return a * 2
    end
`;

describe('Ruby Roundtrip: two calls of a method with a return value inside case (issue #2014)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    const roundTrip = (code) => expectRoundTrip(converter, target, `${FOO}\n\n${code}`);

    test('in when', async () => {
        await roundTrip(dedent`
            self.when(:flag_clicked) do
              case @x
              when 1
                say(foo(1) + foo(2))
              end
            end
        `);
    });

    test('in else', async () => {
        await roundTrip(dedent`
            self.when(:flag_clicked) do
              case @x
              when 1
                say("one")
              else
                say(foo(1) + foo(2))
              end
            end
        `);
    });

    test('in a later when', async () => {
        await roundTrip(dedent`
            self.when(:flag_clicked) do
              case @x
              when 1
                say("one")
              when 2
                say(foo(1) + foo(2))
              end
            end
        `);
    });

    test('in an if inside when', async () => {
        await roundTrip(dedent`
            self.when(:flag_clicked) do
              case @x
              when 1
                if @y == 1
                  say(foo(1) + foo(2))
                end
              end
            end
        `);
    });
});
