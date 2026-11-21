# Studuino モード（設計）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

- **Smalruby ランタイム対応**: ❌（smalruby3 gem では動かない。プログラムを hex にして Studuino に書きこむ、ブラウザ専用の機能）
- **デフォルト表示**: —（拡張機能ではなく「動かし方」。アーテックロボ（Studuino）の拡張機能の中で選ぶ）

> **🚧 このページは設計で、実装の途中**。「実装」と書いたところは実装済み。このあとの sub-issue
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

### 拡張機能は 1 つ（M1〜M4）

- 拡張機能は **アーテックロボ（Studuino）1 つ**（`smalrubotS1`）。Studuino モードを別の拡張機能にしない。
  違いは **動かし方** だけで、「つないで動かす（通常モード）」と「Studuino に書きこむ（Studuino モード）」を
  拡張機能の中で選ぶ。
- **ブロックは 1 組**。ポートを選べる部品のブロックは、どちらの動かし方でも使う（通常モードで動かすときに
  ファームウェアのコマンドで足りるかは、部品のブロックの sub-issue で確かめる）。書きこまないと動かないものだけ、
  Studuino モードのときにパレットに出す。
- **ポートの設定は 1 つ**（動かし方にかかわらず）。既定は教科書のロボットカーの配線。いまのブロック
  （ポートが決まっているもの）もこの設定を使い、練習用の基板も同じ設定で表示する。
- Ruby は `studuino.`（ふりがなは「アーテックロボ」）。

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
- **実装**: メニューバーの「アーテックロボ」のメニュー（拡張機能を読みこむと出る）の 1 つ目の項目。
  通常モードでは「Studuino モード（Studuino に書きこむ）」、Studuino モードでは「通常モード（つないで動かす）にもどす」
  （`data-testid="menu-smalrubot-s1-studuino-mode"`）。このメニューは **Web Serial の無いブラウザでも出す**
  （モードから出られなくならないように。ファームウェアの書きこみの項目だけを Web Serial のあるときに出す）。
- モードは VM の設定（`extensionStorage` の `mode`）にあり、作品に保存される。作品を読みこんで `mode` が
  `studuino` なら、そのモードで開く。そのとき拡張機能を読みこんでいなければ GUI が読みこむ（メニューを出すため）。
- GUI で「いま Studuino モードか」は redux の selector `isStuduinoMode(state)`（`reducers/studuino-mode.js`）で
  判定する。緑の旗＝書きこみ・停止＝中断（書きこみの体験）もこれを見る。
- 第 1 弾では、モードを切り替えるときに使えないブロックの検査・確認のダイアログはまだ無い（使えないブロックの印と
  モード切替の確認で足す）。パレットの切り替えだけを行う。
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

- **使えないブロックがあると、Studuino モードに変えられない**（通常 → Studuino）。
  - 通常のブロック（見た目など）が残っていると切り替えられない。
  - Studuino → 通常は、ブロックが 1 組なので、書きこまないと動かないブロックを使っていなければそのまま切り替わる。
- 切り替えを選んだとき、使えないブロックがあれば次のダイアログを出す:
  - 本文:「使えないブロックが n 個あるので切り替えられません」
  - ボタン: ［ブロックを見る］［すべて消して切り替える］［やめる］
- ［すべて消して切り替える］は **新規と同じふるまい** ですべてのブロックを消して切り替える。
  保存していない変更があれば、新規と同じ確認を先に出す。
- 使えないブロックが無ければ、そのまま切り替わる。

## 第 1 弾のブロック（S1）

第 1 弾は **部品のブロック＋制御・演算・変数（数値）**。部品のブロックは、入出力の設定で割り当てた部品の
ぶんだけパレットに出る（M3）。できること（機能・ポートと部品の対応）は本家（アーテック社の Web アプリ）に
合わせ、文言は一般名詞をスモウルビーの言い回しで書く（S14）。下の「表示」は日本語の文言の要約（実際の文言は `ja.js` / `ja-Hira.js` の `smalrubotS1.studuino.*`）。

