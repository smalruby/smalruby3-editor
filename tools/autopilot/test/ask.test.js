'use strict';
/**
 * ask.test.js — bin/autopilot-ask（#2565）: セッションの AI や人間が書く質問が、worker の質問と同じ形・同じ検証を通り、
 * モニターの置き場（POST /questions）に載り、答えると 🙋 が外れて implement に答えのファイルが渡ること。
 * 実 GitHub・実 daemon には触らない（deps で差し替える。HTTP は 127.0.0.1 の使い捨てのサーバー）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { validateResult } = require('../src/contract');
const {
    normalizeAskInput, normalizeQuestionsRegistration, planQuestionsRegistration, monitorQuestionsMarker,
    phaseForItem, withMonitorReleases, phasePromptCommand, HITL_LABEL,
} = require('../src/phases');
const {
    createAnswerStore, recordHitlQuestions, registerQuestionsOnce, handleQuestionsHttp, answerOnce,
    proceedMonitorAnswer, deliverMonitorAnswers,
} = require('../src/monitor-answers');
const { parseAskArgs, ask, tokenFile } = require('../src/ask');

const QUESTIONS = [
    { id: 'q1', text: '緑の旗をどう扱いますか', options: [{ key: 'a', label: '案 A', desc: '旗を残す' }, { key: 'b', label: '案 B' }], recommended: 'a' },
];

/** GitHub のコメントを覚える偽の I/O（applyCommentPlans は post を comments に足す） */
function fakeGitHub(over = {}) {
    const comments = over.comments || [];
    const calls = [];
    return {
        comments, calls,
        botToken: over.botToken || (async () => 'bot'),
        readToken: async () => 'read',
        applyCommentPlans: async (repo, n, planFn, token) => {
            calls.push(['comments', n, token]);
            const plans = planFn(comments) || [];
            for (const p of plans) if (p.action === 'post') comments.push({ id: comments.length + 1, body: p.body });
            return plans;
        },
        getIssueLabels: async () => [HITL_LABEL],
        findPrForIssue: async () => null,
        editLabels: async (repo, n, type, diff) => { calls.push(['labels', n, type, diff.remove]); },
    };
}

const files = (obj) => ({ readFile: () => JSON.stringify(obj) });
const ARGS = { issue: 2552, file: 'q.json', repo: 'o/r', port: 8787 };

test('parseAskArgs: issue と JSON ファイル。--repo / --port、#N も受ける', () => {
    assert.deepStrictEqual(parseAskArgs(['#2552', 'q.json'], {}), { ok: true, issue: 2552, file: 'q.json', repo: 'smalruby/smalruby3-editor', port: 8787 });
    assert.deepStrictEqual(parseAskArgs(['5', 'q.json', '--repo', 'a/b', '--port', '9000'], {}).port, 9000);
    assert.strictEqual(parseAskArgs(['5', 'q.json'], { AUTOPILOT_PORT: '8788' }).port, 8788);
    assert.strictEqual(parseAskArgs(['q.json'], {}).ok, false);
    assert.strictEqual(parseAskArgs(['x', 'q.json'], {}).ok, false);
});

test('normalizeAskInput: worker の結果の questions と同じ検証（同じエラー）を通る', () => {
    assert.strictEqual(normalizeAskInput({ questions: QUESTIONS, reason: 'r' }).ok, true);
    assert.strictEqual(normalizeAskInput(QUESTIONS).phase, 'session');
    const bad = [{ id: 'q1', text: 't', options: [{ key: 'bad key', label: 'A' }], recommended: 'z' }];
    const worker = validateResult({ issue: 1, phase: 'implement', signal: 'hitl', summary: 's', questions: bad }).errors;
    const tool = normalizeAskInput({ questions: bad }).errors;
    assert.ok(tool.length > 0);
    assert.deepStrictEqual(tool, worker.filter((e) => e.startsWith('questions')));
    assert.strictEqual(normalizeAskInput({}).ok, false);
    assert.strictEqual(normalizeAskInput({ questions: QUESTIONS, phase: 'a b' }).ok, false);
});

