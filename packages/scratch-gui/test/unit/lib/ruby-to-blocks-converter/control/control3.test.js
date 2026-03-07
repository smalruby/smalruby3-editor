import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectRubyBlockError,
    convertAndExpectToEqualBlocks,
    rubyToExpected
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Control', () => {
    let converter;
    let target;
    let code;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
    });

    describe('control_wait_until', () => {
        test('error', async () => {
            code = 'wait until move(10)';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/condition is not boolean: move\(10\)/);
            expect(res).toBeFalsy();
        });
    });

    describe('control_repeat_until', () => {
        test('error', async () => {
            code = `
                until move(10)
                  bounce_if_on_edge
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/condition is not boolean: move\(10\)/);
            expect(res).toBeFalsy();
        });
    });

    describe('control_stop', () => {
        test('invalid', async () => {
            const cases = [
                'stop',
                'stop()',
                'stop(1)',
                'stop("invalid option")',
                'stop("all", 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });
    });

    describe('control_create_clone_of', () => {
        test('invalid', async () => {
            const cases = [
                'create_clone',
                'create_clone()',
                'create_clone(1)',
                'create_clone(move(10))',
                'create_clone("_myself_", 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });
    });

    describe('control_delete_this_clone', () => {
        test('invalid', async () => {
            const cases = [
                '12.delete_this_clone',
                'delete_this_clone(1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });
    });

    describe('while (control_repeat_until with @ruby:syntax:while)', () => {
        test('while cond; body; end => control_repeat_until(not(cond), body) + @ruby:syntax:while comment', async () => {
            const code = `
                while touching?("_edge_")
                  move(10)
                end
            `;
            const condBlock = (await rubyToExpected(converter, target, 'touching?("_edge_")'))[0];
            const moveBlock = (await rubyToExpected(converter, target, 'move(10)'))[0];
            const expected = [
                {
                    opcode: 'control_repeat_until',
                    comment: {
                        text: '@ruby:syntax:while',
                        minimized: true
                    },
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: {
                                opcode: 'operator_not',
                                inputs: [
                                    {
                                        name: 'OPERAND',
                                        block: condBlock
                                    }
                                ]
                            }
                        }
                    ],
                    branches: [
                        moveBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('while with comparison: while @x >= 0; body; end', async () => {
            const code = `
                while @x >= 0
                  move(10)
                end
            `;
            const condBlock = (await rubyToExpected(converter, target, '@x >= 0'))[0];
            const moveBlock = (await rubyToExpected(converter, target, 'move(10)'))[0];
            const expected = [
                {
                    opcode: 'control_repeat_until',
                    comment: {
                        text: '@ruby:syntax:while',
                        minimized: true
                    },
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: {
                                opcode: 'operator_not',
                                inputs: [
                                    {
                                        name: 'OPERAND',
                                        block: condBlock
                                    }
                                ]
                            }
                        }
                    ],
                    branches: [
                        moveBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('while with non-boolean condition should error', async () => {
            const code = `
                while move(10)
                  bounce_if_on_edge
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/condition is not boolean: move\(10\)/);
            expect(res).toBeFalsy();
        });
    });

    describe('control_start_as_clone', () => {
        test('invalid', async () => {
            const cases1 = [
                'self.when(:start_as_a_clone)',
                'self.when(:start_as_a_clone, 1)'
            ];
            for (const s of cases1) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                '12.when(:start_as_a_clone) {}'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });
    });

    describe('Stage/Clone validation', () => {
        let stageTarget;

        beforeEach(() => {
            stageTarget = {
                isStage: true,
                variables: {},
                sprite: {}
            };
        });

        test('sprite-only clone blocks should throw error on stage', async () => {
            const spriteOnlyCommands = [
                'delete_this_clone',
                'self.when_start_as_a_clone {}'
            ];

            for (const command of spriteOnlyCommands) {
                const result = await converter.targetCodeToBlocks(stageTarget, command);
                expect(result).toBeFalsy();
                expect(converter.errors).toHaveLength(1);
                expect(converter.errors[0].text).toMatch(/is the wrong instruction\./);
                converter.reset();
            }
        });

        test('stage-common blocks should work on stage', async () => {
            const stageCommonCommands = [
                'create_clone("Sprite1")',
                'sleep(1)',
                'repeat(3) {}',
                'forever {}',
                'stop("all")'
            ];

            for (const command of stageCommonCommands) {
                const result = await converter.targetCodeToBlocks(stageTarget, command);
                expect(result).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                converter.reset();
            }
        });

        test('all blocks should work on sprite', async () => {
            const allCommands = [
                'delete_this_clone',
                'self.when_start_as_a_clone {}',
                'create_clone("Sprite1")',
                'sleep(1)',
                'repeat(3) {}',
                'forever {}',
                'stop("all")'
            ];

            for (const command of allCommands) {
                const result = await converter.targetCodeToBlocks(target, command);
                expect(result).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                converter.reset();
            }
        });
    });
});
