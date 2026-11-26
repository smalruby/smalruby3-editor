#!/usr/bin/env node
'use strict';
// SPDX-License-Identifier: MIT
/**
 * 確認ページ（#2474）で送られた答えを、トラッカーにリリース確認の結果のコメントとして Bot で書く。
 * release-check の worker が ArtifactData で読んだ db の文書（`answers/round-N` の中身）を JSON ファイルで渡す。
 *
 *   release-page-answer.js --issue N --answer answer.json [--repo o/r]
 *
 * 出力は 1 行の JSON（`{ok, action:'post'|'skip'|'none', round, ng}`）。action=none は送った答えが無い（下書き）。
 */
const fs = require('fs');
const { postReleasePageAnswer } = require('../src/release-check-http');

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : null;
}

const issue = Number(arg('issue'));
const file = arg('answer');
const repo = arg('repo') || process.env.AUTOPILOT_REPO || 'smalruby/smalruby3-editor';
if (!Number.isInteger(issue) || issue <= 0 || !file) {
    process.stderr.write('usage: --issue <N> --answer <answer.json> [--repo o/r]\n');
    process.exit(2);
}
const answer = JSON.parse(fs.readFileSync(file, 'utf8'));
postReleasePageAnswer({ cfg: { repo } }, { issue, answer }).then((r) => {
    process.stdout.write(JSON.stringify(r) + '\n');
    process.exit(r.ok ? 0 : 1);
}).catch((e) => {
    process.stderr.write(`release-page-answer: ${e.message}\n`);
    process.exit(1);
});
