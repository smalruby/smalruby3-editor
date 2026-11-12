import Blocks from '@smalruby/scratch-vm/src/engine/blocks';
import Variable from '@smalruby/scratch-vm/src/engine/variable';
import RubyGenerator from '../../../src/lib/ruby-generator';
import ColourBlocks from '../../../src/lib/ruby-generator/colour.js';
import ControlBlocks from '../../../src/lib/ruby-generator/control.js';
import DataBlocks from '../../../src/lib/ruby-generator/data.js';
import EventBlocks from '../../../src/lib/ruby-generator/event.js';
import LooksBlocks from '../../../src/lib/ruby-generator/looks.js';
// Import all block generators
import MathBlocks from '../../../src/lib/ruby-generator/math.js';
import MotionBlocks from '../../../src/lib/ruby-generator/motion.js';
import OperatorsBlocks from '../../../src/lib/ruby-generator/operators.js';
import ProcedureBlocks from '../../../src/lib/ruby-generator/procedure.js';
import RubyBlocks from '../../../src/lib/ruby-generator/ruby.js';
import SensingBlocks from '../../../src/lib/ruby-generator/sensing.js';
import SoundBlocks from '../../../src/lib/ruby-generator/sound.js';
import TextBlocks from '../../../src/lib/ruby-generator/text.js';
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

