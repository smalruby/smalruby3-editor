# infra のデプロイ経路

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された仕組み

CDK プロジェクト（`infra/*`）を stg / prod へ反映する経路をまとめる。**どちらも GitHub Actions
`Deploy Infra`（`.github/workflows/deploy-infra-stg.yml`）から出す**。

| 環境 | いつ | 対象 | 直列化 |
|---|---|---|---|
| **stg** | PR に `deploy-stg` ラベル / develop への push / 手動起動 | 変更された infra プロジェクト | `concurrency` でスタック単位にキュー |
| **prod** | **develop へのマージ（push）で、stg が全部成功したあと** | 変更された infra プロジェクトのうち、prod と差分があるもの | 同上（`infra-deploy-prod-<project>`） |
| prod（例外） | 自動デプロイが「削除・置き換え」を検知して止めたとき | — | **人間**が手元で `npx cdk deploy --context stage=prod` |

## なぜ分けるのか

stg は**共有資源**で、人間と複数の autopilot worker が同時に触りうる。ローカルから各自が
`cdk deploy` すると、片方のデプロイ中にもう片方が入って CloudFormation の更新が中断する。
Actions に集約すれば `concurrency`（`cancel-in-progress: false`）でキュー化でき、
**実行中のデプロイを打ち切らずに**直列化できる。CloudFormation 自身も同一スタックの同時
UPDATE を拒否するので、二重の保険になる。

prod も同じ理由で Actions に寄せる。手作業だと、マージの前後どちらで出したか・出し忘れが
人によってぶれる。infra は「**後方互換な変更だけを GUI より先に develop へ入れる**」運用
（`.claude/rules/infra/development.md` の infra-first）なので、マージしたらすぐ prod に出してよい。
そのうえで、壊しうる変更は機械的に止める（下の「prod の安全装置」）。

## 使い方

### マージ前に stg で確認したい（DoD）

1. PR に **`deploy-stg`** ラベルを付ける。
2. `Deploy Infra` が走り、**変更された infra プロジェクトだけ**が stg へ出る。
3. workflow が PR に「どの SHA を stg に出したか」をコメントする。
4. **そのコメントの SHA が自分の PR のものであることを確認してから**動作確認する。
   別の PR があとからデプロイすると上書きされる（その場合は**もう一度ラベルを付ける**）。

> **ラベルは 1 回きりの操作**。run の完了時に workflow が自動で外す（成功・失敗どちらでも）。
> 付けっぱなしだと push のたびに再デプロイされてしまうため、外す作業は人間に任せていない。
> もう一度 stg に載せたいときは、そのつど付け直す。

### マージ後

`develop` への push に `infra/**` の変更が含まれていれば自動で stg へ出る。これにより
**stg が PR ブランチの状態のまま取り残されない**。

### prod へ出す（自動）

develop へのマージで、stg のあとに `[<project>] deploy prod` が走る。

1. `cdk diff --context stage=prod` を取り、ジョブの要約（Summary）に残す。
2. **差分が無ければ**何もしない。
3. **削除（`[-] AWS::...`）や置き換え（`requires replacement` / `may be replaced`）を含む**なら、
   出さずに失敗する（下の「prod の安全装置」）。
4. それ以外は `cdk deploy --context stage=prod` する。
5. 全プロジェクトが成功したら、マージした PR が `Refs #N` で参照している **🧱 infra の Issue を閉じる**。
   後続の GUI Issue（`autopilot-after: #N`）はこれを待っているので、ここで動き出す。
6. 失敗したら、マージした PR に「prod に出せなかった」とコメントする（infra の Issue は開いたまま）。

stg が 1 つでも失敗したら prod には進まない。

### prod の安全装置（削除・置き換え）

リソースの削除や置き換えは、いま動いている prod の画面や、古い画面を開いたままの生徒、
保存済みのデータを壊しうる。infra-first の運用では「削除・改名は GUI が移行したあとに別の
Issue で（Contract）」なので、自動デプロイでは出さない。止まったら人間が差分を読み、
問題が無ければ手元から出す（`.claude/rules/infra/development.md` の手順どおり `.env` symlink を
切り替える）。

```bash
cd infra/<project>
rm .env && ln -s .env.prod .env
AWS_PROFILE=smalruby npx cdk deploy --context stage=prod
```

出したら、残っている 🧱 infra の Issue は人間が閉じる。

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

prod 用は **Environment `prod` の Secrets** に入れる（下の 4.）。repo Secrets には入れない。

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

### 4. GitHub Environment `prod`（prod の自動デプロイ）

1. **Settings → Environments → New environment** で `prod` を作る（ブラウザで行う。理由は 3. と同じ）。
2. **Deployment branches** を **`develop` だけ**に制限する（PR ブランチから prod 用の権限に
   届かないようにする）。必要なら **Required reviewers** を付けると、prod へ出す直前に人間の
   承認を挟める。
3. AWS に **prod 用の IAM ロール**を作る。信頼ポリシーは Environment で絞る:

   ```json
   "StringEquals": {
     "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
     "token.actions.githubusercontent.com:sub": "repo:smalruby/smalruby3-editor:environment:prod"
   }
   ```

   権限は stg 用と同じく CDK デプロイに必要な範囲（同じアカウントなら stg 用ロールを流用せず、
   prod 用を分けると「stg の権限で prod を触れない」状態を保てる）。
4. Environment `prod` の **Variables** に `AWS_DEPLOY_ROLE_ARN`（3. のロール ARN）を登録する。
   ジョブが `environment: prod` のとき、Environment の値が repo Variables より優先される。
5. Environment `prod` の **Secrets** に、プロジェクトごとの prod 用 `.env` の全文を登録する:

   | Secret 名 | 中身 |
   |---|---|
   | `INFRA_PROD_DOTENV_SMALRUBY_ADMIN` | `infra/smalruby-admin/.env.prod` |
   | `INFRA_PROD_DOTENV_SMALRUBY_CLASSROOM` | `infra/smalruby-classroom/.env.prod` |
   | `INFRA_PROD_DOTENV_SMALRUBY_BUG_REPORT` | `infra/smalruby-bug-report/.env.prod` |
   | `INFRA_PROD_DOTENV_SMALRUBY_MESH_V2` | `infra/smalruby-mesh-v2/.env.production` |
   | `INFRA_PROD_DOTENV_SMALRUBY_RUBYTEE_RELAY` | `infra/smalruby-rubytee-relay/.env.prod` |
   | `INFRA_PROD_DOTENV_SMALRUBY_API` | prod 用の `.env`（無ければ `STAGE=prod` の 1 行） |

   ```bash
   bin/gh-admin secret set INFRA_PROD_DOTENV_SMALRUBY_CLASSROOM --env prod < infra/smalruby-classroom/.env.prod
   ```

   **`DEV_BYPASS_TOKEN` を入れない**（prod に設定されていると stack が throw して失敗する）。

未設定のまま develop に infra の変更が入ると、prod のジョブが「何を登録すべきか」を示して
失敗し、マージした PR にその旨をコメントする（stg は出る）。

## 関連

- 規約: `.claude/rules/infra/development.md`（デプロイ経路・infra-first の手順）
- autopilot: `.claude/rules/autopilot/prompts.md`（worker は `cdk deploy` を実行しない）
- workflow: `.github/workflows/deploy-infra-stg.yml`
