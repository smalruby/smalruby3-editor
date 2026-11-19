# Studuino モード（設計）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

- **Smalruby ランタイム対応**: ❌（smalruby3 gem では動かない。プログラムを hex にして Studuino に書きこむ、ブラウザ専用の機能）
- **デフォルト表示**: —（拡張機能ではなく「モード」。Studuino の拡張機能のメニューから入る）

> **🚧 このページはすべて設計（これから作る）**。まだ実装していない。このあとの sub-issue
> （🧱 infra の Lambda と GUI）は、このページを正として実装する。実装して形が変わったら、
> このページを実装に合わせて直す。「案」と書いたところは、担当の sub-issue で決めてよい。

> ロボット製作に特化した Arduino 互換基板 **Studuino®**（スタディーノ）は、株式会社アーテックの製品です。
> **Studuino® は株式会社アーテックの登録商標です。** スモウルビーは株式会社アーテックの製品ではなく、
> Studuino は対応する機種の名前として使っています。

## 概要

スモウルビーで作ったプログラムを、Studuino が理解できる Arduino のバイナリ（hex）にして基板へ書きこむ。
書きこんだあとは、**パソコンにつながなくても Studuino 単体で動く**（電池をつなぐと動く）。

```
ブロック ──(ブラウザ)──> 構文木（Studuino IR, JSON）──> Lambda ──> C++ ──(arduino-cli)──> hex
                                                                                     │
Studuino <──(ブラウザ: Web Serial・STK500v1。いまのファームウェアの書きこみと同じ仕組み)──┘
```

- ブラウザは、ブロックを **C++ に変えやすい構文木（Studuino IR）** にしてから Lambda に送る。
  ブロックの生の JSON は送らない。前処理は単体テストの厚いフロントで行い、Lambda の実装は少なくする。
- Lambda は構文木を検査し、C++ に書き出し、Studuino ライブラリと一緒にコンパイルして **hex をブラウザに返す**。
  Lambda が基板に直接送るのではない。
- ブラウザは、いまの拡張機能のファームウェアの書きこみ（`smalrubot-firmware-flasher.js`）と同じ仕組みで hex を書きこむ。
- Studuino モードでは **使えるブロックだけ** をパレットに出し、使えないブロックには印をつけて書きこみを止める
  （日本語モードで、使える書き方を限り警告を出した考え方と同じ。[`docs/dncl/policy.md`](../dncl/policy.md)）。

