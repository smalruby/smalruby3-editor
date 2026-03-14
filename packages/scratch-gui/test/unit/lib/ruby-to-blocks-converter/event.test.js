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
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
    });

    describe('event_whenflagclicked', () => {
        test('invalid', async () => {
            const cases = [
                'when_flag_clicked',
                'when_flag_clicked(1) {}'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                when_flag_clicked do
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
                'when_key_pressed',
                'when_key_pressed(1) {}',
                'when_key_pressed("space", 1) {}'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                when_key_pressed("space") do
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
                'when_clicked',
                'when_clicked(1) {}'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                when_clicked do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('event_whenstageclicked', () => {
        test('valid with stage target', async () => {
            const stageTarget = {isStage: true};
            code = `
                when_clicked do
                  switch_backdrop("backdrop1")
                end
            `;
            const res = await converter.targetCodeToBlocks(stageTarget, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('event_whenbackdropswitchesto', () => {
        test('invalid', async () => {
            const cases = [
                'when_backdrop_switches',
                'when_backdrop_switches(1) {}',
                'when_backdrop_switches("backdrop1", 1) {}'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                when_backdrop_switches("backdrop1") do
                  move(10)
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('event_whengreaterthan', () => {
        test('invalid', async () => {
            const cases = [
                'when_greater_than',
                'when_greater_than(1) {}',
                'when_greater_than("loudness", 1)',
                'when_greater_than("loudness", 10, 1) {}'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                when_greater_than("loudness", 10) do
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
                'when_receive',
                'when_receive(1) {}',
                'when_receive("msg1", 1) {}'
            ];
            for (const s of cases) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        });

        test('valid with block body', async () => {
            code = `
                when_receive("msg1") do
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
