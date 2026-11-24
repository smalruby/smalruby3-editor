'use strict';
/**
 * epic-merge.js — EPIC 単位の確認（#2385）の daemon 側の実行（I/O のつなぎ）。
 *
 * 判断はすべて epic-flow.js の純粋関数。ここは「選ぶ → 計画 → project.js で実行」の形で、
 * daemon.js からは呼び出しだけにする（daemon.js を同時に触る担当とぶつからないよう、
 * daemon.js の apply* ステップと同じ形の関数をこのファイルに置く）。I/O はすべて deps で
 * 差し替えられる（テストは実 GitHub に触らない）。
 *
 * - {@link applyEpicRunSideEffects}: run の結果の decisions・Must が残ったときの止め方を、
 *   EPIC の「決定待ち」まとめコメントと sub-issue のコメントに書く
 * - {@link applyEpicAutoMerge}: topic 宛ての PR（Review + 🙋 なし）を、CI 通過・コンフリクト無しで
 *   マージする（Close と Issue を閉じるのは同じ tick の merge-progression）
 */

const project = require('./project');
const {
    EPIC_DECISIONS_MARKER, decisionsFromResult, daemonDecision, findEpicDecisionsComment,
    nextEpicDecisionsBody, mustExhaustedBody, autoMergePlan, selectAutoMergeCandidates, mustFixPlan,
} = require('./epic-flow');
const { nextReviewFindingsRound, sanitizeForSurface, selectRequestedReviews } = require('./phases');
const { countEpicDecisions } = require('./epic-summary');

/**
 * EPIC の「決定待ち」まとめコメントに決定待ちを書き足す（書くのは daemon だけ）。
 * 親が無い（EPIC の子でない）ときは何もしない。
 * @param {number} issue sub-issue の番号
 * @param {object[]} entries 正規化済みの決定待ち
 * @returns {Promise<number|null>} 書いた EPIC の番号
 */
async function appendEpicDecisions(issue, entries, cfg, log, deps = {}) {
    if (!entries || !entries.length) return null;
    const readTok = deps.readToken || await project.readToken();
    const botTok = deps.token || await project.botToken();
    const getParent = deps.getParentIssueNumber || project.getParentIssueNumber;
    const listComments = deps.listIssueComments || project.listIssueComments;
    const upsert = deps.upsertMarkedComment || project.upsertMarkedComment;
    const epic = await getParent(cfg.repo, issue, readTok);
    if (!epic) {
        log(`#${issue}: 親の EPIC が無いので決定待ちは書きません（${entries.length} 件）`);
        return null;
    }
    const comments = await listComments(cfg.repo, epic, readTok);
    const existing = findEpicDecisionsComment(comments);
    const body = nextEpicDecisionsBody(existing, entries);
    // EPIC の欄（epic-summary.js）の「決定待ち」の数へつなぐ。変わらなくても数は知らせる
    const count = countEpicDecisions(body || (existing && existing.body) || '');
    if (deps.onDecisions) deps.onDecisions(epic, count);
    if (!body) return epic;
    await upsert(cfg.repo, epic, [EPIC_DECISIONS_MARKER], body, botTok, { readToken: readTok });
    log(`#${issue}: EPIC #${epic} の決定待ちに ${entries.length} 件を書きました（全部で ${count} 件）`);
    return epic;
}

/**
 * run の結果の副作用（EPIC の流れ）。decisions と daemon が作る決定待ち（Must が残った・
 * 想定外の 🙋）を EPIC に書き、Must が残って止めたときは sub-issue に説明を残す。
 * 失敗しても run の反映は止めない（ログだけ）。
 * @param {object} item
 * @param {object} result 検証済み結果
 * @param {object} outcome epic-flow.js の resolveRunOutcome の結果
 * @param {{pr?: number|null}} info
 */
async function applyEpicRunSideEffects(item, result, outcome, info, cfg, log, deps = {}) {
    try {
        const where = { issue: item.issue, pr: info && info.pr };
        const entries = decisionsFromResult(result, where);
        if (outcome && outcome.escalation) entries.push(daemonDecision(outcome.escalation, where));
        if (outcome && outcome.warnings && outcome.warnings.includes('unexpected-hitl')) {
            entries.push(daemonDecision({ kind: 'unexpected-hitl', reason: sanitizeForSurface(result.reason || result.summary || '', 200) }, where));
        }
        const epic = await appendEpicDecisions(item.issue, entries.filter(Boolean), cfg, log, deps);
        if (outcome && outcome.escalation && outcome.escalation.kind === 'must-exhausted') {
            const post = deps.postIssueComment || project.postIssueComment;
            await post(cfg.repo, item.issue, mustExhaustedBody(outcome.escalation, epic), deps.token || await project.botToken());
        }
    } catch (e) {
        log(`#${item.issue}: EPIC の決定待ちの書き込みに失敗: ${sanitizeForSurface(e.message || '')}`);
    }
}

