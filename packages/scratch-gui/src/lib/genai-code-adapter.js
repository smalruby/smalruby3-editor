// The code tab's adapter of "生成AI に相談" (#1397): what the panel does with the
// project that depends on where it is opened. The panel itself (genai-concierge.jsx
// and the steps in components/genai-concierge/) is the same in every tab: its
// steps, the stepper, copying, pasting, ✔ / ✗ and 「ルビティーにまかせる」. A tab
// that has the panel gives it an adapter of the shape below (the Ruby tab's comes
// with #1398), made by a function of the shape of createCodeTabAdapter.
//
// An adapter is an object with these points:
//
// 1. Making the question
//    - problemKinds: the ids of the kinds of trouble offered (PROBLEM_KINDS of genai-prompt.js).
//    - initialTrouble() (optional): {kindId, text} to start the trouble with, or null.
//    - programs(): [{name, code, sounds, costumes}] of every sprite and the stage, as the
//      AI reads them (the code tab: each target as Ruby). Also what Rubytee is sent.
//    - editingName(): the name of the sprite in the editor (「ステージ」 for the stage), or null.
//    - buildPrompt({kindLabel, text, assignmentName}): the question copied to the AI.
//    - takeoverState(): the names Rubytee may use (the relay's stateContext).
//    - takeoverMessage({kindLabel, text, exchanges}): the first message to Rubytee from the
//      trouble and the consultation (genai-takeover.js), or null when the program is too long.
//    - takeoverScope() (optional): what Rubytee is asked to fix, kept when it starts and
//      given to check with each of its answers (the Ruby tab: the sprite in the editor).
//    - rewritePrompt({code, problems}) (optional): the request to rewrite an answer that
//      failed (buildRewritePrompt of genai-prompt.js by default, asking for Ruby).
//    - language (optional): 'dncl' when the answer is DNCL, not Ruby (the panel's words then
//      say program, not Ruby).
// 2. Checking the answer
//    - check(text, scope): resolves to checkAnswer's result whose parts also have `target` (the
//      target the part puts code in) and `changes` (what it adds or changes, see 4). scope is
//      from takeoverScope() for Rubytee's answers, else null.
// 3. Putting it in, switching and marking
//    - apply(parts): puts the checked parts in; resolves to {snapshots, marks}.
//      snapshots: [{target, name, before, after}] (the code before and the AI's code).
//    - switchSides(snapshots, toAfter): shows the original or the AI's version, keeping the
//      student's changes on the side left (switchSnapshots); resolves to {snapshots, marks}.
//    - watchMarks(marks): marks the changes in the editor while the panel is open; returns
//      the function that takes the marks away.
//    - puts (optional): 'code' when the answer goes into a code editor (the panel's words
//      then say code, not blocks).
//    - showBlocks(owner, ids): brings what changed (ids of changes) of `owner` into view.
// 4. Showing what is added or changed
//    - marks and parts[].changes: [{target, name, changes}] with changes as
//      [{kind: 'added' | 'changed' | 'removed', id, text, beforeText?, scriptText?}], listed
//      by the panel in the words of the tab (the code tab: the words of the blocks).
// 5. Where the face goes
//    - measureArea(root): {left, width, height}: the left of the face in the area the panel
//      opens in (the face's offset parent), and the size of that area.
import { checkAnswer, liveSnapshots, switchSnapshots } from './genai-answer.js';
import { describeChanges, diffBlocks } from './genai-block-diff.js';
import { afterBlocksRender, scrollToShowBlocks, showInEditor } from './genai-concierge-state.js';
import { CODE_TAB_KINDS, buildGenaiPrompt } from './genai-prompt.js';
import { buildTakeoverMessage } from './genai-takeover.js';
import RubyGenerator from './ruby-generator';
import { targetCodeToBlocks } from './ruby-to-blocks-converter';

/** The classes the marks in the editor get (styled in genai-concierge.css). */
export const MARK_CLASSES = { added: 'genaiMarkAdded', changed: 'genaiMarkChanged' };

// The relay refuses a name longer than this or with a line break in the state.
const MAX_NAME_LENGTH = 100;

/**
 * The name of a target in the question to the AI: the stage is called 「ステージ」.
 * @param {object} target - a target of the VM
 * @returns {string} its name
 */
export const nameOf = (target) => (target.isStage ? 'ステージ' : target.getName());

const sendable = (name) => name.length <= MAX_NAME_LENGTH && !/[\r\n]/.test(name);

const sendableNames = (items) =>
    items
        .map((item) => item.name)
        .filter(sendable)
        .map((name) => ({ name }));

/**
 * The names Rubytee may use, for the relay's stateContext (the program is in the message).
 * @param {object} vm - the VM
 * @returns {object} {sprite?: {name?, costumes, sounds}, stage?: {costumes, sounds}}
 */
