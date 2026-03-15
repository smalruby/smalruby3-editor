import RubyGenerator from '../../../../src/lib/ruby-generator';

/**
 * Helper to create a minimal mock target with blocks and comments.
 */
const createMockTarget = (blocks = {}, comments = {}) => ({
    sprite: {name: 'Sprite1'},
    comments,
    blocks: {
        getBlock: id => blocks[id] || null,
        getInputs: block => block.inputs || {},
        getScripts: () => []
    },
    variables: {}
});

describe('RubyGenerator scrub_', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
    });

    test('returns empty string for null code', () => {
        const target = createMockTarget();
        RubyGenerator.currentTarget = target;

        const block = {id: 'b1', inputs: {}, parent: null};
        expect(RubyGenerator.scrub_(block, null)).toEqual('');
    });

    test('returns code as-is for simple block with no next/comments', () => {
        const block = {id: 'b1', inputs: {}, parent: null, next: null};
        const blocks = {b1: block};
        const target = createMockTarget(blocks);
        RubyGenerator.currentTarget = target;

        expect(RubyGenerator.scrub_(block, 'move 10\n')).toEqual('move 10\n');
    });

    test('prepends block comment', () => {
        const block = {id: 'b1', inputs: {}, parent: null, next: null};
        const blocks = {b1: block};
        const comments = {c1: {blockId: 'b1', text: 'my comment'}};
        const target = createMockTarget(blocks, comments);
        RubyGenerator.currentTarget = target;

        const result = RubyGenerator.scrub_(block, 'move 10\n');
        expect(result).toEqual('# my comment\nmove 10\n');
    });

    test('filters @ruby: directive lines from comments', () => {
        const block = {id: 'b1', inputs: {}, parent: null, next: null};
        const blocks = {b1: block};
        const comments = {c1: {blockId: 'b1', text: '@ruby:operator:+=:index\nvisible comment'}};
        const target = createMockTarget(blocks, comments);
        RubyGenerator.currentTarget = target;

        const result = RubyGenerator.scrub_(block, 'code\n');
        expect(result).toEqual('# visible comment\ncode\n');
    });

    test('adds end and indents next for isStatement blocks', () => {
        const nextBlock = {id: 'b2', opcode: 'motion_movesteps', inputs: {}, parent: 'b1', next: null};
        const block = {id: 'b1', inputs: {}, parent: null, next: 'b2', isStatement: true};
        const blocks = {b1: block, b2: nextBlock};
        const target = createMockTarget(blocks);
        RubyGenerator.currentTarget = target;

        // Mock the opcode handler for next block
        const origHandler = RubyGenerator.motion_movesteps;
        RubyGenerator.motion_movesteps = () => 'inner\n';
        try {
            const result = RubyGenerator.scrub_(block, 'if true\n');
            expect(result).toContain('if true\n');
            expect(result).toContain('  inner\n');
            expect(result).toContain('end\n');
        } finally {
            RubyGenerator.motion_movesteps = origHandler;
        }
    });

    test('skips next chain when _skipNextInScrub is set', () => {
        const nextBlock = {id: 'b2', opcode: 'motion_movesteps', inputs: {}, parent: 'b1', next: null};
        const block = {id: 'b1', inputs: {}, parent: null, next: 'b2', _skipNextInScrub: true};
        const blocks = {b1: block, b2: nextBlock};
        const target = createMockTarget(blocks);
        RubyGenerator.currentTarget = target;

        const result = RubyGenerator.scrub_(block, 'def foo\n');
        expect(result).toEqual('def foo\n');
        expect(block._skipNextInScrub).toBeUndefined();
    });

    test('inline comment appended to code line', () => {
        const block = {id: 'b1', inputs: {}, parent: null, next: null};
        const blocks = {b1: block};
        const comments = {c1: {blockId: 'b1', text: '@ruby:comment_position:inline\nside note'}};
        const target = createMockTarget(blocks, comments);
        RubyGenerator.currentTarget = target;

        const result = RubyGenerator.scrub_(block, 'x = 1\n');
        expect(result).toEqual('x = 1 # side note\n');
    });
});
