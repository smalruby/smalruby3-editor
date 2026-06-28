'use strict';
/**
 * phases.js — フェーズ↔スキルの対応、結果→Project フィールド意図への変換、
 * watchdog の判断ロジック。すべて純粋関数（I/O なし）でテスト可能にする。
 */

/**
 * 子 claude を起動する既定コマンド。
 * **非対話**で動かすため `--allowedTools` を広げ、`gh`/`git` 等の Bash 実行で
 * 権限プロンプト（= 課題2 の停止要因）が出ないようにする。コントラクト §1 準拠。
 * 上書きは CLI の `--command` または env `AUTOPILOT_CLAUDE_CMD`。
 */
const DEFAULT_CLAUDE_COMMAND =
    'claude --permission-mode acceptEdits --allowedTools Bash Edit Read Glob Grep WebFetch';

/** CLI コマンド名 → { skill, aiStatus }（AI Status は実行中に設定する細フェーズ） */
const PHASE_BY_COMMAND = {
    triage: { skill: 'autopilot-triage', aiStatus: 'Triaging' },
    understand: { skill: 'autopilot-understand', aiStatus: 'Understanding' },
    decompose: { skill: 'autopilot-decompose', aiStatus: 'Decomposing' },
    implement: { skill: 'autopilot-implement', aiStatus: 'Implementing' },
    review: { skill: 'autopilot-review', aiStatus: 'Self-Reviewing' },
    'address-review': { skill: 'autopilot-address-review', aiStatus: 'Addressing Comments' },
    verify: { skill: 'autopilot-verify', aiStatus: 'Running DoD' },
};

/**
 * 結果ペイロードを Project フィールドの設定意図に変換する。
 * 値が null のものは「クリア」を意味する。単一ライター原則: 実際の書き込みは
 * daemon/CLI が行う（スキルは書かない）。
 * @param {object} result 検証済み結果ペイロード
 * @returns {Array<{field: string, value: string|null}>}
 */
function applyResult(result) {
    const intents = [];
    const set = (field, value) => intents.push({ field, value });

    if (result.signal === 'done') {
        if (result.nextStatus !== undefined) set('Status', result.nextStatus);
        // 完了時は AI Status をクリア（明示指定があればそれを使う）
        set('AI Status', result.nextAiStatus != null ? result.nextAiStatus : null);
        set('HITL', result.hitl ? 'Yes' : 'No');
        if (result.size != null) set('Size', result.size);
        if (result.kind != null) set('Kind', result.kind);
    } else if (result.signal === 'hitl') {
        set('HITL', 'Yes');
        if (result.nextStatus != null) set('Status', result.nextStatus);
        if (result.nextAiStatus != null) set('AI Status', result.nextAiStatus);
    } else if (result.signal === 'error') {
        set('Status', 'Blocked');
        set('HITL', 'Yes');
    }
    return intents;
}

/**
 * HITL の解除判定（OR セマンティクス）。
 *
 * HITL は複数面に投影される（Project の HITL フィールド / Issue の `🙋 HITL` ラベル /
 * PR の `🙋 HITL` ラベル）。人間がそれら全部を No にするのは二重管理で大変なので、
 * **適用される signal のいずれか1つでも No（解除）になったら処理を進める**。
 * 逆に「人間に渡す（set）」ときは daemon が全面を一括 Yes にして整合を保つ。
 *
 * @param {object} signals 各面の "まだ人間待ちか"。true=待ち / false=解除 / undefined=非適用
 * @param {boolean} [signals.projectField] Project HITL フィールド（Yes→true / No→false）
 * @param {boolean} [signals.issueLabel] Issue に HITL ラベルが付いているか
 * @param {boolean} [signals.prLabel] PR に HITL ラベルが付いているか（PR 無しは undefined）
 * @returns {boolean} 解除されたら true（autopilot は処理を進める）
 */
function isHitlReleased(signals) {
    const applicable = [signals.projectField, signals.issueLabel, signals.prLabel].filter(
        (v) => v !== undefined,
    );
    return applicable.some((v) => v === false);
}

/**
 * merge は HITL と独立した「前進シグナル」。PR が merge されたとき、ひも付く Issue を
 * どの Status へ進めるかを返す（純粋関数）。
 * - leaf（Kind=Issue）: `Close`（HITL ラベル/フィールドが残っていても進める）
 * - EPIC: `null`（子 PR の merge では完了しない。EPIC 運用 原則3/4）
 * @param {string} kind `EPIC` | `Issue`（未指定は leaf 扱い）
 * @returns {string|null} 進める先の Status、または進めない場合 null
 */
function progressOnMerge(kind) {
    return kind === 'EPIC' ? null : 'Close';
}

/**
 * Project item から「次に autopilot が自律実行すべきフェーズ」を決める（純粋関数）。
 * 人間駆動の状態（Review/DoD/Close/Backlog/Icebox/Paused）や HITL=Yes では null（何もしない）。
 * @param {object} item { status, aiStatus, hitl, kind }
 * @returns {string|null} フェーズ名（triage/decompose/implement ...）または null
 */
