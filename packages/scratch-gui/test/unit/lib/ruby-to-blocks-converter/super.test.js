import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Super', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('error cases', () => {
        test('super in v1 throws error', async () => {
            const converterV1 = new RubyToBlocksConverter(null, {version: '1'});
            const code = `
                module Mod
                  def func(a, b)
                    a + b
                  end
                end

                class Sprite1
                  include Mod

                  def func(a)
                    super(a, a)
                  end
                end
            `;
            const result = await converterV1.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converterV1.errors.length).toBeGreaterThan(0);
        });

        test('super in stage class throws error', async () => {
            const stageTarget = {
                isStage: true,
                variables: {},
                sprite: {}
            };
            const code = `
                module Mod
                  def func(a)
                    say(a)
                  end
                end

                class Stage
                  include Mod

                  def func(a)
                    super(a)
                  end
                end
            `;
            // Stage doesn't support include, so it should error at include level
            const result = await converter.targetCodeToBlocks(stageTarget, code);
            expect(result).toBeFalsy();
            expect(converter.errors.length).toBeGreaterThan(0);
        });

        test('super outside method throws error', async () => {
            const code = `
                module Mod
                  def func(a)
                    say(a)
                  end
                end

                class Sprite1
                  include Mod
                  super(1)
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/super/i);
        });

        test('super without module include throws error', async () => {
            const code = `
                class Sprite1
                  def func(a)
                    super(a)
                  end
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/super/i);
        });

        test('super when no same-named method in module throws error', async () => {
            const code = `
                module Mod
                  def helper(a)
                    say(a)
                  end
                end

                class Sprite1
                  include Mod

                  def func(a)
                    super(a)
                  end
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/super/i);
        });

        test('forwarding super (no args) in v1 throws error', async () => {
            const converterV1 = new RubyToBlocksConverter(null, {version: '1'});
            const code = `
                module Mod
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
            const result = await converterV1.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converterV1.errors.length).toBeGreaterThan(0);
        });

        test('forwarding super outside method throws error', async () => {
            const code = `
                module Mod
                  def func(a)
                    say(a)
                  end
                end

                class Sprite1
                  include Mod
                  super
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/super/i);
        });

        test('forwarding super without same-named method in module throws error', async () => {
            const code = `
                module Mod
                  def helper(a)
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
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors.length).toBeGreaterThan(0);
            expect(converter.errors[0].text).toMatch(/super/i);
        });
    });

    describe('basic super conversion', () => {
        test('super(args) converts module method to renamed procedure and creates super call', async () => {
            const code = `
                module Mod
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
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = converter._context.blocks;

            // Check that there are two procedures_definition blocks
            const procDefs = Object.values(blocks).filter(b => b.opcode === 'procedures_definition');
            expect(procDefs).toHaveLength(2);

            // Find the module method (renamed) and class method
            const moduleProc = procDefs.find(b => {
                const comment = converter._context.comments[b.comment];
                return comment && comment.text.includes('module_source');
            });
            const classProc = procDefs.find(b => b !== moduleProc);

            expect(moduleProc).toBeTruthy();
            expect(classProc).toBeTruthy();

            // Module method should be renamed to _super_func_1_
            const modulePrototype = blocks[moduleProc.inputs.custom_block.block];
            expect(modulePrototype.mutation.proccode).toMatch(/^_super_func_1_ /);

            // Module method comment should include super_of:func
            const moduleComment = converter._context.comments[moduleProc.comment];
            expect(moduleComment.text).toEqual('@ruby:module_source:Mod:super_of:func');

            // Class method should keep the name 'func'
            const classPrototype = blocks[classProc.inputs.custom_block.block];
            expect(classPrototype.mutation.proccode).toMatch(/^func /);

            // Check that super call exists as procedures_call to _super_func_1_
            const superCalls = Object.values(blocks).filter(b => {
                if (b.opcode !== 'procedures_call') return false;
                const comment = b.comment && converter._context.comments[b.comment];
                return comment && comment.text === '@ruby:super';
            });
            expect(superCalls).toHaveLength(1);
            expect(superCalls[0].mutation.proccode).toMatch(/^_super_func_1_ /);
        });

        test('forwarding super converts to procedures_call with forwarded args', async () => {
            const code = `
                module Mod
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
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = converter._context.blocks;

            // Check that super call exists with forwarding comment
            const superCalls = Object.values(blocks).filter(b => {
                if (b.opcode !== 'procedures_call') return false;
                const comment = b.comment && converter._context.comments[b.comment];
                return comment && comment.text === '@ruby:super:forwarding';
            });
            expect(superCalls).toHaveLength(1);
            expect(superCalls[0].mutation.proccode).toMatch(/^_super_func_1_ /);
        });

        test('class method func(5) calls the class method, not the module method', async () => {
            const code = `
                module Mod
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
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = converter._context.blocks;

            // Find all procedures_call blocks that are NOT super calls
            const regularCalls = Object.values(blocks).filter(b => {
                if (b.opcode !== 'procedures_call') return false;
                const comment = b.comment && converter._context.comments[b.comment];
                return !comment || !comment.text.startsWith('@ruby:super');
            });

            // The func(5) call should reference the class method 'func', not '_super_func_1_'
            const funcCall = regularCalls.find(b => b.mutation.proccode.startsWith('func '));
            expect(funcCall).toBeTruthy();
        });
    });
});