export const takeoverStateOf = (vm) => {
    const editing = vm.editingTarget;
    const stage = vm.runtime.getTargetForStage ? vm.runtime.getTargetForStage() : null;
    const state = {};
    if (editing) {
        const name = nameOf(editing);
        state.sprite = {
            // The program names the sprite anyway; a name the relay refuses is left out.
            ...(sendable(name) ? { name } : {}),
            costumes: sendableNames(editing.getCostumes()),
            sounds: sendableNames(editing.getSounds()),
        };
    }
    if (stage)
        state.stage = { costumes: sendableNames(stage.getCostumes()), sounds: sendableNames(stage.getSounds()) };
    return state;
};

/**
 * The programs put in the question: those with code, and the sprite in the editor even
 * when it has none yet (the student asks about it).
 * @param {Array<object>} programs - [{name, code, ...}] of every target
 * @param {?string} editingName - the name of the sprite in the editor
 * @returns {Array<object>} the programs to put in the question
 */
export const programsForPrompt = (programs, editingName) =>
    programs.filter((p) => (p.code && p.code.trim()) || p.name === editingName);

/**
 * A copy of a target's blocks that deleting them (on putting other blocks in) leaves
 * intact: deleteBlock changes the block objects themselves.
 * @param {object} target - a target of the VM
 * @returns {object} the blocks by id
 */
export const copyBlocks = (target) => {
    const copy = {};
    Object.keys(target.blocks._blocks).forEach((id) => {
        copy[id] = { ...target.blocks._blocks[id] };
    });
    return copy;
};

// Add or remove the marks of the sprite shown in the editor.
const paintMarks = (workspace, changes, on) => {
    changes.forEach((change) => {
        const className = MARK_CLASSES[change.kind];
        const block = className && workspace.getBlockById(change.id);
        if (!block || typeof block.addClass !== 'function') return;
        if (on) block.addClass(className);
        else block.removeClass(className);
    });
};

// Where the face goes (the left edge of the script area right of the block palette, so
// it does not cover blocks) and the size of the script area the panel has to fit in.
const measureScriptArea = (root) => {
    const flyout = document.querySelector('.blocklyFlyout');
    const parent = root && root.offsetParent;
    if (!parent) return { left: 12, width: 0, height: 0 };
    const left = flyout ? flyout.getBoundingClientRect().right - parent.getBoundingClientRect().left : 0;
    return {
        left: Math.max(12, Math.round(left + 12)),
        width: parent.clientWidth,
        height: parent.clientHeight,
    };
};

/**
 * The adapter of the code tab: the project is read as Ruby and the answer goes in as blocks.
 * @param {object} params - parameters
 * @param {object} params.vm - the VM
 * @param {object} params.intl - react-intl (the converter's messages)
 * @param {string} params.rubyVersion - the Ruby version of the generator and the converter
 * @param {?object} params.scratchBlocks - ScratchBlocks: the words of the blocks and the editor
 * @param {object} [params.deps] - replacements for tests: toCode(target), toBlocks(target, code)
 * @returns {object} the adapter (the points are described at the top of this file)
 */
