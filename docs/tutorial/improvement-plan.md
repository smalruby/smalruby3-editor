# チュートリアル拡充プラン

> **🆕 計画文書** — 既存チュートリアル機能 (`docs/tutorial/README.md` 参照) を、Welcome モーダルが提示する 3 つの軸 (Block / Ruby / Mesh) + 高校向け DNCL に沿って体系的に拡充するためのロードマップ。

## ゴール

Welcome モーダルの `cardBlocks` / `cardRuby` / `cardMesh` が提示する 3 つの学習軸に、それぞれ段階的なチュートリアル群を用意する。さらに高校生向けの **DNCL チュートリアル** を新設し、共通テスト「情報Ⅰ」の対策に直結する基礎技能とアルゴリズムを提供する。

ユーザーが Welcome → チュートリアル一覧 → カテゴリで学習軸を選ぶ → 同じ題材を Lv1 (コード挿入) → Lv2 (ブロック手組み) → Lv3 (Ruby) と難度別に進めるという既存パターンを、全軸で踏襲する。

## 現状サマリー (2026-05 時点)

### 既存 deck 一覧 (`packages/scratch-gui/src/lib/libraries/decks/index.jsx`)

| Category | Deck ID | Lv | 内容 |
|---|---|---|---|
| `gettingStarted` | `intro-getting-started` | — | ネコがバウンスする最初の Ruby プログラム |
| `chatApp` | `chat-1-basic-1` | Lv1 | メッセージを送ってみよう (コード挿入) |
| `chatApp` | `chat-1-basic-2` | Lv2 | 同じプログラムをブロック手組み |
| `chatApp` | `chat-1-basic-3` | Lv3 | 同じプログラムを Ruby で |
| `chatApp` | `chat-2-sprites-1` | Lv1 | ネコとペンギンで会話しよう |
| `chatApp` | `chat-2-sprites-2` | Lv2 | (Lv2) |
| `chatApp` | `chat-2-sprites-3` | Lv3 | (Lv3) |
| `chatApp` | `chat-3-mesh-1` | Lv1 | メッシュ拡張機能でつながろう |
| `chatApp` | `chat-3-mesh-2` | Lv2 | (Lv2) |
| `chatApp` | `chat-3-mesh-3` | Lv3 | (Lv3) |

合計 10 deck。`gettingStarted` と `chatApp` の 2 カテゴリ。

### 課題

- `chatApp` 1 カテゴリ内に「3 ステップ × 3 lv = 9 deck」が並んでおり、**ステップ軸と lv 軸の 2 軸**が UI 上で見分けにくい (`library.jsx` の `withCategories` は flat list 表示)。
- **Block 軸の独立したチュートリアルが存在しない**。`gettingStarted` の唯一の deck は Ruby 中心。Welcome モーダルが「ブロックで作る」を最初に提示しているのに、ブロック中心の deck が無い。
- **Ruby 軸も 1 deck のみ**で、Smalruby を「Ruby を学ぶ場」として使いたいユーザーには学習素材が不足。
- **DNCL 軸は 0 deck**。Smalruby は DNCL モードを実装済みなのに、共通テスト対策に使える deck が無い。

## 新タクソノミー

### Category キー (改訂後)

`packages/scratch-gui/src/lib/libraries/tutorial-tags.js` の `CATEGORIES` を以下に更新する:

```javascript
export const CATEGORIES = {
    // 既存
    gettingStarted: 'gettingStarted',

    // Phase 1: chatApp を 3 つに分割 (「通信入門」シリーズ番号付け型)
    meshStep1: 'meshStep1', // 通信入門 ① メッセージを送ってみよう
    meshStep2: 'meshStep2', // 通信入門 ② ふたりで会話しよう
    meshStep3: 'meshStep3', // 通信入門 ③ みんなで会話しよう (メッシュ)

    // Phase 3: Block 軸 (教科ラベル型)
    blockBasics: 'blockBasics',   // はじめての操作
    blockGames: 'blockGames',     // ゲームを作ろう
    blockMath: 'blockMath',       // 算数: 幾何学模様
    blockScience: 'blockScience', // 理科: マイクロビット

    // Phase 2: Ruby 軸
    rubyBasics: 'rubyBasics',     // Ruby のきほん

    // Phase 4: DNCL 軸
    dnclBasics: 'dnclBasics',         // DNCL のきほん
    dnclAlgorithms: 'dnclAlgorithms', // アルゴリズム
};
```

`chatApp` キーは削除する (置き換え)。後方互換性のための残置は不要 — 既存 9 deck の `category` 参照を新キーに更新するため。

### `tag-messages.js` に追加する category ラベル

各キーに対応する `gui.libraryCategories.<key>` メッセージを追加する。`defaultMessage` (日本語ベース) と `description` を明記。後段で `ja.js` / `ja-Hira.js` / `en.js` にも翻訳を追加。

