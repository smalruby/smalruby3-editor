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

    describe('Stage/Sprite validation', () => {
        let stageTarget;
        let spriteTarget;

        beforeEach(() => {
            stageTarget = {
                isStage: true,
                variables: {}
            };
            spriteTarget = {
                isStage: false,
                variables: {}
            };
        });

        test('sprite-only blocks should throw error on stage', async () => {
            const spriteOnlyCommands = [
                'say("Hello")',
                'say("Hello", 2)',
                'think("Hmm")',
                'think("Hmm", 2)',
                'switch_costume("costume1")',
                'next_costume',
                'self.size = 100',
                'go_to_layer("front")',
                'go_layers(1, "forward")',
                'show',
                'hide',
                'size',
                'costume_name',
                'costume_number'
            ];

            for (const code of spriteOnlyCommands) {
                const res = await converter.targetCodeToBlocks(stageTarget, code);
                expect(res).toBeFalsy();
                expect(converter.errors).toHaveLength(1);
                expect(converter.errors[0].text).toMatch(/is the wrong instruction\./);
                
                // Reset for next test
                converter.reset();
            }
        });

        test('stage-common blocks should work on stage', async () => {
            const stageCompatibleCommands = [
                'switch_backdrop("backdrop1")',
                'switch_backdrop_and_wait("backdrop1")',
                'next_backdrop',
                'clear_graphic_effects',
                'change_effect_by("COLOR", 25)',
                'set_effect("COLOR", 50)',
                'backdrop_name',
                'backdrop_number'
            ];

            for (const code of stageCompatibleCommands) {
                const res = await converter.targetCodeToBlocks(stageTarget, code);
                if (!res) {
                    console.log(`Failed command: ${code}`);
                    console.log(`Errors: ${JSON.stringify(converter.errors)}`);
                }
                expect(res).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                
                // Reset for next test
                converter.reset();
            }
        });

        test('all blocks should work on sprite', async () => {
            const allCommands = [
                // Sprite-only blocks
                'say("Hello")',
                'think("Hmm")',
                'switch_costume("costume1")',
                'next_costume',
                'show',
                'hide',
                'size',
                // Common blocks
                'switch_backdrop("backdrop1")',
                'next_backdrop',
                'clear_graphic_effects'
            ];

            { for (const code of allCommands) {
                const res = await converter.targetCodeToBlocks(spriteTarget, code);
                expect(res).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                
                // Reset for next test
                converter.reset();
            } }
        });
    });

    describe('print, puts, p', () => {
        ['print', 'puts', 'p'].forEach(method => {
            test(`${method}("Hello") should become looks_sayforsecs with comment`, async () => {
                code = `${method}("Hello")`;
                expected = [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: expectedInfo.makeText('Hello')
                            },
                            {
                                name: 'SECS',
                                block: expectedInfo.makeNumber(1)
                            }
                        ]
                    }
                ];

                // First verify blocks structure
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                // Then verify comment
                const blockId = Object.keys(converter.blocks).find(id => converter.blocks[id].opcode === 'looks_sayforsecs');
                const block = converter.blocks[blockId];
                expect(block.comment).toBeDefined();

                const commentId = block.comment;
                expect(converter._context.comments[commentId]).toBeDefined();
                expect(converter._context.comments[commentId].text).toEqual(`@ruby:method:${method}`);
            });

            test(`${method}(10) should become looks_sayforsecs with type comment`, async () => {
                code = `${method}(10)`;
                expected = [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: expectedInfo.makeText('10')
                            },
                            {
                                name: 'SECS',
                                block: expectedInfo.makeNumber(1)
                            }
                        ]
                    }
                ];

                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const blockId = Object.keys(converter.blocks).find(id => converter.blocks[id].opcode === 'looks_sayforsecs');
                const block = converter.blocks[blockId];
                expect(block.comment).toBeDefined();

                const commentId = block.comment;
                expect(converter._context.comments[commentId].text).toEqual(`@ruby:method:${method},@ruby:argument:1:type:Integer`);
            });

            test(`${method}(3.5) should become looks_sayforsecs with type comment`, async () => {
                code = `${method}(3.5)`;
                expected = [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: expectedInfo.makeText('3.5')
                            },
                            {
                                name: 'SECS',
                                block: expectedInfo.makeNumber(1)
                            }
                        ]
                    }
                ];

                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const blockId = Object.keys(converter.blocks).find(id => converter.blocks[id].opcode === 'looks_sayforsecs');
                const block = converter.blocks[blockId];
                expect(block.comment).toBeDefined();

                const commentId = block.comment;
                expect(converter._context.comments[commentId].text).toEqual(`@ruby:method:${method},@ruby:argument:1:type:Float`);
            });

            test(`${method}("Hello", 10, 3.5) should become multiple looks_sayforsecs blocks`, async () => {
                code = `${method}("Hello", 10, 3.5)`;
                expected = [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: expectedInfo.makeText('Hello')
                            },
                            {
                                name: 'SECS',
                                block: expectedInfo.makeNumber(1)
                            }
                        ],
                        next: {
                            opcode: 'looks_sayforsecs',
                            inputs: [
                                {
                                    name: 'MESSAGE',
                                    block: expectedInfo.makeText('10')
                                },
                                {
                                    name: 'SECS',
                                    block: expectedInfo.makeNumber(1)
                                }
                            ],
                            next: {
                                opcode: 'looks_sayforsecs',
                                inputs: [
                                    {
                                        name: 'MESSAGE',
                                        block: expectedInfo.makeText('3.5')
                                    },
                                    {
                                        name: 'SECS',
                                        block: expectedInfo.makeNumber(1)
                                    }
                                ]
                            }
                        }
                    }
                ];

                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const blocks = Object.values(converter.blocks).filter(b => b.opcode === 'looks_sayforsecs');
                expect(blocks).toHaveLength(3);

                // Find blocks in order
                const firstBlock = blocks.find(b => !b.parent);
                const secondBlock = converter.blocks[firstBlock.next];
                const thirdBlock = converter.blocks[secondBlock.next];

                expect(converter._context.comments[firstBlock.comment].text).toEqual(`@ruby:method:${method}`);
                expect(converter._context.comments[secondBlock.comment].text).toEqual(`@ruby:method:${method},@ruby:argument:1:type:Integer`);
                expect(converter._context.comments[thirdBlock.comment].text).toEqual(`@ruby:method:${method},@ruby:argument:1:type:Float`);
            });
        });
    });
});
