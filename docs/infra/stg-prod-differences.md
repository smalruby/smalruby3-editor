# stg と prod の違い

> **🆕 Smalruby 独自** — Smalruby のバックエンド（`infra/` の CDK プロジェクト）と GUI ビルドの、stg と prod の違いの一覧

ブランチプレビューは stg の API を見る（本番のデータをテストに使わないため、また `?devlogin=<DEV_BYPASS_TOKEN>` でログインを省いて自動テストできるようにするため）。目標は **「stg と prod は設定値以外まったく同じ」**。この文書は、その目標から見て今の違いがどこにあるかをまとめ、**意図した違い（設定値）** と **直すべき違い** を分ける。

## 調べ方と前提

- 対象: `infra/` の 6 プロジェクト（smalruby-mesh-v2 / smalruby-rubytee-relay / smalruby-classroom / smalruby-api / smalruby-bug-report / smalruby-admin）と、GUI のビルド（`.github/workflows/ci-cd.yml` の `build-and-deploy`、`packages/scratch-gui/webpack.config.js`）。
- `.env.*` は gitignore されているので、main checkout にある `infra/<project>/.env.stg` と `.env.prod`（mesh-v2 は `.env.production`）を比べた。**キーの有無**と、秘密の値は**同じ値かどうか**だけを比べた（値そのものはここに書かない）。
- `Deploy Infra` が使う repo Secrets（`INFRA_STG_DOTENV_*` / Environment `prod` の `INFRA_PROD_DOTENV_*`）の中身は読めないので、ローカルの `.env.*` と同じ内容だと仮定している。
- 秘密の値（トークン・キー・クライアント ID の実値）は書かない。公開されているホスト名は書く。

## まとめ

- **インフラの違いの大半は意図した違い**。stage ごとのリソース名（prod は接尾辞なし）、カスタムドメイン（`stg.` 付き）、ログの保持期間、スロットリング、データ保持（RETAIN / PITR）、`DEV_BYPASS_TOKEN`（stg だけ）、admin の JWT authorizer（prod だけ）。
- **プレビューを stg に向けるために足りないもの**:
  1. stg の API の CORS に `https://preview.smalruby.app` が無い。
  2. GitHub に **stg 向けの GUI ビルド値が 1 つも無い**。Environment `stg` は作られているが空で、repo Secrets / Variables はすべて prod 向けになっている。stg の値はローカルのルート `.env` にしか無い（下の「GUI のビルド値」を参照）。
  3. 翻訳・音声合成の拡張は CORS プロキシの URL を `https://api.smalruby.app/cors-proxy`（prod）に**ハードコード**している。prod の CORS は preview を許可しないので、このままではプレビューで翻訳・音声合成が動かない。
- **値が stg と prod で同じもの**: Google / Microsoft の OAuth クライアント ID と、admin 用の Google クライアント ID。どれも stg 専用のクライアントは無く、**本番と同じクライアント**を使っている。これは**意図した共用**で、分けない（下の「OAuth クライアントを共用にする理由」）。プレビューのオリジンは本番のクライアントに登録する。
- **stg の設定値のせいで、プレビューでの確認が本番どおりにならないもの**: クラスの寿命（stg は 1 日）、メッシュの最大接続時間（stg は 5 分）など。テスト用に短くしてある値なので、プレビューで長く触る確認には向かない（「stg で本番どおりに動かないもの」を参照）。

## `.env` のキーの違い

| プロジェクト | stg だけにあるキー | prod だけにあるキー | 意図 |
|---|---|---|---|
| smalruby-admin | `DEV_BYPASS_TOKEN` | — | 意図どおり（prod に置くと stack が throw） |
| smalruby-api | — | `IMPORT_EXISTING_CUSTOM_DOMAIN` / `IMPORTED_REGIONAL_DOMAIN_NAME` / `IMPORTED_REGIONAL_HOSTED_ZONE_ID` | 意図どおり（prod の `api.smalruby.app` は CDK の外で作ったものを import している） |
| smalruby-bug-report | `DEV_BYPASS_TOKEN` / `BUG_REPORT_API_ENDPOINT` | — | 意図どおり（後者は integration テスト用） |
| smalruby-classroom | `DEV_BYPASS_TOKEN` / `CLASSROOM_API_ENDPOINT` | — | 意図どおり（後者は integration テスト用） |
| smalruby-mesh-v2 | — | — | キーは同じ。ファイル名だけ `.env.production`（他は `.env.prod`） |
| smalruby-rubytee-relay | — | — | キーは同じ |

