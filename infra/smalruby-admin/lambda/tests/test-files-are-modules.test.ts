/**
 * テストファイルがモジュールであることを担保する回帰テスト (issue #1144)。admin も同じ構造だったため CI 追加時に検出した (#1155)。
 *
 * `import` / `export` を 1 つも持たない .ts ファイルは TypeScript では「モジュール」ではなく
 * グローバルスクリプトとして扱われる。その場合トップレベルの const がファイルを跨いで同じ
 * スコープに宣言されるため、`mockSend` のような同名の変数を別ファイルで宣言した瞬間に
 * TS2451 (Cannot redeclare block-scoped variable) になる。ts-jest はキャッシュが温かい間は
 * 型チェックを再利用するので、この診断は cold cache のときだけ suite ごと落ちる = フレークに
 * 見えていた。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const testsDir = __dirname;

const collectTsFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full);
    return entry.isFile() && full.endsWith('.ts') ? [full] : [];
  });

describe('lambda/tests の .ts ファイル', () => {
  const files = collectTsFiles(testsDir);

  test('検査対象のファイルが見つかる', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files.map((file) => [path.relative(testsDir, file), file]))(
    '%s はモジュール (import/export を持つ) である',
    (_relative, file) => {
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.ES2020,
        /* setParentNodes */ false,
        ts.ScriptKind.TS,
      );

      expect(ts.isExternalModule(source)).toBe(true);
    },
  );
});
