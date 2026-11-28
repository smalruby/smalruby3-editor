'use strict';
/** topic-sync.test.js — topic を develop に追従させる・プレビューを確かめてから人間に渡す（#2485） */
const { test } = require('node:test');
const assert = require('node:assert');
const ep = require('../src/epic-pr');
const em = require('../src/epic-merge');
const rc = require('../src/release-check');

const cfg = { repo: 'o/r', now: () => Date.parse('2026-11-27T01:00:00Z') };
const quiet = () => {};
const TOPIC = 'topic/classroom-grading-feedback';
const ok = (name) => ({ __typename: 'CheckRun', name, status: 'COMPLETED', conclusion: 'SUCCESS' });

test('previewStatus: 競合・CI なし・作っている・落ちた・できた', () => {
    assert.deepEqual(ep.previewStatus(null), { ready: false, state: 'no-pr' });
    assert.equal(ep.previewStatus({ mergeable: 'CONFLICTING', statusCheckRollup: [ok('preview-deploy')] }).state, 'conflict');
    assert.equal(ep.previewStatus({ mergeable: 'MERGEABLE', statusCheckRollup: [] }).state, 'no-ci');
    assert.equal(ep.previewStatus({ mergeable: 'MERGEABLE',
        statusCheckRollup: [{ __typename: 'CheckRun', name: 'preview-deploy', status: 'IN_PROGRESS' }] }).state, 'building');
    assert.equal(ep.previewStatus({ mergeable: 'MERGEABLE',
        statusCheckRollup: [{ ...ok('preview-deploy'), conclusion: 'FAILURE' }] }).state, 'failed');
    assert.equal(ep.previewStatus({ mergeable: 'MERGEABLE',
        statusCheckRollup: [{ ...ok('preview-deploy'), conclusion: 'SKIPPED' }] }).state, 'missing');
    assert.deepEqual(ep.previewStatus({ mergeable: 'MERGEABLE', statusCheckRollup: [ok('lint'), ok('preview-deploy')] }),
        { ready: true, state: 'ready' });
    // URL が 403（S3 の AccessDenied）なら、CI が通っていてもできていない
    assert.equal(ep.previewStatus({ mergeable: 'MERGEABLE', statusCheckRollup: [ok('preview-deploy')] }, { httpStatus: 403 }).state,
        'missing');
    // プレビューのジョブが無くても、URL が 200 ならできている
    assert.equal(ep.previewStatus({ mergeable: 'MERGEABLE', statusCheckRollup: [ok('lint')] }, { httpStatus: 200 }).ready, true);
    assert.equal(ep.previewStatus({ mergeable: 'MERGEABLE', statusCheckRollup: [ok('lint')] }).state, 'missing');
});

test('previewStatusText: 競合しているときの文', () => {
    assert.match(ep.previewStatusText({ state: 'conflict' }), /^develop と競合しています。プレビューはまだありません/);
    assert.match(ep.previewStatusText({ state: 'building' }), /プレビューはまだできていません/);
});

const facts = (topicPrs) => ({
    epic: { number: 2438, title: 'Classroom grading feedback', state: 'OPEN' },
    topic: TOPIC,
    branchExists: true,
    subIssues: [{ number: 2461, title: 'first', state: 'CLOSED' }],
    childPrs: [{ number: 2462, state: 'MERGED', headRefName: 'topic/autopilot-2461' }],
    topicPrs,
});

test('epicPrPlan: 競合している PR の本文は、プレビューがまだ無いと書く', () => {
    const body = ep.renderEpicPrBody({ epic: 2438, topic: TOPIC, children: [] });
    const plan = ep.epicPrPlan(facts([{ number: 2479, body, mergeable: 'CONFLICTING', statusCheckRollup: [] }]));
    assert.equal(plan.action, 'update');
    assert.match(plan.body, /⚠️ develop と競合しています。プレビューはまだありません/);
    // できていれば書かない
    const ready = ep.epicPrPlan(facts([{ number: 2479, body, mergeable: 'MERGEABLE', statusCheckRollup: [ok('preview-deploy')] }]));
    assert.doesNotMatch(ready.body || '', /まだありません/);
    // CI を待つあいだ（no-ci / building）は、次に本文を直すまで古い文として残るので書かない
    const building = ep.epicPrPlan(facts([{ number: 2479, body, mergeable: 'UNKNOWN', statusCheckRollup: [] }]));
    assert.doesNotMatch(building.body || '', /⚠️/);
    // 作るときは CI がこれからなので書かない
    assert.doesNotMatch(ep.epicPrPlan(facts([])).body, /⚠️/);
});