Studuino の拡張機能そのもの（通常モード。パソコンにつないで動かす）は
[`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) を参照。このページは Studuino モードだけを書く。

### ねらい

- 計測・制御のシステムは、パソコンから離れて動くのがふつう。単体で動かせると、問題解決の作品
  （自動点灯ライトなど）を実際に置いて使える。
- Studuino で中学校の「計測・制御」の授業ができると伝える。

## ユーザーストーリー

- **計測・制御を学ぶ中学生** として、作ったプログラムを Studuino に書きこみ、パソコンから外して動かしたい
- **先生** として、教科書の言葉（光センサー・サーボモーターなど）で部品を選び、ポートに割り当てさせたい
- **生徒** として、使えないブロックがどこにあるかすぐ分かり、直してから書きこみたい
- **生徒** として、書きこんだあとでも、パソコンから操作する通常の使い方にボタン 1 つで戻したい

## モードの入り方と切り替え

### 入り方（M5・S4）

- Studuino の拡張機能のメニュー（メニューバーの Studuino のメニュー）から「Studuino モード」に入る。
- 入ると、パレットが **使えるブロックだけ** になる。出ると元にもどる。
- モードに入った直後に、**入出力の設定**（ポートの設定のモーダル）を自動で 1 回開く。
- 入出力の設定は、次の 2 か所からも開ける:
  - Studuino モードのパレットの先頭の「入出力の設定」ボタン（「変数を作る」ボタンと同じ形）
  - メニューバーの Studuino のメニュー

### 使えないブロック（M6・S5）

- 使えないブロックには **印** をつける（日本語モードのエラーと同じ見た目）。
- 画面の上に「使えないブロックが n 個あります」と出す。押すと、そのブロックへ移る。
- 使えないブロックが 1 つでもあれば、**書きこみを止める**。
- 使えないブロックになるもの:
  - Studuino モードのブロックの一覧（下）に無いブロック（見た目・音・ペン・メッシュ・文字列の演算など）
  - 入出力の設定で **割り当てていないポート** を使っている部品のブロック（使っているポートを外したり、
    別の部品に変えたりしたとき。S5 で「外せる」に決めた）
  - 「旗が押されたとき」が 2 つ以上あるときの 2 つ目以降（M4。電源を入れたときに動くのは 1 つだけ）

### モード切替の条件と確認のダイアログ（M6・S11）

- **使えないブロックがあると、モードを変えられない**（通常 → Studuino も、Studuino → 通常も）。
  - 通常 → Studuino: 通常のブロック（見た目など）が残っていると切り替えられない。
  - Studuino → 通常: Studuino モード専用の部品のブロックは、通常モードには無いので切り替えられない。
- 切り替えを選んだとき、使えないブロックがあれば次のダイアログを出す:
  - 本文:「使えないブロックが n 個あるので切り替えられません」
  - ボタン: ［ブロックを見る］［すべて消して切り替える］［やめる］
- ［すべて消して切り替える］は **新規と同じふるまい** ですべてのブロックを消して切り替える。
  保存していない変更があれば、新規と同じ確認を先に出す。
- 使えないブロックが無ければ、そのまま切り替わる。

## 第 1 弾のブロック（S1）

第 1 弾は **部品のブロック＋制御・演算・変数（数値）**。部品のブロックは、入出力の設定で割り当てた部品の
ぶんだけパレットに出る（M3）。できること（機能・ポートと部品の対応）は本家（アーテック社の Web アプリ）に
合わせ、文言は一般名詞をスモウルビーの言い回しで書く（S14）。下の「表示」は案で、#2216 で決める。

### 部品のブロック（Studuino モード専用・新しく作る）

| 種類 | 表示（案） | 対応する部品 | 構文木の op |
|---|---|---|---|
| 文 | DC モーター [ポート] の速さを (n) にする | DC モーター | `dc_motor_speed` |
| 文 | DC モーター [ポート] を [正転 / 逆転] で回す | DC モーター | `dc_motor_dir` |
| 文 | DC モーター [ポート] を [ブレーキ / 惰性] で止める | DC モーター | `dc_motor_stop` |
| 文 | サーボモーター [ポート] を (n) 度にする | サーボモーター | `servo` |
| 文 | 割り当てたサーボモーターをまとめて動かす | サーボモーター（2 個以上） | `servo_multi` |
| 文 | LED [ポート] を [オン / オフ] にする | LED | `led` |
| 文 | ブザー [ポート] を (音の高さ) で鳴らす | ブザー | `buzzer_on` |
| 文 | ブザー [ポート] を止める | ブザー | `buzzer_off` |
| 値 | 光センサー [ポート] | 光センサー | `sensor`（`kind: light_sensor`） |
| 値 | 音センサー [ポート] | 音センサー | `sensor`（`kind: sound_sensor`） |
| 値 | 赤外線フォトリフレクタ [ポート] | 赤外線フォトリフレクタ | `sensor`（`kind: ir_photoreflector`） |
| 値 | 温度センサー [ポート] | 温度センサー | `sensor`（`kind: temperature_sensor`） |
| 真偽 | タッチセンサー [ポート] が押された | タッチセンサー | `button`（`kind: touch_sensor`） |
| 真偽 | ボタン [ポート] が押された | ボタン（基板の十字ボタン） | `button`（`kind: push_switch`） |

- [ポート] のドロップダウンには、**その部品を割り当てたポートだけ** を「光センサー (A6)」のように
  部品とポートが分かる形で出す（S2）。
- 本家のタッチセンサーは丸い値のブロック（0 / 1）に見えるが、スモウルビーでは真偽のブロックにする案
  （`もし <タッチセンサー (A2) が押された> なら` と書けるようにする）。決めるのは #2216。
- 加速度センサー（I2C・A4/A5）・カラーセンサー・赤外線リモコンは第 1 弾では扱わない。

### 標準のブロック（Scratch のブロックをそのまま使う）

| カテゴリ | ブロック（opcode） |
|---|---|
| イベント | 旗が押されたとき（`event_whenflagclicked`）。**1 つだけ**（M4） |
| 制御 | `control_wait` / `control_repeat` / `control_forever` / `control_if` / `control_if_else` / `control_wait_until` / `control_repeat_until` |
| 演算 | `operator_add` / `operator_subtract` / `operator_multiply` / `operator_divide` / `operator_random` / `operator_gt` / `operator_lt` / `operator_equals` / `operator_and` / `operator_or` / `operator_not` / `operator_mod` / `operator_round` |
| 調べる | `sensing_timer` / `sensing_resettimer` |
| 変数 | `data_setvariableto` / `data_changevariableby` / `data_variable`（**数値だけ**） |

- 使えないもの: クローン・すべてを止める・文字列の演算（つなぐ・文字・長さ・含む）・数学の関数
  （絶対値・平方根など）・変数の表示/非表示（モニターは基板に無い）・見た目・音・ペン・メッシュなど。
- 変数は数値として扱う。文字列を入れている（例: 「にする」に文字を入れた）ブロックは使えないブロック扱い（S6）。

### 第 2 弾

- **リスト**（数値のリスト。大きさの上限つき）と **「ブロックを作る」**（定義と呼び出し）。
- 第 1 弾に入れない理由: C++ にしたときの配列の大きさ・引数の型・再帰の扱いが重く、構文木と Lambda の検査も増える。
- 構文木のスキーマは、第 2 弾で `lists` / `functions` を足せる形にしておく（下の「構文木」）。

## ポートの設定（入出力の設定・S2）

ポートは基板で決まっているので、**ポートごとに、つなぐ部品の名前をドロップダウンから選ぶ**。
自由な名前は入力させない。

### ポートごとに選べる部品

| ポート | 選べる部品 |
|---|---|
| D2 / D4 / D7 / D8 / D9 / D10 / D11 / D12 | サーボモーター |
| M1 / M2 | DC モーター |
| A0 / A1 / A2 / A3 | 光センサー・音センサー・赤外線フォトリフレクタ・温度センサー・タッチセンサー・LED・ブザー・ボタン |
| A4 / A5 | 光センサー・音センサー・赤外線フォトリフレクタ・温度センサー・タッチセンサー・LED・ブザー（ボタンは選べない） |
| A6 / A7 | 光センサー・音センサー・赤外線フォトリフレクタ・温度センサー（アナログ入力専用のピン） |

- どのポートも「つながない」（未選択）を選べる。はじめは全部未選択。
- A0〜A3 は基板の十字ボタンとつながっているので「ボタン」が選べる。
- 部品の内部の名前（構文木・保存・Ruby で使う）:

| 部品 | 内部の名前 | ライブラリの部品 ID |
|---|---|---|
| サーボモーター | `servo_motor` | （`InitServomotorPort`） |
| DC モーター | `dc_motor` | （`InitDCMotorPort`） |
| LED | `led` | `PIDLED` |
| ブザー | `buzzer` | `PIDBUZZER` |
| 光センサー | `light_sensor` | `PIDLIGHTSENSOR` |
| 音センサー | `sound_sensor` | `PIDSOUNDSENSOR` |
| 赤外線フォトリフレクタ | `ir_photoreflector` | `PIDIRPHOTOREFLECTOR` |
| 温度センサー | `temperature_sensor` | `PIDTEMPERATURESENSOR` |
| タッチセンサー | `touch_sensor` | `PIDTOUCHSENSOR` |
| ボタン | `push_switch` | `PIDPUSHSWITCH` |

### ブロックのドロップダウン

- 部品のブロックのドロップダウンには、その種類の部品を割り当てたポートだけを出す。表示は「光センサー (A6)」の形。
  メニューの値はポート名（`A6`）。
- その種類の部品を 1 つも割り当てていなければ、そのブロックはパレットに出さない。

### 割り当てを外したとき（S5）

- ブロックで使っているポートでも、外したり別の部品に変えたりできる。
- そのポートを使うブロックは **使えないブロックと同じ印** になり、書きこみを止める（M6 と同じ流れ）。
  割り当てをもどせば印は消える。

### 補正値

- **DC モーター**: M1・M2 の最大の速さの割合（0〜100%、はじめは 100）。左右のタイヤの速さをそろえるため。
- **サーボモーター**: D2〜D12 それぞれの角度のずれ（−15〜15 度、はじめは 0）。
- 入出力の設定のモーダルで変えられるようにする（置き場所は #2215 で決める）。
- 書きこみのとき、構文木の `calibration` に入れ、C++ の `SetDCMotorCalibration` / `SetServomotorCalibration` になる。

## 保存の形（S10）

プロジェクトの JSON（`project.json`）に **`extensionStorage`**（TurboWarp と同じ形）を足し、
ポートの設定・補正値・Studuino モードかどうかを入れる。

```json
{
  "targets": [ ... ],
  "meta": { ... },
  "extensionStorage": {
    "studuino": {
      "version": 1,
      "mode": "studuino",
      "ports": { "M1": "dc_motor", "D9": "servo_motor", "A0": "led", "A6": "light_sensor" },
      "calibration": {
        "dcMotor": { "M1": 100, "M2": 100 },
        "servoMotor": { "D9": 0 }
      }
    }
  }
}
```

- 置き場所はトップレベル（ステージの target ではない）。Studuino の設定は作品に 1 つだけなので。
- キー（`studuino`）は案。実装（#2212）で拡張機能の ID に合わせて決める（「人間・実装で決めること」）。
- `mode`: `"studuino"` なら Studuino モードの作品。読みこんだらそのモードで開く。キーが無い・`mode` が
  ほかの値なら通常モード。
- `ports`: 割り当てたポートだけを書く（未選択のポートは書かない）。値は上の「部品の内部の名前」。
- `calibration`: はじめの値（DC モーター 100・サーボ 0）のものは省いてよい。
- `version`: 形を変えるときに上げる。知らない `version` は読みこめるところだけ読み、通常モードで開いて知らせる（案）。
- 書く場所は upstream のファイル（scratch-vm の `serialization/sb3.js`）。**マーカーつきで小さく足す**
  （`docs/maintenance/smalruby-markers-vm.md` に載せる）。
- 本家の Scratch は知らないキーを無視して読む（保存し直すと消える）。

## Ruby（S3）

Studuino モードでも Ruby で書ける。ポートの設定は `class Studuino` の中で部品を宣言し、
プログラムは `studuino.<部品>` で呼ぶ（S3 = 案 A）。

### 宣言のシンボルの決め方（このページで決める）

S2 で「部品の名前は自由につけず、ポートに対して部品の名前をドロップダウンから選ぶ」に決まったので、
案 A の例 `light_sensor :brightness, port: :A6` の `:brightness`（利用者がつける名前）は使えない。
次の 3 つを比べた。

| 案 | 宣言 | 呼び出し | よいところ | 困るところ |
|---|---|---|---|---|
| **1（採用）** | `light_sensor :A6` | `studuino.light_sensor_a6` | 1 つの情報（部品とポート）を 1 回だけ書く。呼び出しは「`studuino.<部品>`」の形のまま。ブロックの表示「光センサー (A6)」と 1 対 1 | 呼び出しの名前は宣言から機械的に作られる（規則を docs と変換器で持つ） |
| 2 | `light_sensor :light_sensor_a6, port: :A6` | `studuino.light_sensor_a6` | 案 A の形そのまま | 同じことを 2 回書く。シンボルが規則に合わないときのエラーが要る |
| 3 | `light_sensor :A6` | `studuino.light_sensor(:A6)` | 呼び出しにポートが見える | 呼び出しが「部品のメソッド」でなくなる（案 B に近い） |

**案 1 を採用する。**

- **宣言**: `class Studuino` の中に、部品ごとに `<部品の内部の名前> :<ポート>` を 1 行ずつ書く。
- **呼び出しの名前**: `<部品の内部の名前>_<ポートの小文字>`（例 `light_sensor_a6`、`dc_motor_m1`、`servo_motor_d9`）。
  宣言から機械的に決まるので、利用者は名前を考えない。
- **補正値**: 宣言の後ろのキーワード引数で書く。はじめの値のときは書かない。
  `dc_motor :M1, calibration: 90` / `servo_motor :D9, calibration: -5`
- **将来**: 自由な名前を許すことになったら、`light_sensor :A6, name: :brightness` のように後ろに足せる（いまの書き方はそのまま読める）。

### 例

```ruby
class Studuino
  dc_motor :M1
  dc_motor :M2, calibration: 90
  servo_motor :D9
  led :A0
  light_sensor :A6
  touch_sensor :A2
end

when_flag_clicked do
  loop do
    if studuino.light_sensor_a6 < 300
      studuino.led_a0.on
    else
      studuino.led_a0.off
    end
    if studuino.touch_sensor_a2.pressed?
      studuino.servo_motor_d9.angle = 90
      studuino.dc_motor_m1.speed = 200
      studuino.dc_motor_m1.forward
      sleep(1)
      studuino.dc_motor_m1.brake
    end
  end
end
```

### 部品の呼び出し（案。#2218 で決める）

| 部品 | 呼び出し | 構文木の op |
|---|---|---|
| DC モーター | `.speed = n` / `.forward` / `.backward` / `.brake` / `.coast` | `dc_motor_speed` / `dc_motor_dir` / `dc_motor_stop` |
| サーボモーター | `.angle = n` | `servo` |
| （まとめて） | `studuino.servo_motors(d9: 90, d10: 45)` | `servo_multi` |
| LED | `.on` / `.off` | `led` |
| ブザー | `.on(pitch)` / `.off` | `buzzer_on` / `buzzer_off` |
| 光・音・赤外線フォトリフレクタ・温度センサー | 値（例 `studuino.light_sensor_a6`） | `sensor` |
| タッチセンサー・ボタン | `.pressed?` | `button` |

### 決まりごと

- `class Studuino` は **ステージのスクリプトの先頭に 1 つだけ**。Ruby → ブロックの変換では、この class を読んで
  ポートの設定（`extensionStorage`）を置きかえ、ブロックには出さない。ブロック → Ruby では保存されたポートの
  設定から class を作る。
- **`class Studuino` がある Ruby は Studuino モードの作品** として扱う。
- 通常モードの書き出しも `studuino.` になる（[`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) の
  「Ruby の書き方」）。名前はぶつからない（通常モードは `studuino.action(...)` / `studuino.sensor_value(...)` などの
  メソッド、Studuino モードは `studuino.<部品>_<ポート>` の部品）。モードに合わない呼び出しは、使えないブロックと
  同じ扱いでエラーにする。
