# smalruby-studuino-hex（Studuino の hex を作る API）

> **🆕 Smalruby 独自** — Studuino モードで、ブラウザから送ったプログラムを hex にして返す API。

機能の全体像（構文木・書きこみの流れ・ライセンス）は [`docs/studuino-mode/`](../studuino-mode/) が正。
このページは `infra/smalruby-studuino-hex/` の作り・API・上限・計測の見方を書く。

## 作り

```
ブラウザ ──POST /compile──> API Gateway（HTTP API）──> Lambda（コンテナ）──> arduino-cli ──> hex
                                                          │
                                                          └─> DynamoDB（IP ごとの回数）
```

| リソース | 名前（stg は `-stg` が付く） | 備考 |
|---|---|---|
| CloudFormation スタック | `StuduinoHexStack` | 新しい CDK プロジェクト。コンテナのビルドが重いので、ほかの Lambda のデプロイを遅くしないよう分けた |
| Lambda（コンテナ・x86_64） | `smalruby-studuino-hex-compile` | メモリ 2GB・`/tmp` 1GB・タイムアウト 30 秒 |
| HTTP API | `SmalrubyStuduinoHex` | `POST /compile`。カスタムドメインは無い（`execute-api` のエンドポイントを使う。スタックの出力 `HttpApiEndpoint`） |
| DynamoDB | `smalruby-studuino-hex-rate-limit` | IP（のハッシュ）ごとの 1 分・1 日の回数。TTL で消える。DESTROY |
| ロググループ | `/aws/lambda/smalruby-studuino-hex-compile` | prod 1 か月・stg 1 週間 |

### コンテナの中身

`infra/smalruby-studuino-hex/container/`。版とハッシュは **`container/third-party.json` だけ**で決め、
CDK が Docker の build args に渡す（Dockerfile に版を書かない）。

| 物 | 版 | 確かめ方 |
|---|---|---|
| arduino-cli | 1.5.1（Linux 64bit） | GitHub のリリースの sha256 を固定 |
| AVR のコア | `arduino:avr@1.8.8` | arduino-cli が index の checksum で確かめる |
| Servo・Adafruit NeoPixel | 1.2.2・1.15.2 | 同上（NeoPixel はサンプル `smalrubot-s1` だけが使う） |
| ボード定義 | アーテック社の Arduino IDE 1.6.x/1.8.x 用（`arduino_ide_settings_ver16x_18x.zip` の `other/hardware/studuino`） | URL と sha256 を固定 |
| Studuino ライブラリ | アーテック社の zip（`studuino_v1_lib.zip`） | URL と sha256 を固定（下の「ライブラリ」） |

- ボードは **`studuino:avr:studuino`**（アーテック社のボード定義「Studuino (3.3V, 8 MHz) w/ ATmega168」）。
  中身は `mcu=atmega168`・`f_cpu=8000000L`・`build.board=AVR_PRO`・upload は optiboot（`arduino` プロトコル・115200bps）で、
  コアとツールは `arduino:avr` のもの（`build.core=arduino:arduino`）を使う。1.7.x 用の zip は Arduino IDE 1.7（arduino.org 版）向けなので使わない。
  Studuino は ATmega168PA・8MHz・3.3V で、いまのファームウェア（`sr_studu`）と同じ。168PA は 168 と同じ命令・メモリなので
  168 向けの hex が動く。書きこみはブラウザの STK500v1（`smalrubot-firmware-flasher.js`。シグネチャ `1E 94 06`）が行う。
- フラッシュの上限は **15,872 バイト**（ボード定義の `upload.maximum_size`。16KB から optiboot の 512 バイトを引いた値）。
  超えたら `compile_failed`（`flash_overflow`）。
- ボード定義が取れない・sha256 が合わないときは、イメージのビルドを止めずに、同じ MCU・クロックの
  `arduino:avr:pro:cpu=8MHzatmega168`（上限 14,336 バイト）で作り、応答の `toolchain.boardError` に理由を出す。
