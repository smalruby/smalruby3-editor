# ページ送り（左右の矢印）

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/` から。上流で左右にページを送るのは、チュートリアルのカード（`cards/`）とデバッグのモーダル（`debug-modal/`）の 2 つ。どちらも部品になっておらず、画面ごとに書いている。画面全体の値は [`../tutorial-debug.md`](../tutorial-debug.md)。

見本: [`0508-pager-debug.png`](../screenshots/0508-pager-debug.png)（デバッグの「次へ」。モーダルの右の端から外へはみ出す）、[`0509-pager-tutorial.png`](../screenshots/0509-pager-tutorial.png)（チュートリアルの「次へ」と、後ろののぞき札）。画面の中の置き場所は [`0901-debug-modal.png`](../screenshots/0901-debug-modal.png)・[`0902-tutorial-card.png`](../screenshots/0902-tutorial-card.png)。

## 上流の 2 つを比べる

| 項目 | チュートリアルのカード | デバッグのモーダル |
|---|---|---|
| 要素 | `<div>` に `onClick`。中にアイコンの `<img>`（`alt` なし） | `<img>` に `onClick`（`alt="Previous"` / `"Next"`。英語のまま訳されない） |
| ファイル | `cards/cards.jsx` の `NextPrevButtons`・`cards/card.css` の `.left-button` / `.right-button` | `debug-modal/debug-modal.jsx`・`debug-modal.css` の `.previousIcon` / `.nextIcon` |
| 形 | 丸 44px の塗り + 輪 4px（`box-shadow`）。見た目の大きさ 52px | 52px の SVG（中の丸 44px + 外の輪 4px）。見た目はチュートリアルとほぼ同じ |
| 矢印 | 白い矢印のアイコン（`cards/icon--next.svg`。20px の絵を 1.75rem に） | 白い矢印（SVG に描き込み。少し太い） |
| 色 | 地 `$extensions-primary`（`#0FBD8C`）・輪 `$extensions-transparent`（35%）。CSS のトークン | 地 `#0FBD8C`・輪 `#0FBD8C` の 25%。**SVG の中に直書き**（CSS で変えられない） |
| 置き場所（横） | カードの左右のふち。丸の中心がふちのすぐ外（`left` / `right: -27px`）。左右対称 | 前は**中身の欄の左の端の内側**（枠の左から 320px。位置を決めておらず、静的な位置に出る）、次は**枠の右の端から 24px 外**。左右対称でない |
| 置き場所（縦） | 50% から 15px 上（`top: 50%`・`margin-top: -15px`）。丸の中心がほぼ真ん中 | 枠の 50%（`top: 50%`）。丸の上の端が真ん中で、中心は 26px 下 |
| 次のページの手がかり | 後ろに重なった次のカードに見える**のぞき札**（幅 .75rem・上の帯が緑） | 無い（左の話題の一覧で、いまどこかが分かる） |
| いまどこか | ヘッダーの点（白・白 25%） | 左の話題の一覧の、選ばれた話題（淡い緑の地・太字） |
| 押せないとき（最初・最後） | **出さない**（要素ごと描かない。のぞき札も消える） | **出さない**（`display: none`） |
| ホバー | 輪が 6px に・1.125 倍（`all 0.25s ease`） | **無い**（`cursor: pointer` だけ） |
| 押した | — | — |
| フォーカス | **届かない**（`<div>`。Tab で飛ばされる） | **届かない**（`<img>`。Tab は閉じるボタンにしか止まらない） |
| キーボードの ← → | — | — |
| 読み上げ | 名前が無い | 「Previous」「Next」（英語） |
| 右から左の言葉 | 矢印と置き場所を入れかえる（`isRtl`） | 入れかえない |
| 実測 | 44×44px・`left: -27px`・ホバーで `matrix(1.125, 0, 0, 1.125, 0, 0)`・輪 6px | 52×52px・`top: 301px`・前 `left: 320px`・次 `right: -24px` |

