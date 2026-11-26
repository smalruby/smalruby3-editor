'use strict';
/** epic-pr.test.js — EPIC の topic → develop の draft PR（#2473）の純粋関数と、epic-merge.js の I/O のつなぎ */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const ep = require('../src/epic-pr');
const em = require('../src/epic-merge');

const cfg = { repo: 'o/r' };
const quiet = () => {};
const TOPIC = 'topic/classroom-grading-feedback';

const facts = (extra = {}) => ({
    epic: { number: 2438, title: 'Classroom grading feedback', state: 'OPEN' },
    topic: TOPIC,
    branchExists: true,
    subIssues: [
        { number: 2461, title: 'first | part', state: 'CLOSED' },
        { number: 2465, title: 'second', state: 'OPEN' },
        { number: 2470, title: 'third', state: 'OPEN' },
        { number: 2471, title: 'fourth', state: 'CLOSED' },
    ],
    childPrs: [
        { number: 2462, state: 'MERGED', headRefName: 'topic/autopilot-2461' },
        { number: 2466, state: 'OPEN', headRefName: 'topic/autopilot-2465' },
        { number: 2499, state: 'OPEN', headRefName: 'topic/classroom-grading-feedback-alt-2470' },
    ],
    topicPrs: [],
    ...extra,
});

test('previewSlug: scripts/preview-slug.mjs と同じ値', async () => {
    const mjs = await import(pathToFileURL(path.resolve(__dirname, '../../../scripts/preview-slug.mjs')).href);
    for (const b of ['develop', TOPIC, 'topic/autopilot-1344', 'Feature/X', 'あ', `topic/${'x'.repeat(80)}`]) {
        assert.equal(ep.previewSlug(b), mjs.previewSlug(b), b);
    }
    assert.equal(ep.previewUrlForBranch('develop'), 'https://preview.smalruby.app/develop/');
});

test('epicPrTitle: epic: + EPIC の題（頭文字は崩さない・接頭辞は重ねない）', () => {
    assert.equal(ep.epicPrTitle('Classroom grading  feedback'), 'epic: Classroom grading feedback');
    assert.equal(ep.epicPrTitle('GA の計測'), 'epic: GA の計測');
    assert.equal(ep.epicPrTitle('EPIC: ブロックのコース'), 'epic: ブロックのコース');
    assert.equal(ep.epicPrTitle('epic(studuino): Studuino モード'), 'epic(studuino): Studuino モード');
    assert.equal(ep.epicPrTitle('feat(classroom): improve'), 'epic: feat(classroom): improve');
});

test('issueFromHeadBranch: topic/autopilot-<数字> だけ', () => {
    assert.equal(ep.issueFromHeadBranch('topic/autopilot-2461'), 2461);
    assert.equal(ep.issueFromHeadBranch('topic/autopilot-redesign-2384'), null);
    assert.equal(ep.issueFromHeadBranch('topic/x-alt-2470'), null);
});

test('childStates: topic に入った / 作業中 / 待ち / 閉じた', () => {
    const f = facts();
    const s = ep.childStates(f.subIssues, f.childPrs, { 2470: 'Sprint Backlog' });
    assert.deepEqual(s.map((c) => [c.issue, c.state, c.pr]), [
        [2461, 'merged', 2462], [2465, 'working', 2466], [2470, 'waiting', null], [2471, 'closed', null],
    ]);
    // PR が無くても Project の Status が作業中なら作業中
    assert.equal(ep.childStates(f.subIssues, f.childPrs, { 2470: 'In Progress' })[2].state, 'working');
    // 🧱 infra の子: develop へマージ済みで Issue は開いたまま・Project は Close → 閉じた（作業中・待ちにしない）
    assert.equal(ep.childStates(f.subIssues, f.childPrs, { 2470: 'Close' })[2].state, 'closed');
});

test('epicPrPlan: 子が topic に入っていなければ作らない', () => {
    const plan = ep.epicPrPlan(facts({ childPrs: [] }));
    assert.equal(plan.action, 'skip');
});

test('epicPrPlan: EPIC が閉じている・topic が無いときは何もしない', () => {
    assert.equal(ep.epicPrPlan(facts({ epic: { number: 2438, title: 't', state: 'CLOSED' } })).action, 'skip');
    assert.equal(ep.epicPrPlan(facts({ branchExists: false })).action, 'skip');
    assert.equal(ep.epicPrPlan(null).action, 'skip');
});