ほかに、mesh-v2 と rubytee-relay には `.env.stg2`（追加の検証用ステージ）がある。

`.env.example` にあって stg / prod のどちらにも無いキー（＝コードの既定値で動いているもの）:

- smalruby-admin: `CORS_ALLOWED_ORIGINS` / `ROUTE53_PARENT_ZONE_NAME` / `ADMIN_CUSTOM_DOMAIN`
- smalruby-classroom: `REPORT_DAILY_LIMIT` / `SHARE_DAILY_LIMIT`

## 設定値の違い（意図した違い）

| プロジェクト | キー | stg | prod |
|---|---|---|---|
| 全部 | `STAGE` | `stg` | `prod` |
| smalruby-api / bug-report / classroom / rubytee-relay | `CORS_ALLOWED_ORIGINS` | `https://smalruby.app`, `https://smalruby.jp`, `http://localhost:8601`（bug-report は `:8602` も） | `https://smalruby.app`, `https://smalruby.jp` |
| smalruby-admin | `CORS_ALLOWED_ORIGINS`（未設定 → コードの既定） | `https://smalruby.app` + localhost | `https://smalruby.app` |
| smalruby-bug-report | `RESOLVED_TTL_DAYS` | 1 | 30 |
| smalruby-classroom | `CLASSROOM_TTL_DAYS` | 1 | 90 |
| smalruby-classroom | `MAX_STUDENT_COUNT` | 50 | 100 |
| smalruby-classroom | `SESSION_ACTIVE_TTL_SECONDS` | 300 | 3600 |
| smalruby-classroom | `PRESIGNED_URL_UPLOAD_EXPIRY` / `DOWNLOAD_EXPIRY` | 300 / 600 | 900 / 300 |
| smalruby-classroom | `JOIN_RATE_LIMIT_WINDOW_SECONDS` / `MAX_ATTEMPTS` | 30 / 100 | 60 / 50 |
| smalruby-classroom | `ARCHIVE_RETENTION_DAYS` | 30 | 365 |
| smalruby-mesh-v2 | `APPSYNC_CUSTOM_DOMAIN` | `stg.graphql.api.smalruby.app` | `graphql.api.smalruby.app` |
| smalruby-mesh-v2 | ホストの heartbeat 間隔 / TTL（秒） | 15 / 60 | 60 / 150 |
| smalruby-mesh-v2 | メンバーの heartbeat 間隔 / TTL（秒） | 15 / 60 | 120 / 600 |
| smalruby-mesh-v2 | `MESH_MAX_CONNECTION_TIME_SECONDS` | 300 | 2100 |
| smalruby-mesh-v2 | `MESH_EVENT_TTL_SECONDS` / `MESH_POLLING_INTERVAL_SECONDS` | 5 / 1 | 10 / 2 |
| smalruby-rubytee-relay | レート制限・入力長 | 35 分 40 回・10〜250 文字 | 同じ |

秘密の値の同一性:

| 値 | stg と prod |
|---|---|
| `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID`（classroom・bug-report） | **同じ**（stg 専用のクライアントは無い） |
| `ADMIN_GOOGLE_CLIENT_ID`（admin・bug-report） | **同じ** |
| `MESH_SECRET_KEY`（mesh-v2）/ `MESH_ZONE_SECRET_KEY`（api） | 別（stg は stg 専用の値） |
| `ANTHROPIC_API_KEY`（rubytee-relay） | 別 |
| `ANTHROPIC_API_KEY`（classroom） | **同じ**で、しかも **rubytee-relay の stg と同じ値**（下の「直すべき違い」を参照） |

## コードの中の stage の分岐

全プロジェクト共通（`.claude/rules/infra/development.md` の規約どおり）:

- リソース名・スタック名: prod は接尾辞なし、それ以外は `-<stage>`
- カスタムドメイン: prod は `<service>.api.smalruby.app`、それ以外は `<stage>.<service>.api.smalruby.app`（smalruby-api は `stg.api.smalruby.app`）
- Lambda の source map: prod では出さない
- CloudWatch Logs の保持期間: prod 1 か月 / それ以外 1 週間（admin の prod だけ 1 年。監査記録のため）

プロジェクトごとの分岐:

