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

    test('motion_glideto', async () => {
        let code;
        let expected;

        code = 'glide("_mouse_", secs: 5)';
        expected = [
            {
                opcode: 'motion_glideto',
                inputs: [
                    {
                        name: 'TO',
                        block: {
                            opcode: 'motion_glideto_menu',
                            fields: [
                                {
                                    name: 'TO',
                                    value: '_mouse_'
                                }
                            ],
                            shadow: true
                        }
                    },
                    {
                        name: 'SECS',
                        block: expectedInfo.makeNumber(5)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'glide("_mouse_", secs: x)';
        expected = [
            {
                opcode: 'motion_glideto',
                inputs: [
                    {
                        name: 'TO',
                        block: {
                            opcode: 'motion_glideto_menu',
                            fields: [
                                {
                                    name: 'TO',
                                    value: '_mouse_'
                                }
                            ],
                            shadow: true
                        }
                    },
                    {
                        name: 'SECS',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'glide()',
            'glide(10, secs: 5)',
            'glide("_mouse_")',
            'glide("_mouse_", 5)',
            'glide("_mouse_", secs: abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_glidesecstoxy', async () => {
        let code;
        let expected;

        code = 'glide([12, 34], secs: 5)';
        expected = [
            {
                opcode: 'motion_glidesecstoxy',
                inputs: [
                    {
                        name: 'X',
                        block: expectedInfo.makeNumber(12)
                    },
                    {
                        name: 'Y',
                        block: expectedInfo.makeNumber(34)
                    },
                    {
                        name: 'SECS',
                        block: expectedInfo.makeNumber(5)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'glide([x, y], secs: x)';
        expected = [
            {
                opcode: 'motion_glidesecstoxy',
                inputs: [
                    {
                        name: 'X',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    },
                    {
                        name: 'Y',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    },
                    {
                        name: 'SECS',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'glide([], secs: 5)',
            'glide([12, 34])',
            'glide([12, 34], 5)',
            'glide([abc, abc], secs: abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_pointindirection', async () => {
        let code;
        let expected;

        code = 'self.direction = 90';
        expected = [
            {
                opcode: 'motion_pointindirection',
                inputs: [
                    {
                        name: 'DIRECTION',
                        block: expectedInfo.makeNumber(90, 'math_angle')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.direction = x';
        expected = [
            {
                opcode: 'motion_pointindirection',
                inputs: [
                    {
                        name: 'DIRECTION',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(90, 'math_angle')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.direction = "90"',
            'self.direction = :symbol',
            'self.direction = abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_pointtowards', async () => {
        const code = 'point_towards("_mouse_")';
        const expected = [
            {
                opcode: 'motion_pointtowards',
                inputs: [
                    {
                        name: 'TOWARDS',
                        block: {
                            opcode: 'motion_pointtowards_menu',
                            fields: [
                                {
                                    name: 'TOWARDS',
                                    value: '_mouse_'
                                }
                            ],
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'point_towards()',
            'point_towards(1)',
            'point_towards("_mouse_", secs: 1)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_ifonedgebounce', async () => {
        const expected = [
            {
                opcode: 'motion_ifonedgebounce'
            }
        ];
        for (const code of [
            'bounce_if_on_edge',
            'bounce_if_on_edge()'
        ]) {
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        { for (const s of [
            'bounce_if_on_edge(1)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_setrotationstyle', async () => {
        for (const style of [
            'left-right',
            "don't rotate",
            'all around'
        ]) {
            const code = `self.rotation_style = "${style}"`;
            const expected = [
                {
                    opcode: 'motion_setrotationstyle',
                    fields: [
                        {
                            name: 'STYLE',
                            value: style
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        { for (const s of [
            'self.rotation_style = 1',
            'self.rotation_style = "invalid"'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });
});
