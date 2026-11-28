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
 * - {@link applyEpicTopicPrs}: 子を topic にマージしたあと、topic → develop の draft PR を作る・本文を直す
 *   （人間が作った PR なら進み具合のコメントを書く・#2473）。起動時は {@link bootEpicTopicPrs}
 * - {@link applyEpicTopicSync}: topic → develop の PR が develop と競合していたら、develop を topic に取り込む
 *   PR を作り（{@link runTopicSync}）、CI のあと topic にマージする（#2485）
 */

const project = require('./project');
const {
    EPIC_DECISIONS_MARKER, decisionsFromResult, daemonDecision, findEpicDecisionsComment,
    nextEpicDecisionsBody, mustExhaustedBody, autoMergePlan, selectAutoMergeCandidates, mustFixPlan, isEpicFlowBase,
} = require('./epic-flow');
const { nextReviewFindingsRound, sanitizeForSurface, selectRequestedReviews } = require('./phases');
const { countEpicDecisions } = require('./epic-summary');
const {
    EPIC_PR_STATUS_MARKER, epicPrPlan, topicMergeTargets, topicSyncBranch, renderTopicSyncBody, topicSyncPlan,
    epicConflictSyncTarget, isEpicBoardItem,
} = require('./epic-pr');

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
                done.push({ issue: item.issue, action: 'merge', base: contexts[item.issue].prBase || null });
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

/**
 * 子を topic にマージしたあと、topic → develop の draft PR を作る・本文を直す（#2473）。
 * 判断は epic-pr.js の epicPrPlan。EPIC ごとに 1 回だけ見る。失敗はログだけ（tick を止めない）。
 * @param {Array<{issue:number, base:string}>} targets topic にマージした子と、その topic
 * @param {object} deps { defaultBase, statuses（issue → Project の Status）, getParentIssueNumber, getEpicPrFacts,
 *   createDraftPr, updatePrBody, upsertMarkedComment, token, readToken }
 * @returns {Promise<Array<{epic:number, action:string, pr:(number|null)}>>}
 */
async function applyEpicTopicPrs(targets, cfg, log, deps = {}) {
    const list = (targets || []).filter((t) => t && (t.issue || t.epic) && t.base);
    if (!list.length) return [];
    const base = deps.defaultBase || 'develop';
    const readTok = deps.readToken || await project.readToken();
    const getParent = deps.getParentIssueNumber || project.getParentIssueNumber;
    const getFacts = deps.getEpicPrFacts || project.getEpicPrFacts;
    const create = deps.createDraftPr || project.createDraftPr;
    const update = deps.updatePrBody || project.updatePrBody;
    const upsert = deps.upsertMarkedComment || project.upsertMarkedComment;
    const seen = new Set();
    const done = [];
    for (const t of list) {
        try {
            // t.epic があれば親を読まない（develop を取り込んだあとに本文を直すとき・#2485）
            const epic = t.epic || await getParent(cfg.repo, t.issue, readTok);
            if (!epic || seen.has(epic)) continue;
            seen.add(epic);
            const facts = await getFacts(cfg.repo, epic, t.base, base, readTok);
            const plan = epicPrPlan(facts, { base, statuses: deps.statuses });
            // 競合の確かめ（applyEpicTopicSync）へ、読んだ事実をそのまま渡す（read を増やさない）
            if (deps.onFacts) deps.onFacts({ epic, topic: t.base, base, facts, plan });
            if (plan.action === 'skip') {
                done.push({ epic, action: 'skip', pr: plan.pr || null });
                continue;
            }
            const botTok = deps.token || await project.botToken();
            let pr = plan.pr || null;
            if (plan.action === 'create') {
                pr = await create(cfg.repo, { head: t.base, base, title: plan.title, body: plan.body }, botTok);
                log(`EPIC #${epic}: ${t.base} → ${base} の draft PR #${pr} を作りました`);
            } else if (plan.action === 'update') {
                await update(cfg.repo, pr, plan.body, botTok);
                log(`EPIC #${epic}: PR #${pr} の本文を直しました（${plan.reason}）`);
            } else if (plan.action === 'comment') {
                await upsert(cfg.repo, pr, [EPIC_PR_STATUS_MARKER], plan.body, botTok, { readToken: readTok });
                log(`EPIC #${epic}: 人間の PR #${pr} に進み具合のコメントを書きました`);
            }
            done.push({ epic, action: plan.action, pr });
        } catch (e) {
            log(`#${t.issue}: topic → ${base} の PR の更新に失敗: ${sanitizeForSurface(e.message || '')}`);
        }
    }
    return done;
}

