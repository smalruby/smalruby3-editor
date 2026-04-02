# Supply Chain Security

## パッケージ採用ルール: 3日ルール

新しいパッケージや新しいバージョンを追加する際は、**リリースから 3日（72時間）以上経過しているバージョンのみ採用する**。

### 背景

npm や PyPI のパッケージがサプライチェーン攻撃（メンテナーアカウント乗っ取り、CI/CD クレデンシャル窃取等）により侵害された場合、悪意のあるバージョンは通常数時間〜1日以内に検知・除去される。リリース直後のバージョンを避けることで、このリスクを大幅に低減できる。

### npm: `--before` フラグを必ず使う

`npm install` でパッケージを追加・更新する際は、**`--before` フラグで 3日前の日付を指定する**。これにより、指定日以前にリリースされたバージョンのみがインストール対象になる。

```bash
# 3日前の日付を取得（macOS）
DATE=$(date -v-3d +%Y-%m-%d)

# 新規パッケージの追加
docker compose run --rm app bash -c "npm install <package> --before $DATE"

# 特定バージョンを追加する場合も --before で検証
docker compose run --rm app bash -c "npm install <package>@<version> --before $DATE"

# パッケージの更新
docker compose run --rm app bash -c "npm update <package> --before $DATE"
```

`--before` を付けることで、万が一侵害されたバージョンが最新として公開されていても、自動的にスキップされる。

### リリース日の確認方法

```bash
# npm パッケージのリリース日を確認
npm view <package> time --json

# 特定バージョンのみ
npm view <package>@<version> time --json
```

### 適用範囲

- `dependencies` への新規追加
- `devDependencies` への新規追加
- 既存パッケージのバージョンアップ

### 例外

- **`npm audit fix`** による自動更新は対象外（セキュリティ修正パッチの適用が目的のため）
- プロジェクト内のワークスペースパッケージ（`@smalruby/*`）は対象外
