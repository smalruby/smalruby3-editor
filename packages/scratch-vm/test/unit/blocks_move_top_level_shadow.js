// === Smalruby: This file is Smalruby-specific (regression tests for upstream
// commit ae67b9bf "fix bug that could result in the VM's representation of
// shadow blocks getting into a bad state", released in scratch-editor
// v14.1.0 — issue #710) ===
const test = require('tap').test;
const Blocks = require('../../src/engine/blocks');

const makeRuntime = () => ({
    emitProjectChanged: () => {},
    requestBlocksUpdate: () => {},
    getTargetForStage: () => null,
    getEditingTarget: () => null,
    monitorBlocks: { changeBlock: () => {} },
});

const createProgram = (blocks) => {
    blocks.createBlock({
        id: 'hat1',
        opcode: 'event_whenflagclicked',
        next: 'move1',
        parent: null,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: true,
        x: 0,
        y: 0,
    });
    blocks.createBlock({
        id: 'move1',
        opcode: 'motion_movesteps',
        next: null,
        parent: 'hat1',
        inputs: { STEPS: { name: 'STEPS', block: 'steps1', shadow: 'steps1' } },
        fields: {},
        shadow: false,
        topLevel: false,
    });
    blocks.createBlock({
        id: 'steps1',
        opcode: 'math_number',
        next: null,
        parent: 'move1',
        inputs: {},
        fields: { NUM: { name: 'NUM', value: '10' } },
        shadow: true,
        topLevel: false,
    });
};

test('moveBlock must not promote a shadow block to a top-level script', (t) => {
    const blocks = new Blocks(makeRuntime());
    createProgram(blocks);

    // Blockly v12 can emit a move event for a shadow block with no new
    // parent. Promoting it into _scripts makes toXML() emit a top-level
    // <shadow> element, which Blockly rejects with "Shadow block cannot
    // be a top-level block" — clearing the whole workspace on the next
    // reload while the VM data stays intact (issue #710).
    blocks.blocklyListen({
        type: 'move',
        blockId: 'steps1',
        oldParentId: 'move1',
        oldInputName: 'STEPS',
        // no newParentId
    });

    t.notOk(blocks.getScripts().includes('steps1'), 'shadow not in scripts');
    t.equal(blocks._blocks.steps1.topLevel, false, 'shadow not topLevel');
    t.ok(
        blocks.getScripts().every((id) => !blocks._blocks[id].shadow),
        'no script id refers to a shadow block',
    );
    t.end();
});

test('moveBlock keeps the shadow parent when the shadow itself moves', (t) => {
    const blocks = new Blocks(makeRuntime());
    createProgram(blocks);

    blocks.blocklyListen({
        type: 'move',
        blockId: 'steps1',
        oldParentId: 'move1',
        oldInputName: 'STEPS',
    });

    // The unconditional outer `parent = null` (pre-upstream-fix layout)
    // would clear the shadow's parent even though the input still
    // references it as its shadow.
    t.equal(blocks._blocks.steps1.parent, 'move1', 'shadow keeps its parent');
    t.equal(blocks._blocks.move1.inputs.STEPS.shadow, 'steps1', 'input still references the shadow');
    t.end();
});

test('moveBlock still promotes a regular block to top-level', (t) => {
    const blocks = new Blocks(makeRuntime());
    createProgram(blocks);

    // Detach move1 from hat1's next connection — a normal drag-out.
    blocks.blocklyListen({
        type: 'move',
        blockId: 'move1',
        oldParentId: 'hat1',
        newCoordinate: { x: 100, y: 100 },
        // no newParentId → becomes its own script
    });

    t.ok(blocks.getScripts().includes('move1'), 'regular block added to scripts');
    t.equal(blocks._blocks.move1.topLevel, true, 'regular block topLevel');
    t.equal(blocks._blocks.move1.parent, null, 'detached block parent cleared');
    t.equal(blocks._blocks.hat1.next, null, 'old parent next cleared');
    t.end();
});
