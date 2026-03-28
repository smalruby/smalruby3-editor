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

    const rubyToBlocksToRuby = async code => {
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
