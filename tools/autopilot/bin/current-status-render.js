#!/usr/bin/env node
'use strict';
// SPDX-License-Identifier: MIT
/**
 * 現在地のテンプレートから HTML を作る（#2388）。worker も人間も同じ手順で使う。
 *
 *   current-status-render.js --material status.json --draft data.json
 *       材料（GET /status.json）からテンプレートのデータの下書きを書く
 *   current-status-render.js --data data.json --out page.html [--template template.html]
 *       データをテンプレートに埋め込んで HTML を書く
 */
const fs = require('fs');
const path = require('path');
const { draftDataFromMaterial, renderCurrentStatusHtml } = require('../src/current-status');

function arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : null;
}

const material = arg('material');
const draft = arg('draft');
const data = arg('data');
const out = arg('out');
const template = arg('template')
    || path.join(process.env.AUTOPILOT_TEMPLATE_DIR || path.join(__dirname, '..', 'templates', 'current-status'), 'template.html');

if (material && draft) {
    const m = JSON.parse(fs.readFileSync(material, 'utf8'));
    fs.writeFileSync(draft, JSON.stringify(draftDataFromMaterial(m), null, 2));
    process.stdout.write(`draft: ${draft}\n`);
} else if (data && out) {
    const d = JSON.parse(fs.readFileSync(data, 'utf8'));
    fs.writeFileSync(out, renderCurrentStatusHtml(fs.readFileSync(template, 'utf8'), d));
    process.stdout.write(`html: ${out}\n`);
} else {
    process.stderr.write('usage: --material <status.json> --draft <data.json> | --data <data.json> --out <page.html>\n');
    process.exit(2);
}
