import Blocks from '@smalruby/scratch-vm/src/engine/blocks';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('Ruby Comment Round Trip', () => {
    let converter;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
    });

    const expectRoundTrip = async (code, expectedRuby = null) => {
        const result = await converter.targetCodeToBlocks(null, code);
        expect(converter.errors).toHaveLength(0);
        expect(result).toBeTruthy();

        const blocks = new Blocks();
        blocks.forceNoGlow = true;
        Object.keys(converter.blocks).forEach(blockId => {
            blocks.createBlock(converter.blocks[blockId]);
        });

        const variables = {};
        [converter.variables, converter._context.localVariables].forEach(vars => {
            Object.values(vars).forEach(v => {
                variables[v.id] = v;
            });
        });

        const lists = {};
        Object.values(converter.lists).forEach(v => {
            lists[v.id] = v;
        });

        const target = {
            id: 'target-id',
            blocks: blocks,
            variables: variables,
            lists: lists,
            comments: converter._context.comments,
            isStage: false,
            lookupVariableById: id => variables[id],
            lookupVariableByNameAndType: (name, type) => {
                return Object.values(variables).find(v => v.name === name && v.type === type);
            }
        };

        RubyGenerator.init({version: '2'});
        RubyGenerator.currentTarget = target;

        const generatedRuby = RubyGenerator.targetToCode(target, {version: '2'});
        expect(generatedRuby.trim()).toEqual((expectedRuby || code).trim());
    };

    test('comment before a statement is preserved', async () => {
        await expectRoundTrip('# move forward\nmove(10)');
    });

    test('multiple consecutive comments before a statement', async () => {
        await expectRoundTrip('# first comment\n# second comment\nmove(10)');
    });

    test('inline comment is preserved', async () => {
        await expectRoundTrip('move(10) # move forward');
    });

    test('comment-only code (target-level)', async () => {
        // Comment-only code produces no blocks, but comments are preserved as target-level
        const code = '# just a comment';
        const result = await converter.targetCodeToBlocks(null, code);
        expect(result).toBeTruthy();

        const comments = converter._context.comments;
        const commentValues = Object.values(comments);
        const targetComments = commentValues.filter(c => c.blockId === null && !c.text.startsWith('@ruby:'));
        expect(targetComments).toHaveLength(1);
        expect(targetComments[0].text).toBe('just a comment');

        // Generator should output target-level comments
        const blocks = new Blocks();
        blocks.forceNoGlow = true;
        const target = {
            id: 'target-id',
            blocks: blocks,
            variables: {},
            lists: {},
            comments: comments,
            isStage: false,
            lookupVariableById: () => null,
            lookupVariableByNameAndType: () => null
        };
        RubyGenerator.init({version: '2'});
        RubyGenerator.currentTarget = target;
        const generatedRuby = RubyGenerator.targetToCode(target, {version: '2'});
        expect(generatedRuby.trim()).toEqual('# just a comment');
    });

    test('code without comments still works (regression)', async () => {
        await expectRoundTrip('move(10)');
    });

    test('comment before class definition is preserved', async () => {
        const code = '# class description\nclass Sprite1\n  when_flag_clicked do\n    move(10)\n  end\nend';
        const result = await converter.targetCodeToBlocks(null, code);
        expect(converter.errors).toHaveLength(0);
        expect(result).toBeTruthy();

        // Verify comment is stored
        const comments = converter._context.comments;
        const commentValues = Object.values(comments);
        const hasClassDescription = commentValues.some(c => c.text.includes('class description'));
        expect(hasClassDescription).toBe(true);

        // For full round-trip with class, a proper sprite target mock would be needed.
        // Here we verify the comment is preserved through the converter.
    });
});