- イメージを作るときにサンプルを 1 回ずつコンパイルし、AVR のコアのキャッシュを `/opt/arduino/build-cache` に
  入れておく。Lambda は最初の呼び出しで `/tmp` へ写して使う（コールドスタートでもコアをコンパイルし直さない）。
- ハンドラ（`lambda/handler.ts`）は synth のときに esbuild で `container/build/handler.js` にまとめ、
  イメージに入れる（AWS SDK はベースイメージのものを使う）。
- イメージを作るのは `cdk deploy`（GitHub Actions の `Deploy Infra`）のとき。`cdk synth` では作らない。

### ライブラリ

使うのは `Studuino`・`MMA8653`・`MPU6050`・`IRremoteForStuduino`・`ColorSensor` の 5 つ（本体が include する）。
**リポジトリに入れない**。コンテナを作るときに `third-party.json` の `studuinoLib.url` から取り、
`sha256` を確かめ、5 つのフォルダだけをそのまま（LICENSE・著作権表示を含めて）入れる。

- 取得元はアーテック社の公式の配布元（https://www.artec-kk.co.jp/studuino/ja/arduino.php ）。
- ライブラリが取れない・sha256 が合わない（または `studuinoLib.url` が空の）ときは、ライブラリなしでコンテナを作る。
  そのとき Studuino ライブラリの要るサンプルは `compile_failed`（`reason: "library_missing"`・`libraryError` に理由）を返し、
  `blink`（Arduino のコアだけ）は動く。応答の `toolchain.studuinoLib` が `null` なら入っていない。
- URL を書いたら sha256（64 桁の 16 進）も書く（無いと synth が失敗する）。

## API

### `POST /compile`

本文は 2 つの形のどちらか。任意の C++ は受け付けない。

| 本文 | 何をするか |
|---|---|
| `{ "ir": <構文木> }` | 構文木（Studuino IR）を検査し、C++ に書き出してコンパイルする（Studuino モードの書きこみ） |
| `{ "sample": "<名前>" }` | 決まったサンプルをコンパイルする（動作確認とコンパイルの時間の計測） |

```
POST <HttpApiEndpoint>/compile
Origin: https://smalruby.app
Content-Type: application/json

{ "ir": { "version": 1, "board": "studuino", "ports": { "A0": "led" },
          "main": [{ "op": "forever", "body": [
            { "op": "led", "port": "A0", "on": true }, { "op": "wait", "secs": { "num": 0.5 } },
            { "op": "led", "port": "A0", "on": false }, { "op": "wait", "secs": { "num": 0.5 } } ] }] } }
```

#### 構文木の検査と書き出し

構文木の形と、op ごとの C++ の書き出しの表は [`docs/studuino-mode/`](../studuino-mode/) の「構文木」が正。
実装は `lambda/ir.ts`（検査）と `lambda/codegen.ts`（書き出し）で、どちらも純粋関数（単体テストは
`lambda/tests/ir.test.ts`・`codegen.test.ts`）。

- **厳密に検査する**: 知らない op・知らないキー・知らないポート・ポートに合わない部品・割り当てていないポート・
  型の合わない式（数の所に真偽など）・宣言していない変数は、すべて `400 invalid_ir` で拒否し、
  `path`（例 `main[0].body[2].cond.a`）と `reason`（例 `unknown_op`・`port_not_assigned`・`type_mismatch:number`）を返す。
  第 2 弾の `lists` / `functions` も、まだ知らないキーとして拒否する。
- **利用者の文字列は C++ に入らない**: 変数は `v0`〜`v9999` の ID だけを受け付け、C++ では `sr_v0` にする。
  値は数値（有限の数）と真偽だけ。ポートは `PORT_A0` などの定数の名前、部品は `PIDLED` などの決まった名前で書き出す。
- **書き出しの形**: `Studuino board;`、Scratch の計算に合わせる補助関数（`sr_mod`・`sr_round`・`sr_random`・
  `sr_clamp`・`sr_timer`）、変数（`double`）、`sr_main()`（「旗が押されたとき」の下）。`setup()` でポートを
  表の順に初期化し、補正値を設定し、`sr_main()` を 1 回呼ぶ。`loop()` は空。