### 部品のブロック（Studuino モード専用・新しく作る）

opcode は拡張機能 `smalrubotS1` のブロック（実行時は `smalrubotS1_<opcode>`）。引数の名前とメニューの値は、
構文木の生成（#2217）と Ruby（#2218）が使う約束。ポートの引数 `PORT` の値はポート名（`A6` など）。

| 種類 | 表示（案） | opcode（引数） | 対応する部品 | 構文木の op |
|---|---|---|---|---|
| 文 | DC モーター [ポート] の速さを (n) にする | `studuinoDcMotorSpeed`（`PORT`, `SPEED`） | DC モーター | `dc_motor_speed` |
| 文 | DC モーター [ポート] を [正転 / 逆転] で回す | `studuinoDcMotorDirection`（`PORT`, `DIRECTION`: `normal` / `reverse`） | DC モーター | `dc_motor_dir` |
| 文 | DC モーター [ポート] を [ブレーキ / 惰性] で止める | `studuinoDcMotorStop`（`PORT`, `MODE`: `brake` / `coast`） | DC モーター | `dc_motor_stop` |
| 文 | サーボモーター [ポート] を (n) 度にする | `studuinoServo`（`PORT`, `ANGLE`） | サーボモーター | `servo` |
| 文 | サーボモーター [ポート] を (n) 度、[ポート] を (n) 度に同時に動かす | `studuinoServoPair`（`PORT1`, `ANGLE1`, `PORT2`, `ANGLE2`） | サーボモーター（2 個以上） | `servo_multi`（2 つ。同じポートなら使えないブロック） |
| 文 | LED [ポート] を [オン / オフ] にする | `studuinoLed`（`PORT`, `STATE`: `on` / `off`） | LED | `led` |
| 文 | ブザー [ポート] を (音の高さ) で鳴らす | `studuinoBuzzerOn`（`PORT`, `PITCH`。Hz） | ブザー | `buzzer_on` |
| 文 | ブザー [ポート] を止める | `studuinoBuzzerOff`（`PORT`） | ブザー | `buzzer_off` |
| 値 | 光センサー [ポート] | `studuinoLightSensor`（`PORT`） | 光センサー | `sensor`（`kind: light_sensor`） |
| 値 | 音センサー [ポート] | `studuinoSoundSensor`（`PORT`） | 音センサー | `sensor`（`kind: sound_sensor`） |
| 値 | 赤外線フォトリフレクタ [ポート] | `studuinoIrPhotoreflector`（`PORT`） | 赤外線フォトリフレクタ | `sensor`（`kind: ir_photoreflector`） |
| 値 | 温度センサー [ポート] | `studuinoTemperatureSensor`（`PORT`） | 温度センサー | `sensor`（`kind: temperature_sensor`） |
| 真偽 | タッチセンサー [ポート] が押された | `studuinoTouchSensorPressed`（`PORT`） | タッチセンサー | `button`（`kind: touch_sensor`） |
| 真偽 | ボタン [ポート] が押された | `studuinoButtonPressed`（`PORT`） | ボタン（基板の十字ボタン） | `button`（`kind: push_switch`） |

- 「割り当てたサーボモーターをまとめて動かす」は、Scratch のブロックは引数の数を変えられないので、
  **2 つを同時に動かすブロック**にした（3 つ以上はこのブロックを続けて置く。構文木の `servo_multi` は 8 つまで受け付ける）。
- [ポート] のドロップダウンには、**その部品を割り当てたポートだけ** を「光センサー (A6)」のように
  部品とポートが分かる形で出す（S2）。
  割り当てが無いときは、空の値の項目（部品の名前だけ）を 1 つ出す（そのブロックは構文木の生成で使えないブロックになる）。
- タッチセンサーとボタンは**真偽のブロック**（`もし <タッチセンサー (A2) が押された> なら` と書ける）。本家は丸い値のブロック（0 / 1）。
- **通常モードのパレットには出さない**（E5）。VM のブロックの定義は `hideFromPalette: true` で、Studuino モードのパレットが
  アーテックロボのカテゴリ（先頭の［入出力の設定］ボタンの下）に、**割り当てた部品のブロックだけ**を、その部品の最初のポートを
  選んだ形で並べる（「2 つを同時に」はサーボモーターを 2 つ以上割り当てたとき）。
