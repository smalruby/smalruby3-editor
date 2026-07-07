'use strict';
/**
 * cli.js — autopilot の最小 CLI（spike walking skeleton）。
 *
 *   autopilot triage <issue> [options]
 *
 * フロー: worktree 用意 → tmux で claude 起動 → /autopilot-<phase> を送る →
 * 結果ファイルを回収 → Project フィールドへ反映。
 *
 * options:
 *   --owner <login>     Project owner（既定 smalruby）
 *   --project <number>  Project 番号（既定 4）
 *   --repo <o/r>        リポジトリ（既定 smalruby/smalruby3-editor）
 *   --command <cmd>     claude 起動コマンド差し替え（スタブ検証用）
 *   --worktree <path>   既存 worktree を使う（自動作成しない）
 *   --no-worktree       現在の cwd で実行
 *   --dry-run           claude を起動せず、何をするかだけ表示
 *   --no-apply          Project への書き込みをしない（結果表示のみ）
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PHASE_BY_COMMAND, applyResult, DEFAULT_CLAUDE_COMMAND } = require('./phases');
const { readResultFile } = require('./contract');
const { runPhase } = require('./runner');
const project = require('./project');

function parseArgs(argv) {
    const o = {
        owner: 'smalruby', project: 4, repo: 'smalruby/smalruby3-editor',
        command: process.env.AUTOPILOT_CLAUDE_CMD || DEFAULT_CLAUDE_COMMAND,
        dryRun: false, apply: true, worktree: null, useWorktree: true,
    };
    const rest = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--owner') o.owner = argv[++i];
        else if (a === '--project') o.project = Number(argv[++i]);
        else if (a === '--repo') o.repo = argv[++i];
        else if (a === '--command') o.command = argv[++i];
        else if (a === '--worktree') { o.worktree = argv[++i]; }
        else if (a === '--no-worktree') o.useWorktree = false;
        else if (a === '--dry-run') o.dryRun = true;
        else if (a === '--no-apply') o.apply = false;
        else rest.push(a);
    }
    o._ = rest;
    return o;
}

function ensureWorktree(issue, log) {
    const bin = path.join(project.REPO_ROOT, 'bin', 'autopilot-worktree');
    execFileSync(bin, ['create', String(issue)], { stdio: 'inherit' });
    const wt = execFileSync(bin, ['path', String(issue)], { encoding: 'utf8' }).trim();
    log(`worktree: ${wt}`);
    return wt;
}

async function runTriageLike(command, opts) {
    const log = (m) => process.stderr.write(`[autopilot] ${m}\n`);
    const issue = Number(opts._[0]);
    if (!Number.isInteger(issue)) throw new Error('issue number required');

    const phase = PHASE_BY_COMMAND[command];
    if (!phase) throw new Error(`unknown phase: ${command}`);

    // worktree
    let cwd = process.cwd();
    if (opts.worktree) cwd = opts.worktree;
    else if (opts.useWorktree) cwd = ensureWorktree(issue, log);

    const resultDir = path.join(cwd, 'tmp');
    fs.mkdirSync(resultDir, { recursive: true });
    const resultFile = path.join(resultDir, `autopilot-result-${issue}.json`);

    const env = {
        AUTOPILOT_ISSUE: String(issue),
        AUTOPILOT_PHASE: command,
        AUTOPILOT_RESULT_FILE: resultFile,
        AUTOPILOT_PROJECT: String(opts.project),
        AUTOPILOT_REPO: opts.repo,
    };

    if (opts.dryRun) {
        log('DRY RUN — would launch claude and send the skill command:');
        log(`  cwd:         ${cwd}`);
        log(`  command:     ${opts.command}`);
        log(`  skill send:  /${phase.skill} ${issue}`);
        log(`  resultFile:  ${resultFile}`);
        log(`  env:         ${JSON.stringify(env)}`);
        return 0;
    }

    const session = `autopilot-${command}-${issue}`;
    const res = await runPhase({
        session, cwd, env, command: opts.command,
        skill: phase.skill, issue, resultFile, log,
    });

    if (!res.ok) {
        log(`FAILED: ${res.reason}`);
        return 1;
    }

    const parsed = readResultFile(resultFile);
    if (!parsed.ok) {
        log(`invalid result: ${parsed.errors.join('; ')}`);
        return 1;
    }
    const result = parsed.result;
    log(`result: signal=${result.signal} — ${result.summary}`);

    const intents = applyResult(result);
    if (!opts.apply) {
        log(`(--no-apply) would set: ${intents.map(i => `${i.field}=${i.value}`).join(', ')}`);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        return result.signal === 'error' ? 1 : 0;
    }

    // Project へ反映
    const token = project.botToken();
    const proj = project.getProject(opts.owner, opts.project, token);
    const fields = project.getFields(opts.owner, opts.project, token);
    const itemId = project.addIssue(opts.owner, opts.project, opts.repo, issue, token);
    const applied = project.applyIntents({ projectId: proj.id, fields }, itemId, intents, token);
    log(`applied to Project #${opts.project}: ${applied.join(', ')}`);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return result.signal === 'error' ? 1 : 0;
}

function parseDaemonArgs(argv) {
    const o = { owner: 'smalruby', project: 4, repo: 'smalruby/smalruby3-editor', concurrency: 2, intervalMs: 15000, port: 8787, once: false, assignee: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--owner') o.owner = argv[++i];
        else if (a === '--project') o.project = Number(argv[++i]);
        else if (a === '--repo') o.repo = argv[++i];
        else if (a === '--concurrency') o.concurrency = Number(argv[++i]);
        else if (a === '--interval') o.intervalMs = Number(argv[++i]) * 1000;
        else if (a === '--port') o.port = Number(argv[++i]);
        else if (a === '--once') o.once = true;
        else if (a === '--assignee') o.assignee = argv[++i];
    }
    return o;
}

async function main(argv) {
    const command = argv[0];
    if (!command || command === '--help' || command === '-h') {
        process.stdout.write(
            'usage:\n' +
            '  autopilot <phase> <issue> [options]   run a single phase for one issue\n' +
            '  autopilot daemon [options]            run the resident daemon\n' +
            `  phases: ${Object.keys(PHASE_BY_COMMAND).join(', ')}\n` +
            '  phase options:  --owner --project --repo --command --worktree --no-worktree --dry-run --no-apply\n' +
            '  daemon options: --owner --project --repo --concurrency --interval(sec) --port --once --assignee <login>\n');
        return 0;
    }
    if (command === 'daemon') {
        const daemon = require('./daemon');
        await daemon.main(parseDaemonArgs(argv.slice(1)));
        return 0;
    }
    if (!PHASE_BY_COMMAND[command]) {
        process.stderr.write(`unknown command: ${command}\n`);
        return 2;
    }
    const opts = parseArgs(argv.slice(1));
    return runTriageLike(command, opts);
}

module.exports = { main, parseArgs };
