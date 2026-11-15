import dedent from 'dedent';
import RubyGenerator from '../../../src/lib/ruby-generator';
import { makeSpriteTarget, makeConverter, setupRubyGenerator } from '../helpers/ruby-roundtrip-helper';

/**
 * Round trip: Ruby → Blocks → apply → Ruby (version 2, class syntax with attr_accessor)
 */
const classRoundTrip = async (converter, target, code, options = {}) => {
    const result = await converter.targetCodeToBlocks(target, code);
    if (!result) {
        throw new Error(
            `Failed to convert Ruby to blocks.\nErrors: ${JSON.stringify(converter.errors)}\nCode:\n${code}`,
        );
    }
    await converter.applyTargetBlocks(target);
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, {
        version: '2',
        ...options,
    }).trim();
};

describe('Ruby Roundtrip: attr_accessor', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        target.sprite = { name: 'Sprite1', costumes: [], sounds: [] };
        runtime.targets = [runtime.getTargetForStage(), target];
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test('attr_accessor with getter and setter', async () => {
        const input = dedent`
            class Sprite1
              attr_accessor :hp

              when_flag_clicked do
                self.hp = 100
                say(hp)
              end
            end
        `;
        const result = await classRoundTrip(converter, target, input);
        expect(result).toBe(input.trim());
    });

    test('attr_reader with getter only', async () => {
        const input = dedent`
            class Sprite1
              attr_reader :name

              when_flag_clicked do
                say(name)
              end
            end
        `;
        const result = await classRoundTrip(converter, target, input);
        expect(result).toBe(input.trim());
    });

    test('attr_accessor with multiple symbols', async () => {
        const input = dedent`
            class Sprite1
              attr_accessor :hp, :name

              when_flag_clicked do
                self.hp = 100
                self.name = "hero"
                say(hp)
              end
            end
        `;
        const result = await classRoundTrip(converter, target, input);
        expect(result).toBe(input.trim());
    });

    test('self.foo getter', async () => {
        const input = dedent`
            class Sprite1
              attr_accessor :hp

              when_flag_clicked do
                self.hp = 50
                say(self.hp)
              end
            end
        `;
        const result = await classRoundTrip(converter, target, input);
        // self.hp reads as @hp, roundtrip outputs as hp (without self)
        const expected = dedent`
            class Sprite1
              attr_accessor :hp

              when_flag_clicked do
                self.hp = 50
                say(hp)
              end
            end
        `;
        expect(result).toBe(expected.trim());
    });

    describe('def initialize sets a variable of attr_accessor (issue #1839)', () => {
        // The generator writes the class body as set_xxx, def initialize, include, attr_*, scripts
        // (as on develop), so these are written in that order.
        test('@hp = 3 in initialize is kept', async () => {
            const input = dedent`
                class Sprite1
                  def initialize
                    @hp = 3
                  end

                  attr_accessor :hp

                  when_flag_clicked do
                    say(hp)
                  end
                end
            `;
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(input.trim());
        });

        test('@hp = 3 is kept when attr_accessor is written before initialize', async () => {
            const input = dedent`
                class Sprite1
                  attr_accessor :hp

                  def initialize
                    @hp = 3
                  end

                  when_flag_clicked do
                    say(hp)
                  end
                end
            `;
            const expected = dedent`
                class Sprite1
                  def initialize
                    @hp = 3
                  end

                  attr_accessor :hp

                  when_flag_clicked do
                    say(hp)
                  end
                end
            `;
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(expected.trim());
        });

        test('only the variables set in initialize are written there', async () => {
            const input = dedent`
                class Sprite1
                  def initialize
                    @hp = 3
                    @name = "hero"
                    @x = 1
                  end

                  attr_accessor :hp, :mp
                  attr_reader :name

                  when_flag_clicked do
                    self.mp = 5
                    say(hp + mp + @x)
                  end
                end
            `;
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(input.trim());
        });

        test.each([
            ['arguments and super', 'def initialize(a)', 'super'],
            ['super with arguments in parentheses', 'def initialize(a, b)', 'super(foo(1))'],
            ['super with nested parentheses and two arguments', 'def initialize(a, b)', 'super(foo(bar(a)), b)'],
        ])('initialize with %s keeps @hp = 3', async (_name, defLine, superLine) => {
            const input = [
                'class Sprite1',
                `  ${defLine}`,
                `    ${superLine}`,
                '    @hp = 3',
                '  end',
                '',
                '  attr_accessor :hp',
                '',
                '  when_flag_clicked do',
                '    say(hp)',
                '  end',
                'end',
            ].join('\n');
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(input);
        });

        test('a variable of attr_accessor named like super is not taken as super', async () => {
            const input = dedent`
                class Sprite1
                  def initialize
                    @superpower = 3
                  end

                  attr_accessor :superpower

                  when_flag_clicked do
                    say(superpower)
                  end
                end
            `;
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(input.trim());
        });
    });

    test('the order of def initialize and include does not change (issue #1839)', async () => {
        const input = dedent`
            module Walk
              def walk
                move(10)
              end
            end

            class Sprite1
              def initialize
                @x = 1
              end

              include Walk

              when_flag_clicked do
                walk
              end
            end
        `;
        const result = await classRoundTrip(converter, target, input);
        expect(result).toBe(input.trim());
    });
});
