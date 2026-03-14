import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {loadPrism} from '../../../../src/lib/prism-parser';

describe('RubyToBlocksConverter comment extraction', () => {
    let converter;
    let prism;

    beforeAll(async () => {
        prism = await loadPrism();
    });

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        converter.reset();
    });

    describe('_extractSourceComments', () => {
        test('should extract inline comments with line numbers', () => {
            const code = '# top comment\nmove(10)';
            const parseResult = prism.parse(code);

            const comments = converter._extractSourceComments(parseResult, code);

            expect(comments).toHaveLength(1);
            expect(comments[0]).toMatchObject({
                type: 'inline',
                text: 'top comment',
                line: 1,
                isTrailing: false
            });
        });

        test('should extract multiple consecutive comments', () => {
            const code = '# first\n# second\nmove(10)';
            const parseResult = prism.parse(code);

            const comments = converter._extractSourceComments(parseResult, code);

            expect(comments).toHaveLength(2);
            expect(comments[0]).toMatchObject({type: 'inline', text: 'first', line: 1});
            expect(comments[1]).toMatchObject({type: 'inline', text: 'second', line: 2});
        });

        test('should detect trailing comments (inline after code)', () => {
            const code = 'move(10) # inline comment';
            const parseResult = prism.parse(code);

            const comments = converter._extractSourceComments(parseResult, code);

            expect(comments).toHaveLength(1);
            expect(comments[0]).toMatchObject({
                type: 'inline',
                text: 'inline comment',
                line: 1,
                isTrailing: true
            });
        });

        test('should extract =begin...=end block comments', () => {
            const code = '=begin\nblock comment\nmore text\n=end\nmove(10)';
            const parseResult = prism.parse(code);

            const comments = converter._extractSourceComments(parseResult, code);

            expect(comments).toHaveLength(1);
            expect(comments[0]).toMatchObject({
                type: 'embdoc',
                text: 'block comment\nmore text',
                line: 1,
                isTrailing: false
            });
        });

        test('should handle comments at various positions', () => {
            const code = '# before class\nclass Foo\n  # inside class\n  move(10) # inline\nend';
            const parseResult = prism.parse(code);

            const comments = converter._extractSourceComments(parseResult, code);

            expect(comments).toHaveLength(3);
            expect(comments[0]).toMatchObject({text: 'before class', line: 1, isTrailing: false});
            expect(comments[1]).toMatchObject({text: 'inside class', line: 3, isTrailing: false});
            expect(comments[2]).toMatchObject({text: 'inline', line: 4, isTrailing: true});
        });

        test('should return empty array when no comments', () => {
            const code = 'move(10)';
            const parseResult = prism.parse(code);

            const comments = converter._extractSourceComments(parseResult, code);

            expect(comments).toHaveLength(0);
        });

        test('should strip leading space from comment text', () => {
            const code = '#no space\n# one space\n#  two spaces';
            const parseResult = prism.parse(code);

            const comments = converter._extractSourceComments(parseResult, code);

            expect(comments[0].text).toBe('no space');
            expect(comments[1].text).toBe('one space');
            expect(comments[2].text).toBe(' two spaces');
        });
    });
});
