# 拡張機能の仕組み (scratch-vm)

scratch-vm の **拡張機能 (Extension)** システムの内部実装と、Smalruby 独自の登録機構 `smalruby-extensions.js` の解説。

> upstream の拡張機能仕様 (Scratch 3.0 Extension Specification) は **[`packages/scratch-vm/docs/extensions.md`](../../packages/scratch-vm/docs/extensions.md)** に詳しい。本ドキュメントは **VM 内部の動き** と **Smalruby 固有の追加機構** にフォーカスする。

## 拡張機能の 4 区分（upstream）

| 区分 | 開発元 | サンドボックス | 例 |
|---|---|---|---|
| **Core** | Scratch Team | ❌ (in-process) | motion / looks / control / sensing 等 |
| **Team** | Scratch Team | ❌ (in-process) | pen, music, makeymakey, microbit, ev3, boost, wedo2, video-sensing, text2speech, translate |
| **Official** | 認定パートナー | ✅ (Web Worker) | 一部公式デバイス用 |
| **Unofficial** | 任意の開発者 | ✅ (Web Worker) | URL 指定で動的ロード（現状未サポート） |

詳細は [`packages/scratch-vm/docs/extensions.md`](../../packages/scratch-vm/docs/extensions.md) の表を参照。

**Smalruby 独自拡張**は **Team 区分相当 (in-process)** として扱う。`smalruby-extensions.js` の機構で `builtinExtensions` Map に登録される。

## ライフサイクル: ロード → 登録 → 実行

```
1. vm.extensionManager.loadExtensionURL(extensionId)
        │
        ├─ extensionId が builtinExtensions[] にある (in-process)
        │     ├─ require(...) で同期ロード
        │     ├─ new BlockClass(runtime, extensionId)
        │     └─ _registerInternalExtension() (extension-manager.js:239)
        │
        └─ それ以外 (worker)
              ├─ new Worker(extension-worker.js)
              ├─ pendingExtensions queue に追加 (extension-manager.js:170)
              └─ worker から registerExtensionService コールバック

2. registerExtensionService() / registerExtensionServiceSync()
        │
        └─ dispatch.call(serviceName, 'getInfo')
              │
              └─ 各拡張機能の getInfo() メソッドを呼ぶ

3. _registerExtensionInfo() で metadata を整形
        │
        └─ runtime._registerExtensionPrimitives() (extension-manager.js:256)
              ├─ runtime._primitives[opcode] = func   ← ブロック関数
              ├─ runtime._hats[opcode] = { edgeActivated, ... } ← Hat 用
              └─ runtime._blockInfo にカテゴリを追加

4. ブロック実行時
        │
        └─ execute.js → runtime._primitives[opcode](args, blockUtility)
```

## ExtensionManager の主要データ構造

`packages/scratch-vm/src/extension-support/extension-manager.js`:

| プロパティ | 型 | 用途 |
|---|---|---|
| `_loadedExtensions` | `Map<extensionId, serviceName>` | ロード済み拡張のサービス名解決 |
| `pendingExtensions` | `Queue<{extensionURL, resolve, reject}>` | Worker 割り当て待ち |
| `pendingWorkers` | `Array<workerInfo>` | 初期化中の Worker |
| `nextExtensionWorker` | `number` | 一意なサービス名を生成するカウンタ |

冒頭付近で：

```js
const builtinExtensions = {
    pen: () => require('../extensions/scratch3_pen'),
    wedo2: () => require('../extensions/scratch3_wedo2'),
    music: () => require('../extensions/scratch3_music'),
    // ... upstream の built-in 群
};

// === Smalruby: register Smalruby extensions ===
require('./smalruby-extensions')(builtinExtensions);
// === Smalruby: end ===
```

このマーカー間が **upstream への唯一の差分**（1 行の require 呼び出し）。Smalruby の拡張追加・削除は `smalruby-extensions.js` 側で完結し、`extension-manager.js` を編集する必要はない。

## Smalruby 独自の登録機構

`packages/scratch-vm/src/extension-support/smalruby-extensions.js`:

```js
const registerSmalrubyExtensions = (builtinExtensions) => {
    builtinExtensions.koshien = () => {
        const formatMessage = require('format-message');
        const blockClass = require('../extensions/koshien/index.js');
        blockClass.formatMessage = formatMessage;
        return blockClass;
    };

    builtinExtensions.microbitMore = () => { /* ... */ };
    builtinExtensions.tm2scratch = () => { /* ... */ };
    builtinExtensions.g2s = () => { /* ... */ };
    builtinExtensions.smalrubyRuby = () => { /* ... */ };
};

module.exports = registerSmalrubyExtensions;
```

特徴：

1. **クロージャでラップ** することで `formatMessage` を遅延注入 (i18n 用)
2. すべての Smalruby 拡張を**1 ファイルに集約**
3. `extension-manager.js` への変更は require 1 行のみ → **upstream マージ時の競合を最小化**

## getInfo() メタデータスキーマ

各拡張機能は `getInfo()` で以下を返す（`extension-metadata.js` 参照）：

