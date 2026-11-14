# ブロック

ブロックのカテゴリ（なかま）の色を 3 つの色のモードごとに、ブロックのまわり（カテゴリの欄・ブロックパレット・数字パッドなど）の色、ブロックの形の寸法をまとめる。

- **値の正**: 色は上流 scratch-editor tag `v13.7.2` の `packages/scratch-gui/src/lib/settings/color-mode/{default,high-contrast,dark}/index.js`。形と文字は scratch-blocks `2.1.19`（tag `v13.7.2` の `package.json` と同じ版）と、それが引き継ぐ Blockly `12.4.1` の zelos レンダラー。基準は `.claude/rules/upstream-tracking.md`（develop ではなくタグで見る）。
- **スモウルビーとの差**: `packages/scratch-gui/src/lib/settings/color-mode/` の 6 つのファイル（`index.js`・`blockHelpers.js`・`persistence.js`・3 つのモードの `index.js`）は tag `v13.7.2` と同じ。スモウルビーはカテゴリを足しておらず、カテゴリの色も変えていない（下の「スモウルビーの拡張機能の色」）。
- **確かめ方**: 下の値は、ソースを読んだうえで、dev server を headless で開き、3 つのモードに切りかえて実際のブロックの `fill`・`stroke`、`--colour-*`、レンダラーの定数（`getRenderer().getConstants()`）を読んで合わせた（カテゴリの色・`--colour-*`・形の定数は、実行中の値とすべて一致した）。ソースからは分からず実行中に読んだ値には「実測」と書いた。

## 3 つの色のモード

| モード | id | 選べるか | ブロックのアイコン | 拡張機能の色 |
|---|---|---|---|---|
| オリジナル | `default` | 選べる（既定） | `blocks-media/default` | 拡張機能ごとの色（下の「拡張機能の色」） |
| 高コントラスト | `high-contrast` | 選べる | `blocks-media/high-contrast`（黒いアイコン） | すべて `pen` の色。上流の 6 つの拡張機能（音楽・ペン・音声合成・翻訳・ビデオモーション・顔の検出）はアイコンも高コントラスト用にかわる |
| ダーク | `dark` | **選べない**（定義だけある） | `blocks-media/default` | すべて `pen` の色 |

- 設定メニューの「色のモード」が出すのは**オリジナルと高コントラストの 2 つだけ**（`packages/scratch-gui/src/components/menu-bar/settings-menu.jsx` の `enabledColorModes`）。ダークは上流でもまだ使えない（`packages/scratch-gui/src/lib/settings/color-mode/persistence.js` のコメント「Dark mode isn't enabled yet」）。
- 選んだモードはクッキー `scratchtheme` に 1 年残る。クッキーが無いときは OS の設定に従い、`(prefers-contrast: more)` なら高コントラストになる。
- 色のモードが変えるのは**ブロックとそのまわりだけ**。メニューバー・モーダルなど GUI の枠は変わらない（[`README.md`](README.md) の「方針」）。
- 高コントラスト・ダークの値は、書いていない項目をオリジナルの値で埋めてから使う（`packages/scratch-gui/src/lib/settings/color-mode/index.js` の `mergeWithDefaults` = `lodash.defaultsdeep`）。下の表はその埋めたあとの値。

## 4 つの色の役目

カテゴリごとに 4 つの色を持つ。Blockly に直接わたすので、名前は英国のつづり（`colour`）。

| 名前 | どこに使うか |
|---|---|
| `colourPrimary` | ブロックの地。カテゴリの欄の丸の地（どちらも実測） |
| `colourSecondary` | ブロックの中のドロップダウン（「どこかの場所 ▼」のような、まわりと同じなかまの影のブロック）の地（実測）。ブロック定義の「定義」の中の見本のブロックの地（`scratch-blocks/src/renderer/path_object.ts`） |
| `colourTertiary` | ブロックの縁（`stroke`）。中の白い入力欄の縁。空いている六角形の入力の地。カテゴリの欄の丸の縁（どれも実測） |
| `colourQuaternary` | ドロップダウンを開いている間の、ドロップダウンの地（`scratch-blocks/src/fields/scratch_field_dropdown.ts` が `<なかま>_selected` のスタイルに一時的にかえる。実測: オリジナルの動きで `#4280D7` → 開いている間 `#3373CC`） |

