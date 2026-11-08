// The Ruby tab's adapter of "生成AI に相談" (#1398), for its Ruby and furigana modes.
// The points of an adapter are described in genai-code-adapter.js. Here only the sprite
// in the editor is fixed (#1396 決定 1): the question carries the Ruby in the editor now
// (also edits not yet in the blocks) and the other sprites as reference, an answer that
// changes another sprite is ✗, and the answer goes into the editor with executeEdits (so
// Ctrl+Z takes it back). The line diff, the marks and the switching come with #1399.
import { checkAnswer, liveSnapshots, switchSnapshots } from './genai-answer.js';
import { describeChanges, diffBlocks } from './genai-block-diff.js';
import { copyBlocks, nameOf, takeoverStateOf } from './genai-code-adapter.js';
import { RUBY_TAB_KINDS, buildRubyTabPrompt } from './genai-prompt.js';
import RubyGenerator from './ruby-generator';
import { targetCodeToBlocks } from './ruby-to-blocks-converter';

// monaco.MarkerSeverity.Error: warnings and hints are not errors the student sees.
const ERROR_SEVERITY = 8;

/**
 * The errors shown in the editor, as lines for the question and the trouble.
 * @param {?object} editor - the Monaco editor
 * @param {?object} monaco - Monaco
 * @returns {Array<string>} 「N 行目: message」 per error (one line each), in line order
 */
export const editorErrors = (editor, monaco) => {
    const model = editor && editor.getModel && editor.getModel();
    if (!model || !monaco) return [];
    return monaco.editor
        .getModelMarkers({ resource: model.uri })
        .filter((marker) => marker.severity === ERROR_SEVERITY)
        .sort((a, b) => a.startLineNumber - b.startLineNumber)
        .map((marker) => `${marker.startLineNumber} 行目: ${marker.message.replace(/\s*\n\s*/g, ' ')}`);
};

// The face goes at the bottom left of the editor, over the line numbers: the bottom right
// has the zoom buttons. The panel opens at the right of the editor.
const measureEditorArea = (root) => {
    const parent = root && root.offsetParent;
    if (!parent) return { left: 12, width: 0, height: 0 };
    return { left: 12, width: parent.clientWidth, height: parent.clientHeight };
};

/**
 * Makes the Ruby tab's createAdapter. The editor and the mode are read when they are
 * needed (the editor mounts after the panel, and the mode changes while it is open), so
 * the function made stays the same between renders.
 * @param {object} params - parameters
 * @param {function(): ?object} params.getEditor - the Monaco editor
 * @param {function(): ?object} params.getMonaco - Monaco
 * @param {function(): string} params.getMode - 'ruby' or 'furigana'
 * @param {object} [params.deps] - replacements for tests: toCode(target), toBlocks(target, code)
 * @returns {function(object): object} createAdapter({vm, intl, rubyVersion, scratchBlocks})
 */