- 宣言していないポートの部品を呼んだら（`studuino.led_a1` で A1 を宣言していない）、変換のエラーにする。
- 「旗が押されたとき」は既存の `when_flag_clicked do` のまま。2 つ以上なら警告（M4）。
- いまの Ruby v2 には `@ruby:class:` のコメントで class の情報を持つ前例がある。Studuino の class は保存の形が
  `extensionStorage` なので、コメントには持たない。

## 構文木（Studuino IR・S6）

ブラウザがブロックから作り、Lambda に送る JSON。**数値と真偽だけ** を扱う（変数は数値。文字列は使えないブロック扱い）。

### 全体

```json
{
  "version": 1,
  "board": "studuino",
  "ports": { "M1": "dc_motor", "D9": "servo_motor", "A0": "led", "A6": "light_sensor", "A2": "touch_sensor" },
  "calibration": { "dcMotor": { "M1": 100, "M2": 100 }, "servoMotor": { "D9": 0 } },
  "variables": [{ "id": "v0", "init": 0 }],
  "main": [
    { "op": "forever", "body": [
      { "op": "if",
        "cond": { "op": "<", "a": { "op": "sensor", "kind": "light_sensor", "port": "A6" }, "b": { "num": 300 } },
        "then": [{ "op": "led", "port": "A0", "on": true }],
        "else": [{ "op": "led", "port": "A0", "on": false }] },
      { "op": "change", "var": "v0", "by": { "num": 1 } },
      { "op": "wait", "secs": { "num": 0.5 } }
    ] }
  ]
}
```