白い入力欄（数・文字）の地は、どのモードでも実測 `#fff`。文字は下の「文字」。

## カテゴリの色

「なかま」の列は日本語の画面での名前。`data_lists` はカテゴリではなく、変数のカテゴリの中のリストのブロックを分けるための色。`pen` はカテゴリの欄には出ず、高コントラスト・ダークのときにすべての拡張機能が使う色（下の「拡張機能の色」）。

値はソースの書き方のまま（`#0fBD8C` の小文字もそのまま）。

### オリジナル（`default`）

| キー | なかま | Primary | Secondary | Tertiary | Quaternary |
|---|---|---|---|---|---|
| `motion` | 動き | `#4C97FF` | `#4280D7` | `#3373CC` | `#3373CC` |
| `looks` | 見た目 | `#9966FF` | `#855CD6` | `#774DCB` | `#774DCB` |
| `sounds` | 音 | `#CF63CF` | `#C94FC9` | `#BD42BD` | `#BD42BD` |
| `event` | イベント | `#FFBF00` | `#E6AC00` | `#CC9900` | `#CC9900` |
| `control` | 制御 | `#FFAB19` | `#EC9C13` | `#CF8B17` | `#CF8B17` |
| `sensing` | 調べる | `#5CB1D6` | `#47A8D1` | `#2E8EB8` | `#2E8EB8` |
| `operators` | 演算 | `#59C059` | `#46B946` | `#389438` | `#389438` |
| `data` | 変数 | `#FF8C1A` | `#FF8000` | `#DB6E00` | `#DB6E00` |
| `data_lists` | （リスト） | `#FF661A` | `#FF5500` | `#E64D00` | `#E64D00` |
| `more` | ブロック定義 | `#FF6680` | `#FF4D6A` | `#FF3355` | `#FF3355` |
| `pen` | （拡張機能） | `#0fBD8C` | `#0DA57A` | `#0B8E69` | `#0B8E69` |

見本: [`0601-blocks-default.png`](screenshots/0601-blocks-default.png)

### 高コントラスト（`high-contrast`）

地を明るくし、文字を黒にする。縁（Tertiary）はオリジナルと同じ。

| キー | なかま | Primary | Secondary | Tertiary | Quaternary |
|---|---|---|---|---|---|
| `motion` | 動き | `#80B5FF` | `#B3D2FF` | `#3373CC` | `#CCE1FF` |
| `looks` | 見た目 | `#CCB3FF` | `#DDCCFF` | `#774DCB` | `#EEE5FF` |
| `sounds` | 音 | `#E19DE1` | `#FFB3FF` | `#BD42BD` | `#FFCCFF` |
| `event` | イベント | `#FFD966` | `#FFECB3` | `#CC9900` | `#FFF2CC` |
| `control` | 制御 | `#FFBE4C` | `#FFDA99` | `#CF8B17` | `#FFE3B3` |
| `sensing` | 調べる | `#85C4E0` | `#AED8EA` | `#2E8EB8` | `#C2E2F0` |
| `operators` | 演算 | `#7ECE7E` | `#B5E3B5` | `#389438` | `#DAF1DA` |
| `data` | 変数 | `#FFA54C` | `#FFCC99` | `#DB6E00` | `#FFE5CC` |
| `data_lists` | （リスト） | `#FF9966` | `#FFCAB0` | `#E64D00` | `#FFDDCC` |
| `more` | ブロック定義 | `#FF99AA` | `#FFCCD5` | `#FF3355` | `#FFE5EA` |
| `pen` | （拡張機能） | `#13ECAF` | `#75F0CD` | `#0B8E69` | `#A3F5DE` |

