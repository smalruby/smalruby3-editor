#!/usr/bin/env node
'use strict';
// SPDX-License-Identifier: MIT
/**
 * リリース確認の確認ページ（#2474）のデータの下書きと HTML を作る。release-check の worker が使う。
 *
 *   release-page-render.js --comments comments.json --epic N [--title T] [--repo o/r] [--pr N] [--pr-url U] --draft data.json
 *       トラッカーの会話コメント（REST の JSON 配列）から、テンプレートのデータの下書きを書く
 *   release-page-render.js --data data.json --out page.html [--template template.html]
 *       データをテンプレートに埋め込んで HTML を書く
 */
const fs = require('fs');
const path = require('path');
const { draftReleasePageData, renderReleasePageHtml } = require('../src/release-page');

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : null;
}

const comments = arg('comments');
const draft = arg('draft');
const data = arg('data');
const out = arg('out');
const template = arg('template') || process.env.AUTOPILOT_RELEASE_PAGE_TEMPLATE
    || path.join(__dirname, '..', 'templates', 'release-check', 'template.html');

if (comments && draft) {
    const epic = Number(arg('epic'));
    if (!Number.isInteger(epic) || epic <= 0) {
        process.stderr.write('--epic (positive integer) required\n');
        process.exit(2);
    }
    const pr = arg('pr');
    const d = draftReleasePageData({
        epic, title: arg('title') || '', repo: arg('repo') || process.env.AUTOPILOT_REPO || '',
        comments: JSON.parse(fs.readFileSync(comments, 'utf8')),
        prNumber: pr && /^\d+$/.test(pr) ? Number(pr) : null, prUrl: arg('pr-url'), generatedAt: new Date().toISOString(),
    });
    fs.writeFileSync(draft, JSON.stringify(d, null, 2));
    process.stdout.write(`draft: ${draft} (round ${d.round}, points ${d.points.length}, decisions ${d.decisions.length})\n`);
} else if (data && out) {
    const d = JSON.parse(fs.readFileSync(data, 'utf8'));
    fs.writeFileSync(out, renderReleasePageHtml(fs.readFileSync(template, 'utf8'), d));
    process.stdout.write(`html: ${out}\n`);
} else {
    process.stderr.write('usage: --comments <comments.json> --epic <N> --draft <data.json> | --data <data.json> --out <page.html>\n');
    process.exit(2);
}
