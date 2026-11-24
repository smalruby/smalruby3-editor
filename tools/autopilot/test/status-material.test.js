'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { boardResponse, statusMaterialResponse } = require('../src/daemon');
const { MONITOR_HTML } = require('../src/monitor');

const cfg = { concurrency: 2, repo: 'o/r', now: () => Date.UTC(2026, 10, 24), assignee: null };
const state = () => ({
    paused: false, running: new Map([[11, { phase: 'implement', since: 1 }]]), history: [],
    board: {
        updatedAt: 5,
        items: [
            { issue: 10, title: 'E', kind: 'EPIC', status: 'In Progress', subIssues: { total: 2, completed: 0 } },
            { issue: 11, title: 'c', status: 'In Progress', parent: { number: 10, title: 'E' } },
        ],
    },
    epicDecisions: { 10: 3 },
    blockedWorkers: [{ issue: 11, reason: 'prompt' }],
    currentStatus: { url: 'https://claude.ai/artifact/x', updatedAt: 9 },
});

test('GET /status.json の材料: EPIC のまとめ・決定待ち・止まった worker・現在地', () => {
    const m = statusMaterialResponse(cfg, state());
    assert.equal(m.groups[0].epic, 10);
    assert.equal(m.groups[0].pendingDecisions, 3);
    assert.equal(m.groups[0].running[0].issue, 11);
    assert.equal(m.blocked[0].reason, 'prompt');
    assert.equal(m.currentStatus.url, 'https://claude.ai/artifact/x');
    assert.equal(m.repo, 'o/r');
});

test('GET /board に EPIC のまとめと現在地が載る（モニタ用）', () => {
    const b = boardResponse(cfg, state());
    assert.equal(b.epicGroups[0].key, '10');
    assert.equal(b.currentStatus.updatedAt, 9);
});

test('モニタ: EPIC ごとの欄と「現在地を作る」ボタンが POST /current-status につながる', () => {
    assert.match(MONITOR_HTML, /id="epicgroups"/);
    assert.match(MONITOR_HTML, /function renderEpicGroupsHtml/);
    assert.match(MONITOR_HTML, /fetch\('\/current-status', \{ method: 'POST' \}\)/);
    assert.ok(MONITOR_HTML.indexOf('id="epicgroups"') < MONITOR_HTML.indexOf('id="board"'));
});