見本: [`0602-blocks-high-contrast.png`](screenshots/0602-blocks-high-contrast.png)

### ダーク（`dark`）

地をほぼ黒にし、なかまの色は縁（Tertiary）に出す。Secondary はすべて `#4C4C4C`。

| キー | なかま | Primary | Secondary | Tertiary | Quaternary（効く値） |
|---|---|---|---|---|---|
| `motion` | 動き | `#0F1E33` | `#4C4C4C` | `#4C97FF` | `#3373CC` |
| `looks` | 見た目 | `#1E1433` | `#4C4C4C` | `#9966FF` | `#774DCB` |
| `sounds` | 音 | `#291329` | `#4C4C4C` | `#CF63CF` | `#BD42BD` |
| `event` | イベント | `#332600` | `#4C4C4C` | `#FFBF00` | `#CC9900` |
| `control` | 制御 | `#332205` | `#4C4C4C` | `#FFAB19` | `#CF8B17` |
| `sensing` | 調べる | `#12232A` | `#4C4C4C` | `#5CB1D6` | `#2E8EB8` |
| `operators` | 演算 | `#112611` | `#4C4C4C` | `#59C059` | `#389438` |
| `data` | 変数 | `#331C05` | `#4C4C4C` | `#FF8C1A` | `#DB6E00` |
| `data_lists` | （リスト） | `#331405` | `#4C4C4C` | `#FF661A` | `#E64D00` |
| `more` | ブロック定義 | `#331419` | `#4C4C4C` | `#FF6680` | `#FF3355` |
| `pen` | （拡張機能） | `#03251C` | `#4C4C4C` | `#0fBD8C` | `#0B8E69` |

- 上流のダークは 4 つめを `colorQuaternary`（`u` が無い）と書いていて、scratch-blocks（と GUI）はこの名前を読まない。そのため `colourQuaternary` はオリジナルの値で埋まり、上の表の値（オリジナルの Quaternary）が効く。ソースに書いてある値（Tertiary と同じ色）は使われていない。
- 見本: [`0603-blocks-dark.png`](screenshots/0603-blocks-dark.png)（ダークは画面から選べないので、Redux の `scratch-gui/settings/SET_COLOR_MODE` で切りかえて撮った）

## 拡張機能の色

- **オリジナル**: 拡張機能が `getInfo()` で `color1`〜`color3` を返せばその色、返さなければ scratch-vm の既定 `#0FBD8C`・`#0DA57A`・`#0B8E69`（`packages/scratch-vm/src/engine/runtime.js` の `defaultExtensionColors`）。ブロックは Primary = `color1`、Secondary = `color2`、Tertiary と Quaternary = `color3`。上流の拡張機能（ペン・音楽・micro:bit など）はどれも `color1` を返さないので、すべて既定の緑。
- **高コントラスト・ダーク**: どの拡張機能も、そのモードの `pen` の 4 色になる（`packages/scratch-gui/src/lib/settings/color-mode/blockHelpers.js` の `getExtensionColors`。拡張機能が返した色は使わない）。丸の縁は `pen` の Tertiary。
- カテゴリの欄では、拡張機能がアイコン（`menuIconURI`、無ければ `blockIconURI`）を持っていると、色の丸の代わりにアイコン（`categoryIconBubble`・20px）を出す。アイコンが無いときの丸は、ソースでは地が `color1`、縁が `color2`（オリジナルのとき。ほかのカテゴリの縁は Tertiary）。読み込んで確かめた拡張機能（ペン・音楽と下のスモウルビーの拡張機能）は、どれもアイコンを出した。

### スモウルビーの拡張機能の色

スモウルビーが足した拡張機能（`koshien`・`microbitMore`・`meshV2`・`smalrubotS1`・`g2s`・`tm2scratch`・`smalrubyRuby`）も、どれも `color1` を返さない。実際に読み込んで確かめると、すべて上の既定の緑（`#0FBD8C`・`#0DA57A`・`#0B8E69`・`#0B8E69`）だった。スモウルビーが独自に足したカテゴリの色・拡張機能の色は**無い**。

