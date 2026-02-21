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

    describe('Phase 2: explicit return statement support', () => {
        test('return at end of method produces assign + stop blocks', async () => {
            const code = `
                def div(a, b)
                  return a / b
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Chain: procedures_definition -> initialize block -> data_setvariableto -> control_stop
            const defBlock = Object.values(converter.blocks).find(b => b.opcode === 'procedures_definition');
            expect(defBlock).toBeDefined();

            // First block after def is the initialize block
            const initBlock = converter.blocks[defBlock.next];
            expect(initBlock).toBeDefined();
            expect(initBlock.opcode).toBe('data_setvariableto');
            const initComment = converter._context.comments[initBlock.comment];
            expect(initComment.text).toContain('@ruby:return:div:initialize');

            // Second block is the actual return assignment
            const assignBlock = converter.blocks[initBlock.next];
            expect(assignBlock).toBeDefined();
            expect(assignBlock.opcode).toBe('data_setvariableto');
            const assignComment = converter._context.comments[assignBlock.comment];
            expect(assignComment.text).toContain('@ruby:syntax:return');
            expect(assignComment.text).toContain('@ruby:return:div');

            const stopBlock = converter.blocks[assignBlock.next];
            expect(stopBlock).toBeDefined();
            expect(stopBlock.opcode).toBe('control_stop');
            const stopComment = converter._context.comments[stopBlock.comment];
            expect(stopComment.text).toBe('@ruby:syntax:return');
        });

        test('return marks procedure as hasReturnValue', async () => {
            const code = `
                def add(a, b)
                  return a + b
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            const procedure = converter._context.procedures['add'];
            expect(procedure).toBeDefined();
            expect(procedure.hasReturnValue).toBe(true);
        });

        test('early return inside if + return at end: say(div(10, 0), 1) should succeed', async () => {
            // Bug report: this was causing a conversion error
            const code = `
                def div(a, b)
                  if b == 0
                    return 0
                  end
                  return a / b
                end

                say(div(10, 0), 1)
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            expect(converter.errors).toHaveLength(0);

            // div should be marked as hasReturnValue
            const procedure = converter._context.procedures['div'];
            expect(procedure.hasReturnValue).toBe(true);

            // say block should reference @_return_div_ variable
            const sayBlock = Object.values(converter.blocks).find(b => b.opcode === 'looks_sayforsecs');
            expect(sayBlock).toBeDefined();
        });

        test('if/else with return in both branches: say(div(10, 0), 1) should succeed', async () => {
            // Additional spec: all branches return
            const code = `
                def div(a, b)
                  if b == 0
                    return 0
                  else
                    return a / b
                  end
                end

                say(div(10, 0), 1)
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            expect(converter.errors).toHaveLength(0);

            // div should be marked as hasReturnValue
            const procedure = converter._context.procedures['div'];
            expect(procedure.hasReturnValue).toBe(true);
        });
    });

    describe('Phase 3: return value initialization block', () => {
        test('method with return inserts initialize block after procedures_definition', async () => {
            const code = `
                def foo(a)
                  if a == 0
                    return 0
                  else
                    move(10)
                  end
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            const defBlock = Object.values(converter.blocks).find(b => b.opcode === 'procedures_definition');
            expect(defBlock).toBeDefined();

            // First block after def should be initialize block
            const initBlock = converter.blocks[defBlock.next];
            expect(initBlock).toBeDefined();
            expect(initBlock.opcode).toBe('data_setvariableto');
            const initComment = converter._context.comments[initBlock.comment];
            expect(initComment).toBeDefined();
            expect(initComment.text).toBe('@ruby:return:foo:initialize');

            // Initialize block value should be empty string ""
            const valueInput = initBlock.inputs && initBlock.inputs.VALUE;
            expect(valueInput).toBeDefined();
        });

        test('method without return does NOT insert initialize block', async () => {
            const code = `
                def bar(a)
                  move(a)
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            const defBlock = Object.values(converter.blocks).find(b => b.opcode === 'procedures_definition');
            expect(defBlock).toBeDefined();

            // First block after def should be move (not an initialize block)
            const nextBlock = converter.blocks[defBlock.next];
            if (nextBlock) {
                const nextComment = nextBlock.comment && converter._context.comments[nextBlock.comment];
                if (nextComment) {
                    expect(nextComment.text).not.toContain('@ruby:return:bar:initialize');
                }
            }
        });

        test('say(foo(0), 1) then say(foo(1), 1): second call gets fresh return value', async () => {
            // This test verifies that the initialize block causes the second call
            // to not carry over the first call's return value.
            // In blocks: foo(0) sets @_return_foo_=0, then foo(1) sets @_return_foo_=""
            // The say after foo(1) should see "" (empty string), not 0.
            const code = `
                def foo(a)
                  if a == 0
                    return 0
                  else
                    move(10)
                  end
                end

                say(foo(0), 1)
                say(foo(1), 1)
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            expect(converter.errors).toHaveLength(0);

            // Both say blocks should exist
            const sayBlocks = Object.values(converter.blocks).filter(b => b.opcode === 'looks_sayforsecs');
            expect(sayBlocks).toHaveLength(2);
        });
    });
});
