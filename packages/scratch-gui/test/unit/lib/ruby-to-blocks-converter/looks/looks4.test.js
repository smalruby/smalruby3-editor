import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {RubyToBlocksConverterError} from '../../../../../src/lib/ruby-to-blocks-converter/errors';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo,
    expectNoArgsMethod
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Looks', () => {
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

    describe('looks_gotofrontback', () => {
        test('normal', async () => {
            code = 'go_to_layer("front")';
            expected = [
                {
                    opcode: 'looks_gotofrontback',
                    fields: [
                        {
                            name: 'FRONT_BACK',
                            value: 'front'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'go_to_layer("back")';
            expected = [
                {
                    opcode: 'looks_gotofrontback',
                    fields: [
                        {
                            name: 'FRONT_BACK',
                            value: 'back'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'go_to_layer',
                'go_to_layer()',
                'go_to_layer("invalid")',
                'go_to_layer(25)',
                'go_to_layer(x)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_goforwardbackwardlayers', () => {
        test('normal', async () => {
            code = 'go_layers(1, "forward")';
            expected = [
                {
                    opcode: 'looks_goforwardbackwardlayers',
                    fields: [
                        {
                            name: 'FORWARD_BACKWARD',
                            value: 'forward'
                        }
                    ],
                    inputs: [
                        {
                            name: 'NUM',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'go_layers(1, "backward")';
            expected = [
                {
                    opcode: 'looks_goforwardbackwardlayers',
                    fields: [
                        {
                            name: 'FORWARD_BACKWARD',
                            value: 'backward'
                        }
                    ],
                    inputs: [
                        {
                            name: 'NUM',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'go_layers(x, "forward")';
            expected = [
                {
                    opcode: 'looks_goforwardbackwardlayers',
                    fields: [
                        {
                            name: 'FORWARD_BACKWARD',
                            value: 'forward'
                        }
                    ],
                    inputs: [
                        {
                            name: 'NUM',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'go_layers',
                'go_layers()',
                'go_layers("invalid")',
                'go_layers(25)',
                'go_layers(x)',
                'go_layers(1, "invalid")',
                'go_layers("1", "forward")',
                'go_layers(:symbol, "forward")'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_costumenumbername', () => {
        test('normal', async () => {
            code = 'costume_number';
            expected = [
                {
                    opcode: 'looks_costumenumbername',
                    fields: [
                        {
                            name: 'NUMBER_NAME',
                            value: 'number'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'costume_name';
            expected = [
                {
                    opcode: 'looks_costumenumbername',
                    fields: [
                        {
                            name: 'NUMBER_NAME',
                            value: 'name'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'costume_number(1)',
                'costume_name(1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_backdropnumbername', () => {
        test('normal', async () => {
            code = 'backdrop_number';
            expected = [
                {
                    opcode: 'looks_backdropnumbername',
                    fields: [
                        {
                            name: 'NUMBER_NAME',
                            value: 'number'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'backdrop_name';
            expected = [
                {
                    opcode: 'looks_backdropnumbername',
                    fields: [
                        {
                            name: 'NUMBER_NAME',
                            value: 'name'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'backdrop_number(1)',
                'backdrop_name(1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

});
