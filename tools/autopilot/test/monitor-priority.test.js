'use strict';
// モニターの優先度 ▲▼ と並列の計画の行（EPIC #2384）
const test = require('node:test');
const assert = require('node:assert');
const { MONITOR_HTML } = require('../src/monitor');

const script = MONITOR_HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const pick = (name) => {
    const m = script.match(new RegExp(`function ${name}\\(it\\) \\{[\\s\\S]*?\\n\\}`));
    assert.ok(m, `${name} exists`);
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return new Function('esc', `${m[0]}; return ${name};`)(esc);
};

test('MONITOR_HTML: 計画の行と script の構文', () => {
    assert.match(MONITOR_HTML, /data-testid="schedule-plan"/);
    assert.doesNotThrow(() => new Function(script));
});

test('prioCtl: 自分の値・継いだ値・EPIC の説明', () => {
    const prioCtl = pick('prioCtl');
    const own = prioCtl({ issue: 5, priority: 'P1', effectivePriority: { priority: 'P1', source: 'own', from: null } });
    assert.match(own, /<b class="p1"/);
    assert.match(own, /movePriority\(5, -1\)/);
    assert.match(own, /movePriority\(5, 1\)/);
    const inh = prioCtl({ issue: 6, effectivePriority: { priority: 'P0', source: 'inherited', from: 2384 } });
    assert.match(inh, /class="p0 inh"/);
    assert.match(inh, /#2384 から継いだ/);
    const epic = prioCtl({ issue: 7, kind: 'EPIC', effectivePriority: { priority: 'P2', source: 'default', from: null } });
    assert.match(epic, /sub-issue にも効く/);
});