/**
 * topic 宛ての PR を自動でマージする tick ステップ。
 * - `merge` → PR をマージ（同じ tick の merge-progression が Close + Issue を閉じる）
 * - `conflict` → resolve-conflict を起動（空きがあるとき）
 * - `fix`（CI 失敗・Request changes）→ In Progress + Addressing Comments（直しが 3 回を超えたら止める）
 * - `wait` / `skip` → 何もしない
 * @param {object[]} items
 * @param {object} contexts issue → gate ctx（markAutoMergeContexts 済み）
 * @param {object} deps { resolveConflict(item), hasCapacity(), syncFaces(item, intents), patchBoard(issue, intents), ... }
 */
async function applyEpicAutoMerge(items, contexts, cfg, state, log, deps = {}) {
    const running = new Set(state.running ? state.running.keys() : []);
    const candidates = selectAutoMergeCandidates(items, running, contexts);
    if (!candidates.length) return [];
    const readTok = deps.readToken || await project.readToken();
    const botTok = deps.token || await project.botToken();
    const getFacts = deps.getPrMergeFacts || project.getPrMergeFacts;
    const merge = deps.mergePr || project.mergePr;
    const applyIntents = deps.applyIntents || project.applyIntents;
    const findItemId = deps.findItemId || project.findItemId;
    const listComments = deps.listIssueComments || project.listIssueComments;
    const listReviews = deps.listPrReviews || project.listPrReviews;
    const now = (cfg.now || Date.now)();
    const pctx = { projectId: cfg.projectId, fields: cfg.fields };
    const done = [];
    for (const item of candidates) {
        const pr = contexts[item.issue].pr;
        let plan;
        try {
            const facts = await getFacts(cfg.repo, pr, readTok);
            if (facts && facts.reviewDecision === 'CHANGES_REQUESTED') {
                const reviews = await listReviews(cfg.repo, pr, readTok);
                facts.unhandledRequestedReviews = selectRequestedReviews(reviews, await listComments(cfg.repo, pr, readTok)).length;
            }
            plan = autoMergePlan(facts, { nowMs: now });
        } catch (e) {
            log(`#${item.issue}: 自動マージの確認に失敗: ${sanitizeForSurface(e.message || '')}`);
            continue;
        }
        try {
            if (plan.action === 'merge') {
                await merge(cfg.repo, pr, botTok);
                log(`#${item.issue}: PR #${pr} を topic へ自動マージ（${plan.reason}）`);
                done.push({ issue: item.issue, action: 'merge' });
            } else if (plan.action === 'conflict') {
                if (deps.resolveConflict && (!deps.hasCapacity || deps.hasCapacity())) {
                    log(`#${item.issue}: PR #${pr} がコンフリクト → resolve-conflict`);
                    deps.resolveConflict({ ...item, pr });
                    done.push({ issue: item.issue, action: 'conflict' });
                }
            } else if (plan.action === 'fix') {
                // 直した回数は PR のレビューのまとめコメントの round から数える（状態ファイルを持たない）
                const round = Math.max(1, nextReviewFindingsRound(await listComments(cfg.repo, pr, readTok)) - 1);
                const next = mustFixPlan({ mustCount: 1, round });
                const intents = next === 'fix'
                    ? [{ field: 'Status', value: 'In Progress' }, { field: 'AI Status', value: 'Addressing Comments' }]
                    : [{ field: 'Status', value: 'Blocked' }, { field: 'AI Status', value: null }];
                const itemId = item.itemId || await findItemId(cfg.owner, cfg.project, item.issue, readTok);
                await applyIntents(pctx, itemId, intents, botTok);
                if (deps.patchBoard) deps.patchBoard(item.issue, intents);
                if (deps.syncFaces) await deps.syncFaces({ ...item, hitlLabel: next !== 'fix' }, intents);
                if (next !== 'fix') {
                    await applyEpicRunSideEffects(item, { reason: plan.reason }, {
                        escalation: { kind: 'must-exhausted', mustCount: 1, round },
                    }, { pr }, cfg, log, deps);
                }
                log(`#${item.issue}: PR #${pr} は ${plan.reason} → ${next === 'fix' ? 'address-review で直す' : '止める（直しが上限）'}`);
                done.push({ issue: item.issue, action: next });
            }
        } catch (e) {
            log(`#${item.issue}: 自動マージの処理に失敗: ${sanitizeForSurface(e.message || '')}`);
        }
    }
    return done;
}

module.exports = { appendEpicDecisions, applyEpicRunSideEffects, applyEpicAutoMerge };
