'use strict';
/**
 * state-machine.test.js — 状態遷移の網羅テスト（docs/autopilot/state-machine.md と対）。
 *
 * Status × AI Status × HITL × Kind × 解除シグナルの全組み合わせを列挙し、
 * 「出口の無い状態（固着）」が存在しないことを機械的に担保する。
 * 状態・トリガーを増減したら state-machine.md と本テストの期待値を両方更新すること。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
    phaseForItem,
    isGateReleased,
    humanSpokeLast,
    hasUnhandledChangesRequest,
    isStuckCandidate,
    selectStalledInFlightItems,
    IN_FLIGHT_WORK_PHASE_BY_AI_STATUS,
    selectClosedToReconcile,
    TERMINAL_STATUSES,
    TRACKING_LABEL,
} = require('../src/phases');

/**
 * In Progress のとき dispatch のみが設定する実作業系 AI Status（#995）。これらに HITL が
 * 付いていても「人間の番」ではなく異常終了の残渣なので、human-resting とはみなさず
 * worker 不在時に必ず再開の出口を持たねばならない（whitelist で誤魔化さない）。
 */
const IN_FLIGHT_WORK_AI_STATUSES = new Set(Object.keys(IN_FLIGHT_WORK_PHASE_BY_AI_STATUS));

/** Project の Status 全列（New Item は No Status の内部表現） */
const STATUSES = [
    'New Item', 'Backlog', 'Sprint Backlog', 'In Progress', 'Blocked',
    'Review', 'DoD', 'Close', 'Done', 'Icebox',
];

/** AI Status 全値 + 空 */
const AI_STATUSES = [
    null, 'Triaging', 'Discussing', 'Understanding', 'Decomposing', 'EPIC Decomposed',
    'Implementing', 'Creating PR', 'Self-Reviewing', 'Addressing Comments', 'Running DoD',
    'Awaiting Continuation',
];

const KINDS = ['Issue', 'EPIC'];

/**
 * 「人間が Status を動かす（またはキューに乗せる）ことが正当な出口」の状態。
 * ここに載る状態は autopilot が自発的に触らないことが仕様（ドキュメント表 #5/#19/#20）。
 * ★ autopilot が item を「人間の番」として置くゲート状態（Review/DoD/Blocked/Discussing）を
 *   ここに載せてはならない — ゲートは解除で必ず動く必要がある（不変条件 I2/I3）。
 */
function isHumanDrivenResting(item) {
    const status = item.status || 'New Item';
    // 終端・保留は人間のみが動かす
    if (TERMINAL_STATUSES.has(status) || status === 'Icebox') return true;
    // Backlog（Discussing 以外）は「やると決めたがキュー前」= 人間が Sprint Backlog へ動かす
    if (status === 'Backlog' && item.aiStatus !== 'Discussing') return true;
    // In Progress のうち人間駆動が正当なのは、AI Status 空（人間が手で置いた・#19）と
    // EPIC Decomposed（トラッカーの resting・#16）だけ。AI 作業中マーカー付きは
    // run 所有 or stuck 検知（→ Blocked）で必ず出口がある（下の hasDaemonExit）。
    if (status === 'In Progress' && (!item.aiStatus || item.aiStatus === 'EPIC Decomposed')) return true;
    // 🙋 HITL 付きの In Progress は原則人間の番（#915）。decompose/triage の提案 HITL のように
    // Status/AI Status を動かさず待つ設計は他にも増えうるので、個別の AI Status を列挙せず
    // 汎用的に扱う。実際に解除で再開できるかは、解除できる具体的な状態（Decomposing/Triaging 等）
    // について 'phase'/'phase-after-label-release' 側で別途検証する。
    // ★ ただし**実作業系 AI Status**（#995）は例外: これらは dispatch のみが設定する in-flight
    //   マーカーで、HITL が付いていても「人間の番」ではなく異常終了の残渣（例 #972: Blocked
    //   マーキングの一時失敗で In Progress のまま 🙋 だけ付いた）。human-resting として逃がすと
    //   whitelist で出口なしを誤魔化すことになるので、必ず daemon の再開出口を要求する（下参照）。
    if (status === 'In Progress' && item.hitlLabel && !IN_FLIGHT_WORK_AI_STATUSES.has(item.aiStatus)) return true;
    return false;
}