- パレットに並べるときの値: DC モーターの速さ 100（ライブラリの 0〜255）、サーボモーター 90 度、ブザー 440 Hz、
  向き = 正転、止め方 = ブレーキ、LED = オン。
- **ブラウザでブロックを押しても何もしない**（値のブロックは 0 / 偽を返す）。Studuino モードではプログラムはブラウザで
  動かさず、緑の旗 = 書きこみ（S13）。練習用の基板で試すことは第 1 弾ではしない。
- 加速度センサー（I2C・A4/A5）・カラーセンサー・赤外線リモコンは第 1 弾では扱わない。

### 標準のブロック（Scratch のブロックをそのまま使う）

| カテゴリ | ブロック（opcode） |
|---|---|
| イベント | 旗が押されたとき（`event_whenflagclicked`）。**1 つだけ**（M4） |
| 制御 | `control_wait` / `control_repeat` / `control_forever` / `control_if` / `control_if_else` / `control_wait_until` / `control_repeat_until` |
| 演算 | `operator_add` / `operator_subtract` / `operator_multiply` / `operator_divide` / `operator_random` / `operator_gt` / `operator_lt` / `operator_equals` / `operator_and` / `operator_or` / `operator_not` / `operator_mod` / `operator_round` |
| 調べる | `sensing_timer` / `sensing_resettimer` |
| 変数 | `data_setvariableto` / `data_changevariableby` / `data_variable`（**数値だけ**） |

- この一覧の正は `packages/scratch-gui/src/lib/studuino-mode.js` の `STUDUINO_ALLOWED_BLOCKS`
  （パレットの絞り込みも、使えないブロックの印も、この一覧を使う。部品のブロックはここに足す）。
- パレット: 上のカテゴリだけを出す。「変数」は「変数を作る」と数値の変数のブロック（表示・非表示は出さない）だけ、
  リスト・「ブロック定義」・拡張機能のカテゴリ（アーテックロボを含む）は出さない。いまのアーテックロボのブロック
  （ポートが決まっている通常モードのもの）は書きこみでは使わないので出さない。部品のブロックができたら、
  アーテックロボのカテゴリに部品のブロックだけを出す。
- パレットの絞り込みは日本語モード・レッスンのチャレンジより優先する（作品で使えるのがこのブロックだけのため）。
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

- どのポートも「つながない」（未選択）を選べる。はじめはロボットカーの配線（下の「保存の形」）。
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

### 入出力の設定のモーダル（実装）

- 開き方は 3 つ: Studuino モードのパレットの先頭の「アーテックロボ」のカテゴリの［入出力の設定］ボタン
  （「変数を作る」と同じ形のボタン）、モードに入った直後に自動で 1 回、メニューバーの「アーテックロボ」の
  メニューの「入出力の設定」（通常モードでも開ける。ポートの設定は動かし方にかかわらず 1 つ）。
- 左の列に D2〜D12・M1・M2、まん中に基板の絵（独自の簡単な絵）、右の列に A0〜A7。各ポートの行に、
  そのポートで選べる部品と「つながない」のドロップダウン。
- ［すべて未選択にする］はすべてのポートを「つながない」にする（補正値も消える）。［割り当て］で保存して閉じる。
  ×で閉じると、変えた内容は捨てる（保存は［割り当て］だけ）。
- 下に商標の表記（「Studuino®（スタディーノ）は株式会社アーテックの登録商標です。」）。

