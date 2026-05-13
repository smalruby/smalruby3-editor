# Phase 2: Conflict Resolution

コンフリクトを検出し、既知パターンに従って解決する。

## Post-Merge Reverts の処理

`.upstream-merge-history.json` に `postMergeReverts` がある場合、Phase 1 で確認した方針に従う。

### 方針A: upstream を受け入れて revert を解消する場合

`affectedAreas` に記載されたファイルのコンフリクトは **upstream (theirs) を受け入れ**、Smalruby マーカーブロックのみ再適用する。

```bash
# 特定ファイルを upstream 版で解決する場合
git checkout --theirs <file>
git add <file>
```

ただし Smalruby マーカーを含むファイル（`blocks.jsx` 等）は手動でマーカー部分だけ再挿入する。

`affectedAreas` の `category: "Smalruby-specific additions"` に記載されたファイルは **ours を保持**する。

### 方針B: revert を維持する場合

`affectedAreas` に記載されたファイルのコンフリクトは **ours を保持**する。

```bash
# 特定ファイルを現在の Smalruby 版で解決する場合
git checkout --ours <file>
git add <file>
```

upstream が追加した新しいファイルや、revert 対象外のファイルは通常通り受け入れる。

---

## Known Conflicts 一覧

以下のファイルは upstream merge 時にほぼ毎回コンフリクトが発生する。

### gui.ts

```
✓ gui.ts conflict detected (EXPECTED)
```

**ファイル**: `packages/scratch-gui/src/reducers/gui.ts`

**解決方法**:
1. 以下のマーカーブロックを保持:
   ```
   // === Smalruby: Start of Redux state registry ===
   import {smalrubyReducers, smalrubyInitialState} from './smalruby-registry';
   // === Smalruby: End of Redux state registry ===
   ```
2. `buildInitialState()` 内で保持:
   ```
   // === Smalruby: Start of initial state ===
   ...smalrubyInitialState,
   // === Smalruby: End of initial state ===
   ```
3. `combineReducers()` 内で保持:
   ```
   // === Smalruby: Start of reducers ===
   ...smalrubyReducers,
   // === Smalruby: End of reducers ===
   ```
4. それ以外は upstream の変更を受け入れる

**参考**: `packages/scratch-gui/src/reducers/smalruby-registry.ts`

---

### extension-manager.js

```
✓ extension-manager.js conflict detected (EXPECTED)
```

**ファイル**: `packages/scratch-vm/src/extension-support/extension-manager.js`

**解決方法**:
1. 以下のマーカーブロックを保持:
   ```
   // === Smalruby: Start of extension registration ===
   const registerSmalrubyExtensions = require('./smalruby-extensions');
   registerSmalrubyExtensions(builtinExtensions);
   // === Smalruby: End of extension registration ===
   ```
2. `builtinExtensions` オブジェクトは upstream の変更を受け入れる

**参考**: `packages/scratch-vm/src/extension-support/smalruby-extensions.js`

---

### blocks.jsx

```
✓ blocks.jsx conflict detected (EXPECTED)
```

**ファイル**: `packages/scratch-gui/src/containers/blocks.jsx`

**解決方法**:
1. Smalruby 固有の追加を全て保持:
   - Ruby tab logic (`handleActivateRubyTab` 等)
   - Smalruby extension integration
   - Block display modal integration
2. upstream の ScratchBlocks API 変更を Smalruby コードにも適用
   → `reference-api-migration.md` を参照
3. 新しい props/state destructuring パターンがあれば取り込む

---

### eslint.config.mjs

```
✓ eslint.config.mjs conflict detected (EXPECTED)
```

**ファイル**: `packages/scratch-gui/eslint.config.mjs` (またはルート)

**解決方法**:
1. Smalruby 固有の lint ルールとオーバーライドを保持
2. upstream のプラグインマイグレーションを受け入れ
   - 例: `eslint-plugin-import` → `import-x`
3. Smalruby ルールで名前変更されたプラグインを参照している箇所を更新
   - 例: `"import/core-modules"` → `"import-x/core-modules"`

---

### package.json (複数)

```
✓ package.json conflict detected (EXPECTED)
```

**解決方法**:
1. `@smalruby` パッケージ名を保持 (例: `@smalruby/scratch-vm`)
2. Smalruby 固有の dependencies を保持
3. upstream のバージョンアップを受け入れ
4. Smalruby パッケージのバージョンを upstream メジャーバージョンに合わせる
5. upstream が peer deps として追加したものが Smalruby では direct deps として必要か確認
   - 例: `react`, `react-dom`, `redux` が direct dependency として必要な場合がある

---

### package-lock.json

```
✓ package-lock.json conflict detected (EXPECTED)
```

**解決方法**:
1. upstream の package.json 変更を先に受け入れる
2. lock file を再生成:
   ```bash
   docker compose run --rm app npm install
   ```

---

### sprites.json / costumes.json (Smalruby 独自エントリ消失リスク)

**コンフリクトとして検出されないケースが多い** ため要注意。upstream の
`packages/scratch-gui/src/lib/libraries/sprites.json` /
`packages/scratch-gui/src/lib/libraries/costumes.json` が更新されると、
git の auto-merge が成功してしまい、**Smalruby 独自エントリ (Shimaraby,
Shimacat) が静かに消失する** ことがある (issue #688 で発生)。

**マージ後に必ず実行する確認**:

```bash
# Shimaraby / Shimacat が残っていることを確認
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/unit/lib/smalruby-original-sprites.test.js"

# トレードマーク sprite が混入していないことを確認
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/unit/lib/removed-trademarks.test.js"
```

**消失している場合の復元**: 過去コミット `f2b5c09e5b` (sprites) /
`1c3f91a216` (costumes) を参照し、エントリを再追加する。アセット PNG は
`packages/scratch-gui/static/smalruby-assets/` に保持されている。

**トレードマーク sprite が紛れ込んでいる場合**: 対象は
`Cat`, `Cat Flying`, `Gobo`, `Pico`, `Pico Walking`, `Nano`, `Tera`,
`Giga`, `Giga Walking`。`removed-trademarks.test.js` の `trademarkNames`
配列が現状のリストなので、増えた場合は配列を更新してから sprites.json /
costumes.json から削除する。

---

## Unexpected Conflicts

上記以外のファイルでコンフリクトが発生した場合:

1. **WARNING** として表示
2. ファイルリストを表示
3. ユーザーに手動解決を促す
4. API 変更が原因の場合は `reference-api-migration.md` を参照

## コンフリクト解決後の確認

```bash
git status --porcelain | grep "^UU"
```

- 出力がなければ全てのコンフリクトが解決済み
- まだ残っている場合は警告して続行を待つ

---

## 次のフェーズ

コンフリクト解決完了 → `phase3-validation.md` を読み込む
