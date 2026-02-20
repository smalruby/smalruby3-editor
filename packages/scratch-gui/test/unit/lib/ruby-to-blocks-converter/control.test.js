import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectRubyBlockError,
    convertAndExpectToEqualBlocks,
    rubyToExpected
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Control', () => {
    let converter;
    let target;
    let code;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
    });

    describe('control_wait', () => {
        test('invalid', async () => {
            const cases = [
                'sleep',
                'sleep()',
                'sleep(abc)',
                'sleep("abc")',
                'sleep(1, 2)'
            ];
            for (const c of cases) {
                await convertAndExpectRubyBlockError(converter, target, c);
            }
        });
    });

    describe('control_repeat', () => {
        test('invalid', async () => {
            const cases1 = [
                '10.times',
                '10.times(1)'
            ];
            for (const c of cases1) {
                await convertAndExpectRubyBlockError(converter, target, c);
            }

            const cases2 = [
                '10.times { |i| }',
                '"10".times { }'
            ];
            for (const c of cases2) {
                await convertAndExpectRubyBlockError(converter, target, c);
            }
        });

        describe('repeat', () => {
            test('invalid', async () => {
                const cases1 = [
                    'repeat(10)',
                    'repeat(10, 1)'
                ];
                for (const c of cases1) {
                    await convertAndExpectRubyBlockError(converter, target, c);
                }

                const cases2 = [
                    'repeat(10) { |i| }',
                    'repeat("10") { }'
                ];
                for (const c of cases2) {
                    await convertAndExpectRubyBlockError(converter, target, c);
                }
            });
        });
    });

    describe('control_forever', () => {
        test('invalid', async () => {
            const cases1 = [
                'loop()',
                'loop(1)',
                'forever()',
                'forever(1)'
            ];
            for (const s of cases1) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                'loop { |a| bounce_if_on_edge; wait }',
                'loop(1) { bounce_if_on_edge; wait }',
                'forever(1) { bounce_if_on_edge }',
                'forever(1) { |a| bounce_if_on_edge }'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });
    });

    describe('control_if', () => {
        test('error', async () => {
            code = `
                if move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/condition is not boolean: move\(10\)/);
            expect(res).toBeFalsy();
        });
    });

    describe('control_if_else', () => {
        test('error', async () => {
            code = `
                if move(10)
                else
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/condition is not boolean: move\(10\)/);
            expect(res).toBeFalsy();
        });
    });

    describe('if...elsif...end', () => {
        test('elsif only', async () => {
            code = `
                if x == 1
                  move(10)
                elsif x == 2
                  move(20)
                end
            `;
            const expected = await rubyToExpected(converter, target, 'if x == 1; move(10); else; if x == 2; move(20); end; end');
            expected[0].comment = {
                text: '@ruby:syntax:elsif:1',
                minimized: true
            };
            expected[0].branches[1].comment = {
                text: '@ruby:syntax:elsif:1',
                minimized: true
            };
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('elsif + else', async () => {
            code = `
                if x == 1
                  move(10)
                elsif x == 2
                  move(20)
                else
                  move(30)
                end
            `;
            const expected = await rubyToExpected(converter, target, 'if x == 1; move(10); else; if x == 2; move(20); else; move(30); end; end');
            expected[0].comment = {
                text: '@ruby:syntax:elsif:1',
                minimized: true
            };
            expected[0].branches[1].comment = {
                text: '@ruby:syntax:elsif:1',
                minimized: true
            };
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('multiple elsif', async () => {
            code = `
                if x == 1
                  move(10)
                elsif x == 2
                  move(20)
                elsif x == 3
                  move(30)
                else
                  move(40)
                end
            `;
            const expected = await rubyToExpected(converter, target, 'if x == 1; move(10); else; if x == 2; move(20); else; if x == 3; move(30); else; move(40); end; end; end');
            expected[0].comment = {
                text: '@ruby:syntax:elsif:1',
                minimized: true
            };
            expected[0].branches[1].comment = {
                text: '@ruby:syntax:elsif:1',
                minimized: true
            };
            expected[0].branches[1].branches[1].comment = {
                text: '@ruby:syntax:elsif:1',
                minimized: true
            };
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('case...when...end', () => {
        test('case only', async () => {
            code = `
                case @a
                when 1
                  move(10)
                end
            `;
            const expected = await rubyToExpected(converter, target, 'if @a == 1; move(10); end');
            expected[0].comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            expected[0].inputs.find(i => i.name === 'CONDITION').block.comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('case + else', async () => {
            code = `
                case @a
                when 1
                  move(10)
                else
                  move(20)
                end
            `;
            const expected = await rubyToExpected(converter, target, 'if @a == 1; move(10); else; move(20); end');
            expected[0].comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            expected[0].inputs.find(i => i.name === 'CONDITION').block.comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('case + multiple when + else', async () => {
            code = `
                case @a
                when 1
                  move(10)
                when 2
                  move(20)
                else
                  move(30)
                end
            `;
            const expected = await rubyToExpected(converter, target, 'if @a == 1; move(10); else; if @a == 2; move(20); else; move(30); end; end');
            expected[0].comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            expected[0].inputs.find(i => i.name === 'CONDITION').block.comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            expected[0].branches[1].comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            expected[0].branches[1].inputs.find(i => i.name === 'CONDITION').block.comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('multiple case', async () => {
            code = `
                case @a
                when 1
                  move(10)
                end
                case @b
                when 2
                  move(20)
                end
            `;
            const expected1 = await rubyToExpected(converter, target, 'if @a == 1; move(10); end');
            expected1[0].comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };
            expected1[0].inputs.find(i => i.name === 'CONDITION').block.comment = {
                text: '@ruby:syntax:case:@a:1',
                minimized: true
            };

            const expected2 = await rubyToExpected(converter, target, 'if @b == 2; move(20); end');
            expected2[0].comment = {
                text: '@ruby:syntax:case:@b:2',
                minimized: true
            };
            expected2[0].inputs.find(i => i.name === 'CONDITION').block.comment = {
                text: '@ruby:syntax:case:@b:2',
                minimized: true
            };
            expected1[0].next = expected2[0];
            await convertAndExpectToEqualBlocks(converter, target, code, [expected1[0]]);
        });
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
                expect(converter.errors[0].text).toMatch(/"\{SOURCE\}" is the wrong instruction\./);
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
