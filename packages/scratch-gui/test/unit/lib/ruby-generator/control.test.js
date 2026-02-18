import RubyGenerator from '../../../../src/lib/ruby-generator';
import ControlBlocks from '../../../../src/lib/ruby-generator/control';

describe('RubyGenerator/Control', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {
            comments: {}
        };
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.emptyCallCache_ = {};
        RubyGenerator.notEqualsCallCache_ = {};
        RubyGenerator.currentTarget = null;
        ControlBlocks(RubyGenerator);
    });

    describe('control_if', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'control_if',
                inputs: {
                    CONDITION: {
                        block: 'condition-id'
                    },
                    SUBSTACK: {
                        block: 'substack-id'
                    }
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('x == 1');
            RubyGenerator.statementToCode = jest.fn()
                .mockReturnValueOnce('  move(10)\n');
            expect(RubyGenerator.control_if(block)).toEqual('if x == 1\n  move(10)\nend\n');
        });
    });

    describe('control_if_else', () => {
        test('normal', () => {
            const block = {
                id: 'block-id',
                opcode: 'control_if_else',
                inputs: {
                    CONDITION: {
                        block: 'condition-id'
                    },
                    SUBSTACK: {
                        block: 'substack-id'
                    },
                    SUBSTACK2: {
                        block: 'substack2-id'
                    }
                }
            };
            RubyGenerator.valueToCode = jest.fn()
                .mockReturnValueOnce('x == 1');
            RubyGenerator.statementToCode = jest.fn()
                .mockReturnValueOnce('  move(10)\n')
                .mockReturnValueOnce('  move(20)\n');
            expect(RubyGenerator.control_if_else(block)).toEqual('if x == 1\n  move(10)\nelse\n  move(20)\nend\n');
        });

        test('elsif only', () => {
            const block = {
                id: 'block-id',
                opcode: 'control_if_else',
                inputs: {
                    CONDITION: { block: 'condition-id' },
                    SUBSTACK: { block: 'substack-id' },
                    SUBSTACK2: { block: 'substack2-id' }
                }
            };
            const nestedBlock = {
                id: 'substack2-id',
                opcode: 'control_if',
                inputs: {
                    CONDITION: { block: 'condition2-id' },
                    SUBSTACK: { block: 'substack3-id' }
                }
            };

            RubyGenerator.getCommentText = jest.fn(b => {
                if (b.id === 'block-id' || b.id === 'substack2-id') {
                    return '@ruby:syntax:elsif:1';
                }
                return null;
            });
            RubyGenerator.getBlock = jest.fn(id => {
                if (id === 'substack2-id') return nestedBlock;
                return null;
            });
            RubyGenerator.valueToCode = jest.fn((b, name) => {
                if (b.id === 'block-id' && name === 'CONDITION') return 'x == 1';
                if (b.id === 'substack2-id' && name === 'CONDITION') return 'x == 2';
                return '';
            });
            RubyGenerator.statementToCode = jest.fn((b, name) => {
                if (b.id === 'block-id' && name === 'SUBSTACK') return '  move(10)\n';
                if (b.id === 'substack2-id' && name === 'SUBSTACK') return '  move(20)\n';
                return '';
            });

            expect(RubyGenerator.control_if_else(block)).toEqual('if x == 1\n  move(10)\nelsif x == 2\n  move(20)\nend\n');
        });

        test('elsif + else', () => {
            const block = {
                id: 'block-id',
                opcode: 'control_if_else',
                inputs: {
                    CONDITION: { block: 'condition-id' },
                    SUBSTACK: { block: 'substack-id' },
                    SUBSTACK2: { block: 'substack2-id' }
                }
            };
            const nestedBlock = {
                id: 'substack2-id',
                opcode: 'control_if_else',
                inputs: {
                    CONDITION: { block: 'condition2-id' },
                    SUBSTACK: { block: 'substack3-id' },
                    SUBSTACK2: { block: 'substack4-id' }
                }
            };

            RubyGenerator.getCommentText = jest.fn(b => {
                if (b.id === 'block-id' || b.id === 'substack2-id') {
                    return '@ruby:syntax:elsif:1';
                }
                return null;
            });
            RubyGenerator.getBlock = jest.fn(id => {
                if (id === 'substack2-id') return nestedBlock;
                return null;
            });
            RubyGenerator.valueToCode = jest.fn((b, name) => {
                if (b.id === 'block-id' && name === 'CONDITION') return 'x == 1';
                if (b.id === 'substack2-id' && name === 'CONDITION') return 'x == 2';
                return '';
            });
            RubyGenerator.statementToCode = jest.fn((b, name) => {
                if (b.id === 'block-id' && name === 'SUBSTACK') return '  move(10)\n';
                if (b.id === 'substack2-id' && name === 'SUBSTACK') return '  move(20)\n';
                if (b.id === 'substack2-id' && name === 'SUBSTACK2') return '  move(30)\n';
                return '';
            });

            expect(RubyGenerator.control_if_else(block)).toEqual('if x == 1\n  move(10)\nelsif x == 2\n  move(20)\nelse\n  move(30)\nend\n');
        });

        test('multiple elsif', () => {
            const block1 = {
                id: 'block1-id',
                opcode: 'control_if_else',
                inputs: {
                    CONDITION: { block: 'cond1-id' },
                    SUBSTACK: { block: 'sub1-id' },
                    SUBSTACK2: { block: 'block2-id' }
                }
            };
            const block2 = {
                id: 'block2-id',
                opcode: 'control_if_else',
                inputs: {
                    CONDITION: { block: 'cond2-id' },
                    SUBSTACK: { block: 'sub2-id' },
                    SUBSTACK2: { block: 'block3-id' }
                }
            };
            const block3 = {
                id: 'block3-id',
                opcode: 'control_if_else',
                inputs: {
                    CONDITION: { block: 'cond3-id' },
                    SUBSTACK: { block: 'sub3-id' },
                    SUBSTACK2: { block: 'sub4-id' }
                }
            };

            RubyGenerator.getCommentText = jest.fn(b => {
                if (b.id === 'block1-id' || b.id === 'block2-id' || b.id === 'block3-id') {
                    return '@ruby:syntax:elsif:1';
                }
                return null;
            });
            RubyGenerator.getBlock = jest.fn(id => {
                if (id === 'block2-id') return block2;
                if (id === 'block3-id') return block3;
                return null;
            });
            RubyGenerator.valueToCode = jest.fn((b, name) => {
                if (b.id === 'block1-id' && name === 'CONDITION') return 'x == 1';
                if (b.id === 'block2-id' && name === 'CONDITION') return 'x == 2';
                if (b.id === 'block3-id' && name === 'CONDITION') return 'x == 3';
                return '';
            });
            RubyGenerator.statementToCode = jest.fn((b, name) => {
                if (b.id === 'block1-id' && name === 'SUBSTACK') return '  move(10)\n';
                if (b.id === 'block2-id' && name === 'SUBSTACK') return '  move(20)\n';
                if (b.id === 'block3-id' && name === 'SUBSTACK') return '  move(30)\n';
                if (b.id === 'block3-id' && name === 'SUBSTACK2') return '  move(40)\n';
                return '';
            });

            expect(RubyGenerator.control_if_else(block1)).toEqual('if x == 1\n  move(10)\nelsif x == 2\n  move(20)\nelsif x == 3\n  move(30)\nelse\n  move(40)\nend\n');
        });
    });
});