### 並び順

`library.jsx` 側でカテゴリの表示順をどう制御するか確認が必要 (現状はオブジェクトのキー順か、deck の出現順に依存する可能性)。新タクソノミーは以下の順を意図:

1. `gettingStarted` — はじめての Ruby
2. `blockBasics` → `blockGames` → `blockMath` → `blockScience` (Block 軸 4 系)
3. `rubyBasics` (Ruby 軸)
4. `meshStep1` → `meshStep2` → `meshStep3` (Mesh 軸 3 ステップ)
5. `dnclBasics` → `dnclAlgorithms` (DNCL 軸 2 区分)

実装時、`library.jsx` で `withCategories` 表示の順序が `CATEGORIES` オブジェクトのキー順に依存しないなら、明示的な順序配列を導入する。

## Phase 1: Mesh 再カテゴリ化

**目標**: 既存 9 deck を 3 カテゴリ × 3 lv に再分類。新規 deck・画像は無し。

**ファイル変更**:

1. `tutorial-tags.js` — `chatApp` 削除、`meshStep1/2/3` を追加。
2. `tag-messages.js` — `gui.libraryCategories.meshStep1/2/3` を追加。3 カテゴリは「通信入門」シリーズとして番号付けし、連続性を可視化する:
   - `meshStep1`: 「通信入門 ① メッセージを送ってみよう」(同じスプライト内で broadcast)
   - `meshStep2`: 「通信入門 ② ふたりで会話しよう」(2 スプライト間で broadcast)
   - `meshStep3`: 「通信入門 ③ みんなで会話しよう (メッシュ)」(複数デバイス間で Mesh 通信)
3. `decks/index.jsx` — 9 deck の `category` 参照を以下にマップ:
   - `chat-1-basic-{1,2,3}` → `CATEGORIES.meshStep1`
   - `chat-2-sprites-{1,2,3}` → `CATEGORIES.meshStep2`
   - `chat-3-mesh-{1,2,3}` → `CATEGORIES.meshStep3`
4. `locales/{ja,ja-Hira,en}.js` — 新 category キーの翻訳を追加。
5. `library.jsx` — カテゴリ並び順の制御を確認。必要なら順序配列を追加。

**確認項目**:
- チュートリアル一覧でカテゴリ見出しが 3 段階に分かれ、各見出し下に Lv1/Lv2/Lv3 が並ぶこと。
- カテゴリ名で「ステップになっていること」が一目で分かること (「メッセージを送ってみよう」→「ふたりで会話」→「みんなで会話」の進行)。
- 既存 deck の挙動 (allowedBlocks、urlId、deckIds ナビゲーション) に副作用が無いこと。

**画像**: 既存 deck の画像を流用するため新規撮影なし。

**規模見積もり**: 1 PR、変更 5 ファイル前後、~30 分。

## Phase 2: Ruby 軸 — TryRuby ベース拡充

