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

    describe('sensing_current', () => {
        describe('normal', () => {
            const currentMenuToMethod = {
                YEAR: 'year',
                MONTH: 'month',
                DATE: 'day',
                DAYOFWEEK: 'wday + 1',
                HOUR: 'hour',
                MINUTE: 'min',
                SECOND: 'sec'
            };
            Object.keys(currentMenuToMethod).forEach(fieldValue => {
                const method = currentMenuToMethod[fieldValue];
                test(method, async () => {
                    code = `Time.now.${method}`;
                    expected = [
                        {
                            opcode: 'sensing_current',
                            fields: [
                                {
                                    name: 'CURRENTMENU',
                                    value: fieldValue
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
                Time.now.year
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0],
                (await rubyToExpected(converter, target, 'Time.now.year'))[0],
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'Time.now(1)',
                'Time.now.year(1)',
                'Time.now.invalid'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });

        test('error', async () => {
            code = `
                forever do
                  Time.now
                end
            `;
            let res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toEqual(2);
            expect(res).toBeFalsy();

            code = `
                forever do
                  Time.now.year
                end
            `;
            res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toEqual(2);
            expect(res).toBeFalsy();
        });
    });

    expectNoArgsMethod('sensing_dayssince2000', 'days_since_2000', 'value');
    expectNoArgsMethod('sensing_online', 'online?', 'value');
    expectNoArgsMethod('sensing_username', 'user_name', 'value');

    describe('Stage/Sprite validation', () => {
        let stageTarget;

        beforeEach(() => {
            stageTarget = {
                isStage: true,
                variables: {},
                sprite: {}
            };
        });

        test('sprite-only blocks should throw error on stage', async () => {
            const spriteOnlyCommands = [
                'touching?("Sprite1")',
                'touching_color?("#ff0000")',
                'color_is_touching_color?("#ff0000", "#0000ff")',
                'distance("Sprite1")',
                'self.drag_mode = "draggable"'
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
                'ask("What is your name?")',
                'answer',
                'Keyboard.pressed?("space")',
                'Mouse.x',
                'Mouse.y',
                'Mouse.down?',
                'loudness',
                'Timer.value',
                'Timer.reset',
                'days_since_2000',
                'online?',
                'user_name'
            ];

            { for (const command of stageCommonCommands) {
                const result = await converter.targetCodeToBlocks(stageTarget, command);
                expect(result).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                converter.reset();
            } }
        });

        test('all blocks should work on sprite', async () => {
            const allCommands = [
                'touching?("Sprite1")',
                'touching_color?("#ff0000")',
                'color_is_touching_color?("#ff0000", "#0000ff")',
                'distance("Sprite1")',
                'self.drag_mode = "draggable"',
                'ask("What is your name?")',
                'answer',
                'Keyboard.pressed?("space")',
                'Mouse.x',
                'Mouse.y',
                'Mouse.down?',
                'loudness',
                'Timer.value',
                'Timer.reset',
                'days_since_2000',
                'online?',
                'user_name'
            ];

            { for (const command of allCommands) {
                const result = await converter.targetCodeToBlocks(target, command);
                expect(result).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                converter.reset();
            } }
        });
    });
});