describe('Ruby Roundtrip/Super', () => {
    let converter;
    let target;
    let runtime;
    let vm;

    beforeEach(() => {
        runtime = {
            emitProjectChanged: () => {},
            getTargetForStage: () => target,
        };
        target = {
            blocks: new Blocks(runtime),
            variables: {},
            lists: {},
            broadcastMsgs: {},
            comments: {},
            isStage: false,
            id: 'sprite1',
            createVariable: function (id, name, type) {
                this.variables[id] = new Variable(id, name, type);
            },
            lookupVariableByNameAndType: function (name, type) {
                for (const varId in this.variables) {
                    const currVar = this.variables[varId];
                    if (currVar.name === name && currVar.type === type) {
                        return currVar;
                    }
                }
                return null;
            },
            createComment: function (id, blockId, text, x, y, width, height, minimized) {
                this.comments[id] = {
                    id,
                    blockId,
                    text,
                    x,
                    y,
                    width,
                    height,
                    minimized,
                };
            },
        };
        vm = {
            runtime: runtime,
            emitWorkspaceUpdate: () => {},
        };
        converter = new RubyToBlocksConverter(vm, { version: '2' });
        converter._context.target = target;

        // Reset RubyGenerator state
        RubyGenerator.cache_ = {
            comments: {},
            targetCommentTexts: [],
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};

        // Register all block generators
        MathBlocks(RubyGenerator);
        TextBlocks(RubyGenerator);
        ColourBlocks(RubyGenerator);
        MotionBlocks(RubyGenerator);
        LooksBlocks(RubyGenerator);
        SoundBlocks(RubyGenerator);
        EventBlocks(RubyGenerator);
        ControlBlocks(RubyGenerator);
        SensingBlocks(RubyGenerator);
        OperatorsBlocks(RubyGenerator);
        DataBlocks(RubyGenerator);
        ProcedureBlocks(RubyGenerator);
        RubyBlocks(RubyGenerator);
    });

    const rubyToBlocksToRuby = async (code) => {
        // Ruby -> Blocks
        const result = await converter.targetCodeToBlocks(target, code);

        if (!result) {
            throw new Error(`Failed to convert Ruby to blocks. Errors: ${JSON.stringify(converter.errors)}`);
        }

        // Apply the blocks to the target (async operation)
        await converter.applyTargetBlocks(target);

        // Set up runtime.targets for class wrapping
        target.runtime = runtime;
        runtime.targets = [{ isStage: true, sprite: { name: 'Stage' } }, target];
        target.sprite = { name: 'Sprite1' };

        // Blocks -> Ruby (version 2)
        RubyGenerator.currentTarget = target;
        const generatedCode = RubyGenerator.targetToCode(target, { version: '2' });

        return generatedCode;
    };

    // Blank lines are left out of the comparison: the generator puts its own between methods.
    const withoutBlankLines = (code) => code.replace(/\n\s*\n/g, '\n').trim();

    const moduleReturningA = `module Mod
  def func(a)
    return a
  end
end
`;

    const expectRoundTrip = async (inputCode) => {
        const outputCode = await rubyToBlocksToRuby(inputCode);
        expect(withoutBlankLines(outputCode)).toEqual(withoutBlankLines(inputCode));
    };

    const errorsOf = async (code) => {
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBeFalsy();
        return converter.errors;
    };

    describe('super as a value (issue #1568)', () => {
        test('return super comes back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    return super
  end

  when_flag_clicked do
    say(func(5))
  end
end
`);
        });

        test('return super + 1 comes back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    return super + 1
  end

  when_flag_clicked do
    say(func(5))
  end
end
`);
        });

        test('return super(a) comes back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    return super(a)
  end
end
`);
        });

        test('return super(a) * 2 comes back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    return super(a) * 2
  end
end
`);
        });

        test('super + 1 on the last line comes back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    super + 1
  end
end
`);
        });

        test('x = super and return x come back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    x = super
    return x
  end
end
`);
        });

        test('return super in if comes back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    if a > 0
      return super
    end
    return 0
  end
end
`);
        });

        test('super(a) as an argument of a command comes back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    say(super(a))
  end
end
`);
        });

        test('return super in a class with a superclass and an included module comes back', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1 < ::Smalruby3::Sprite
  include Mod

  def func(a)
    return super + 1
  end
end
`);
        });

        test('bare super on the last line still comes back as written', async () => {
            await expectRoundTrip(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    super
  end
end
`);
        });

        test('return super becomes the call block and then the return of its value', async () => {
            const code = `${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    return super + 1
  end
end
`;
            expect(await converter.targetCodeToBlocks(target, code)).toBeTruthy();
            const blocks = Object.values(converter._context.blocks);
            const commentOf = (b) => (b.comment ? converter._context.comments[b.comment].text : '');
            const superCall = blocks.find(
                (b) => b.opcode === 'procedures_call' && commentOf(b).startsWith('@ruby:super'),
            );
            expect(superCall).toBeDefined();
            const next = converter._context.blocks[superCall.next];
            expect(next.opcode).toEqual('data_setvariableto');
            expect(commentOf(next)).toContain('@ruby:syntax:return');
            const operator = converter._context.blocks[next.inputs.VALUE.block];
            expect(operator.opcode).toEqual('operator_add');
            const value = converter._context.blocks[operator.inputs.NUM1.block];
            expect(value.opcode).toEqual('data_variable');
            expect(value.fields.VARIABLE.value).toContain('_return__super_func_1_');
        });
    });

    describe('a call of a method that returns a value, where super is now used too (issue #1568)', () => {
        const barReturningA = `class Sprite1
  def bar(a)
    return a
  end
`;

        test('x = bar(a) and return x come back as written', async () => {
            await expectRoundTrip(`${barReturningA}
  def func(a)
    x = bar(a)
    return x
  end
end
`);
        });

        test('bar(a) + 1 on the last line comes back as written', async () => {
            await expectRoundTrip(`${barReturningA}
  def func(a)
    bar(a) + 1
  end
end
`);
        });

        test('x = bar(1) + bar(2) keeps both return values', async () => {
            await expectRoundTrip(`${barReturningA}
  def func(a)
    x = bar(1) + bar(2)
    return x
  end
end
`);
        });

        test('bar(1) + bar(2) on the last line keeps both return values', async () => {
            await expectRoundTrip(`${barReturningA}
  def func(a)
    bar(1) + bar(2)
  end
end
`);
        });
    });

    describe('super that cannot be a value (issue #1568)', () => {
        test('return super of a method that returns nothing tells which method to change', async () => {
            const errors = await errorsOf(`module Mod
  def func(a)
    say(a)
  end
end

class Sprite1
  include Mod

  def func(a)
    return super
  end
end
`);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toEqual(10);
            expect(errors[0].text).toContain('"func" of Mod does not return a value');
            expect(errors[0].text).not.toContain('cannot be returned from a method');
        });

        test('super twice in a line tells to save it in a variable', async () => {
            const errors = await errorsOf(`${moduleReturningA}
class Sprite1
  include Mod

  def func(a)
    return super + super
  end
end
`);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toEqual(10);
            expect(errors[0].text).toContain('x = super');
        });
    });

    describe('super(args) round-trip', () => {
        test('super(a, a) is preserved in round-trip', async () => {
            const inputCode = `module Mod
  def func(a, b)
    a + b
  end
end

class Sprite1
  include Mod

  def func(a)
    super(a, a)
  end

  when_flag_clicked do
    move(func(5))
  end
end
`;
            const outputCode = await rubyToBlocksToRuby(inputCode);

            // Module should be regenerated
            expect(outputCode).toContain('module Mod');
            expect(outputCode).toContain('def func(a, b)');
            expect(outputCode).toContain('a + b');

            // Class should contain include and method
            expect(outputCode).toContain('include Mod');
            expect(outputCode).toContain('def func(a)');
            expect(outputCode).toContain('super(a, a)');

            // func(5) call should be preserved
            expect(outputCode).toContain('func(5)');
        });
    });

    describe('forwarding super round-trip', () => {
        test('bare super is preserved in round-trip', async () => {
            const inputCode = `module Mod
  def func(a)
    say(a)
  end
end

class Sprite1
  include Mod

  def func(a)
    super
  end
end
`;
            const outputCode = await rubyToBlocksToRuby(inputCode);

            expect(outputCode).toContain('module Mod');
            expect(outputCode).toContain('def func(a)');
            expect(outputCode).toContain('super');
            // Should be bare super, not super(a)
            expect(outputCode).not.toMatch(/super\(/);
        });
    });
});