**目標**: `rubyBasics` カテゴリに 6〜7 deck を追加。最終 deck で TryRuby (https://try.ruby-lang.org/) への導線を提供。

### `puts` を採用して「本物の Ruby」感を出す

Smalruby の Ruby → ブロック変換は **`puts` / `print` / `p` を `looks_say` / `looks_sayforsecs` にマップ**する (`packages/scratch-gui/src/lib/ruby-to-blocks-converter/looks.js`、`packages/scratch-gui/src/lib/ruby-generator/looks.js`)。つまり同じ `puts "Hello"` というコードが:

- Smalruby では **スプライトが「Hello」としゃべる** (可視的フィードバック)
- 標準 Ruby / TryRuby では **コンソールに「Hello」と出力** (テキストフィードバック)

として動く。Phase 2 のコード例は `say(...)` ではなく **`puts ...` を一貫して使う**。これにより:

- 教科書・参考書・TryRuby・irb と **同じコード** が Smalruby でも書ける
- 最終 deck で TryRuby に移行した際、学んだコードがそのまま流用できる
- `puts` の引数は **改行不要・複数文字列 OK** という Ruby の標準仕様を最初から体験できる
- Smalruby は可視成果 (スプライトがしゃべる) で、TryRuby はテキスト出力で同じコードを試せる、という対比が学習者に伝わる

### deck 候補 (TryRuby との対応)

TryRuby 日本語訳 56 レッスン (`~/ghq/github.com/ruby/TryRuby/translations/ja/try_ruby_*.md`) から、Smalruby のスプライト世界に翻案しやすいものを抽出する。Smalruby 翻案では **`puts` で結果をスプライトにしゃべらせる**:

| Deck ID | カテゴリ | Lv1 内容 | TryRuby 対応 | Smalruby 翻案 (puts ベース) |
|---|---|---|---|---|
| `ruby-basics-1-numbers` | rubyBasics | 計算してみよう (`4 * 10`, `5 - 12`) | try_ruby_20〜40 | `puts 4 * 10` でネコが「40」としゃべる |
| `ruby-basics-2-strings` | rubyBasics | 文字列を逆さに (`"スモウルビー".reverse`) | try_ruby_50〜100 | `puts "スモウルビー".reverse` |
| `ruby-basics-3-variables` | rubyBasics | 変数で覚える (`name = "ネコ"`) | try_ruby_110〜140 | `name = "ネコ"; puts "こんにちは " + name` |
| `ruby-basics-4-arrays` | rubyBasics | リストを使う (`ticket = [12, 47, 35]`) | try_ruby_150〜200 | `ticket = [12, 47, 35]; puts ticket.reverse` |
| `ruby-basics-5-blocks` | rubyBasics | ブロックで繰り返す (`5.times { |i| ... }`) | try_ruby_290〜310 | `5.times { |i| puts i }` で 0〜4 を順にしゃべる |
| `ruby-basics-6-methods` | rubyBasics | メソッドを作る (`def`) | try_ruby_350〜420 | `def hello(name); puts "Hi " + name; end` |
| `ruby-basics-7-next` | rubyBasics | 次に進もう (TryRuby 導線) | try_ruby_560 (まとめ) | 「ここまでで学んだ `puts` のコードは TryRuby でもそのまま動くよ」+ 外部リンクボタン |

各 deck は Lv1 のみ (= `intro-getting-started` 同様、コード挿入で動くものを体験するスタイル) でスタートし、必要に応じて Lv2 (ブロック組み立て) / Lv3 (応用) を追加できる構造にする。**Lv2/Lv3 は Phase 2 のスコープ外** とし、まずは Lv1 のみで「Ruby だけで一通り学べる」体験を提供する。

### Smalruby 固有命令との関係

`puts` を中核に据えるが、deck の発展ステップでは **`move`, `turn_right`, `bounce_if_on_edge` などの Smalruby スプライト命令** を組み合わせる例も入れて、「Ruby の文法 + Smalruby ならではの絵が動く」という両面を見せる。たとえば `ruby-basics-5-blocks` の発展ステップで:

```ruby
5.times do |i|
  puts "step #{i}"
  move(20)
end
```

のように `puts` で進捗をしゃべりながらネコを動かす、といった構成を取る。

### TryRuby 導線の実装

`ruby-basics-7-next` の最終ステップで:
- 「Smalruby で書いた `puts` のコードは、TryRuby や本物の Ruby でもそのまま動くよ」と橋渡しメッセージ
- 「TryRuby を開く」ボタン (新規タブで https://try.ruby-lang.org/ を開く — TryRuby は URL パスでの言語指定を受け付けないため必ずルートを使う)
- step 構造は既存の `deckIds` ナビゲーション拡張で実装するか、`code` フィールドを使わず外部 URL を持つ新しい step プロパティ (`externalUrl`) を追加するかは実装時に判断。後者の場合 `cards.jsx` の対応も必要。

### 画像戦略

- Lv1 のみなので 1 deck あたり 5〜7 ステップ × 7 deck ≒ **35〜50 枚**。
- Playwright MCP + Monaco エディタの自動キャプチャで生成 (`tutorial.md` の手順)。
- 出力は ASCII アート的なコンソール出力ではなく、**スプライトが結果をしゃべる/動く** 形にして Smalruby らしさを出す。

**規模見積もり**: 2〜3 PR (deck 構造 → 画像 → 翻訳)、合計 1〜2 週間規模。

### 開放されている設計判断

- TryRuby 由来の課題を **どこまで忠実に再現**するか (TryRuby の正解判定 `answer` regex の概念は Smalruby には無いので、ゴールの示し方をどうするか)。
- 既存 `intro-getting-started` と `ruby-basics-1-numbers` の関係 (前者を Phase 2 で削除して `ruby-basics-0-intro` にリネームするか、共存させるか)。実装時に決定する。

## Phase 3: Block 軸 — 書籍プロモーションを兼ねた抜粋チュートリアル

**位置づけ**: Phase 3 のチュートリアルは、藤村健吾氏の Smalruby 書籍 (`tmp/kirakiraruby/0[1456]_*.docx` がドラフト) の **抜粋プロモーション** として設計する。書籍そのものの代替ではなく、書籍購入と組み合わせて使うことを前提にした「試食」体験。

### 目的と意図

1. **書籍販売数の増加に貢献する**。Smalruby は無料 OSS でも、関連書籍が売れることで著者の継続的なコンテンツ制作・コミュニティ支援につながる。
2. **理想形は「先生が書籍を購入 → 児童に配布 → 書籍とチュートリアルを並行して進める」**。チュートリアルだけでも完結はするが、深い理解には書籍が必要、という設計にする。
3. **書籍コンテンツの引用であることを明示**。各 deck の冒頭・末尾で書誌情報を表示し、書籍ページへの導線を置く。

### スコープ削減ルール (重要)

各章 (= 各カテゴリ) のチュートリアル対象は、**書籍の「前半部分の一部」だけ** に絞る。章全体や 【発展】 セクションをカバーしない:

- **【基本】 セクションの中で、最初の数小節だけ** を Lv0 / Lv2 / Lv3 で扱う。途中で「続きは書籍の第n章で」と打ち切る。
- **【発展】 セクションは Lv0 のみ** を用意する (= 完成コードを `code` で挿入して「こう動くよ」と見せるだけ)。Lv2 / Lv3 の解説は提供しない。「詳しい作り方は書籍を見てね」で誘導。

### Lv 体系 (Mesh の Lv1/Lv2/Lv3 とは別の番号付け)

書籍ベース系列は意図的に **Lv0 / Lv2 / Lv3** という番号で運用し、**Lv1 を「書籍を読んで理解する段階」として明示的に空ける**:

| Lv | 場所 | 内容 |
|---|---|---|
| **Lv0** | チュートリアル | コード挿入で動くものを体験 (最も簡単・最初の入り口) |
| Lv1 | (書籍) | コードの意味・なぜ動くかの解説 — チュートリアルでは扱わず、書籍で学ぶ |
| **Lv2** | チュートリアル | ブロックを自分で組み立てる (書籍を読んだ前提) |
| **Lv3** | チュートリアル | Ruby で書く (書籍を読んだ前提) |

この欠番構造によって「次の段階の理解は書籍にある」というメッセージを **deck の構造そのもの**で表現する。既存の Mesh `chat-*` 系列の Lv1/Lv2/Lv3 とは独立した番号付けで、ユーザーが「Mesh の Lv1」と「Block の Lv0」を混同しないよう各 deck のタイトルで明示する。

### deck マッピング

各章は **基本 (一部抜粋) 3 deck + 発展 1 deck = 4 deck**、合計 4 章 × 4 deck = **16 deck**:

| カテゴリ | 章 | 基本 Lv0 | 基本 Lv2 | 基本 Lv3 | 発展 Lv0 | 題材 |
|---|---|---|---|---|---|---|
| `blockBasics` | 第1章 | `block-basics-lv0` | `block-basics-lv2` | `block-basics-lv3` | `block-basics-advanced` | 【基本】ネコからにげるゲーム冒頭の数小節 / 【発展】ネズミ追加 (動くデモのみ) |
| `blockGames` | 第4章 | `block-shooting-lv0` | `block-shooting-lv2` | `block-shooting-lv3` | `block-shooting-advanced` | 【基本】「ネコを上下に動かす」「ネコがタマをうつ」あたりまで / 【発展】クローンで敵増殖 (動くデモのみ) |
| `blockMath` | 第5章 | `block-math-lv0` | `block-math-lv2` | `block-math-lv3` | `block-math-advanced` | 【基本】正三角形・正方形をかく節まで / 【発展】幾何学模様・色変更 (動くデモのみ) |
| `blockScience` | 第6章 | `block-science-lv0` | `block-science-lv2` | `block-science-lv3` | `block-science-advanced` | 【基本】文字表示・加速度センサーで「動いた」検出まで / 【発展】だるまさんが転んだ (動くデモのみ) |

各 deck の最終ステップで **「ここまでの解説は書籍 第n章の冒頭部分です。続きは書籍をご覧ください」** のメッセージ + 書籍へのリンクを表示する。

### deck 内に組み込む書籍プロモーション要素

#### 1. オープニングステップ (deck 開始時)

```
📖 「キラキラRuby」(藤村健吾 著) 第n章 より
   このチュートリアルでは本書 第n章の冒頭部分を体験できます
```

書誌情報を表示 (タイトル仮称: 「キラキラRuby」、著者、章番号)。`step` に `book` プロパティを追加するか、`title` 内にこの情報を含めるかは実装時に決定。

#### 2. クロージングステップ (deck 終了時、共通)

```
ここまでで体験したのは本書 第n章の最初の数ページの内容です。
このあとは「○○」「△△」と続いていきますが、詳しい解説は書籍をご覧ください。

📖 書籍を購入する → [リンク]
👨‍🏫 先生・保護者の方へ:
   本書を購入して児童・お子さんに配布し、チュートリアルと並行して
   進めると、より深く理解できます。
```

#### 3. 発展 deck の Lv0 のみクロージング

```
ここで動かしたプログラムは本書 第n章 【発展】 セクションのものです。
このプログラムをゼロから自分で作る手順は、本書をご覧ください。

📖 書籍を購入する → [リンク]
```

### 第6章 (理科) の特殊事情

- **microbitMore 拡張** に依存。チュートリアル開始時に拡張を自動ロード (`extensionId` プロパティを step に持たせる) するか、利用者に手動でロードしてもらうかは実装時に判断。`allowedBlocks` に microbitMore のブロックを含める。
- **Scratch Link / Bluetooth** が必要なステップは「画面で説明するだけで、実機なしでも学習が成立する」設計にする。
- 既存の `docs/extension-microbit-more/README.md` と整合させる。

### 第5章 (算数) の特殊事情

- **ペン拡張**に依存。同上で `allowedBlocks` にペンブロックを含める。
- 正多角形の角度計算 (`360 / n`) を扱う step は **算数の学習指導要領との接続** を意識した解説を入れる (ただし詳細は書籍委ね)。

### 画像戦略 (段階的に作る) — スコープ削減版

書籍前半の一部に絞ったことと、発展 deck が Lv0 のみになったことで画像数を大幅圧縮できる:

- **基本 Lv0** (4 deck × ~5 ステップ) = 20 枚 — 動かしてみるだけのシンプル構成
- **基本 Lv2** (4 deck × ~6 ステップ) = 24 枚 — `blocks-screenshot.js` でブロック画像生成
- **基本 Lv3** (4 deck × ~5 ステップ) = 20 枚 — Monaco エディタスクリーンショット
- **発展 Lv0** (4 deck × ~3 ステップ) = 12 枚 — 完成デモを見せる程度

合計 **約 76 枚**。最初の見積もり (~100 枚) から 25% 削減。

**規模見積もり**: 1 章 (基本 3 deck + 発展 1 deck = 4 deck) で 1 PR、合計 4 PR。書籍引用文言の調整も含めて 3〜5 週間規模。

### 開放されている設計判断

- **書籍の正式タイトル・出版社・URL** — `tmp/kirakiraruby/` のドラフトしか手元になく、書誌情報が未確定。Phase 3 着手前にユーザーから書誌情報を提供してもらう必要がある (タイトル、著者、出版社、ISBN、購入リンクまたは公式案内ページ)。
- **書籍引用の権利関係** — チュートリアルに書籍のサンプルコード・章タイトル・引用文を載せることについて、著者本人 (藤村健吾氏) の許諾を得る必要がある。藤村氏との合意フローを Phase 3 着手前に通す。
- **書籍リンクの保守** — 書籍ページ URL が変わると 4 deck × 2 ステップ = 8 箇所の修正が必要。共通定数化 (例: `BOOK_URL` を 1 箇所で定義) して保守しやすくする。
- **「先生向け」「保護者向け」メッセージの粒度** — クロージングステップに含めるか、別経路 (Welcome モーダルなど) で出すか。
- **`intro-getting-started` (既存) と `block-basics-lv0` (新) の前後関係** — Welcome モーダルの「Build with blocks」CTA をクリックしたら `block-basics-lv0` が開くようにしたい (現状は tipsLibrary を開くだけ)。Welcome → 特定 deck 直接起動の機構を導入するかは別議論。

## Phase 4: DNCL 軸 — 高校生向け

**目標**: `dnclBasics` (5〜6 deck) + `dnclAlgorithms` (5〜7 deck) を追加。共通テスト「情報Ⅰ」対策の入り口になる。

### 学習者像

- **大学入学共通テスト「情報Ⅰ」を受験する高校生**
- 大半は **初めてテキストでプログラミングをする** 想定
- 既に DNCL モードでサンプルプログラムを読めるが、自力で書き上げる経験が乏しい

### `dnclBasics` (基礎技能)

| Deck ID | 内容 | DNCL 機能 |
|---|---|---|
| `dncl-basics-1-display` | 文字や数字を表示する | `表示する` |
| `dncl-basics-2-variables` | 変数を使う | `← 代入` / `=` 比較 |
| `dncl-basics-3-conditionals` | もし〜ならば | `もし ... ならば:` / `そうでなければ` |
| `dncl-basics-4-loops` | 繰り返す | `を繰り返す` / `の間繰り返す:` / `増やしながら繰り返す:` |
| `dncl-basics-5-arrays` | 配列を使う | 添字、ループとの組み合わせ |
| `dncl-basics-6-functions` | 関数を定義する | `NAME(ARGS) を定義する` |

**進め方**: Lv 分けはせず、各 deck で「DNCL コードを Ruby タブに貼り付け → 実行 → 一部を変更して挙動を確認」のワンパスとする。Lv 分けは将来の課題。

### `dnclAlgorithms` (アルゴリズム + 試作問題)

[nodai2hitc.github.io/ictl_example](https://nodai2hitc.github.io/ictl_example/) の DNCLv2 サンプル 19 題から、共通テスト頻出パターンを抽出:

| Deck ID | 題材 | 元サンプル | アルゴリズム概念 |
|---|---|---|---|
| `dncl-alg-1-fizzbuzz` | FizzBuzz | サンプル 13 | 複合条件分岐、剰余 |
| `dncl-alg-2-frequency` | 出現頻度を数える | サンプル 10 | カウンタ配列、線形探索 |
| `dncl-alg-3-caesar` | シーザー暗号復号 | サンプル 11, 12 | モジュロ演算、文字配列 |
| `dncl-alg-4-binsearch` | 二分探索 | サンプル 19 | 分割探索 (重要: 試作問題で頻出) |
| `dncl-alg-5-greedy-coins` | 硬貨枚数 (欲張り法) | サンプル 17 | 貪欲法、降順反復 |
| `dncl-alg-6-trial-exam` | 試作問題 第2問 (得票配分) | サンプル 14〜16 | 比例配分、最大剰余法、制約付き集計 |

### 試作問題対応

[文部科学省 試作問題 (R3.10)](https://www.mext.go.jp/content/20211014-mxt_daigakuc02-000018441_9.pdf) **第2問** をゴールに設定し、`dncl-alg-6-trial-exam` で完答できることを目標とする。デザイン時に PDF の問題文を解析して、必要な前提知識を `dnclBasics` + `dnclAlgorithms` の前半 deck でカバーできているか確認する。

### 共通テスト対策方針 ([四谷学院解説](https://www.yotsuyagakuin.com/b_geneki/kyotsu-test-jouhou/) より)

- 試験は 60 分 / 100 点で 40 題程度を解く → **時間内に読解 + 実行を回せる** 力を養う
- プログラミング/データ活用で配点 50% → アルゴリズム deck の比重を上げる
- 「丸暗記より体系的理解」 → 各 deck で 「**なぜ動くか**」 を必ず説明する step を入れる

### 教育研究との接続

[IPSJ DP64-U06 (CFRP を基準とした分析)](https://www.ipsj.or.jp/dp/contents/publication/64/DP64-U06.html) を参考に、教育的に必要な概念を deck の説明文に反映する。具体的な抽出は実装フェーズで行う。

### 画像戦略

- DNCL は文字主体なので、ブロック画像は不要 (Ruby タブのエディタスクリーンショット中心)。
- Monaco エディタの DNCL モードハイライト + 実行結果を並べた 2 ペイン構成を想定。
- 1 deck あたり 5〜6 ステップ × 12 deck = **約 70 枚**。

**規模見積もり**: `dnclBasics` で 1 PR、`dnclAlgorithms` で 1〜2 PR、合計 3〜4 週間規模。

### 開放されている設計判断

- DNCL モードへの **自動切替** をチュートリアル開始時に行うか、利用者に手動で切り替えてもらうか。前者なら `tab` + `rubyMode` URL パラメータと同等の仕組みを step に持たせる必要がある。
- 試作問題第2問の **完全な解答を deck で示す** か、誘導しつつ最終解答は学習者に委ねるか。教育的には後者だが、自学自習用ツールとしては前者の方が完結する。

## 共通の実装方針

### チュートリアル起動時の環境セットアップ (横断機能)

各 Phase のチュートリアルは「Ruby タブを開いた状態」「DNCL モードで」「ペン拡張を有効化した上で」など、**特定の環境前提**を必要とする。利用者が手動で正しい状態に持っていく負担をなくすため、**deck 起動時に必要なモード遷移と拡張機能ロードを自動実行**できる仕組みを導入する。

#### 新規 deck プロパティ: `setup`

deck 定義に `setup` オブジェクトを追加し、起動時の前提条件を宣言する:

```javascript
'deck-id': {
    setup: {
        tab: 'ruby',                       // 'code' | 'costumes' | 'sounds' | 'ruby'
        rubyMode: 'dncl',                  // 'ruby' | 'furigana' | 'dncl' (tab='ruby' のときのみ有効)
        extensions: ['pen', 'microbitMore'], // 拡張機能 ID 配列、未ロードのものを自動ロード
        rubyVersion: 2,                    // 1 | 2 (省略時は現状維持)
    },
    name: <FormattedMessage ... />,
    steps: [ ... ]
}
```

`setup` は **deck 単位** で 1 回適用される (step 単位ではない)。チュートリアル中で別タブに移動するなどの操作は step の `animationTarget` で別途扱う。

#### 実装方針

`tips-library.jsx` の `handleItemSelect` で `onActivateDeck` を dispatch する直前に `setup` を適用するヘルパーを呼ぶ。または `activateDeck` action 自体を thunk 化して setup を内包させる。具体的には:

1. **`activateTab(setup.tab)` を dispatch** (editor-tab reducer) — `setup.tab` 指定時のみ。
2. **Ruby モード切替**:
   - `setup.rubyMode === 'dncl'` → `dispatch(setDnclMode(true))`
   - `setup.rubyMode === 'furigana'` → `dispatch(setDnclMode(false))` + ふりがな enabled flag を true に
   - `setup.rubyMode === 'ruby'` → `dispatch(setDnclMode(false))` + ふりがな enabled flag を false に
3. **拡張機能ロード**:
   - `vm.extensionManager.isExtensionLoaded(extId)` で現在状態を確認
   - 未ロードなら `await vm.extensionManager.loadExtensionURL(extId)` を順次実行 (Promise 直列)
   - 全拡張のロードが終わってから 1 ステップ目を表示
4. **Ruby バージョン切替** (オプション、`setup.rubyVersion` 指定時のみ):
   - 既存の `ruby_version` URL パラメータと同じ reducer を利用 (`settings.js` の該当 action)

#### 設計上の考慮点

- **冪等性**: 既に正しい状態のときは何もしない (拡張が既にロード済み、タブが既に同じ、など)。これにより同じ deck を再起動しても安全。
- **エラーハンドリング**: 拡張ロードが失敗した場合は、deck を開始しつつ「拡張機能のロードに失敗しました。手動でロードしてから再度お試しください」と step 内で警告する (拡張不要の deck は影響を受けない)。
- **ロード中の UX**: 拡張ロードに数秒かかる場合、deck カードを表示する前にローディングインジケータを出す。
- **既存 deck への影響**: 既存 10 deck は `setup` を持たないため、フィールド未定義時は **何も実行しない** (現状動作を維持)。後方互換あり。
- **Welcome モーダル CTA との接続**: `setup` を持つ deck を welcome モーダルの 3 つの CTA に紐付ければ、「Build with blocks → Code タブで `block-basics-lv0` 起動」が 1 クリックで成立する。

#### Phase 別の具体例

| Phase | deck 例 | 必要な setup |
|---|---|---|
| Phase 1 (Mesh 再分類) | 既存 `chat-*` | 変更なし (setup なし) |
| Phase 2 (Ruby) | `ruby-basics-1-numbers` | `tab: 'ruby', rubyMode: 'ruby'` |
| Phase 3 (Block 第5章) | `block-math-lv0` | `tab: 'code', extensions: ['pen']` |
| Phase 3 (Block 第6章) | `block-science-lv0` | `tab: 'code', extensions: ['microbitMore']` |
| Phase 3 (Lv3 全般) | `block-*-lv3` | `tab: 'ruby', rubyMode: 'ruby'` |
| Phase 4 (DNCL) | `dncl-basics-1-display` | `tab: 'ruby', rubyMode: 'dncl'` |

#### 実装順序

この基盤は **Phase 1 完了直後 (= Phase 2 着手前)** に独立 PR として実装する。Phase 2 以降のすべての新規 deck がこれに依存する。

#### 開放されている設計判断

- **「furigana」モードの内部状態**: 既存 `dncl-mode` reducer は二値 (dncl on/off) のみ。furigana 表示は別のフラグ (`smalruby:furiganaEnabled` localStorage) で管理されているため、`setup.rubyMode = 'furigana'` を実現するには両方の state を同時に更新する必要がある。
- **拡張ロードに失敗した deck の振る舞い**: deck 開始を中止するか、警告付きで開始するか。教育用途では「とにかく動かしてもらう」優先で後者を採用する想定。
- **`setup` を deck から step 単位に拡張するか**: 将来「途中で拡張を追加で有効化したい」ケースが出たら検討。当面は不要。

### Deck 命名規約

- ID: `<category>-<subseries>-<lv>` (例: `mesh-step1-lv1`, `block-basics-lv2`, `dncl-alg-binsearch`)。
- 既存の `chat-1-basic-1` などは Phase 1 では **リネームせず**、category 参照のみ更新する (URL / 履歴互換性のため)。
- 新規 deck では上記命名規約を採用。

### message ID 規約

- カテゴリ: `gui.libraryCategories.<categoryKey>` (例: `gui.libraryCategories.meshStep1`)
- deck 名: `gui.howtos.<deck-id>.name`
- step タイトル: `gui.howtos.<deck-id>.stepN.title`

### locale 更新

すべての変更で `ja.js` / `ja-Hira.js` / `en.js` の 3 ファイルを必ず更新する (`smalruby-prettier-files.md` 記載のファイル)。

### Prettier ホワイトリスト

`decks/index.jsx`, `tutorial-tags.js`, `tag-messages.js`, `tips-library.jsx` は既に Smalruby ホワイトリストの一部ではない (upstream ファイル)。新規 step 画像ディレクトリは Prettier 対象外なので追加不要。

### Smalruby マーカー

`decks/index.jsx` / `tutorial-tags.js` / `tag-messages.js` は upstream ファイルなので、新規追加部分のうち **Smalruby 独自カテゴリ・deck** はマーカーで囲む。`.claude/rules/scratch-gui/smalruby-markers.md` に追記する。

### テスト

- ユニット: 既存 `test/unit/lib/libraries/decks/` (もしあれば) を確認しつつ、新 deck の `name` / `steps` / `category` が undefined にならない smoke test を追加。
- インテグレーション: 各 Phase の最後に Playwright MCP で「カテゴリ表示が意図通り」「deck を開いて 1 step 進める」「Lv1 → Lv2 ナビゲーションが繋がる」を確認。

## Phase 進行順とリリース粒度

1. **Phase 1: Mesh 再分類** — 1 PR、画像なし、リスク低。最初に commit する。
2. **基盤 PR: `setup` プロパティ導入** — deck 起動時のタブ・モード・拡張機能の自動セットアップ機構を実装。新規 deck 無し、共通基盤のみ。Phase 2 以降の前提となる。
3. **Phase 2: Ruby 拡充** — `ruby-basics-1-numbers` 単体 PR で構造を確立 → 残り 5 deck を deck 数本ずつ PR。`setup.tab='ruby'` を使用。
4. **Phase 3: Block 4 系列** — 1 章 (基本 3 deck + 発展 1 deck = 4 deck) で 1 PR、合計 4 PR。`blockBasics` → `blockGames` → `blockMath` → `blockScience` の順。`blockMath` 以降で `setup.extensions` を活用 (ペン / microbitMore)。書籍引用文言と書籍リンクの統一処理も含む。
5. **Phase 4: DNCL** — `dnclBasics` 全 6 deck で 1 PR、`dnclAlgorithms` を 2〜3 PR に分割。`setup.rubyMode='dncl'` で起動時に DNCL モードへ自動遷移。試作問題 deck は最後。

各 Phase の完了時に **Welcome モーダルの該当 CTA が新しい deck を開くように接続**する (現状は tipsLibrary を開くだけ → 特定 deck を直接開く改修が必要かは Phase 2 開始時に判断)。

## リスクと open question

- **画像メンテナンス負荷**: 約 200 枚の step 画像。UI 改修のたびに大量の撮り直しが発生する。Lv1 を増やしすぎないようにスコープ管理する。
- **`library.jsx` のカテゴリ並び順制御**: 現状の挙動 (オブジェクトキー順 or 出現順) を Phase 1 で確認し、明示的な順序配列を入れるかを決定する。
- **Welcome モーダル ↔ 特定 deck の連携**: 現在 `onStartTutorial` は tipsLibrary を開くだけ。3 つの CTA (Block / Ruby / Mesh) からそれぞれ対応する Lv1 deck を直接開けるように改修するかは、Phase 1 完了後に検討。
- **試作問題の解答提示の妥当性**: Phase 4 で文科省 PDF の解答を直接 deck に書くことの教育的妥当性 (出典明示で問題ないか) を確認する。
- **TryRuby との重複**: Ruby 軸を充実させすぎると TryRuby と内容が被る。Smalruby は **`puts` を共通言語にしつつ「絵が動く Ruby」** に振り、TryRuby はコンソール出力で同じコードを試せる場として導線で繋げる。同じコードが両環境で動くという連続性を学習者に体験させる。

## 参考資料

- [Welcome モーダル実装](../../packages/scratch-gui/src/components/welcome-modal/welcome-modal.jsx)
- [チュートリアル機能の説明](README.md) (本ドキュメントと同ディレクトリ)
- [`.claude/rules/scratch-gui/tutorial.md`](../../.claude/rules/scratch-gui/tutorial.md) — deck 構造、画像撮影フロー、Lv1〜Lv3 のパターン
- [docs/dncl/README.md](../dncl/README.md) — DNCL モード仕様
- [docs/extension-mesh-v2/README.md](../extension-mesh-v2/README.md) — Mesh v2 拡張
- [docs/extension-microbit-more/README.md](../extension-microbit-more/README.md) — Phase 3 第6章で参照
- TryRuby 日本語訳: `~/ghq/github.com/ruby/TryRuby/translations/ja/try_ruby_*.md`
- 書籍原稿: `tmp/kirakiraruby/0[1456]_*.docx`
- DNCLv2 サンプル: <https://nodai2hitc.github.io/ictl_example/>
- 共通テスト試作問題: <https://www.mext.go.jp/content/20211014-mxt_daigakuc02-000018441_9.pdf>
- 共通テスト「情報」対策方針: <https://www.yotsuyagakuin.com/b_geneki/kyotsu-test-jouhou/>
- IPSJ 教育研究 (DP64-U06): <https://www.ipsj.or.jp/dp/contents/publication/64/DP64-U06.html>