/**
 * 起動時に 1 回だけ: 最近マージされた PR から、子が topic に入っている EPIC を見つけ、topic → develop の PR を
 * そろえる（daemon を入れる前に子が topic に入った EPIC のため・#2473）。
 * @param {object} deps applyEpicTopicPrs の deps + { listRecentMergedPrs }
 */
async function bootEpicTopicPrs(cfg, log, deps = {}) {
    const base = deps.defaultBase || 'develop';
    const readTok = deps.readToken || await project.readToken();
    const listMerged = deps.listRecentMergedPrs || project.listRecentMergedPrs;
    const targets = topicMergeTargets(await listMerged(cfg.repo, readTok), (b) => isEpicFlowBase(b, base));
    return applyEpicTopicPrs(targets, cfg, log, { ...deps, readToken: readTok });
}

/**
 * applyEpicTopicPrs が読んだ事実から、develop との追従を見る対象を作る（#2485）。
 * topic → develop の PR（目印付きを先に）と、develop を取り込む open な PR の番号。
 * @param {{epic:number, topic:string, base:string, facts:object, plan:object}} f
 * @returns {{epic:number, topic:string, base:string, topicPr:(object|null), syncPr:(number|null)}}
 */
function topicSyncTarget({ epic, topic, base, facts, plan }) {
    const prs = (facts && facts.topicPrs) || [];
    const number = plan && plan.pr;
    const topicPr = (number && prs.find((p) => p && p.number === number)) || null;
    return { epic, topic, base, topicPr: topicPr ? { number: topicPr.number, mergeable: topicPr.mergeable || null } : null,
        syncPr: (facts && facts.syncPr) || null };
}

/**
 * topic → develop の PR が develop と競合していたら、develop を topic に取り込む（#2485）。
 * GitHub は競合している PR では `pull_request` の workflow を動かさないので、そのままではプレビューが作られない。
 * 判断は epic-pr.js の topicSyncPlan。見る対象は、子を topic にマージした直後の EPIC（targets）と、
 * まだ片付いていない取り込み（`state.topicSyncs`）だけ（read は PR の数だけ・github-api.md）。
 * - resolve: {@link runTopicSync} を走らせる（空きがあるとき・fire-and-forget）
 * - merge: 取り込む PR を topic にマージし、topic → develop の PR の本文を直す
 * - hitl: EPIC に理由を 1 回だけ書き、人間に任せる（追跡はやめる）
 * - wait: 次の tick でもう一度見る
 * @param {object[]} targets {@link topicSyncTarget} の結果
 * @param {object} deps { startSync(target), hasCapacity(), isRunning(epic), getPrMergeFacts, mergePr, postIssueComment,
 *   refreshTopicPr(epic, topic), token, readToken }
 * @returns {Promise<Array<{epic:number, action:string, reason:string}>>}
 */
