# smalruby-api (共通 API インフラ)

> **🆕 Smalruby 独自** — Smalruby のフロントエンドが必要とする共通 API エンドポイント群。旧 SAM 実装 (`smalruby/smalruby-infra` リポジトリ) からの置き換え。

## 概要

`infra/smalruby-api/` は Smalruby のフロントエンド (smalruby.app) が利用する**汎用バックエンド機能**を提供する 4 つの Lambda を束ねた **HTTP API v2** スタック。

| エンドポイント | Lambda | 用途 |
|---|---|---|
| `GET /cors-proxy` | `smalruby-api-cors-proxy{stageSuffix}` | 任意 URL の CORS フリーフェッチ + Google Drive URL 変換 + バイナリ Base64 化 |
| `GET /mesh-domain` | `smalruby-api-mesh-zone{stageSuffix}` | クライアント IP から Mesh ドメイン (CRC32 ハッシュ) を生成 |
| `GET /scratch-api-proxy/projects/{projectId}` | `smalruby-api-scratch-projects{stageSuffix}` | Scratch 公式 API (project info) のステータス透過プロキシ |
| `GET /scratch-api-proxy/translate` | `smalruby-api-scratch-translate{stageSuffix}` | Scratch 公式翻訳サービスのプロキシ |

`OPTIONS` (preflight) は HTTP API v2 の **built-in CORS** が自動処理。旧 SAM の `cors-for-smalruby` Lambda は不要。

## カスタムドメイン

| Stage | ドメイン |
|---|---|
| stg | `stg.api.smalruby.app` (CDK が ACM + Route53 も管理) |
| prod | `api.smalruby.app` (**既存ドメインを import**、ACM/Route53 は別管理) |

