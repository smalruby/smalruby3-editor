import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import Blocks from '@smalruby/scratch-vm/src/engine/blocks';
import Variable from '@smalruby/scratch-vm/src/engine/variable';

// Issue #710: applyTargetBlocks deletes ALL existing blocks before creating
// the converted ones. If createBlock throws midway (or the converted graph is
// broken), the target is left with a partial/empty program while the Ruby tab
// still shows the code. These tests pin the transactional behavior: on any
// failure the target's blocks and comments must be rolled back to the
// pre-apply state and the error must propagate to the caller.
describe('RubyToBlocksConverter/TargetApplier transaction (issue #710)', () => {
    let converter;
    let target;
    let stage;
    let vm;

    const OLD_BLOCK_IDS = ['oldhat', 'oldmove', 'oldnum'];

    const createOldProgram = (blocks) => {
        blocks.createBlock({
            id: 'oldhat',
            opcode: 'event_whenflagclicked',
            next: 'oldmove',
            parent: null,
            inputs: {},
            fields: {},
            shadow: false,
            topLevel: true,
            x: 40,
            y: 40,
        });
        blocks.createBlock({
            id: 'oldmove',
            opcode: 'motion_movesteps',
            next: null,
            parent: 'oldhat',
            inputs: {
                STEPS: {name: 'STEPS', block: 'oldnum', shadow: 'oldnum'},
            },
            fields: {},
            shadow: false,
            topLevel: false,
        });
        blocks.createBlock({
            id: 'oldnum',
            opcode: 'math_number',
            next: null,
            parent: 'oldmove',
            inputs: {},
            fields: {NUM: {name: 'NUM', value: '10'}},
            shadow: true,
            topLevel: false,
        });
    };

    beforeEach(() => {
        stage = {
            blocks: new Blocks(),
            variables: {},
            isStage: true,
            createVariable: function (id, name, type) {
                this.variables[id] = new Variable(id, name, type);
            },
            lookupVariableByNameAndType: function (name, type) {
                for (const varId in this.variables) {
                    const currVar = this.variables[varId];
                    if (currVar.name === name && currVar.type === type) {
                        return currVar;
                    }
                }
                return null;
            },
        };

        const runtime = {
            emitProjectChanged: () => {},
            getTargetForStage: () => stage,
        };

        target = {
            blocks: new Blocks(runtime),
            variables: {},
            comments: {
                oldcomment: {id: 'oldcomment', blockId: null, text: 'keep me'},
            },
            isStage: false,
            createVariable: function (id, name, type) {
                if (Object.prototype.hasOwnProperty.call(this.variables, id)) {
                    return;
                }
                this.variables[id] = new Variable(id, name, type);
            },
            lookupVariableByNameAndType: function (name, type, skipStage) {
                for (const varId in this.variables) {
                    const currVar = this.variables[varId];
                    if (currVar.name === name && currVar.type === type) {
                        return currVar;
                    }
                }
                if (!skipStage) {
                    return stage.lookupVariableByNameAndType(name, type);
                }
                return null;
            },
            lookupVariableById: function (id) {
                if (Object.prototype.hasOwnProperty.call(this.variables, id)) {
                    return this.variables[id];
                }
                return null;
            },
            deleteVariable: function (id) {
                delete this.variables[id];
            },
            createComment: function (id, blockId, text, x, y, width, height, minimized) {
                this.comments[id] = {id, blockId, text, x, y, width, height, minimized};
            },
        };
        createOldProgram(target.blocks);

        vm = {
            runtime: runtime,
            emitWorkspaceUpdate: () => {},
            extensionManager: {
                isExtensionLoaded: () => true,
                loadExtensionURL: () => Promise.resolve(),
            },
        };

        converter = new RubyToBlocksConverter(vm);
    });

    test('should replace old blocks on successful apply', async () => {
        const result = await converter.targetCodeToBlocks(
            target,
            'when_flag_clicked do\n  move(10)\nend\n',
        );
        expect(result).toBe(true);

        await converter.applyTargetBlocks(target);

        const blockIds = Object.keys(target.blocks._blocks);
        expect(blockIds).not.toEqual(expect.arrayContaining(OLD_BLOCK_IDS));
        const opcodes = blockIds.map((id) => target.blocks._blocks[id].opcode);
        expect(opcodes).toEqual(
            expect.arrayContaining(['event_whenflagclicked', 'motion_movesteps']),
        );
    });

    test('should roll back blocks and comments when createBlock throws during apply', async () => {
        const result = await converter.targetCodeToBlocks(
            target,
            'when_flag_clicked do\n  move(10)\nend\n',
        );
        expect(result).toBe(true);

        // Simulate a deterministic failure while re-creating the converted
        // blocks (e.g. a converter edge case that scratch-vm rejects).
        const originalCreateBlock = target.blocks.createBlock.bind(target.blocks);
        target.blocks.createBlock = function (block) {
            if (block && block.opcode === 'event_whenflagclicked') {
                throw new Error('simulated createBlock failure');
            }
            return originalCreateBlock(block);
        };

        await expect(converter.applyTargetBlocks(target)).rejects.toThrow(
            'simulated createBlock failure',
        );

        // The old program must be fully restored — not deleted, not partial.
        expect(Object.keys(target.blocks._blocks).sort()).toEqual(
            [...OLD_BLOCK_IDS].sort(),
        );
        expect(target.blocks._blocks.oldhat.topLevel).toBe(true);
        expect(target.blocks.getScripts()).toEqual(['oldhat']);
        // Comments must be restored as well.
        expect(target.comments.oldcomment).toBeDefined();
        expect(target.comments.oldcomment.text).toBe('keep me');
    });

    test('should reject and keep old blocks when converted graph has a broken parent chain', async () => {
        const result = await converter.targetCodeToBlocks(
            target,
            'when_flag_clicked do\n  move(10)\nend\n',
        );
        expect(result).toBe(true);

        // Corrupt the converted graph: drop the hat block so the remaining
        // blocks reference a missing parent. Such a graph serializes to an
        // empty workspace even though apply "succeeds".
        const contextBlocks = converter._context.blocks;
        const hatId = Object.keys(contextBlocks).find(
            (id) => contextBlocks[id].opcode === 'event_whenflagclicked',
        );
        expect(hatId).toBeDefined();
        delete contextBlocks[hatId];

        await expect(converter.applyTargetBlocks(target)).rejects.toThrow();

        // The old program must remain untouched.
        expect(Object.keys(target.blocks._blocks).sort()).toEqual(
            [...OLD_BLOCK_IDS].sort(),
        );
        expect(target.blocks.getScripts()).toEqual(['oldhat']);
        expect(target.comments.oldcomment).toBeDefined();
    });
});
