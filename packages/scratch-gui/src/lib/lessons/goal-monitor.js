// === Smalruby: This file is Smalruby-specific (lesson goal monitor) ===
// レッスンモードのあいだ VM を見張り、チャレンジの goal を満たしたら知らせる。
// 判定そのものは goal.js（純粋関数）。ここは VM との接続だけ:
//   - ブロックの実行: vm-execution-hook.js（opcode・引数・スレッド → run）
//   - 言った文字:     runtime の 'SAY' イベント（looks_say / looks_sayforsecs / think）
//   - 答え:           runtime の 'ANSWER' イベント（「聞いて待つ」に入力したとき）
//   - いまの状態:     takeSnapshot（変数・リスト・スプライト数・コスチューム・位置・拡張機能）と、エディタの画面の状態
//                     （いまのタブ・クイズの答え。attachGoalMonitor の getUi・#2134）
// 判定は、何か記録があったあとの次の step（runtime の 'BEFORE_STEP'）で 1 回だけ行う。
import { createFacts, evaluateGoal, recordAnswer, recordExecution, recordSay, startRun } from './goal';
import { hookOpcodeExecution, resetExecuteCaches } from './vm-execution-hook';

const originalTargets = (runtime) => (runtime.targets || []).filter((target) => target.isOriginal !== false);

const costumeCount = (target) => {
    if (typeof target.getCostumes === 'function') return target.getCostumes().length;
    return target.sprite && Array.isArray(target.sprite.costumes) ? target.sprite.costumes.length : 0;
};

/**
 * ターゲットごとのコスチューム（背景）の数と、いまのコスチュームの番号（0 から）。
 * @param {object} runtime - VM の runtime。
 * @returns {object} ターゲット id → `{isStage, count, current}`。
 */
export const takeCostumeCounts = (runtime) => {
    const counts = {};
    originalTargets(runtime).forEach((target) => {
        counts[target.id] = {
            isStage: Boolean(target.isStage),
            count: costumeCount(target),
            current: Number.isInteger(target.currentCostume) ? target.currentCostume : null,
        };
    });
    return counts;
};

/**
 * スプライトごとの位置（ステージは入れない）。
 * @param {object} runtime - VM の runtime。
 * @returns {object} ターゲット id → `{x, y}`。
 */
export const takePositions = (runtime) => {
    const positions = {};
    originalTargets(runtime).forEach((target) => {
        if (target.isStage || typeof target.x !== 'number' || typeof target.y !== 'number') return;
        positions[target.id] = { x: target.x, y: target.y };
    });
    return positions;
};

const variablesOf = (target) => Object.values(target.variables || {});

/**
 * いまの作品の状態（goal.js の result 系の条件が見るもの）。
 * @param {object} vm - VM。
 * @param {object} baselineCostumes - 見張りを始めたときの takeCostumeCounts。
 * @param {object} [baselinePositions] - 見張りを始めたときの takePositions。
 * @param {object} [ui] - エディタの画面の状態（`{activeTab, partQuizSolved}`）。
 * @returns {object} snapshot。
 */