| data-testid | 要素 |
|---|---|
| `menu-smalrubot-s1-studuino-mode` | メニューの「Studuino モード」／「通常モードにもどす」 |
| `menu-smalrubot-s1-port-settings` | メニューの「入出力の設定」 |
| `studuino-port-settings-modal` | モーダルの本文 |
| `studuino-port-settings-port-<ポート>` | ポートのドロップダウン（ポートは小文字。例 `-d9`・`-a6`） |
| `studuino-port-settings-calibration-<ポート>` | 補正値の入力（`-m1`・`-d9` など） |
| `studuino-port-settings-clear-all` | ［すべて未選択にする］ |
| `studuino-port-settings-assign` | ［割り当て］ |

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
- 入出力の設定のモーダルで変えられる。**置き場所は、そのポートの行のドロップダウンの右**（そのポートに
  DC モーター・サーボモーターを選んだときだけ数の入力が出る）。部品を変えたり外したりすると、そのポートの補正値は
  はじめの値にもどる（前の部品の補正値を引き継がない）。範囲の外の値は範囲に収め、整数に丸める。
- 書きこみのとき、構文木の `calibration` に入れ、C++ の `SetDCMotorCalibration` / `SetServomotorCalibration` になる。

## 保存の形（S10）

プロジェクトの JSON（`project.json`）に **`extensionStorage`**（TurboWarp と同じ形）を足し、
ポートの設定・補正値・Studuino モードかどうかを入れる。

```json
{
  "targets": [ ... ],
  "meta": { ... },
  "extensionStorage": {
    "smalrubotS1": {
      "version": 1,
      "mode": "studuino",
      "ports": { "D9": "servo_motor", "M1": "dc_motor", "A0": "led", "A6": "light_sensor" },
      "calibration": {
        "dcMotor": { "M2": 90 },
        "servoMotor": { "D9": -5 }
      }
    }
  }
}
```

- 置き場所はトップレベル（ステージの target ではない）。Studuino の設定は作品に 1 つだけなので。
- キーは拡張機能の ID（`smalrubotS1`）。TurboWarp の `extensionStorage` も拡張機能の ID をキーにする。
- **既定の設定（通常モード・ロボットカーの配線・補正なし）と同じなら書かない**。通常の作品の project.json は変わらない。
  ロボットカーの配線: M1・M2 = DC モーター、D10 = サーボモーター、A0・A1 = LED、A2 = タッチセンサー、
  A4・A5 = 赤外線フォトリフレクタ、A6 = 光センサー、A7 = 音センサー。
- `mode`: `"studuino"` なら Studuino モードの作品。読みこんだらそのモードで開く。キーが無い・`mode` が
  ほかの値なら通常モード。
- `ports`: 割り当てたポートだけを、ポートの表の順（D2〜D12・M1・M2・A0〜A7）に書く。値は上の「部品の内部の名前」。
  `ports` が無いときはロボットカーの配線、`{}` なら「どこにもつながない」。知らないポート・ポートに合わない部品は読むときに捨てる。
- `calibration`: はじめの値（DC モーター 100・サーボ 0）のものは書かない。範囲の外の値は読むときに範囲に収める（整数に丸める）。
- `version`: 形を変えるときに上げる。知らない `version` は読めるところだけ読み、通常モードで開く（GUI が知らせる）。
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

### 部品の呼び出し

部品は `studuino.<部品の内部の名前>_<ポートの小文字>` で、続けて書くメソッドがブロックになる。

| 部品のブロック（opcode） | Ruby |
|---|---|
| `studuinoDcMotorSpeed`（`PORT`, `SPEED`） | `studuino.dc_motor_m1.speed = 200` |
| `studuinoDcMotorDirection`（`DIRECTION`: `normal` / `reverse`） | `studuino.dc_motor_m1.forward` / `studuino.dc_motor_m1.backward` |
| `studuinoDcMotorStop`（`MODE`: `brake` / `coast`） | `studuino.dc_motor_m1.brake` / `studuino.dc_motor_m1.coast` |
| `studuinoServo`（`PORT`, `ANGLE`） | `studuino.servo_motor_d9.angle = 90` |
| `studuinoServoPair`（`PORT1`, `ANGLE1`, `PORT2`, `ANGLE2`） | `studuino.servo_motors(d9: 90, d10: 45)`（キーはポートの小文字。ちがう 2 つ） |
| `studuinoLed`（`STATE`: `on` / `off`） | `studuino.led_a0.on` / `studuino.led_a0.off` |
| `studuinoBuzzerOn`（`PORT`, `PITCH`） | `studuino.buzzer_a1.on(440)` |
| `studuinoBuzzerOff`（`PORT`） | `studuino.buzzer_a1.off` |
| `studuinoLightSensor` / `studuinoSoundSensor` / `studuinoIrPhotoreflector` / `studuinoTemperatureSensor`（`PORT`） | `studuino.light_sensor_a6` / `studuino.sound_sensor_a7` / `studuino.ir_photoreflector_a4` / `studuino.temperature_sensor_a3`（値） |
| `studuinoTouchSensorPressed` / `studuinoButtonPressed`（`PORT`） | `studuino.touch_sensor_a2.pressed?` / `studuino.push_switch_a0.pressed?`（真偽） |