- `main`: 「旗が押されたとき」の下の文の配列。
- 文は `op` を持つオブジェクト。式は `{ "num": <数値> }` / `{ "bool": <真偽> }` / `{ "var": "<変数の ID>" }` /
  `{ "op": ..., ... }` のどれか。
- **変数の ID は `v0`, `v1`, … にブラウザが置きかえる**。変数の名前（利用者の文字列）は送らない。
  ブロックの ID・座標・コメントも送らない（大きさを小さくし、作品の情報を出さない）。
- ポートの名前は `D2`〜`D12` / `M1` / `M2` / `A0`〜`A7` だけ。部品の種類は上の「部品の内部の名前」だけ。
- 第 2 弾で `lists`（数値のリスト）と `functions`（定義）を足す。第 1 弾の Lambda は、この 2 つがあれば拒否する。
- `version` が知らない値なら Lambda は拒否する。

### 文の op と C++ の書き出し

`board` は `Studuino board;`（グローバルに 1 つ）。`E(x)` は式 `x` の書き出し。`P(port)` は下の「ポートの定数の表」。

| op | フィールド | C++ |
|---|---|---|
| `wait` | `secs` | `board.Timer(E(secs));` |
| `repeat` | `times`, `body` | `for (long i = 0, n = sr_round(E(times)); i < n; i++) { body }` |
| `forever` | `body` | `for (;;) { body }` |
| `if` | `cond`, `then`, `else`（省略可） | `if (E(cond)) { then } else { else }` |
| `wait_until` | `cond` | `while (!E(cond)) { }` |
| `repeat_until` | `cond`, `body` | `while (!E(cond)) { body }` |
| `set` | `var`, `value` | `v0 = E(value);` |
| `change` | `var`, `by` | `v0 += E(by);` |
| `timer_reset` | — | `sr_timer_start = millis();` |
| `dc_motor_speed` | `port`, `speed` | `board.DCMotorPower(P(port), sr_clamp(E(speed), 0, 255));` |
| `dc_motor_dir` | `port`, `dir`（`normal` / `reverse`） | `board.DCMotorControl(P(port), NORMAL);` / `REVERSE` |
| `dc_motor_stop` | `port`, `mode`（`brake` / `coast`） | `board.DCMotorControl(P(port), BRAKE);` / `COAST` |
| `servo` | `port`, `angle` | `board.Servomotor(P(port), sr_clamp(E(angle), 0, 180));` |
| `servo_multi` | `items: [{port, angle}]`, `msPerDegree`（省略可） | `board.AsyncServomotors(ports, degrees, n);`（`msPerDegree` があれば `SyncServomotors`。3 以上） |
| `led` | `port`, `on` | `board.LED(P(port), ON);` / `OFF` |
| `buzzer_on` | `port`, `pitch` | `board.BuzzerControl(P(port), ON, sr_clamp(E(pitch), 130, 4186));` |
| `buzzer_off` | `port` | `board.BuzzerControl(P(port), OFF, 0);` |