test('epicPrPlan: PR が無ければ draft で作る（本文に目印・Refs・プレビュー・sub-issue の状態）', () => {
    const plan = ep.epicPrPlan(facts());
    assert.equal(plan.action, 'create');
    assert.equal(plan.title, 'epic: Classroom grading feedback');
    assert.ok(plan.body.startsWith('<!-- autopilot-epic-pr epic=2438 -->\n'));
    assert.match(plan.body, /^Refs #2438$/m);
    assert.doesNotMatch(plan.body, /Closes #2438/);
    assert.ok(plan.body.includes(ep.previewUrlForBranch(TOPIC)));
    assert.ok(plan.body.includes('| #2461 first ｜ part | ✅ topic に入った | #2462 |'));
    assert.ok(plan.body.includes('| #2465 second | 🚧 作業中 | #2466 |'));
    assert.ok(plan.body.includes('topic に入った: 1 / 4'));
    assert.ok(plan.body.includes('develop へのマージは、人間がリリース確認のあとで行います'));
});

test('epicPrPlan: 2 回目以降は作らず、本文が変わったときだけ直す', () => {
    const body = ep.epicPrPlan(facts()).body;
    const same = ep.epicPrPlan(facts({ topicPrs: [{ number: 2480, body: body.replace(/\n/g, '\r\n') }] }));
    assert.equal(same.action, 'skip');
    assert.equal(same.pr, 2480);
    const moved = facts({ topicPrs: [{ number: 2480, body }] });
    moved.childPrs[1] = { number: 2466, state: 'MERGED', headRefName: 'topic/autopilot-2465' };
    const plan = ep.epicPrPlan(moved);
    assert.equal(plan.action, 'update');
    assert.equal(plan.pr, 2480);
    assert.ok(plan.body.includes('topic に入った: 2 / 4'));
});

test('epicPrPlan: 人間が作った PR があれば作らず、目印付きのコメントで進み具合を出す', () => {
    const plan = ep.epicPrPlan(facts({ topicPrs: [{ number: 2490, body: '人間の説明' }] }));
    assert.equal(plan.action, 'comment');
    assert.equal(plan.pr, 2490);
    assert.ok(plan.body.startsWith('<!-- autopilot-epic-pr-status epic=2438 -->'));
    assert.ok(plan.body.includes(ep.previewUrlForBranch(TOPIC)));
    // 目印付きの PR があればそちらを選ぶ
    const body = ep.epicPrPlan(facts()).body;
    assert.equal(ep.selectEpicPr([{ number: 1, body: 'x' }, { number: 2, body }], 2438).number, 2);
    // 別の EPIC の目印を持つ PR は選ばない
    assert.equal(ep.selectEpicPr([{ number: 3, body: ep.epicPrMarker(9) }], 2438), null);
});

test('topicMergeTargets: topic 宛ての子の PR を topic ごとに 1 つ（新しい順の先頭）', () => {
    const isTopic = (b) => String(b).startsWith('topic/');
    const t = ep.topicMergeTargets([
        { number: 5, baseRefName: TOPIC, headRefName: 'topic/autopilot-2465' },
        { number: 4, baseRefName: TOPIC, headRefName: 'topic/autopilot-2461' },
        { number: 3, baseRefName: 'develop', headRefName: 'topic/autopilot-2400' },
        { number: 2, baseRefName: 'topic/other', headRefName: 'feature/x' },
        { number: 1, baseRefName: 'topic/other', headRefName: 'topic/autopilot-2300' },
    ], isTopic);
    assert.deepEqual(t, [{ issue: 2465, base: TOPIC }, { issue: 2300, base: 'topic/other' }]);
});

const ioDeps = (store) => ({
    token: 'b', readToken: 'r',
    getParentIssueNumber: async () => 2438,
    getEpicPrFacts: async (repo, epic, topic, base) => {
        store.factsCalls.push({ epic, topic, base });
        return facts({ topicPrs: store.prs });
    },
    createDraftPr: async (repo, args) => {
        store.created.push(args);
        store.prs.push({ number: 2480, body: args.body });
        return 2480;
    },
    updatePrBody: async (repo, pr, body) => {
        store.updated.push(pr);
        store.prs.find((p) => p.number === pr).body = body;
    },
    upsertMarkedComment: async (repo, pr, markers, body) => store.comments.push({ pr, markers, body }),
});

test('applyEpicTopicPrs: 最初のマージで draft PR を作り、2 回目は同じ本文なら書かない', async () => {
    const store = { prs: [], created: [], updated: [], comments: [], factsCalls: [] };
    const targets = [{ issue: 2461, base: TOPIC }, { issue: 2465, base: TOPIC }];
    const first = await em.applyEpicTopicPrs(targets, cfg, quiet, ioDeps(store));
    // 同じ EPIC は 1 回だけ見る
    assert.equal(store.factsCalls.length, 1);
    assert.deepEqual(store.factsCalls[0], { epic: 2438, topic: TOPIC, base: 'develop' });
    assert.deepEqual(first, [{ epic: 2438, action: 'create', pr: 2480 }]);
    assert.equal(store.created[0].head, TOPIC);
    assert.equal(store.created[0].base, 'develop');
    assert.equal(store.created[0].title, 'epic: Classroom grading feedback');
    const second = await em.applyEpicTopicPrs(targets, cfg, quiet, ioDeps(store));
    assert.deepEqual(second, [{ epic: 2438, action: 'skip', pr: 2480 }]);
    assert.equal(store.created.length, 1);
    assert.equal(store.updated.length, 0);
});

test('applyEpicTopicPrs: 人間の PR にはコメントを upsert し、本文は書かない', async () => {
    const store = { prs: [{ number: 2490, body: '人間' }], created: [], updated: [], comments: [], factsCalls: [] };
    await em.applyEpicTopicPrs([{ issue: 2461, base: TOPIC }], cfg, quiet, ioDeps(store));
    assert.equal(store.created.length, 0);
    assert.equal(store.updated.length, 0);
    assert.equal(store.comments[0].pr, 2490);
    assert.deepEqual(store.comments[0].markers, [ep.EPIC_PR_STATUS_MARKER]);
});

test('applyEpicTopicPrs: 親が無い・失敗してもほかを止めない', async () => {
    const logs = [];
    const deps = {
        ...ioDeps({ prs: [], created: [], updated: [], comments: [], factsCalls: [] }),
        getParentIssueNumber: async (repo, n) => {
            if (n === 1) throw new Error('boom');
            return n === 2 ? null : 2438;
        },
    };
    const done = await em.applyEpicTopicPrs([{ issue: 1, base: TOPIC }, { issue: 2, base: TOPIC }, { issue: 3, base: TOPIC }],
        cfg, (m) => logs.push(m), deps);
    assert.deepEqual(done.map((d) => d.action), ['create']);
    assert.ok(logs.some((m) => m.includes('boom')));
});

test('bootEpicTopicPrs: 最近マージされた topic 宛ての子から EPIC を見つける', async () => {
    const store = { prs: [], created: [], updated: [], comments: [], factsCalls: [] };
    const done = await em.bootEpicTopicPrs(cfg, quiet, {
        ...ioDeps(store),
        listRecentMergedPrs: async () => [
            { number: 2462, baseRefName: TOPIC, headRefName: 'topic/autopilot-2461' },
            { number: 2400, baseRefName: 'develop', headRefName: 'topic/autopilot-2399' },
        ],
    });
    assert.deepEqual(done, [{ epic: 2438, action: 'create', pr: 2480 }]);
});

test('applyEpicAutoMerge の結果に topic（base）が入る', async () => {
    const items = [{ issue: 1, itemId: 'I1', status: 'Review', hitlLabel: false, kind: 'Issue', labels: [] }];
    const contexts = { 1: { pr: 11, prBase: TOPIC, autoMerge: true } };
    const done = await em.applyEpicAutoMerge(items, contexts, { ...cfg, now: () => Date.parse('2026-11-24T01:00:00Z') },
        { running: new Map() }, quiet, {
            token: 'b', readToken: 'r',
            getPrMergeFacts: async () => ({
                number: 11, state: 'OPEN', isDraft: false, baseRefName: TOPIC, mergeable: 'MERGEABLE',
                reviewDecision: null, updatedAt: '2026-11-24T00:00:00Z',
                statusCheckRollup: [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }],
            }),
            mergePr: async () => {},
        });
    assert.deepEqual(done, [{ issue: 1, action: 'merge', base: TOPIC }]);
});

test('project.getEpicPrFacts / createDraftPr: GraphQL 1 回・REST で draft', async () => {
    const project = require('../src/project');
    const calls = [];
    const gh = async (args) => {
        calls.push(args);
        if (args[0] === 'api' && args[1] === 'graphql') {
            return JSON.stringify({ data: { repository: {
                issue: { number: 2438, title: 'T', state: 'OPEN', subIssues: { nodes: [{ number: 2461, title: 'a', state: 'CLOSED' }] } },
                ref: { name: TOPIC },
                children: { nodes: [{ number: 2462, state: 'MERGED', headRefName: 'topic/autopilot-2461' }] },
                topicPrs: { nodes: [] },
            } } });
        }
        return '2480\n';
    };
    const f = await project.getEpicPrFacts('o/r', 2438, TOPIC, 'develop', 't', { gh });
    assert.equal(f.branchExists, true);
    assert.equal(f.epic.title, 'T');
    assert.equal(f.subIssues.length, 1);
    assert.equal(f.childPrs[0].number, 2462);
    assert.ok(calls[0].includes(`ref=refs/heads/${TOPIC}`));
    assert.equal(ep.epicPrPlan(f).action, 'create');
    const n = await project.createDraftPr('o/r', { head: TOPIC, base: 'develop', title: 'x', body: 'y' }, 't', { gh });
    assert.equal(n, 2480);
    assert.ok(calls[1].includes('draft=true'));
});