```js
{
    id: 'koshien',                    // alphanumeric
    name: 'Smalruby 甲子園',          // 表示名
    blockIconURI: 'data:image/svg+xml;...', // ツールボックスアイコン
    menuIconURI: 'data:image/svg+xml;...',  // 拡張ライブラリアイコン
    docsURI: '...',                   // 任意

    blocks: [
        {
            opcode: 'connectGame',
            blockType: BlockType.COMMAND,
            text: 'connect to game',
            arguments: {
                PLAYER_NAME: { type: ArgumentType.STRING, defaultValue: 'player1' }
            },
            // optional:
            isTerminal: false,           // true ならスタック終端
            disableMonitor: false,       // モニター無効化
            isEdgeActivated: false,      // Hat 用
            shouldRestartExistingThreads: false,  // Hat 用
        },
        '---',  // セパレータ
        // ...
    ],

    menus: {
        playerMenu: ['player1', 'player2', 'player3']
        // または:
        // playerMenu: 'getPlayers'  ← メソッド名
    }
}
```

## BlockType 一覧

`packages/scratch-vm/src/extension-support/block-type.js`:

| BlockType | 形状 | 用途 |
|---|---|---|
| **COMMAND** | 矩形 | 通常の順次実行ブロック |
| **REPORTER** | 丸角矩形 | 値を返すブロック (数値・文字列) |
| **BOOLEAN** | 六角形 | 真偽値を返すブロック |
| **HAT** | 帽子型 | スレッドの起点 (event_whenflagclicked 等) |
| **EVENT** | 帽子型 | runtime イベントで起動 (impl 関数なし) |
| **LOOP** | C 字型 | 子ブランチを反復 |
| **CONDITIONAL** | C 字型 | 子ブランチを条件分岐 |
| **BUTTON** | - | 拡張機能パレット内のボタン (実ブロックではない) |

## ArgumentType 一覧

`packages/scratch-vm/src/extension-support/argument-type.js`:

| ArgumentType | UI |
|---|---|
| **STRING** | テキスト入力 |
| **NUMBER** | 数値入力 |
| **ANGLE** | 円形角度ピッカー |
| **COLOR** | カラーピッカー |
| **BOOLEAN** | 六角形スロット (Boolean ブロック挿入用) |
| **MATRIX** | 5×5 LED マトリクス |
| **NOTE** | MIDI 音符ピッカー |
| **IMAGE** | インライン画像 (非インタラクティブ) |

## TargetType 一覧

`packages/scratch-vm/src/extension-support/target-type.js`:

| TargetType | 説明 |
|---|---|
| **SPRITE** | 移動可能な RenderedTarget |
| **STAGE** | 背景のみの Target |

ブロックの `filter` プロパティで「Sprite 専用」「Stage 専用」を指定できる。

## Dispatch システム

拡張機能と runtime 間の通信は `central-dispatch.js` の **RPC ライクな仕組み**を使う：

| メソッド | 用途 |
|---|---|
| `dispatch.call(service, method, ...args)` | 非同期 (worker 越境可) |
| `dispatch.callSync(service, method, ...args)` | 同期 (in-process 限定) |
| `dispatch.setService(name, obj)` | サービス登録 |

- **in-process 拡張** (Smalruby を含む built-in 系): 直接 JS メソッド呼び出し
- **worker 拡張**: postMessage + 自動シリアライズ

ExtensionManager は `_loadedExtensions` でサービス名を引いて適切なパスを選ぶ (extension-manager.js:420-432 付近)。

## 簡単な拡張機能の例

upstream の **pen** 拡張 (`packages/scratch-vm/src/extensions/scratch3_pen/index.js`)：

```js
class Scratch3PenBlocks {
    constructor(runtime) {
        this.runtime = runtime;
        runtime.on('targetWasCreated', this._onTargetCreated.bind(this));
    }

    static get DEFAULT_PEN_STATE() { /* ... */ }

    _onTargetCreated(target, source) {
        // クローン時に親のペン状態をコピー
    }

    getInfo() {
        return {
            id: 'pen',
            name: 'Pen',
            blocks: [
                { opcode: 'clear', blockType: BlockType.COMMAND, text: 'erase all' },
                { opcode: 'penDown', blockType: BlockType.COMMAND, text: 'pen down' },
                // ...
            ]
        };
    }

    clear() { /* ペンレイヤーを全消去 */ }
    penDown(args, util) { /* util.target にペン状態を ON */ }
}

module.exports = Scratch3PenBlocks;
```

Smalruby 拡張も同じパターン。例: [`docs/extension-koshien/`](../extension-koshien/) を参照。

## 拡張機能関連の参照ドキュメント

- **[`packages/scratch-vm/docs/extensions.md`](../../packages/scratch-vm/docs/extensions.md)** — upstream の拡張機能仕様（Scratch 3.0 Extension Specification）
- **[`docs/extension-*/`](../)** — 各拡張機能のユーザー視点ドキュメント
- `.claude/rules/scratch-gui/extension-ruby-policy.md` — 拡張機能の Ruby 対応方針 (ふりがな・スニペット追加)
- `.claude/rules/scratch-vm/development.md` — VM 開発ルール

## 関連ドキュメント

- [`README.md`](README.md) — scratch-vm 全体ナビゲーション
- [`architecture.md`](architecture.md) — Runtime / Sequencer / Thread / Target / Blocks の関係
- [`serialization.md`](serialization.md) — `.sb3` フォーマット (準備中)
- [`blocks-runtime.md`](blocks-runtime.md) — ブロック実行モデル詳細 (準備中)
