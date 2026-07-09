# smalruby-api

CDK project for Smalruby's API Gateway endpoints (HTTP API v2 + Lambda).

旧 SAM 実装 (`smalruby/smalruby-infra` リポジトリ) の置き換え。
4 エンドポイントを TypeScript Lambda + HTTP API v2 (built-in CORS) に移行する。

## Endpoints

| Path | Method | Lambda 関数名 (prod) | 説明 |
|------|--------|----------------------|------|
| `/cors-proxy` | GET | `smalruby-api-cors-proxy` | 任意 URL のフェッチ + Google Drive URL 変換 + バイナリ Base64 化 |
| `/mesh-domain` | GET | `smalruby-api-mesh-zone` | source IP から Mesh ドメイン (CRC32) を生成 |
| `/scratch-api-proxy/projects/{projectId}` | GET | `smalruby-api-scratch-projects` | Scratch API のプロジェクト情報取得プロキシ (status pass-through) |
| `/scratch-api-proxy/translate` | GET | `smalruby-api-scratch-translate` | ⚠️ **obsolete（使わない）** — Scratch translate 専用プロキシ。翻訳拡張は**共通 `/cors-proxy` 経由に統一**（text2speech #861 と同方式・translate は #862）。新規開発でこの専用エンドポイントを使わないこと。Lambda 自体は当面残置（削除は deploy を伴うため別作業） |

> **CORS 回避プロキシは共通 `/cors-proxy` に一本化する方針**。Scratch のサービス（translate /
> synthesis 等）を CORS 回避で叩くときは、拡張機能側で `https://api.smalruby.app/cors-proxy?url=<encoded 実URL>`
> を組む（`SERVER_HOST` 等の upstream 定数は変えず fetch 直前でラップ）。translate 専用の
> `smalruby-api-scratch-translate` は obsolete。

stg では Lambda 関数名に `-stg` サフィックスが付く (`smalruby-api-cors-proxy-stg` 等)。
OPTIONS (preflight) は HTTP API v2 の built-in CORS で自動処理 — 旧 `cors-for-smalruby` Lambda は不要。

**Lambda 関数名の `smalruby-api-` プレフィックス**: 旧 SAM スタックの `smalruby-cors-proxy` などと衝突しないよう、CDK 側はすべて `smalruby-api-` で始まる名前に統一している。

## Custom Domains

| Stage | Domain |
|-------|--------|
| stg | `stg.api.smalruby.app` (CDK が ACM 証明書 + Route53 レコードも管理) |
| prod | `api.smalruby.app` (既存ドメインを **import** して再利用、ACM/Route53 は別管理) |

prod カットオーバー (2026-04-29 完了) では、旧 SAM スタック `smalruby-infra-prod`
が保持していた `api.smalruby.app` カスタムドメインを CDK スタックから
`apigatewayv2.DomainName.fromDomainNameAttributes()` で **import** する方式を採用。
これにより:

- 既存 ACM 証明書 (`b813732a-...`) と Route53 A レコードを再利用、
  証明書再発行や DNS 切り替えの待ち時間が発生しない
- ダウンタイムは「base path mapping を SAM から CDK へ切り替える数分」のみ
- import 設定は `.env.prod` の以下 3 環境変数で制御:
  ```
  IMPORT_EXISTING_CUSTOM_DOMAIN=true
  IMPORTED_REGIONAL_DOMAIN_NAME=d-8g2cqu3hqg.execute-api.ap-northeast-1.amazonaws.com
  IMPORTED_REGIONAL_HOSTED_ZONE_ID=Z1YSHQZHG15GKL
  ```

## Commands

```bash
# Install
docker compose run --rm -w /app/infra/smalruby-api infra npm install

# Synth / diff / deploy
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk synth
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk diff
docker compose run --rm -w /app/infra/smalruby-api infra npx cdk deploy

# Unit tests (mocked fetch, fast)
docker compose run --rm -w /app/infra/smalruby-api infra npm test

# Integration tests (実際の stg エンドポイントへ HTTP 送信)
docker compose run --rm -w /app/infra/smalruby-api infra npm run test:integration
```

