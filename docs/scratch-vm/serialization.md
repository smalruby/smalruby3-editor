# シリアライゼーション (.sb3 フォーマット)

scratch-vm の `.sb3` プロジェクトファイル形式と、Smalruby 独自の **Mesh v1 → v2 マイグレーション** (`smalruby-migration.js`) の解説。

## .sb3 = ZIP + project.json + assets

`.sb3` ファイルは **zip アーカイブ**で、内訳は：

```
project.sb3 (zip)
├── project.json           ← メイン JSON (targets, blocks, monitors, extensions, meta)
├── <assetId>.png          ← コスチューム (画像)
├── <assetId>.svg
├── <assetId>.wav          ← サウンド
└── <assetId>.mp3
```

すべてのアセット (コスチューム・サウンド) は **MD5 ハッシュ + 拡張子** (`<assetId>.<dataFormat>`) のファイル名で zip 内に保存される。`project.json` の各 costume / sound エントリには `assetId` と `md5ext` (= `<assetId>.<dataFormat>`) が含まれ、それで紐づける。

実装: `packages/scratch-vm/src/serialization/sb3.js`

## project.json スキーマ

```jsonc
{
  "targets": [
    {
      "isStage": false,
      "name": "Sprite1",
      "blocks": { /* block ID → block オブジェクト */ },
      "comments": { /* commentId → comment */ },
      "variables": { /* varId → [name, value, isCloud?] */ },
      "lists": { /* listId → [name, [...items]] */ },
      "broadcasts": { /* broadcastId → name */ },
      "costumes": [ /* { name, assetId, md5ext, dataFormat, ... } */ ],
      "sounds": [ /* { name, assetId, md5ext, dataFormat, rate, ... } */ ],
      "currentCostume": 0,
      "x": 0, "y": 0, "direction": 90, "size": 100,
      "visible": true, "rotationStyle": "all around",
      "volume": 100
    },
    {
      "isStage": true,
      "name": "Stage",
      // ステージ固有: tempo, videoTransparency, videoState など
      "tempo": 60
    }
  ],
  "monitors": [ /* { id, mode, opcode, params, sliderMin, sliderMax, ... } */ ],
  "extensions": [ "pen", "music", "meshV2" ],
  "meta": {
    "semver": "3.0.0",
    "vm": "1.5.42",
    "agent": "...",
    "origin": "scratchfoundation/scratch-vm"
  }
}
```

## ブロックフォーマット

`targets[i].blocks` はブロック ID をキーとするオブジェクト。各ブロックは以下の形式：

```jsonc
{
  "<blockId>": {
    "opcode": "motion_movesteps",
    "next": "<nextBlockId or null>",
    "parent": "<parentBlockId or null>",
    "inputs": {
      "STEPS": [1, "<shadowBlockId>"]   // INPUT_SAME_BLOCK_SHADOW
    },
    "fields": {
      "DIRECTION": ["right", null]
    },
    "mutation": null,
    "shadow": false,
    "topLevel": false,
    "x": 0, "y": 0   // topLevel=true のときのみ
  }
}
```

### inputs の圧縮形式

`inputs[NAME]` の配列の **第 1 要素**が圧縮タイプ：

| 定数値 | 名称 | 配列形式 | 意味 |
|---|---|---|---|
| `1` | `INPUT_SAME_BLOCK_SHADOW` | `[1, blockId]` | shadow と挿入ブロックが同じ |
| `2` | `INPUT_BLOCK_NO_SHADOW` | `[2, blockId]` | shadow なし、ブロックのみ |
| `3` | `INPUT_DIFF_BLOCK_SHADOW` | `[3, blockId, shadowId]` | shadow と異なるブロックが挿入されている |

詳細: `sb3.js:104-163`

### プリミティブブロックの配列形式 (大きな最適化)

`math_number`, `text`, `data_variable` 等の **プリミティブブロック**は `inputs` 内で**配列に直接展開**される（個別の block オブジェクトとして保存しない）：

```js
const MATH_NUM_PRIMITIVE = 4;
const TEXT_PRIMITIVE = 10;
const VAR_PRIMITIVE = 12;
const LIST_PRIMITIVE = 13;
// ...
```

例：