test('ask: worker と同じ本文の質問コメントを Bot で書き、daemon に載せる。二度目は書かず、新しい質問は round が続く', async () => {
    const gh = fakeGitHub();
    const posted = [];
    const deps = { ...gh, ...files({ questions: QUESTIONS, reason: 'r' }), postToDaemon: async (port, body) => { posted.push(body); return { status: 200, body: { action: 'set' } }; } };
    const r1 = await ask(ARGS, deps);
    assert.strictEqual(r1.code, 0, r1.lines.join('\n'));
    assert.strictEqual(gh.comments.length, 1);
    assert.ok(gh.comments[0].body.startsWith(monitorQuestionsMarker(2552, 1)));
    assert.deepStrictEqual(gh.calls[0], ['comments', 2552, 'bot']);
    // worker の結果（recordHitlQuestions）と同じ本文になる
    const wgh = fakeGitHub();
    await recordHitlQuestions(2552, { signal: 'hitl', phase: 'session', reason: 'r', questions: QUESTIONS },
        { cfg: { repo: 'o/r' }, store: createAnswerStore(), log: () => {} }, wgh);
    assert.strictEqual(gh.comments[0].body, wgh.comments[0].body);
    assert.deepStrictEqual(posted[0], { issue: 2552, round: 1, questions: QUESTIONS, phase: 'session', reason: 'r' });

    const r2 = await ask(ARGS, deps);
    assert.strictEqual(r2.code, 0);
    assert.strictEqual(gh.comments.length, 1, '同じ中身は二度書かない');
    assert.strictEqual(posted[1].round, 1);

    const next = [{ ...QUESTIONS[0], id: 'q2', text: '字下げは' }];
    const r3 = await ask(ARGS, { ...deps, ...files({ questions: next }) });
    assert.strictEqual(r3.code, 0);
    assert.strictEqual(gh.comments.length, 2);
    assert.ok(gh.comments[1].body.startsWith(monitorQuestionsMarker(2552, 2)));
    assert.strictEqual(posted[2].round, 2);
});

test('ask: Bot のトークンが取れなければ何も書かずに止まる（個人のトークンで書かない）', async () => {
    for (const botToken of [async () => { throw new Error('no key'); }, async () => '']) {
        const gh = fakeGitHub({ botToken });
        let sent = 0;
        const r = await ask(ARGS, { ...gh, ...files({ questions: QUESTIONS }), postToDaemon: async () => { sent += 1; } });
        assert.strictEqual(r.code, 1);
        assert.deepStrictEqual(gh.calls, []);
        assert.strictEqual(sent, 0);
    }
});

test('ask: 形が違えば書かない。daemon に届かなければコメントだけ書いて 2 で終わる', async () => {
    const gh = fakeGitHub();
    const bad = await ask(ARGS, { ...gh, ...files({ questions: [{ id: 'q1' }] }) });
    assert.strictEqual(bad.code, 1);
    assert.deepStrictEqual(gh.calls, []);
    const down = await ask(ARGS, { ...gh, ...files({ questions: QUESTIONS }), postToDaemon: async () => { throw new Error('ECONNREFUSED'); } });
    assert.strictEqual(down.code, 2);
    assert.strictEqual(gh.comments.length, 1);
    const refused = await ask(ARGS, { ...gh, ...files({ questions: QUESTIONS }), postToDaemon: async () => ({ status: 409, body: { error: 'worker is running' } }) });
    assert.strictEqual(refused.code, 2);
    assert.strictEqual(gh.comments.length, 1);
});

test('registerQuestionsOnce: 置き場に載せる。同じ round の同じ質問は置き直さない（メモを消さない）。動いている worker は受けない', () => {
    const store = createAnswerStore({ now: () => 0 });
    const state = { running: new Map() };
    const body = { issue: 2552, round: 1, questions: QUESTIONS, phase: 'session', reason: 'r' };
    assert.deepStrictEqual(registerQuestionsOnce({ store, state }, body).body.action, 'set');
    assert.deepStrictEqual(store.list().map((q) => [q.issue, q.status, q.phase]), [[2552, 'open', 'session']]);
    store.saveDrafts(2552, { q1: { key: 'b', note: null, at: 1 } });
    assert.strictEqual(registerQuestionsOnce({ store, state }, body).body.action, 'keep');
    assert.deepStrictEqual(store.get(2552).drafts, { q1: { key: 'b', note: null, at: 1 } });
    assert.strictEqual(registerQuestionsOnce({ store, state }, { ...body, round: 2 }).body.action, 'set');
    state.running.set(2555, {});
    assert.strictEqual(registerQuestionsOnce({ store, state }, { ...body, issue: 2555 }).status, 409);
    assert.strictEqual(registerQuestionsOnce({ store, state }, { ...body, round: 0 }).status, 400);
    assert.strictEqual(registerQuestionsOnce({ store, state }, { ...body, questions: [] }).status, 400);
    assert.strictEqual(normalizeQuestionsRegistration(null).ok, false);
    assert.strictEqual(planQuestionsRegistration(null, { round: 1, questions: QUESTIONS }).action, 'set');
});