## 独自の画面でブロックの色を使う

- ブロックのなかまの色を独自の画面で使うときは、16 進を書き写さず、`getColorsForMode(colorMode)[<キー>]` から取る（`packages/scratch-gui/src/lib/settings/color-mode/index.js`）。色のモードを変えたときも合う。
- 白い地の上に色の帯・印を置くときは、オリジナル・高コントラストは `colourPrimary`、ダークは `colourTertiary` を使う（ダークの Primary はほぼ黒で、どのなかまも同じに見える）。例: レッスンの一覧のカードの左の帯（`packages/scratch-gui/src/components/lessons-library/lessons-library.jsx` の `CardBand`）。
- 上流のモニター（`packages/scratch-gui/src/components/monitor/monitor.jsx`）は、なかまの `colourPrimary` を地に、`text` を文字にしている。

## ブロックのまわりの色

カテゴリ以外のキー。scratch-blocks はテーマを当てるとき、オブジェクトでないキーを `--colour-<キー>` として `document.documentElement` の `style` に書く（`scratch-blocks/src/renderer/constants.ts` の `setTheme`）。scratch-blocks 自身の既定値（`scratch-blocks/src/colours.ts` の `Colours`）も `:root` の `--colour-*` として入っているので、GUI が渡さないキー（`contextualMenuHover`）はその既定値のまま。

ただし、GUI が渡したキーがすべて画面に効くわけではない。キーは次の 3 種類に分かれる。

- **CSS 変数として読まれる**: 色のモードの値が画面に出る。
- **どこからも読まれない**: `--colour-*` は書かれるが、それを読む CSS も JS も無い。**GUI の値は使われない**（いまは同じ値）。
- **scratch-blocks の固定値から読まれる**: scratch-blocks が `Colours`（`colours.ts`）の値を直接使う。**GUI の値は使われない**（いまは同じ値）。

### CSS 変数として読まれるキー

| キー | オリジナル | 高コントラスト | ダーク | 使うところ |
|---|---|---|---|---|
| `text` | `#FFFFFF` | `#000000` | `rgba(255, 255, 255, .7)` | ドロップダウンを開いたときの項目の文字（実測: ダークで `rgba(255, 255, 255, 0.7)`）、角度の入力の線と目盛り。**ブロックの上の文字には効かない**（下の「文字」） |
| `workspace` | `#F9F9F9` | `#F9F9F9` | `#121212` | スクリプトエリアの地（`.blocklySvg`） |
| `toolbox` | `#FFFFFF` | `#FFFFFF` | `#121212` | カテゴリの欄の地 |
| `toolboxText` | `#575E75` | `#000000` | `#E5E5E5` | カテゴリの欄の文字 |
| `toolboxHover` | `#4C97FF` | `#3373CC` | `#4C97FF` | カテゴリにマウスを乗せたときの文字。ブロックパレットのチェックボックス（モニターを出す）の、チェックしたときの地 |
| `toolboxSelected` | `#E9EEF2` | `#E9EEF2` | `#4C4C4C` | 選ばれたカテゴリの地 |
| `flyout` | `#F9F9F9` | `#F9F9F9` | `#121212` | ブロックパレットの地 |
| `scrollbar` | `#CECDCE` | `#CECDCE` | `#CECDCE` | スクロールバー |
| `scrollbarHover` | `#CECDCE` | `#CECDCE` | `#CECDCE` | スクロールバーのホバー |
| `textFieldText` | `#575E75` | `#000000` | `#E5E5E5` | 値を出す吹き出しの文字（`.valueReportBox`）、音の高さの入力の鍵盤の名前、オリジナル・高コントラストのときのブロックパレットのボタン（「変数を作る」など）の文字。**ブロックの入力欄の文字・編集中の文字には効かない**（下の「文字」） |
| `fieldShadow` | `rgba(255, 255, 255, 0.3)` | 同じ | 同じ | ドロップダウンの中のボタン（`.blocklyDropDownButton`）のホバー・押したときの影（scratch-blocks の既定は `rgba(0,0,0,0.1)` で、GUI が上書きしている） |
| `dropDownShadow` | `rgba(0, 0, 0, .3)` | 同じ | 同じ | ドロップダウンの影 |
| `menuHover` | `rgba(0, 0, 0, 0.2)` | `rgba(255, 255, 255, 0.3)` | `rgba(255, 255, 255, 0.3)` | ドロップダウンの項目のホバー |
| `numPadBackground` | `#547AB2` | 同じ | 同じ | 数字パッド（タッチのとき）の地 |
| `numPadBorder` | `#435F91` | 同じ | 同じ | 数字パッドのボタンの縁 |
| `numPadActiveBackground` | `#435F91` | 同じ | 同じ | 数字パッドのボタンを押したとき |
| `numPadText` | `white` | 同じ | 同じ | 数字パッドのボタンの文字（CSS 変数）。消すボタンのアイコンの色は `Colours` の固定値を data URI の SVG に入れる（`scratch-blocks/src/fields/scratch_field_number.ts`）ので、そこには GUI の値は使われない。16 進にしないのはこのため |
| `contextualMenuHover` | `rgba(77, 151, 255, .25)` | 同じ | 同じ | 右クリックのメニューの項目のホバー（GUI は渡さない。scratch-blocks の既定値） |