### 式の op と C++ の書き出し

| op | フィールド | 型 | C++ |
|---|---|---|---|
| `+` `-` `*` `/` | `a`, `b` | 数値 | `(E(a) + E(b))` など |
| `%` | `a`, `b` | 数値 | `sr_mod(E(a), E(b))`（Scratch と同じく、割る数の符号にそろえる） |
| `round` | `a` | 数値 | `sr_round(E(a))`（Scratch と同じく 0.5 は切り上げ） |
| `random` | `a`, `b` | 数値 | `sr_random(E(a), E(b))`（両方が整数なら整数、そうでなければ小数。Scratch と同じ） |
| `<` `>` `=` | `a`, `b` | 真偽 | `(E(a) < E(b))` など |
| `and` `or` | `a`, `b` | 真偽 | `(E(a) && E(b))` / `(E(a) \|\| E(b))` |
| `not` | `a` | 真偽 | `(!E(a))` |
| `sensor` | `kind`, `port` | 数値 | `light_sensor` → `board.GetLightSensorValue(P(port))`、`sound_sensor` → `GetSoundSensorValue`、`ir_photoreflector` → `GetIRPhotoreflectorValue`、`temperature_sensor` → `GetTemperatureSensorValue`（どれも 0〜1023） |
| `button` | `kind`, `port` | 真偽 | `touch_sensor` → `(board.GetTouchSensorValue(P(port)) == 0)`、`push_switch` → `(board.GetPushSwitchValue(P(port)) == 0)`（**0 が「押した」なので反転する**） |
| `timer` | — | 数値 | `((millis() - sr_timer_start) / 1000.0)`（ライブラリにタイマーが無いので `millis()` で作る） |

