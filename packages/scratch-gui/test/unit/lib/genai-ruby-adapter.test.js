import { EventEmitter } from 'events';
import { editorErrors, lineDecorations, makeRubyTabAdapterFactory } from '../../../src/lib/genai-ruby-adapter.js';
import { runTakeover } from '../../../src/lib/genai-takeover.js';

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

// A Monaco editor with one model whose edits can be taken back, and its decorations.
const makeEditor = (value) => {
    const undo = [];
    const listeners = [];
    let text = value;
    const editor = {
        undo,
        decorations: null,
        getValue: () => text,
        getModel: () => ({
            uri: 'model',
            getFullModelRange: () => ({ all: true }),
            getValueLength: () => text.length,
        }),
        pushUndoStop: () => {},
        // The whole text replaced (as the editor does for a new value), or a part of it typed.
        type: (next, whole = true) => {
            const lengthBefore = text.length;
            text = next;
            const event = { isFlush: false, changes: [{ rangeOffset: whole ? 0 : 1, rangeLength: lengthBefore }] };
            listeners.slice().forEach((listener) => listener(event));
        },
        executeEdits: (source, edits) => {
            undo.push(text);
            editor.type(edits[0].text);
        },
        undoOnce: () => {
            text = undo.pop();
        },
        createDecorationsCollection: () => {
            editor.decorations = [];
            return {
                set: (list) => {
                    editor.decorations = list;
                },
                clear: () => {
                    editor.decorations = [];
                },
                getRanges: () => (editor.decorations || []).filter((d) => d && d.range).map((d) => d.range),
            };
        },
        onDidChangeModelContent: (listener) => {
            listeners.push(listener);
            return { dispose: () => listeners.splice(listeners.indexOf(listener), 1) };
        },
    };
    return editor;
};

// The lines marked in the editor: 'line:kind'.
const markedOf = (editor) =>
    (editor.decorations || []).map((d) => `${d.range.startLineNumber}:${d.options.className}`);

const makeMonaco = (markers) => ({ editor: { getModelMarkers: () => markers } });

const fakeToBlocks = (target, code) =>
    Promise.resolve({
        // 'NG' fails (also as DNCL, which becomes the variable `@_var_NG_` in Ruby).
        result: !/^(@_var_)?NG_?$/.test(code.trim()),
        errors: /^(@_var_)?NG_?$/.test(code.trim()) ? [{ row: 0, column: 0, text: 'NG' }] : [],
        blocks: {},
        apply: () => Promise.resolve(target && target.blocks.apply && target.blocks.apply(code)),
    });