| プロジェクト | 分岐 | 理由 |
|---|---|---|
| classroom / bug-report / admin | `DEV_BYPASS_TOKEN` は stage が prod でないときだけ受け付ける。prod の `.env` にあると stack が throw | 自動テスト用のログイン省略を本番で使えないようにする |
| classroom / bug-report / admin | prod の CORS に localhost が入っていると stack が throw（`lib/cors-origins.ts`） | 開発中に緩めた CORS の戻し忘れを防ぐ |
| classroom | `SharedAssignments` は prod だけ RETAIN + PITR | 消えると取り戻せないデータなので |
| classroom / bug-report | S3 の `autoDeleteObjects` は prod でないときだけ | stg はスタックごと消せるようにする |
| classroom / api | HTTP API のスロットリング: prod 200/200、stg 50/50 | — |
| classroom | ルート単位のスロットリング: prod 10/20、stg 5/10 | — |
| rubytee-relay | スロットリング: prod 10/30、stg 5/10。`GET /jobs` は prod 40/80、stg 10/20 | — |
| rubytee-relay | takeover worker の同時実行の上限: prod 50、stg 10 | 費用の上限 |
| rubytee-relay | 応答ログの `sourceIp` は prod では残さない | 個人に結び付く情報を本番で残さない |
| admin | JWT authorizer は prod だけ。prod は `ADMIN_GOOGLE_CLIENT_ID` が無いと throw | stg は dev バイパス（JWT ではない）で E2E を回すため |
| mesh-v2 | X-Ray は prod でないときだけ | 費用 |
| mesh-v2 | `MESH_MAX_CONNECTION_TIME_SECONDS` の既定値: prod 1500、stg 300（どちらも `.env` で上書きしている） | — |

## CDK の外で作ったもの

| もの | stage | 備考 |
|---|---|---|
| Route 53 のゾーン `api.smalruby.app` と、お名前.com からの NS 委任 | 共通 | 各スタックは `fromLookup` で参照するだけ |
| `api.smalruby.app` の API Gateway カスタムドメイン・ACM 証明書・A レコード | prod だけ | 旧 SAM 時代に作ったものを import している。stg の `stg.api.smalruby.app` は CDK が作る |
| GitHub Actions の OIDC デプロイ用 IAM ロール | stg 用（repo Variables の `AWS_DEPLOY_ROLE_ARN`）と prod 用（Environment `prod` の Variables） | `docs/infra-deploy/README.md` |
| 管理者の登録（bug-report の `BugReportAdmins`、admin の `SmalrubyAdmins`） | 両方 | 手で登録する。stg には自動テスト用の `dev-admin@example.com` がある |
| Google / Microsoft の OAuth クライアント | 共通（1 つずつ） | stg 専用は作らない（意図した共用） |
| smalruby.app の配信（外部リポジトリ `smalruby/smalruby.app` + デプロイキー） | prod だけ | GUI の本番配信 |

## stg で本番どおりに動かないもの

プレビューを stg に向けたあと、プレビューで確かめにくくなるもの。どれもテスト用に短くした設定値によるもので、プレビューの用途（変更の確認）では困らない。

- **クラスの寿命が 1 日**（`CLASSROOM_TTL_DAYS=1`）。前日にプレビューで作ったクラスは翌日には消える。
- **メッシュの最大接続時間が 5 分**（`MESH_MAX_CONNECTION_TIME_SECONDS=300`）。授業の長さの通しの確認はできない。
- **授業中を想定した負荷**（生徒数の上限 50・スロットリングが低い）は再現しない。
- **admin の JWT authorizer** は stg に無い（意図した違い）。
- **データは消えうる**。stg のテーブルは `SharedAssignments` も含めて DESTROY で、PITR も無い。

## GUI のビルド値

GUI のビルド（webpack の `DefinePlugin`）が使う環境変数と、それぞれの stg の値が今どこにあるか。プレビュー用のビルドが stg を向くには、右端の列の値を GitHub に用意する必要がある（Environment `stg` に置くのがよい。今は作られているが空）。

