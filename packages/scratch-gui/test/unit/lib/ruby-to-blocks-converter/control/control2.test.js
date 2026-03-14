import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected
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
});