### ちがいと、それぞれの特徴

- **見た目はほぼ同じ**（緑の丸 44px + 淡い輪 + 白い矢印）。デバッグの矢印は、チュートリアルの丸に**似せて SVG に描いた**もので、作り方（CSS か絵か）が違う。
- **チュートリアル**は、カードのふちにまたがって置き、後ろののぞき札で「次のカードがある」ことを見せる。**カードを重ねためくりの形**で、左右が対称、ホバーで大きくなる。カードが小さく動かせるので、矢印をカードの外へ出して中身をふさがないようにしている。
- **デバッグ**は、中身の右の端にまたがって置いた「次へ」と、中身の左の端の内側に置いた「前へ」で、**左右がそろっていない**（「前へ」は位置を決めておらず、中身の文字の欄の左のすき間に出る）。ホバーも無く、作りが簡単。左の話題の一覧から直接選べるので、矢印は補助。
- **共通の弱いところ**: どちらも**キーボードで押せない**（ボタンでない要素に `onClick` を付けている）・読み上げの名前が無い（または英語のまま）・押せないときは消すので、最後のページで押した場所から矢印がなくなる。白い矢印は明るい緑（`#0FBD8C`）の上で 2.4:1 しかなく、絵の部品に要る 3:1（WCAG 2.2 の 1.4.11）に届かない。

## 独自の画面で使う形

独自の画面で左右に送るときは、**チュートリアルの丸の形を基にし、色と置き場所と押せないときの見せ方を変えた新しい形**にする。

| 項目 | 決めたこと | わけ |
|---|---|---|
| 要素 | `<button type="button">` に `aria-label`（訳した「前へ」「次へ」）。中のアイコンは `alt=""` | キーボードと読み上げで使える（上流の 2 つはどちらも使えない） |
| 形 | 丸 2.75rem（44px）の塗り + 輪 4px。矢印 1.75rem | チュートリアルと同じ大きさ（上流の 2 つの見た目がそろっている形） |
| 矢印 | 上流の `cards/icon--prev.svg` / `icon--next.svg`（白） | 上流の絵を使う。新しく描かない |
| 色 | 地 `$color-primary`（紫）・輪 `$color-primary-transparent`。押したとき `$color-primary-dark`。**ヘッダーが緑の画面でも紫** | 送るのは「操作」なので、主ボタンと同じ紫（接続のモーダルもヘッダーは緑・ボタンは紫）。白い矢印は紫の上で 4.7:1（明るい緑の上は 2.4:1） |
| 置き場所 | 本文の中で `[前へ] [中身] [次へ]` の横並び（flex）。丸は中身の高さの真ん中・左右対称 | 共有の `Modal` の枠ははみ出しを隠す（`overflow: hidden`）ので、ふちの外には出せない。横並びなら中身と重ならず、右から左の言葉でも自動で入れかわる |
| 押せないとき | **消さない**。`aria-disabled="true"` にして、地を淡い紫（`$color-primary-transparent`）にする。押しても何もしない | 消すと、キーボードで押していた人のフォーカスが失われ、横並びの幅も変わる。淡い紫は主ボタンの押せない形（[`README.md`](README.md)）と同じ |
| ホバー | 輪が 6px・1.125 倍（`$transition-standard`）。押せないときは変えない | チュートリアルと同じ（上流にある、ただ 1 つのページ送りのホバー） |
| フォーカス | `:focus-visible` で 2px の紫の線を、輪の外（`outline-offset: 4px`）に | [`README.md`](README.md) の「フォーカス」のきまり（2px の紫の線）。輪 4px と重ならないよう 4px 外へ |
| いまどこか | 2〜8 ページなら、中身の下に点を並べる（接続のモーダルの点と同じ色: 今 `$color-primary`・ほか `$color-primary-transparent`・0.5rem）。それより多いときは「3 / 12」の文字 | 上流の白の点（チュートリアル）は緑の地の上の色で、白い本文の上では見えない。接続のモーダルの点は白い地の上の紫 |
| キーボードの ← → | ページ送りのある欄にフォーカスがあるとき、← → でも送る（入力欄の中では送らない） | 押す場所が 2 つに分かれていても、続けて読める |
| 右から左の言葉 | 横並びは自動で入れかわる。矢印の絵だけ `[dir="rtl"]` で左右を反転 | チュートリアルと同じ結果になる |

