// The Ruby tab's adapter of "生成AI に相談" (#1398), for its Ruby and furigana modes.
// The points of an adapter are described in genai-code-adapter.js. Here only the sprite
// in the editor is fixed (#1396 決定 1): the question carries the Ruby in the editor now
// (also edits not yet in the blocks) and the other sprites as reference, an answer that
// changes another sprite is ✗, and the answer goes into the editor with executeEdits (so
// Ctrl+Z takes it back). What the answer changes is shown in lines (#1399): Monaco's
// inline diff before it goes in, and marks on the lines added or changed once it is in.
// In the Japanese (DNCL) mode (#1402) the question, the answer and the lines are DNCL; the
// answer is judged after it is turned into Ruby, and errors are shown on DNCL lines.
import { dnclToRuby } from './dncl/dncl-to-ruby';
import { rubyToDncl } from './dncl/ruby-to-dncl';
import { checkAnswer, liveSnapshots, switchSnapshots } from './genai-answer.js';
import { nameOf, takeoverStateOf } from './genai-code-adapter.js';
import { checkDnclAnswer } from './genai-dncl-answer.js';
import { DNCL_TAB_KINDS, buildDnclRewritePrompt, buildDnclTabPrompt } from './genai-dncl-prompt.js';
import { carriedLines, countLineChanges, diffLines, markedLines } from './genai-line-diff.js';
import { RUBY_TAB_KINDS, buildRewritePrompt, buildRubyTabPrompt } from './genai-prompt.js';
import { buildRubyTabTakeoverMessage } from './genai-takeover.js';
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

/** The classes of the marked lines in the editor (styled in genai-concierge.css). */
export const LINE_MARK_CLASSES = { added: 'genaiLineAdded', changed: 'genaiLineChanged' };

/**
 * The decorations marking lines in the editor: the whole line, and a bar by the line numbers.
 * @param {Array<{line: number, kind: string}>} lines - from markedLines
 * @returns {Array<object>} Monaco's model decorations
 */
export const lineDecorations = (lines) =>
    lines.map(({ line, kind }) => ({
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: {
            isWholeLine: true,
            className: LINE_MARK_CLASSES[kind],
            linesDecorationsClassName: `${LINE_MARK_CLASSES[kind]}Bar`,
        },
    }));

/**
 * The lines one version adds, changes and removes from the other, counted.
 * @param {string} before - the code before
 * @param {string} after - the code after
 * @returns {{added: number, changed: number, removed: number}} the counts
 */
export const countChanges = (before, after) => countLineChanges(diffLines(before, after));

// Whether a change of the editor's content replaces all of it (@monaco-editor/react puts a
// new value in as one edit of the whole range, ruby-tab.jsx sometimes with setValue, as for
// the auto-correction): the marks go away with the old content then.
const replacesAll = (event, lengthBefore) =>
    event.isFlush ||
    (event.changes.length === 1 &&
        event.changes[0].rangeOffset === 0 &&
        event.changes[0].rangeLength === lengthBefore);

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
 * @param {function(): string} params.getMode - 'ruby', 'furigana' or 'dncl'
 * @param {object} [params.deps] - replacements for tests: toCode(target), toBlocks(target, code)
 * @returns {function(object): object} createAdapter({vm, intl, rubyVersion, scratchBlocks})
 */
