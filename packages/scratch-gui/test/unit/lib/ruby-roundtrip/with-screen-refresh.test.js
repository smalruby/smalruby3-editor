/**
 * `with_screen_refresh do ... end` (issue #1633).
 *
 * The blocks have it only as the sole statement of the body of `until` / `while` (a mark on the
 * "repeat until" block). Anywhere else it is an error that names the line, not silently dropped,
 * and it must not move to a later, unrelated loop.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: with_screen_refresh do ... end (issue #1633)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: 2 });
    });

    describe('as the sole statement of the body of a loop', () => {
        test('until', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  until x > 1
                    with_screen_refresh do
                      move(2)
                      turn_right(15)
                    end
                  end
                end
            `,
            );
        });

        test('while', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  while x < 1
                    with_screen_refresh do
                      move(2)
                    end
                  end
                end
            `,
            );
        });

        test('in a method', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                def f
                  until x > 1
                    with_screen_refresh do
                      move(2)
                    end
                  end
                end
            `,
            );
        });

        test('nested loops keep each their own', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  until x > 1
                    with_screen_refresh do
                      until y > 1
                        move(1)
                      end
                    end
                  end
                  until y > 2
                    with_screen_refresh do
                      move(2)
                    end
                  end
                  until x > 3
                    move(3)
                  end
                end
            `,
            );
        });

        test('an inner loop does not take the mark of the outer loop', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  until x > 1
                    with_screen_refresh do
                      move(1)
                    end
                  end
                  until y > 1
                    until x > 2
                      move(2)
                    end
                  end
                end
            `,
            );
        });
        test('self.with_screen_refresh', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  until x > 1
                    self.with_screen_refresh do
                      move(2)
                    end
                  end
                end
            `,
                dedent`
                when_flag_clicked do
                  until x > 1
                    with_screen_refresh do
                      move(2)
                    end
                  end
                end
            `,
            );
        });

        test('begin ... end while', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  begin
                    with_screen_refresh do
                      move(2)
                    end
                  end while x < 1
                end
            `,
            );
        });
    });

    describe('anywhere else is an error that names the line', () => {
        const expectError = async (code, row) => {
            await expect(rubyToBlocksToRuby(converter, target, code)).rejects.toThrow(
                new RegExp(`"row":${row}[^}]*can only be the only command`),
            );
        };

        test('in when_flag_clicked', async () => {
            await expectError(
                dedent`
                when_flag_clicked do
                  with_screen_refresh do
                    3.times do |i|
                      say(i)
                    end
                    say(2)
                  end
                end
            `,
                1,
            );
        });

        test('in a method', async () => {
            await expectError(
                dedent`
                def f
                  move(1)
                  with_screen_refresh do
                    move(2)
                  end
                end
            `,
                2,
            );
        });

        test('at the top level', async () => {
            await expectError(
                dedent`
                with_screen_refresh do
                  move(2)
                end
            `,
                0,
            );
        });

        test('in the body of a loop with other statements', async () => {
            await expectError(
                dedent`
                when_flag_clicked do
                  until x > 1
                    move(1)
                    with_screen_refresh do
                      move(2)
                    end
                  end
                end
            `,
                3,
            );
        });

        test('in the body of a times loop', async () => {
            await expectError(
                dedent`
                when_flag_clicked do
                  3.times do
                    with_screen_refresh do
                      move(2)
                    end
                  end
                end
            `,
                2,
            );
        });

        test('in the body of an if', async () => {
            await expectError(
                dedent`
                when_flag_clicked do
                  if x > 1
                    with_screen_refresh do
                      move(2)
                    end
                  end
                end
            `,
                2,
            );
        });

        test('inside the with_screen_refresh of a loop', async () => {
            await expectError(
                dedent`
                when_flag_clicked do
                  until x > 1
                    with_screen_refresh do
                      with_screen_refresh do
                        move(2)
                      end
                    end
                  end
                end
            `,
                3,
            );
        });

        test('does not move to a later, unrelated loop', async () => {
            await expectError(
                dedent`
                when_flag_clicked do
                  with_screen_refresh do
                    move(1)
                  end
                  until x > 1
                    move(2)
                  end
                end
            `,
                1,
            );
        });
    });

    test('a failed conversion does not leave the mark for the next one', async () => {
        await expect(
            rubyToBlocksToRuby(
                converter,
                target,
                dedent`
                with_screen_refresh do
                  move(1)
                end
            `,
            ),
        ).rejects.toThrow();
        setupRubyGenerator();
        await expectRoundTrip(
            converter,
            target,
            dedent`
            until x > 1
              move(2)
            end
        `,
        );
    });
});