test('releasePreviewLine / releasePreviewUrl: まだ無ければ URL を「確かめる場所」として渡さない', () => {
    const url = 'https://preview.smalruby.app/topic-classroom-grading-feedback-146d9ec8/';
    assert.equal(rc.releasePreviewLine({ ready: true, state: 'ready' }, url), `**プレビュー**: ${url}`);
    const line = rc.releasePreviewLine({ ready: false, state: 'conflict' }, url);
    assert.match(line, /^\*\*プレビュー\*\*: まだありません — develop と競合しています/);
    assert.ok(!line.includes(url));
    assert.equal(rc.releasePreviewUrl(`${line}\n\n（前の round は ${url} で見た）`), null);
    assert.equal(rc.releasePreviewUrl(rc.releasePreviewLine({ ready: true }, url)), url);
    // 「まだ / 無し」でない書き方（リンクの形など）は、これまでどおり本文から拾う
    assert.equal(rc.releasePreviewUrl(`**プレビュー**: [開く](${url})`), url);
});

test('topicSyncBranch: 子の PR（topic/autopilot-<N>）と取り違えない', () => {
    assert.equal(ep.topicSyncBranch(TOPIC), `${TOPIC}-sync-develop`);
    assert.equal(ep.issueFromHeadBranch(ep.topicSyncBranch(TOPIC)), null);
});

test('topicSyncPlan: 競合 → resolve、取り込む PR の CI のあと → merge', () => {
    const plan = (p) => ep.topicSyncPlan({ nowMs: cfg.now(), ...p }).action;
    assert.equal(plan({ topicPr: null, syncPr: null }), 'none');
    assert.equal(plan({ topicPr: { number: 1, mergeable: 'MERGEABLE' }, syncPr: null }), 'none');
    assert.equal(plan({ topicPr: { number: 1, mergeable: 'UNKNOWN' }, syncPr: null }), 'wait');
    assert.equal(plan({ topicPr: { number: 1, mergeable: 'CONFLICTING' }, syncPr: null }), 'resolve');
    const sync = (x) => ({ state: 'OPEN', mergeable: 'MERGEABLE', statusCheckRollup: [ok('lint')], updatedAt: '2026-11-27T00:00:00Z', ...x });
    assert.equal(plan({ topicPr: null, syncPr: sync() }), 'merge');
    assert.equal(plan({ topicPr: null, syncPr: sync({ statusCheckRollup: [{ name: 'lint', status: 'QUEUED' }] }) }), 'wait');
    assert.equal(plan({ topicPr: null, syncPr: sync({ statusCheckRollup: [{ ...ok('lint'), conclusion: 'FAILURE' }] }) }), 'hitl');
    assert.equal(plan({ topicPr: null, syncPr: sync({ mergeable: 'CONFLICTING' }) }), 'hitl');
    // 人間がもうマージした → 取り込む PR は見ない
    assert.equal(plan({ topicPr: null, syncPr: sync({ state: 'MERGED' }) }), 'none');
});

test('topicSyncTarget: applyEpicTopicPrs が読んだ事実から作る（read を増やさない）', () => {
    const f = { ...facts([{ number: 2479, body: '', mergeable: 'CONFLICTING' }]), syncPr: null };
    assert.deepEqual(em.topicSyncTarget({ epic: 2438, topic: TOPIC, base: 'develop', facts: f, plan: { pr: 2479 } }),
        { epic: 2438, topic: TOPIC, base: 'develop', topicPr: { number: 2479, mergeable: 'CONFLICTING' }, syncPr: null });
});