- 値はライブラリの範囲に収める（DC モーターの速さ 0〜255・サーボ 0〜180 度・ブザー 130〜4186 Hz に
  `sr_clamp` してから四捨五入）。待つ秒数は 0 未満を 0 にする。
- 真偽を数の所に入れる（Scratch で `<>` を `( )` に入れる）ための `to_num`（真 = 1・偽 = 0）も受け付ける。
  ブラウザが使うかは構文木の生成の sub-issue で決める。
- 応答の `source` は書き出した C++（画面には出さない。ソースの入手のため）。

サンプル（`{ "sample": ... }`）は、大きさの違うもので、コンパイルの時間を測る（打ち切りの 25 秒が足りるかの材料）。

| サンプル | 大きさ | 中身 | Studuino ライブラリ |
|---|---|---|---|
| `blink` | 小 | A0 の LED を 0.5 秒ごとに点滅（`digitalWrite`） | 要らない |
| `studuino-led` | 小 | 同じことを Studuino ライブラリ（`InitSensorPort`・`LED`・`Timer`）で | 要る |
| `robot-car` | 中 | ロボットカーの自動運転（赤外線フォトリフレクタ 2 つで線をたどる・タッチで止まってブザー・サーボで首をふる・暗いと LED） | 要る |
| `smalrubot-s1` | 大 | スモウルボット S1 のファームウェア（`sr_studu`。smalruby/smalrubot、MIT。フォルダに LICENSE）。フラッシュの上限に近い | 要る（＋ Adafruit NeoPixel） |

成功（200）:

```json
{
  "hex": ":100000000C94...\n:00000001FF\n",
  "size": 1234,
  "source": "void setup() { ... }",
  "maxSize": 15872,
  "toolchain": { "arduinoCli": "1.5.1", "avrCore": "arduino:avr@1.8.8", "libraries": "Servo@1.2.2|Adafruit NeoPixel@1.15.2", "board": "sha256:...", "fqbn": "studuino:avr:studuino", "studuinoLib": "sha256:..." },
  "compileMs": 2345,
  "coldStart": false
}
```

失敗は `{ "error": "<名前>", "message": "<説明>", ... }`。コンパイラの生の出力は返さない（ログにだけ残す）。

| HTTP | `error` | いつ |
|---|---|---|
| 400 | `invalid_request` | JSON が壊れている（`reason: "invalid_json"`）・知らないサンプル（`reason: "unknown_sample"`） |
| 400 | `invalid_ir` | 構文木の検査に通らない（`reason`・`path`） |
| 403 | `forbidden_origin` | 許していない Origin・Origin が無い |
| 413 | `too_large` | 本文が上限を超えた（`maxBytes`）・構文木のノードの数・深さ・変数の数が上限を超えた（`reason`: `too_many_nodes` / `too_deep` / `too_many_variables`・`limit`・`path`） |
| 422 | `compile_failed` | コンパイルの失敗（`reason`: `compile_failed` / `flash_overflow` / `library_missing`） |
| 429 | `rate_limited` | IP ごとの回数を超えた（`retryAfter` 秒・`Retry-After` ヘッダ） |
| 504 | `timeout` | コンパイルを打ち切った（`timeoutMs`） |
| 500 | `internal` | それ以外 |

### 呼べる場所

- CORS は共有コード（`infra/shared/cors-origins.ts` の `resolveCorsOrigins`）。prod は `https://smalruby.app` だけ、
  stg は加えてローカル（`localhost:8601`〜`8610`）とブランチプレビュー（`https://preview.smalruby.app`）。
- CORS はブラウザにしか効かないので、**ハンドラでも `Origin` を確かめ**、許可外（と Origin なし）は 403 にする。

## 上限

数字はどれも env（`.env.<stage>`）で変えられる。

