// === Smalruby: This file is Smalruby-specific (lesson goal: VM execution hook) ===
// 「どのブロックが、どのスレッド（＝どのハットから始まったスクリプト）で動いたか」を、
// scratch-vm を変えずに取るための仕組み。
//
// scratch-vm はブロックの実行を知らせるイベントを持たない（BLOCK_GLOW_ON は押した
// スクリプトだけ、SCRIPT_GLOW は編集中のスプライトだけ、Profiler は opcode ごとの回数
// だけでスレッドが分からない）。そこで runtime インスタンスの `getOpcodeFunction` を
// 包み、execute.js がブロックの関数（primitive）を取りに来たときに、呼び出しを記録する
// ラッパーを返す。ラッパーは `(args, util)` をそのまま元の関数へ渡し、`util.thread` から
// スレッド（topBlock・target）が分かる。
//
// 注意:
// - execute.js は取った関数を BlockCached に持つ（ブロックの編集で `resetCache` される）。
//   そのため一度包んだら runtime の間は包んだままにし、listener が無いときは何もしない
//   （goal-monitor が attach 時に全ターゲットの cache を reset して、包む前に取られた関数を
//   作り直させる）。
// - primitive の中から別の primitive を呼ぶもの（mesh v2 の broadcast など）は、外側だけを
//   記録する（depth で二重記録を防ぐ）。

const hooks = new WeakMap();

const notify = (hook, opcode, args, util) => {
    hook.listeners.forEach((listener) => {
        try {
            listener(opcode, args, util);
        } catch (error) {
            // 見張りの失敗でプログラムを止めない
            // eslint-disable-next-line no-console
            console.error('lesson goal: execution listener failed', error);
        }
    });
};

const wrapPrimitive = (hook, opcode, fn) =>
    function lessonHookedPrimitive(args, util) {
        if (hook.depth === 0 && hook.listeners.size > 0) notify(hook, opcode, args, util);
        hook.depth += 1;
        try {
            return fn(args, util);
        } finally {
            hook.depth -= 1;
        }
    };

const installHook = (runtime) => {
    const original = runtime.getOpcodeFunction;
    const hook = { listeners: new Set(), wrappers: new Map(), depth: 0, original };
    runtime.getOpcodeFunction = function getOpcodeFunction(opcode) {
        const fn = original.call(this, opcode);
        if (typeof fn !== 'function') return fn;
        const cached = hook.wrappers.get(opcode);
        // 拡張機能の読み込みや mesh v2 の差し替えで関数が変わったら包み直す
        if (cached && cached.fn === fn) return cached.wrapper;
        const wrapper = wrapPrimitive(hook, opcode, fn);
        hook.wrappers.set(opcode, { fn, wrapper });
        return wrapper;
    };
    hooks.set(runtime, hook);
    return hook;
};

/**
 * ブロックの実行を listener に知らせる。
 * @param {object} runtime - VM の runtime（`vm.runtime`）。
 * @param {function(string, object, object): void} listener - `(opcode, args, util)`。
 *   `util.thread` が動かしたスレッド、`util.target` が動かしたターゲット。
 * @returns {function(): void} listener を外す関数。
 */
export const hookOpcodeExecution = (runtime, listener) => {
    const hook = hooks.get(runtime) || installHook(runtime);
    hook.listeners.add(listener);
    return () => {
        hook.listeners.delete(listener);
    };
};

/**
 * @param {object} runtime - VM の runtime。
 * @returns {boolean} 包んであれば true（テスト用）。
 */
export const isExecutionHooked = (runtime) => hooks.has(runtime);

/**
 * execute.js の cache を作り直させる（包む前に取られた関数を置き換えるため）。
 * @param {object} runtime - VM の runtime。
 */
export const resetExecuteCaches = (runtime) => {
    const containers = [...(runtime.targets || []).map((target) => target.blocks), runtime.flyoutBlocks];
    containers.forEach((blocks) => {
        if (blocks && typeof blocks.resetCache === 'function') blocks.resetCache();
    });
};