export const takeSnapshot = (vm, baselineCostumes, baselinePositions = {}, ui = {}) => {
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
        positions: takePositions(runtime),
        baselinePositions,
        ui,
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

// メッシュで自分以外のノード（練習相手を含む）から届いている変数の値。自分の値（`remoteData[meshId]`。
// 自分の変数の「センサーの値」用）は入れない。メッシュの拡張が無ければ空
const readRemoteValues = (runtime) => {
    const ext = runtime.peripheralExtensions && runtime.peripheralExtensions.meshV2;
    const service = ext && ext.meshService;
    if (!service || !service.remoteData) return [];
    const values = [];
    Object.entries(service.remoteData).forEach(([nodeId, node]) => {
        if (nodeId === service.meshId || !node) return;
        Object.values(node).forEach((entry) => {
            if (entry && typeof entry.value !== 'undefined') values.push(String(entry.value));
        });
    });
    return values;
};

// スレッドの始まり（ハット）を run の形にする。パレットで押したブロックはスプライトのブロックに無く、
// runtime.flyoutBlocks にある（execute.js も flyoutBlocks から探す）。それを `palette` として分ける（#2134）
const describeThread = (thread, runtime) => {
    const container = thread.blockContainer || (thread.target && thread.target.blocks);
    const own = container && typeof container.getBlock === 'function' ? container.getBlock(thread.topBlock) : null;
    const flyout = runtime && runtime.flyoutBlocks;
    const fromPalette =
        !own && Boolean(thread.stackClick) && Boolean(flyout && flyout.getBlock && flyout.getBlock(thread.topBlock));
    const block = own || (fromPalette ? flyout.getBlock(thread.topBlock) : null);
    const fields = {};
    if (block && block.fields) {
        Object.entries(block.fields).forEach(([name, field]) => {
            fields[name] = field && typeof field.value !== 'undefined' ? field.value : field;
        });
    }
    return {
        trigger: {
            hat: block ? block.opcode : null,
            fields,
            stackClick: Boolean(thread.stackClick),
            palette: fromPalette,
        },
        targetId: thread.target ? thread.target.id : null,
        isStage: Boolean(thread.target && thread.target.isStage),
    };
};

// メッセージを送るブロック（goal.js の BROADCAST_OPCODES と同じ）
const BROADCAST_OPCODES = new Set(['event_broadcast', 'event_broadcastandwait', 'meshV2_broadcastWithValue']);

// ブロックの「送る」メッセージの名前（▼ の影ブロックの BROADCAST_OPTION）。レポーターを入れているなど
// 分からないときは null
const blockMessageName = (container, block) => {
    if (block.fields && block.fields.BROADCAST_OPTION) return block.fields.BROADCAST_OPTION.value;
    const input = block.inputs && block.inputs.BROADCAST_INPUT;
    if (!input || input.block !== input.shadow) return null;
    const shadow = container.getBlock(input.shadow);
    const field = shadow && shadow.fields && shadow.fields.BROADCAST_OPTION;
    return field ? field.value : null;
};

// メッシュの拡張は、ほかのノードから届いた合図を「送る」の関数（つないだときに取った関数 = 見張りの包み）を直接
// 呼んで流す（broadcast-receiver.js）。そのときの util は最後に使われたもので、スレッドは「送る」を動かしていない。
// それを「このスレッドが送った」と記録すると、届いた合図の送り手がこの作品のスプライトになる（`sentBy: 'remote'`
// が通らない・送っていないスクリプトの「送る」が数えられる）ので、スレッドがいま送るブロックにいて、そのブロックの
// メッセージが送る名前と同じときだけ記録する（たまたま別の「送る」で止まっているスレッドに数えない）。
// スタックの分からないスレッド（テストの作り物）は記録する（#1645）
const isSendingThread = (thread, args) => {
    if (typeof thread.peekStack !== 'function') return true;
    const container = thread.blockContainer || (thread.target && thread.target.blocks);
    const block =
        container && typeof container.getBlock === 'function' ? container.getBlock(thread.peekStack()) : null;
    if (!block || !BROADCAST_OPCODES.has(block.opcode)) return false;
    const option = args && args.BROADCAST_OPTION;
    const sent = option && typeof option === 'object' ? option.name : option;
    const name = blockMessageName(container, block);
    if (name === null || sent === null || typeof sent === 'undefined') return true;
    return String(name).toUpperCase() === String(sent).toUpperCase();
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
 * @param {object} [options] - 任意。
 * @param {function(): object} [options.getUi] - エディタの画面の状態（`{activeTab, partQuizSolved}`）を返す。
 *   `tab` / `partQuiz` の条件が見る。画面の状態が変わったら、返す関数の `refresh()` で判定を予約する。
 * @returns {function(): void} 見張りをやめる関数（`refresh()` で次の step に判定し直す）。
 */
export const attachGoalMonitor = (vm, goal, onSatisfied, { getUi = null } = {}) => {
    const runtime = vm.runtime;
    const facts = createFacts();
    const runs = new WeakMap();
    const baselineCostumes = takeCostumeCounts(runtime);
    const baselinePositions = takePositions(runtime);
    let dirty = true;
    let detached = false;
    // 最後にブロックを動かした run。「言う」「聞いて待つ」は、見張りが呼ばれたすぐあとに同じブロックの中で
    // 'SAY' を出すので、言ったスクリプトはこの run（said の trigger 用）
    let lastRun = null;

    const runFor = (thread) => {
        let run = runs.get(thread);
        if (!run) {
            run = startRun(facts, describeThread(thread, runtime));
            runs.set(thread, run);
        }
        return run;
    };

    const onExecute = (opcode, args, util) => {
        const thread = util && util.thread;
        // モニター（ステージの表示）のスレッドはプログラムではない
        if (!thread || thread.updateMonitor) return;
        if (BROADCAST_OPCODES.has(opcode) && !isSendingThread(thread, args)) return;
        const run = runFor(thread);
        recordExecution(facts, run, opcode, copyArgs(args));
        lastRun = run;
        dirty = true;
    };

    const onSay = (target, type, text) => {
        recordSay(facts, {
            targetId: target ? target.id : null,
            isStage: Boolean(target && target.isStage),
            text,
            variables: readScalarVariables(runtime, target),
            // ちがうスプライトの run なら、言ったスクリプトは分からない（ブロックの外から出た 'SAY'）
            run: lastRun && target && lastRun.targetId === target.id ? lastRun : null,
            remoteValues: readRemoteValues(runtime),
        });
        // 1 つのブロックが出す SAY は 1 回だけ。あとから出た SAY（「秒言う」の終わりの消去など）に使わない
        lastRun = null;
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
        // コスチュームの切りかえ・スプライトの移動（コスチュームタブで選んだときは PROJECT_CHANGED が出ない）
        ['TARGETS_UPDATE', markDirty],
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
        const ui = getUi ? getUi() || {} : {};
        if (!evaluateGoal(goal, facts, takeSnapshot(vm, baselineCostumes, baselinePositions, ui)).satisfied) return;
        detach();
        onSatisfied();
    };
    listeners.push(['BEFORE_STEP', check]);

    listeners.forEach(([event, listener]) => runtime.on(event, listener));

    detach.refresh = markDirty;
    return detach;
};