test('registerQuestionsOnce: 答え済みでまだ worker に渡していない質問は、新しい round で置き換えない（#2568）', () => {
    const store = createAnswerStore({ now: () => 0 });
    const state = { running: new Map() };
    const body = { issue: 2552, round: 1, questions: QUESTIONS, phase: 'session' };
    registerQuestionsOnce({ store, state }, body);
    store.markAnswered(2552, {}, []);
    assert.strictEqual(store.get(2552).status, 'answered');
    const r = registerQuestionsOnce({ store, state }, { ...body, round: 2 });
    assert.deepStrictEqual([r.status, r.body.error], [409, 'answers not yet delivered']);
    assert.strictEqual(store.get(2552).round, 1);
    // 同じ round の同じ質問は、答え済みでもそのまま（keep）
    assert.strictEqual(registerQuestionsOnce({ store, state }, body).body.action, 'keep');
    // worker が答えを受け取ったあとは、新しい round を載せられる
    assert.ok(store.take(2552));
    assert.strictEqual(registerQuestionsOnce({ store, state }, { ...body, round: 2 }).body.action, 'set');
    assert.strictEqual(planQuestionsRegistration({ status: 'answered', round: 1, questions: QUESTIONS },
        { round: 2, questions: QUESTIONS }).status, 409);
});

test('合言葉のファイルの置き場は daemon と同じ（二重定義がずれると daemon に届かない）', () => {
    // eslint-disable-next-line global-require
    const { httpTokenFilePath } = require('../src/daemon');
    for (const port of [8787, 8788]) assert.strictEqual(tokenFile(port), httpTokenFilePath(port));
});

test('POST /questions: 道具の postToDaemon（合言葉のファイル）から daemon の置き場に載る', async () => {
    const store = createAnswerStore();
    const server = http.createServer((req, res) => {
        // daemon の守りの代わり: 合言葉を確かめる
        if (req.headers['x-autopilot-token'] !== 'secret') { res.writeHead(403); return res.end('{}'); }
        if (!handleQuestionsHttp(req, res, new URL(req.url, 'http://localhost'), { store, state: { running: new Map() } })) {
            res.writeHead(404); res.end('{}');
        }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    const tf = tokenFile(port);
    fs.writeFileSync(tf, 'secret\n', { mode: 0o600 });
    try {
        const gh = fakeGitHub();
        const r = await ask({ ...ARGS, port }, { ...gh, ...files({ questions: QUESTIONS }) });
        assert.strictEqual(r.code, 0, r.lines.join('\n'));
        assert.deepStrictEqual(store.list().map((q) => [q.issue, q.round, q.total]), [[2552, 1, 1]]);
    } finally {
        fs.rmSync(tf, { force: true });
        server.close();
    }
});

test('答えると 🙋 が外れ、Sprint Backlog の Issue は implement で答えのファイルを受け取る', async () => {
    const store = createAnswerStore({ now: () => 0 });
    const item = { issue: 2552, status: 'Sprint Backlog', kind: 'Issue', hitlLabel: true };
    const state = { running: new Map(), answerStore: store, board: { items: [{ ...item }] } };
    registerQuestionsOnce({ store, state }, { issue: 2552, round: 1, questions: QUESTIONS, phase: 'session' });
    // 答える前は人間の番（implement に進まない）
    assert.strictEqual(phaseForItem(item, {}), null);
    const gh = fakeGitHub();
    const ctx = {
        store, now: () => 5,
        onProceed: (issue, e, plan) => proceedMonitorAnswer(issue, e, plan, { cfg: { repo: 'o/r' }, state, log: () => {}, now: () => 5 }, gh),
    };
    const r = await answerOnce(ctx, { issue: 2552, answers: [{ q: 'q1', key: 'b' }], proceed: true });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(gh.calls.filter((c) => c[0] === 'labels'), [['labels', 2552, 'issue', [HITL_LABEL]]]);
    assert.deepStrictEqual(state.monitorReleases, { 2552: 5 });
    // daemon の次の tick: モニターで外した 🙋 は外れた扱い → implement
    const ctxs = withMonitorReleases({}, state.monitorReleases);
    assert.strictEqual(phaseForItem(item, ctxs[2552]), 'implement');
    // worker を起こす直前に答えのファイルを書き、起動の指示に入れる
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-ask-'));
    const file = deliverMonitorAnswers(2552, cwd, state);
    assert.strictEqual(file, path.join(cwd, 'tmp', 'autopilot-answers-2552.md'));
    assert.match(fs.readFileSync(file, 'utf8'), /選んだもの: `b` 案 B/);
    assert.ok(phasePromptCommand('autopilot-implement', 2552, '/p', { answersFile: file }).includes(`先に ${file} を Read し`));
    // implement のプロンプトも答えのファイルを読む手順を持つ
    const prompt = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'autopilot-implement.md'), 'utf8');
    assert.match(prompt, /AUTOPILOT_ANSWERS_FILE/);
    fs.rmSync(cwd, { recursive: true, force: true });
});