async function applyEpicTopicSync(targets, cfg, state, log, deps = {}) {
    if (!state.topicSyncs) state.topicSyncs = {};
    const byEpic = new Map();
    for (const [k, v] of Object.entries(state.topicSyncs)) byEpic.set(Number(k), { ...v, epic: Number(k) });
    for (const t of targets || []) if (t && t.epic && t.topic) byEpic.set(t.epic, { ...(byEpic.get(t.epic) || {}), ...t });
    if (!byEpic.size) return [];
    const getFacts = deps.getPrMergeFacts || project.getPrMergeFacts;
    const merge = deps.mergePr || project.mergePr;
    const post = deps.postIssueComment || project.postIssueComment;
    const now = (cfg.now || Date.now)();
    const done = [];
    for (const t of byEpic.values()) {
        // 同じ tick の前の項目や起動時の確認が始めたものも見る（取り込みを二重に走らせない）
        const live = state.topicSyncs[t.epic];
        if (t.running || (live && live.running)) continue;
        try {
            const readTok = deps.readToken || await project.readToken();
            let syncPr = null;
            if (t.syncPr) syncPr = await getFacts(cfg.repo, t.syncPr, readTok);
            let topicPr = t.topicPr || null;
            // 前の tick で mergeable が計算中だったものは、topic → develop の PR だけ読み直す
            if (!syncPr && topicPr && topicPr.mergeable !== 'CONFLICTING' && topicPr.mergeable !== 'MERGEABLE' && t.polled) {
                const f = await getFacts(cfg.repo, topicPr.number, readTok);
                topicPr = { number: topicPr.number, mergeable: (f && f.mergeable) || null };
            }
            const plan = topicSyncPlan({ topicPr, syncPr, nowMs: now });
            const keep = { topic: t.topic, base: t.base, topicPr, syncPr: t.syncPr || null };
            if (plan.action === 'none') {
                delete state.topicSyncs[t.epic];
            } else if (plan.action === 'wait') {
                state.topicSyncs[t.epic] = { ...keep, polled: true };
            } else if (plan.action === 'resolve') {
                // EPIC の worker（release-check など）が動いているあいだは始めない（state.running を同じ番号で使うため）
                const busy = deps.isRunning && deps.isRunning(t.epic);
                if (deps.startSync && !busy && (!deps.hasCapacity || deps.hasCapacity())) {
                    state.topicSyncs[t.epic] = { ...keep, running: true };
                    log(`EPIC #${t.epic}: topic → ${t.base} の PR #${topicPr.number} が競合 → ${t.base} を ${t.topic} に取り込む`);
                    deps.startSync({ epic: t.epic, topic: t.topic, base: t.base, topicPr: topicPr.number });
                } else {
                    state.topicSyncs[t.epic] = { ...keep, polled: true };
                }
            } else if (plan.action === 'merge') {
                await merge(cfg.repo, t.syncPr, deps.token || await project.botToken());
                delete state.topicSyncs[t.epic];
                log(`EPIC #${t.epic}: ${t.base} を取り込む PR #${t.syncPr} を ${t.topic} へマージ（${plan.reason}）`);
                if (deps.refreshTopicPr) await deps.refreshTopicPr(t.epic, t.topic);
            } else if (plan.action === 'hitl') {
                delete state.topicSyncs[t.epic];
                await post(cfg.repo, t.epic, topicSyncHitlBody(t, plan.reason), deps.token || await project.botToken());
                log(`EPIC #${t.epic}: ${t.base} の取り込みを人間に渡す（${plan.reason}）`);
            }
            done.push({ epic: t.epic, action: plan.action, reason: plan.reason });
        } catch (e) {
            log(`EPIC #${t.epic}: ${t.base || 'develop'} への追従の確認に失敗: ${sanitizeForSurface(e.message || '')}`);
        }
    }
    return done;
}

/** 取り込みを人間に渡すときのコメント（EPIC の Issue に書く） */
function topicSyncHitlBody(t, reason) {
    const pr = t.syncPr ? `取り込む PR #${t.syncPr}` : `topic → ${t.base} の PR${t.topicPr ? ` #${t.topicPr.number}` : ''}`;
    return [
        `🙋 \`${t.base}\` を topic ブランチ \`${t.topic}\` に取り込めませんでした（${sanitizeForSurface(reason || '', 300)}）。`,
        '',
        `${pr} を見て、競合を解いてください。競合しているあいだは CI が動かず、プレビューが作られません。`,
    ].join('\n');
}