| 変数 | 今の GitHub での置き場所（prod の値） | stg の値 | 置き場所 |
|---|---|---|---|
| `MESH_GRAPHQL_ENDPOINT` | repo Secret | `stg.graphql.api.smalruby.app` | ローカルのルート `.env` だけ |
| `MESH_API_KEY` | repo Secret | stg の AppSync の API キー | ローカルのルート `.env` だけ |
| `MESH_AWS_REGION` | repo Secret | 同じ（`ap-northeast-1`） | — |
| `RUBYTEE_RELAY_ENDPOINT` | repo Secret | `stg.rubytee.api.smalruby.app` | ローカルのルート `.env` だけ |
| `CLASSROOM_API_ENDPOINT` | repo Secret | `stg.classroom.api.smalruby.app` | ローカルのルート `.env` だけ |
| `BUG_REPORT_API_ENDPOINT` | repo Secret | `stg.bug-report.api.smalruby.app` | ローカルのルート `.env` だけ |
| `SCRATCH_API_PROXY_ENDPOINT` | repo Variable | `https://stg.api.smalruby.app` | **どこにも無い**（ローカルも既定値の prod を使っている） |
| `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` | repo Secret | prod と同じ値 | そのまま使える |
| `GOOGLE_API_KEY` | repo Secret | stg 専用は無い | そのまま使える |
| `MAX_USER_MESSAGE_LENGTH` / `MIN_USER_MESSAGE_LENGTH` | repo Variable | prod と同じ値（250 / 10） | そのまま使える |
| `MESH_*_INTERVAL_MS` | repo Variable | stage の区別なし（クライアントの調整値） | そのまま使える |
| `GTM_ID` / `GTM_ENV_AUTH` | repo Secret（`GTM_ENV_AUTH` は未登録） | プレビューでは使わない | — |
| `ADMIN_API_ENDPOINT` / `ADMIN_GOOGLE_CLIENT_ID` | repo Variable | 管理 SPA 用。エディタのプレビューでは使わない | — |

補足:

- `DEV_BYPASS_TOKEN` は GUI のビルドには埋め込まない。プレビューでは URL の `?devlogin=<DEV_BYPASS_TOKEN>` で渡す。
- repo Secret の `GEMINI_RELAY_ENDPOINT` はどのビルドからも参照されていない（ルビティーを Claude に移したときの残り）。
- **ビルド値では切り替えられない URL**: 翻訳（`scratch3_translate`）と音声合成（`scratch3_text2speech`）は `https://api.smalruby.app/cors-proxy` を直接書いている。プレビューから stg に向けるには、`SCRATCH_API_PROXY_ENDPOINT` のようなビルド値から組み立てる変更が要る。

## 直すべき違い（候補）

| 候補 | 内容 | 優先度 |
|---|---|---|
| stg の CORS に preview を足す | 対象は smalruby-api / bug-report / classroom / rubytee-relay。admin は今の既定値のままでよい（エディタのプレビューは admin API を呼ばない）。mesh-v2 は AppSync なので CORS の設定が無い | プレビュー移行の前提 |
| stg 向けの GUI ビルド値を GitHub に用意する | 上の表の「ローカルのルート `.env` だけ」「どこにも無い」の値を Environment `stg` に登録する（人間の作業） | プレビュー移行の前提 |
| CORS プロキシのハードコードをやめる | 翻訳・音声合成の拡張の `CORS_PROXY_HOST` をビルド値から組み立てる（scratch-vm の変更） | プレビュー移行の前提（無いとプレビューでこの 2 つが動かない） |
| classroom の `ANTHROPIC_API_KEY` | prod のクラス管理が、rubytee-relay の stg と同じ API キーを使っている。キーを分けて費用や上限を区別しているなら、prod 用のキーに直す必要がある | 要確認（意図した共用なら不要） |
| mesh-v2 の `.env.production` | 他のプロジェクトは `.env.prod`。`Deploy Infra` は CI の中で `.env.prod` を作るので動作には関係ないが、手元の手順と docs が二通りになっている | 低 |

## OAuth クライアントを共用にする理由

Google / Microsoft の OAuth クライアントと、admin 用の Google クライアントは、stg と prod で**同じものを使い、分けない**。
「stg と prod は設定値以外まったく同じ」の例外として、ここに理由を残す。

- **分けると手間が倍になる**: stg 専用のクライアントを作ると、同意画面・承認済みのオリジン・リダイレクト URI・
  ドメインの確認を 2 組そろえ続けることになる。片方だけ直し忘れると、stg と prod でログインの挙動がずれる。
- **共用の危険は小さい**: 増えるのは、本番のクライアントに登録するプレビューのオリジン
  （`https://preview.smalruby.app` と、Microsoft のリダイレクト URI `https://preview.smalruby.app/auth-redirect.html`）だけ。
  どちらも自分たちのドメインで、ほかの人がそこにページを置くことはできない。
- **ログインしたあとのデータは stg と prod で分かれている**: クライアントが同じでも、ID トークンを受け取って検証するのは
  それぞれの stage の API で、データ（クラス・課題など）は stage ごとのテーブルにある。プレビューでログインしても、
  本番のデータには触れない。

分けるのは、たとえば「stg だけ同意画面のスコープを変えて試したい」ような、stage ごとにクライアントの設定を変える
必要が出たときにする。
