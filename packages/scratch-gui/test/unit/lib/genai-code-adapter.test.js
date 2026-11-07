import {
    MARK_CLASSES,
    copyBlocks,
    createCodeTabAdapter,
    marksToShow,
    nameOf,
    programsForPrompt,
    takeoverStateOf,
} from '../../../src/lib/genai-code-adapter.js';

// A target of the VM with only what the adapter reads.
const makeTarget = ({ id, name, isStage = false, code = '', sounds = [], costumes = [], blocks = {} }) => ({
    id,
    isStage,
    isOriginal: true,
    code,
    getName: () => name,
    getSounds: () => sounds.map((n) => ({ name: n })),
    getCostumes: () => costumes.map((n) => ({ name: n })),
    blocks: { _blocks: blocks },
});

const makeVm = (targets, editing) => {
    const listeners = {};
    return {
        editingTarget: editing,
        runtime: { targets, getTargetForStage: () => targets.find((t) => t.isStage) },
        on: (name, fn) => {
            listeners[name] = (listeners[name] || []).concat(fn);
        },
        removeListener: (name, fn) => {
            listeners[name] = (listeners[name] || []).filter((f) => f !== fn);
        },
        listeners,
    };
};

// A converter stand-in: the code becomes one block (or a failure for 'NG').
const fakeToBlocks = (target, code) =>
    Promise.resolve({
        result: code !== 'NG',
        errors: code === 'NG' ? [{ row: 0, column: 0, text: 'NG' }] : [],
        blocks: code ? { b1: { id: 'b1', opcode: 'motion_movesteps', topLevel: true } } : {},
        apply: () => {
            target.blocks._blocks = code ? { b1: { id: 'b1', opcode: 'motion_movesteps', topLevel: true } } : {};
            target.code = code;
            return Promise.resolve();
        },
    });

const deps = { toCode: (t) => t.code, toBlocks: fakeToBlocks };

describe('nameOf', () => {
    test('calls the stage 「ステージ」', () => {
        expect(nameOf(makeTarget({ name: 'Stage', isStage: true }))).toBe('ステージ');
        expect(nameOf(makeTarget({ name: 'Abby' }))).toBe('Abby');
    });
});

describe('programsForPrompt', () => {
    test('keeps the programs with code and the sprite in the editor', () => {
        const programs = [
            { name: 'Abby', code: 'move(10)\n' },
            { name: 'Dee', code: '  \n' },
            { name: 'Cat', code: '' },
        ];
        expect(programsForPrompt(programs, 'Cat').map((p) => p.name)).toEqual(['Abby', 'Cat']);
    });
});

describe('marksToShow', () => {
    const abby = {};
    const dee = {};
    test('prefers the sprite in the editor and leaves removed blocks out', () => {
        const marks = [
            { target: abby, changes: [{ kind: 'added', id: 'a' }] },
            {
                target: dee,
                changes: [
                    { kind: 'removed', id: 'r' },
                    { kind: 'changed', id: 'c' },
                ],
            },
        ];
        expect(marksToShow(marks, dee)).toEqual({ owner: dee, ids: ['c'] });
        expect(marksToShow(marks, null)).toEqual({ owner: abby, ids: ['a'] });
    });

    test('shows nothing when only removed blocks are marked', () => {
        expect(marksToShow([{ target: abby, changes: [{ kind: 'removed', id: 'r' }] }], abby)).toEqual({
            owner: null,
            ids: [],
        });
    });
});

describe('takeoverStateOf', () => {
    test('leaves out the names the relay refuses', () => {
        const long = 'x'.repeat(101);
        const sprite = makeTarget({ name: 'Abby', sounds: ['Pop', 'a\nb'], costumes: [long, 'abby-a'] });
        const stage = makeTarget({ name: 'Stage', isStage: true, costumes: ['背景1'] });
        expect(takeoverStateOf(makeVm([stage, sprite], sprite))).toEqual({
            sprite: { name: 'Abby', costumes: [{ name: 'abby-a' }], sounds: [{ name: 'Pop' }] },
            stage: { costumes: [{ name: '背景1' }], sounds: [] },
        });
    });
});