/**
 * develop を topic に取り込む PR を作る（#2485・I/O）。`autopilot-resolve-conflict` と同じやり方（merge で解く・
 * rebase しない）。取り込むブランチ（{@link topicSyncBranch}）を topic から作り、専用の worktree で develop を merge し、
 * 競合したら resolve-conflict の worker に解かせ、push して topic 宛ての PR（draft にしない）を作る。
 * 失敗したら EPIC に理由を書いて人間に渡す。
 * @param {{epic:number, topic:string, base:string, topicPr:(number|null)}} t
 * @param {object} deps { execFileP, followBaseBranch, runConflictResolver, createBranch, createDraftPr,
 *   postIssueComment, worktreeBin, botGitBin, token, readToken, stopLeftovers }
 * @returns {Promise<{ok:boolean, pr?:number, reason?:string}>}
 */
async function runTopicSync(t, cfg, state, log, deps = {}) {
    const exec = deps.execFileP;
    const sync = topicSyncBranch(t.topic, t.base);
    const key = `sync-${t.epic}`;
    const botTok = deps.token || await project.botToken();
    const createBranch = deps.createBranch || project.createBranchFrom;
    const create = deps.createDraftPr || project.createDraftPr;
    const post = deps.postIssueComment || project.postIssueComment;
    const opts = { maxBuffer: 16 * 1024 * 1024 };
    if (!state.topicSyncs) state.topicSyncs = {};
    if (state.running) state.running.set(t.epic, { phase: 'resolve-conflict', session: `autopilot-resolve-conflict-${t.epic}`, since: (cfg.now || Date.now)() });
    const finish = (res) => {
        if (res.ok && res.pr) state.topicSyncs[t.epic] = { topic: t.topic, base: t.base, topicPr: null, syncPr: res.pr };
        else delete state.topicSyncs[t.epic];
        return res;
    };
    const fail = async (reason) => {
        log(`EPIC #${t.epic}: ${t.base} の取り込みに失敗: ${sanitizeForSurface(reason)}`);
        try {
            await post(cfg.repo, t.epic, topicSyncHitlBody({ ...t, topicPr: t.topicPr ? { number: t.topicPr } : null }, reason), botTok);
        } catch (e) { log(`EPIC #${t.epic}: comment failed: ${sanitizeForSurface(e.message || '')}`); }
        return finish({ ok: false, reason });
    };
    try {
        // 取り込むブランチを topic の先頭から作る（もうあれば、下で topic を merge して追いつかせる）
        await createBranch(cfg.repo, sync, t.topic, botTok).catch((e) => log(`EPIC #${t.epic}: ${sync} はもうあります（${sanitizeForSurface(e.message || '', 120)}）`));
        await exec(deps.worktreeBin, ['create', key, '--branch', sync], opts);
        const cwd = String((await exec(deps.worktreeBin, ['path', key], { encoding: 'utf8' })).stdout).trim();
        const say = (m) => log(`EPIC #${t.epic}: ${m}`);
        const up = await deps.followBaseBranch(cwd, t.topic, say);
        if (up.status === 'conflict' || up.status === 'skipped-dirty') return await fail(`${sync} を ${t.topic} に追いつかせられません（${up.status}）`);
        const follow = await deps.followBaseBranch(cwd, t.base, say, { keepConflict: true });
        if (follow.status === 'skipped-dirty') return await fail('取り込む worktree に未コミットの変更があります');
        if (follow.status === 'current' && up.status === 'current') return finish({ ok: true, reason: `${t.topic} は ${t.base} を取り込み済み` });
        let summary = '';
        if (follow.status === 'conflict') {
            const r = await deps.runConflictResolver({
                issue: t.epic, cwd, baseBranch: t.base, baseRef: follow.baseRef, files: follow.files, pr: null, cfg, log,
            });
            if (!r.ok) return await fail(r.reason || '競合を解けませんでした');
            summary = r.summary || '';
        }
        await exec(deps.botGitBin, ['push', 'origin', `HEAD:refs/heads/${sync}`], { ...opts, cwd });
        const pr = await create(cfg.repo, {
            head: sync, base: t.topic, draft: false,
            title: `chore: merge ${t.base} into ${t.topic}`,
            body: renderTopicSyncBody({ epic: t.epic, topic: t.topic, base: t.base, topicPr: t.topicPr, summary }),
        }, botTok);
        log(`EPIC #${t.epic}: ${t.base} を取り込む PR #${pr} を ${t.topic} 宛てに作りました`);
        return finish({ ok: true, pr });
    } catch (e) {
        return await fail(e.message || String(e));
    } finally {
        if (state.running) state.running.delete(t.epic);
        if (deps.stopLeftovers) deps.stopLeftovers();
    }
}