export const makeRubyTabAdapterFactory =
    ({ getEditor, getMonaco, getMode, deps = {} }) =>
    ({ vm, intl, rubyVersion }) => {
        const toCode = deps.toCode || ((target) => RubyGenerator.targetToCode(target, { version: rubyVersion }));
        const toBlocks =
            deps.toBlocks || ((target, code) => targetCodeToBlocks(vm, target, code, intl, { version: rubyVersion }));
        const originals = () => vm.runtime.targets.filter((t) => t.isOriginal);
        const isDncl = () => getMode() === 'dncl';
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

        // The sprite in the editor (to fix) and the others (as reference), as the question
        // and Rubytee read them.
        const editingProgram = () => {
            const target = editing();
            return {
                mode: getMode(),
                editingName: nameOf(target),
                code: editorCode(),
                ...assetsOf(target),
                others: originals()
                    .filter((t) => t !== target)
                    .map((t) => ({ name: nameOf(t), code: toCode(t), ...assetsOf(t) })),
            };
        };

        const buildPrompt = ({ kindLabel, text, assignmentName }) => {
            // DNCL: the code in the editor as it is; DNCL has no sounds, costumes or events.
            if (isDncl()) {
                return buildDnclTabPrompt({
                    kindLabel,
                    text,
                    code: editorCode(),
                    errors: editorErrors(getEditor(), getMonaco()),
                    assignmentName,
                });
            }
            return buildRubyTabPrompt({
                ...editingProgram(),
                kindLabel,
                text,
                errors: editorErrors(getEditor(), getMonaco()),
                assignmentName,
            });
        };

        // Rubytee too fixes only the sprite in the editor (#1400); check fails another sprite.
        const takeoverMessage = ({ kindLabel, text, exchanges }) =>
            buildRubyTabTakeoverMessage({ ...editingProgram(), kindLabel, text, exchanges });

        // An error in the editor starts the trouble as 「エラーが出る」 with the errors in it.
        const initialTrouble = () => {
            const errors = editorErrors(getEditor(), getMonaco());
            return errors.length > 0 ? { kindId: 'error', text: errors.join('\n') } : null;
        };

        const check = async (text) => {
            const targets = {};
            originals().forEach((t) => {
                targets[nameOf(t)] = t;
            });
            const name = nameOf(editing());
            const before = editorCode();
            const result = isDncl()
                ? await checkDnclAnswer({
                      answer: text,
                      editingName: name,
                      convert: (n, ruby) => toBlocks(targets[n], ruby),
                  })
                : await checkAnswer({
                      answer: text,
                      sprites: Object.keys(targets).map((n) => ({ name: n, ...assetsOf(targets[n]) })),
                      editingName: name,
                      onlyName: name,
                      convert: (n, code) => toBlocks(targets[n], code),
                  });
            // What changes is shown in lines (mountDiff and lines), not in the words of blocks.
            result.parts.forEach((part) => {
                part.target = targets[part.name];
                part.changes = [];
                part.before = before;
                part.lines = countChanges(before, part.code);
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

        // The marks of a version: the lines are found again from `before` when the editor
        // shows the sprite (watchMarks), so the student's edits meanwhile move them along.
        const markOf = (snap) => ({
            target: snap.target,
            name: snap.name,
            changes: [],
            before: snap.before,
            lines: countChanges(snap.before, snap.after),
        });

        // Only the sprite in the editor is put in (check leaves the others out). The blocks
        // follow the editor as for the student's own typing.
        const apply = (parts) => {
            const part = parts.find((p) => p.target === editing());
            if (!part) return Promise.resolve({ snapshots: [], marks: [] });
            const snapshots = [
                {
                    target: part.target,
                    name: part.name,
                    before: editorCode(),
                    after: part.code,
                    ...(isDncl() ? { dncl: true } : {}),
                },
            ];
            replaceEditorCode(part.code);
            return Promise.resolve({ snapshots, marks: snapshots.map(markOf) });
        };

        // A sprite not in the editor is read from and put into its blocks, in the language of
        // its versions (DNCL ones go through Ruby).
        const blocksCode = (snap) => {
            const ruby = toCode(snap.target);
            return snap.dncl ? rubyToDncl(ruby).dncl : ruby;
        };
        const toBlocksFrom = (snap, code) => {
            if (!snap.dncl) return toBlocks(snap.target, code);
            const { ruby } = dnclToRuby(code);
            return ruby === null ? Promise.resolve({ result: false }) : toBlocks(snap.target, ruby);
        };

        // The sprite in the editor switches in the editor (Ctrl+Z takes it back). One the
        // student moved away from meanwhile switches in its blocks, so its two versions are
        // not lost; one that cannot become blocks stays as it is. A deleted sprite drops out.
        const switchSides = async (snapshots, toAfter) => {
            const live = liveSnapshots(snapshots, vm.runtime.targets);
            const inEditor = (snap) => snap.target === editing();
            const next = switchSnapshots(
                live,
                toAfter,
                live.map((snap) => (inEditor(snap) ? editorCode() : blocksCode(snap))),
            );
            for (const snap of next) {
                const code = toAfter ? snap.after : snap.before;
                if (inEditor(snap)) {
                    replaceEditorCode(code);
                } else {
                    const converter = await toBlocksFrom(snap, code || '');
                    if (converter.result) await converter.apply();
                }
            }
            return { snapshots: next, marks: next.map(markOf) };
        };

        // Mark the lines added or changed while the editor shows the sprite of a mark, again
        // each time it shows another sprite (the lines are found again then). The student's
        // own typing moves the marks along with the lines. When the same sprite's code is
        // replaced as a whole (the auto-correction, Ctrl+Z), only the lines marked just
        // before keep their marks, so what the student typed meanwhile stays unmarked.
        // The switch to another sprite is also seen in the VM (targetsUpdate, #1410): the
        // editor gets no new value for a sprite with the same code (a duplicate), so no edit
        // tells it. The VM tells it before the editor has the new code, though, so a sprite
        // with marks is marked then only when the editor already shows its code; else the
        // marks wait for the new value (the edit above).
        const watchMarks = (marks) => {
            const editor = getEditor();
            if (!editor || !editor.createDecorationsCollection) return () => {};
            const collection = editor.createDecorationsCollection([]);
            let painted = null;
            let length = 0;
            let text = '';
            let marked = [];
            const paint = (keep) => {
                painted = editing();
                const mark = marks.find((m) => m.target === painted);
                const lines = mark ? markedLines(diffLines(mark.before, editorCode())) : [];
                collection.set(lineDecorations(keep ? lines.filter(({ line }) => keep.has(line)) : lines));
            };
            const lengthNow = () => {
                const model = editor.getModel();
                return model && model.getValueLength ? model.getValueLength() : editorCode().length;
            };
            // What a replacement as a whole is compared with: the editor drops the marks then.
            const remember = () => {
                length = lengthNow();
                text = editorCode();
                marked = collection.getRanges ? collection.getRanges().map((range) => range.startLineNumber) : [];
            };
            paint();
            remember();
            const listener = editor.onDidChangeModelContent((event) => {
                if (editing() !== painted) paint();
                else if (replacesAll(event, length)) paint(carriedLines(text, editorCode(), marked));
                remember();
            });
            const onTargetsUpdate = () => {
                const target = editing();
                if (target === painted) return;
                const mark = marks.find((m) => m.target === target);
                if (!mark || editorCode() === blocksCode({ target, dncl: isDncl() })) {
                    paint();
                } else {
                    collection.set([]);
                }
                remember();
            };
            vm.on('targetsUpdate', onTargetsUpdate);
            return () => {
                listener.dispose();
                vm.removeListener('targetsUpdate', onTargetsUpdate);
                collection.clear();
            };
        };

        // Monaco's inline diff of the code in the editor and the answer, before it goes in.
        const mountDiff = (element, part) => {
            const monaco = getMonaco();
            if (!monaco || !element) return () => {};
            const language = isDncl() ? 'dncl' : 'smalruby';
            const original = monaco.editor.createModel(part.before || '', language);
            const modified = monaco.editor.createModel(part.code || '', language);
            const diff = monaco.editor.createDiffEditor(element, {
                renderSideBySide: false,
                readOnly: true,
                originalEditable: false,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
                renderOverviewRuler: false,
                lineNumbersMinChars: 2,
                folding: false,
                fontSize: 12,
                renderIndicators: true,
                // Same lines as the counts (genai-line-diff.js): a line indented anew is changed.
                ignoreTrimWhitespace: false,
            });
            diff.setModel({ original, modified });
            return () => {
                diff.dispose();
                original.dispose();
                modified.dispose();
            };
        };

        return {
            // Read when the panel renders: the mode may change while the panel is mounted.
            get problemKinds() {
                return isDncl() ? DNCL_TAB_KINDS : RUBY_TAB_KINDS;
            },
            get language() {
                return isDncl() ? 'dncl' : 'ruby';
            },
            rewritePrompt: (params) => (isDncl() ? buildDnclRewritePrompt(params) : buildRewritePrompt(params)),
            puts: 'code',
            programs,
            editingName,
            buildPrompt,
            initialTrouble,
            takeoverState: () => takeoverStateOf(vm),
            takeoverMessage,
            check,
            apply,
            switchSides,
            watchMarks,
            mountDiff,
            showBlocks: () => Promise.resolve(),
            measureArea: measureEditorArea,
        };
    };