### 書き方の例

```jsx
// my-pager.jsx（独自の画面の部品。関数コンポーネント）
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { useIntl } from 'react-intl';

import nextIcon from '../cards/icon--next.svg';
import prevIcon from '../cards/icon--prev.svg';
import styles from './my-pager.css';

const MyPager = ({ page, total, onPrev, onNext, children }) => {
    const intl = useIntl();
    const isFirst = page === 0;
    const isLast = page === total - 1;
    return (
        <div className={styles.pager}>
            <button
                type="button"
                className={styles.pagerButton}
                aria-label={intl.formatMessage({ id: 'gui.smalruby.pager.prev', defaultMessage: '前へ' })}
                aria-disabled={isFirst}
                onClick={isFirst ? null : onPrev}
                data-testid="my-pager-prev"
            >
                <img className={styles.pagerIcon} src={prevIcon} alt="" draggable={false} />
            </button>
            <div className={styles.pagerContent}>{children}</div>
            <button
                type="button"
                className={styles.pagerButton}
                aria-label={intl.formatMessage({ id: 'gui.smalruby.pager.next', defaultMessage: '次へ' })}
                aria-disabled={isLast}
                onClick={isLast ? null : onNext}
                data-testid="my-pager-next"
            >
                <img className={styles.pagerIcon} src={nextIcon} alt="" draggable={false} />
            </button>
        </div>
    );
};
```

```css
/* my-pager.css */
@import '../../css/smalruby-tokens.css';

.pager {
    display: flex;
    align-items: center; /* 丸を中身の高さの真ん中に */
    gap: $space-large;
}

.pager-content {
    flex: 1;
    min-width: 0;
}

.pager-button {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: none;
    border-radius: $radius-round;
    background-color: $color-primary;
    box-shadow: 0 0 0 4px $color-primary-transparent;
    cursor: pointer;
    transition: $transition-standard;
}

.pager-button:hover:not([aria-disabled='true']) {
    box-shadow: 0 0 0 6px $color-primary-transparent;
    transform: scale(1.125);
}

.pager-button:active:not([aria-disabled='true']) {
    background-color: $color-primary-dark;
}

/* 押せない: 消さずに淡くする（フォーカスを失わせない） */
.pager-button[aria-disabled='true'] {
    background-color: $color-primary-transparent;
    box-shadow: none;
    cursor: default;
}

/* フォーカス: 2px の紫の線を、輪 (4px) の外に */
.pager-button:focus-visible {
    outline: 2px solid $color-primary;
    outline-offset: 4px;
}

.pager-icon {
    width: 1.75rem;
}

[dir='rtl'] .pager-icon {
    transform: scaleX(-1);
}

/* いまどこか（2〜8 ページ）。接続のモーダルの点と同じ色 */
.pager-dots {
    display: flex;
    justify-content: center;
    gap: $space-small;
    margin-top: $space-medium;
}

.pager-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: $radius-round;
    background-color: $color-primary-transparent;
}

.pager-dot.is-current {
    background-color: $color-primary;
}
```

- 新しい部品なので、`data-testid`（`<部品>-prev` / `<部品>-next`）を付ける（`.claude/rules/scratch-gui/e2e-test.md`）。
- 新しいファイルは `.prettierignore` のホワイトリストに足す（`.claude/rules/code-style.md`）。
- 紫の地の上（ヘッダーなど）には置かない。本文（白い地）の中に置く（紫の丸が紫の地にまぎれるため）。