test('applyEpicTopicSync: 競合していたら取り込みを始め、取り込む PR の CI のあとで topic にマージする', async () => {
    const state = { running: new Map() };
    const started = [];
    const merged = [];
    const refreshed = [];
    let syncFacts = null;
    const deps = {
        token: 'b', readToken: 'r',
        hasCapacity: () => true,
        startSync: (t) => started.push(t),
        getPrMergeFacts: async (repo, pr) => ({ number: pr, ...syncFacts }),
        mergePr: async (repo, pr) => merged.push(pr),
        refreshTopicPr: async (epic, topic) => refreshed.push({ epic, topic }),
        postIssueComment: async () => { throw new Error('should not post'); },
    };
    const target = { epic: 2438, topic: TOPIC, base: 'develop', topicPr: { number: 2479, mergeable: 'CONFLICTING' }, syncPr: null };
    const first = await em.applyEpicTopicSync([target], cfg, state, quiet, deps);
    assert.deepEqual(first.map((d) => d.action), ['resolve']);
    assert.deepEqual(started, [{ epic: 2438, topic: TOPIC, base: 'develop', topicPr: 2479 }]);
    // 取り込み中は見ない
    assert.deepEqual(await em.applyEpicTopicSync([], cfg, state, quiet, deps), []);
    // runTopicSync が PR を作った（state.topicSyncs に PR 番号が入る）→ CI 待ち → マージ
    state.topicSyncs[2438] = { topic: TOPIC, base: 'develop', topicPr: null, syncPr: 2484 };
    syncFacts = { state: 'OPEN', mergeable: 'MERGEABLE', statusCheckRollup: [{ name: 'lint', status: 'IN_PROGRESS' }] };
    assert.deepEqual((await em.applyEpicTopicSync([], cfg, state, quiet, deps)).map((d) => d.action), ['wait']);
    syncFacts = { state: 'OPEN', mergeable: 'MERGEABLE', statusCheckRollup: [ok('lint')] };
    assert.deepEqual((await em.applyEpicTopicSync([], cfg, state, quiet, deps)).map((d) => d.action), ['merge']);
    assert.deepEqual(merged, [2484]);
    assert.deepEqual(refreshed, [{ epic: 2438, topic: TOPIC }]);
    assert.deepEqual(state.topicSyncs, {});
});

test('applyEpicTopicSync: EPIC の worker が動いているあいだは取り込みを始めない', async () => {
    const state = { running: new Map([[2438, { phase: 'release-check' }]]) };
    const started = [];
    const deps = {
        token: 'b', readToken: 'r', hasCapacity: () => true, isRunning: (n) => state.running.has(n),
        startSync: (t) => started.push(t),
    };
    const target = { epic: 2438, topic: TOPIC, base: 'develop', topicPr: { number: 2479, mergeable: 'CONFLICTING' }, syncPr: null };
    assert.deepEqual((await em.applyEpicTopicSync([target], cfg, state, quiet, deps)).map((d) => d.action), ['resolve']);
    assert.deepEqual(started, []);
    assert.equal(state.topicSyncs[2438].polled, true);
    // 終わったら次の tick で始める
    state.running.clear();
    await em.applyEpicTopicSync([], cfg, state, quiet, deps);
    assert.equal(started.length, 1);
    // 取り込み中（live の running）に、同じ EPIC を対象として渡されても二重に始めない
    await em.applyEpicTopicSync([target], cfg, state, quiet, deps);
    assert.equal(started.length, 1);
});

test('applyEpicTopicSync: 取り込む PR の CI が落ちたら EPIC に 1 回だけ書いて人間に渡す', async () => {
    const state = { running: new Map(), topicSyncs: { 2438: { topic: TOPIC, base: 'develop', topicPr: null, syncPr: 2484 } } };
    const posts = [];
    const deps = {
        token: 'b', readToken: 'r',
        getPrMergeFacts: async () => ({ state: 'OPEN', mergeable: 'MERGEABLE', statusCheckRollup: [{ ...ok('lint'), conclusion: 'FAILURE' }] }),
        postIssueComment: async (repo, n, body) => posts.push({ n, body }),
    };
    await em.applyEpicTopicSync([], cfg, state, quiet, deps);
    await em.applyEpicTopicSync([], cfg, state, quiet, deps);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].n, 2438);
    assert.match(posts[0].body, /🙋/);
});