describe('copyBlocks', () => {
    test('copies each block so changing the target leaves the copy intact', () => {
        const target = makeTarget({ name: 'Abby', blocks: { b: { id: 'b', opcode: 'x' } } });
        const copy = copyBlocks(target);
        target.blocks._blocks.b.opcode = 'y';
        expect(copy.b.opcode).toBe('x');
    });
});

describe('createCodeTabAdapter', () => {
    const setup = () => {
        const stage = makeTarget({ id: 's', name: 'Stage', isStage: true, costumes: ['背景1'] });
        const abby = makeTarget({ id: 'a', name: 'Abby', code: '', sounds: ['Pop'], costumes: ['abby-a'] });
        const vm = makeVm([stage, abby], abby);
        const adapter = createCodeTabAdapter({ vm, intl: null, rubyVersion: '2', scratchBlocks: null, deps });
        return { stage, abby, vm, adapter };
    };

    test('reads every target as a program and names the sprite in the editor', () => {
        const { adapter } = setup();
        expect(adapter.programs()).toEqual([
            { name: 'ステージ', code: '', sounds: [], costumes: ['背景1'] },
            { name: 'Abby', code: '', sounds: ['Pop'], costumes: ['abby-a'] },
        ]);
        expect(adapter.editingName()).toBe('Abby');
    });

    test('puts the sprite in the editor in the question even without code', () => {
        const { adapter } = setup();
        const prompt = adapter.buildPrompt({
            kindLabel: '思ったとおりに動かない',
            text: '動かない',
            assignmentName: null,
        });
        expect(prompt).toContain('Abby');
        expect(prompt).toContain('動かない');
    });

    test('checks an answer and tells the target and what it adds', async () => {
        const { abby, adapter } = setup();
        const result = await adapter.check('```ruby\nmove(10)\n```');
        expect(result.ok).toBe(true);
        expect(result.parts).toHaveLength(1);
        expect(result.parts[0].target).toBe(abby);
        expect(result.parts[0].changes.map((c) => c.kind)).toEqual(['added']);
    });

    test('puts the answer in and switches back to the original', async () => {
        const { abby, adapter } = setup();
        const result = await adapter.check('```ruby\nmove(10)\n```');
        const applied = await adapter.apply(result.parts);
        expect(applied.snapshots).toEqual([{ target: abby, name: 'Abby', before: '', after: result.parts[0].code }]);
        expect(applied.marks[0].changes.map((c) => c.kind)).toEqual(['added']);
        expect(abby.code).toBe(result.parts[0].code);

        const back = await adapter.switchSides(applied.snapshots, false);
        expect(abby.code).toBe('');
        expect(back.snapshots[0].after).toBe(result.parts[0].code);
        // Going back removes what the AI's version added (the panel does not mark the original).
        expect(back.marks[0].changes.map((c) => c.kind)).toEqual(['removed']);
    });

    test('marks nothing without an editor', () => {
        const { adapter } = setup();
        const stop = adapter.watchMarks([]);
        expect(typeof stop).toBe('function');
        stop();
    });

    test('marks the changes of the sprite in the editor and takes them away', () => {
        const stage = makeTarget({ id: 's', name: 'Stage', isStage: true });
        const abby = makeTarget({ id: 'a', name: 'Abby' });
        const vm = makeVm([stage, abby], abby);
        const classes = new Set();
        const block = { addClass: (c) => classes.add(c), removeClass: (c) => classes.delete(c) };
        const workspace = { getBlockById: (id) => (id === 'b1' ? block : null) };
        const scratchBlocks = { getMainWorkspace: () => workspace };
        const adapter = createCodeTabAdapter({ vm, intl: null, rubyVersion: '2', scratchBlocks, deps });
        const stop = adapter.watchMarks([{ target: abby, changes: [{ kind: 'added', id: 'b1' }] }]);
        expect([...classes]).toEqual([MARK_CLASSES.added]);
        expect(vm.listeners.workspaceUpdate).toHaveLength(1);
        stop();
        expect([...classes]).toEqual([]);
        expect(vm.listeners.workspaceUpdate).toHaveLength(0);
    });
});