ドロップダウンを開いたときの箱（`.blocklyDropDownDiv`）の地と縁は、キーではなくブロックのなかまの色で決まる（実測: 地は Primary、縁は Tertiary）。

### どこからも読まれないキー（GUI の値は使われない。いまは同じ値）

| キー | オリジナル | 高コントラスト | ダーク | 実際に使われる値 |
|---|---|---|---|---|
| `textField` | `#FFFFFF` | `#FFFFFF` | `#4C4C4C` | 入力欄の地は実測でどのモードも `#fff`（ダークの `#4C4C4C` は出ない） |
| `insertionMarker` | `#000000` | `#000000` | `#000000` | 落とす先の影は Blockly の `INSERTION_MARKER_COLOUR`（`#000000`） |
| `insertionMarkerOpacity` | `0.2` | `0.2` | `0.2` | 同じく `INSERTION_MARKER_OPACITY`（0.2） |
| `replacementGlow` / `replacementGlowSize` / `replacementGlowOpacity` | `#FFFFFF` / `2` / `1` | 同じ | 同じ | 入れかえる先の光は `scratch-blocks/src/renderer/constants.ts` の固定値 `REPLACEMENT_GLOW_COLOUR`（`#ffffff`）と zelos の `REPLACEMENT_GLOW_SIZE`（2） |
| `colourPickerStroke` | `#FFFFFF` | 同じ | 同じ | 読むところが無い |

### scratch-blocks の固定値から読まれるキー（GUI の値は使われない。いまは同じ値）

| キー | 値（GUI・`Colours` とも） | 使うところ |
|---|---|---|
| `stackGlow` / `stackGlowSize` / `stackGlowOpacity` | `#FFF200` / `4` / `1` | 動いているスクリプトの光（`scratch-blocks/src/glows.ts`） |
| `valueReportBackground` / `valueReportBorder` | `#FFFFFF` / `#AAAAAA` | ブロックを押したときに値を出す吹き出しの地と縁（`scratch-blocks/src/block_reporting.ts`） |
| `dragShadowOpacity` | `0.6` | ドラッグ中のブロックの影（`scratch-blocks/src/css.ts` に CSS を書くときに埋めこむ） |

ほかに scratch-blocks の CSS（`scratch-blocks/src/css.ts`）に直書きの色がある。例: カテゴリの欄の右の線 `#ddd`、ブロックパレットのチェックボックスの縁 `#c8c8c8`。スクリプトエリアの方眼は 40 ごとの `#ddd`（GUI の `Blocks.defaultOptions` の `grid`）。

## 文字

