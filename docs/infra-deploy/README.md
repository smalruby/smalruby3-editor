# infra のデプロイ経路

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された仕組み

CDK プロジェクト（`infra/*`）を stg / prod へ反映する経路をまとめる。**stg と prod で経路が違う**のが要点。

| 環境 | 経路 | 実行者 | 直列化 |
|---|---|---|---|
| **stg** | GitHub Actions `Deploy Infra (stg)` | PR に `deploy-stg` ラベル / develop への push / 手動起動 | `concurrency` でスタック単位にキュー |
| **prod** | 手元で `npx cdk deploy --context stage=prod` | **人間**（AI は明示的な指示があるときのみ） | 人間が直列に行う |

## なぜ分けるのか

stg は**共有資源**で、人間と複数の autopilot worker が同時に触りうる。ローカルから各自が
`cdk deploy` すると、片方のデプロイ中にもう片方が入って CloudFormation の更新が中断する。
Actions に集約すれば `concurrency`（`cancel-in-progress: false`）でキュー化でき、
**実行中のデプロイを打ち切らずに**直列化できる。CloudFormation 自身も同一スタックの同時
UPDATE を拒否するので、二重の保険になる。

prod は「いつ・誰が・何を出したか」を人間が握るべきなので、自動化しない。

## 使い方

### マージ前に stg で確認したい（DoD）

1. PR に **`deploy-stg`** ラベルを付ける。
2. `Deploy Infra (stg)` が走り、**変更された infra プロジェクトだけ**が stg へ出る。
3. workflow が PR に「どの SHA を stg に出したか」をコメントする。
4. **そのコメントの SHA が自分の PR のものであることを確認してから**動作確認する。
   別の PR があとからデプロイすると上書きされる（その場合は**もう一度ラベルを付ける**）。

> **ラベルは 1 回きりの操作**。run の完了時に workflow が自動で外す（成功・失敗どちらでも）。
> 付けっぱなしだと push のたびに再デプロイされてしまうため、外す作業は人間に任せていない。
> もう一度 stg に載せたいときは、そのつど付け直す。

### マージ後

`develop` への push に `infra/**` の変更が含まれていれば自動で stg へ出る。これにより
**stg が PR ブランチの状態のまま取り残されない**。

### prod へ出す

人間が手元で行う（`.claude/rules/infra/development.md` の手順どおり `.env` symlink を切り替える）。

```bash
cd infra/<project>
rm .env && ln -s .env.prod .env
AWS_PROFILE=smalruby npx cdk deploy --context stage=prod
```

## 初期セットアップ（人間の作業・1 回だけ）

workflow は前提が未設定だと**理由を明示して失敗する**。以下を用意する。

### 1. GitHub OIDC 用の IAM ロール

AWS 側に GitHub の OIDC プロバイダ（`token.actions.githubusercontent.com`）と、そこから
AssumeRole できるデプロイ用ロールを作る。信頼ポリシーは**このリポジトリに絞る**。

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike": { "token.actions.githubusercontent.com:sub": "repo:smalruby/smalruby3-editor:*" }
  }
}
```

権限は CDK デプロイに必要な範囲（CloudFormation・S3 のアセットバケット・各サービス）。
**prod スタックを触らせない**なら、リソースやスタック名で条件を付ける。

作成したロール ARN を **repo Variables `AWS_DEPLOY_ROLE_ARN`** に登録する
（Settings → Secrets and variables → Actions → Variables）。

### 2. stg の env を Secrets に登録

`.env.stg` は gitignored なので CI からは見えない。**プロジェクトごとに**、`.env.stg` の中身を
そのまま Secrets に入れる。

| Secret 名 | 中身 |
|---|---|
| `INFRA_STG_DOTENV_smalruby-admin` | `infra/smalruby-admin/.env.stg` の全文 |
| `INFRA_STG_DOTENV_smalruby-classroom` | 同上 |
| `INFRA_STG_DOTENV_smalruby-bug-report` | 同上 |
| `INFRA_STG_DOTENV_smalruby-mesh-v2` | 同上（`.env.stg`） |
| `INFRA_STG_DOTENV_smalruby-rubytee-relay` | 同上 |
| `INFRA_STG_DOTENV_smalruby-api` | 同上 |

登録していないプロジェクトは、デプロイしようとした時点で**そのプロジェクトのジョブだけ**が
「何を登録すべきか」を示して失敗する（他のプロジェクトは進む）。

> `.env.prod` は**登録しない**。prod を CI から出せる状態にしないため。

### 3. GitHub Environment `stg`

**Settings → Environments → New environment** で `stg` を作る（**ブラウザで行う**）。

workflow は `environment: stg` を使い、**AWS 側の信頼条件も
`sub = repo:smalruby/smalruby3-editor:environment:stg` に依存している**（この Environment を
通るジョブ以外は AssumeRole できない）。Environment があるとデプロイ履歴が GitHub 上に残り、
必要なら保護ルール（対象ブランチの制限・レビュー必須）も足せる。

> **API では作らない。** `PUT /repos/{owner}/{repo}/environments/{name}` は
> **`administration=write`** を要求する（`X-Accepted-Github-Permissions` で確認済み）。
> これはブランチ保護やリポジトリ設定の変更まで含む強い権限なので、この一度きりの操作のために
> トークンへ付与しない。`bin/gh-admin` 用の PAT には **Secrets / Variables の書き込みだけ**を
> 持たせる（`.claude/rules/github-app-bot.md`）。

## 関連

- 規約: `.claude/rules/infra/development.md`（デプロイ経路・Expand-Contract の手順）
- autopilot: `.claude/rules/autopilot/prompts.md`（worker は `cdk deploy` を実行しない）
- workflow: `.github/workflows/deploy-infra-stg.yml`
