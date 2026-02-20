import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Operators', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
        expected = null;
    });

    test('operator_mod', async () => {
        code = '1 % 2';
        expected = [
            {
                opcode: 'operator_mod',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(2)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 % (2)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x % y';
        expected = [
            {
                opcode: 'operator_mod',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            '"1" % "2"',
            '1 % "2"',
            '"1" % 2'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_round', async () => {
        code = '2.round';
        expected = [
            {
                opcode: 'operator_round',
                inputs: [
                    {
                        name: 'NUM',
                        block: expectedInfo.makeNumber(2)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x.round';
        expected = [
            {
                opcode: 'operator_round',
                inputs: [
                    {
                        name: 'NUM',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            '"2".round',
            '"2".round(1)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_mathop', async () => {
        let operatorCodes;

        for (const three of ['3', '(3)']) {
            operatorCodes = {
                'abs': `${three}.abs`,
                'floor': `${three}.floor`,
                'ceiling': `${three}.ceil`,
                'sqrt': `Math.sqrt(${three})`,
                'sin': `Math.sin(${three})`,
                'cos': `Math.cos(${three})`,
                'tan': `Math.tan(${three})`,
                'asin': `Math.asin(${three})`,
                'acos': `Math.acos(${three})`,
                'atan': `Math.atan(${three})`,
                'ln': `Math.log(${three})`,
                'log': `Math.log10(${three})`,
                'e ^': `Math::E ** ${three}`,
                '10 ^': `10 ** ${three}`
            };
            for (const operator of Object.keys(operatorCodes)) {
                code = operatorCodes[operator];
                expected = [
                    {
                        opcode: 'operator_mathop',
                        fields: [
                            {
                                name: 'OPERATOR',
                                value: operator
                            }
                        ],
                        inputs: [
                            {
                                name: 'NUM',
                                block: expectedInfo.makeNumber(3)
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            }
        }

        operatorCodes = {
            'abs': 'x.abs',
            'floor': 'x.floor',
            'ceiling': 'x.ceil',
            'sqrt': 'Math.sqrt(x)',
            'sin': 'Math.sin(x)',
            'cos': 'Math.cos(x)',
            'tan': 'Math.tan(x)',
            'asin': 'Math.asin(x)',
            'acos': 'Math.acos(x)',
            'atan': 'Math.atan(x)',
            'ln': 'Math.log(x)',
            'log': 'Math.log10(x)',
            'e ^': 'Math::E ** x',
            '10 ^': '10 ** x'
        };
        for (const operator of Object.keys(operatorCodes)) {
            code = operatorCodes[operator];
            expected = [
                {
                    opcode: 'operator_mathop',
                    fields: [
                        {
                            name: 'OPERATOR',
                            value: operator
                        }
                    ],
                    inputs: [
                        {
                            name: 'NUM',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber('')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }
    });
});