ブロックの文字は、Blockly の zelos が出す CSS（`.scratch-renderer.<モード>-theme` の下に書かれる。どのモードにも当たる）と、scratch-blocks の CSS（オリジナルと高コントラストのときだけ当たる規則がある）が重なって決まる。下の「実測」は 3 つのモードで計算済みのスタイルを読んだ値。

| 対象 | オリジナル | 高コントラスト | ダーク | 元 |
|---|---|---|---|---|
| ブロックの文字の書体・大きさ | `"Helvetica Neue", "Segoe UI", Helvetica, sans-serif`・12pt（実測 16px） | 同じ | 同じ | zelos の `font`（`FIELD_TEXT_FONTFAMILY`・`FIELD_TEXT_FONTSIZE`） |
| ブロックの文字の太さ | 500 | 500 | bold（実測 700） | zelos は bold（`FIELD_TEXT_FONTWEIGHT`）。scratch-blocks の `.scratch-renderer.default-theme .blocklyText` と `.scratch-renderer.high-contrast-theme .blocklyText` が 500 にする。ダークにはこの規則が無い |
| ブロックの上の文字の色 | `#fff` | `#000` | `#fff`（実測） | zelos の `.blocklyText { fill: #fff }`。高コントラストは scratch-blocks の `#000 !important`。`--colour-text` の `.blocklyText` の規則は zelos の規則に負けるので、ダークの `rgba(255, 255, 255, .7)` は効かない |
| 入力欄（数・文字）の文字の色 | `#575E75` | `#000` | `#575E75`（実測） | zelos の `.blocklyEditableField>text { fill: #575E75 }`。`--colour-textFieldText` を読む scratch-blocks の規則は古いクラス名（`.blocklyEditableText>text`）で、いまの入力欄には当たらないので、ダークの `#E5E5E5` は効かない |
| 入力欄を編集しているときの文字の色 | `#575E75` | `#575E75` | `#575E75` | zelos の `.blocklyHtmlInput { color: #575E75 }`（scratch-blocks の `--colour-textFieldText` の規則より強い） |
| ドロップダウンの文字の色 | `#fff` | `#000` | `#fff`（実測） | zelos の `.blocklyDropdownText { fill: #fff !important }`。高コントラストは scratch-blocks の `#000 !important`（こちらの方が強い）。高コントラストではドロップダウンの矢印の画像の色も反転する |
| ドロップダウンを開いたときの項目の文字 | `#FFFFFF` | `#000000` | `rgba(255, 255, 255, .7)`（実測） | `--colour-text` |
| ブロックパレットの見出し（「動き」など） | 14pt（実測 18.67px）・bold・`#575E75` | 同じ | 12pt（実測 16px）・bold・`#575E75` | オリジナル・高コントラストは scratch-blocks の CSS。ダークにはこの規則が無く、zelos の 12pt bold のまま |
| ブロックのコメント | 地 `#fef49c`・文字 `#575e75`・12pt・太さ 400 | 同じ | 規則が無い（zelos・Blockly の既定のまま） | scratch-blocks の CSS（オリジナル・高コントラストのときだけ当たる） |
| カテゴリの欄の名前 | 0.65rem（実測 10.4px）・太さ 400・幅 60px・中央ぞろえ | 同じ | 同じ | scratch-blocks の CSS |
| カテゴリの欄の丸 | 1.25rem（20px）の円・縁 1px | 同じ | 同じ | `@blockly/continuous-toolbox` 7.0.8 の CSS。地と縁の色は上の「4 つの色の役目」 |

## 形の寸法

scratch-blocks の `scratch_classic` レンダラー（Blockly の zelos を継いだもの）の定数。単位はワークスペースの単位で、**画面では 0.675 倍**になる（GUI の既定の拡大率 `BLOCKS_DEFAULT_SCALE`。ブロックパレットも同じ）。たとえば高さ 48 は画面で約 32px。

