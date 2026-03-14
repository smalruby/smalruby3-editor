import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectRubyBlockError
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Ruby', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    test('ruby_range', async () => {
        const code = '1..10';
        await convertAndExpectRubyBlockError(converter, target, code);
    });

    test('ruby_exclude_range', async () => {
        const code = '1...10';
        await convertAndExpectRubyBlockError(converter, target, code);
    });

    test('ruby_statement(wait)', async () => {
        { for (const s of [
            'wait',
            'wait()',
            'wait(  )',
            'wait(\n)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('ruby_statement_with_block', async () => {
        const code = `
            method_call(1) do |arg1, arg2|
              move(arg1)
              move(arg2)
              move(10)
            end
        `;
        await convertAndExpectRubyBlockError(converter, target, code);
    });
});
