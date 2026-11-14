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
        test('@hp = 3 in initialize is kept', async () => {
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
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(input.trim());
        });

        test('only the variables set in initialize are written there', async () => {
            const input = dedent`
                class Sprite1
                  attr_accessor :hp, :mp
                  attr_reader :name

                  def initialize
                    @hp = 3
                    @name = "hero"
                    @x = 1
                  end

                  when_flag_clicked do
                    self.mp = 5
                    say(hp + mp + @x)
                  end
                end
            `;
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(input.trim());
        });

        test('initialize with arguments and super keeps @hp = 3', async () => {
            const input = dedent`
                class Sprite1
                  attr_accessor :hp

                  def initialize(a)
                    super
                    @hp = 3
                  end

                  when_flag_clicked do
                    say(hp)
                  end
                end
            `;
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(input.trim());
        });

        test('a variable of attr_accessor named like super is not taken as super', async () => {
            const input = dedent`
                class Sprite1
                  attr_accessor :superpower

                  def initialize
                    @superpower = 3
                  end

                  when_flag_clicked do
                    say(superpower)
                  end
                end
            `;
            const result = await classRoundTrip(converter, target, input);
            expect(result).toBe(input.trim());
        });
    });
});