- メニューの引数（`PORT` など）は、いまはブロックのフィールドとして読み書きする（いまの拡張機能のブロックと同じ）。
  部品のブロックでメニューが影のブロックになったら、`src/lib/studuino-ruby/studuino-ruby.js` の `MENU_FORM` だけを変える。
- ポートが空の部品のブロックは、その種類の既定のポート（ロボットカーの配線など）で書き出す（`FALLBACK_PORTS`）。
- ふりがなは部品の名前とポート（`studuino.light_sensor_a6` の上に「光センサー(A6)」）。補完（スニペット）は第 1 弾では足さない。

### 決まりごと

- `class Studuino` は **ステージのスクリプトの先頭に 1 つだけ**。Ruby → ブロックの変換では、この class を読んで
  ポートの設定（`extensionStorage`）を置きかえ、ブロックには出さない。ブロック → Ruby では保存されたポートの
  設定から class を作る（ポートの表の順。はじめの値の補正値は書かない。部品が 1 つも無ければ中が空の class）。
- **`class Studuino` がある Ruby は Studuino モードの作品** として扱う（変換すると Studuino モードになる）。
- class が無いコード（スプライト、通常モード、class を消したステージ）は、**いまの作品のポートの設定を宣言とみなす**。
  ステージから class を消しても設定とモードは変わらない（通常モードに戻すのはモードの切り替えで行う）。
  Studuino モードでは、ステージの Ruby にまた class が書き出される。