```jsonc
inputs: {
  // [4, 42] = math_number with value 42
  "VALUE": [1, [4, 42]],

  // [12, "myVar", "varId123"] = data_variable (with id)
  "VARIABLE": [3, [12, "myVar", "varId123"], "<shadowId>"],

  // [12, "myVar", "varId123", 100, 200] = positioned variable (topLevel)
  "VARIABLE": [12, "myVar", "varId123", 100, 200]
}
```

→ ファイルサイズ削減のため。`packages/scratch-vm/src/serialization/sb3.js:63-96` で定数定義、`248-271` で圧縮ロジック。

## Variables / Lists / Broadcasts

```jsonc
{
  "variables": {
    "varId123": ["myVar", 0],              // [name, value]
    "cloudVar1": ["☁ score", 0, true]     // 第3要素 true = cloud variable
  },
  "lists": {
    "listId456": ["myList", [1, 2, 3]]
  },
  "broadcasts": {
    "broadcastId789": "message1"
  }
}
```

`fields[NAME]` でブロックが変数を参照するときは **`id`** を使う（`value` の名前ではない）：

```jsonc
"fields": {
  "VARIABLE": ["myVar", "varId123"]   // [value, id]
}
```

## アセット (Costumes / Sounds)

### Costume

```jsonc
{
  "name": "コスチューム1",
  "assetId": "abc123def456",
  "md5ext": "abc123def456.svg",
  "dataFormat": "svg",
  "bitmapResolution": 1,
  "rotationCenterX": 47,
  "rotationCenterY": 55
}
```

### Sound

```jsonc
{
  "name": "ニャー",
  "assetId": "fedcba654321",
  "md5ext": "fedcba654321.wav",
  "dataFormat": "wav",
  "format": "",
  "rate": 48000,
  "sampleCount": 22755
}
```

> 注: メモリ上は `md5` プロパティ、ファイル上は `md5ext`。SB3 仕様準拠のためのエイリアス (`sb3.js:356-361`, `385-390`)。

## 旧フォーマット対応

| ファイル | 対応 |
|---|---|
| `serialization/sb3.js` | SB3 (Scratch 3) のシリアライズ・デシリアライズ |
| `serialization/sb2.js` | SB2 (Scratch 2) からのデシリアライズのみ |
| `serialization/sb2_specmap.js` | SB2 → SB3 の opcode マッピング表 |

SB1 (Scratch 1) は scratch-vm では非対応。

## VirtualMachine からのエントリポイント

`packages/scratch-vm/src/virtual-machine.js`:

| メソッド | 用途 |
|---|---|
| `loadProject(input)` (line 324) | `.sb3` zip / project.json を解析してターゲットを構築 |
| `saveProjectSb3()` (line 475) | `.sb3` Blob を生成 (JSZip + アセット) |
| `toJSON(targetId?)` (line 552) | project.json 文字列を返す (`sb3.serialize` のラッパー) |
| `hasMeshV1Project(projectJSON)` (line 392) | Mesh v1 ブロックを含むか判定 |
| `hasKoshienProject(projectJSON)` (line 414) | Koshien 拡張を使っているか判定 |
| `migrateMeshV1InBackpackBlocks(blocks)` (line 437) | バックパックのコード片用 v1→v2 マイグレーション |
| `migrateMeshV1InBackpackSprite(zip)` (line 444) | バックパックのスプライト zip 用マイグレーション |

## Smalruby 独自: Mesh v1 → v2 マイグレーション

### 背景

