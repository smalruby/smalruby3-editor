import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo,
    expectNoArgsMethod
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Sound', () => {
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

    describe('sound_setvolumeto', () => {
        test('normal', async () => {
            code = 'self.volume = 100';
            expected = [
                {
                    opcode: 'sound_setvolumeto',
                    inputs: [
                        {
                            name: 'VOLUME',
                            block: expectedInfo.makeNumber(100)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'self.volume = x';
            expected = [
                {
                    opcode: 'sound_setvolumeto',
                    inputs: [
                        {
                            name: 'VOLUME',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(100)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('statement', async () => {
            code = `
                bounce_if_on_edge
                self.volume = 100
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            expected[0].next = (await rubyToExpected(converter, target, 'self.volume = 100'))[0];
            expected[0].next.next = (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'self.volume = "100"',
                'self.volume = :symbol',
                'self.volume = abc'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    expectNoArgsMethod('sound_volume', 'volume', 'value');

    describe('sound existence check', () => {
        let targetWithSounds;

        beforeEach(() => {
            // Mock target with sounds
            targetWithSounds = {
                sprite: {
                    sounds: [
                        { name: 'Meow' },
                        { name: 'Pop' }
                    ]
                }
            };
        });

        [
            {
                opcode: 'sound_playuntildone',
                methodName: 'play_until_done'
            },
            {
                opcode: 'sound_play',
                methodName: 'play'
            }
        ].forEach(info => {
            describe(`${info.opcode} with sound existence check`, () => {
                test('existing sound should work', async () => {
                    code = `${info.methodName}("Meow")`;
                    expected = [
                        {
                            opcode: info.opcode,
                            inputs: [
                                {
                                    name: 'SOUND_MENU',
                                    block: {
                                        opcode: 'sound_sounds_menu',
                                        fields: [
                                            {
                                                name: 'SOUND_MENU',
                                                value: 'Meow'
                                            }
                                        ],
                                        shadow: true
                                    }
                                }
                            ]
                        }
                    ];
                    await convertAndExpectToEqualBlocks(converter, targetWithSounds, code, expected);
                });

                test('non-existing sound should throw error', async () => {
                    code = `${info.methodName}("NonExistentSound")`;
                    const result = await converter.targetCodeToBlocks(targetWithSounds, code);
                    expect(result).toBeFalsy();
                    expect(converter.errors).toHaveLength(1);
                    expect(converter.errors[0].text).toContain('sound "NonExistentSound" does not exist');
                });
            });
        });
    });
});
