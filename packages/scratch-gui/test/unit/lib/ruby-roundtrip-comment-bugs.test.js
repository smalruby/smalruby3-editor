import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';
import RubyGenerator from '../../../src/lib/ruby-generator';
import Variable from '@smalruby/scratch-vm/src/engine/variable';
import Blocks from '@smalruby/scratch-vm/src/engine/blocks';

// Import all block generators
import MathBlocks from '../../../src/lib/ruby-generator/math.js';
import TextBlocks from '../../../src/lib/ruby-generator/text.js';
import ColourBlocks from '../../../src/lib/ruby-generator/colour.js';
import MotionBlocks from '../../../src/lib/ruby-generator/motion.js';
import LooksBlocks from '../../../src/lib/ruby-generator/looks.js';
import SoundBlocks from '../../../src/lib/ruby-generator/sound.js';
import EventBlocks from '../../../src/lib/ruby-generator/event.js';
import ControlBlocks from '../../../src/lib/ruby-generator/control.js';
import SensingBlocks from '../../../src/lib/ruby-generator/sensing.js';
import OperatorsBlocks from '../../../src/lib/ruby-generator/operators.js';
import DataBlocks from '../../../src/lib/ruby-generator/data.js';
import ProcedureBlocks from '../../../src/lib/ruby-generator/procedure.js';
import RubyBlocks from '../../../src/lib/ruby-generator/ruby.js';

describe('Ruby Roundtrip/Comment Bugs (#336)', () => {
    let converter;
    let target;
    let runtime;
    let vm;

    beforeEach(() => {
        runtime = {
            emitProjectChanged: () => {},
            getTargetForStage: () => target
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
                    minimized
                };
            }
        };
        vm = {
            runtime: runtime,
            emitWorkspaceUpdate: () => {},
            extensionManager: {
                isExtensionLoaded: () => true,
                loadExtensionURL: () => Promise.resolve()
            }
        };
        converter = new RubyToBlocksConverter(vm, {version: '2'});
        converter._context.target = target;

        // Reset RubyGenerator state
        RubyGenerator.cache_ = {
            comments: {},
            targetCommentTexts: []
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
        const result = await converter.targetCodeToBlocks(target, code);

        if (!result) {
            throw new Error(`Failed to convert Ruby to blocks. Errors: ${JSON.stringify(converter.errors)}`);
        }

        await converter.applyTargetBlocks(target);

        target.runtime = runtime;
        runtime.targets = [
            {isStage: true, sprite: {name: 'Stage'}},
            target
        ];
        target.sprite = {name: 'Sprite1'};

        RubyGenerator.currentTarget = target;
        const generatedCode = RubyGenerator.targetToCode(target, {version: '2'});

        return generatedCode;
    };

    describe('Bug 3: variable reference corrupted by comment before method call', () => {
        test('comment before greet(name) preserves variable name', async () => {
            const inputCode = [
                'class Sprite1',
                '  def greet(name)',
                '    say(name)',
                '  end',
                '',
                '  when_flag_clicked do',
                '    ask("name?")',
                '    name = answer',
                '    # call greet',
                '    greet(name)',
                '  end',
                'end',
                ''
            ].join('\n');

            const outputCode = await rubyToBlocksToRuby(inputCode);

            // Variable name should be preserved, not become @_name_1_
            expect(outputCode).toContain('greet(name)');
            expect(outputCode).not.toContain('@_name_1_');
            expect(outputCode).toContain('# call greet');
        });
    });

    describe('Bug 2: def comment position', () => {
        test('comment before def inside class is placed before method definition', async () => {
            const inputCode = [
                'class Sprite1',
                '  # method description',
                '  def greet',
                '    say("hello")',
                '  end',
                '',
                '  when_flag_clicked do',
                '    greet',
                '  end',
                'end',
                ''
            ].join('\n');

            const outputCode = await rubyToBlocksToRuby(inputCode);

            // Comment should be directly before def, not outside class
            expect(outputCode).toContain('# method description');
            expect(outputCode).toContain('def greet');

            // Comment should be inside the class, before the def
            const classStart = outputCode.indexOf('class Sprite1');
            const commentPos = outputCode.indexOf('# method description');
            const defPos = outputCode.indexOf('def greet');
            expect(commentPos).toBeGreaterThan(classStart);
            expect(commentPos).toBeLessThan(defPos);
        });
    });

    describe('Bug 1: module comment position', () => {
        test('comment before module is placed before module definition', async () => {
            const inputCode = [
                '# module description',
                'module Greeter',
                '  def greet(name)',
                '    say(name)',
                '  end',
                'end',
                '',
                'class Sprite1',
                '  include Greeter',
                '',
                '  when_flag_clicked do',
                '    greet("hello")',
                '  end',
                'end',
                ''
            ].join('\n');

            const outputCode = await rubyToBlocksToRuby(inputCode);

            // Comment should be before module, not between module and class
            expect(outputCode).toContain('# module description');
            expect(outputCode).toContain('module Greeter');

            const commentPos = outputCode.indexOf('# module description');
            const modulePos = outputCode.indexOf('module Greeter');
            const classPos = outputCode.indexOf('class Sprite1');

            // Comment must appear before module, not after
            expect(commentPos).toBeLessThan(modulePos);
            expect(modulePos).toBeLessThan(classPos);
        });
    });
});