const setup = ({ mode = 'ruby', editorValue = 'move(1)\n', markers = [] } = {}) => {
    const abby = makeTarget({ id: 'a', name: 'Abby', code: 'move(0)\n', sounds: ['Pop'], costumes: ['abby-a'] });
    const dee = makeTarget({ id: 'd', name: 'Dee', code: 'say("やあ")\n' });
    const stage = makeTarget({ id: 's', name: 'Stage', isStage: true });
    // The VM still tells its own switch with targetsUpdate (setEditingTarget); the adapter
    // reads the switch of the editor from the Ruby tab instead (vm.show below, #1435).
    const vm = Object.assign(new EventEmitter(), { editingTarget: abby, runtime: { targets: [stage, abby, dee] } });
    const editor = makeEditor(editorValue);
    // The sprite the Ruby tab shows in the editor (rubyCode.target, #1435). The editor gets
    // the code of the sprite (if given) before the Ruby tab tells that it shows it.
    let shown = abby;
    const shownListeners = new Set();
    vm.show = (target, code) => {
        shown = target;
        if (typeof code === 'string') editor.type(code);
        shownListeners.forEach((listener) => listener());
    };
    // The student switches to another sprite and its code goes in the editor (when the code
    // in the editor cannot become blocks, only the VM switches: vm.editingTarget alone).
    vm.switchTo = (target, code) => {
        vm.editingTarget = target;
        vm.emit('targetsUpdate', {});
        vm.show(target, code);
    };
    const createAdapter = makeRubyTabAdapterFactory({
        getEditor: () => editor,
        getMonaco: () => makeMonaco(markers),
        getMode: () => mode,
        getEditorTarget: () => shown,
        onEditorTargetChange: (listener) => {
            shownListeners.add(listener);
            return () => shownListeners.delete(listener);
        },
        deps: { toCode: (t) => t.code, toBlocks: fakeToBlocks },
    });
    return {
        adapter: createAdapter({ vm, intl: null, rubyVersion: '2', scratchBlocks: null }),
        vm,
        editor,
        dee,
        shownListeners,
    };
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

    test('asks Rubytee to fix only the sprite in the editor, from the editor', () => {
        const { adapter } = setup();
        const exchanges = [{ question: 'q', answer: 'a', problems: ['p'] }];
        const message = adapter.takeoverMessage({ kindLabel: 'x', text: 'y', exchanges });
        expect(message).toContain('直すのは「Abby」だけです');
        expect(message).toContain('```ruby\nmove(1)\n```');
        expect(message).not.toContain('move(0)');
        expect(message).toContain('say("やあ")');
        expect(message).toContain('Ruby の書き方で');
    });

    test('asks Rubytee for easy words in furigana mode', () => {
        const { adapter } = setup({ mode: 'furigana' });
        expect(adapter.takeoverMessage({ kindLabel: 'x', text: 'y', exchanges: [] })).toContain('やさしいことば');
    });

    test('asks Rubytee again when its answer changes another sprite (relay mocked)', async () => {
        const { adapter } = setup();
        const answers = [wrap('# 「Abby」\nmove(10)\n# 「Dee」\nmove(5)\n'), wrap('# 「Abby」\nmove(10)\n')];
        const sent = [];
        const out = await runTakeover({
            first: adapter.takeoverMessage({ kindLabel: 'x', text: 'y', exchanges: [] }),
            send: (message, history) => {
                sent.push({ message, history });
                return Promise.resolve(answers[sent.length - 1]);
            },
            check: adapter.check,
            toJapanese: (problem) => `${problem.sprite} は直せません`,
        });
        expect(out.ok).toBe(true);
        expect(out.tries).toBe(2);
        expect(sent[1].message).toContain('Dee は直せません');
        expect(out.result.parts.map((part) => part.name)).toEqual(['Abby']);
    });

    // #1426: Rubytee takes minutes; the student may switch to another sprite meanwhile.
    test('checks Rubytee answers against the sprite it started with after a switch', async () => {
        const { adapter, vm, dee } = setup();
        const abby = vm.editingTarget;
        const scope = adapter.takeoverScope();
        vm.switchTo(dee);
        const result = await adapter.check(wrap('# 「Abby」\nmove(10)\n'), scope);
        expect(result.ok).toBe(true);
        expect(result.parts.map((part) => part.target)).toEqual([abby]);
        // The lines are counted from Abby's blocks, not from Dee in the editor.
        expect(result.parts[0].before).toBe('move(0)\n');
        expect(result.parts[0].lines).toEqual({ added: 0, changed: 1, removed: 0 });
    });

    test('fails a Rubytee answer for the sprite switched to', async () => {
        const { adapter, vm, dee } = setup();
        const scope = adapter.takeoverScope();
        vm.switchTo(dee);
        const result = await adapter.check(wrap('# 「Dee」\nmove(10)\n'), scope);
        expect(result.ok).toBe(false);
        expect(result.problems[0]).toEqual({ type: 'otherSprite', sprite: 'Dee', only: 'Abby' });
    });

    test('checks against the sprite in the editor when the sprite started with is deleted', async () => {
        const { adapter, vm, dee } = setup();
        const scope = adapter.takeoverScope();
        vm.runtime.targets = vm.runtime.targets.filter((t) => t !== vm.editingTarget);
        vm.switchTo(dee);
        const result = await adapter.check(wrap('move(10)\n'), scope);
        expect(result.parts.map((part) => part.target)).toEqual([dee]);
    });

    test('puts an answer for a sprite the editor no longer shows into its blocks', async () => {
        const { adapter, editor, vm, dee } = setup();
        const abby = vm.editingTarget;
        const scope = adapter.takeoverScope();
        vm.switchTo(dee);
        const loaded = [];
        abby.blocks.apply = (code) => loaded.push(code);
        const result = await adapter.check(wrap('move(10)\n'), scope);
        const out = await adapter.apply(result.parts);
        expect(loaded).toEqual(['move(10)\n']);
        // The editor showing Dee is left alone.
        expect(editor.getValue()).toBe('move(1)\n');
        expect(out.snapshots).toEqual([{ target: abby, name: 'Abby', before: 'move(0)\n', after: 'move(10)\n' }]);
        expect(out.marks[0]).toMatchObject({ target: abby, before: 'move(0)\n' });
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
        expect(out.marks).toEqual([
            {
                target: vm.editingTarget,
                name: 'Abby',
                changes: [],
                before: 'move(1)\n',
                lines: { added: 0, changed: 1, removed: 0 },
            },
        ]);
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

    test('keeps both versions of a sprite the editor no longer shows, switching its blocks', async () => {
        const { adapter, editor, vm, dee } = setup();
        const abby = vm.editingTarget;
        const result = await adapter.check(wrap('move(10)\n'));
        const { snapshots } = await adapter.apply(result.parts);
        // The student moves to Dee; Abby's blocks now have the AI's version.
        abby.code = 'move(10)\n';
        vm.switchTo(dee);
        const loaded = [];
        abby.blocks.apply = (code) => loaded.push(code);
        const back = await adapter.switchSides(snapshots, false);
        expect(back.snapshots).toEqual([{ target: abby, name: 'Abby', before: 'move(1)\n', after: 'move(10)\n' }]);
        expect(loaded).toEqual(['move(1)\n']);
        // The editor showing Dee is left alone.
        expect(editor.getValue()).toBe('move(10)\n');
    });

    test('counts the lines the answer adds, changes and removes from the code in the editor', async () => {
        const { adapter } = setup({ editorValue: 'when_flag_clicked do\n  move(1)\n  turn_right(15)\nend\n' });
        const result = await adapter.check(
            wrap('when_flag_clicked do\n  move(10)\n  say("やあ")\n  wait(1)\n  turn_right(15)\nend\n'),
        );
        expect(result.parts[0].before).toBe('when_flag_clicked do\n  move(1)\n  turn_right(15)\nend\n');
        expect(result.parts[0].lines).toEqual({ added: 2, changed: 1, removed: 0 });
        expect(result.parts[0].changes).toEqual([]);
    });

    test('marks the lines added or changed while the AI version is in, and takes them away', async () => {
        const { adapter, editor } = setup({ editorValue: 'a\nb\n' });
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        const stop = adapter.watchMarks(marks);
        expect(markedOf(editor)).toEqual(['2:genaiLineChanged', '3:genaiLineAdded']);
        stop();
        expect(markedOf(editor)).toEqual([]);
    });

    test('marks no line while the editor shows another sprite, and marks again on coming back', async () => {
        const { adapter, editor, vm, dee } = setup({ editorValue: 'a\nb\n' });
        const abby = vm.editingTarget;
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        adapter.watchMarks(marks);
        vm.switchTo(dee, 'say("やあ")\n');
        expect(markedOf(editor)).toEqual([]);
        vm.switchTo(abby, 'a\nB\nc\n');
        expect(markedOf(editor)).toEqual(['2:genaiLineChanged', '3:genaiLineAdded']);
    });

    // #1410: the editor gets no new value for a sprite whose code is the same (a duplicate).
    test('takes the marks away on a sprite with the same code, and marks again on coming back', async () => {
        const { adapter, editor, vm } = setup({ editorValue: 'a\nb\n' });
        const abby = vm.editingTarget;
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        adapter.watchMarks(marks);
        const copy = { ...abby, id: 'c', code: 'a\nB\nc\n', getName: () => 'Abby2' };
        vm.runtime.targets.push(copy);
        abby.code = 'a\nB\nc\n';
        vm.switchTo(copy);
        expect(markedOf(editor)).toEqual([]);
        vm.switchTo(abby);
        expect(markedOf(editor)).toEqual(['2:genaiLineChanged', '3:genaiLineAdded']);
    });

    test('waits for the code of the sprite switched to before marking it', async () => {
        const { adapter, editor, vm, dee } = setup({ editorValue: 'a\nb\n' });
        const abby = vm.editingTarget;
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        adapter.watchMarks(marks);
        abby.code = 'a\nB\nc\n';
        vm.switchTo(dee, 'say("やあ")\n');
        expect(markedOf(editor)).toEqual([]);
        // Back to Abby, told before the editor has its code: the editor still shows Dee's.
        vm.show(abby);
        expect(markedOf(editor)).toEqual([]);
        editor.type('a\nB\nc\n');
        expect(markedOf(editor)).toEqual(['2:genaiLineChanged', '3:genaiLineAdded']);
    });

    test('does not read the code of the sprite waited for again each time it is told', async () => {
        const { adapter, editor, vm, dee } = setup({ editorValue: 'a\nb\n' });
        const abby = vm.editingTarget;
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        adapter.watchMarks(marks);
        vm.switchTo(dee, 'say("やあ")\n');
        let reads = 0;
        let code = 'a\nB\nc\n';
        Object.defineProperty(abby, 'code', {
            get: () => {
                reads += 1;
                return code;
            },
            set: (next) => {
                code = next;
            },
        });
        vm.show(abby);
        // Told again while the editor has no new value.
        vm.show(abby);
        vm.show(abby);
        expect(reads).toBe(1);
        expect(markedOf(editor)).toEqual([]);
        editor.type('a\nB\nc\n');
        expect(markedOf(editor)).toEqual(['2:genaiLineChanged', '3:genaiLineAdded']);
        // Away and back again: the sprite is compared again.
        vm.switchTo(dee, 'say("やあ")\n');
        vm.show(abby);
        expect(reads).toBe(2);
    });

    test('stops listening to the switches once the marks are taken away', async () => {
        const { adapter, shownListeners } = setup({ editorValue: 'a\nb\n' });
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        const stop = adapter.watchMarks(marks);
        expect(shownListeners.size).toBe(1);
        stop();
        expect(shownListeners.size).toBe(0);
    });

    // #1435: when the code in the editor cannot become blocks, the Ruby tab keeps it (and
    // its sprite) in the editor while the VM switches to another sprite.
    test('reads the sprite the editor still shows, not the one the VM switched to', () => {
        const { adapter, vm, dee } = setup();
        vm.editingTarget = dee;
        expect(adapter.editingName()).toBe('Abby');
        expect(adapter.programs().map((p) => [p.name, p.code])).toEqual([
            ['ステージ', ''],
            ['Abby', 'move(1)\n'],
            ['Dee', 'say("やあ")\n'],
        ]);
        const prompt = adapter.buildPrompt({ kindLabel: 'x', text: 'y', assignmentName: null });
        expect(prompt).toContain('```ruby\nmove(1)\n```');
        expect(adapter.takeoverMessage({ kindLabel: 'x', text: 'y', exchanges: [] })).toContain(
            '直すのは「Abby」だけです',
        );
        expect(adapter.takeoverScope().target.getName()).toBe('Abby');
    });

    test('checks and puts an answer in the editor that still shows the sprite', async () => {
        const { adapter, editor, vm, dee } = setup();
        const abby = vm.editingTarget;
        const scope = adapter.takeoverScope();
        vm.editingTarget = dee;
        const loaded = [];
        abby.blocks.apply = (code) => loaded.push(code);
        const result = await adapter.check(wrap('# 「Abby」\nmove(10)\n'), scope);
        expect(result.ok).toBe(true);
        // The lines are counted from the code the student sees, not from Abby's old blocks.
        expect(result.parts[0].before).toBe('move(1)\n');
        await adapter.apply(result.parts);
        expect(editor.getValue()).toBe('move(10)\n');
        expect(loaded).toEqual([]);
    });

    test('keeps the marks while the editor still shows the sprite', async () => {
        const { adapter, editor, vm, dee } = setup({ editorValue: 'a\nb\n' });
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        adapter.watchMarks(marks);
        vm.editingTarget = dee;
        vm.emit('targetsUpdate', {});
        expect(markedOf(editor)).toEqual(['2:genaiLineChanged', '3:genaiLineAdded']);
    });

    test('reads the sprite of the VM before the editor shows one', () => {
        const { adapter, vm, dee } = setup();
        vm.show(null);
        vm.editingTarget = dee;
        expect(adapter.editingName()).toBe('Dee');
    });

    test('reads the sprite of the VM once the sprite the editor shows is deleted', () => {
        const { adapter, vm, dee } = setup();
        const abby = vm.editingTarget;
        vm.editingTarget = dee;
        vm.runtime.targets = vm.runtime.targets.filter((t) => t !== abby);
        expect(adapter.editingName()).toBe('Dee');
        expect(adapter.takeoverScope().target).toBe(dee);
    });

    test('leaves the marks to move along with what the student types', async () => {
        const { adapter, editor } = setup({ editorValue: 'a\nb\n' });
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        adapter.watchMarks(marks);
        editor.decorations = ['kept by the editor'];
        editor.type('a\nB\nc\nd\n', false);
        expect(editor.decorations).toEqual(['kept by the editor']);
    });

    test('keeps the marks of the AI lines only when the code is replaced as a whole', async () => {
        const { adapter, editor } = setup({ editorValue: 'a\nb\n' });
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        adapter.watchMarks(marks);
        // The student adds a line (the editor leaves it unmarked), then the auto-correction
        // puts the whole code in again with that line corrected.
        editor.type('a\nB\nc\nｄ\n', false);
        editor.type('a\nB\nc\nd\n');
        expect(markedOf(editor)).toEqual(['2:genaiLineChanged', '3:genaiLineAdded']);
    });

    test('marks no line once Ctrl+Z takes the answer back', async () => {
        const { adapter, editor } = setup({ editorValue: 'a\nb\n' });
        const result = await adapter.check(wrap('a\nB\nc\n'));
        const { marks } = await adapter.apply(result.parts);
        adapter.watchMarks(marks);
        editor.type('a\nb\n');
        expect(markedOf(editor)).toEqual([]);
    });

    test('marks the AI version again after switching back to it, keeping the student edits', async () => {
        const { adapter, editor } = setup({ editorValue: 'a\nb\n' });
        const result = await adapter.check(wrap('a\nB\n'));
        const { snapshots } = await adapter.apply(result.parts);
        editor.type('a\nB\nx\n');
        const back = await adapter.switchSides(snapshots, false);
        expect(back.marks[0].lines).toEqual({ added: 1, changed: 1, removed: 0 });
        expect(editor.getValue()).toBe('a\nb\n');
        const again = await adapter.switchSides(back.snapshots, true);
        expect(editor.getValue()).toBe('a\nB\nx\n');
        adapter.watchMarks(again.marks);
        expect(markedOf(editor)).toEqual(['2:genaiLineChanged', '3:genaiLineAdded']);
    });
});

describe('lineDecorations', () => {
    test('marks whole lines, with a bar by the line numbers', () => {
        expect(lineDecorations([{ line: 3, kind: 'added' }])).toEqual([
            {
                range: { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 1 },
                options: {
                    isWholeLine: true,
                    className: 'genaiLineAdded',
                    linesDecorationsClassName: 'genaiLineAddedBar',
                },
            },
        ]);
    });
});

describe('the Ruby tab adapter in the Japanese (DNCL) mode (#1402)', () => {
    const dncl = 'x ← 1\n表示する(x)\n';
    const wrapDncl = (code) => `▼▼\n\`\`\`\n${code}\`\`\`\n▲▲`;

    test('offers the kinds of trouble of DNCL and asks with the DNCL in the editor', () => {
        const markers = [{ severity: 8, startLineNumber: 2, message: 'まちがい' }];
        const { adapter } = setup({ mode: 'dncl', editorValue: dncl, markers });
        expect(adapter.problemKinds).toEqual(['wrong-answer', 'error', 'how-write', 'how-think']);
        expect(adapter.language).toBe('dncl');
        const prompt = adapter.buildPrompt({ kindLabel: 'エラーが出る', text: 'y', assignmentName: null });
        expect(prompt).toContain('```\nx ← 1\n表示する(x)\n```');
        expect(prompt).toContain('2 行目: まちがい');
        expect(prompt).not.toContain('say("やあ")');
        expect(prompt).not.toContain('"Pop"');
    });

    test('asks the rewrite in DNCL, and in Ruby in the other modes', () => {
        const params = { code: 'x ← 1\n', problems: ['p'] };
        expect(setup({ mode: 'dncl' }).adapter.rewritePrompt(params)).toContain('DNCL の書き方で');
        expect(setup().adapter.rewritePrompt(params)).toContain('```ruby');
        expect(setup().adapter.language).toBe('ruby');
    });

    test('checks the answer as Ruby and puts the DNCL in the editor', async () => {
        const { adapter, editor, vm } = setup({ mode: 'dncl', editorValue: dncl });
        const result = await adapter.check(wrapDncl('x ← 2\n表示する(x)\n'));
        expect(result.ok).toBe(true);
        expect(result.parts[0].target).toBe(vm.editingTarget);
        expect(result.parts[0].code).toBe('x ← 2\n表示する(x)\n');
        expect(result.parts[0].lines).toEqual({ added: 0, changed: 1, removed: 0 });
        const out = await adapter.apply(result.parts);
        expect(editor.getValue()).toBe('x ← 2\n表示する(x)\n');
        expect(out.snapshots[0]).toMatchObject({ before: dncl, after: 'x ← 2\n表示する(x)\n', dncl: true });
    });

    test('shows a conversion error on the DNCL line', async () => {
        const { adapter } = setup({ mode: 'dncl', editorValue: dncl });
        // The fake converter fails on 'NG'; the DNCL is one line, so is the error.
        const result = await adapter.check(wrapDncl('NG\n'));
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual([{ type: 'error', sprite: null, row: 0, text: 'NG' }]);
    });

    test('switches a sprite no longer in the editor through Ruby', async () => {
        const { adapter, vm, dee } = setup({ mode: 'dncl', editorValue: dncl });
        const abby = vm.editingTarget;
        const applied = [];
        abby.blocks.apply = (code) => applied.push(code);
        const result = await adapter.check(wrapDncl('x ← 2\n表示する(x)\n'));
        const { snapshots } = await adapter.apply(result.parts);
        vm.switchTo(dee);
        await adapter.switchSides(snapshots, false);
        expect(applied).toHaveLength(1);
        expect(applied[0]).toContain('@x = 1');
    });
});
