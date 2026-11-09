# Rubytee（ルビティー）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能
> Anthropic Claude API を使った AI コード生成支援機能。upstream の Scratch には AI 機能なし。

## 概要

Rubytee（ルビティー）は **Anthropic Claude API** を使って、生徒の作品を書き直す機能。
コードタブの「生成AI に相談」（[`docs/genai-consult/`](../genai-consult/)）で、生成AI の答えが 2 回ブロックに
できなかったときに出る **［ルビティーにまかせる］** から使う（下の「ルビティーにまかせる」）。

Ruby タブ（Ruby・ふりがなモード）にもルビティーのボタンやチャットは無い。Ruby タブでの AI への相談も「生成AI に相談」の
パネルで行い、コードタブと同じく答えが 2 回コードにできなかったときに［ルビティーにまかせる］が出る
（今のスプライトだけを直してもらう。日本語 (DNCL) モードでは出さない）。

API キーをクライアントに直接持たせず、AWS Lambda の専用リレー（`infra/smalruby-rubytee-relay`）を経由することで、API キー管理・レート制限・入力検証・年齢適合チェックを集約している。

> **命名**: ルビティー = Ruby + ティー(Teacher)、また "Ruby Tea" 🍵 のニュアンス。前身の **スモウルビー先生** は Gemini API を使っていたが、Anthropic に移行する際にリブランディングした (Issue #346)。

## ユーザーストーリー

- **Ruby を書き始めた小学生**として、生成AI の答えがうまくブロックにならなかったとき、ルビティーに作品を直してもらって続けたい
- **教師**として、クラスで生成AI を使うときに、つまずいた生徒の助けになる手段を用意したい
- **保護者**として、子どもが AI を使うのは、先生が条件を確かめて有効にしたクラスの中だけにしてほしい

## 安全・コンプライアンス（重要）

このプロダクトは **未成年者向け** であり、Anthropic の利用規約に明示的に準拠する形で設計されている：

- **クラスで先生が有効にしたときだけ**: ルビティーは、クラス管理で先生がオンにしたクラスの生徒だけが使える。条件の確認は先生が有効にするときに行い（AI の答えがまちがうことがある・個人情報を入れないよう指導する・18 歳未満は保護者の許可・利用規約とプライバシーポリシー。必須のチェックで `rubytee.confirmed` を保存する）、生徒の画面では同意を取り直さない（生徒向けの同意ダイアログは廃止した）
- **AI 生成物であることの明示**: 出力に AI 生成のラベル
- **COPPA 対応**: 法的文書（プライバシーポリシー）でも明示
- **API キー秘匿**: クライアントは API キーを持たず、Lambda リレー経由
- **レート制限**: IP ベースで `35 分あたり 40 リクエスト`（DynamoDB の TTL で実装）
- **入力長制限**: takeover は `userMessage` 1 万字・リクエスト全体 200KB など（下の「上限」）

> **背景**: Gemini/Vertex AI ToS は 18 歳未満ユーザー向けアプリでの利用を禁止していたため、Anthropic へ移行した。Anthropic は安全措置を取れば未成年向け製品での利用を明示的に許可している。

## 使える条件（クラスの設定で有効にしたときだけ）

ルビティーは、**参加しているクラスで先生がルビティーを有効にしたときだけ** 使える。先生はクラス設定の「このクラスで使う AI」欄で「ルビティー」をオンにし、開いた条件を確かめて必須のチェックを入れて保存する（[`docs/classroom/ui-ux.md`](../classroom/ui-ux.md)）。確認の仕組みより前に有効にしたクラス（`confirmed` が無い）も有効のまま使え、次に設定を保存するときにチェックを求める。

| 状態 | コードタブ・Ruby タブ（Ruby・ふりがなモード）の［ルビティーにまかせる］ (`genai-takeover`) |
|---|---|
| クラスに参加していない | **出さない** |
| 参加しているクラスでルビティーが無効 | **出さない** |
| 参加しているクラスでルビティーが有効 | 出す（生成AI の答えが 2 回ブロックにできなかったとき） |
| 先生（クラスを開いている先生・ログイン中の先生） | **出さない** |

- **出さない（押せない理由を出さない）理由**: 生徒の画面にはクラス外・無効のときに使えない機能を見せる必要がなく、押しても使えないボタンは「壊れている」と誤解されやすい。使う・使わないは先生がクラスで決めるもので、生徒が自分で有効にする手段も無い。
- **先生に出さない理由**: ルビティーのリクエストは席ごとに数える（下記）が、先生には出席番号が無い。生徒に見える画面を確かめたいときは、先生も参加コードで生徒として参加する。
- 判定は redux の `scratchGui.classroom`（`role === 'student'` + セッションあり + `rubyteeEnabled`）の `selectRubyteeAvailable`。`rubyteeEnabled` は参加（`/classrooms/join`）とセッション検証（`/classrooms/verify-session`）の応答の `rubytee.enabled` から取り込み、生徒のセッションと一緒に localStorage（`smalruby:classroom`）に保存する。セッション検証はページを開いたとき（`src/containers/use-student-class-settings-refresh.js`）とクラスの画面を開いたときに行うので、先生が設定を変えると、生徒がページを再読み込みするかクラスの画面を開いたときに追従する。

## ルビティーにまかせる

コードタブの「生成AI に相談」（`docs/genai-consult/`）で、生成AI の答えが 2 回ブロックにできなかったとき、
ルビティーが有効なクラスの生徒には［ルビティーにまかせる］が出る。操作の流れと画面は
[`docs/genai-consult/`](../genai-consult/) の「ルビティーにまかせる」を参照。

［ルビティーにまかせる］を押すと、同意画面を出さずにすぐ始まる（先生がクラスで有効にしたことが条件の確認になる）。

Ruby タブ（Ruby・ふりがなモード）でも同じ条件で出す。違うのはルビティーに渡す文だけで、今のスプライトだけを
直すこと・エディタにいま出ている Ruby・参考のほかのスプライトを渡し、ふりがなモードでは説明をやさしくしてもらう
（`buildRubyTabTakeoverMessage`。詳細は [`docs/genai-consult/`](../genai-consult/) の「Ruby タブ」）。
relay は同じ `purpose: "genai-takeover"` のまま（relay のシステムプロンプトの「変えるスプライトだけを
`# 「名前」` から書く」という答えの形にそのまま合う）。日本語 (DNCL) モードでは出さない。

呼び方:

- relay の `POST /generate` に `purpose: "genai-takeover"` を付けて呼ぶ（モデルは Sonnet・非同期ジョブ。
  `202 { jobId }` → `GET /jobs/{jobId}` を 3 秒から 10 秒まで間隔を伸ばしながら問い合わせる）。
- 席の確認は生徒の **`sessionToken`** で行う（クラスに参加していなければ送らない）。`classroom` / `seat`・
  メールアドレス・名前は送らない。
- 送るもの: 困りごと・作品全体の Ruby・生成AI に渡した質問文と貼りもどした答え・ブロックにできなかった理由
  （`userMessage` は 1 万字まで。古い相談から短くする）。`stateContext` は今のスプライトとステージの
  コスチューム・音の名前だけ（作品は `userMessage` に入っている）。
- 答えはブラウザでスモウルビーの変換に通し、ブロックにできたものだけを見せる。ブロックそのものは AI に作らせない。

## 主要ファイル

### scratch-gui

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/genai-concierge.jsx` | 「生成AI に相談」のパネル（［ルビティーにまかせる］はパネルの答えのステップ `genai-answer-steps.jsx`） |
| `packages/scratch-gui/src/lib/genai-takeover.js` | ルビティーに送る文の組み立て（コードタブ: 作品全体 / Ruby タブ: 今のスプライトだけ）・作り直しのくり返し・relay の呼び出し（ジョブの問い合わせ） |
| `packages/scratch-gui/src/reducers/classroom.js` | `rubyteeEnabled`・`selectRubyteeAvailable`（使えるか） |

### infra/smalruby-rubytee-relay

AWS Lambda リレーサービス（API Gateway HTTP API + Lambda + DynamoDB）：

| ファイル | 役割 |
|---|---|
| `infra/smalruby-rubytee-relay/lambda/handler.ts` | API Lambda。リクエスト検証、レート制限、takeover のジョブ作成と `GET /jobs/{jobId}`。Claude は呼ばない。`purpose` が `genai-takeover` でない `POST /generate`（Ruby タブの旧チャット）は 410 `CHAT_DISCONTINUED` で断る |
| `infra/smalruby-rubytee-relay/lambda/takeover.ts` | 「ルビティーにまかせる」の上限・システムプロンプト・キー・ジョブの形（純粋関数） |
| `infra/smalruby-rubytee-relay/lambda/takeover-worker.ts` | takeover の worker Lambda。非同期で呼ばれ、Claude（Sonnet）を呼んで結果を jobs 表に書く |
| `infra/smalruby-rubytee-relay/lambda/anthropic-client.ts` | worker が使う Claude の client（Anthropic SDK）。WIF の値がそろえば短期トークン、無ければ API キー。SDK のエラーを今のエラーコードに対応させる（classroom にも同じ内容のコピーがある） |
| `infra/smalruby-rubytee-relay/lambda/smalruby-reference.ts` | スモウルビーの言語仕様（takeover のプロンプトで使う） |
| `infra/smalruby-rubytee-relay/lib/rubytee-relay-stack.ts` | CDK スタック定義 |
| `infra/smalruby-rubytee-relay/lambda/tests/` | 単体テスト |

#### Lambda の主要ロジック

- `purpose` が `genai-takeover` でなければ、ほかの処理より先に 410 `CHAT_DISCONTINUED` を返す（Claude の費用も DynamoDB の書き込みも発生させない）
- 入力検証（メッセージ長、フィールド長、履歴ターン数の上限。takeover の上限）
- 席・IP ごとのレート制限（DynamoDB の TTL 機能で window 管理）
- ジョブを作って worker を非同期で起動し、`202` を返す。Claude を呼ぶのは worker だけ（system の `cache_control` で prompt caching）
- CORS 検証（`CORS_ALLOWED_ORIGINS` 環境変数）
- エラー時は `429 RATE_LIMIT_EXCEEDED` などの構造化エラー

### scratch-vm

なし（GUI 側で完結）。

## 設定・データ永続化

### クライアント側（webpack で `process.env` に注入、`.env` から読込）

| 環境変数 | 用途 |
|---|---|
| `RUBYTEE_RELAY_ENDPOINT` | Lambda リレーのエンドポイント URL |

ローカル開発では stg エンドポイントを使う（prod は CORS で localhost を許可しない）。

### Lambda 側（CDK で渡す）

| 環境変数 | デフォルト | 用途 |
|---|---|---|
| `ANTHROPIC_API_KEY` | - | Anthropic API キー。**worker だけ**。下の WIF の値がそろっていないときに使う |
| `ANTHROPIC_FEDERATION_RULE_ID` / `ANTHROPIC_ORGANIZATION_ID` / `ANTHROPIC_SERVICE_ACCOUNT_ID` / `ANTHROPIC_WORKSPACE_ID` | 空 | **worker（ルビティーにまかせる）だけ**。Claude を Workload Identity Federation（WIF）で呼ぶ値。workspace 以外の 3 つがそろうと、worker の実行ロールの JWT（AWS STS `GetWebIdentityToken`）を短期トークンに交換して使い、`ANTHROPIC_API_KEY` は読まない。一部だけならキーのまま。交換に失敗してもキーには戻らない（`AI_API_ERROR`）。旧チャット（`handler.ts`）はキーのまま |
| `CLAUDE_TAKEOVER_MODEL` | `claude-sonnet-5-5` | 「ルビティーにまかせる」のモデル（worker だけ） |
| `RATE_LIMIT_WINDOW_MINUTES` | `35` | レート制限ウィンドウ |
| `RATE_LIMIT_MAX_REQUESTS` | `40` | ウィンドウ内最大リクエスト |
| `MIN_USER_MESSAGE_LENGTH` | `10` | ユーザーメッセージ最小文字数 |
| `CORS_ALLOWED_ORIGINS` | `https://smalruby.app` | CORS 許可オリジン |
| `RATE_LIMIT_TABLE_NAME` | - | DynamoDB テーブル名（CDK で設定）|
| `JOBS_TABLE_NAME` / `USAGE_TABLE_NAME` / `TAKEOVER_WORKER_FUNCTION_NAME` | - | takeover の jobs 表・集計表・worker 名（CDK で設定） |
| `CLASSROOM_MEMBERSHIPS_TABLE_NAME` | - | 席を確かめるクラス管理の memberships 表名（CDK が `ClassroomMemberships{suffix}` を設定。GSI `sessionToken-index` の `Query` だけを許可） |
| `TAKEOVER_SEAT_MAX_REQUESTS` | `40` | takeover の 1 席（`sessionToken` で確かめた classroom + 出席番号）あたりの上限 / 窓 |
| `TAKEOVER_IP_MAX_REQUESTS` | `1600` | takeover に重ねる IP 単位の上限 / 窓（40 人 × 40 回） |
| `TAKEOVER_WORKER_RESERVED_CONCURRENCY` | prod `50` / 他 `10` | worker の同時実行数の上限（CDK のみ。費用が青天井にならないように） |

固定の上限値:
- `MAX_FIELD_NAME_LENGTH = 100`（スプライト/コスチューム/サウンド名）
- `MAX_HISTORY_TURNS = 20`（会話履歴）
- takeover だけの上限は下の「ルビティーにまかせる（takeover）の呼び方」を参照

### localStorage

- `smalruby:classroom` の `rubyteeEnabled` — 参加しているクラスでルビティーが有効か（生徒のセッションと一緒に保存）

## モニタリング

CloudWatch ログで利用状況を監視。Rubytee 利用パターンとコスト異常検出は `rubytee-monitor` skill を使用（`.claude/skills/rubytee-monitor/`）。

### リクエストのフィールドと構造化ログ

`POST /generate` のリクエストは、`userMessage` / `history` / `stateContext` に加えて次のフィールドを持つ。
`purpose` は必須で、`genai-takeover` 以外は 410 になる。

| フィールド | 例 | 用途 |
|---|---|---|
| `purpose` | `"genai-takeover"` | 用途。受け付けるのは `genai-takeover` だけ（Ruby タブの旧チャットの「未指定」は 410 `CHAT_DISCONTINUED`） |
| `sessionToken` | `"3b241101-…"` | 生徒がクラスに参加したときにもらうトークン（クラス管理の `sessionToken`）。relay が席を確かめる。クラスに参加していなければ送らない |

**席は `sessionToken` からだけ決める**（`classroom` / `seat` は自己申告なので、送られてきても**無視する**）。
relay はクラス管理の `ClassroomMemberships{suffix}` の GSI `sessionToken-index` を**読み取り専用で Query** し、
行の `classroomId` と `memberId`（`seat-03` → 出席番号 `3`）を席にする。クラス管理の `verifySessionToken`
と同じく **kicked の行は認めない**。確かめられないとき（トークンなし・UUID の形でない・見つからない・
kicked・表が読めない）は**席として数えない**（ログ・集計は `classroom` / `seat` なし）。
これは不正防止の判定なので fail-open（席として信じる）にはしないが、答えは返す。

確かめた席は CloudWatch ログ・集計表・takeover の席の上限に使う。takeover は 1 席ごとに数える（下記）。
クラス管理のメンバー一覧の `aiUsage` はこの classroomId / 出席番号で relay の表を引く
（`docs/classroom/architecture.md`）。

`sessionToken` で確かめる理由: 以前は `classroom` / `seat` を自己申告で受けていたので、`classroomId` を
知っていれば誰でも、他の生徒の席の枠を使い切る・先生に見せる `aiUsage` をずらす・RETAIN の集計表に
好きな `classroom#...` の行を作る・自己申告の席だけで IP 1600 回の枠を使う、ができた（#1317）。

Claude を 1 回呼ぶごとに、worker が 1 行の JSON ログ（`event: "rubytee_takeover_response"`）を出す:

```json
{"event":"rubytee_takeover_response","model":"claude-sonnet-5-5","outputTokens":350,"inputTokens":17,"cacheCreationTokens":0,"cacheReadTokens":4964,"userMessageLength":42,"purpose":"genai-takeover","classroom":"cls_abc123","seat":"12"}
```

### CloudWatch Logs Insights の集計クエリ例

ロググループ `/aws/lambda/RubyteeRelayTakeoverWorker`（prod）/ `/aws/lambda/RubyteeRelayTakeoverWorker-stg`（stg）で実行する。

とても多く使っている利用者（クラス・出席番号ごとの回数とトークン）:

```
fields @timestamp, classroom, seat
| filter event = "rubytee_takeover_response" and ispresent(classroom)
| stats count(*) as requests, sum(outputTokens) as output, sum(inputTokens + cacheCreationTokens + cacheReadTokens) as input by classroom, seat
| sort requests desc
| limit 50
```

用途・モデルごとの回数（Sonnet の利用量の把握）:

```
fields @timestamp
| filter event = "rubytee_takeover_response"
| stats count(*) as requests, sum(outputTokens) as output by purpose, model
| sort requests desc
```

クラスごとの日別の回数:

```
fields @timestamp
| filter event = "rubytee_takeover_response" and ispresent(classroom)
| stats count(*) as requests by classroom, bin(1d)
| sort requests desc
```

## ルビティーにまかせる（takeover）の呼び方

`purpose: "genai-takeover"` の呼び出しを、**非同期ジョブ**で答える（Sonnet が 8192 トークンを
出し切ると API Gateway HTTP API の統合タイムアウト 30 秒を超えうるため）。relay が受け付けるのはこの呼び出しだけ
（`purpose` 未指定の旧チャットは 410）。

### 流れ

1. `POST /generate`（本文は従来と同じ形 + `purpose: "genai-takeover"`、クラスに参加していれば `sessionToken`）
   → 入力チェックとレート制限を通ると **`202 { "jobId": "<uuid>", "status": "pending" }`**
2. `GET /jobs/{jobId}` を問い合わせる → `200` で次のどれか:
   - `{ "jobId", "status": "pending" }` — まだ考え中。間隔を空けて再度問い合わせる
   - `{ "jobId", "status": "done", "text": "<答え>", "outputTokens": 1234 }`
   - `{ "jobId", "status": "error", "error": "<CODE>" }`
3. GUI は `text` をそのまま `checkAnswer` に通す（答えの形は下記）。

問い合わせ間隔は **3 秒から始めて少しずつ伸ばす**（例: 3 → 4 → 5 秒…、最大 10 秒）。クラス全員が
同時に問い合わせても API Gateway の上限に当たらないよう、`GET /jobs/{jobId}` だけルート単位の
スロットリング（prod 40 rps / burst 80、stg 10 / 20）を持つ。`GET` はレート制限の回数に数えない。
ジョブは **1 時間**で消える（それ以降は `404 JOB_NOT_FOUND`）。

### 上限

| 項目 | 上限 |
|---|---|
| `userMessage` | 10000 字（`DANGEROUS_PATTERNS` のチェックは残る） |
| `stateContext.sprite.currentCode` | 10000 字 |
| `history` | 20 ターン × 10000 字 |
| リクエスト全体 | **200KB（UTF-8）**。上の各項目の上限を通った後に判定し、超えたら `400 HISTORY_TOO_LONG`（`userMessage` / `currentCode` だけでは届かず、超えるのは往復を重ねたとき） |
| `max_tokens` | 8192 |
| レート制限 | `sessionToken` で席を確かめられれば IP 1600 回 / 35 分 + **1 席 40 回 / 35 分**。確かめられなければ IP 40 回 / 35 分 |

レート制限は **IP → 席の順**に数える。IP の上限で 429 になったときは席を数えない（先生に見せる席の回数が、
その生徒が使っていない分で増えないように）。席のキー `seat#<classroom>:<seat>` は `:` で区切るので、
確かめた行の `classroomId` に `:` を含むものや、`memberId` が `seat-<数字>` でないものは席として数えず、
IP 40 回 / 35 分に回す（クラス管理の `classroomId` は UUID、`memberId` は `seat-03` の形なので、正しい呼び出しは影響しない）。

リクエスト全体の 200KB は Lambda の非同期呼び出しの payload 上限（256KB）に収めるため。1 万字の
作品 + 何往復かは収まるが、20 往復すべてに作品全体を入れると超えうるので、**GUI は古い往復から
落として送る**。

### エラーコード（takeover で増えるもの）

| コード | いつ |
|---|---|
| `INVALID_JOB_ID`（400） | `GET /jobs/{jobId}` の jobId が UUID の形でない |
| `JOB_NOT_FOUND`（404） | ジョブが無い（1 時間を過ぎて消えた・存在しない） |
| `JOB_TIMEOUT`（`status: "error"`） | 作成から 240 秒を過ぎても `pending`（worker が落ちた・混んでいて 60 秒以内に起動できなかった） |
| `AI_TIMEOUT`（`status: "error"`） | Claude の呼び出しが 150 秒で終わらなかった |
| `AI_OVERLOADED` / `AI_API_ERROR` / `INTERNAL_ERROR`（`status: "error"`） | 同期の経路と同じ意味 |

`POST` のエラー（`INPUT_TOO_LONG` / `RATE_LIMIT_EXCEEDED` など）は従来どおり `POST` の応答で返る。

### 答えの形とシステムプロンプト

- 1〜3 行の日本語の説明 → `▼▼ ここから下をコピーして、スモウルビーにもどろう ▼▼` → ```` ```ruby ```` の
  コードブロック 1 つ → `▲▲ ここまで ▲▲` → 確かめ方 1 つ。コードブロックの中は、変えたスプライトごとに
  `# 「スプライト名」` の行 + そのスプライトの作品全体（ステージは `# 「ステージ」`）。
- `system` は 2 ブロック。**先頭 = 固定部分**（役割・言語仕様 `smalruby-reference.ts`・答えの形・Child
  Safety）に `cache_control: { type: "ephemeral", ttl: "1h" }` を付ける（授業中に間隔が空いてもキャッシュが
  残るように）。**後ろ = 毎回変わる部分**（今のスプライト・名前の一覧・`currentCode`）。作品・困りごと・
  失敗理由は後ろのブロックか `messages` に置き、先頭ブロックの一致を崩さない。

### 作り（安全のための決めごと）

| 部品 | 役割 | 権限 |
|---|---|---|
| API Lambda `RubyteeRelayHandler{suffix}` | 入力チェック → レート制限 → ジョブを `pending` で作る → worker を非同期で起動 → `202`。`GET /jobs/{jobId}` に答える | rate limit 表の読み書き、jobs 表の `PutItem` / `GetItem`、usage 表の `UpdateItem`、**worker 1 つだけ**の `lambda:InvokeFunction` |
| worker Lambda `RubyteeRelayTakeoverWorker{suffix}` | Claude を呼び、結果を jobs 表に書く。**HTTP のルートは無い**。再試行 0 回・timeout 180 秒・同時実行数の上限あり・起動待ちが 60 秒を超えた呼び出しは捨てる（`maxEventAge`） | jobs 表と usage 表の `UpdateItem`、WIF 用の `sts:GetWebIdentityToken` だけ |
| DynamoDB `RubyteeJobs{suffix}` | `{ jobId, status, createdAt, text?, outputTokens?, error?, ttl }`。**入力は保存しない**（worker には非同期呼び出しの payload だけで渡す）。TTL 1 時間 | — |

- 新しい外部サービス・仕組み（Step Functions / SQS / Function URL）は使わない。
- worker は Claude を **Anthropic の TypeScript SDK**（`@anthropic-ai/sdk`）で呼ぶ。WIF のトークンの
  交換・キャッシュ・期限前の更新を SDK に任せるため。`maxRetries: 0`（タイムアウトの再送で二重に課金しない）・
  `timeout` 150 秒。SDK は `anthropic-version: 2026-10-21` を送る。system の `cache_control`（`ttl: '1h'`）で
  prompt caching が効く（beta ヘッダは付けない）。
- jobId は `crypto.randomUUID()`（推測できない乱数）。UUID の形でなければ DynamoDB を見ずに 400。

## 利用の集計・席ごとの状況

### 集計表 `RubyteeRelayUsage{suffix}`（RETAIN・TTL なし）

takeover の呼び出しを、`sessionToken` で確かめた席ごと・日ごとに足し込む（1 回ごとの行は作らない）。書き込みに失敗しても答えは返す（fail-open）。

- キー: `pk = classroom#<classroomId>`（席を確かめられなければ `classroom#-`）、`sk = <YYYY-MM-DD(JST)>#seat#<seat>#<purpose>`
  （`seat` が無ければ `-`。旧チャットを止める前の行には `purpose` が `chat` のものが残っている）
- 属性（`ADD` で足し込む数）: `requests`（受け付けた回数）/ `rateLimited`（429）/ `succeeded` / `failed` /
  `inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheCreationTokens`
- 名前・メールアドレス・IP・入力や答えの中身は残さない。

集計は `Query` で取る（例: あるクラスの 11 月）:

```bash
aws dynamodb query --table-name RubyteeRelayUsage \
  --key-condition-expression 'pk = :pk AND sk BETWEEN :from AND :to' \
  --expression-attribute-values '{":pk":{"S":"classroom#<classroomId>"},":from":{"S":"2026-11-01"},":to":{"S":"2026-11-30~"}}'
```

### 席ごとの「今の状況」（クラス管理が読む）

takeover で 1 席ぶん数えるたびに、レート制限表に席ごとに 1 行だけの要約を上書きする:
キー `sourceIp = seat#<classroomId>:<seat>#current`、`windowStart = 0`、属性 `count` / `limit` / `windowMinutes` /
`resetAt`（窓が終わる epoch 秒）/ `ttl`（= `resetAt`）。上限と窓も relay が書くので、クラス管理は計算せずに読むだけ。

relay は 2 つの表の ARN を CfnOutput と SSM（`/smalruby/rubytee-relay/<stage>/rate-limit-table-arn`、
`.../usage-table-arn`）に出す。クラス管理のスタックは**読み取り権限（`GetItem` / `BatchGetItem` / `Query`）だけ**を
持つ（表名は `RubyteeRelayRateLimit{suffix}` / `RubyteeRelayUsage{suffix}` から組み立てるので、スタックの
デプロイ順に依存しない）。メンバー一覧の `aiUsage` の形は `docs/classroom/architecture.md` を参照。

逆向きに、relay の API Lambda はクラス管理の `ClassroomMemberships{suffix}` の **GSI `sessionToken-index` への
`dynamodb:Query` だけ**を持つ（表本体への権限は無い）。こちらも表名から ARN を組み立て、デプロイ順に依存しない
（クラス管理の表がまだ無ければ、席として数えず IP だけの上限になるだけ）。

キーの組み立て（`seat#...#current`・JST の日付・集計表の `sk`）は relay の `lambda/takeover.ts` と
クラス管理の `lambda/ai-usage-lib.ts` に**別々に書いてあり、対で変える**。1 つのモジュールにまとめないのは、
`infra/` の CDK プロジェクトがそれぞれ独立していて（`package.json`・`tsconfig.json` の `rootDir`・
デプロイの workflow が `infra/<project>/` ごとに差分を見る）、共有の置き場を作ると片方だけデプロイされる
ずれが起きるため。両方のテストが同じ文字列（例: `seat#c1:3#current`、`2026-11-01#seat#3#genai-takeover`）を
期待値に持っているので、片方だけ変えるとテストで気付ける。

## デプロイ

詳細手順は `.claude/rules/infra/smalruby-rubytee-relay.md` を参照。

```bash
# stg
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk deploy

# prod
cd infra/smalruby-rubytee-relay && rm .env && ln -s .env.prod .env
docker compose run --rm -w /app/infra/smalruby-rubytee-relay infra npx cdk deploy
```

## テスト

- 単体テスト（クライアント）: `packages/scratch-gui/test/unit/lib/genai-takeover.test.js`, `lib/genai-concierge-state.test.js`, `reducers/classroom-reducer.test.js`, `components/ruby-toolbar-no-rubytee.test.jsx`（Ruby タブにチャットのボタンが無いこと）
- 単体テスト（Lambda）: `infra/smalruby-rubytee-relay/lambda/tests/`

## 関連ドキュメント

- [`docs/genai-consult/`](../genai-consult/) — ［ルビティーにまかせる］の起点となる「生成AI に相談」
- `.claude/rules/infra/smalruby-rubytee-relay.md` — リレー実装・デプロイ・運用ルール
- `.claude/skills/rubytee-monitor/SKILL.md` — CloudWatch ログ監視運用

## 関連 Issue / PR

- Issue #346 — Gemini → Claude 移行、ルビティーへのリブランディング
- 主要 PR は履歴を参照（`feat:.*rubytee` で grep）
