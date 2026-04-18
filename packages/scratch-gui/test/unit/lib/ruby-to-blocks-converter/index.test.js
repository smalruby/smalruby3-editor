import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
        expected = null;
    });

    describe('targetCodeToBlocks', () => {
        test('can call', async () => {
            expect(await converter.targetCodeToBlocks(target, 'move(10)')).toBeTruthy();
            expect(Object.keys(converter.blocks)).toHaveLength(2);
            expect(converter.errors).toHaveLength(0);
            expect(Object.keys(converter.variables)).toHaveLength(0);
            expect(Object.keys(converter.lists)).toHaveLength(0);
        });

        test('empty', async () => {
            expect(await converter.targetCodeToBlocks(target, '')).toBeTruthy();
            expect(Object.keys(converter.blocks)).toHaveLength(0);
            expect(converter.errors).toHaveLength(0);
            expect(Object.keys(converter.variables)).toHaveLength(0);
            expect(Object.keys(converter.lists)).toHaveLength(0);
        });


        describe('top level blocks', () => {
            test('statements', async () => {
                expected = [
                    (await rubyToExpected(converter, target, 'move(10)'))[0]
                ];
                expected[0].next = (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0];
                expected[0].next.next = (await rubyToExpected(converter, target, 'turn_right(180)'))[0];

                code = `
                    move(10)
                    bounce_if_on_edge
                    turn_right(180)
                `;
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                code = `
                    move(10)
                    (bounce_if_on_edge)
                    turn_right(180)
                `;
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                code = `
                    move(10)
                    (bounce_if_on_edge; turn_right(180))
                `;
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                code = `
                    (move(10); bounce_if_on_edge; turn_right(180))
                `;
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                code = `
                    (move(10); bounce_if_on_edge)
                    turn_right(180)
                `;
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            });

            test('values', async () => {
                code = `
                    x
                    y
                    size
                `;
                expected = [
                    (await rubyToExpected(converter, target, 'x'))[0],
                    (await rubyToExpected(converter, target, 'y'))[0],
                    (await rubyToExpected(converter, target, 'size'))[0]

                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            });

            test('hats', async () => {
                code = `
                    when_flag_clicked {}
                    when_flag_clicked {}
                    when_flag_clicked {}
                `;
                expected = [
                    (await rubyToExpected(converter, target, 'when_flag_clicked {}'))[0],
                    (await rubyToExpected(converter, target, 'when_flag_clicked {}'))[0],
                    (await rubyToExpected(converter, target, 'when_flag_clicked {}'))[0]
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            });

            test('terminates', async () => {
                code = `
                    forever {}
                    forever {}
                    forever {}
                `;
                expected = [
                    (await rubyToExpected(converter, target, 'forever {}'))[0],
                    (await rubyToExpected(converter, target, 'forever {}'))[0],
                    (await rubyToExpected(converter, target, 'forever {}'))[0]
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            });

            test('mix', async () => {
                code = `
                    move(10)
                    x
                    bounce_if_on_edge
                    turn_right(180)
                    y
                    size
                    move(10)
                    when_flag_clicked {}
                    bounce_if_on_edge
                    forever {}
                    move(10)
                    x
                `;
                expected = [
                    (await rubyToExpected(converter, target, 'move(10)'))[0],
                    (await rubyToExpected(converter, target, 'x'))[0],
                    (await rubyToExpected(converter, target, 'bounce_if_on_edge; turn_right(180)'))[0],
                    (await rubyToExpected(converter, target, 'y'))[0],
                    (await rubyToExpected(converter, target, 'size'))[0],
                    (await rubyToExpected(converter, target, 'move(10)'))[0],
                    (await rubyToExpected(converter, target, 'when_flag_clicked {}'))[0],
                    (await rubyToExpected(converter, target, 'bounce_if_on_edge; forever {}'))[0],
                    (await rubyToExpected(converter, target, 'move(10)'))[0],
                    (await rubyToExpected(converter, target, 'x'))[0]
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            });

            test('mix 2', async () => {
                code = `
                    move(10)
                    (forever {}; turn_right(180))
                    forever {}
                    (move(10); turn_right(180); forever {})
                    move(10)
                `;
                expected = [
                    (await rubyToExpected(converter, target, 'move(10); forever {}'))[0],
                    (await rubyToExpected(converter, target, 'turn_right(180); forever {}'))[0],
                    (await rubyToExpected(converter, target, 'move(10); turn_right(180); forever {}'))[0],
                    (await rubyToExpected(converter, target, 'move(10)'))[0]
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            });

            test('error', async () => {
                // Bare literals (1, "Hello!") are now auto-converted to temp
                // variable assignments, so they no longer error.
                // Only symbols still error.
                { for (const c of [
                    ':symbol'
                ]) {
                    const res = await converter.targetCodeToBlocks(target, c);
                    expect(converter.errors).toHaveLength(1);
                    expect(converter.errors[0].row).toEqual(0);
                    expect(res).toBeFalsy();
                } }
            });

            test('bare literals are accepted', async () => {
                { for (const c of [
                    '1',
                    '"Hello!"',
                    'move(10); 1',
                    'move(10); 1; bounce_if_on_edge'
                ]) {
                    const res = await converter.targetCodeToBlocks(target, c);
                    expect(res).toBeTruthy();
                } }
            });
        });

        describe('bugged codes', () => {
            test('value in if', async () => {
                code = `
                    if false
                      x
                    end
                `;
                const res = await converter.targetCodeToBlocks(target, code);
                expect(converter.errors).toHaveLength(1);
                expect(converter.errors[0].row).toEqual(2);
                expect(res).toBeFalsy();
            });

            test('==, <, > and variable', async () => {
                code = `
                    if !($global == 21)
                      bounce_if_on_edge
                    end
                `;
                expected = [
                    {
                        opcode: 'control_if',
                        inputs: [
                            {
                                name: 'CONDITION',
                                block: {
                                    opcode: 'operator_not',
                                    inputs: [
                                        {
                                            name: 'OPERAND',
                                            block: {
                                                opcode: 'operator_equals',
                                                inputs: [
                                                    {
                                                        name: 'OPERAND1',
                                                        block: {
                                                            opcode: 'data_variable',
                                                            fields: [
                                                                {
                                                                    name: 'VARIABLE',
                                                                    variable: '$global'
                                                                }
                                                            ]
                                                        },
                                                        shadow: expectedInfo.makeText('')
                                                    },
                                                    {
                                                        name: 'OPERAND2',
                                                        block: expectedInfo.makeText('21')
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        ],
                        branches: [
                            (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            });
        });
    });
});
