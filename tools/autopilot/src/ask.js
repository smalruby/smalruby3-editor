'use strict';
/**
 * ask.js — `bin/autopilot-ask <issue> <questions.json>` の中身（#2565）。
 *
 * セッションの AI や人間が「人間の判断が要る Issue」を作ったとき、本文に案を書くだけでは、モニターの
 * 「答える」に出なかった（モニターは worker が書く決まった形の質問のコメントしか読まない）。この道具は、
 * worker と**同じ形・同じ検証**の質問のコメントを Bot 名義で書き、daemon の置き場に載せる（`POST /questions`）。
 *
 * - 形の検証は phases.js の normalizeAskInput（質問そのものは contract.js の questionListErrors。worker と同じ）。
 * - コメントは monitor-answers.js の writeQuestionsComment（worker の結果と同じ道・同じ質問は書かない・round は続ける）。
 * - Bot のトークンが取れないときは止まる（個人のトークンで書かない）。
 * - daemon に届かないときはコメントだけ書いて終わる（終了コード 2）。daemon を起こしてからもう一度流せば、
 *   コメントは書き直さずに置き場に載せる。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { normalizeAskInput, sanitizeForSurface } = require('./phases');
const { writeQuestionsComment } = require('./monitor-answers');

const USAGE = 'usage: bin/autopilot-ask <issue> <questions.json> [--repo owner/name] [--port 8787]';

/** daemon の既定のポート（cli.js の既定と同じ） */
const DEFAULT_PORT = 8787;

/**
 * 引数を読む（純粋関数）。
 * @param {string[]} argv
 * @param {object} env
 * @returns {{ok:boolean, error?:string, issue?:number, file?:string, repo?:string, port?:number}}
 */
function parseAskArgs(argv, env = {}) {
    const pos = [];
    let repo = env.AUTOPILOT_REPO || 'smalruby/smalruby3-editor';
    let port = Number(env.AUTOPILOT_PORT) || DEFAULT_PORT;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--repo') repo = argv[++i];
        else if (a === '--port') port = Number(argv[++i]);
        else if (a === '-h' || a === '--help') return { ok: false, error: USAGE };
        else pos.push(a);
    }
    const issue = Number(String(pos[0] || '').replace(/^#/, ''));
    if (pos.length !== 2 || !Number.isInteger(issue) || issue <= 0) return { ok: false, error: USAGE };
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return { ok: false, error: `bad --repo: ${repo}` };
    if (!Number.isInteger(port) || port <= 0) return { ok: false, error: `bad --port: ${port}` };
    return { ok: true, issue, file: pos[1], repo, port };
}

/**
 * daemon の合言葉のファイル（daemon.js の httpTokenFilePath と同じ置き場）。
 * @param {number} port
 * @returns {string}
 */
function tokenFile(port) {
    return path.join(os.tmpdir(), `autopilot-http-token-${port}`);
}

/**
 * daemon の `POST /questions` に送る。
 * @param {number} port
 * @param {object} body
 * @returns {Promise<{status:number, body:object}>}
 */
function postToDaemon(port, body) {
    const token = fs.readFileSync(tokenFile(port), 'utf8').trim();
    const data = JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port, path: '/questions', method: 'POST', timeout: 10000,
            headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), 'x-autopilot-token': token },
        }, (res) => {
            let raw = '';
            res.on('data', (c) => { raw += c; });
            res.on('end', () => {
                let j = {};
                try { j = JSON.parse(raw || '{}'); } catch { j = { error: raw }; }
                resolve({ status: res.statusCode, body: j });
            });
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        req.end(data);
    });
}

/** 既定の I/O（テストは deps で差し替える。実 GitHub・実 daemon に触るテストを書かない） */
function defaultIo() {
    // eslint-disable-next-line global-require
    const project = require('./project');
    return {
        botToken: project.botToken, readToken: project.readToken, applyCommentPlans: project.applyCommentPlans,
        readFile: (f) => fs.readFileSync(f, 'utf8'), postToDaemon,
    };
}

/**
 * 質問を Issue に書き、daemon の置き場に載せる。
 * @param {{issue:number, file:string, repo:string, port:number}} args
 * @param {object} [deps] I/O の差し替え
 * @returns {Promise<{code:number, lines:string[]}>} 終了コード 0 = 書けて載った / 1 = 失敗（何も書いていないか、書けなかった） /
 *   2 = コメントは書けたが daemon に載らなかった（もう一度流せばよい）
 */
async function ask(args, deps = {}) {
    const io = { ...defaultIo(), ...deps };
    let input;
    try {
        input = JSON.parse(io.readFile(args.file));
    } catch (e) {
        return { code: 1, lines: [`autopilot-ask: cannot read ${args.file}: ${e.message}`] };
    }
    const n = normalizeAskInput(input);
    if (!n.ok) return { code: 1, lines: n.errors.map((e) => `autopilot-ask: ${e}`) };
    let token;
    try {
        token = String(await io.botToken() || '').trim();
    } catch (e) {
        token = '';
    }
    // 個人のトークンで書かない（名義が混ざる）。Bot が取れなければ何も書かずに止まる
    if (!token) return { code: 1, lines: ['autopilot-ask: cannot get the Bot token (bin/bot-token). Nothing was written.'] };
    let plan;
    try {
        plan = await writeQuestionsComment(args.repo, args.issue, n.questions, { phase: n.phase, reason: n.reason }, io, token);
    } catch (e) {
        return { code: 1, lines: [`autopilot-ask: writing the questions comment failed: ${sanitizeForSurface(e.message)}`] };
    }
    const lines = [`#${args.issue}: questions comment ${plan.action === 'post' ? 'written' : 'already there (not written again)'} (round ${plan.round})`];
    let r;
    try {
        r = await io.postToDaemon(args.port, { issue: args.issue, round: plan.round, questions: n.questions, phase: n.phase, reason: n.reason });
    } catch (e) {
        lines.push(`autopilot-ask: daemon (port ${args.port}) not reachable: ${e.message}. Run this again after the daemon starts`
            + ' (the comment is not written twice).');
        return { code: 2, lines };
    }
    if (r.status !== 200) {
        lines.push(`autopilot-ask: daemon refused (${r.status}): ${(r.body && r.body.error) || '-'}`);
        return { code: 2, lines };
    }
    lines.push(`#${args.issue}: on the monitor (${r.body.action === 'keep' ? 'already listed' : 'listed'}). Answer it with 「答える」.`);
    return { code: 0, lines };
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
async function main(argv) {
    const a = parseAskArgs(argv, process.env);
    if (!a.ok) {
        process.stderr.write(`${a.error}\n`);
        return 1;
    }
    const r = await ask(a);
    process.stdout.write(`${r.lines.join('\n')}\n`);
    return r.code;
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => process.exit(code)).catch((e) => {
        process.stderr.write(`autopilot-ask: ${e.message}\n`);
        process.exit(1);
    });
}

module.exports = { parseAskArgs, ask, main, tokenFile, DEFAULT_PORT };