値は実行中のワークスペースの `getRenderer().getConstants()` で読んだもの（3 つの色のモードで同じ）。`init()` のあとで決まる値（`STATEMENT_INPUT_NOTCH_OFFSET`・`FIELD_BORDER_RECT_HEIGHT`）は、定数の初期値と違う。

| 定数 | 値 | 意味 |
|---|---|---|
| `GRID_UNIT` | 4 | 寸法の基本の単位 |
| `CORNER_RADIUS` | 4 | ブロックの角丸 |
| `MIN_BLOCK_HEIGHT` | 48 | ブロックの最小の高さ（下のでっぱりを除く） |
| `MIN_BLOCK_WIDTH` | 8 | ブロックの最小の幅 |
| `NOTCH_WIDTH` × `NOTCH_HEIGHT` | 36 × 8 | 上のくぼみ・下のでっぱり |
| `NOTCH_OFFSET_LEFT` | 12 | くぼみの左からの位置 |
| `STATEMENT_INPUT_NOTCH_OFFSET` | 16 | C の形の中のくぼみの位置 |
| `START_HAT_WIDTH` | 96 | 帽子ブロック（「旗が押されたとき」など）の山の幅 |
| `START_HAT_HEIGHT` | 22 | 山の曲線の高さ（パス ` c 25,-22  71,-22  96,0 `。見た目の山の高さは 16.5） |
| `BOWLER_HAT_HEIGHT` | 20 | ブロック定義の「定義」の丸い帽子の高さ（scratch-blocks が足した定数。角は半径 20 の円弧） |
| `EMPTY_INLINE_INPUT_HEIGHT` | 32 | 空いている入力の高さ |
| `EMPTY_INLINE_INPUT_PADDING` | 16 | 空いている入力の左右の余白 |
| `FIELD_BORDER_RECT_HEIGHT` | 31 | 入力欄の枠の高さ（`init()` で文字の大きさを測って決まるので、フォントによって ±1 変わることがある） |
| `FIELD_DROPDOWN_BORDER_RECT_HEIGHT` | 31 | ドロップダウンの枠の高さ（同じく ±1 変わることがある） |
| `FIELD_BORDER_RECT_RADIUS` | 4 | 入力欄の枠の角丸 |
| `FIELD_BORDER_RECT_X_PADDING` | 8 | 入力欄の左右の余白 |
| `FIELD_DROPDOWN_SVG_ARROW_SIZE` | 12 | ドロップダウンの矢印の大きさ |
| `FIELD_DROPDOWN_SVG_ARROW_PADDING` | 8 | 矢印の余白 |
| `FIELD_COLOUR_DEFAULT_WIDTH` × `HEIGHT` | 24 × 32 | 色の入力欄 |
| `SMALL_PADDING` / `MEDIUM_PADDING` / `MEDIUM_LARGE_PADDING` / `LARGE_PADDING` | 4 / 8 / 12 / 16 | ブロックの中の余白 |
| `STATEMENT_INPUT_PADDING_LEFT` | 16 | C の形の左の太さ |
| `STATEMENT_INPUT_SPACER_MIN_WIDTH` | 160 | C の形の最小の幅 |
| `EMPTY_STATEMENT_INPUT_HEIGHT` | 24 | C の形の中が空のときの高さ |
| `TOP_ROW_PRECEDES_STATEMENT_MIN_HEIGHT` | 16 | C の形の上の段の最小の高さ |
| `BOTTOM_ROW_AFTER_STATEMENT_MIN_HEIGHT` | 24 | C の形の下の段の最小の高さ |
| `DUMMY_INPUT_MIN_HEIGHT` | 32 | 入力の無い段の最小の高さ |
| `MAX_DYNAMIC_CONNECTION_SHAPE_WIDTH` | 48 | 丸・六角形の端の最大の幅 |
| `SELECTED_GLOW_COLOUR` / `SELECTED_GLOW_SIZE` | `#ffffff` / 0.5 | 選んだブロックの光（scratch-blocks が白に上書き）。ただし scratch-blocks の `createDom` が `selectedGlowFilterId` を空にするので、**選んだブロックの光は出ない**。この色は、ブロックを入力に入れようとしたときの入力の強調の線（`.blocklyHighlightedConnectionPath`）にだけ使われる |
| `REPLACEMENT_GLOW_COLOUR` / `REPLACEMENT_GLOW_SIZE` | `#ffffff` / 2 | 入れかえる先の光（scratch-blocks が白に上書き） |
| `INSERTION_MARKER_COLOUR` / `INSERTION_MARKER_OPACITY` | `#000000` / 0.2 | 落とす先の影 |
| `CURSOR_COLOUR` | `#ffa200` | キーボードで操作するときのカーソル |

