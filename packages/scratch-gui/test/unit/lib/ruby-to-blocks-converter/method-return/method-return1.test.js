import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';
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

    describe('Phase 0: def foo support', () => {
        test('procedures_definition with def foo (no receiver)', async () => {
            const code = `
                def made_block(arg1)
                  move(arg1)
                end
            `;
            const expected = [
                {
                    opcode: 'procedures_definition',
                    inputs: [
                        {
                            name: 'custom_block',
                            block: {
                                opcode: 'procedures_prototype',
                                mutation: {
                                    proccode: 'made_block %s',
                                    arguments: [
                                        {
                                            name: 'arg1',
                                            type: 'string_number'
                                        }
                                    ]
                                },
                                shadow: true
                            }
                        }
                    ],
                    next: {
                        opcode: 'motion_movesteps',
                        inputs: [
                            {
                                name: 'STEPS',
                                block: {
                                    opcode: 'argument_reporter_string_number',
                                    fields: [
                                        {
                                            name: 'VALUE',
                                            value: 'arg1'
                                        }
                                    ]
                                },
                                shadow: expectedInfo.makeNumber(10)
                            }
                        ]
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