| 項目 | 既定 | env |
|---|---|---|
| 本文の大きさ | 128KB | `STUDUINO_MAX_REQUEST_BYTES` |
| コンパイルの打ち切り | 25 秒 | `STUDUINO_COMPILE_TIMEOUT_MS` |
| IP ごとの回数 | 1 分 12 回・1 日 600 回 | `STUDUINO_RATE_LIMIT_PER_MINUTE`・`STUDUINO_RATE_LIMIT_PER_DAY` |
| 構文木のノードの数 | 10,000 個 | `STUDUINO_MAX_IR_NODES` |
| 構文木の入れ子の深さ | 100 | `STUDUINO_MAX_IR_DEPTH` |
| 変数の数 | 64 個（ATmega168PA の RAM は 1KB） | `STUDUINO_MAX_IR_VARIABLES` |
| API 全体 | prod 毎秒 10（バースト 20）・stg 5（10） | （CDK の中） |

- **コンパイルの打ち切りは 60 秒にできない**: API Gateway（HTTP API）の統合は 30 秒で切れる。Lambda のタイムアウトも
  30 秒にし、その前に打ち切って 504 を返せるよう 25 秒にした。60 秒が要るとわかったら、Lambda の関数 URL に
  変えるなどの作り直しが要る。
- IP は SHA-256 のハッシュにしてから表に入れる（IP をそのまま残さない）。
- DynamoDB が使えないときは数えずに通す（fail-open。計測のログに `rateLimitFailOpen: true`）。

## 計測の見方

1 回ごとに 1 行、**CloudWatch Embedded Metric Format** のログを出す（`event: "studuino_hex_request"`）。
ログに出すだけで、CloudWatch のメトリクスができる。

- **メトリクス**: 名前空間 `Smalruby/StuduinoHex`・ディメンション `Stage`。
  `Requests`（回数）・`Succeeded`・`Failed`（コンパイルの失敗・打ち切り・内部エラー）・`Rejected`（403 / 413 / 429 / 400）・
  `CompileTime`（ms）・`IrNodes`（構文木のノードの数）・`HexBytes`・`RequestBytes`・`TotalTime`（ms）。
  CloudWatch のコンソール →「メトリクス」→「すべてのメトリクス」→ `Smalruby/StuduinoHex` で見る。
- **ログの項目**: `outcome`（`ok` か失敗の名前）・`reason`・`sample`（構文木のときは `ir`）・`irNodes`・`irDepth`・`requestBytes`・`compileMs`・`hexBytes`・`totalMs`・
  `coldStart`・`rateLimitFailOpen`。コンパイラの出力は別の行（`event: "studuino_hex_compile_log"`）。
- Logs Insights の例（コールドとウォームのコンパイル時間）:

  ```
  fields @timestamp, outcome, sample, compileMs, totalMs, coldStart
  | filter event = "studuino_hex_request"
  | stats count(), avg(compileMs), max(compileMs), avg(totalMs) by coldStart, outcome
  ```

- コールドスタートの初期化時間は Lambda の `REPORT` 行の `Init Duration` で見る。

## 試す（stg）

```bash
EP=<スタックの出力 HttpApiEndpoint>
# hex が返る
curl -sS -X POST "$EP/compile" -H 'Origin: https://smalruby.app' -H 'Content-Type: application/json' \
  -d '{"sample":"blink"}' | head -c 300
# 構文木から hex が返る（第 1 弾の op をすべて使う本文）
curl -sS -X POST "$EP/compile" -H 'Origin: https://smalruby.app' -H 'Content-Type: application/json' \
  -d @infra/smalruby-studuino-hex/lambda/tests/fixtures/all-ops.request.json | head -c 300
# 許可外の Origin は 403
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$EP/compile" -H 'Origin: https://evil.example' -d '{"sample":"blink"}'
```

## デプロイ

ほかの infra と同じく GitHub Actions の `Deploy Infra` だけから出す（stg は PR に `deploy-stg` ラベル、
prod は develop へのマージ）。`.env` は Secrets の `INFRA_STG_DOTENV_SMALRUBY_STUDUINO_HEX` /
`INFRA_PROD_DOTENV_SMALRUBY_STUDUINO_HEX`（秘密は無く、`STAGE=<stage>` だけでよい）。
コンテナのイメージは CDK のアセットとして、ブートストラップの ECR リポジトリに上がる。