### 形の種類

| 形 | 使うブロック | 端の形 |
|---|---|---|
| 六角形（`OUTPUT_SHAPE_HEXAGONAL` = 1） | 真か偽を返すブロック、それを受ける入力 | とがった端（端の幅は高さの半分。最大 48） |
| 丸（`OUTPUT_SHAPE_ROUND` = 2） | 数・文字を返すブロック、それを受ける入力 | 半円（端の幅は高さの半分。最大 48） |
| 四角（`OUTPUT_SHAPE_SQUARE` = 3） | レポーターを受けない拡張機能のメニュー（`acceptReporters` が false。`packages/scratch-vm/src/engine/runtime.js` の `_buildMenuForScratchBlocks`） | 端の幅 4（角丸 4） |

### 実際の大きさ（例）

ブロックパレットのブロックの外形の高さ（ワークスペースの単位。`svgPath.getBBox()`）。入力欄の高さはフォントの測り方で ±1 変わることがあるので、入力を持つブロックの高さも同じだけ変わりうる。

| ブロック | 高さ | 内わけ |
|---|---|---|
| 「10 歩動かす」（ふつうのブロック） | 56 | 48 + 下のでっぱり 8 |
| 「すべてを止める」（下につながらないブロック） | 48 | でっぱり無し |
| 「旗が押されたとき」（帽子ブロック） | 72.5 | 山 16.5 + 48 + でっぱり 8 |
| 「x座標」「変数」（丸いブロック） | 40 | 入力欄 32 + 上下の余白 4 ずつ |
| 「マウスが押された」（六角形のブロック） | 40 | |
| 「ずっと」（C の形・中が空） | 104 | |
| 「もし〜なら」「10 回繰り返す」（C の形・中が空） | 112 | |

### そのほか

- スクロールバーの太さは 11（タッチの端末では 14）。`scratch-blocks/src/index.ts` で決めている。
- 「ねこブロック」（`scratchTheme: 'catblocks'`）は別のレンダラーで、帽子ブロックにねこの顔を描く。この表のレンダラーを継ぎ、帽子の高さだけ変える（`START_HAT_HEIGHT` 31.5・`BOWLER_HAT_HEIGHT` 35。`scratch-blocks/src/renderer/cat/constants.ts`）。ふだんは使わない。使うのは GUI の `useCatBlocks` が真のとき＝タイムトラベルで 2020 年にいるとき（`packages/scratch-gui/src/reducers/time-travel.js` の `isTimeTravel2020`）か、テーマが「ねこブロック」のとき（設定メニューに出るのは `hasActiveMembership` のときだけ。`packages/scratch-gui/src/lib/settings/theme/index.js`）。

## 見本の撮り方

`screenshots/0601`〜`0603` は、撮影スクリプトではなく次の手順で撮った（撮り直すときも同じ条件にする）。

- 1366×1024・`ja-JP` で `?no_beforeunload=1` を開き、スモウルビーの吹き出しを隠す。
- 色のモードは Redux に `{type: 'scratch-gui/settings/SET_COLOR_MODE', colorMode: '<id>'}` を送って切りかえる（ダークは設定メニューに無いため。オリジナル・高コントラストはクッキー `scratchtheme` でもよい）。
- カテゴリの欄の左端からブロックパレットの右端まで、上から 380px を切り抜く。
