// === Smalruby: This file is Smalruby-specific (lesson goal monitor) ===
// レッスンモードのあいだ VM を見張り、チャレンジの goal を満たしたら知らせる。
// 判定そのものは goal.js（純粋関数）。ここは VM との接続だけ:
//   - ブロックの実行: vm-execution-hook.js（opcode・引数・スレッド → run）
//   - 言った文字:     runtime の 'SAY' イベント（looks_say / looks_sayforsecs / think）
//   - 答え:           runtime の 'ANSWER' イベント（「聞いて待つ」に入力したとき）
//   - いまの状態:     takeSnapshot（変数・リスト・スプライト数・コスチューム数・拡張機能）
// 判定は、何か記録があったあとの次の step（runtime の 'BEFORE_STEP'）で 1 回だけ行う。

import { createFacts, evaluateGoal, recordAnswer, recordExecution, recordSay, startRun } from './goal';
import { hookOpcodeExecution, resetExecuteCaches } from './vm-execution-hook';

const originalTargets = (runtime) => (runtime.targets || []).filter((target) => target.isOriginal !== false);

const costumeCount = (target) => {
    if (typeof target.getCostumes === 'function') return target.getCostumes().length;
    return target.sprite && Array.isArray(target.sprite.costumes) ? target.sprite.costumes.length : 0;
};

/**
 * ターゲットごとのコスチューム（背景）の数。
 * @param {object} runtime - VM の runtime。
 * @returns {object} ターゲット id → `{isStage, count}`。
 */
export const takeCostumeCounts = (runtime) => {
    const counts = {};
    originalTargets(runtime).forEach((target) => {
        counts[target.id] = { isStage: Boolean(target.isStage), count: costumeCount(target) };
    });
    return counts;
};

const variablesOf = (target) => Object.values(target.variables || {});

/**
 * いまの作品の状態（goal.js の result 系の条件が見るもの）。
 * @param {object} vm - VM。
 * @param {object} baselineCostumes - 見張りを始めたときの takeCostumeCounts。
 * @returns {object} snapshot。
 */
export const takeSnapshot = (vm, baselineCostumes) => {
    const runtime = vm.runtime;
    const targets = originalTargets(runtime);
    const variables = [];
    targets.forEach((target) => {
        variablesOf(target).forEach((variable) => {
            variables.push({
                name: variable.name,
                type: variable.type || '',
                value: variable.value,
                isStage: Boolean(target.isStage),
            });
        });
    });
    const extensionManager = vm.extensionManager;
    return {
        spriteCount: targets.filter((target) => !target.isStage).length,
        costumes: takeCostumeCounts(runtime),
        baselineCostumes,
        variables,
        isExtensionLoaded: (id) =>
            Boolean(extensionManager && typeof extensionManager.isExtensionLoaded === 'function') &&
            extensionManager.isExtensionLoaded(id),
    };
};

// 言った時点の変数（ステージ + そのスプライト。スカラーだけ）
const readScalarVariables = (runtime, target) => {
    const values = {};
    const stage = typeof runtime.getTargetForStage === 'function' ? runtime.getTargetForStage() : null;
    [stage, target].forEach((owner) => {
        if (!owner) return;
        variablesOf(owner).forEach((variable) => {
            if ((variable.type || '') === '') values[variable.name] = variable.value;
        });
    });
    return values;
};

// スレッドの始まり（ハット）を run の形にする
const describeThread = (thread) => {
    const container = thread.blockContainer || (thread.target && thread.target.blocks);
    const block = container && typeof container.getBlock === 'function' ? container.getBlock(thread.topBlock) : null;
    const fields = {};
    if (block && block.fields) {
        Object.entries(block.fields).forEach(([name, field]) => {
            fields[name] = field && typeof field.value !== 'undefined' ? field.value : field;
        });
    }
    return {
        trigger: { hat: block ? block.opcode : null, fields, stackClick: Boolean(thread.stackClick) },
        targetId: thread.target ? thread.target.id : null,
        isStage: Boolean(thread.target && thread.target.isStage),
    };
};

// execute.js は引数のオブジェクトを使い回すので、記録する分は写す。
// BROADCAST_OPTION は `{id, name}` なのでメッセージ名だけにする。
const copyArgs = (args) => {
    if (!args || typeof args !== 'object') return {};
    const copy = {};
    Object.entries(args).forEach(([name, value]) => {
        if (value !== null && typeof value === 'object') {
            copy[name] = Object.prototype.hasOwnProperty.call(value, 'name') ? value.name : String(value);
        } else {
            copy[name] = value;
        }
    });
    return copy;
};

/**
 * VM を見張り、goal を満たしたら onSatisfied を 1 回だけ呼ぶ（呼んだら自分で外れる）。
 * @param {object} vm - VM（`vm.runtime` を使う）。
 * @param {Array<object>} goal - チャレンジの goal（goal.js）。
 * @param {function(): void} onSatisfied - 満たしたときに呼ぶ。
 * @returns {function(): void} 見張りをやめる関数。
 */
export const attachGoalMonitor = (vm, goal, onSatisfied) => {
    const runtime = vm.runtime;
    const facts = createFacts();
    const runs = new WeakMap();
    const baselineCostumes = takeCostumeCounts(runtime);
    let dirty = true;
    let detached = false;

    const runFor = (thread) => {
        let run = runs.get(thread);
        if (!run) {
            run = startRun(facts, describeThread(thread));
            runs.set(thread, run);
        }
        return run;
    };

    const onExecute = (opcode, args, util) => {
        const thread = util && util.thread;
        // モニター（ステージの表示）のスレッドはプログラムではない
        if (!thread || thread.updateMonitor) return;
        recordExecution(facts, runFor(thread), opcode, copyArgs(args));
        dirty = true;
    };

    const onSay = (target, type, text) => {
        recordSay(facts, {
            targetId: target ? target.id : null,
            isStage: Boolean(target && target.isStage),
            text,
            variables: readScalarVariables(runtime, target),
        });
        dirty = true;
    };

    const onAnswer = (answer) => {
        recordAnswer(facts, answer);
        dirty = true;
    };

    const markDirty = () => {
        dirty = true;
    };

    const unhook = hookOpcodeExecution(runtime, onExecute);
    resetExecuteCaches(runtime);

    // 実行とは関係なく変わるもの（スプライト・コスチューム・拡張機能）も判定を予約する
    const listeners = [
        ['SAY', onSay],
        ['ANSWER', onAnswer],
        ['PROJECT_CHANGED', markDirty],
        ['EXTENSION_ADDED', markDirty],
        ['targetWasCreated', markDirty],
    ];

    const detach = () => {
        if (detached) return;
        detached = true;
        unhook();
        listeners.forEach(([event, listener]) => runtime.removeListener(event, listener));
    };

    const check = () => {
        if (detached || !dirty) return;
        dirty = false;
        if (!evaluateGoal(goal, facts, takeSnapshot(vm, baselineCostumes)).satisfied) return;
        detach();
        onSatisfied();
    };
    listeners.push(['BEFORE_STEP', check]);

    listeners.forEach(([event, listener]) => runtime.on(event, listener));

    return detach;
};
