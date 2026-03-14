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
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
        expected = null;
    });

    describe('looks_changeeffectby', () => {
        test('normal', async () => {
            code = 'change_effect_by("color", 25)';
            expected = [
                {
                    opcode: 'looks_changeeffectby',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'CHANGE',
                            block: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'change_effect_by("color", x)';
            expected = [
                {
                    opcode: 'looks_changeeffectby',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'CHANGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('upper case', async () => {
            code = 'change_effect_by("COLOR", 25)';
            expected = [
                {
                    opcode: 'looks_changeeffectby',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'CHANGE',
                            block: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'change_effect_by',
                'change_effect_by()',
                'change_effect_by("color")',
                'change_effect_by(25)',
                'change_effect_by("invalid effect", 25)',
                'change_effect_by(1, 25)',
                'change_effect_by("color", 25, 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_seteffectto', () => {
        test('normal', async () => {
            code = 'set_effect("color", 25)';
            expected = [
                {
                    opcode: 'looks_seteffectto',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'set_effect("color", x)';
            expected = [
                {
                    opcode: 'looks_seteffectto',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('upper case', async () => {
            code = 'set_effect("COLOR", 25)';
            expected = [
                {
                    opcode: 'looks_seteffectto',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'set_effect',
                'set_effect()',
                'set_effect("color")',
                'set_effect(25)',
                'set_effect("invalid effect", 25)',
                'set_effect(1, 25)',
                'set_effect("color", 25, 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    expectNoArgsMethod('looks_cleargraphiceffects', 'clear_graphic_effects');
    expectNoArgsMethod('looks_show', 'show');
    expectNoArgsMethod('looks_hide', 'hide');
    expectNoArgsMethod('looks_size', 'size', 'value');
});
