import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectRubyBlockError
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Control', () => {
    let converter;
    let target;
    let code;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
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
            // '10.times' without block is valid (for with_screen_refresh chaining)
            const cases1 = [
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
            // 'loop()' without block is valid (for with_screen_refresh chaining)
            const cases1 = [
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
});
