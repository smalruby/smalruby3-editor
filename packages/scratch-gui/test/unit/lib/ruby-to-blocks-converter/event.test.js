import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Event', () => {
    let converter;
    let target;
    let code;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
    });

    describe('event_whenflagclicked', () => {
        test('invalid', async () => {
            const cases = [
                'self.when(:flag_clicked)',
                'self.when(:flag_clicked, 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                '12.when(:flag_clicked) {}'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                self.when(:flag_clicked) do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('event_whenkeypressed', () => {
        test('invalid', async () => {
            const cases = [
                'self.when(:key_pressed)',
                'self.when(:key_pressed, 1)',
                'self.when(:key_pressed, "space", 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                '12.when(:key_pressed, "space") {}'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                self.when(:key_pressed, "space") do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('event_whenthisspriteclicked', () => {
        test('invalid', async () => {
            const cases = [
                'self.when(:this_sprite_clicked)',
                'self.when(:this_sprite_clicked, 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                '12.when(:this_sprite_clicked) {}'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                self.when(:clicked) do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('event_whenstageclicked', () => {
        test('invalid', async () => {
            const cases = [
                'self.when(:stage_clicked)',
                'self.when(:stage_clicked, 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                '12.when(:stage_clicked) {}'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('error', async () => {
            code = `
                self.when(:stage_clicked) do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(res).toBeFalsy();
        });
    });

    describe('event_whenbackdropswitchesto', () => {
        test('invalid', async () => {
            const cases = [
                'self.when(:backdrop_switches_to)',
                'self.when(:backdrop_switches_to, 1)',
                'self.when(:backdrop_switches_to, "backdrop1", 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                '12.when(:backdrop_switches_to, "backdrop1") {}'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('error', async () => {
            code = `
                self.when(:backdrop_switches_to, "backdrop1") do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(res).toBeFalsy();
        });
    });

    describe('event_whengreaterthan', () => {
        test('invalid', async () => {
            const cases = [
                'self.when(:greater_than)',
                'self.when(:greater_than, 1)',
                'self.when(:greater_than, "loudness", 1)',
                'self.when(:greater_than, "loudness", 10, 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                '12.when(:greater_than, "loudness", 10) {}'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                self.when(:greater_than, "loudness", 10) do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('event_whenbroadcastreceived', () => {
        test('invalid', async () => {
            const cases = [
                'self.when(:receive)',
                'self.when(:receive, 1)',
                'self.when(:receive, "msg1", 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }

            const cases2 = [
                '12.when(:receive, "msg1") {}'
            ];
            for (const s of cases2) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                self.when(:receive, "msg1") do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('event_broadcast', () => {
        test('invalid', async () => {
            const cases = [
                'broadcast',
                'broadcast()',
                'broadcast(1)',
                'broadcast("msg1", 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });
    });

    describe('event_broadcastandwait', () => {
        test('invalid', async () => {
            const cases = [
                'broadcast_and_wait',
                'broadcast_and_wait()',
                'broadcast_and_wait(1)',
                'broadcast_and_wait("msg1", 1)'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });
    });
});
