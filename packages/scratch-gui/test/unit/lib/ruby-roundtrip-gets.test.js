import RubyGenerator from '../../../src/lib/ruby-generator';
import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

describe('Ruby Roundtrip Gets', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = {
            isStage: false,
            variables: {},
            getCostumes: () => [{ name: 'costume1' }],
            blocks: {
                _blocks: {},
                createBlock: function (block) {
                    this._blocks[block.id] = block;
                },
                deleteBlock: function (id) {
                    delete this._blocks[id];
                },
                getBlock: function (id) {
                    return this._blocks[id];
                },
                getScripts: function () {
                    return Object.keys(this._blocks).filter(id => this._blocks[id].topLevel);
                },
                getNextBlock: function (id) {
                    return this._blocks[id].next;
                },
                getOpcode: function (block) {
                    return block.opcode;
                },
                getFields: function (block) {
                    return block.fields;
                },
                getInputs: function (block) {
                    return block.inputs;
                },
                getMutation: function (block) {
                    return block.mutation;
                },
                getBranch: function (id, branchNum) {
                    return null;
                },
                getComment: function (id) {
                    return target.comments[id];
                },
            },
            createComment: function (id, blockId, text) {
                this.comments[id] = { id, blockId, text };
            },
            comments: {},
            lookupVariableByNameAndType: function (name, type) {
                return Object.values(this.variables).find(v => v.name === name && v.type === type);
            },
        };

        RubyGenerator.init();
        RubyGenerator.currentTarget = target;
    });

    const roundtrip = async code => {
        converter.reset();
        const res = await converter.targetCodeToBlocks(target, code);
        if (!res) {
            throw new Error(`Conversion failed: ${JSON.stringify(converter.errors)}`);
        }

        target.blocks._blocks = converter._context.blocks;
        target.comments = converter._context.comments;

        // RubyGenerator uses its own block accessors
        RubyGenerator.getBlock = id => target.blocks.getBlock(id);
        RubyGenerator.getInputs = block => target.blocks.getInputs(block);
        RubyGenerator.getFields = block => target.blocks.getFields(block);
        RubyGenerator.getMutation = block => target.blocks.getMutation(block);
        RubyGenerator.getNextBlock = id => target.blocks.getNextBlock(id);
        RubyGenerator.getCommentText = block => {
            if (block.comment) {
                return target.comments[block.comment].text;
            }
            return null;
        };

        const topLevelBlocks = target.blocks.getScripts();
        let generatedCode = '';
        topLevelBlocks.forEach(blockId => {
            generatedCode += RubyGenerator.blockToCode(target.blocks.getBlock(blockId));
        });

        return generatedCode.trim();
    };

    test('text = gets', async () => {
        const code = 'text = gets';
        expect(await roundtrip(code)).toBe('text = gets');
    });

    test('puts(gets)', async () => {
        const code = 'puts(gets)';
        expect(await roundtrip(code)).toBe('puts(gets)');
    });

    test('multiple gets', async () => {
        const code = 'a = gets\nb = gets';
        expect(await roundtrip(code)).toBe('a = gets\nb = gets');
    });
});
