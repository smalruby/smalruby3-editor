import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo,
    expectNoArgsMethod
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Sensing', () => {
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

    describe('sensing_of', () => {
        describe('normal', () => {
            const spritePropertyToMethod = {
                'x position': 'x',
                'y position': 'y',
                'direction': 'direction',
                'costume #': 'costume_number',
                'costume name': 'costume_name',
                'size': 'size',
                'volume': 'volume',
                'local': 'variable("local")'
            };
            Object.keys(spritePropertyToMethod).forEach(property => {
                const method = spritePropertyToMethod[property];
                test(method, async () => {
                    code = `sprite("Sprite1").${method}`;
                    expected = [
                        {
                            opcode: 'sensing_of',
                            fields: [
                                {
                                    name: 'PROPERTY',
                                    value: property
                                }
                            ],
                            inputs: [
                                {
                                    name: 'OBJECT',
                                    block: {
                                        opcode: 'sensing_of_object_menu',
                                        fields: [
                                            {
                                                name: 'OBJECT',
                                                value: 'Sprite1'
                                            }
                                        ],
                                        shadow: true
                                    }
                                }
                            ]
                        }
                    ];
                    await convertAndExpectToEqualBlocks(converter, target, code, expected);
                });
            });

            const stagePropertyToMethod = {
                'backdrop #': 'backdrop_number',
                'backdrop name': 'backdrop_name',
                'volume': 'volume',
                'global': 'variable("global")'
            };
            Object.keys(stagePropertyToMethod).forEach(property => {
                const method = stagePropertyToMethod[property];
                test(method, async () => {
                    code = `stage.${method}`;
                    expected = [
                        {
                            opcode: 'sensing_of',
                            fields: [
                                {
                                    name: 'PROPERTY',
                                    value: property
                                }
                            ],
                            inputs: [
                                {
                                    name: 'OBJECT',
                                    block: {
                                        opcode: 'sensing_of_object_menu',
                                        fields: [
                                            {
                                                name: 'OBJECT',
                                                value: '_stage_'
                                            }
                                        ],
                                        shadow: true
                                    }
                                }
                            ]
                        }
                    ];
                    await convertAndExpectToEqualBlocks(converter, target, code, expected);
                });
            });
        });

        test('value', async () => {
            code = `
                bounce_if_on_edge
                sprite("Sprite1").x
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0],
                (await rubyToExpected(converter, target, 'sprite("Sprite1").x'))[0],
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = `
                bounce_if_on_edge
                stage.volume
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0],
                (await rubyToExpected(converter, target, 'stage.volume'))[0],
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'sprite("Sprite1", 1).x',
                'sprite(1).x',
                'sprite(1).x(1)',
                'stage(1).x',
                'stage.x(1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });

        test('error', async () => {
            code = `
                forever do
                  sprite("Sprite1").x
                end
            `;
            let res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(res).toBeFalsy();

            code = `
                forever do
                  stage.x
                  Time.now.year
                end
            `;
            res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(res).toBeFalsy();
        });
    });

});