- `sr_*` は、Lambda が C++ の先頭に入れる小さな補助関数（Scratch の計算の決まりに合わせるため）。
- 型の検査（数値の所に真偽を入れていないか）は Lambda でも行う。ブラウザでは、Scratch の真偽を数値の所に
  入れたブロック（`<>` を `( )` に入れる）を、0 / 1 に変える op を足すか使えないブロックにするかを #2217 で決める。
- 温度は生の値（0〜1023）を返す。摂氏にするブロックを足すかは第 1 弾では決めない
  （摂氏 = ((値 ÷ 1024 × 3.3) − 0.5) ÷ 0.01）。

### ポートの定数の表

ライブラリのポートの定数は種類ごとに番号が重なる（`PORT_D9` = 0 = `PORT_M1` = `PORT_A0`）。
**構文木のポート名から定数の名前への表** で書き出し、数値で書かない。

| ポート名 | 定数 | 使う部品 |
|---|---|---|
| `D2` `D4` `D7` `D8` `D9` `D10` `D11` `D12` | `PORT_D2` 〜 `PORT_D12` | サーボモーター |
| `M1` `M2` | `PORT_M1` `PORT_M2` | DC モーター |
| `A0` 〜 `A7` | `PORT_A0` 〜 `PORT_A7` | センサー・LED・ブザー・ボタン |

### C++ の全体の形

- include: `Arduino.h`・`Servo.h`・`Wire.h`・`MMA8653.h`・`MPU6050.h`・`IRremoteForStuduino.h`・`ColorSensor.h`・`Studuino.h`
  （本体が include するので、使わない部品のものも要る）。
- `setup()` で、`ports` からポートを初期化（`InitDCMotorPort` / `InitServomotorPort` / `InitSensorPort(port, PID…)`）し、
  補正値を設定し、`sr_timer_start = millis();` のあと `main` を **1 回** 実行する。`loop()` は空。
  `main` が終われば、そこで止まる（Scratch のスクリプトが終わったのと同じ）。
- 変数は `double` のグローバル（AVR では `double` は 4 バイトの `float` と同じ）。RAM が小さいので
  （ATmega168PA は 1KB）、変数の数・入れ子の深さに上限をつける（下の「上限」）。

## Lambda の API（S8・S12）

Lambda は arduino-cli と Studuino のボード定義・ライブラリを入れた **コンテナの Lambda**（API Gateway 経由・ログインなし）。
構文木 → C++ の書き出しは **Lambda で行う**（S8）。知らない op は拒否し、利用者の文字列は C++ に入らない。

> 詳細（スタック名・エンドポイントの名前・ボード定義の FQBN）は 🧱 infra の sub-issue（#2209・#2210）で決め、
> `infra/` 側の docs に書く。このページは GUI と Lambda の約束だけを書く。

### リクエスト

```
POST <エンドポイント>/compile
Content-Type: application/json

{ "ir": { ...構文木... } }
```

- 呼べるのは smalruby.app・開発環境・ブランチプレビューの Origin だけ（ほかの Lambda と同じ）。
- エンドポイントは webpack で埋めこむ環境変数にする（名前は案 `STUDUINO_COMPILE_ENDPOINT`）。足したら
  `.github/workflows/ci-cd.yml` の 2 つのビルドにも足す（`.claude/rules/env-file.md`）。

### レスポンス

成功（200）:

```json
{
  "hex": ":100000000C94...\n:00000001FF\n",
  "size": 9876,
  "maxSize": 14336,
  "source": "#include <Arduino.h>\n...",
  "toolchain": { "arduinoCli": "x.y.z", "studuinoLib": "<ライブラリのハッシュ>" }
}
```

- `hex`: Intel HEX の文字列。ブラウザはそのまま書きこむ。
- `source`: 生成した C++。**画面には出さない**（S9）が、ソースの入手のために保存できるようにする（下の「ライセンス」）。
- `toolchain`: どの版で作ったか（問い合わせ・再現のため）。

失敗:

| HTTP | `error` | いつ |
|---|---|---|
| 400 | `invalid_ir` | スキーマに合わない・知らない op / ポート / 部品・型が合わない。`path`（どこがおかしいか）をつける |
| 403 | `forbidden_origin` | 許していない Origin |
| 413 | `too_large` | 構文木の大きさ・ノードの数・深さの上限をこえた |
| 422 | `compile_failed` | コンパイルに失敗した（プログラムが大きすぎてフラッシュに入らないときも。`reason: "flash_overflow"`） |
| 429 | `rate_limited` | IP ごとの回数の上限をこえた。`retryAfter`（秒）をつける |
| 504 | `timeout` | コンパイルが時間の上限をこえた |
| 500 | `internal` | それ以外 |

- 失敗の本文は `{ "error": "<上の名前>", "message": "<人が読む説明>", ... }`。コンパイラの生の出力は返さない
  （Lambda のログにだけ残す）。

### 上限（S12）

まず大きめにとり、**計測できるようにする**（ほとんど使われない機能なので、実際の値を見て決め直す）。

| 項目 | はじめの値 |
|---|---|
| 構文木の大きさ | 128KB |
| ノードの数 | 10,000 個 |
| 入れ子の深さ | 100 |
| コンパイルの時間 | 60 秒で打ち切り（まず測ってから決め直す） |
| IP ごとの回数 | 1 分 12 回・1 日 600 回 |

- 学校は NAT で IP が同じになるので、IP ごとの上限は厳しくしすぎない。
- 計測すること: 回数・構文木の大きさ・ノードの数・コンパイルの時間・hex の大きさ・失敗の種類。

## 書きこみの流れ（S13・M4・M7）

### 書きこむ

1 つのボタン → 1 つのモーダルで、**検査 → hex を作る → 書きこむ** の進み具合を出す。

1. **検査**（ブラウザ）: 「旗が押されたとき」が 1 つだけか（M4）、使えないブロックが無いか（M6）。
   だめならモーダルに理由と［ブロックを見る］を出して止める。
2. **hex を作る**: 構文木を作って Lambda に送る。失敗なら、上の `error` ごとの言葉で知らせる。
3. **書きこむ**: 基板が選ばれていなければ、シリアルポートを選んでもらい、いまのファームウェアの書きこみと
   同じ仕組み（Web Serial・STK500v1）で hex を書きこむ。
4. 終わったら「USB を抜いて電池をつなぐと動きます」と出す。

- モーダルには「使っているライブラリとライセンス（ソースの入手方法）」のリンクを置く（下の「ライセンス」）。
- hex のダウンロード（他の書きこみツール用）は第 1 弾では作らない。

### 緑の旗と停止

Studuino モードでは、ステージの緑の旗・停止は意味を持たない（プログラムはブラウザでは動かさない）。そのため:

- **緑の旗 = 書きこみ**（上のモーダルを開いて始める）
- **停止 = 書きこみの中断**（hex を作っている途中なら待つのをやめ、書きこみの途中なら書きこみを止める）

書きこみを途中で止めた基板は、もう一度書きこむか、ファームウェアに戻せば使える。

### ファームウェアに戻す（M7）

Studuino モードで書きこむと、パソコンから操作するためのプログラム（ファームウェア）は上書きされる。

- 通常モードで Studuino につないだとき、ファームウェアでないと分かったら
  「パソコンから操作するためのプログラムを書きもどしますか」と出し、**ボタン 1 つで** 書きもどす。