/**
 * daemon tick ステップが**人間の追加操作なしに**出口になる状態か。
 * merge-progression / closed-reconcile は「人間が merge / close する」H トリガーの後処理なので
 * ここに数えない（数えると全非終端状態に出口があることになり、テストが無意味になる）。
 */
function hasDaemonExit(item) {
    // stuck 検知（In Progress + AI 作業中 + run 無し → Blocked + HITL）
    if (isStuckCandidate(item)) return true;
    // ストール復帰（#995）: In Progress + 実作業系 AI Status で worker が不在なら
    // 対応フェーズへ再ディスパッチする（HITL 残渣も含む）。live 空 = worker 不在で判定。
    if (selectStalledInFlightItems([item], new Set()).length > 0) return true;
    return false;
}

test('I1: 全状態に出口がある（固着状態が存在しない）', () => {
    const stuck = [];
    for (const status of STATUSES) {
        for (const aiStatus of AI_STATUSES) {
            for (const kind of KINDS) {
                for (const hitl of [false, true]) {
                    const item = {
                        issue: 1, status, aiStatus, kind, hitlLabel: hitl, labels: [], assignees: [],
                    };
                    const exits = [];
                    // A: autopilot フェーズ（現状のまま / ラベル解除後 / 発言解除後）
                    if (phaseForItem(item, {})) exits.push('phase');
                    if (phaseForItem({ ...item, hitlLabel: false }, {})) exits.push('phase-after-label-release');
                    if (phaseForItem(item, { humanSpokeLast: true })) exits.push('phase-after-comment');
                    // D: daemon tick ステップ
                    if (hasDaemonExit(item)) exits.push('daemon');
                    // H: 人間の Status 移動が正当な出口の状態
                    if (isHumanDrivenResting(item)) exits.push('human');
                    if (exits.length === 0) {
                        stuck.push(`status=${status} aiStatus=${aiStatus} kind=${kind} hitl=${hitl}`);
                    }
                }
            }
        }
    }
    assert.deepEqual(stuck, [], `出口の無い状態（固着）が見つかった:\n  ${stuck.join('\n  ')}`);
});

test('I1(tracker): 🧭 tracking 付きも merge/close 整合という出口を持つ', () => {
    for (const status of STATUSES) {
        if (TERMINAL_STATUSES.has(status)) continue;
        const item = { issue: 1, status, kind: 'EPIC', hitlLabel: false, labels: [TRACKING_LABEL] };
        // フェーズ対象外だが、closed-reconcile（人間の close / 統合 PR merge）が必ず出口になる
        assert.equal(phaseForItem(item, {}), null);
        assert.ok(
            selectClosedToReconcile([item], new Set([1])).length > 0,
            `tracker の ${status} に closed-reconcile の出口が無い`,
        );
    }
});

// ゲート = autopilot が「人間の番」として item を置く状態（+ HITL）。
// これらは (a) ラベル解除 (b) 人間の発言 のどちらでも必ず解除され、解除後の遷移先が非 null。
const GATES = [
    { name: 'Review', item: { issue: 1, status: 'Review', hitlLabel: true, kind: 'Issue', labels: [] }, expect: 'address-review' },
    { name: 'DoD', item: { issue: 1, status: 'DoD', hitlLabel: true, kind: 'Issue', labels: [] }, expect: 'address-review' },
    { name: 'Blocked(PRあり)', item: { issue: 1, status: 'Blocked', hitlLabel: true, kind: 'Issue', labels: [] }, ctx: { pr: 100 }, expect: 'address-review' },
    { name: 'Blocked(PRなし)', item: { issue: 1, status: 'Blocked', hitlLabel: true, kind: 'Issue', labels: [] }, expect: 'triage' },
    { name: 'Discussing(Backlog)', item: { issue: 1, status: 'Backlog', aiStatus: 'Discussing', hitlLabel: true, kind: 'Issue', labels: [] }, expect: 'discuss' },
    { name: 'Discussing(New Item)', item: { issue: 1, status: 'New Item', aiStatus: 'Discussing', hitlLabel: true, kind: 'Issue', labels: [] }, expect: 'discuss' },
    // 協調的チェックポイント（EPIC #906）: 元フェーズ不明時は implement にフォールバック
    { name: 'Awaiting Continuation', item: { issue: 1, status: 'In Progress', aiStatus: 'Awaiting Continuation', hitlLabel: true, kind: 'Issue', labels: [] }, expect: 'implement' },
];

