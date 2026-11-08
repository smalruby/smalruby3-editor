#!/usr/bin/env node
/**
 * infra/shared/ の正本を各 CDK プロジェクトへコピーする (#1373)。
 *
 *   node infra/shared/sync.js          # manifest.json の配布先へコピー
 *   node infra/shared/sync.js --check  # ずれがあれば一覧を出して exit 1（書き込まない）
 *
 * 配る物と配布先は manifest.json が唯一の真実。Node 標準モジュールだけで動く
 * （どのプロジェクトの node_modules にも依存しない）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const sharedDir = __dirname;
const infraDir = path.resolve(sharedDir, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(sharedDir, 'manifest.json'), 'utf8'));
const check = process.argv.includes('--check');

const stale = [];
for (const project of manifest.projects) {
  for (const { source, dest } of manifest.files) {
    const expected = fs.readFileSync(path.join(sharedDir, source), 'utf8');
    const target = path.join(infraDir, project, dest);
    const actual = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (actual === expected) continue;
    const rel = path.relative(infraDir, target);
    if (check) {
      stale.push(rel);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, expected);
      console.log(`updated infra/${rel}`);
    }
  }
}

if (check && stale.length > 0) {
  console.error(`infra/shared とずれているコピー（node infra/shared/sync.js で直す）:`);
  for (const rel of stale) console.error(`  infra/${rel}`);
  process.exit(1);
}
