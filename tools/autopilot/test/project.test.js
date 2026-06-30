'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const {
    normalizeProjectItem,
    selectClosingPr,
    selectHeadPr,
    hasMergedHeadPr,
    findPrForIssue,
    hasMergedPullRequest,
    listClosedIssueNumbers,
    closeIssue,
} = require('../src/project');
const { HITL_LABEL, AUTOPILOT_LABEL, autopilotHeadBranch } = require('../src/phases');

test('normalizeProjectItem: surfaces labels and derives hitlLabel from 🙋 label (#813)', () => {
    const raw = {
        id: 'PVTI_x',
        content: { number: 813, title: 'refactor HITL' },
        status: 'Review',
        'aI Status': null,
        kind: 'Issue',
        size: 'small',
        labels: [AUTOPILOT_LABEL, HITL_LABEL],
    };
    const item = normalizeProjectItem(raw);
    assert.equal(item.issue, 813);
    assert.equal(item.itemId, 'PVTI_x');
    assert.equal(item.title, 'refactor HITL');
    assert.equal(item.status, 'Review');
    assert.equal(item.aiStatus, null);
    assert.equal(item.kind, 'Issue');
    assert.equal(item.size, 'small');
    assert.deepEqual(item.labels, [AUTOPILOT_LABEL, HITL_LABEL]);
    assert.equal(item.hitlLabel, true);
});

test('normalizeProjectItem: no 🙋 label -> hitlLabel false; does not read HITL field', () => {
    const raw = {
        id: 'PVTI_y',
        content: { number: 1, title: 't' },
        status: 'In Progress',
        aiStatus: 'Implementing',
        labels: [AUTOPILOT_LABEL],
        // a stale Project HITL field value must be ignored (#813: daemon never reads it)
        hITL: 'Yes',
    };
    const item = normalizeProjectItem(raw);
    assert.equal(item.hitlLabel, false);
    assert.equal(item.aiStatus, 'Implementing');
    assert.ok(!('hitl' in item)); // no Project-field-derived HITL key
});

test('normalizeProjectItem: missing labels array defaults to empty (hitlLabel false)', () => {
    const item = normalizeProjectItem({ id: 'z', content: { number: 2, title: 't' }, status: 'New Item' });
    assert.deepEqual(item.labels, []);
    assert.equal(item.hitlLabel, false);
});

// selectClosingPr (#825): pick the PR that GitHub recognizes as actually closing the
// issue (closedByPullRequestsReferences), preferring open over merged/closed. This
// replaces the old `Closes #N in:body` full-text search that false-hit on PRs which
// merely mention `#N` in their body/commits.

const prNode = (number, state, extra = {}) => ({
    number,
    state,
    isDraft: false,
    headRefName: `topic/${number}`,
    labels: { nodes: [] },
    ...extra,
});

test('selectClosingPr: prefers an open PR over a merged one that also closes the issue', () => {
    // The reproduction from #825: #631 is closed by open PR 818, but PR 822 (merged)
    // appears in the reference set. The open PR must win.
    const nodes = [prNode(822, 'MERGED'), prNode(818, 'OPEN')];
    const pr = selectClosingPr(nodes);
    assert.equal(pr.number, 818);
    assert.equal(pr.isDraft, false);
    assert.equal(pr.branch, 'topic/818');
});

test('selectClosingPr: among multiple open PRs, picks the newest (highest number)', () => {
    const nodes = [prNode(818, 'OPEN'), prNode(905, 'OPEN'), prNode(870, 'OPEN')];
    assert.equal(selectClosingPr(nodes).number, 905);
});

test('selectClosingPr: normalizes labels to a name array', () => {
    const nodes = [prNode(900, 'OPEN', { labels: { nodes: [{ name: '🤖 autopilot' }, { name: '🙋 HITL' }] } })];
    assert.deepEqual(selectClosingPr(nodes).labels, ['🤖 autopilot', '🙋 HITL']);
});

test('selectClosingPr: returns null when no open PR closes the issue', () => {
    assert.equal(selectClosingPr([prNode(822, 'MERGED'), prNode(700, 'CLOSED')]), null);
    assert.equal(selectClosingPr([]), null);
    assert.equal(selectClosingPr(null), null);
});

// --- #831: base 非依存の head ブランチ解決 -------------------------------------
// GitHub は PR が非デフォルトブランチ宛て（EPIC サブ Issue を epic ブランチに積む等）の場合、
// 本文の `Closes #N` を closedByPullRequestsReferences に登録しない。autopilot の PR は必ず
// head ブランチが topic/autopilot-<N> なので、close リンクが空のときはこれで base 非依存に解決する。

test('autopilotHeadBranch: composes topic/autopilot-<N> (matches bin/autopilot-worktree)', () => {
    assert.equal(autopilotHeadBranch(827), 'topic/autopilot-827');
    assert.equal(autopilotHeadBranch(827, 'topic/foo-'), 'topic/foo-827');
});

// selectHeadPr normalizes the `gh pr list --json` shape (labels is a flat array of {name},
// unlike the GraphQL `labels.nodes` shape that selectClosingPr consumes).
test('selectHeadPr: normalizes gh pr list shape; picks newest open', () => {
    const pr = selectHeadPr([
        { number: 828, isDraft: true, headRefName: 'topic/autopilot-827', labels: [{ name: '🤖 autopilot' }, { name: '🙋 HITL' }] },
    ]);
    assert.equal(pr.number, 828);
    assert.equal(pr.isDraft, true);
    assert.equal(pr.branch, 'topic/autopilot-827');
    assert.deepEqual(pr.labels, ['🤖 autopilot', '🙋 HITL']);
});

