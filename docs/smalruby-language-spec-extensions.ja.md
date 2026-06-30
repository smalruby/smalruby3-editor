# Smalruby 言語仕様 — 拡張機能

このドキュメントは、smalrubyの拡張機能で利用できるRubyメソッドを定義します。
拡張機能ライブラリに表示されるもののみ記載しています（`defaultHidden: true` の拡張機能は除外）。

- English version: [smalruby-language-spec-extensions.md](./smalruby-language-spec-extensions.md)
- コア言語仕様: [smalruby-language-spec.ja.md](./smalruby-language-spec.ja.md)
- Version 1 API との差分: [smalruby-language-spec-v1-diff.ja.md](./smalruby-language-spec-v1-diff.ja.md)

> **注意**: このドキュメントは **Version 2** API をベースに記載しています。Version 1 との差分は [v1 差分](./smalruby-language-spec-v1-diff.ja.md) を参照してください。

## 目次

1. [ペン（Pen）](#1-ペンpen)
2. [音楽（Music）](#2-音楽music)
3. [ビデオモーションセンサー（Video Sensing）](#3-ビデオモーションセンサーvideo-sensing)
4. [顔認識（Face Sensing）](#4-顔認識face-sensing)
5. [音声合成（Text to Speech）](#5-音声合成text-to-speech)
6. [翻訳（Translate）](#6-翻訳translate)
7. [メッシュ V2（Mesh V2）](#7-メッシュ-v2mesh-v2)
8. [スモウルボット S1（Smalrubot S1）](#8-スモウルボット-s1smalrubot-s1)
9. [マイクロビット モア（Microbit More）](#9-マイクロビット-モアmicrobit-more)
10. [甲子園（Koshien）](#10-甲子園koshien)
11. [Ruby 文字列（Ruby String）](#11-ruby-文字列ruby-string)

---

## 1. ペン（Pen）

スプライトでお絵かきができます。

| メソッド | 説明 | 例 |
|---|---|---|
| `pen.clear` | 全消去 | `pen.clear` |
| `pen.stamp` | スタンプ | `pen.stamp` |
| `pen.down` | ペンを下ろす | `pen.down` |
| `pen.up` | ペンを上げる | `pen.up` |
| `pen.color = 色` | ペンの色を設定（16進文字列 `"#ff0000"` / 短縮形 `"#f00"` / 色名 `"red"` / `"rgb(255,0,0)"`） | `pen.color = "#ff0000"` |
| `pen.color = 数値` | ペンの色パラメータを設定 | `pen.color = 50` |
| `pen.color += 数値` | ペンの色パラメータを変化させる | `pen.color += 10` |
| `pen.saturation = 数値` | 彩度を設定 | `pen.saturation = 100` |
| `pen.saturation += 数値` | 彩度を変化させる | `pen.saturation += 10` |
| `pen.brightness = 数値` | 明るさを設定 | `pen.brightness = 100` |
| `pen.brightness += 数値` | 明るさを変化させる | `pen.brightness += 10` |
| `pen.transparency = 数値` | 透明度を設定 | `pen.transparency = 50` |
| `pen.transparency += 数値` | 透明度を変化させる | `pen.transparency += 10` |
| `pen.size = 数値` | ペンの太さを設定 | `pen.size = 3` |
| `pen.size += 数値` | ペンの太さを変化させる | `pen.size += 1` |

---

## 2. 音楽（Music）

楽器やドラムを演奏できます。

| メソッド | 説明 | 例 |
|---|---|---|
| `music.play_drum(drum: 番号, beats: 拍数)` | ドラムを鳴らす | `music.play_drum(drum: 1, beats: 0.25)` |
| `music.rest(拍数)` | 休符 | `music.rest(0.25)` |
| `music.play_note(note: 番号, beats: 拍数)` | 音符を鳴らす | `music.play_note(note: 60, beats: 0.25)` |
| `music.instrument = 番号` | 楽器を設定 | `music.instrument = 1` |
| `music.tempo = 値` | テンポを設定 | `music.tempo = 120` |
| `music.tempo += 変化量` | テンポを変化させる | `music.tempo += 20` |
| `music.tempo` | テンポを取得 | `music.tempo` |

---

## 3. ビデオモーションセンサー（Video Sensing）

カメラで動きを感知します。

| メソッド | 説明 | 例 |
|---|---|---|
| `video_sensing.when_video_motion_greater_than(値) do...end` | ビデオの動きが値を超えたとき | `video_sensing.when_video_motion_greater_than(10) do ... end` |
| `video_sensing.video_turn(状態)` | ビデオのオン/オフ | `video_sensing.video_turn("on")` |
| `video_sensing.video_transparency = 値` | ビデオの透明度を設定 | `video_sensing.video_transparency = 50` |
| `video_sensing.video_on(属性, 対象)` | ビデオの属性を取得 | `video_sensing.video_on("motion", "this sprite")` |

**ビデオの状態**: `"on"`, `"off"`, `"on-flipped"`

**ビデオの属性**: `"motion"`（動き）, `"direction"`（向き）

**ビデオの対象**: `"this sprite"`（このスプライト）, `"Stage"`（ステージ）

---

## 4. 顔認識（Face Sensing）

カメラで顔を認識します。（スモウルビー固有の拡張機能）

### コマンド

| メソッド | 説明 | 例 |
|---|---|---|
| `face_sensing.go_to(部位)` | 顔の部位に移動 | `face_sensing.go_to("nose")` |
| `face_sensing.point_in_direction_of_face_tilt` | 顔の傾きの方向を向く | `face_sensing.point_in_direction_of_face_tilt` |
| `face_sensing.set_size_to_face_size` | 顔の大きさに合わせる | `face_sensing.set_size_to_face_size` |

### イベントハンドラ

| メソッド | 説明 | 例 |
|---|---|---|
| `face_sensing.when_face_tilted(方向) do...end` | 顔が傾いたとき | `face_sensing.when_face_tilted("left") do ... end` |
| `face_sensing.when_this_sprite_touch(部位) do...end` | スプライトが顔の部位に触れたとき | `face_sensing.when_this_sprite_touch("nose") do ... end` |
| `face_sensing.when_face_detected do...end` | 顔が検出されたとき | `face_sensing.when_face_detected do ... end` |

### レポーター

| メソッド | 説明 | 例 |
|---|---|---|
| `face_sensing.face_detected?` | 顔が検出されているか | `face_sensing.face_detected?` |
| `face_sensing.face_tilt` | 顔の傾き角度 | `face_sensing.face_tilt` |
| `face_sensing.face_size` | 顔の大きさ | `face_sensing.face_size` |

**顔の部位**: `"left_eye"`（左目）, `"right_eye"`（右目）, `"nose"`（鼻）, `"mouth"`（口）, `"left_ear"`（左耳）, `"right_ear"`（右耳）, `"between_eyes"`（目の間）, `"top_of_head"`（頭の上）

**傾きの方向**: `"left"`, `"right"`, `"up"`, `"down"`

---

## 5. 音声合成（Text to Speech）

プロジェクトに音声を追加できます。（インターネット接続が必要）

| メソッド | 説明 | 例 |
|---|---|---|
| `text2speech.speak(テキスト)` | テキストを読み上げる | `text2speech.speak("こんにちは")` |
| `text2speech.voice = 声` | 声を設定 | `text2speech.voice = "ALTO"` |
| `text2speech.language = 言語` | 言語を設定 | `text2speech.language = "ja"` |

**声の種類**: `"ALTO"`, `"TENOR"`, `"SQUEAK"`, `"GIANT"`, `"KITTEN"`

---

## 6. 翻訳（Translate）

テキストをさまざまな言語に翻訳できます。（インターネット接続が必要）

| メソッド | 説明 | 例 |
|---|---|---|
| `translate.call(テキスト, 言語)` | テキストを翻訳 | `translate.call("hello", "ja")` |
| `translate.language` | 閲覧者の言語を取得 | `translate.language` |

---

## 7. メッシュ V2（Mesh V2）

コンピュータネットワークを通じてやりとりできます。（インターネット接続が必要）

| メソッド | 説明 | 例 |
|---|---|---|
| `mesh.sensor_value(名前)` | センサー値を取得 | `mesh.sensor_value("score")` |

---

## 8. スモウルボット S1（Smalrubot S1）

スモウルボット S1 ロボットを制御します。

### コマンド

| メソッド | 説明 | 例 |
|---|---|---|
| `smalrubot_s1.action(アクション)` | アクションを実行 | `smalrubot_s1.action("forward")` |
| `smalrubot_s1.action(アクション, 秒数)` | 秒数だけアクションを実行 | `smalrubot_s1.action("forward", 1)` |
| `smalrubot_s1.bend_arm(角度, 秒数)` | アームを曲げる | `smalrubot_s1.bend_arm(90, 1)` |
| `smalrubot_s1.led(位置, true/false)` | LEDのオン/オフ | `smalrubot_s1.led("left", true)` |
| `smalrubot_s1.set_motor_speed(位置, 速度)` | モーター速度を設定 | `smalrubot_s1.set_motor_speed("left", 100)` |
| `smalrubot_s1.arm_calibration = 角度` | アームのキャリブレーション | `smalrubot_s1.arm_calibration = 0` |

### レポーター

| メソッド | 説明 | 例 |
|---|---|---|
| `smalrubot_s1.sensor_value(位置)` | センサー値を取得 | `smalrubot_s1.sensor_value("left")` |
| `smalrubot_s1.get_motor_speed(位置)` | モーター速度を取得 | `smalrubot_s1.get_motor_speed("left")` |

**アクションの値**: `"forward"`（前進）, `"backward"`（後退）, `"left"`（左旋回）, `"right"`（右旋回）, `"stop"`（停止）

**位置の値**: `"left"`（左）, `"right"`（右）

---

## 9. マイクロビット モア（Microbit More）

micro:bit の拡張サポート。センサー、ディスプレイ、データ通信に対応。

### イベントハンドラ

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.when_microbit(状態) do...end` | 接続状態が変わったとき | `microbit.when_microbit("connected") do ... end` |
| `microbit.when_button_is(名前, イベント) do...end` | ボタンイベントのとき | `microbit.when_button_is("A", "down") do ... end` |
| `microbit.when_pin_is(名前, イベント) do...end` | ピンタッチイベントのとき | `microbit.when_pin_is("LOGO", "touched") do ... end` |
| `microbit.when_pin_connected(ピン) do...end` | ピンが接続されたとき | `microbit.when_pin_connected(0) do ... end` |
| `microbit.when(ジェスチャー) do...end` | ジェスチャーが検出されたとき | `microbit.when("shake") do ... end` |
| `microbit.when_tilted(方向) do...end` | 傾いたとき | `microbit.when_tilted("any") do ... end` |
| `microbit.when_catch_at_pin(イベント, ピン) do...end` | ピンイベントを検出したとき | `microbit.when_catch_at_pin("low pulse", "P0") do ... end` |
| `microbit.when_data_received_from_microbit(ラベル) do...end` | データを受信したとき | `microbit.when_data_received_from_microbit("label-01") do ... end` |

### ボタンとタッチ

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.button_pressed?(名前)` | ボタンが押されているか | `microbit.button_pressed?("A")` |
| `microbit.pin_is_touched?(名前)` | ピンがタッチされているか | `microbit.pin_is_touched?("LOGO")` |

### センサー

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.light_intensity` | 明るさ | `microbit.light_intensity` |
| `microbit.temperature` | 温度 | `microbit.temperature` |
| `microbit.angle_with_north` | 北との角度 | `microbit.angle_with_north` |
| `microbit.pitch` | ピッチ角度 | `microbit.pitch` |
| `microbit.roll` | ロール角度 | `microbit.roll` |
| `microbit.sound_level` | 音量 | `microbit.sound_level` |
| `microbit.magnetic_force(軸)` | 磁力 | `microbit.magnetic_force("absolute")` |
| `microbit.acceleration(軸)` | 加速度 | `microbit.acceleration("x")` |
| `microbit.analog_value(ピン)` | アナログピンの値 | `microbit.analog_value("P0")` |

### ディスプレイ

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.display_pattern(マトリクス)` | LEDパターンを表示 | `microbit.display_pattern("11111", "10001", "10001", "10001", "11111")` |
| `microbit.display_text(テキスト)` | テキストを表示 | `microbit.display_text("Hello!")` |
| `microbit.display_text_delay(テキスト, 遅延)` | テキストを遅延付きで表示 | `microbit.display_text_delay("Hello!", 120)` |
| `microbit.clear_display` | ディスプレイをクリア | `microbit.clear_display` |

### ピン制御

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.set_pin_to_input_pull(ピン, モード)` | ピンのプルモードを設定 | `microbit.set_pin_to_input_pull("P0", "up")` |
| `microbit.is_pin_high?(ピン)` | ピンがHighか | `microbit.is_pin_high?("P0")` |
| `microbit.set_digital(ピン, レベル)` | デジタル出力を設定 | `microbit.set_digital("P0", "High")` |
| `microbit.set_analog(ピン, レベル)` | アナログ出力を設定 | `microbit.set_analog("P0", 512)` |
| `microbit.set_servo(ピン, 角度)` | サーボの角度を設定 | `microbit.set_servo("P0", 90)` |

### オーディオ

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.play_tone(周波数, 音量)` | トーンを再生 | `microbit.play_tone(440, 100)` |
| `microbit.stop_tone` | トーンを停止 | `microbit.stop_tone` |

### ピンイベント

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.listen_event_on(イベントタイプ, ピン)` | ピンイベントタイプを設定 | `microbit.listen_event_on("pulse", "P0")` |
| `microbit.value_of(イベント, ピン)` | ピンイベントの値を取得 | `microbit.value_of("low pulse", "P0")` |

### 傾き

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.tilted?(方向)` | 傾いているか | `microbit.tilted?("any")` |
| `microbit.tilt_angle(方向)` | 傾き角度を取得 | `microbit.tilt_angle("front")` |

### データ通信

| メソッド | 説明 | 例 |
|---|---|---|
| `microbit.send_data_to_microbit(データ, ラベル)` | micro:bit にデータを送信 | `microbit.send_data_to_microbit("data", "label-01")` |
| `microbit.data[ラベル]` | 受信データを取得 | `microbit.data["label-01"]` |

**ボタン名**: `"A"`, `"B"`

**ボタンイベント**: `"down"`（押された）, `"up"`（離された）, `"click"`（クリック）

**タッチイベント**: `"touched"`（タッチ）, `"released"`（離された）, `"tapped"`（タップ）

**ジェスチャー名**: `"tilted_front"`（前に傾いた）, `"tilted_back"`（後ろに傾いた）, `"tilted_left"`（左に傾いた）, `"tilted_right"`（右に傾いた）, `"face up"`（上向き）, `"face down"`（下向き）, `"freefall"`（自由落下）, `"3G"`, `"6G"`, `"8G"`, `"shake"`（振られた）, `"jumped"`（ジャンプ）, `"moved"`（動いた）, `"tilted_any"`（いずれかに傾いた）

**傾きの方向**: `"any"`（いずれか）, `"front"`（前）, `"back"`（後ろ）, `"left"`（左）, `"right"`（右）

**軸の値**: `"x"`, `"y"`, `"z"`, `"absolute"`（絶対値）

**ピンイベントタイプ**: `"none"`, `"pulse"`, `"edge"`

**ピンイベント**: `"low pulse"`, `"high pulse"`, `"fall"`, `"rise"`

**LEDマトリクスパターン**: 各行は5文字の文字列で、`1` = 点灯、`.` = 消灯。例: `"1.1.1"`

---

## 10. 甲子園（Koshien）

スモウルビー甲子園の競技サポート。

### 接続

| メソッド | 説明 | 例 |
|---|---|---|
| `koshien.connect_game(name: 名前)` | ゲームに接続 | `koshien.connect_game(name: "player1")` |

### マップ操作

| メソッド | 説明 | 例 |
|---|---|---|
| `koshien.get_map_area(位置)` | マップエリアを取得 | `koshien.get_map_area("0:0")` |
| `koshien.map(位置)` | 位置のマップを取得 | `koshien.map("0:0")` |
| `koshien.map_from(位置, 変数)` | 変数からマップを取得 | `koshien.map_from("0:0", @map)` |
| `koshien.map_all` | 全マップを取得 | `koshien.map_all` |
| `koshien.move_to(位置)` | 位置に移動 | `koshien.move_to("1:2")` |

### ルート計算

| メソッド | 説明 | 例 |
|---|---|---|
| `koshien.calc_route(result: リスト)` | ゴールまでのルートを計算 | `koshien.calc_route(result: list("@route"))` |
| `koshien.calc_route(result: リスト, src: 位置, dst: 位置, except_cells: リスト)` | オプション付きルート計算 | `koshien.calc_route(result: list("@route"), src: "0:0", dst: "4:4", except_cells: list("@walls"))` |

### アイテムとオブジェクト

| メソッド | 説明 | 例 |
|---|---|---|
| `koshien.set_<アイテム>(位置)` | 位置にアイテムを設置 | `koshien.set_flag("1:1")` |
| `koshien.locate_objects(result: リスト, sq_size: 数, cent: 位置, objects: 文字列)` | オブジェクトを検索 | `koshien.locate_objects(result: list("@objs"), sq_size: 5, cent: "2:2", objects: "ABCD")` |
| `koshien.object(オブジェクト)` | オブジェクトを取得 | `koshien.object("unknown")` |

### 位置と座標

| メソッド | 説明 | 例 |
|---|---|---|
| `koshien.position(x, y)` | 位置を作成 | `koshien.position(0, 0)` |
| `koshien.position_of_x(位置)` | 位置からXを取得 | `koshien.position_of_x("1:2")` |
| `koshien.position_of_y(位置)` | 位置からYを取得 | `koshien.position_of_y("1:2")` |
| `koshien.<ターゲット>` | ターゲットの位置を取得 | `koshien.player` |
| `koshien.<ターゲット>_x` | ターゲットのXを取得 | `koshien.player_x` |
| `koshien.<ターゲット>_y` | ターゲットのYを取得 | `koshien.player_y` |

### ゲーム制御

| メソッド | 説明 | 例 |
|---|---|---|
| `koshien.turn_over` | ターン終了 | `koshien.turn_over` |
| `koshien.set_message(メッセージ)` | メッセージを設定 | `koshien.set_message("hello")` |

---

## 11. Ruby 文字列（Ruby String）

Ruby の文字列操作メソッド。（スモウルビー固有の拡張機能）

### レポーターメソッド（非破壊的）

元の文字列を変更せず、新しい文字列を返します。文字列リテラル、変数、ブロック結果のいずれでも使用できます。

| メソッド | 説明 | 例 |
|---|---|---|
| `文字列.delete(文字)` | 指定した文字を削除 | `"hello world".delete("l")` |
| `文字列.gsub(パターン, 置換)` | すべての一致を置換 | `"hello".gsub("l", "r")` |

### コマンドメソッド（破壊的・その場で変更）

変数の値をその場で変更します。**変数のレシーバーでのみ使用可能**です。

| メソッド | 説明 | 例 |
|---|---|---|
| `変数.delete!(文字)` | 文字をその場で削除 | `@name.delete!("l")` |
| `変数.gsub!(パターン, 置換)` | すべてをその場で置換 | `@name.gsub!("l", "r")` |

**注意**: `!`（バン）メソッドはレシーバーが変数である必要があります。文字列リテラル（`"hello".delete!("l")`）では使用できません。