test('I2/I3: 人間ゲートはラベル解除でも発言（コメント）でも必ず解除され、遷移先が定義される', () => {
    for (const g of GATES) {
        const ctx = g.ctx || {};
        // 待ち状態（解除前）は動かない
        assert.equal(phaseForItem(g.item, ctx), null, `${g.name}: 解除前に動いてはいけない`);
        // (a) Issue ラベル解除
        assert.equal(
            phaseForItem({ ...g.item, hitlLabel: false }, ctx), g.expect,
            `${g.name}: ラベル解除で ${g.expect} に遷移すべき`,
        );
        // (b) PR 側ラベルだけ外す（OR セマンティクス）
        assert.equal(
            phaseForItem(g.item, { ...ctx, hitlSignals: { issueLabel: true, prLabel: false } }), g.expect,
            `${g.name}: PR ラベル解除（OR）で ${g.expect} に遷移すべき`,
        );
        // (c) ラベルを触らず人間がコメント・レビュー送信しただけ（固着バグの再発防止）
        assert.equal(
            phaseForItem(g.item, { ...ctx, humanSpokeLast: true }), g.expect,
            `${g.name}: 人間の発言（コメントのみ・ラベル未操作）で ${g.expect} に遷移すべき`,
        );
        // (d) 両シグナル併存でも同じ
        assert.equal(
            phaseForItem(g.item, { ...ctx, hitlSignals: { issueLabel: true, prLabel: true }, humanSpokeLast: true }),
            g.expect,
            `${g.name}: ラベルが残っていても発言解除で遷移すべき`,
        );
    }
});

test('I5: 発言解除は bot の応答・処理済み watermark より後の発言にのみ反応（再発火しない）', () => {
    // 人間が最後に発言 → 解除
    assert.equal(humanSpokeLast({ lastHumanAt: 2000, lastBotAt: 1000 }), true);
    // bot が応答した後 → 再発火しない
    assert.equal(humanSpokeLast({ lastHumanAt: 2000, lastBotAt: 3000 }), false);
    // daemon が dispatch 済み（watermark）→ 同じ発言では再発火しない
    assert.equal(humanSpokeLast({ lastHumanAt: 2000, lastBotAt: 1000, handledAt: 2500 }), false);
    // watermark 後にさらに人間が発言 → 再度解除
    assert.equal(humanSpokeLast({ lastHumanAt: 3000, lastBotAt: 1000, handledAt: 2500 }), true);
    // 発言が無ければ解除しない
    assert.equal(humanSpokeLast({}), false);
    // ISO 文字列でも動く（GraphQL の createdAt/submittedAt）
    assert.equal(humanSpokeLast({ lastHumanAt: '2026-07-07T10:00:00Z', lastBotAt: '2026-07-07T09:00:00Z' }), true);
});

test('isGateReleased: ラベル解除 OR 発言解除 OR 未処理 changesRequested', () => {
    const item = { hitlLabel: true };
    assert.equal(isGateReleased(item, {}), false);
    assert.equal(isGateReleased({ hitlLabel: false }, {}), true);
    assert.equal(isGateReleased(item, { hitlSignals: { issueLabel: true, prLabel: false } }), true);
    assert.equal(isGateReleased(item, { hitlSignals: { issueLabel: true, prLabel: true } }), false);
    assert.equal(isGateReleased(item, { humanSpokeLast: true }), true);
    // #894: 未処理の新しい changesRequested があれば、ラベル/発言解除が無くても解除
    assert.equal(isGateReleased(item, { unhandledChangesRequested: true }), true);
});