export const createCodeTabAdapter = ({ vm, intl, rubyVersion, scratchBlocks, deps = {} }) => {
    const toCode = deps.toCode || ((target) => RubyGenerator.targetToCode(target, { version: rubyVersion }));
    const toBlocks =
        deps.toBlocks || ((target, code) => targetCodeToBlocks(vm, target, code, intl, { version: rubyVersion }));
    const workspaceOf = () => scratchBlocks && scratchBlocks.getMainWorkspace && scratchBlocks.getMainWorkspace();
    const changesOf = (before, after) =>
        describeChanges(diffBlocks(before, after), before, after, scratchBlocks ? scratchBlocks.Blocks : null);
    const originals = () => vm.runtime.targets.filter((t) => t.isOriginal);

    const programs = () =>
        originals().map((t) => ({
            name: nameOf(t),
            code: toCode(t),
            sounds: t.getSounds().map((sound) => sound.name),
            costumes: t.getCostumes().map((costume) => costume.name),
        }));

    const editingName = () => (vm.editingTarget ? nameOf(vm.editingTarget) : null);

    const buildPrompt = ({ kindLabel, text, assignmentName }) => {
        const editing = vm.editingTarget;
        return buildGenaiPrompt({
            kindLabel,
            text,
            programs: programsForPrompt(programs(), editing && editing.getName()),
            editingName: editing && !editing.isStage ? editing.getName() : null,
            assignmentName,
        });
    };

    const check = async (text) => {
        const targets = {};
        originals().forEach((t) => {
            targets[nameOf(t)] = t;
        });
        const result = await checkAnswer({
            answer: text,
            sprites: Object.keys(targets).map((name) => ({
                name,
                sounds: targets[name].getSounds().map((sound) => sound.name),
                costumes: targets[name].getCostumes().map((costume) => costume.name),
            })),
            editingName: nameOf(vm.editingTarget),
            convert: (name, code) => toBlocks(targets[name], code),
        });
        result.parts.forEach((part) => {
            part.target = targets[part.name];
            part.changes =
                result.ok && part.converter ? changesOf(copyBlocks(part.target), part.converter.blocks) : [];
        });
        return result;
    };

    // Resolves to what the blocks put in add or change.
    const loadCode = async (target, code) => {
        const converter = await toBlocks(target, code || '');
        if (!converter.result) return [];
        const before = copyBlocks(target);
        await converter.apply();
        return changesOf(before, target.blocks._blocks);
    };

    const apply = async (parts) => {
        const snapshots = parts.map((part) => ({
            target: part.target,
            name: part.name,
            before: toCode(part.target),
            after: part.code,
        }));
        const marks = [];
        for (const part of parts) {
            const before = copyBlocks(part.target);
            await part.converter.apply();
            marks.push({
                target: part.target,
                name: part.name,
                changes: changesOf(before, part.target.blocks._blocks),
            });
        }
        return { snapshots, marks };
    };

    // A sprite deleted meanwhile drops out.
    const switchSides = async (snapshots, toAfter) => {
        const live = liveSnapshots(snapshots, vm.runtime.targets);
        const next = switchSnapshots(
            live,
            toAfter,
            live.map((snap) => toCode(snap.target)),
        );
        const marks = [];
        for (const snap of next) {
            const changes = await loadCode(snap.target, toAfter ? snap.after : snap.before);
            marks.push({ target: snap.target, name: snap.name, changes });
        }
        return { snapshots: next, marks };
    };

    // Mark the blocks of the sprite in the editor, again each time the editor shows
    // another sprite (or the same one afresh). The new blocks of a workspace update are
    // marked once Blockly has drawn them, not after a fixed time that a slow PC can
    // overrun (#1281 Q1).
    const watchMarks = (marks) => {
        const workspace = workspaceOf();
        if (!workspace) return () => {};
        let painted = [];
        let active = true;
        const paint = () => {
            if (!active) return;
            if (painted.length > 0) paintMarks(workspace, painted, false);
            const shown = marks.find((mark) => mark.target === vm.editingTarget);
            painted = shown ? shown.changes : [];
            paintMarks(workspace, painted, true);
        };
        const later = () => {
            afterBlocksRender(scratchBlocks).then(paint);
        };
        paint();
        later();
        vm.on('workspaceUpdate', later);
        return () => {
            active = false;
            vm.removeListener('workspaceUpdate', later);
            paintMarks(workspace, painted, false);
        };
    };

    // Bring blocks into view at the top left, away from the panel at the right (#1293 G8):
    // the marked ones when there are (a wide script would hide them under the panel, #1281),
    // else all the blocks. Another sprite's blocks are shown in the editor first, and the
    // scroll waits for its workspace update and for Blockly to draw the blocks (#1281 Q1).
    const showBlocks = (owner, ids) =>
        showInEditor(vm, owner)
            .then(() => afterBlocksRender(scratchBlocks))
            .then(() => {
                const workspace = workspaceOf();
                if (!workspace) return;
                const boxes = (ids || [])
                    .map((id) => workspace.getBlockById(id))
                    .filter(Boolean)
                    .map((block) => block.getBoundingRectangle());
                let box = null;
                if (boxes.length > 0) {
                    box = {
                        left: Math.min(...boxes.map((b) => b.left)),
                        top: Math.min(...boxes.map((b) => b.top)),
                    };
                } else {
                    const all = workspace.getBlocksBoundingBox();
                    const empty = !all || (all.right === all.left && all.bottom === all.top);
                    box = empty ? null : all;
                }
                const to = scrollToShowBlocks({ bbox: box, scale: workspace.scale });
                if (to) workspace.scroll(to.x, to.y);
            });

    return {
        problemKinds: CODE_TAB_KINDS,
        programs,
        editingName,
        buildPrompt,
        takeoverState: () => takeoverStateOf(vm),
        // The whole project is sent: the code tab's answer may change any sprite.
        takeoverMessage: ({ kindLabel, text, exchanges }) =>
            buildTakeoverMessage({ kindLabel, text, programs: programs(), editingName: editingName(), exchanges }),
        check,
        apply,
        switchSides,
        watchMarks,
        showBlocks,
        measureArea: measureScriptArea,
    };
};
