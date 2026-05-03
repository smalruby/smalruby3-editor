---
paths:
  - "packages/scratch-gui/src/lib/ruby-to-blocks-converter/**"
  - "packages/scratch-gui/src/lib/ruby-generator/**"
  - "packages/scratch-gui/src/lib/furigana-annotator*"
  - "packages/scratch-gui/src/locales/**"
  - "docs/furigana/furigana-mapping*"
  - "packages/scratch-gui/test/unit/lib/furigana-annotator*"
description: "拡張機能の Ruby メソッド定義方針と Ruby ふりがなの設計方針。新しい拡張機能の Ruby 対応やふりがな追加時に使用。"
---

# 拡張機能の Ruby メソッド定義方針

拡張機能のブロックを Ruby で表現する際の設計方針。

## 事前定義レシーバーパターン

拡張機能は `拡張名.メソッド名(...)` の形式で表現する。`拡張名` はスクリプト上で変数として定義されず、prism では **レシーバーなしの `CallNode`** として解析される。

```ruby
# face_sensing は変数定義なしで直接使う
face_sensing.go_to("nose")
face_sensing.when_face_tilted("left") do
end

# pen も同様
pen.down
pen.size = 3
```

**AST 構造**: `face_sensing.go_to("nose")` は以下のように解析される:
- 外側: `CallNode(name=go_to, receiver=CallNode(name=face_sensing, receiver=nil))`
- 内側の `face_sensing`: レシーバーなし・引数なしの `CallNode`

**対応済み拡張機能**:
| 拡張名 | Ruby レシーバー | 状態 |
|--------|----------------|------|
| ペン | `pen` | 対応済み |
| 顔認識 | `face_sensing` | 対応済み |
| メッシュ | `mesh` | 未対応（今後移行予定） |
| micro:bit | `microbit` | 未対応（今後移行予定） |
| Teachable Machine | `tm` | 実装予定（拡張機能 ID は `tm2scratch`） |

**旧 API との互換性**: 既存の `Keyboard.pressed?`, `Timer.value`, `Pen.clear` などの定数レシーバー（`ConstantReadNode`）パターンは互換性のために残すが、将来的に `keyboard.pressed?` 等の事前定義レシーバーパターンに刷新予定。

## HAT ブロックの Ruby 表現

**新規実装では必ず事前定義レシーバーパターンを使用する。**

```ruby
# ✅ 新しいパターン（拡張機能の HAT ブロック）
face_sensing.when_face_tilted("left") do
end

microbit.when_button_is("A", "down") do
end

tm.when_image_label_received("label") do
end

# ✅ 新しいパターン（標準イベント、Ruby v2）
when_flag_clicked do
end

# ❌ 旧パターン — 新規実装では使用禁止
self.when(:flag_clicked) do
end
```

`self.when(:symbol)` 形式は Ruby v1 互換のために残しているが、**新しい拡張機能や機能追加では使ってはいけない**。拡張機能の HAT ブロックは `拡張名.when_xxx(args) do ... end` の形式を使う。

### コンバーター実装パターン

```javascript
// registerOnSendWithBlock で HAT ブロックを登録
converter.registerOnSendWithBlock(RECEIVER, 'when_xxx', argCount, 0, params => {
    const {receiver, args, rubyBlock} = params;
    // 引数バリデーション
    const block = converter.changeRubyExpressionBlock(receiver, 'opcode_whenXxx', 'hat');
    converter.addField(block, 'FIELD', args[0]);
    converter.setParent(rubyBlock, block);
    return block;
});
```

### ジェネレーター実装パターン

```javascript
Generator.opcode_whenXxx = function (block) {
    block.isStatement = true;
    const field = Generator.quote_(Generator.getFieldValue(block, 'FIELD', 'default'));
    return `receiver.when_xxx(${field}) do\n`;
};
```

## 実装に必要なファイル

