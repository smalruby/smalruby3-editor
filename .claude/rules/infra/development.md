---
paths:
  - "infra/"
  - "infra/*"
  - "infra/Dockerfile"
---

# Infrastructure Development (infra/)

AWS CDK infrastructure projects live in `infra/`. Each project is independent from npm workspaces.

## Projects

| Project | Path | Description |
|---------|------|-------------|
| smalruby-mesh-v2 | `infra/smalruby-mesh-v2/` | Mesh v2 networking service (AppSync + DynamoDB) |
| smalruby-rubytee-relay | `infra/smalruby-rubytee-relay/` | Rubytee AI relay (API Gateway + Lambda + DynamoDB) |
| smalruby-classroom | `infra/smalruby-classroom/` | Classroom service (API Gateway + Lambda + DynamoDB + S3) |
| smalruby-api | `infra/smalruby-api/` | Smalruby API endpoints (HTTP API v2 + Lambda): cors-proxy, mesh-domain, scratch-api-proxy/* |
| smalruby-bug-report | `infra/smalruby-bug-report/` | Program bug report service (HTTP API v2 + Lambda + DynamoDB + S3): 作品添付つき不具合報告 + 管理者レジストリ |
| smalruby-admin | `infra/smalruby-admin/` | Admin service (HTTP API v2 + Lambda + DynamoDB): 管理 SPA のバックエンド（deny-by-default 許可リスト + 監査ログ） |
| smalruby-web-hosting | `infra/smalruby-web-hosting/` | Web 配信基盤（Route 53 + S3 + CloudFront + ACM + GitHub OIDC ロール）: ブランチプレビュー `preview.smalruby.app/<slug>/`。stg だけに作り、prod は空のスタック |

See project-specific rules for details:
- `.claude/rules/infra/smalruby-mesh-v2.md`
- `.claude/rules/infra/smalruby-classroom.md`
- `.claude/rules/infra/smalruby-rubytee-relay.md`
- `.claude/rules/infra/smalruby-api.md`
- `.claude/rules/infra/smalruby-bug-report.md`
- `.claude/rules/infra/smalruby-admin.md`
- `.claude/rules/infra/smalruby-web-hosting.md`

## Docker Service

Use the `infra` service for all CDK operations:

- Service name: `infra`
- Default working directory: `/app/infra/smalruby-mesh-v2`
- Includes: Node.js 24 + AWS CLI v2

For projects other than mesh-v2, override the working directory with `-w`:

```bash
docker compose run --rm -w /app/infra/<project-name> infra <command>
```

## cdk.context.json

CDK のコンテキストキャッシュファイル `cdk.context.json` は **コミットする**。CDK のガイドラインに従い、デプロイの再現性を保証する。Route53 ホストゾーン ID など、CDK が自動的にキャッシュした値を含む。

- `cdk.context.json` は `.gitignore` に追加**しない**
- デプロイ後に生成・更新された場合はコミットする

## デプロイ経路（どちらも GitHub Actions）

**stg も prod も `.github/workflows/deploy-infra-stg.yml`（workflow 名 `Deploy Infra`）だけから出す。**
ローカルからの `cdk deploy` は、自動デプロイが安全装置で止まったときの人間の手作業に限る。

| 環境 | いつ出るか | 誰が |
|---|---|---|
| stg | PR に **`deploy-stg` ラベル**を付けたとき / develop への push / 手動起動 | 自動（ラベルは人間か worker が付ける） |
| prod | **develop へのマージ（push）で、stg が成功したあと**。prod との差分があるプロジェクトだけ | 自動 |
| prod（例外） | 自動デプロイが「削除・置き換え」を検知して止めたとき | **人間**が内容を確かめて手元から `npx cdk deploy --context stage=prod` |

- prod のジョブは `cdk diff` を取り、**リソースの削除（`[-] AWS::...`）や置き換え（replacement）が
  含まれていたら出さずに失敗する**。後方互換な変更（追加・設定変更・Lambda のコード更新）だけが
  自動で出る。差分が無ければ何もしない。
- prod に出せたら、マージした PR が `Refs #N` で参照している **🧱 infra の Issue を workflow が閉じる**。
- AI は手元から prod へ出さない（人間の明示的な指示があるときだけ）。

### なぜ stg をローカルから撃たないか

stg は**共有資源**で、人間と複数の autopilot worker が同時に触りうる。ローカルから各自が
`cdk deploy` すると、片方のデプロイ中にもう片方が入って CloudFormation が中断する。Actions に
集約すると `concurrency` でキュー化でき、実行中の run を打ち切らずに直列化できる。

- **worker はローカルから `cdk deploy` しない**（`.claude/rules/autopilot/prompts.md`）。
- stg に自分の変更を載せたいときは PR に `deploy-stg` ラベルを付け、Actions の完了を待つ。
  ラベルは **1 回きり**で、run の完了時に workflow が自動で外す（付けっぱなしだと push の
  たびに再デプロイされるため）。再度載せたいときは付け直す。
- **stg は上書きされうる**。DoD をする前に、workflow が PR に残したコメントで
  「いまの stg が自分の SHA か」を確認する。違えばラベルを付け直して再デプロイする。
- develop への infra push でも stg へデプロイが走るので、**マージ後は stg が develop に収束**する。
- **同じ infra プロジェクトを変える PR が同時に 2 つあるときは、後の PR を先の PR のブランチから
  作る**（または 1 つにまとめる）。stg のデプロイはプロジェクト単位でキュー化されるだけなので、
  別々のブランチから出すと後のデプロイが先の変更を消し、DoD が違うコードに対して通ってしまう。
  別プロジェクト同士（例: classroom と rubytee-relay）なら互いに上書きしないので、分けたまま
  並行してよい（`concurrency` の group が `infra-deploy-stg-<project>`）。

## infra は別 Issue に分けて先に出す（infra-first）

ブランチプレビューは **stg の API** を見る（本番のデータをテストに使わないため。prod の API を
見るのは本番デプロイ = smalruby.app だけ）。GUI と infra を 1 つの PR に入れると、新しい API が
stg に無いのでプレビューで確認できず、マージしても prod に API が無いまま GUI が本番へ出うる。
そこで **infra の変更は必ず GUI と別の Issue（親 Issue の sub-issue）にし、先に develop へ
マージして stg → prod に出す**。GUI の Issue はそのあとに動き、プレビュー（stg）で確認する。

> **旧プレビューに注意**: GitHub Pages のプレビュー（`https://smalruby.jp/smalruby3-editor/<branch>/`）は
> もう更新されない（既に出ていたものが残っているだけで、**prod の API を見る**）。確認には PR のコメントに出る
> `https://preview.smalruby.app/<slug>/` を使う。

1. **Issue を分ける**: infra（`infra/**` だけ）を 1 つ、それ以外（GUI など）を 1 つ以上。
   - infra の Issue には **`🧱 infra` ラベル**を付け、**`autopilot-base:` は書かない**
     （親が topic ブランチでも、infra は develop へ出す）。
   - GUI の Issue には `autopilot-after: #<infra の Issue>` を書く（親と同じ `autopilot-base:` でよい）。
2. **infra は後方互換な変更だけ**（Expand）: ルート・任意フィールド・テーブル・GSI・権限の**追加**、
   既存の挙動を変えない範囲の修正だけ。**削除・改名・必須化・レスポンス形の変更・既存リソースの
   置き換えはしない**（いま動いている prod の画面と、まだ古い画面を開いている生徒を壊すため）。
   GUI がまだ使っていない API が先に prod にあっても害が無い形にする。
3. infra の PR は **develop 宛て**で、本文は **`Refs #<infra の Issue>`**（`Closes` にしない。
   マージ時点ではまだ prod に出ていないため）。確認は Lambda の unit test と、必要なら
   `deploy-stg` ラベルで stg に出して integration test。
4. **マージ → stg → prod が自動で走り、prod に出たら workflow が infra の Issue を閉じる** →
   GUI の Issue が動き出す（autopilot は 🧱 infra の依存を「GitHub で closed」になるまで待つ）。
   prod を待つのは、GUI が develop から本番（smalruby.app）へ出たときに API が無い状態を作らないため。
5. GUI は**ブランチプレビューで確認**する（stg の API がもうある。確かめる前に下の
   「プレビューで確かめる前に stg の状態を確認する」を行う）。
6. **Contract**（旧経路の削除など）は、GUI が全部移行して prod に出たあと、**別の infra Issue** で
   行う。これは削除を含むので prod の自動デプロイが止まる → 人間が確認して手元から出す。

infra と GUI が同じ Issue に混ざっていたら、作業を始める前に分ける（autopilot は triage /
decompose で分ける。人間が Issue を作るときも同じ）。

## ブランチプレビューで確かめる（stg の API）

ブランチプレビュー（`https://preview.smalruby.app/<slug>/`）は stg の API を見る。dev server を
立てずに、push 済みのブランチをそのまま確かめられる。PR を開くと CI（`.github/workflows/ci-cd.yml` の
`preview-deploy`）が stg の値でビルドして出し、PR にコメントで URL を残す（`ci-cd.yml` の
`paths-ignore` に当たるファイルだけを変える PR では CI が走らないので出ない）。develop は
`https://preview.smalruby.app/develop/` に出る。

- **slug**（`scripts/preview-slug.mjs`）: ブランチ名を小文字にし、英数字以外の並びを `-` 1 つに
  置き換え、先頭と末尾の `-` を落とす。**この正規化で名前が変わったときは、元の名前のハッシュ 8 桁を
  必ず足す**（例: `topic/autopilot-1329` → `topic-autopilot-1329-<8 桁>`。`fix/foo_bar` と
  `fix/foo-bar` のように正規化すると同じになるブランチが、プレビューを上書きし合わないため）。
  そのまま slug として使える名前（`develop` など）は変えない。63 文字（DNS ラベルの上限）を超える
  名前は切り詰めてハッシュを足す。使える文字が残らない名前（日本語だけ等）は `b-<ハッシュ 8 桁>`。
  slug は推測で組み立てず、PR に CI が残すコメントの URL を使うか、`node scripts/preview-slug.mjs <branch>` で求める。
- **片付け**（`.github/workflows/preview-cleanup.yml`）: PR を閉じるとそのブランチのプレビューが消え、
  週 1 回リモートに無いブランチのプレビューが消える（`develop` は消さない）。

### `?devlogin=<DEV_BYPASS_TOKEN>` でログインを省く

プレビューでは `?devlogin=<DEV_BYPASS_TOKEN>` を付けると、Google / Microsoft のログインを
省いて先生としてログインできる。トークンは **stg の API が照合する**（prod は
`infra/smalruby-classroom/lib/classroom-stack.ts` のガードで `DEV_BYPASS_TOKEN` を持てないので、
本番では効かない）。値はローカルの `.env` の `DEV_BYPASS_TOKEN`
（`.claude/rules/env-file.md`）。**トークンを Issue / PR / コメント / コミットに書かない**。

AI（autopilot の verify など）が Playwright で確かめる手順（headless の `pw-check`。
`.claude/rules/autopilot/prompts.md` の「UI 確認」）:

```bash
# .env から読むだけ。echo しない・ログや GitHub に出さない
DEV_BYPASS_TOKEN="$(grep -E '^DEV_BYPASS_TOKEN=' .env | cut -d= -f2-)"
node tools/autopilot/bin/pw-check \
  "https://preview.smalruby.app/<slug>/?no_beforeunload=1&devlogin=${DEV_BYPASS_TOKEN}" \
  --wait '[class*="gui_editor-wrapper"]' --timeout 90000 --eval '<DoD 確認式>'
```

- 先生ダッシュボードへは「⚙ 設定 → クラス管理」から入る。クラス管理の data-testid と先生フローの
  自動化は `docs/classroom/testing.md`。
- スクリーンショットは `tmp/` 配下に保存する（URL にトークンが入るので、URL を含むログや
  スクショの説明文を GitHub に貼らない）。**`pw-check` の出力 JSON の `url`（失敗時は `error` も）には
  トークン入りの URL がそのまま出る**ので、出力を貼らずに確認結果だけを書く。
- GitHub Pages の旧プレビュー（`smalruby.jp/smalruby3-editor/<branch>/`）はもう更新されず、prod を見るので
  devlogin は効かない。ログインの確認は `preview.smalruby.app` で行う。

### プレビューで確かめる前に stg の状態を確認する

stg は**共有資源**で、`deploy-stg` ラベルを付けた PR の変更で**一時的に develop とずれる**ことが
ある。ずれが戻るのは、develop への push がそのプロジェクトを変えたとき（その PR のマージを含む）か、
`workflow_dispatch` で develop からそのプロジェクトを出し直したときだけ（develop への push で出るのは、
その push で変わったプロジェクトだけ。PR を閉じただけ・別プロジェクトの push では戻らない）。プレビューは
いまの stg を見るので、確かめる前に「stg の各プロジェクトが develop（または自分の PR）の状態か」を
確認する。stg に出す経路は `Deploy Infra`（`.github/workflows/deploy-infra-stg.yml`）だけなので、
その run の履歴を見ればよい:

```bash
# 直近の Deploy Infra の run（push = develop、pull_request = deploy-stg ラベルの PR）
GH_TOKEN="$(bin/bot-token)" gh run list --repo smalruby/smalruby3-editor \
  --workflow deploy-infra-stg.yml --limit 10 \
  --json databaseId,event,headBranch,headSha,conclusion,createdAt
# どのプロジェクトを stg に出したか（ジョブ名が "[<project>] deploy stg"）
GH_TOKEN="$(bin/bot-token)" gh run view <databaseId> --repo smalruby/smalruby3-editor \
  --json jobs --jq '.jobs[] | select(.name | test("deploy stg")) | [.name, .conclusion] | @tsv'
```

- 自分の確認に関わるプロジェクト（例: GUI がクラス管理を使うなら `smalruby-classroom`）について、
  **最後に成功した stg デプロイ**が `event=push`（または `workflow_dispatch`）・`headBranch=develop` なら stg = develop。
- 最後が `event=pull_request` なら、その PR の変更が載っている。自分の PR でなければ、その PR の
  「🚀 stg にデプロイしました」コメント（commit / branch）を見て、確認に影響するか判断する。
  影響するなら、その PR の作業が終わるのを待つか、人間に知らせる（**他人の PR の stg を
  勝手に上書きしない**）。
- 自分の PR の infra を stg で確かめたいときは `deploy-stg` ラベルを付け、PR に残るコメントで
  自分の SHA が載ったことを確かめてから確認する（上の「なぜ stg をローカルから撃たないか」）。

## AWS Credentials

CDK の synth/diff/deploy には AWS クレデンシャルが必要。**devpod / devcontainer の中から
直接デプロイできる**（AWS IAM Identity Center の SSO ログインでコンテナ内に一時クレデン
シャルを取得する。ホストの `~/.aws` を mount する必要はない）。

### 推奨: AWS IAM Identity Center (SSO)

接続先の値（start URL / account ID / role など）は **`infra/aws-sso.env` の 1 ファイルに集約**
されている（非秘密・コミット済み）。**fork して別の AWS 組織で動かす場合は、このファイルの
値だけを書き換える。**

```bash
# 1. infra/aws-sso.env から ~/.aws/config を生成 (1 度だけ)
bin/setup-aws-sso

# 2. ログイン (コンテナにブラウザが無い場合は URL + code が表示される。
#    ホストのブラウザで開いて承認する。code には数分の有効期限あり)
aws sso login --sso-session smalruby --use-device-code

# 3. 以降は AWS_PROFILE を指定して実行
export AWS_PROFILE=smalruby
aws sts get-caller-identity   # 疎通確認

# 4. デプロイ例
cd infra/smalruby-bug-report
AWS_PROFILE=smalruby AWS_REGION=ap-northeast-1 npx cdk deploy --context stage=stg --require-approval never
```

- 値の実体は `infra/aws-sso.env`（`AWS_SSO_PROFILE` / `AWS_SSO_START_URL` / `AWS_SSO_REGION` /
  `AWS_SSO_ACCOUNT_ID` / `AWS_SSO_ROLE`）。`bin/setup-aws-sso` がこれを読んで `~/.aws/config`
  を生成する（ハードコードしない）。
- アカウント/ロールが分からないときは `aws configure sso` で対話的に選ぶか、ログイン後に
  `aws sso list-accounts` / `aws sso list-account-roles` で確認できる。
- トークンは `~/.aws/sso/cache/` にキャッシュされ、期限切れ後は `aws sso login` で再取得。
- CDK CLI はクレデンシャルから account/region を自動解決するため、`bin/*.ts` の
  `CDK_DEFAULT_ACCOUNT`/`AWS_REGION` は明示不要（`AWS_PROFILE` だけで足りる）。

### 代替: 環境変数 / 静的プロファイル

一時的なアクセスキー (STS) や既存プロファイルがある場合:

```bash
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_SESSION_TOKEN=your-session-token   # 一時認証情報の場合
export AWS_DEFAULT_REGION=ap-northeast-1
# or
export AWS_PROFILE=your-profile
```

長期 (無期限) のアクセスキーは可能な限り避け、SSO か STS の一時クレデンシャルを使う。

### セキュリティ: 記録してよい情報 / いけない情報

リポジトリ (rules / docs / `infra/aws-sso.env` / コミット) に書いてよいのは **認証フローを
開始するだけの固定識別子** に限る。クレデンシャルそのものや一時的な認可アーティファクトは
書かない。

| 記録可 ✅ | 記録不可 ❌ |
|----------|-----------|
| SSO start URL / region | デバイス認証コード (`XXXX-XXXX`、即失効) |
| AWS account ID (`cdk.context.json` にも既出) | SSO アクセストークン / セッショントークン |
| 許可セット名 (`AdministratorAccess`) | 承認 URL の `clientId` / `deviceContextId` |
| プロファイル名・手順コマンド | `DEV_BYPASS_TOKEN` 等の値 (名前のみ可、値は gitignore の .env) |

理由: start URL や account ID は単体ではアクセスできず (IdP ログイン + デバイス承認が必須)、
account ID は CDK の `cdk.context.json` コミット方針で既にリポジトリに含まれる。一方、
トークン類・認証コードは短命でも秘密であり、`~/.aws/sso/cache/` の中身を含めコミットや
チャット転記をしない。

## 全プロジェクト共通の実装規約（現行 5 プロジェクトから導出）

新しい CDK プロジェクト / リソースを追加するときは以下の実装パターンに合わせる
（全 5 プロジェクトで一致している事実）:

| 項目 | 規約 |
|------|------|
| `.env` の読み込み | `bin/*.ts` が `dotenv.config()` で `.env`（symlink）を読む。環境変数が `.env` より優先 |
| STAGE の解決順 | `--context stage=...` → `process.env.STAGE` → 既定 `'stg'` |
| リソース名 suffix | `stageSuffix = stage === 'prod' ? '' : '-' + stage`（**prod は無印**、他は `-stg` 等） |
| CFN スタック名 | prod は無印、他は `-{stage}`（`MeshV2Stack` / `ClassroomStack` / `SmalrubyApiStack` / `RubyteeRelayStack` / `BugReportStack`） |
| リージョン | 既定 `ap-northeast-1` |
| CDK バージョン | `aws-cdk-lib` は全プロジェクトで**同一バージョンにピン留め**（現在 `2.275.0`）。1 つだけ上げない。lib を上げたら CLI `aws-cdk` も lib の cloud assembly schema を読める版（現在 `2.1147.0`）へそろえる（古い CLI は synth で `Cloud assembly schema version mismatch` になる） |
| タグ | スタック全体に `Project` / `Stage` / `Service` / `ManagedBy=CDK` |
| Node Lambda ランタイム | **`NODEJS_22_X` に統一**（例外: mesh-v2 の Ruby Lambda は Ruby 4.0 = `ruby4.0`）。新しい Lambda も 22 に合わせる |
| Lambda bundling | esbuild: `minify: true`, `sourceMap: stage !== 'prod'`, `externalModules: []`（全同梱） |
| CloudWatch LogGroup | 明示生成し retention = prod `ONE_MONTH` / 他 `ONE_WEEK`、`removalPolicy: DESTROY` |
| HTTP API スロットリング | stage-level のスロットリングを必ず設定（値はプロジェクトごと。WAF は使わない） |

## 横断の認証・認可規約（実装事実）

- **ID Token 認証**（classroom / bug-report）は Google / Microsoft の **`iss` 自動判別 + JWKS 検証**
  で共通（Microsoft は `login.microsoftonline.com` の JWKS、`oid` を sub に使う）。
- **`DEV_BYPASS_TOKEN` は prod に設定されていると stack が `throw` して deploy が失敗する**
  （classroom / bug-report の両方に実装済み）。ID Token 認証 + dev バイパスを持つ新プロジェクト
  でも必ずこのガードを踏襲する。
- **認可失敗のステータスコードはプロジェクト間で非対称**（歴史的事実。テスト期待値に注意）:
  bug-report は `ForbiddenError` → **403**、classroom は `AuthError` → **401**（+ 他人のリソースは
  存在秘匿の **404**、kick 済みは **410**）。
- 管理者アクションの `audit()` 構造化ログは **bug-report のみ**が持つ（classroom には無い）。
  「管理系操作は audit ログ」と一般化しないこと。

## 混雑・障害時の劣化（fail-open の方針）

授業中の可用性を優先し、**付随的な機能は混雑時・障害時に一時的に不完全な状態になってよい**（fail-open）。
本来の機能（答えを返す・課題を提出できる等）を止めないことを優先し、付随する読み書きの失敗では落とさない。

- 例（実装事実）: rubytee-relay のレート制限は DynamoDB 障害時に**許可**する。利用集計の書き込みに失敗しても
  答えは返す。classroom のメンバー一覧の `aiUsage` は `BatchGetItem` が `UnprocessedKeys` を返すと
  **再試行せずクラス全体を `null`**（表示なし）にする — 混雑時は一時的に全員分が見えなくなるのを許容する。
- 新しく付随的な読み書きを足すときも、まずこの方針（再試行やエラー応答で本体を遅らせない）で設計する。
- **例外**: 認証・認可・不正防止（他人のデータ・枠を使えないこと）は fail-open にしない。
  劣化を許すのは「表示が一時的に欠ける」「集計が一時的に漏れる」までで、悪用の余地を作る方向には倒さない。

## データ保持（RemovalPolicy）と secret の互換性

- **`RemovalPolicy.RETAIN` は次の 2 種類だけ**。RETAIN を増やすときはこの一覧も更新する。
  1. **消えると取り戻せないデータ**の表: bug-report の `BugReportAdmins`、classroom の
     `SharedAssignments`（みんなの課題。prod のみ RETAIN）、rubytee-relay の `RubyteeRelayUsage`（利用集計）。
  2. **作り直すと、AWS の外に登録した値と食い違うリソース**: web-hosting の Route 53 ホストゾーン
     `preview.smalruby.app`（stg のみ）。作り直すと NS が変わり、お名前.com に登録した委任の NS と合わなくなる。

  それ以外の運用テーブル（mesh-v2 / classroom のクラス・課題系 / `BugReports` / rate limit /
  `RubyteeJobs`）は **DESTROY** — スタック削除・リソース差し替えでデータが消える前提で扱うこと。
- **RETAIN のリソースは、スタックを消すと AWS に取り残される**。同じ CDK をもう一度出すと、
  取り残された物とは**別の新しいリソース**を作ろうとする（テーブルやバケットは同名で衝突して
  デプロイが失敗し、Route 53 のゾーンは同名を許すので**黙って 2 つ目ができる**）。RETAIN を足す PR では、
  作り直すときの手順（取り残された物を消すか `cdk import` で取り込む）を該当プロジェクトの
  `docs/` に書く。レビューでは RETAIN の追加と手順の有無を対で確かめる。
- **互換性クリティカルな secret**: `MESH_ZONE_SECRET_KEY`（smalruby-api）はローテートすると
  全ユーザーの mesh domain (CRC32) が変わる（詳細は `smalruby-api.md`）。mesh-v2 の
  `MESH_SECRET_KEY` は **未設定だと stack 既定の固定弱鍵 `'default-secret-key'` になる**
  フットガンがある（`.env.<stage>` で必ず設定する）。

## 共有コード（infra/shared）

CDK プロジェクトは互いに独立した npm パッケージなので、同じ内容のコードは **`infra/shared/` を
正本にして、各プロジェクトへコピーして持つ**（import はしない）。

| 正本 | 各プロジェクトのコピー | 中身 |
|---|---|---|
| `infra/shared/cors-origins.ts` | `lib/cors-origins.ts` | CORS 許可オリジン（`resolveCorsOrigins` / `withPreviewOrigins` / `PREVIEW_ORIGINS` / `localDevOrigins`） |
| `infra/shared/tests/cors-origins.test.ts` | `lambda/tests/cors-origins.test.ts` | 上のテスト |
| `infra/shared/tests/shared-copies.test.ts` | `lambda/tests/shared-copies.test.ts` | コピーが正本と一致するかの検査 |

配る物と配布先（classroom / bug-report / admin / api / rubytee-relay）は **`infra/shared/manifest.json`
が唯一の真実**。

- **直すときは正本だけを直し、`node infra/shared/sync.js` でコピーを配る**。コピーを直接直さない。
  `node infra/shared/sync.js --check` はずれを一覧して exit 1 にする（書き込まない）。
- ずれは各プロジェクトの `npm test`（`shared-copies.test.ts`）が落とす。CI はプロジェクトごとに
  `npm test` を走らせるので、`ci-infra.yml` に検査ジョブを足す必要はない。
- **import にしない理由**: ① `Deploy Infra` は差分に `infra/<project>/` が現れたプロジェクトだけを
  デプロイするので、`infra/shared/` だけを直すとどのプロジェクトにも出ない（コピーなら、直した
  コピーのあるプロジェクトがデプロイ対象になる） ② 各プロジェクトの `tsconfig.json` は
  `rootDir: "./"` で、プロジェクトの外のファイルを `tsc`（`npm run build`）が受け付けない。
- 共有コードは **CDK 側（`lib/`）だけ**で、Node 標準以外の依存を持たない物にする（各プロジェクトの
  `node_modules` の版の違いに左右されないため）。Lambda の bundling（esbuild）が読むコードを共有する
  ときは、esbuild の解決も確かめてから足す。
- 新しい共有コードを足すときは、正本・`manifest.json`・この表を同じ PR で更新する。新しいプロジェクトが
  使うときは `manifest.json` の `projects` に足して `sync.js` を実行する。

## 新しい CDK プロジェクトを足すときのチェックリスト

`infra/<project>/` を新しく作る PR では、次をすべて同じ PR で（人間の作業は PR 本文と Issue に
明記して）そろえる。漏れると CI が新しいプロジェクトを検査しない・自動デプロイが失敗する。
レビューでもこの一覧で確かめる。

1. **CI**: `.github/workflows/ci-infra.yml` に `[<project>] Unit Tests` / `CDK Build & Synth` /
   `Security Audit` の 3 ジョブを足す（既存プロジェクトのジョブを写す）。このワークフローは
   プロジェクトを自動検出しないので、足さないとテストも synth も CI で走らない。stage で作るものが
   違うなら、`cdk synth` を各 stage で行う。`.github/workflows/` は Bot 権限外なので、push は
   `bin/autopilot-push`（個人トークン経路）になり、PR に `👥 human-review-required` が付く。
2. **デプロイ用 Secrets（人間・マージ前）**: `Deploy Infra` は差分のあったプロジェクトを自動で拾うが、
   `.env` は Secrets から作る。repo Secrets に `INFRA_STG_DOTENV_<PROJECT>`、Environment `prod` に
   `INFRA_PROD_DOTENV_<PROJECT>` が無いと、マージ後のデプロイがそのプロジェクトだけ失敗する
   （`<PROJECT>` はハイフンを `_` にした大文字）。一覧は `docs/infra-deploy/README.md`。
3. **prod で何も作らないプロジェクト**: prod のテンプレートが `AWS::CDK::Metadata` だけでも、
   初回の `cdk diff` はスタックが無いので `BootstrapVersion` パラメータの追加を差分として出す
   （`AWS::CDK::Metadata` は diff から除かれるが、パラメータは除かれない）。そのため初回の自動デプロイは
   **空のスタックを作り**、2 回目からは「差分なし」で何もしない。削除・置き換えは含まないので
   自動デプロイは止まらない。`AWS::CDK::Metadata` まで消すと（`versionReporting: false` など）
   リソースが 0 個になり、CloudFormation がスタック作成を拒むので消さない。
4. **rules と docs**: この表（Projects）とプロジェクト用の `.claude/rules/infra/<project>.md`、
   `docs/infra/<project>.md` と `docs/infra/README.md` の一覧、`docs/infra-deploy/README.md` の Secrets 表。
5. **`aws-cdk-lib` のバージョン**は既存プロジェクトと同じにピン留めする（上の共通規約）。
6. **CORS を持つ API なら共有コードを使う**: `infra/shared/manifest.json` の `projects` に足して
   `node infra/shared/sync.js` を実行し、`lib/cors-origins.ts` を使う（上の「共有コード」）。

## Stage Switching via `.env` Symlink

All 5 projects use the same pattern: per-stage `.env` files (`.env.stg`, `.env.prod`) with a `.env` symlink pointing to the active stage.

```bash
cd infra/<project-name>

# Switch to staging
rm .env && ln -s .env.stg .env

# Switch to production
rm .env && ln -s .env.prod .env

# Verify current stage
ls -la .env
```

The `STAGE` value in the linked `.env` file determines the deployment target. It can also be overridden with `--context stage=...`.

**CRITICAL**: Always use `.env` symlink switching for deployments. Never override environment variables (e.g., `APPSYNC_CUSTOM_DOMAIN=false`) directly on the command line — this can delete custom domains or other critical resources from the stack.

## Post-Deploy Verification

以下は **AppSync（mesh-v2）向け**の確認。HTTP API プロジェクト（classroom / rubytee-relay /
smalruby-api / bug-report）はそれぞれのカスタムドメイン URL への `curl`（+ integration テスト）
で確認する（各プロジェクトのルール参照）。

After deploying to `stg` or `prod`, verify that custom domains are intact:

```bash
# Check all AppSync custom domains
aws appsync list-domain-names --query "domainNameConfigs[].domainName" --output table

# Expected domains:
#   graphql.api.smalruby.app        (prod)
#   stg.graphql.api.smalruby.app    (stg)

# Verify DNS resolution
dig stg.graphql.api.smalruby.app A +short
dig graphql.api.smalruby.app A +short
```

If a custom domain is missing, redeploy the affected stage with the correct `.env` symlink.

## CDK 化 / 旧スタック → CDK 移行のチェックリスト (汎用)

`smalruby-infra` (旧 SAM) → `infra/smalruby-api/` (CDK) のような移行を行う際の
共通チェックポイント。詳細な実例は `.claude/rules/infra/smalruby-api.md` の
「ハマりポイント / 学び」を参照。

### 事前

1. **Lambda 関数名の衝突回避**: 旧スタックと新スタックを並走させる前提で、
   CDK 側の関数名にプロジェクト固有のプレフィックス (`smalruby-<project>-`) を
   付ける。同名にすると CFN が `already exists` で deploy 失敗する。
2. **既存カスタムドメインは作り直さず import**: `apigatewayv2.DomainName.fromDomainNameAttributes()`
   などで参照。ACM 証明書や Route53 レコードを再利用してダウンタイムを
   数分に圧縮する。
3. **既存 secret/config 値の引き継ぎ**: ハードコードされていた値があれば
   prod 環境変数で **同じ値を再使用** する。CRC32 キーのような互換性
   クリティカルな値は変えると既存ユーザーが壊れる。

### カットオーバー手順

1. stg を CDK で先に立てて `npm run test:integration` を pass させる
2. 旧スタックの **base path mapping だけ** 解除 (custom domain は残す):
   `aws apigateway delete-base-path-mapping --domain-name <FQDN> --base-path '(none)'`
3. 即座に `cdk deploy --context stage=prod`
4. curl + Playwright で全エンドポイント検証 (CORS preflight、status passthrough、
   バイナリレスポンス等)
5. 旧 CFN スタック削除 (`aws cloudformation delete-stack --stack-name ...`)

### Integration test の Origin

両環境 (stg / prod) で実行する integration test の CORS preflight は、
両方で許可される Origin (`https://smalruby.app` など) を使う。`localhost` は
prod の CORS 許可リストに入れていないので、テストで期待値にすると prod 実行で
fail する。

### 検証ハマり

- `cdk deploy` 直後の API Gateway は数十秒〜数分のルーティング反映待ちがある。
  curl が一時的に 403 (`Forbidden`) を返したら polling で待つ。
- ブラウザの `response.headers.get('access-control-allow-origin')` は Fetch
  spec の制約で `null` に見える。fetch 自体が成功している事実が CORS preflight
  成功の証拠。生のヘッダー値を見たいときは `curl -i -X OPTIONS` で確認する。