export const makeRubyTabAdapterFactory =
    ({ getEditor, getMonaco, getMode, deps = {} }) =>
    ({ vm, intl, rubyVersion, scratchBlocks }) => {
        const toCode = deps.toCode || ((target) => RubyGenerator.targetToCode(target, { version: rubyVersion }));
        const toBlocks =
            deps.toBlocks || ((target, code) => targetCodeToBlocks(vm, target, code, intl, { version: rubyVersion }));
        const originals = () => vm.runtime.targets.filter((t) => t.isOriginal);
        const editing = () => vm.editingTarget;
        const editorCode = () => {
            const editor = getEditor();
            return editor ? editor.getValue() || '' : '';
        };
        const assetsOf = (t) => ({
            sounds: t.getSounds().map((sound) => sound.name),
            costumes: t.getCostumes().map((costume) => costume.name),
        });

        // The sprite in the editor is read from the editor, the others from their blocks.
        const programs = () =>
            originals().map((t) => ({
                name: nameOf(t),
                code: t === editing() ? editorCode() : toCode(t),
                ...assetsOf(t),
            }));

        const editingName = () => (editing() ? nameOf(editing()) : null);

        const buildPrompt = ({ kindLabel, text, assignmentName }) => {
            const target = editing();
            return buildRubyTabPrompt({
                mode: getMode(),
                kindLabel,
                text,
                editingName: nameOf(target),
                code: editorCode(),
                ...assetsOf(target),
                others: originals()
                    .filter((t) => t !== target)
                    .map((t) => ({ name: nameOf(t), code: toCode(t), ...assetsOf(t) })),
                errors: editorErrors(getEditor(), getMonaco()),
                assignmentName,
            });
        };

        // An error in the editor starts the trouble as 「エラーが出る」 with the errors in it.
        const initialTrouble = () => {
            const errors = editorErrors(getEditor(), getMonaco());
            return errors.length > 0 ? { kindId: 'error', text: errors.join('\n') } : null;
        };

        const changesOf = (before, after) =>
            describeChanges(diffBlocks(before, after), before, after, scratchBlocks ? scratchBlocks.Blocks : null);

        const check = async (text) => {
            const targets = {};
            originals().forEach((t) => {
                targets[nameOf(t)] = t;
            });
            const name = nameOf(editing());
            const result = await checkAnswer({
                answer: text,
                sprites: Object.keys(targets).map((n) => ({ name: n, ...assetsOf(targets[n]) })),
                editingName: name,
                onlyName: name,
                convert: (n, code) => toBlocks(targets[n], code),
            });
            result.parts.forEach((part) => {
                part.target = targets[part.name];
                part.changes =
                    result.ok && part.converter ? changesOf(copyBlocks(part.target), part.converter.blocks) : [];
            });
            return result;
        };

        // Replace the whole code in the editor as one edit, so Ctrl+Z takes it back.
        const replaceEditorCode = (code) => {
            const editor = getEditor();
            if (!editor) return;
            const model = editor.getModel();
            editor.pushUndoStop();
            editor.executeEdits('genai', [{ range: model.getFullModelRange(), text: code, forceMoveMarkers: true }]);
            editor.pushUndoStop();
        };

        // Only the sprite in the editor is put in (check leaves the others out). The blocks
        // follow the editor as for the student's own typing.
        const apply = (parts) => {
            const part = parts.find((p) => p.target === editing());
            if (!part) return Promise.resolve({ snapshots: [], marks: [] });
            const snapshots = [{ target: part.target, name: part.name, before: editorCode(), after: part.code }];
            replaceEditorCode(part.code);
            return Promise.resolve({ snapshots, marks: [] });
        };

        // The sprite in the editor switches in the editor (Ctrl+Z takes it back). One the
        // student moved away from meanwhile switches in its blocks, so its two versions are
        // not lost; one that cannot become blocks stays as it is. A deleted sprite drops out.
        // The line diff and the marks come with #1399.
        const switchSides = async (snapshots, toAfter) => {
            const live = liveSnapshots(snapshots, vm.runtime.targets);
            const inEditor = (snap) => snap.target === editing();
            const next = switchSnapshots(
                live,
                toAfter,
                live.map((snap) => (inEditor(snap) ? editorCode() : toCode(snap.target))),
            );
            for (const snap of next) {
                const code = toAfter ? snap.after : snap.before;
                if (inEditor(snap)) {
                    replaceEditorCode(code);
                } else {
                    const converter = await toBlocks(snap.target, code || '');
                    if (converter.result) await converter.apply();
                }
            }
            return { snapshots: next, marks: [] };
        };

        return {
            problemKinds: RUBY_TAB_KINDS,
            puts: 'code',
            programs,
            editingName,
            buildPrompt,
            initialTrouble,
            takeoverState: () => takeoverStateOf(vm),
            check,
            apply,
            switchSides,
            // No marks in the editor yet (#1399).
            watchMarks: () => () => {},
            showBlocks: () => Promise.resolve(),
            measureArea: measureEditorArea,
        };
    };