拡張機能の Ruby 対応を追加する際に作成・修正するファイル:

| ファイル | 役割 |
|---------|------|
| `src/lib/ruby-generator/<extension>.js` | Blocks → Ruby 生成 |
| `src/lib/ruby-generator/index.js` | ジェネレーター登録 |
| `src/lib/ruby-to-blocks-converter/<extension>.js` | Ruby → Blocks 変換 |
| `src/lib/ruby-to-blocks-converter/register-converters.js` | コンバーター登録 |
| `src/lib/furigana-annotator.js` | ふりがな対応 |
| `src/locales/ja.js` | 日本語翻訳 |
| `src/locales/ja-Hira.js` | ひらがな翻訳 |
| `test/unit/lib/ruby-generator/<extension>.test.js` | ジェネレーターテスト |
| `test/unit/lib/ruby-to-blocks-converter/<extension>.test.js` | コンバーターテスト |
| `test/unit/lib/furigana-annotator.test.js` | ふりがなテスト |
| `docs/furigana-mapping.md` | ふりがな対応表（ドキュメント） |

---

# Ruby ふりがな方針

Ruby tab の「ふりがな」機能で表示される注釈の設計方針。

実装: `src/lib/furigana-annotator.js`
対応表: `docs/furigana-mapping.md`

## 基本原則

1. **ふりがなは命令ブロックの日本語ラベルに準拠する** — `ja.js` の翻訳キーを参照元とする
2. **prism AST のノードタイプは `node.toJSON().type` で判定** — `node.constructor.name` はプロダクションビルドで minify されるため使用禁止
3. **テストでは変数定義なしのコードを使う** — 事前定義レシーバーは `CallNode` として解析されるため、`pen = 1\npen.xxx` のようなテストは書かない

## 拡張機能のふりがなパターン

事前定義レシーバーの拡張機能は以下の 3 層でふりがなを付与する:

```ruby
# ①レシーバー  ②メソッド  ③引数
# 顔認識        行く       鼻
  face_sensing.go_to("nose")
```

| 層 | 対象 | ふりがなの決め方 |
|----|------|----------------|
| ① レシーバー | `face_sensing`, `pen` 等 | 拡張機能のカテゴリ名（`顔認識`, `ペン`） |
| ② メソッド名 | `go_to`, `stamp` 等 | ブロックラベルから `[MENU]` 部分を除いた形 |
| ③ メニュー引数 | `"nose"`, `"left"` 等 | ブロックのメニュー項目の日本語ラベル |

## メニュー引数のスコープ管理

メニュー引数の文字列ラベル（例: `"nose"` → `鼻`）は **拡張機能専用のコンテキスト限定ラベル** として実装する。グローバルの `_SPECIAL_STRING_LABELS` には追加しない。

**理由**: `"left"` や `"right"` のような汎用的な文字列は、他のコンテキスト（キー名、方向等）でも使われるため、グローバルに設定するとラベルが衝突する。

**実装パターン**:
1. `_FACE_SENSING_PART_LABELS`, `_FACE_SENSING_DIRECTION_LABELS` のような静的マップを定義
2. `_FACE_SENSING_STRING_MAP` でメソッド名 → ラベルマップの対応を定義
3. `_handleCallNode` の引数 walk 直前に `_stringLabelMap` を設定、walk 後にクリア
4. `_handleStringNode` で `_stringLabelMap` を優先チェック

## `_handleCallNode` での事前定義レシーバー検出

```
receiverType === 'CallNode' && !node.receiver.receiver && node.receiver.name === '拡張名'
```

- `CallNode` branch 内で、receiver が「レシーバーなし・引数なし」の CallNode かを確認
- no-receiver branch で `拡張名` 自体のふりがな（カテゴリ名）を付与
- `_isPredefinedReceiver(node, '拡張名')` ヘルパーで `LocalVariableReadNode`（互換）と `CallNode` の両方を判定
