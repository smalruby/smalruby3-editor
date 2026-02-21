import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import Variable from '@smalruby/scratch-vm/src/engine/variable';
import Blocks from '@smalruby/scratch-vm/src/engine/blocks';

describe('RubyToBlocksConverter/Method Return', () => {
    let converter;
    let target;

    beforeEach(() => {
        const runtime = {
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
                    id: id,
                    blockId: blockId,
                    text: text,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    minimized: minimized
                };
            }
        };
        const vm = {
            runtime: runtime,
            emitWorkspaceUpdate: () => {},
            extensionManager: {
                isExtensionLoaded: () => true,
                loadExtensionURL: () => Promise.resolve()
            }
        };
        converter = new RubyToBlocksConverter(vm);
        converter._context.target = target;
    });

    describe('Phase 1b: Ruby -> Block return value (call sites)', () => {
        test('should NOT add @ruby:return comment to procedures_call when NOT used as a value', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  add(1, 5)
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Find the procedures_call block
            const proceduresCall = Object.values(converter.blocks).find(b => b.opcode === 'procedures_call');
            expect(proceduresCall).toBeDefined();
            expect(proceduresCall.comment).toBeUndefined();
        });

        test('should add @ruby:return comment to procedures_call when used as a value', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  say(add(1, 5))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Find the procedures_call block
            const proceduresCall = Object.values(converter.blocks).find(b => b.opcode === 'procedures_call');
            expect(proceduresCall).toBeDefined();
            expect(proceduresCall.comment).toBeDefined();
            const comment = converter._context.comments[proceduresCall.comment];
            expect(comment.text).toBe('@ruby:return:add');
        });

        test('top-level method call with return value should create procedures_call + data_variable', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                say(add(1, 5))
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Should have a procedures_call block with @ruby:return comment
            const proceduresCall = Object.values(converter.blocks).find(b => b.opcode === 'procedures_call');
            expect(proceduresCall).toBeDefined();
            expect(proceduresCall.comment).toBeDefined();
            const callComment = converter._context.comments[proceduresCall.comment];
            expect(callComment.text).toBe('@ruby:return:add');

            // The value input of say should be a data_variable block with @ruby:return:add comment
            const sayBlock = Object.values(converter.blocks).find(b => b.opcode === 'looks_say');
            expect(sayBlock).toBeDefined();
            const valueBlockId = sayBlock.inputs.MESSAGE.block;
            const valueBlock = converter.blocks[valueBlockId];
            expect(valueBlock.opcode).toBe('data_variable');
            expect(valueBlock.comment).toBeDefined();
            const varComment = converter._context.comments[valueBlock.comment];
            expect(varComment.text).toBe('@ruby:return:add');

            // procedures_call should come before say in the block chain
            expect(proceduresCall.next).toBe(sayBlock.id);
            expect(sayBlock.parent).toBe(proceduresCall.id);
        });

        test('nested method call with return value: say(add(add(1, 5), 3))', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  say(add(add(1, 5), 3))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            const blocks = converter.blocks;

            // Verify the chain: hat -> add(1, 5) -> evacuation -> add(?, 3) -> say(?)
            const hatBlock = Object.values(blocks).find(b => b.opcode === 'event_whenflagclicked');
            const firstCallId = hatBlock.next;
            const firstCall = blocks[firstCallId];
            expect(firstCall.opcode).toBe('procedures_call');
            expect(firstCall.mutation.proccode).toBe('add %s %s');

            const evacuationId = firstCall.next;
            const evacuation = blocks[evacuationId];
            expect(evacuation.opcode).toBe('data_setvariableto');
            expect(evacuation.fields.VARIABLE.value).toBe('_return_add_1_');

            const secondCallId = evacuation.next;
            const secondCall = blocks[secondCallId];
            expect(secondCall.opcode).toBe('procedures_call');
            expect(secondCall.mutation.proccode).toBe('add %s %s');

            const thirdCallId = secondCall.next;
            const thirdCall = blocks[thirdCallId];
            expect(thirdCall.opcode).toBe('looks_say');

            // Check arguments
            const arg1Id = Object.values(secondCall.inputs)[0].block;
            expect(blocks[arg1Id].fields.VARIABLE.value).toBe('_return_add_1_');
            expect(thirdCall.inputs.MESSAGE.block).toBeDefined();
            expect(blocks[thirdCall.inputs.MESSAGE.block].fields.VARIABLE.value).toBe('_return_add_');

            // Verify Blocks -> Ruby
            await converter.applyTargetBlocks(target);
            const RubyGenerator = require('../../../../../src/lib/ruby-generator').default;
            const generatedRuby = RubyGenerator.targetToCode(target);
            expect(generatedRuby).toMatch(/say\(add\(add\(1, 5\), 3\)\)/);
        });

        test('3-level nested method call with return value: say(add(add(add(1, 2), 3), 4))', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  say(add(add(add(1, 2), 3), 4))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Verify Blocks -> Ruby
            await converter.applyTargetBlocks(target);
            const RubyGenerator = require('../../../../../src/lib/ruby-generator').default;
            const generatedRuby = RubyGenerator.targetToCode(target);
            expect(generatedRuby).toMatch(/say\(add\(add\(add\(1, 2\), 3\), 4\)\)/);
        });

        test('multiple calls at same level: say(add(add(1, 5), add(2, 3)))', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  say(add(add(1, 5), add(2, 3)))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Verify Blocks -> Ruby
            await converter.applyTargetBlocks(target);
            const RubyGenerator = require('../../../../../src/lib/ruby-generator').default;
            const generatedRuby = RubyGenerator.targetToCode(target);

            expect(generatedRuby).toMatch(/say\(add\(add\(1, 5\), add\(2, 3\)\)\)/);
        });

        test('complex nested calls: say(add(add(add(1, 2), 3), add(4, 5)))', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  say(add(add(add(1, 2), 3), add(4, 5)))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Verify Blocks -> Ruby
            await converter.applyTargetBlocks(target);
            const RubyGenerator = require('../../../../../src/lib/ruby-generator').default;
            const generatedRuby = RubyGenerator.targetToCode(target);

            expect(generatedRuby).toMatch(/say\(add\(add\(add\(1, 2\), 3\), add\(4, 5\)\)\)/);
        });

        test('very complex nested calls: say(add(add(add(1, 2), add(3, 4)), add(5, 6)))', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  say(add(add(add(1, 2), add(3, 4)), add(5, 6)))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Verify Blocks -> Ruby
            await converter.applyTargetBlocks(target);
            const RubyGenerator = require('../../../../../src/lib/ruby-generator').default;
            const generatedRuby = RubyGenerator.targetToCode(target);

            expect(generatedRuby).toMatch(/say\(add\(add\(add\(1, 2\), add\(3, 4\)\), add\(5, 6\)\)\)/);
        });

        test('mixed method names: say(add(calculate(1), 2))', async () => {
            const code = `
                def add(a, b)
                  a + b
                end
                def calculate(x)
                  x * 2
                end

                when_flag_clicked do
                  say(add(calculate(1), 2))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Verify Blocks -> Ruby
            await converter.applyTargetBlocks(target);
            const RubyGenerator = require('../../../../../src/lib/ruby-generator').default;
            const generatedRuby = RubyGenerator.targetToCode(target);

            expect(generatedRuby).toMatch(/say\(add\(calculate\(1\), 2\)\)/);
        });

        test('evacuation blocks for multiple calls at same level: say(add(add(2, 5), add(4, 6)))', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  say(add(add(2, 5), add(4, 6)))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            const blocks = converter.blocks;

            // Find blocks by comment to verify their presence and order
            const firstCall = Object.values(blocks).find(b =>
                b.opcode === 'procedures_call' &&
                b.comment && converter._context.comments[b.comment].text === '@ruby:return:add:1'
            );
            expect(firstCall).toBeDefined();

            const firstEvacuation = blocks[firstCall.next];
            expect(firstEvacuation.opcode).toBe('data_setvariableto');
            expect(firstEvacuation.fields.VARIABLE.value).toBe('_return_add_1_');
            expect(converter._context.comments[firstEvacuation.comment].text).toBe('@ruby:return:add:1');

            const secondCall = blocks[firstEvacuation.next];
            expect(secondCall.opcode).toBe('procedures_call');
            expect(converter._context.comments[secondCall.comment].text).toBe('@ruby:return:add:2');

            const secondEvacuation = blocks[secondCall.next];
            expect(secondEvacuation.opcode).toBe('data_setvariableto');
            expect(secondEvacuation.fields.VARIABLE.value).toBe('_return_add_2_');
            expect(converter._context.comments[secondEvacuation.comment].text).toBe('@ruby:return:add:2');

            const topCall = blocks[secondEvacuation.next];
            expect(topCall.opcode).toBe('procedures_call');
            expect(converter._context.comments[topCall.comment].text).toBe('@ruby:return:add');

            // Top call should NOT have an evacuation block after it
            const sayBlock = blocks[topCall.next];
            expect(sayBlock.opcode).toBe('looks_say');

            // Verify Blocks -> Ruby suppresses evacuation blocks
            await converter.applyTargetBlocks(target);
            const RubyGenerator = require('../../../../../src/lib/ruby-generator').default;
            const generatedRuby = RubyGenerator.targetToCode(target);

            expect(generatedRuby).not.toMatch(/@_return_add_1_ = @_return_add_/);
            expect(generatedRuby).not.toMatch(/@_return_add_2_ = @_return_add_/);
            expect(generatedRuby).toMatch(/say\(add\(add\(2, 5\), add\(4, 6\)\)\)/);
        });

        test('evacuation blocks for 3-level nesting: say(add(add(add(1, 2), 3), 4))', async () => {
            const code = `
                def add(a, b)
                  a + b
                end

                when_flag_clicked do
                  say(add(add(add(1, 2), 3), 4))
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            const blocks = converter.blocks;

            // add(1, 2) -> index 1
            const firstCall = Object.values(blocks).find(b =>
                b.opcode === 'procedures_call' &&
                b.comment && converter._context.comments[b.comment].text === '@ruby:return:add:1'
            );
            expect(firstCall).toBeDefined();

            const firstEvacuation = blocks[firstCall.next];
            expect(firstEvacuation.opcode).toBe('data_setvariableto');
            expect(firstEvacuation.fields.VARIABLE.value).toBe('_return_add_1_');

            // add(@_return_add_1, 3) -> index 2
            const secondCall = blocks[firstEvacuation.next];
            expect(secondCall.opcode).toBe('procedures_call');
            expect(converter._context.comments[secondCall.comment].text).toBe('@ruby:return:add:2');

            const secondEvacuation = blocks[secondCall.next];
            expect(secondEvacuation.opcode).toBe('data_setvariableto');
            expect(secondEvacuation.fields.VARIABLE.value).toBe('_return_add_2_');

            // add(@_return_add_2, 4) -> index 3 (last)
            const topCall = blocks[secondEvacuation.next];
            expect(topCall.opcode).toBe('procedures_call');
            expect(converter._context.comments[topCall.comment].text).toBe('@ruby:return:add');

            // No evacuation after top call
            const sayBlock = blocks[topCall.next];
            expect(sayBlock.opcode).toBe('looks_say');

            // Verify Blocks -> Ruby
            await converter.applyTargetBlocks(target);
            const RubyGenerator = require('../../../../../src/lib/ruby-generator').default;
            const generatedRuby = RubyGenerator.targetToCode(target);

            expect(generatedRuby).toMatch(/say\(add\(add\(add\(1, 2\), 3\), 4\)\)/);
        });
    });
});
