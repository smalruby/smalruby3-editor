# 管理 SPA（Admin）運用手順書

> **🆕 Smalruby 独自** — 管理 SPA（EPIC #1073）の運用者向け手順。設計は EPIC #1073 / スパイク #1074 の Decision Log（A〜F）。

## 管理者の登録（唯一の方法 = AWS コンソール手動操作）

アプリ内に管理者管理 UI は**存在しない**（F4・deny-by-default）。登録・削除は AWS コンソールでの DynamoDB 直接操作のみ:

1. AWS コンソール → DynamoDB → テーブル `SmalrubyAdmins`（prod）/ `SmalrubyAdmins-stg`（stg）
2. 「項目を作成」で以下を登録:
   - `email`（パーティションキー・文字列）: 管理者の **Google アカウントの verified email**（小文字）
   - 他の属性は不要（`sub` は**初回ログイン時に自動で固定**される）
3. 削除 = 項目の削除（即時に全アクセスが 403 になる）

### sub 固定（email 再利用防御）の仕組み

- 初回ログイン成功時に Google の `sub` が項目へ自動追記される（`firstLoginAt` も記録）
- 以後、**同じ email でも sub が異なる Google アカウントは 403**
- 管理者が正当に Google アカウントを作り直した場合は、コンソールで項目の `sub` 属性を削除すれば次回ログインで再固定される

## 認証構成

- **admin 専用 Google OAuth Client ID**（決定 B）: エディタの `GOOGLE_CLIENT_ID` とは別に GCP コンソールで作成し、`.env.prod` / `.env.stg` の `ADMIN_GOOGLE_CLIENT_ID` に設定する（**prod は未設定だとデプロイが落ちる**ガードあり）
  - 承認済み JavaScript 生成元: `https://smalruby.app`（+ stg 用に `http://localhost:8602`）
- stg のみ `DEV_BYPASS_TOKEN` による自動テスト用バイパスあり（prod 設定はデプロイ時に throw。バイパス identity `dev-admin@example.com` も **allowlist 登録が必要**）。**`dev-admin@example.com` は stg の allowlist にのみ登録し、prod には絶対に登録しない**（prod ではバイパスが無効なので実害はないが、`example.com` は IANA 予約で verified email を取得できないため無意味かつ紛らわしい）

## セキュリティ・コスト方針（ソース公開前提の脅威モデル）

Admin を含む Smalruby のソースは公開されるため、攻撃者は既知のエンドポイント（`admin.api.smalruby.app`）とルート・env 変数名を把握して攻撃してくる前提で設計している。

- **多層の認可（fail-closed）**: すべてのルートで ① Google 署名 + `aud=ADMIN_GOOGLE_CLIENT_ID` 検証 → ② `SmalrubyAdmins` 許可リスト（deny-by-default）→ ③ sub 固定。空クライアント ID は全拒否、未登録 email は 403、email 一致でも sub 不一致は 403。DynamoDB / S3 は非公開（S3 Block Public Access、アクセスは Lambda の IAM ロールか短命 presigned URL のみ）
- **prod のゲートレベル JWT authorizer**: prod は API Gateway の JWT authorizer（issuer `https://accounts.google.com` / audience = admin Client ID）で、**正当な署名トークンでない要求を Lambda 到達前に 401 で弾く**。→ 認証なしの DoS フラッドは Lambda 起動も Lambda ログ ingestion も発生させられない（費用がかからない）。stg は dev bypass（JWT ではない）を使う E2E のため authorizer なし（Lambda 側の同じ fail-closed 認可のみ）
  - ⚠️ prod デプロイ後の初回ログインで **必ず疎通確認**する。Google ID トークンの `iss` が万一 `accounts.google.com`（`https://` 無し）だと authorizer が弾くため、ログインできなければ authorizer の issuer 設定を疑う（現行トークンは `https://accounts.google.com`）
- **スロットリング**: 単一運用者ツールなのでレート 5 / バースト 10 に絞り、攻撃者が積み上げられる API Gateway リクエスト課金の上限を抑える（人間の操作は毎秒数回で十分）
- **追加コスト源を持たない**: X-Ray（トレーシング）不使用・API Gateway アクセスログ無効。Lambda ログは監査行と 500 のみ（401/403 はアプリログを出さない）。retention は prod 1 年（監査目的・低volume）/ stg 1 週間
- **CloudWatch 費用**: Admin のログ量は極小。艦隊全体の CloudWatch 無料枠超過は mesh-v2 の prod AppSync ログ（無期限保持）が主因であり Admin とは別問題（mesh-v2 側で retention と field log level を見直す）

## 監査ログ

- すべての管理操作は構造化ログ（`{"audit":true,"action":...,"adminEmail":...}`）として CloudWatch `/aws/lambda/SmalrubyAdminHandler{-stage}` に記録
- **prod の保持期間は 1 年**（通常の 1 ヶ月より長い。管理操作は監査対象のため）
- 検索例: CloudWatch Logs Insights で `filter audit = 1 | sort @timestamp desc`

## デプロイ

```bash
cd infra/smalruby-admin
ls -la .env                     # symlink でステージ選択（.env.stg / .env.prod）
eval "$(aws configure export-credentials --profile smalruby --format env)"
AWS_ACCOUNT_ID=007325983811 AWS_REGION=ap-northeast-1 npx cdk deploy --require-approval never
```

カスタムドメイン: `admin.api.smalruby.app`（prod）/ `stg.admin.api.smalruby.app`（stg）