旧 Mesh (v1) は外部サービス Skyway に依存していたが、Skyway のサービス停止 (Issue #592) で動かなくなった。Smalruby は AWS AppSync ベースの **Mesh v2** に移行したが、ユーザーが**過去に保存したプロジェクトには `mesh_*` opcode が残っている**ため、ロード時に自動で `meshV2_*` に書き換える必要がある。

### 実装

`packages/scratch-vm/src/serialization/smalruby-migration.js` (Smalruby 独自ファイル):

```js
// 主な公開関数
detectMeshV1Blocks(projectJSON)      // mesh_* opcode が含まれるか
detectKoshienBlocks(projectJSON)     // koshien 拡張を使っているか
migrateMeshV1Blocks(projectJSON)     // mesh_* → meshV2_* 全置換 (deep copy)
migrateMeshV1InBackpackSprite(zip)   // バックパック sprite3 zip の v1→v2

// 書き換え対象
// 1. targets[].blocks.<id>.opcode: "mesh_*" → "meshV2_*"
// 2. extensions[]: "mesh" → "meshV2" (なければ追加)
```

### 呼び出しタイミング

1. **プロジェクトロード時** (`virtual-machine.js:370-374`)
   ```js
   if (options.migrateMeshV1ToV2) {
       projectJSON = migrateMeshV1Blocks(projectJSON);
   }
   ```
   scratch-gui からこのオプションを指定してロード。

2. **バックパック起動時** (scratch-gui の `backpack-mesh-v1-migration.js`)
   - `vm.migrateMeshV1InBackpackBlocks()` でコード片を変換
   - `vm.migrateMeshV1InBackpackSprite()` でスプライト zip を変換
   - 完了後 `localStorage.smalruby:meshV1BackpackMigratedAt` にフラグを保存

詳細は [`docs/backpack/`](../backpack/) 参照。

## Monitors のシリアライゼーション

ステージ上に表示される変数モニターは `targets[].blocks` とは**別の `monitors` 配列**に格納：

```jsonc
{
  "monitors": [
    {
      "id": "<monitorId>",
      "mode": "default",         // default / large / slider / list
      "opcode": "data_variable",
      "params": { "VARIABLE": "myVar" },
      "spriteName": null,         // Stage 共通 / null
      "value": 0,
      "width": 0, "height": 0,
      "x": 5, "y": 5,
      "visible": true,
      "sliderMin": 0,
      "sliderMax": 100,
      "isDiscrete": true
    }
  ]
}
```

実装: `sb3.js:512-534` (シリアライズ), `1108-1214` (デシリアライズ)

## 新しいマイグレーションを追加するには

例: `foo_bar` opcode を `foo_newBar` にリネームする場合：

### A. 永続的な v1→v2 形式 (Smalruby のような独自書き換え)

1. `packages/scratch-vm/src/serialization/smalruby-migration.js` に検出関数と移行関数を追加
   ```js
   const detectFooV1Blocks = (projectJSON) => { /* ... */ };
   const migrateFooV1Blocks = (projectJSON) => { /* ... */ };
   ```
2. `virtual-machine.js` の `loadProject()` で条件付き呼び出し
3. バックパック対応が必要なら同様にエクスポート

### B. デシリアライズ時のみの書き換え (旧フォーマットの読み込み互換性)

`sb3.js` の `deserializeBlocks()` または `parseScratchObject()` 内で opcode を検出して書き換え。

### C. SB2 → SB3 の opcode 変換

`sb2_specmap.js` を更新。

## デシリアライズ → シリアライズ ラウンドトリップ

`.sb3` のラウンドトリップで以下を保証：

1. `loadProject(zip)` → ターゲット構築
2. `saveProjectSb3()` → 新しい zip を生成
3. 内容物 (JSON 構造 + アセット) は意味的に等価

> ただし、ブロック ID は再生成される場合があり、JSON のキー順序は保証されない。

## テスト

| ファイル | 対象 |
|---|---|
| `packages/scratch-vm/test/unit/serialization_sb3.js` | sb3 ラウンドトリップ |
| `packages/scratch-vm/test/unit/smalruby_migration.js` | Smalruby v1→v2 マイグレーション |
| `packages/scratch-vm/test/integration/sb3-roundtrip.js` | E2E ラウンドトリップ |

フィクスチャ: `packages/scratch-vm/test/fixtures/`

## 関連ドキュメント

- [`README.md`](README.md) — scratch-vm 全体ナビゲーション
- [`architecture.md`](architecture.md) — Runtime / Sequencer / Thread / Target / Blocks の関係
- [`extensions.md`](extensions.md) — 拡張機能の仕組み
- [`blocks-runtime.md`](blocks-runtime.md) — ブロック実行モデル詳細 (準備中)
- [`docs/backpack/`](../backpack/) — バックパックでの v1→v2 マイグレーション統合
- [`docs/mesh-v2/`](../mesh-v2/) — Mesh v2 ネットワーク全体像