## Integration Tests

`lambda/tests/*.integration.test.ts` は **デプロイ済み stg エンドポイント** に対して
実際の HTTP リクエストを送信して動作を検証する。コーナーケース確認とデグレ防止が目的。

- Issue #573 の **404 透過バグ再発防止** が最重要のテストケース
- 必要な環境変数: `SMALRUBY_API_ENDPOINT` (`.env.stg` で設定済み、デフォルト `https://stg.api.smalruby.app`)
- デプロイ後は必ず `npm run test:integration` を実行して 18 テストすべて緑であることを確認する
- CI では実行しない (npm test のユニットテストとは独立。ローカル/手動運用)

## Stage Switching

```bash
cd infra/smalruby-api
rm .env && ln -s .env.stg .env    # → stg
rm .env && ln -s .env.prod .env   # → prod
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STAGE` | Deployment stage (`stg`, `stg2`, `prod`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |
| `ROUTE53_PARENT_ZONE_NAME` | Parent zone for custom domain (default: `api.smalruby.app`) |
| `SMALRUBY_API_CUSTOM_DOMAIN` | Override custom domain. Set `false` to disable |
| `MESH_ZONE_SECRET_KEY` | **Secret** — used to derive Mesh group identity from source IP |

## Migration Notes

旧 SAM スタックとの主な差分:

1. **REST API v1 → HTTP API v2** へ変更。built-in CORS で OPTIONS Lambda 不要に
2. **Ruby 3.3 → Node.js 20.x (TypeScript)** で他 infra プロジェクトと言語を統一
3. **`scratch-api-proxy/projects/{projectId}` のステータスコード透過** — 旧実装は `Net::HTTP.get` でボディだけ取得 → 常に 200 を返していた (関連 Issue #573)
4. **`mesh-zone-get` の secret key を環境変数化** — 旧実装はハードコード
5. **stg 環境を新設** — 旧実装は prod のみ

## Cutover (prod) 手順 — 完了済み (2026-04-29)

完了済みの手順を記録として残す:

1. ✅ stg で動作確認 + frontend を `stg.api.smalruby.app` で結合テスト
2. ✅ `.env.prod` 作成 (`MESH_ZONE_SECRET_KEY` を旧実装と同値、import 設定 3 環境変数)
3. ✅ SAM スタックのドメインマッピング解除: `aws apigateway delete-base-path-mapping --domain-name api.smalruby.app --base-path '(none)'`
4. ✅ CDK deploy: `cdk deploy --context stage=prod` で新スタックに mapping 追加
5. ✅ 動作確認: 全 4 endpoint + CORS + integration tests (18 件) prod で pass
6. ✅ SAM スタック削除: `aws cloudformation delete-stack --stack-name smalruby-infra-prod`
7. ⏳ smalruby/smalruby-infra リポジトリの該当ファイルを deprecate (後続作業)

ダウンタイム実測: 約 5 分 (CDK deploy + HTTP API mapping 反映待ち)

## Source

実装場所: `lambda/*.ts`, `lib/smalruby-api-stack.ts`, `bin/smalruby-api.ts`
ユニットテスト: `lambda/tests/*.test.ts`

## ハマりポイント / 学び (2026-04-29 prod カットオーバー)

### 1. 既存 SAM スタックと CDK スタックを並走させる前提で名前を組む

CDK 側の Lambda 関数名を旧 SAM 側と同じにすると、prod カットオーバー時に CFN
レベルで `Resource of type 'AWS::Lambda::Function' with identifier 'smalruby-cors-proxy' already exists`
で deploy が失敗する。SAM スタックは別 CFN スタックなので、まだ存在する間は
そこにある Lambda 名と衝突する。**最初から CDK 側で固有プレフィックス
(`smalruby-api-`) を付けておくのが正解**。

別解として「SAM を先に削除してから CDK deploy」もあるが、ドメインマッピング
切り替えが先か関数移行が先かで `api.smalruby.app` のダウンタイムが伸びる。
固有プレフィックスにしておけば衝突なしで並走できる。

### 2. 既存 API Gateway カスタムドメインは「import」で再利用する

`api.smalruby.app` のような既に運用中のカスタムドメインは、CDK で新規作成
しようとすると競合エラーで失敗する。CDK の `apigatewayv2.DomainName.fromDomainNameAttributes()`
で既存ドメインを参照し、新スタックは `ApiMapping` だけ作るパターンにする。

メリット:
- 既存 ACM 証明書 (DNS validation 不要) を再利用 → cdk deploy が速い
- 既存 Route53 A レコードを再利用 → DNS 切り替え不要
- ダウンタイム = base path mapping swap の数分のみ

`IMPORT_EXISTING_CUSTOM_DOMAIN=true` フラグで切り替え可能 (本プロジェクトの実装)。

### 3. base path mapping は domain と切り離されている

`api.smalruby.app` は API Gateway の **Custom Domain** リソース、その
`base path mapping` は別リソース。SAM スタックを CFN delete する前に
mapping だけ `aws apigateway delete-base-path-mapping --base-path '(none)'`
で外し、その瞬間に `cdk deploy` で新 mapping を作成すれば
`api.smalruby.app` 自体は残ったまま、ルーティングだけが SAM → CDK へ移る。

### 4. integration test の Origin は両環境で許可される値を使う

CORS preflight テストで `Origin: http://localhost:8601` を期待値にしたら、
prod では `.env.prod` の `CORS_ALLOWED_ORIGINS` に localhost が含まれない
(意図的) ため `access-control-allow-origin` が一致せず fail。

教訓: integration test を **両環境で動かす前提** なら、Origin は
`https://smalruby.app` のように両方で許可される値にする。localhost を
個別に試したいときは別テストで条件分岐するか、stg 専用にスキップ条件を
入れる。

### 5. mesh-zone-get の secret key は引き継ぎ必須

旧 SAM 実装の `MeshZoneGet` は secret_key がハードコード
(`uXM1VAA6MO39yJ+djz4kbpVGy3Rg1V3Z`)。CDK 化に合わせて環境変数化したが、
**新しい値を使うとすべての既存ユーザーの mesh group identity (CRC32) が
変わってしまう**。プライベートな mesh ネットワークで他ユーザーと通信できなく
なる致命的な互換性破壊。

prod カットオーバー時は `.env.prod` で **必ず旧 SAM のハードコード値を引き継ぐ**。
stg は新規だったので別の random 値を割り当てた。

### 6. CDK で `IDomainName` を import すると `manageRoute53Record` は false に

`apigatewayv2.DomainName.fromDomainNameAttributes()` で import したドメイン
オブジェクトは CDK 管理外。`new route53.ARecord(...)` で alias を作ると、
既存の Route53 record と衝突する (`Resource conflict`)。

import 時は ARecord 作成をスキップする条件分岐を入れる
(`manageRoute53Record` フラグ)。これで prod 時は CDK が DNS 触らない。

### 7. CFN の "Delete initiated" 後の検証は数十秒待つ

`aws cloudformation delete-stack` は非同期。`describe-stacks` が
`does not exist` を返すまで polling しないと、削除完了を誤認する。
本ケースでは `until` ループで 15 秒間隔ポーリングを使った。

### 8. 検証は curl と Playwright の両方で

CDK deploy 直後はカスタムドメインの routing 反映に数十秒〜数分のタイムラグが
あり、初回 curl が 403 (`Forbidden` from API Gateway) を返すことがある。
焦らずポーリングする。

prod では Playwright で smalruby.app から実際の fetch を実行して、
`api.smalruby.app` への CORS/route/data flow を end-to-end で確認するのが
確実。`response.headers.get('access-control-allow-origin')` は Fetch spec
の制約で JS から `null` に見えるが、fetch が成功している事実が CORS
preflight 成功の証拠。
