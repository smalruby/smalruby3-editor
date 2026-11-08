/**
 * `infra/shared/` の正本とこのプロジェクトのコピーが一致しているか (#1373)。
 *
 * 各 CDK プロジェクトは独立した npm パッケージで、`Deploy Infra` も差分に `infra/<project>/` が
 * 現れたプロジェクトだけをデプロイする。そのため共有コードは import せず各プロジェクトに
 * コピーして持ち、ずれをこのテストで落とす（CI の `npm test` で走る）。
 *
 * 正本は `infra/shared/tests/shared-copies.test.ts`。直接編集しない（`node infra/shared/sync.js`）。
 */
import * as fs from 'fs';
import * as path from 'path';

interface SharedManifest {
  files: { source: string; dest: string }[];
  projects: string[];
}

const projectDir = path.resolve(__dirname, '../..');
const sharedDir = path.resolve(projectDir, '../shared');
const manifest: SharedManifest = JSON.parse(
  fs.readFileSync(path.join(sharedDir, 'manifest.json'), 'utf8'),
);
const project = path.basename(projectDir);

describe('infra/shared のコピー', () => {
  test('このプロジェクトが manifest.json の配布先に載っている', () => {
    expect(manifest.projects).toContain(project);
  });

  test.each(manifest.files.map(f => [f.dest, f.source]))(
    '%s が infra/shared/%s と一致する（`node infra/shared/sync.js` で直す）',
    (dest, source) => {
      const expected = fs.readFileSync(path.join(sharedDir, source), 'utf8');
      const actual = fs.readFileSync(path.join(projectDir, dest), 'utf8');
      expect(actual).toBe(expected);
    },
  );
});