- 書きもどしは、いまのファームウェアの書きこみ（[`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) の
  「ファームウェアフラッシュ」）をそのまま使う。

## ライブラリとライセンス（S7）

生成した C++ が呼ぶのは、アーテック社が公開している **Studuino ライブラリ**（`studuino_v1_lib`）。
ライブラリのファイルは **リポジトリにも GitHub にも入れない**。Lambda のコンテナを作るときに取得する
（入手元とハッシュを固定する）。

### 使うライブラリ

| フォルダ | 中身 | ライセンスの表記 | 著作権者 |
|---|---|---|---|
| `Studuino` | 本体 | `Studuino.cpp` に GPL-2.0-or-later（ヘッダには表記なし） | Artec Corporation |
| `MMA8653` | 加速度センサー（本体が include） | GPL-2.0-or-later | Akafugu Corporation |
| `MPU6050` | ジャイロ（本体が include） | MIT | Jeff Rowberg |
| `IRremoteForStuduino` | 赤外線リモコン受信（本体が include） | LGPL-2.1 | Ken Shirriff ほか（アーテック社が改変） |
| `ColorSensor` | カラーセンサー（本体が include） | 表記なし | 不明 |

ほかの 4 つ（`BusIOForStuduino`・`MSA301ForStuduino`・`Clock`・`Adafruit_CircuitPlayground`）は使わないので、コンテナに入れない。
ボード定義（arduino-cli の FQBN・クロック・ブートローダ）は zip に無いので、人間の手元の Arduino IDE 用の設定から
#2209 で決める（いまのファームウェアは ATmega168PA 向け）。

### hex を返すときのソースの入手方法

Lambda が返す hex は、GPL のライブラリと利用者のプログラムを静的にリンクしたもの。これを利用者に渡すのは
**オブジェクトコードの頒布** にあたるので、**対応するソースを入手できるようにする**。

- **ライブラリのソース**: 書きこみのモーダルの「使っているライブラリとライセンス」から、使ったライブラリの版（ハッシュ）・
  ライセンス・入手先を示す。入手先はアーテック社の公式の配布元を使う（配布元が無いときの扱いは「人間・実装で決めること」）。
- **そのプログラムから生成した C++**: Lambda は hex と一緒に C++（`source`）を返す。画面には出さない（S9）が、
  モーダルから保存できるようにする。
- **Lambda のコード**（構文木の検査と C++ の書き出し）: スモウルビーのリポジトリ（AGPL-3.0）で公開する。
- GPL-2.0-or-later は GPLv3 として使え、GPLv3 は AGPL-3.0 と組み合わせられる。ライブラリをリポジトリに入れないのは、
  リポジトリを軽く保ち、ライブラリのライセンスの表示をライブラリ側のまま扱うため。

### アーテック社への確認

アーテック社への連絡は **リリースのあと**、動くものができてから「連携できた」報告として行う（人間の作業）。
prod に出す前に回答を待つ必要は無い。

- 表記の無いファイル（`Studuino.h` などのヘッダ・`ColorSensor`）のライセンスは、その報告のときに聞く。
- サーバー（Lambda）でコンパイルして hex を返すことは、聞くのではなく報告として伝える。
- ライブラリのソースの入手先は、アーテック社の公式の配布元
  （<https://www.artec-kk.co.jp/studuino/ja/arduino.php>）を案内する。
- ボードの設定は、スモウルビーの既存の書きこみの実装（アーテック社の技術者のサポートとコードの提供で作ったもの）を
  一次情報として決め、実機で確かめる。

## 名前・見た目（S14）

- できること（機能・ポートと部品の対応）は本家に合わせる。
- 文言は一般名詞（光センサー・サーボモーターなど）をスモウルビーの言い回しで書く。本家の文言・画面・ロゴ・写真は写さない。
- アイコン・基板の絵・入出力の設定の画面は独自に描く。
- 「Studuino」は **対応する機種の名前** として使い、アーテック社の製品だと分かるようにする。名前を出す画面
  （モードの入り口・書きこみのモーダル・ライブラリとライセンスの案内）には、商標の表記
  「Studuino®（スタディーノ）は株式会社アーテックの登録商標です」を入れる。
- Studuino を悪いことに使ったり、自分たちのもののように見せたりしない。

## 作る順番（sub-issue）

実装は Studuino の拡張機能のリニューアル（#2162）のあと。🧱 infra の Lambda だけは並行して先に作ってよい。

| 範囲 | このページの節 |
|---|---|
| 🧱 hex を作る Lambda の土台（コンテナ・API Gateway・Origin 制限・上限・計測） | Lambda の API・上限・ライブラリとライセンス |
| 🧱 構文木の検査と C++ の書き出し | 構文木 |
| 状態とポートの設定の保存 | 保存の形 |
| 入り方とパレット | モードの入り方・第 1 弾のブロック |
| ポートの設定のモーダル | ポートの設定 |
| 使えないブロックの印とモード切替の確認 | 使えないブロック・モード切替の条件 |
| 専用の部品のブロック | 第 1 弾のブロック・ポートの設定 |
| 構文木の生成 | 構文木 |
| Ruby | Ruby |
| 書きこみの体験 | 書きこみの流れ・ライブラリとライセンス |

## 人間・実装で決めること

- `extensionStorage` のキーと、部品のブロックをどの拡張機能に置くか（Studuino の拡張機能 `smalrubotS1` に
  Studuino モード専用の opcode を足すか、別の拡張機能にするか）。#2212・#2216。
- 補正値を入出力の設定のどこで変えるか。#2215。
- タッチセンサーを真偽のブロックにするか（本家は丸い値のブロック）。#2216。

## 主要ファイル

まだ無い（実装したら足す）。参考にする、いまあるファイル:

- `packages/scratch-gui/src/lib/smalrubot-firmware-flasher.js` — Web Serial・STK500v1 の書きこみ
- `packages/scratch-gui/src/lib/smalrubot-firmware.hex.js` — ファームウェア（書きもどしに使う）
- `packages/scratch-vm/src/extensions/scratch3_smalrubot_s1/` — Studuino の拡張機能
- `packages/scratch-vm/src/serialization/sb3.js` — `extensionStorage` を足す所（upstream のファイル）

## 関連ドキュメント

- [`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) — Studuino の拡張機能（通常モード・ファームウェアの書きこみ）
- [`docs/dncl/policy.md`](../dncl/policy.md) — 使える書き方を限り、警告を出す前例（日本語モード）
- [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) — 拡張機能の Ruby 表現
- `docs/maintenance/smalruby-markers-vm.md` — upstream マーカー一覧（`sb3.js` に足したら更新）
