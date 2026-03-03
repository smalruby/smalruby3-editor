import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {RubyToBlocksConverterError} from '../../../../../src/lib/ruby-to-blocks-converter/errors';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Motion', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    test('motion_changexby', async () => {
        let code;
        let expected;

        code = 'self.x += 10';
        expected = [
            {
                opcode: 'motion_changexby',
                inputs: [
                    {
                        name: 'DX',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.x += y';
        expected = [
            {
                opcode: 'motion_changexby',
                inputs: [
                    {
                        name: 'DX',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.x -= 10';
        expected = [
            {
                opcode: 'motion_changexby',
                inputs: [
                    {
                        name: 'DX',
                        block: expectedInfo.makeNumber(-10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.x -= y';
        expected = [
            {
                opcode: 'motion_changexby',
                inputs: [
                    {
                        name: 'DX',
                        block: (await rubyToExpected(converter, target, '0 - y'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.x += "10"',
            'self.x += :symbol',
            'self.x += abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_setx', async () => {
        let code;
        let expected;

        code = 'self.x = 10';
        expected = [
            {
                opcode: 'motion_setx',
                inputs: [
                    {
                        name: 'X',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.x = y';
        expected = [
            {
                opcode: 'motion_setx',
                inputs: [
                    {
                        name: 'X',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.x = "10"',
            'self.x = :symbol',
            'self.x = abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_changeyby', async () => {
        let code;
        let expected;

        code = 'self.y += 10';
        expected = [
            {
                opcode: 'motion_changeyby',
                inputs: [
                    {
                        name: 'DY',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.y += x';
        expected = [
            {
                opcode: 'motion_changeyby',
                inputs: [
                    {
                        name: 'DY',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.y -= 10';
        expected = [
            {
                opcode: 'motion_changeyby',
                inputs: [
                    {
                        name: 'DY',
                        block: expectedInfo.makeNumber(-10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.y -= x';
        expected = [
            {
                opcode: 'motion_changeyby',
                inputs: [
                    {
                        name: 'DY',
                        block: (await rubyToExpected(converter, target, '0 - x'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.y += "10"',
            'self.y += :symbol',
            'self.y += abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_sety', async () => {
        let code;
        let expected;

        code = 'self.y = 10';
        expected = [
            {
                opcode: 'motion_sety',
                inputs: [
                    {
                        name: 'Y',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.y = x';
        expected = [
            {
                opcode: 'motion_sety',
                inputs: [
                    {
                        name: 'Y',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.y = "10"',
            'self.y = :symbol',
            'self.y = abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    [
        'x',
        'y'
    ].forEach(xy => {
        test(`motion_${xy}position`, async () => {
            const code = xy;
            const expected = [
                {
                    opcode: `motion_${xy}position`
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    test('motion_direction', async () => {
        const code = 'direction';
        const expected = [
            {
                opcode: 'motion_direction'
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    describe('Stage validation', () => {
        let stageTarget;

        beforeEach(() => {
            stageTarget = {
                isStage: true,
                variables: {}
            };
        });

        test('all motion blocks should throw error on stage', async () => {
            const motionCommands = [
                'move(10)',
                'turn_right(15)',
                'turn_left(15)',
                'go_to("_mouse_")',
                'go_to([10, 20])',
                'glide("_mouse_", secs: 1)',
                'glide([10, 20], secs: 1)',
                'point_towards("_mouse_")',
                'bounce_if_on_edge',
                'self.direction = 90',
                'self.rotation_style = "all around"',
                'self.x = 10',
                'self.y = 10',
                'self.x += 5',
                'self.y += 5',
                'self.x -= 5',
                'self.y -= 5',
                'x',
                'y',
                'direction'
            ];

            for (const code of motionCommands) {
                const res = await converter.targetCodeToBlocks(stageTarget, code);
                expect(res).toBeFalsy();
                expect(converter.errors).toHaveLength(1);
                expect(converter.errors[0].text).toMatch(/is the wrong instruction\./);
                
                // Reset for next test
                converter.reset();
            }
        });

        test('motion blocks work fine on sprite target', async () => {
            const spriteTarget = {
                isStage: false,
                variables: {}
            };

            // Test a few representative motion commands work on sprite
            { for (const code of ['move(10)', 'turn_right(15)', 'x']) {
                const res = await converter.targetCodeToBlocks(spriteTarget, code);
                expect(res).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                
                // Reset for next test
                converter.reset();
            } }
        });
    });
});