test('I6: approve 後の Request changes は bot sticky の leapfrog に負けず address-review へ (#894)', () => {
    // 構造化シグナルの核: changesRequested の submittedAt が review watermark より新しいかだけを見る
    // （コメント時刻・humanSpokeLast とは独立）。
    const review = { approved: false, changesRequested: true, changesRequestedAt: 300 };
    // approve 直後の dispatch で通常 watermark（handledAt）は進んでいるが review watermark は未設定
    assert.equal(hasUnhandledChangesRequest(review, undefined), true);
    // Review item: 🙋 ラベルは projection が付け直したまま（両面あり）＋ humanSpokeLast は
    // sticky leapfrog で false。それでも address-review へ倒れる。
    const item = { status: 'Review', hitlLabel: true, kind: 'Issue', labels: [] };
    const ctx = {
        hitlSignals: { issueLabel: true, prLabel: true },
        humanSpokeLast: false,
        review,
        unhandledChangesRequested: hasUnhandledChangesRequest(review, undefined),
    };
    assert.equal(phaseForItem(item, ctx), 'address-review');
    // 一度処理して review watermark が追いつく → 同じレビューでは再発火しない
    assert.equal(hasUnhandledChangesRequest(review, 300), false);
    assert.equal(
        phaseForItem(item, { ...ctx, unhandledChangesRequested: hasUnhandledChangesRequest(review, 300) }),
        null,
    );
    // approve 単独（changesRequested 無し）は発火しない
    assert.equal(hasUnhandledChangesRequest({ approved: true, changesRequested: false }, undefined), false);
});

test('I4: hitl 提案は Status を Icebox/Close へ動かさない（プロンプト規約の静的検査）', () => {
    // プロンプト本文に「nextStatus":"Icebox"」「nextStatus":"Close"」の hitl 例が無いこと。
    // （Icebox への遷移は人間の確定操作のみ。提案段階で動かすと出口の無い状態に固着する）
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '..', 'prompts');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
        const body = fs.readFileSync(path.join(dir, f), 'utf8');
        assert.ok(
            !/"nextStatus"\s*:\s*"(Icebox|Close|Done)"/.test(body),
            `${f}: hitl 提案で Status を退避系（Icebox/Close/Done）へ動かす例が残っている`,
        );
    }
});

test('固着の回帰: In Progress で run が消えても stuck 検知 → Blocked → 解除で再開の経路がある', () => {
    // In Progress + AI 作業中（run 無し想定）は stuck 候補
    const inProgress = { issue: 1, status: 'In Progress', aiStatus: 'Implementing', hitlLabel: false, labels: [] };
    assert.equal(isStuckCandidate(inProgress), true);
    // stuck 検知後は Blocked + HITL に置かれ、そこからラベル解除/コメントで必ず再開できる
    const blocked = { issue: 1, status: 'Blocked', aiStatus: 'Implementing', hitlLabel: true, labels: [] };
    assert.equal(phaseForItem({ ...blocked, hitlLabel: false }, {}), 'triage');
    assert.equal(phaseForItem(blocked, { humanSpokeLast: true, pr: 55 }), 'address-review');
});

test('#972 回帰: In Progress + 実作業系 AI Status + 🙋 HITL 残渣は worker 不在なら再開の出口を持つ', () => {
    // #972 のデッドエンド: phaseForItem 単体では null（出口なし）— これ自体は happy-path を
    // 壊さないよう温存されている。
    const residue = { issue: 973, status: 'In Progress', aiStatus: 'Addressing Comments', hitlLabel: true, labels: [] };
    assert.equal(phaseForItem(residue, { pr: 973 }), null, 'phaseForItem は従来どおり null（残渣は phase では動かさない）');
    // 実作業系 AI Status は human-resting とみなさない（whitelist で誤魔化さない）
    assert.equal(isHumanDrivenResting(residue), false);
    // stuck 検知は HITL を除外するので拾えない（#972 が固着した理由）
    assert.equal(isStuckCandidate(residue), false);
    // worker 不在（live 空）なら selectStalledInFlightItems が対応フェーズを与える = daemon 出口あり
    assert.deepEqual(
        selectStalledInFlightItems([residue], new Set()),
        [{ issue: 973, phase: 'address-review' }],
    );
    assert.equal(hasDaemonExit(residue), true);
    // 各 in-flight AI Status × HITL が worker 不在で出口を持つことを網羅的に確認
    for (const [aiStatus, phase] of Object.entries(IN_FLIGHT_WORK_PHASE_BY_AI_STATUS)) {
        const item = { issue: 5, status: 'In Progress', aiStatus, hitlLabel: true, labels: [] };
        assert.deepEqual(selectStalledInFlightItems([item], new Set()), [{ issue: 5, phase }]);
    }
    // worker が生存している間は再開しない（走行中の run を横取りしない）
    assert.deepEqual(selectStalledInFlightItems([residue], new Set([973])), []);
});
