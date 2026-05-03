# 音 (サウンド)

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用

## 概要

スプライトが鳴らす**音 (サウンド)** の編集機能。サウンドライブラリからの選択、自分で録音 (`record-modal`)、ファイルから取り込む、波形編集 (audio-trimmer) などを行う。upstream Scratch から継承しており、Smalruby 固有の改良はない。

## ユーザーストーリー

- **小学生**として、効果音やBGMをスプライトに付けたい
- **作品を作る子**として、自分の声を録音して使いたい
- **発表会の出展者**として、ライブラリから音を選んで作品の世界観を作りたい
- **音の編集をしたい子**として、不要な部分をトリミングしたい

## UI / 操作フロー

エディタ上部のタブで **音** タブを選択：

1. 左カラムにサウンド一覧
2. 右カラムにサウンドエディタ (波形表示 + トリム + エフェクト)
3. 「+」ボタン → サウンドライブラリ / マイク録音 / ファイル / サプライズ

### 録音

`record-modal` を開いて：
1. マイク許可
2. 録音開始 (`recording-step`)
3. 再生確認 (`playback-step`)
4. 必要に応じてトリミング (`audio-trimmer`)
5. 保存

## 主要ファイル

### scratch-gui

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/sound-tab.jsx` | サウンドタブのメインコンテナ |
| `packages/scratch-gui/src/containers/sound-editor.jsx` | サウンドエディタ |
| `packages/scratch-gui/src/containers/sound-library.jsx` | サウンドライブラリモーダル |
| `packages/scratch-gui/src/containers/audio-trimmer.jsx` | 波形トリミング |
| `packages/scratch-gui/src/containers/audio-selector.jsx` | 範囲選択 |
| `packages/scratch-gui/src/containers/record-modal.jsx` | 録音モーダル |
| `packages/scratch-gui/src/containers/recording-step.jsx` | 録音ステップ |
| `packages/scratch-gui/src/containers/playback-step.jsx` | 再生確認ステップ |

#### コンポーネント

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/components/audio-trimmer/` | トリマー UI |
| `packages/scratch-gui/src/components/sound-editor/` | エディタ UI |
| `packages/scratch-gui/src/components/record-modal/` | モーダル UI |
| `packages/scratch-gui/src/components/mic-indicator/` | マイク入力レベル表示 |
| `packages/scratch-gui/src/components/waveform/` | 波形表示 |
| `packages/scratch-gui/src/components/meter/` | メーター UI |
| `packages/scratch-gui/src/components/play-button/` | 再生ボタン |

#### ライブラリ

- `packages/scratch-gui/src/lib/audio/` — Audio 関連ユーティリティ

#### State 管理

- `packages/scratch-gui/src/reducers/mic-indicator.js` — マイク入力 state

### scratch-vm

VM の `audio-engine` (依存パッケージ) でサウンド再生・エフェクト処理。

### infra

なし。

## 関連ブロック

サウンド自体を**操作する**ブロックのみ列挙（音楽生成系の `music_*` などは含めない）：

| ブロック | 説明 |
|---|---|
| `sound_play` | 音を鳴らす（最後まで待たない）|
| `sound_playuntildone` | 音を鳴らして終わるまで待つ |
| `sound_stopallsounds` | すべての音を止める |
| `sound_sounds_menu` | サウンド選択メニュー（引数用）|

> 「音楽」関連 (`music_playDrumForBeats`, `music_playNoteForBeats` など) は別拡張機能 [`docs/extension-music/`](../extension-music/) を参照。

## 設定・データ永続化

なし（サウンドデータはプロジェクトの一部として `.sb3` に保存される）。

## 関連ドキュメント

- [`docs/sprite/`](../sprite/) — サウンドを持つスプライト
- [`docs/costume/`](../costume/) — コスチュームと同じアセットパネル
- [`docs/extension-music/`](../extension-music/) — 音楽生成拡張

## 関連 Issue / PR

upstream そのままの機能のため、Smalruby 固有の Issue はほとんどなし。