function phaseForItem(item) {
    if (!item) return null;
    if (item.hitl === 'Yes') return null; // 人間の番
    const status = item.status || 'New Item';
    if (status === 'New Item') return 'triage';
    if (status === 'Sprint Backlog') {
        return item.kind === 'EPIC' ? 'decompose' : 'implement';
    }
    // In Progress は実行中の run が所有。Review/DoD/Close 等は人間駆動。
    return null;
}

/**
 * item が今 autopilot の処理対象か（純粋関数）。
 * @param {object} item
 * @param {object} [opts] { paused }
 * @returns {boolean}
 */
function isActionable(item, opts = {}) {
    if (opts.paused) return false;
    return phaseForItem(item) !== null;
}

/**
 * 着手すべき item を並行上限内で選ぶ（純粋関数）。
 * @param {object[]} items 各 { issue, status, aiStatus, hitl, kind }
 * @param {object} opts { paused, running:Set<number>, limit }
 * @returns {object[]} 実行対象（issue + phase）
 */
function selectActionable(items, opts = {}) {
    const running = opts.running || new Set();
    const limit = opts.limit ?? 2;
    const out = [];
    for (const item of items) {
        if (out.length >= Math.max(0, limit - running.size)) break;
        if (running.has(item.issue)) continue;
        if (!isActionable(item, opts)) continue;
        out.push({ ...item, phase: phaseForItem(item) });
    }
    return out;
}

/**
 * watchdog の状態を評価して次アクションを返す（純粋関数）。
 * 完了の権威は「結果ファイルの存在」。それ以外はタイマーで stuck を処理する。
 * @param {object} state
 * @param {boolean} state.resultPresent 結果ファイルが書かれたか
 * @param {boolean} state.ready claude が入力受付可能になったか
 * @param {boolean} state.dead claude プロセスが終了したか（結果なしで死んだ）
 * @param {number} state.elapsedMs 起動からの経過
 * @param {number} state.idleMs pane が変化していない時間
 * @param {number} state.restarts これまでの再起動回数
 * @param {object} cfg
 * @param {number} cfg.tReadyMs 起動完了の許容時間（課題1）
 * @param {number} cfg.tIdleMs 無変化で stuck とみなす時間（課題2）
 * @param {number} cfg.tMaxMs 絶対上限（課題3）
 * @param {number} cfg.maxRestarts 再起動上限
 * @returns {{action: 'collect'|'wait'|'restart'|'fail', reason: string}}
 */
function evaluate(state, cfg) {
    // 1. 結果ファイルが書かれていれば最優先で回収（done/hitl/error は中身で判定）
    if (state.resultPresent) {
        return { action: 'collect', reason: 'result file present' };
    }
    // 3. 絶対上限超過は即失敗（暴走の最終防壁・課題3）
    if (state.elapsedMs > cfg.tMaxMs) {
        return { action: 'fail', reason: `exceeded tMax (${cfg.tMaxMs}ms)` };
    }
    const canRestart = state.restarts < cfg.maxRestarts;
    // 4. 結果なしでプロセスが死んだ（課題4）
    if (state.dead) {
        return canRestart
            ? { action: 'restart', reason: 'process exited without result' }
            : { action: 'fail', reason: 'process exited without result; restart limit reached' };
    }
    // 1. 起動できず入力受付に至らない（課題1）
    if (!state.ready && state.elapsedMs > cfg.tReadyMs) {
        return canRestart
            ? { action: 'restart', reason: `not ready within tReady (${cfg.tReadyMs}ms)` }
            : { action: 'fail', reason: 'not ready; restart limit reached' };
    }
    // 2. 入力受付後に長時間無変化＝インタビュー等で停止（課題2）
    if (state.ready && state.idleMs > cfg.tIdleMs) {
        return canRestart
            ? { action: 'restart', reason: `idle/stalled beyond tIdle (${cfg.tIdleMs}ms)` }
            : { action: 'fail', reason: 'stalled; restart limit reached' };
    }
    return { action: 'wait', reason: 'in progress' };
}

const DEFAULT_WATCHDOG = {
    tReadyMs: 60_000,
    // claude の思考/実行は数分に及ぶ。busy 検知（runner の BUSY_RE）が主防御で、
    // これは pane が完全停止した場合の保険なので長め（10 分）にする。
    tIdleMs: 600_000,
    tMaxMs: 1_800_000,
    maxRestarts: 2,
    pollMs: 3_000,
};

module.exports = {
    PHASE_BY_COMMAND,
    DEFAULT_CLAUDE_COMMAND,
    applyResult,
    isHitlReleased,
    progressOnMerge,
    phaseForItem,
    isActionable,
    selectActionable,
    evaluate,
    DEFAULT_WATCHDOG,
};
