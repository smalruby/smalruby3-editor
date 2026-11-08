import { editorErrors, makeRubyTabAdapterFactory } from '../../../src/lib/genai-ruby-adapter.js';

const makeTarget = ({ id, name, isStage = false, code = '', sounds = [], costumes = [] }) => ({
    id,
    isStage,
    isOriginal: true,
    code,
    getName: () => name,
    getSounds: () => sounds.map((n) => ({ name: n })),
    getCostumes: () => costumes.map((n) => ({ name: n })),
    blocks: { _blocks: {} },
});

// A Monaco editor with one model whose edits can be taken back.
const makeEditor = (value) => {
    const undo = [];
    let text = value;
    return {
        undo,
        getValue: () => text,
        getModel: () => ({ uri: 'model', getFullModelRange: () => ({ all: true }) }),
        pushUndoStop: () => {},
        executeEdits: (source, edits) => {
            undo.push(text);
            text = edits[0].text;
        },
        undoOnce: () => {
            text = undo.pop();
        },
    };
};

const makeMonaco = (markers) => ({ editor: { getModelMarkers: () => markers } });

const fakeToBlocks = (target, code) =>
    Promise.resolve({
        result: code.trim() !== 'NG',
        errors: code.trim() === 'NG' ? [{ row: 0, column: 0, text: 'NG' }] : [],
        blocks: {},
        apply: () => Promise.resolve(),
    });

const setup = ({ mode = 'ruby', editorValue = 'move(1)\n', markers = [] } = {}) => {
    const abby = makeTarget({ id: 'a', name: 'Abby', code: 'move(0)\n', sounds: ['Pop'], costumes: ['abby-a'] });
    const dee = makeTarget({ id: 'd', name: 'Dee', code: 'say("やあ")\n' });
    const stage = makeTarget({ id: 's', name: 'Stage', isStage: true });
    const vm = { editingTarget: abby, runtime: { targets: [stage, abby, dee] } };
    const editor = makeEditor(editorValue);
    const createAdapter = makeRubyTabAdapterFactory({
        getEditor: () => editor,
        getMonaco: () => makeMonaco(markers),
        getMode: () => mode,
        deps: { toCode: (t) => t.code, toBlocks: fakeToBlocks },
    });
    return { adapter: createAdapter({ vm, intl: null, rubyVersion: '2', scratchBlocks: null }), vm, editor, dee };
};

const wrap = (code) => `▼▼\n\`\`\`ruby\n${code}\`\`\`\n▲▲`;

describe('editorErrors', () => {
    test('lists the errors of the editor by line, leaving out warnings', () => {
        const markers = [
            { severity: 8, startLineNumber: 3, message: 'b' },
            { severity: 4, startLineNumber: 1, message: 'warning' },
            { severity: 8, startLineNumber: 2, message: 'a' },
        ];
        expect(editorErrors(makeEditor(''), makeMonaco(markers))).toEqual(['2 行目: a', '3 行目: b']);
    });

    test('puts a message of several lines on one line', () => {
        const markers = [
            { severity: 8, startLineNumber: 1, message: '`)` が足りません。\n`)` を追加してください。' },
        ];
        expect(editorErrors(makeEditor(''), makeMonaco(markers))).toEqual([
            '1 行目: `)` が足りません。 `)` を追加してください。',
        ]);
    });

    test('has none without an editor', () => {
        expect(editorErrors(null, makeMonaco([]))).toEqual([]);
    });
});

describe('the Ruby tab adapter', () => {
    test('reads the sprite in the editor from the editor, with its edits', () => {
        const { adapter } = setup();
        expect(adapter.programs().find((p) => p.name === 'Abby').code).toBe('move(1)\n');
        expect(adapter.editingName()).toBe('Abby');
    });

    test('asks to fix only the sprite in the editor, with the others as reference', () => {
        const { adapter } = setup();
        const prompt = adapter.buildPrompt({ kindLabel: 'x', text: 'y', assignmentName: null });
        expect(prompt).toContain('```ruby\nmove(1)\n```');
        expect(prompt).not.toContain('move(0)');
        expect(prompt).toContain('【参考：ほかのスプライトのプログラム（直さないでください）】');
        expect(prompt).toContain('say("やあ")');
    });

    test('explains in easy words in furigana mode', () => {
        const { adapter } = setup({ mode: 'furigana' });
        expect(adapter.buildPrompt({ kindLabel: 'x', text: 'y' })).toContain('やさしいことば');
    });

    test('puts the errors of the editor in the question and starts as 「エラーが出る」', () => {
        const markers = [{ severity: 8, startLineNumber: 2, message: 'undefined method' }];
        const { adapter } = setup({ markers });
        expect(adapter.buildPrompt({ kindLabel: 'x', text: 'y' })).toContain('2 行目: undefined method');
        expect(adapter.initialTrouble()).toEqual({ kindId: 'error', text: '2 行目: undefined method' });
        expect(setup().adapter.initialTrouble()).toBeNull();
    });

    test('offers the kinds of trouble of the Ruby tab', () => {
        expect(setup().adapter.problemKinds).toContain('how-command');
    });

    test('fails an answer that changes another sprite', async () => {
        const { adapter } = setup();
        const result = await adapter.check(wrap('# 「Abby」\nmove(10)\n# 「Dee」\nmove(5)\n'));
        expect(result.ok).toBe(false);
        expect(result.problems[0]).toEqual({ type: 'otherSprite', sprite: 'Dee', only: 'Abby' });
    });

    test('puts a checked answer in the editor as one edit that can be taken back', async () => {
        const { adapter, editor, vm } = setup();
        const result = await adapter.check(wrap('move(10)\n'));
        expect(result.ok).toBe(true);
        expect(result.parts[0].target).toBe(vm.editingTarget);
        const out = await adapter.apply(result.parts);
        expect(editor.getValue()).toBe('move(10)\n');
        expect(out.snapshots).toEqual([
            { target: vm.editingTarget, name: 'Abby', before: 'move(1)\n', after: 'move(10)\n' },
        ]);
        expect(out.marks).toEqual([]);
        editor.undoOnce();
        expect(editor.getValue()).toBe('move(1)\n');
    });

    test('switches between the original and the answer in the editor, keeping the student changes', async () => {
        const { adapter, editor } = setup();
        const result = await adapter.check(wrap('move(10)\n'));
        const { snapshots } = await adapter.apply(result.parts);
        const back = await adapter.switchSides(snapshots, false);
        expect(editor.getValue()).toBe('move(1)\n');
        expect(back.snapshots[0].after).toBe('move(10)\n');
        const again = await adapter.switchSides(back.snapshots, true);
        expect(editor.getValue()).toBe('move(10)\n');
        expect(again.snapshots[0].before).toBe('move(1)\n');
    });
});