test('applyEpicTopicSync: mergeable が計算中なら次の tick で topic → develop の PR だけ読み直す', async () => {
    const state = { running: new Map() };
    const reads = [];
    const deps = {
        readToken: 'r', hasCapacity: () => true, startSync: () => {},
        getPrMergeFacts: async (repo, pr) => { reads.push(pr); return { mergeable: 'MERGEABLE' }; },
    };
    const target = { epic: 2438, topic: TOPIC, base: 'develop', topicPr: { number: 2479, mergeable: 'UNKNOWN' }, syncPr: null };
    assert.deepEqual((await em.applyEpicTopicSync([target], cfg, state, quiet, deps)).map((d) => d.action), ['wait']);
    assert.deepEqual(reads, []);
    assert.deepEqual((await em.applyEpicTopicSync([], cfg, state, quiet, deps)).map((d) => d.action), ['none']);
    assert.deepEqual(reads, [2479]);
    assert.deepEqual(state.topicSyncs, {});
});

function syncIo(over = {}) {
    const calls = { exec: [], created: [], posts: [], branch: [] };
    const deps = {
        token: 'b',
        worktreeBin: 'WT', botGitBin: 'BG',
        execFileP: async (cmd, args) => {
            calls.exec.push([cmd, ...args]);
            return { stdout: args[0] === 'path' ? '/wt/issue-sync-2438\n' : '' };
        },
        createBranch: async (repo, branch, from) => calls.branch.push({ branch, from }),
        followBaseBranch: async (cwd, branch) => (branch === TOPIC ? { status: 'current', baseRef: `origin/${TOPIC}` }
            : { status: 'conflict', baseRef: 'origin/develop', files: ['a.js'] }),
        runConflictResolver: async () => ({ ok: true, summary: 'a.js の両側を残した' }),
        createDraftPr: async (repo, args) => { calls.created.push(args); return 2484; },
        postIssueComment: async (repo, n, body) => calls.posts.push({ n, body }),
        ...over,
    };
    return { calls, deps };
}

test('runTopicSync: 取り込むブランチを作り、merge で解いて push し、topic 宛ての PR（draft にしない）を作る', async () => {
    const { calls, deps } = syncIo();
    const state = { running: new Map(), topicSyncs: { 2438: { running: true } } };
    const r = await em.runTopicSync({ epic: 2438, topic: TOPIC, base: 'develop', topicPr: 2479 }, cfg, state, quiet, deps);
    assert.deepEqual(r, { ok: true, pr: 2484 });
    assert.deepEqual(calls.branch, [{ branch: `${TOPIC}-sync-develop`, from: TOPIC }]);
    assert.deepEqual(calls.exec[0], ['WT', 'create', 'sync-2438', '--branch', `${TOPIC}-sync-develop`]);
    assert.ok(calls.exec.some((c) => c[0] === 'BG' && c.includes(`HEAD:refs/heads/${TOPIC}-sync-develop`)));
    assert.equal(calls.created[0].base, TOPIC);
    assert.equal(calls.created[0].draft, false);
    assert.match(calls.created[0].body, /Refs #2438/);
    assert.doesNotMatch(calls.created[0].body, /Closes/);
    assert.deepEqual(state.topicSyncs[2438], { topic: TOPIC, base: 'develop', topicPr: null, syncPr: 2484 });
    assert.equal(state.running.size, 0);
});

test('runTopicSync: 解けなければ EPIC に理由を書いて追跡をやめる', async () => {
    const { calls, deps } = syncIo({ runConflictResolver: async () => ({ ok: false, reason: '両側の意図が読めない' }) });
    const state = { running: new Map(), topicSyncs: { 2438: { running: true } } };
    const r = await em.runTopicSync({ epic: 2438, topic: TOPIC, base: 'develop', topicPr: 2479 }, cfg, state, quiet, deps);
    assert.equal(r.ok, false);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.posts[0].n, 2438);
    assert.match(calls.posts[0].body, /両側の意図が読めない/);
    assert.deepEqual(state.topicSyncs, {});
});

