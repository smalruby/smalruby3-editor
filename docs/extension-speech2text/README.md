# 拡張機能: 音声認識 (Speech to Text)

> **⬆️ upstream そのまま** — upstream の実装をほぼそのまま利用（ただし**現状 GUI ライブラリ未登録**、VM 実装のみ存在）

- **Smalruby ランタイム対応**: ❌（smalruby3 gem 未対応。Web Speech API + マイク使用）
- **GUI 登録状態**: ❌ **`packages/scratch-gui/src/lib/libraries/extensions/index.jsx` に登録なし**

## 概要

マイクから入力された音声をテキストに変換する**音声認識**拡張機能。upstream の VM には実装が存在するが、Smalruby の **GUI 拡張機能ライブラリには登録されていない** ため、現在ユーザーは追加できない（実装ファイルは将来の有効化に備えて残されている）。

## ユーザーストーリー（将来有効化時）

- **小学生**として、自分の声でゲームを操作したい
- **教師**として、発話を伴うインタラクティブな教材を作らせたい

## 主要ファイル

- VM 実装: `packages/scratch-vm/src/extensions/scratch3_speech2text/` （**現在 GUI からは到達不能**）
- GUI 登録: `packages/scratch-gui/src/lib/libraries/extensions/index.jsx` には**未登録**

## 有効化する場合

GUI 拡張機能ライブラリに登録するには、`packages/scratch-gui/src/lib/libraries/extensions/index.jsx` に以下のような entry を追加する：

```jsx
{
    name: '音声認識',
    extensionId: 'speech2text',
    iconURL: speech2textIconURL,
    insetIconURL: speech2textInsetIconURL,
    description: '...',
    featured: true,
    // defaultHidden を付けるか付けないかは要件次第
}
```

## 動作環境

- **対応ブラウザ**: Chrome / Edge (Web Speech API)
- **必須**: マイク許可

## 関連ドキュメント

- 上流: [scratch-vm のドキュメント](https://github.com/scratchfoundation/scratch-vm)
- [`docs/extension-tm2scratch/`](../extension-tm2scratch/) — 機械学習ベースの音声分類（こちらは Smalruby 独自で利用可能）