test('selectHeadPr: multiple -> highest number; empty/null -> null', () => {
    const mk = (n) => ({ number: n, isDraft: false, headRefName: `topic/autopilot-${n}`, labels: [] });
    assert.equal(selectHeadPr([mk(810), mk(905), mk(870)]).number, 905);
    assert.equal(selectHeadPr([]), null);
    assert.equal(selectHeadPr(null), null);
});

test('hasMergedHeadPr: true iff a merged PR is present', () => {
    assert.equal(hasMergedHeadPr([{ number: 828, state: 'MERGED' }]), true);
    assert.equal(hasMergedHeadPr([{ number: 828, state: 'OPEN' }]), false);
    assert.equal(hasMergedHeadPr([]), false);
    assert.equal(hasMergedHeadPr(null), false);
});

// findPrForIssue: close リンク優先 → 無ければ head ブランチ検索（base 非依存）。
test('findPrForIssue: falls back to head search when close link is empty (#831)', () => {
    const calls = [];
    const fakeGh = (args) => {
        calls.push(args);
        if (args.includes('graphql')) {
            return JSON.stringify({ data: { repository: { issue: { closedByPullRequestsReferences: { nodes: [] } } } } });
        }
        return JSON.stringify([
            { number: 828, isDraft: true, headRefName: 'topic/autopilot-827', labels: [{ name: '🙋 HITL' }] },
        ]);
    };
    const pr = findPrForIssue('smalruby/smalruby3-editor', 827, 'tok', { gh: fakeGh });
    assert.equal(pr.number, 828);
    assert.deepEqual(pr.labels, ['🙋 HITL']);
    const listCall = calls.find((a) => a.includes('list'));
    assert.ok(listCall, 'head search (pr list) must run when close link is empty');
    assert.ok(listCall.includes('topic/autopilot-827'), 'head search must target topic/autopilot-<N>');
    assert.ok(listCall.includes('open'), 'head search must filter to open PRs');
});

test('findPrForIssue: close link wins; head search is not performed (regression)', () => {
    const calls = [];
    const fakeGh = (args) => {
        calls.push(args);
        return JSON.stringify({ data: { repository: { issue: { closedByPullRequestsReferences: { nodes: [
            { number: 900, state: 'OPEN', isDraft: false, headRefName: 'topic/autopilot-900', labels: { nodes: [] } },
        ] } } } } });
    };
    const pr = findPrForIssue('o/r', 900, 'tok', { gh: fakeGh });
    assert.equal(pr.number, 900);
    assert.equal(calls.length, 1, 'must short-circuit on close link (no fallback gh call)');
});

// hasMergedPullRequest: close リンクの merged → 無ければ head ブランチの merged PR を見る。
test('hasMergedPullRequest: detects merge to non-default base via head branch (#831)', () => {
    const calls = [];
    const fakeGh = (args) => {
        calls.push(args);
        if (args.includes('graphql')) {
            return JSON.stringify({ data: { repository: { issue: { closedByPullRequestsReferences: { nodes: [] } } } } });
        }
        return JSON.stringify([{ number: 828, state: 'MERGED' }]);
    };
    assert.equal(hasMergedPullRequest('o/r', 827, 'tok', { gh: fakeGh }), true);
    const listCall = calls.find((a) => a.includes('list'));
    assert.ok(listCall.includes('topic/autopilot-827'));
});

test('hasMergedPullRequest: close-link merged short-circuits head search', () => {
    let listCalled = false;
    const fakeGh = (args) => {
        if (args.includes('graphql')) {
            return JSON.stringify({ data: { repository: { issue: { closedByPullRequestsReferences: { nodes: [{ merged: true }] } } } } });
        }
        listCalled = true;
        return '[]';
    };
    assert.equal(hasMergedPullRequest('o/r', 1, 'tok', { gh: fakeGh }), true);
    assert.equal(listCalled, false);
});

test('hasMergedPullRequest: false when neither close link nor head branch is merged', () => {
    const fakeGh = (args) => {
        if (args.includes('graphql')) {
            return JSON.stringify({ data: { repository: { issue: { closedByPullRequestsReferences: { nodes: [{ merged: false }] } } } } });
        }
        return JSON.stringify([]);
    };
    assert.equal(hasMergedPullRequest('o/r', 5, 'tok', { gh: fakeGh }), false);
});

test('listClosedIssueNumbers: returns a Set of closed issue numbers (#843)', () => {
    let captured;
    const fakeGh = (args) => {
        captured = args;
        return JSON.stringify([{ number: 738 }, { number: 839 }, { number: 840 }]);
    };
    const set = listClosedIssueNumbers('smalruby/smalruby3-editor', 'tok', { gh: fakeGh });
    assert.ok(set instanceof Set);
    assert.deepEqual([...set].sort((a, b) => a - b), [738, 839, 840]);
    assert.ok(captured.includes('--state') && captured.includes('closed'));
    assert.ok(captured.includes('--repo') && captured.includes('smalruby/smalruby3-editor'));
});

test('listClosedIssueNumbers: empty/non-array output -> empty Set', () => {
    assert.deepEqual([...listClosedIssueNumbers('o/r', 't', { gh: () => '[]' })], []);
    assert.deepEqual([...listClosedIssueNumbers('o/r', 't', { gh: () => 'null' })], []);
});

test('closeIssue: runs `gh issue close` for the given issue (#843)', () => {
    let captured;
    closeIssue('o/r', 839, 'tok', { gh: (args) => { captured = args; return ''; } });
    assert.deepEqual(captured, ['issue', 'close', '839', '--repo', 'o/r']);
});