prod は旧 SAM スタック `smalruby-infra-prod` から既存ドメイン (`api.smalruby.app`) を引き継ぐ形で **2026-04-29 にカットオーバー** 完了済み。詳細は [カットオーバーの記録](#カットオーバー履歴-2026-04-29) を参照。

## Lambda エンドポイントの詳細

### `GET /cors-proxy`

任意 URL を fetch して結果を返す。フロントから直接 fetch すると CORS で弾かれるリソース (例: Google Drive 共有 URL、外部サイトの画像) を経由するために使う。

**入力**: `?url=<encoded_url>`

**処理**:
1. URL を Google Drive 形式 (`https://drive.google.com/uc?id=...`) に変換 (検出時)
2. fetch
3. バイナリレスポンス (画像 / 音声) は Base64 エンコードして返す
4. テキストはそのまま

実装: `infra/smalruby-api/lambda/cors-proxy.ts`

### `GET /mesh-domain`

リクエストの **source IP** から `MESH_ZONE_SECRET_KEY` (環境変数) と組み合わせて **CRC32 ハッシュ**を計算し、Mesh ドメイン名を生成する。

**入力**: なし (source IP を見る)

**出力**: `{ "domain": "ab12cd34" }` (CRC32 を 16 進数文字列で返す)

> **重要 (互換性)**: prod では旧 SAM 実装でハードコードされていた secret key を引き継ぐ必要がある。新しい値を使うと**既存ユーザーの Mesh group identity が変わってしまう**。`.env.prod` で `MESH_ZONE_SECRET_KEY=<旧 SAM 値>` を設定。stg は新規なので別 random 値で OK。

実装: `infra/smalruby-api/lambda/mesh-zone-get.ts`

### `GET /scratch-api-proxy/projects/{projectId}`

Scratch Foundation 公式 API (`https://api.scratch.mit.edu/projects/{projectId}`) のプロキシ。**ステータスコードを透過する**のがポイント。

旧 SAM 実装は Ruby の `Net::HTTP.get` を使っていたためボディだけ取得で**常に 200** を返していた。これが Issue #573 のバグ (404 を 200 として返してしまう) の原因。CDK 版は `fetch` で status code を透過する。

実装: `infra/smalruby-api/lambda/scratch-api-projects.ts`

### `GET /scratch-api-proxy/translate`

Scratch translate サービス (`https://translate-service.scratch.mit.edu/translate`) のプロキシ。

実装: `infra/smalruby-api/lambda/scratch-api-translate.ts`

## 環境変数

`.env.example` 参照。主要なもの:

| 変数 | デフォルト | 用途 |
|---|---|---|
| `STAGE` | - | デプロイ stage (`stg`, `stg2`, `prod`) |
| `CORS_ALLOWED_ORIGINS` | smalruby.app, smalruby.jp, localhost:8601 | CORS 許可オリジン (カンマ区切り) |
| `ROUTE53_PARENT_ZONE_NAME` | `api.smalruby.app` | カスタムドメイン親ゾーン |
| `SMALRUBY_API_CUSTOM_DOMAIN` | (stage により自動) | カスタムドメインのオーバーライド (`false` で無効化) |
| `MESH_ZONE_SECRET_KEY` | - **(必須)** | Mesh ドメイン生成のシークレット |
| `IMPORT_EXISTING_CUSTOM_DOMAIN` | `false` | prod カットオーバー時に既存ドメインを import |
| `IMPORTED_REGIONAL_DOMAIN_NAME` | - | import するドメインの regional domain name |
| `IMPORTED_REGIONAL_HOSTED_ZONE_ID` | - | import するドメインの hosted zone ID |

## デプロイ

```bash
cd infra/smalruby-api

# Stage 切り替え
rm .env && ln -s .env.stg .env    # → stg
rm .env && ln -s .env.prod .env   # → prod

# ビルド + デプロイ
docker compose run --rm -w /app/infra/smalruby-api infra npm install
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk synth
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk diff
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk deploy
```

## テスト

```bash
# ユニットテスト (mock fetch、高速)
docker compose run --rm -w /app/infra/smalruby-api infra npm test

# Integration テスト (デプロイ済み stg エンドポイントへ実 HTTP リクエスト)
docker compose run --rm -w /app/infra/smalruby-api infra npm run test:integration
```

`lambda/tests/*.integration.test.ts` は **デプロイ済み stg エンドポイント** (`https://stg.api.smalruby.app`) に実リクエストを送ってデグレ検出する。Issue #573 の **404 透過バグ再発防止** が最重要のテストケース。

## ハマりどころ・運用ノート

### カットオーバー履歴 (2026-04-29)

prod 既存ドメイン `api.smalruby.app` を旧 SAM スタックから CDK スタックへ移行：

1. ✅ stg で動作確認 + frontend を `stg.api.smalruby.app` で結合テスト
2. ✅ `.env.prod` 作成 (`MESH_ZONE_SECRET_KEY` を旧 SAM 値で引き継ぎ、import 設定 3 環境変数を設定)
3. ✅ SAM スタックのドメインマッピング解除:
   ```bash
   aws apigateway delete-base-path-mapping --domain-name api.smalruby.app --base-path '(none)'
   ```
4. ✅ CDK deploy で新スタックに mapping 追加
5. ✅ 動作確認: 全 4 endpoint + CORS + integration tests (18 件) prod で pass
6. ✅ SAM スタック削除: `aws cloudformation delete-stack --stack-name smalruby-infra-prod`

実測ダウンタイム: **約 5 分** (CDK deploy + HTTP API mapping 反映待ち)

### Lambda 関数名は `smalruby-api-` プレフィックスで衝突回避

旧 SAM スタックの Lambda 関数名 (`smalruby-cors-proxy` 等) と衝突しないよう、CDK 側はすべて `smalruby-api-` で始まる名前に統一した。これで **SAM と CDK が並走できる**。最初から固有プレフィックスを付けるのが正解。

### 既存カスタムドメインは `import` で再利用

`api.smalruby.app` のような既存運用中のカスタムドメインは、CDK で新規作成しようとすると競合エラー。`apigatewayv2.DomainName.fromDomainNameAttributes()` で既存ドメインを参照し、新スタックは `ApiMapping` だけ作るパターンにする。

メリット:
- 既存 ACM 証明書 (DNS validation 不要) を再利用
- 既存 Route53 A レコードを再利用
- ダウンタイム = base path mapping swap の数分のみ

`IMPORT_EXISTING_CUSTOM_DOMAIN=true` フラグで切替。

### `mesh-zone-get` の secret key は引き継ぎ必須

`MESH_ZONE_SECRET_KEY` を変えると **既存ユーザーの Mesh ドメインがすべて変わる**。プライベート Mesh ネットワークで他ユーザーと通信できなくなる致命的な互換性破壊。

prod では必ず旧 SAM 値 (`uXM1VAA6MO39yJ+djz4kbpVGy3Rg1V3Z`) を引き継ぐ。stg は新規なので別 random 値で OK。

### Integration test の Origin は両環境で許可される値を使う

CORS preflight テストで `Origin: http://localhost:8601` を使うと prod の `CORS_ALLOWED_ORIGINS` に localhost が含まれない (意図的) ため fail する。

→ `https://smalruby.app` のように **両環境で許可される値**を使う。

## 関連ドキュメント

- [`README.md`](README.md) — Smalruby インフラ全体 (4 プロジェクト)
- `.claude/rules/infra/smalruby-api.md` — 開発ルール (より詳細)
- `.claude/rules/infra/development.md` — Stage 切替の共通パターン

## 関連 Issue

- Issue #573 — `/scratch-api-proxy/projects/{projectId}` の 404 透過バグ
- 旧 SAM 実装からの移行 (2026-04-29 カットオーバー完了)
