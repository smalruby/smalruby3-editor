import RubyGenerator from '../../../../src/lib/ruby-generator';
import ProcedureBlocks from '../../../../src/lib/ruby-generator/procedure';
import DataBlocks from '../../../../src/lib/ruby-generator/data';
import MathBlocks from '../../../../src/lib/ruby-generator/math';
import LooksBlocks from '../../../../src/lib/ruby-generator/looks';

describe('RubyGenerator/MethodReturn', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {},
            targetCommentTexts: []
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = {
            id: 'target-id',
            comments: {},
            variables: {
                v1: { id: 'v1', name: '_return_add', type: '' }
            },
            isStage: false,
            blocks: {
                getBlock: (id) => RubyGenerator.currentTarget.blocks._blocks[id],
                getInputs: (block) => block.inputs || {},
                getProcedureParamNamesIdsAndDefaults: (proccode) => {
                    if (proccode === 'add %s %s') {
                        return [['x', 'y'], ['i1', 'i2'], ['', '']];
                    }
                    return [[], [], []];
                },
                getScripts: () => RubyGenerator.currentTarget.blocks._scripts || []
            }
        };
        ProcedureBlocks(RubyGenerator);
        DataBlocks(RubyGenerator);
        MathBlocks(RubyGenerator);
        LooksBlocks(RubyGenerator);
    });

    const generateCode = (blocks, scripts = [], comments = {}) => {
        RubyGenerator.currentTarget.blocks._blocks = blocks;
        RubyGenerator.currentTarget.blocks._scripts = scripts;
        RubyGenerator.currentTarget.comments = comments;
        // Trigger currentTarget setter
        RubyGenerator.currentTarget = RubyGenerator.currentTarget;
        return RubyGenerator.targetToCode(RubyGenerator.currentTarget);
    };

    describe('Method Return Values', () => {
        test('def self.add(x, y)', () => {
            const blocks = {
                b1: {
                    id: 'b1',
                    opcode: 'procedures_definition',
                    inputs: { custom_block: { block: 'b2' } },
                    next: 'b3',
                    topLevel: true
                },
                b2: {
                    id: 'b2',
                    opcode: 'procedures_prototype',
                    mutation: { proccode: 'add %s %s' },
                    shadow: true
                },
                b3: {
                    id: 'b3',
                    opcode: 'data_setvariableto',
                    fields: { VARIABLE: { id: 'v1', value: '_return_add' } },
                    inputs: { VALUE: { block: 'b4' } }
                },
                b4: {
                    id: 'b4',
                    opcode: 'operator_add',
                    inputs: {
                        NUM1: { block: 'b5' },
                        NUM2: { block: 'b6' }
                    }
                },
                b5: {
                    id: 'b5',
                    opcode: 'argument_reporter_string_number',
                    fields: { VALUE: { value: 'x' } }
                },
                b6: {
                    id: 'b6',
                    opcode: 'argument_reporter_string_number',
                    fields: { VALUE: { value: 'y' } }
                }
            };
            const comments = {
                c1: { id: 'c1', blockId: 'b3', text: '@ruby:return:add' }
            };
            const code = generateCode(blocks, ['b1'], comments);
            // With @ruby:return comment, this is an implicit return - output just the value
            expect(code).toBe('def self.add(x, y)\n  x + y\nend\n');
        });

        test('standalone add(1, 2)', () => {
            const blocks = {
                b1: {
                    id: 'b1',
                    opcode: 'procedures_call',
                    mutation: { proccode: 'add %s %s' },
                    inputs: {
                        i1: { block: 'b2' },
                        i2: { block: 'b3' }
                    },
                    topLevel: true
                },
                b2: { id: 'b2', opcode: 'math_number', fields: { NUM: { value: '1' } }, shadow: true },
                b3: { id: 'b3', opcode: 'math_number', fields: { NUM: { value: '2' } }, shadow: true }
            };
            setBlocks(blocks);
            // procedures_call(b1) is topLevel and its next is NOT Ruby return assignment.
            // So blockToCode(b1) should return "add(1, 2)\n".
            const code = RubyGenerator.blockToCode(blocks.b1);
            expect(code).toBe('add(1, 2)\n');
        });

        test('standalone add(1, 2) with comment (should suppress output)', () => {
            const blocks = {
                b1: {
                    id: 'b1',
                    opcode: 'procedures_call',
                    mutation: { proccode: 'add %s %s' },
                    inputs: {
                        i1: { block: 'b2' },
                        i2: { block: 'b3' }
                    },
                    topLevel: true
                },
                b2: { id: 'b2', opcode: 'math_number', fields: { NUM: { value: '1' } }, shadow: true },
                b3: { id: 'b3', opcode: 'math_number', fields: { NUM: { value: '2' } }, shadow: true }
            };
            const comments = {
                c1: { id: 'c1', blockId: 'b1', text: '@ruby:return:add' }
            };
            setBlocks(blocks, comments);
            // With @ruby:return:add comment, output should be suppressed
            // (will be output by data_variable with @ruby:return:add)
            const code = RubyGenerator.blockToCode(blocks.b1);
            expect(code).toBe('');
        });

        test('use return value in say', () => {
            const blocks = {
                b1: {
                    id: 'b1',
                    opcode: 'procedures_call',
                    mutation: { proccode: 'add %s %s' },
                    inputs: {
                        i1: { block: 'b2' },
                        i2: { block: 'b3' }
                    },
                    next: 'b4',
                    topLevel: true
                },
                b2: { id: 'b2', opcode: 'math_number', fields: { NUM: { value: '1' } }, shadow: true },
                b3: { id: 'b3', opcode: 'math_number', fields: { NUM: { value: '2' } }, shadow: true },
                b4: {
                    id: 'b4',
                    opcode: 'looks_say',
                    inputs: { MESSAGE: { block: 'b5' } }
                },
                b5: {
                    id: 'b5',
                    opcode: 'data_variable',
                    fields: { VARIABLE: { id: 'v1', value: '_return_add' } }
                }
            };
            const comments = {
                c1: { id: 'c1', blockId: 'b1', text: '@ruby:return:add' },
                c2: { id: 'c2', blockId: 'b5', text: '@ruby:return:add' }
            };
            const code = generateCode(blocks, ['b1'], comments);
            expect(code).toBe('say(add(1, 2))\n');
        });

        test('explicit return variable assignment (without comment)', () => {
            const blocks = {
                b1: {
                    id: 'b1',
                    opcode: 'procedures_definition',
                    inputs: { custom_block: { block: 'b2' } },
                    next: 'b3',
                    topLevel: true
                },
                b2: {
                    id: 'b2',
                    opcode: 'procedures_prototype',
                    mutation: { proccode: 'add %s %s' },
                    shadow: true
                },
                b3: {
                    id: 'b3',
                    opcode: 'data_setvariableto',
                    fields: { VARIABLE: { id: 'v1', value: '_return_add' } },
                    inputs: { VALUE: { block: 'b4' } }
                    // NOTE: No comment - this is a user-written assignment
                },
                b4: {
                    id: 'b4',
                    opcode: 'operator_add',
                    inputs: {
                        NUM1: { block: 'b5' },
                        NUM2: { block: 'b6' }
                    }
                },
                b5: {
                    id: 'b5',
                    opcode: 'argument_reporter_string_number',
                    fields: { VALUE: { value: 'x' } }
                },
                b6: {
                    id: 'b6',
                    opcode: 'argument_reporter_string_number',
                    fields: { VALUE: { value: 'y' } }
                }
            };
            const code = generateCode(blocks, ['b1'], {});
            // Without @ruby:return comment, output normal variable assignment
            expect(code).toBe('def self.add(x, y)\n  @_return_add = x + y\nend\n');
        });
    });

    const setBlocks = (blocks, comments = {}) => {
        RubyGenerator.currentTarget.blocks._blocks = blocks;
        RubyGenerator.currentTarget.comments = comments;
        RubyGenerator.currentTarget = RubyGenerator.currentTarget;
    };
});