/**
 * モニターの解消ボタン（POST /resolve-conflict）を EPIC の行で押したとき、topic → develop の PR のコンフリクトを
 * develop を topic に取り込む経路（{@link runTopicSync}）で解く（#2536・I/O）。相手かどうかは
 * {@link epicConflictSyncTarget}。read は EPIC の OPEN の PR 1 件の `gh pr view` だけ（EPIC でなければ読まない）。
 * 始めたら `state.topicSyncs` に載せ、取り込む PR のマージは tick の {@link applyEpicTopicSync} が続ける。
 * @param {object} item board item（issue / kind / tracker / subIssues / prs）
 * @param {object} deps { startSync(target), getFacts(repo, pr, token), readToken }
 * @returns {Promise<object|null>} 始めた（もう走っていれば already: true）相手。相手でなければ null（呼び出し側が従来の resolve-conflict に回す）
 */
async function resolveEpicTopicConflict(item, cfg, state, log, deps = {}) {
    if (!isEpicBoardItem(item)) return null;
    const open = (item.prs || []).filter((p) => p && p.state === 'OPEN');
    const pr = open.find((p) => p.mergeable === 'CONFLICTING') || open[0];
    if (!pr) return null;
    const getFacts = deps.getFacts || ((repo, n, tok) => project.getEpicMergeFacts(repo, n, tok, {}, { files: false }));
    const facts = await getFacts(cfg.repo, pr.number, deps.readToken || await project.readToken());
    const t = epicConflictSyncTarget(item, facts);
    if (!t) return null;
    if (!state.topicSyncs) state.topicSyncs = {};
    // 走っている、または取り込む PR を作って CI 待ち（syncPr）なら始め直さない。topic → develop の PR は取り込む PR を
    // topic にマージするまで CONFLICTING のままなので、行にはまたボタンが出る。始め直すと runTopicSync が「取り込み済み」で
    // 追跡を消し、取り込む PR が topic にマージされないまま残る
    const live = state.topicSyncs[t.epic];
    if (live && (live.running || live.syncPr)) return { ...t, already: true };
    state.topicSyncs[t.epic] = { topic: t.topic, base: t.base, topicPr: { number: t.topicPr, mergeable: facts.mergeable || null },
        syncPr: null, running: true };
    log(`EPIC #${t.epic}: 解消ボタン → ${t.base} を ${t.topic} に取り込む（topic → ${t.base} の PR #${t.topicPr}）`);
    deps.startSync(t);
    return t;
}

module.exports = {
    appendEpicDecisions, applyEpicRunSideEffects, applyEpicAutoMerge, applyEpicTopicPrs, bootEpicTopicPrs,
    topicSyncTarget, applyEpicTopicSync, runTopicSync, resolveEpicTopicConflict,
};