test('getEpicPrFacts: topic → develop の PR の mergeable と CI、取り込む PR を 1 回の GraphQL で読む', async () => {
    const project = require('../src/project');
    const args = [];
    const gh = async (a) => {
        args.push(a);
        return JSON.stringify({ data: { repository: {
            issue: { number: 2438, title: 't', state: 'OPEN', subIssues: { nodes: [] } },
            ref: { name: TOPIC },
            children: { nodes: [] },
            topicPrs: { nodes: [{ number: 2479, body: 'b', mergeable: 'CONFLICTING',
                commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [ok('lint')] } } } }] } }] },
            syncPrs: { nodes: [{ number: 2484 }] },
        } } });
    };
    const f = await project.getEpicPrFacts('o/r', 2438, TOPIC, 'develop', 't', { gh });
    assert.equal(args.length, 1);
    assert.ok(args[0].includes(`sync=${TOPIC}-sync-develop`));
    assert.deepEqual(f.topicPrs, [{ number: 2479, body: 'b', mergeable: 'CONFLICTING', statusCheckRollup: [ok('lint')] }]);
    assert.equal(f.syncPr, 2484);
});

test('epicConflictSyncTarget: EPIC の topic → develop の PR だけを取り込みの相手にする（#2536）', () => {
    const epic = { issue: 2438, kind: 'EPIC', tracker: true, subIssues: { total: 3, completed: 3 } };
    const pr = { number: 2480, state: 'OPEN', headRefName: TOPIC, baseRefName: 'develop', mergeable: 'CONFLICTING' };
    assert.deepEqual(ep.epicConflictSyncTarget(epic, pr), { epic: 2438, topic: TOPIC, base: 'develop', topicPr: 2480 });
    // EPIC でない Issue（子の PR は head が topic/autopilot-<N>・base が topic）は従来の resolve-conflict
    assert.equal(ep.epicConflictSyncTarget({ issue: 2481 }, { ...pr, headRefName: 'topic/autopilot-2481', baseRefName: TOPIC }), null);
    // EPIC でも、base が topic（入れ子）・head が topic でない・閉じた PR は相手にしない
    assert.equal(ep.epicConflictSyncTarget(epic, { ...pr, baseRefName: 'topic/other' }), null);
    assert.equal(ep.epicConflictSyncTarget(epic, { ...pr, headRefName: 'feature/x' }), null);
    assert.equal(ep.epicConflictSyncTarget(epic, { ...pr, state: 'MERGED' }), null);
    assert.equal(ep.epicConflictSyncTarget(epic, null), null);
    // 子の PR の head（topic/autopilot-<N>）は topic ブランチとして扱わない
    assert.equal(ep.epicConflictSyncTarget(epic, { ...pr, headRefName: 'topic/autopilot-2438' }), null);
});

test('resolveEpicTopicConflict: モニターの解消ボタンを、develop を topic に取り込む経路へ回す（#2536）', async () => {
    const epic = { issue: 2438, kind: 'EPIC', tracker: true, prs: [{ number: 2480, state: 'OPEN', mergeable: 'CONFLICTING' }] };
    const reads = [];
    const started = [];
    const state = {};
    const deps = {
        readToken: 'r',
        getFacts: async (repo, n) => { reads.push(n); return { number: n, state: 'OPEN', headRefName: TOPIC, baseRefName: 'develop', mergeable: 'CONFLICTING' }; },
        startSync: (t) => { started.push(t); },
    };
    const t = await em.resolveEpicTopicConflict(epic, cfg, state, quiet, deps);
    assert.deepEqual(t, { epic: 2438, topic: TOPIC, base: 'develop', topicPr: 2480 });
    assert.deepEqual(reads, [2480]);
    assert.deepEqual(started, [t]);
    assert.equal(state.topicSyncs[2438].running, true);
    // 走っているあいだにもう一度押しても二重に始めない
    assert.deepEqual(await em.resolveEpicTopicConflict(epic, cfg, state, quiet, deps), { ...t, already: true });
    assert.equal(started.length, 1);
    // EPIC でない・PR が無い ときは null（呼び出し側が従来の resolve-conflict に回す）。EPIC でなければ read もしない
    reads.length = 0;
    assert.equal(await em.resolveEpicTopicConflict({ issue: 9, prs: epic.prs }, cfg, {}, quiet, deps), null);
    assert.equal(await em.resolveEpicTopicConflict({ ...epic, prs: [] }, cfg, {}, quiet, deps), null);
    assert.deepEqual(reads, []);
});
