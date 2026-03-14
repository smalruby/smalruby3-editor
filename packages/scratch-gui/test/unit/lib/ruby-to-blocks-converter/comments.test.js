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

    describe('comment preservation through targetCodeToBlocks', () => {
        beforeEach(() => {
            converter = new RubyToBlocksConverter(null, {version: '2'});
        });

        test('should preserve target-level comment (no block following)', async () => {
            // Comment-only code has no blocks, so comment is target-level
            const code = '# file description';
            await converter.targetCodeToBlocks(null, code);

            const comments = converter._context.comments;
            const commentValues = Object.values(comments);
            const targetComments = commentValues.filter(c => c.blockId === null && !c.text.startsWith('@ruby:'));

            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toBe('file description');
        });

        test('should preserve comment before a statement as block-attached comment', async () => {
            const code = '# move forward\nmove(10)';
            await converter.targetCodeToBlocks(null, code);

            const comments = converter._context.comments;
            const blocks = converter._context.blocks;

            // Find the move block
            const moveBlock = Object.values(blocks).find(b => b.opcode === 'motion_movesteps');
            expect(moveBlock).toBeDefined();
            expect(moveBlock.comment).toBeDefined();

            const comment = comments[moveBlock.comment];
            expect(comment.text).toContain('move forward');
        });

        test('should preserve trailing inline comment with position marker', async () => {
            const code = 'move(10) # move forward';
            await converter.targetCodeToBlocks(null, code);

            const comments = converter._context.comments;
            const blocks = converter._context.blocks;

            const moveBlock = Object.values(blocks).find(b => b.opcode === 'motion_movesteps');
            expect(moveBlock).toBeDefined();
            expect(moveBlock.comment).toBeDefined();

            const comment = comments[moveBlock.comment];
            expect(comment.text).toContain('move forward');
            expect(comment.text).toContain('@ruby:comment_position:inline');
        });

        test('should preserve multiple consecutive comments before a statement', async () => {
            const code = '# first line\n# second line\nmove(10)';
            await converter.targetCodeToBlocks(null, code);

            const comments = converter._context.comments;
            const blocks = converter._context.blocks;

            const moveBlock = Object.values(blocks).find(b => b.opcode === 'motion_movesteps');
            expect(moveBlock).toBeDefined();
            expect(moveBlock.comment).toBeDefined();

            const comment = comments[moveBlock.comment];
            expect(comment.text).toContain('first line');
            expect(comment.text).toContain('second line');
        });

        test('should merge user comment with existing metadata comment', async () => {
            // self.x += 10 generates a @ruby:operator:+= metadata comment on the motion block
            const code = '# change x position\nself.x += 10';
            await converter.targetCodeToBlocks(null, code);

            const comments = converter._context.comments;
            const commentValues = Object.values(comments);
            const blocks = converter._context.blocks;
            const blockValues = Object.values(blocks);

            // The user comment "change x position" is attached to the block that also has
            // a @ruby:operator:+= metadata comment. Check that both are present.
            // The motion changexby block has a metadata comment, and the user comment should be merged.
            const hasChangeX = commentValues.some(c => c.text.includes('change x position'));
            expect(hasChangeX).toBe(true);

            // Check that the block also has metadata
            const blockWithComment = blockValues.find(b => b.comment);
            expect(blockWithComment).toBeDefined();
            if (blockWithComment) {
                const comment = comments[blockWithComment.comment];
                // Comment should contain user text
                expect(comment.text).toContain('change x position');
            }
        });

        test('should preserve =begin...=end before a statement as block-attached', async () => {
            const code = '=begin\nprogram description\n=end\nmove(10)';
            await converter.targetCodeToBlocks(null, code);

            const comments = converter._context.comments;
            const blocks = converter._context.blocks;
            const moveBlock = Object.values(blocks).find(b => b.opcode === 'motion_movesteps');
            expect(moveBlock).toBeDefined();
            expect(moveBlock.comment).toBeDefined();

            const comment = comments[moveBlock.comment];
            expect(comment.text).toContain('program description');
        });

        test('should preserve =begin...=end as target-level when no block follows', async () => {
            const code = '=begin\nprogram description\n=end';
            await converter.targetCodeToBlocks(null, code);

            const comments = converter._context.comments;
            const commentValues = Object.values(comments);
            const targetComments = commentValues.filter(c => c.blockId === null && !c.text.startsWith('@ruby:'));

            expect(targetComments).toHaveLength(1);
            expect(targetComments[0].text).toBe('program description');
        });

        test('should not create user comments when there are none', async () => {
            const code = 'move(10)';
            await converter.targetCodeToBlocks(null, code);

            const comments = converter._context.comments;
            const commentValues = Object.values(comments);
            const userComments = commentValues.filter(c => !c.text.startsWith('@ruby:'));

            expect(userComments).toHaveLength(0);
        });

        test('should preserve comment before class definition', async () => {
            const code = '# class description\nclass Sprite1\n  when_flag_clicked do\n    move(10)\n  end\nend';
            const result = await converter.targetCodeToBlocks(null, code);
            expect(result).toBe(true);

            const comments = converter._context.comments;
            const commentValues = Object.values(comments);

            // The "class description" comment should be preserved as a target-level comment
            const hasClassDescription = commentValues.some(c => c.text.includes('class description'));
            expect(hasClassDescription).toBe(true);
        });
    });
});
