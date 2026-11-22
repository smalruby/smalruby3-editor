# カルーセル（自動で送るページ送り）

上流（Scratch）にカルーセルは無い。独自の画面で、いくつかの紹介を順に見せるときに使う。使っている画面は、クラス管理の先生のログインの画面の右（[`../../classroom/ui-ux.md`](../../classroom/ui-ux.md) の「先生ログイン」。見本 [`0201-teacher-login.png`](../../classroom/screenshots/0201-teacher-login.png)）。

部品は `packages/scratch-gui/src/components/carousel/`（`carousel.jsx`・`carousel.css`）。

## 見た目はページ送りのまま

見た目と操作は [`pager.md`](pager.md) の「独自の画面で使う形」を**そのまま**使う。新しいトークンは作らない。

| 項目 | ページ送りと同じにしたもの |
|---|---|
| 前へ・次へ | 紫の丸 2.75rem（`$color-primary`）+ 輪 4px（`$color-primary-transparent`）・白い矢印（上流の `cards/icon--prev.svg` / `icon--next.svg`）。ホバーで輪 6px・1.125 倍。押したとき `$color-primary-dark` |
| 置き場所 | `[前へ] [スライド] [次へ]` の横並び。丸はスライドの高さの真ん中。カルーセルの幅が 25rem 未満なら、スライドを上に全幅で置き、その下に前へ・次へを左右の端に（コンテナクエリ） |
| 押せないとき | 最初の前へ・最後の次へは**消さずに** `aria-disabled="true"` で淡い紫。押しても何もしない |
| フォーカス | 2px の紫の線を輪の外（`outline-offset: 4px`） |
| いまどこか | スライドの下に点（今 `$color-primary`・ほか `$color-primary-transparent`・0.5rem）。点は押せない（読み上げはスライドの「5 枚中 2 枚目」で伝える） |
| キーボードの ← → | カルーセルの中で ← → で送る（文字を打つ所では奪わない。右から左の言葉では ← が次へ） |
| 強制カラーモード | 丸に `forced-color-adjust: none` と `ButtonText` の枠。フォーカスの線は `Highlight` |

## 足したもの: 自動で送るきまり

| 項目 | 決めたこと | わけ |
|---|---|---|
| 間隔 | **7 秒**ごとに次へ。最後の次は最初に戻る | 見出しと 2 行の説明を読み終えられる長さ |
| 手で送ったとき | 前へ・次へ・← → で送ると、そこから 7 秒を数え直す | 読み始めたスライドがすぐに変わらないように |
| マウスを乗せたとき | 乗せている間は止まる。外れると、そこから 7 秒 | 画像を見ている間に変わらないように |
| キーボードで触ったとき | フォーカスがカルーセルの中にある間は止まる（`focusin` / `focusout`） | Tab で前へ・次へに来た人の目の前で変わらないように |
| 一時停止のボタン | 点の右に［一時停止］（押すと［再生］に変わる）。白い地・枠・紫の文字の小さなボタン（`$size-button-height-small`）。アイコンは SVG（`currentColor`） | WCAG 2.2 の 2.2.2（5 秒を超えて自動で動くものは止められること）。主な操作ではないので、塗りのボタンにしない |
| 動きを減らす設定 | `prefers-reduced-motion: reduce` の人には**自動で送らない**。一時停止のボタンも出さない（止めるものが無いため）。前へ・次へ・← → はそのまま | 動きを減らしたい人の設定を守る |
| 読み上げ | 全体は `<section aria-roledescription="carousel" aria-label="…">`。スライドは `role="group" aria-roledescription="slide"` に「5 枚中 2 枚目」。自動で送っている間は `aria-live="off"`、止まっている間（一時停止・動きを減らす設定）は `"polite"` | WAI-ARIA の Carousel のパターン。自動で変わるたびに読み上げると、ほかの操作のじゃまになる |
| 高さ | スライドを全部同じ場所に重ねて描き、いまのものだけ見せる（ほかは `visibility: hidden`）。高さはいちばん高いスライドに合う | 画像を最初に 1 回だけ読み込み、スライドが変わっても前へ・次へが上下に動かない |
| 画像 | スライドの下に、枠（`$color-border`）・角丸 `$radius-medium`・影 `$shadow-raised` を付けて置く。高さは 20rem まで（`object-fit: contain`） | 本物の画面を切り出した絵だと分かるように |

## 書き方の例

```jsx
import Carousel from '../carousel/carousel.jsx';

<Carousel
    label={intl.formatMessage(messages.label)} // 読み上げの名前（見えない）
    slides={[
        { key: 'first', title: '見出し', description: '説明', image: firstImage },
        // ...
    ]}
    testId="my-carousel" // my-carousel / -prev / -next / -pause / -slide / -dots
/>
```

- `interval`（ミリ秒）で間隔を変えられるが、既定の 7 秒を使う。
- 画像は、本物の画面から伝えたい所だけを切り出す（画面全体を小さくしない）。クラス管理のログインの画像は `tools/playwright-verify/capture-classroom-login-carousel.mjs` が作る。
- 新しく使う画面では、`data-testid` をその画面の一覧に足す（クラス管理は [`../../classroom/testing.md`](../../classroom/testing.md)）。