- 通常モードの書き出しも `studuino.` になる（[`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) の
  「Ruby の書き方」）。名前はぶつからない（通常モードは `studuino.action(...)` / `studuino.sensor_value(...)` などの
  メソッド、Studuino モードは `studuino.<部品>_<ポート>` の部品）。
- **Studuino モードのコードで通常モードの呼び出し**（`studuino.action(...)`・`smalrubot_s1.led(...)` など）は変換のエラー
  （つないで動かすときのブロックで、Studuino モードでは使えないため）。部品の呼び出しは通常モードでも変換する
  （ブロックは 1 組・M2。使えるかの印は部品のブロックの側で決める）。
- 変換のエラー: 宣言していないポートの部品を呼んだ（`studuino.led_a1` で A1 を宣言していない）・ポートに合わない部品
  （`led :A6`・`studuino.led_a6`）・知らない部品（`lamp :A0`）・知らないポート・同じポートを 2 回宣言・部品の宣言でない行・
  範囲の外か整数でない補正値・補正値の無い部品の `calibration:`・ステージ以外や一番外でない `class Studuino`・
  `servo_motors` の引数がちがう 2 つのサーボモーターでない。
- 「旗が押されたとき」は既存の `when_flag_clicked do` のまま。2 つ以上なら警告（M4）。
- いまの Ruby v2 には `@ruby:class:` のコメントで class の情報を持つ前例がある。Studuino の class は保存の形が
  `extensionStorage` なので、コメントには持たない（`docs/ruby-editor/bridging-patterns.md` の P21）。

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
| `wait` | `secs` | `board.Timer((float)sr_clamp(E(secs), 0.0, 1000000.0));`（0 未満は 0） |
| `repeat` | `times`, `body` | `for (long sr_i0 = 0, sr_n0 = (long)sr_round(E(times)); sr_i0 < sr_n0; sr_i0++) { body }`（入れ子ごとに番号を進める） |
| `forever` | `body` | `for (;;) { body }` |
| `if` | `cond`, `then`, `else`（省略可） | `if (E(cond)) { then } else { else }` |
| `wait_until` | `cond` | `while (!E(cond)) { }` |
| `repeat_until` | `cond`, `body` | `while (!E(cond)) { body }` |
| `set` | `var`, `value` | `sr_v0 = E(value);` |
| `change` | `var`, `by` | `sr_v0 += E(by);` |
| `timer_reset` | — | `sr_timer_start = millis();` |
| `dc_motor_speed` | `port`, `speed` | `board.DCMotorPower(P(port), (byte)sr_round(sr_clamp(E(speed), 0.0, 255.0)));` |
| `dc_motor_dir` | `port`, `dir`（`normal` / `reverse`） | `board.DCMotorControl(P(port), NORMAL);` / `REVERSE` |
| `dc_motor_stop` | `port`, `mode`（`brake` / `coast`） | `board.DCMotorControl(P(port), BRAKE);` / `COAST` |
| `servo` | `port`, `angle` | `board.Servomotor(P(port), (byte)sr_round(sr_clamp(E(angle), 0.0, 180.0)));` |
| `servo_multi` | `items: [{port, angle}]`（1〜8 個・ポートは重ならない）, `msPerDegree`（省略可） | `board.AsyncServomotors(ports, degrees, n);`（`msPerDegree` があれば `SyncServomotors`。3〜255 の整数） |
| `led` | `port`, `on` | `board.LED(P(port), ON);` / `OFF` |
| `buzzer_on` | `port`, `pitch` | `board.BuzzerControl(P(port), ON, (word)sr_round(sr_clamp(E(pitch), 130.0, 4186.0)));` |
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
| `to_num` | `a`（真偽） | 数値 | `(E(a) ? 1.0 : 0.0)`（真偽のブロックを数の所に入れたとき） |
| `sensor` | `kind`, `port` | 数値 | `light_sensor` → `((double)board.GetLightSensorValue(P(port)))`、`sound_sensor` → `GetSoundSensorValue`、`ir_photoreflector` → `GetIRPhotoreflectorValue`、`temperature_sensor` → `GetTemperatureSensorValue`（どれも 0〜1023） |
| `button` | `kind`, `port` | 真偽 | `touch_sensor` → `(board.GetTouchSensorValue(P(port)) == 0)`、`push_switch` → `(board.GetPushSwitchValue(P(port)) == 0)`（**0 が「押した」なので反転する**） |
| `timer` | — | 数値 | `sr_timer()` = `(millis() - sr_timer_start) / 1000.0`（ライブラリにタイマーが無いので `millis()` で作る） |

- `sr_*` は、Lambda が C++ の先頭に入れる小さな補助関数（Scratch の計算の決まりに合わせるため）。
- 型の検査（数値の所に真偽を入れていないか）は Lambda でも行う。Scratch の真偽を数値の所に入れたブロック
  （`<>` を `( )` に入れる）のために、Lambda は `to_num` を受け付ける。ブラウザは、真偽のブロックを数の所に入れたら `to_num` にする
  （使えないブロックにはしない。Scratch と同じく真 = 1・偽 = 0）。
- 変数は C++ では `sr_v0` のように `sr_` を付ける。数値のリテラルは `300.0`・`(-3.0)` の形で書く。
- 温度は生の値（0〜1023）を返す。摂氏にするブロックを足すかは第 1 弾では決めない
  （摂氏 = ((値 ÷ 1024 × 3.3) − 0.5) ÷ 0.01）。

### ブラウザでの作り方（構文木の生成）

`packages/scratch-gui/src/lib/studuino-ir/` の純粋関数が、ステージと全スプライトのブロック
（VM の `target.blocks._blocks` の形）とポートの設定（`getStuduinoSettings(runtime)`）から構文木を作る。
Lambda の検査（`validateIr`）を必ず通る形にし、通らないものはブラウザで先に止める。

- `buildStuduinoIr({ targets, settings })` → `{ ok: true, ir }` か `{ ok: false, errors }`。
  `errors` の 1 つは `{ blockId, targetId, reason }`（GUI が「そのブロックへ移る」ために使う。上限のときは
  `detail` と `limit` も付く）。`buildStuduinoIrFromVm(vm, settings)` は VM の元の target（クローンを除く）から作る。
- `reason` は機械の名前。子ども向けの文言は、使えないブロックの印と書きこみのモーダルで付ける。

| `reason` | いつ |
|---|---|
| `no_flag` | 「旗が押されたとき」が 1 つも無い（`blockId` は null） |
| `too_many_flags` | 旗が 2 つ以上（2 つ目以降のそれぞれ） |
| `unsupported_block` | 第 1 弾のブロックでない（ほかのハット・見た目・リスト・ブロックを作る・通常モードの部品のブロックなど） |
| `string_value` | 数の所に数にできない文字がある（S6） |
| `not_boolean` | 真偽の所に数のブロックがある（Scratch では起きない） |
| `unknown_variable` | 変数が見つからない・リストの変数 |
| `port_not_assigned` | 入出力の設定で割り当てていないポート・ポートが空（S5） |
| `wrong_part` | そのポートに別の部品を割り当てている（S5） |
| `unknown_port` | ポートの名前を知らない |
| `unknown_value` | メニューの値を知らない（正転/逆転・ブレーキ/惰性・オン/オフ） |
| `duplicate_port` | 「2 つを同時に動かす」のサーボが同じポート |
| `too_large` | 上限をこえた。`detail` は `too_many_nodes` / `too_deep` / `too_many_variables` / `too_many_bytes` |

決まりごと:

- **根は旗 1 つ**（M4）。旗の下だけを書きこむ。
- **旗の下にないスクリプト**（ほかのハットの下・ばらばらのブロック）は書きこまないが、**検査はする**。
  その中に使えないブロック・文字の値・割り当てていないポートがあればエラーにする（使えないブロックの印は、
  どこにあっても同じ理由で付けるため）。使えるブロックだけのばらばらのスクリプトは、エラーにせず無視する
  （Scratch でも旗では動かないので）。
- **数の入力**: 影のリテラル（`math_number`・`text` など）は数にする。**空欄（空白だけを含む）は Scratch と同じく 0**。
  数にできない文字は `string_value`。入力そのものが無いときも 0。
- **真偽の入力**: 空（`<>` が空）は偽（`{ "bool": false }`）。
- **メニューの値**: フィールドに直接あっても、影のメニューのブロックにあっても読む（部品のブロックの形にあわせる）。
  数のメニュー（音の高さなど）の値は数として読む。
- **変数**: 旗の下で使った変数だけを、はじめて使った順に `v0`, `v1` … にする。ステージの変数と各スプライトの
  変数は別の ID。**はじめの値はいまの値が数にできればそれ、できなければ 0**（書きこむときの値。文字の値のまま
  エラーにすると、変数のモニターを直す手段が無いため）。
- `ports` と `calibration` は設定をそのまま入れる（はじめの値の補正は入れない。Lambda がはじめの値を使う）。
- **上限**はブラウザでも Lambda と同じ数字で先に止める（`src/lib/studuino-ir/limits.js`。Lambda の値を変えたら
  ここも変える）。ノードの数と深さは Lambda と同じ数え方。本文の大きさは `{"ir": ...}` の JSON の長さで見る。

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
| 変数の数 | 64 個（ATmega168PA の RAM は 1KB） |
| コンパイルの時間 | 25 秒で打ち切り（S12 の目安は 60 秒だが、API Gateway が 30 秒で切るため。まず測ってから決め直す） |
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

- 補正値を入出力の設定のどこで変えるか。#2215。
- タッチセンサーを真偽のブロックにするか（本家は丸い値のブロック）。#2216。

## 主要ファイル

- `packages/scratch-gui/src/lib/studuino-mode.js` — Studuino モードで使えるブロックの一覧（`STUDUINO_ALLOWED_BLOCKS`）・モードの切り替え（`setStuduinoMode`）
- `packages/scratch-gui/src/reducers/studuino-mode.js` — VM の設定の写しと selector（`isStuduinoMode` / `getStuduinoModeSettings`）
- `packages/scratch-gui/src/containers/studuino-mode-sync.jsx` — VM の設定を redux へ写す（`STUDUINO_SETTINGS_CHANGED`・`PROJECT_LOADED`）
- `packages/scratch-gui/src/lib/studuino-port-settings.js` — 入出力の設定の下書きを変える純粋な関数（部品・補正値・すべて未選択）
- `packages/scratch-gui/src/components/studuino-port-settings-modal/` / `src/containers/studuino-port-settings-modal.jsx` — 入出力の設定のモーダル
- `packages/scratch-gui/src/containers/blocks.jsx` — Studuino モードのパレットの絞り込みと、先頭の「アーテックロボ」のカテゴリ（［入出力の設定］ボタン）（マーカーつき）
- `packages/scratch-gui/src/components/menu-bar/menu-bar.jsx` — アーテックロボのメニューの「Studuino モード」（マーカーつき）
- `packages/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-blocks.js` — 部品のブロックの定義（`getInfo` に足す・`hideFromPalette`）、ポートの動的メニュー、パレットに並べるブロックの選び方（`paletteBlocks`）
- `packages/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings.js` — 状態とポートの設定（保存の形・読みこみの直し・`runtime.extensionStorage` の読み書き・イベント `STUDUINO_SETTINGS_CHANGED`）
- `packages/scratch-vm/src/serialization/sb3.js` / `src/engine/runtime.js` — `extensionStorage` の保存・読みこみ（マーカーつき）
- `packages/scratch-gui/src/lib/studuino-ir/build-studuino-ir.js` — ブロックから構文木を作る（純粋関数。エラーの理由の一覧）
- `packages/scratch-gui/src/lib/studuino-ir/limits.js` — 構文木の上限（Lambda と同じ数字）
- `packages/scratch-gui/src/lib/studuino-ruby/studuino-ruby.js` — Ruby の約束（部品の名前の規則・部品と opcode とメソッドの表・メニューの形・`class Studuino` の書き出し）
- `packages/scratch-gui/src/lib/ruby-to-blocks-converter/studuino-mode.js` — Ruby → ブロック（`class Studuino` の読みこみと検査・部品の呼び出し・設定の置きかえ）
- `packages/scratch-gui/src/lib/ruby-generator/smalrubot_s1.js` — ブロック → Ruby（部品のブロックと `class Studuino`。`code-finisher.js` がステージの先頭に置く）
- `infra/smalruby-studuino-hex/lambda/ir.ts` / `codegen.ts` — 構文木の検査と C++ の書き出し（Lambda）

参考にする、いまあるファイル:

- `packages/scratch-gui/src/lib/smalrubot-firmware-flasher.js` — Web Serial・STK500v1 の書きこみ
- `packages/scratch-gui/src/lib/smalrubot-firmware.hex.js` — ファームウェア（書きもどしに使う）
- `packages/scratch-vm/src/extensions/scratch3_smalrubot_s1/` — Studuino の拡張機能
- `packages/scratch-vm/src/serialization/sb3.js` — `extensionStorage` を足す所（upstream のファイル）

## 関連ドキュメント

- [`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) — Studuino の拡張機能（通常モード・ファームウェアの書きこみ）
- [`docs/dncl/policy.md`](../dncl/policy.md) — 使える書き方を限り、警告を出す前例（日本語モード）
- [`docs/smalruby-language-spec-extensions.ja.md`](../smalruby-language-spec-extensions.ja.md) — 拡張機能の Ruby 表現
- `docs/maintenance/smalruby-markers-vm.md` — upstream マーカー一覧（`sb3.js` に足したら更新）
