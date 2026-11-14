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
| 要素 | `<button type="button">` に `aria-label`（`gui.<部品>.prev` / `next` の文。英語で書いて `ja.js` で訳す）。中のアイコンは `alt=""` | キーボードと読み上げで使える（上流の 2 つはどちらも使えない） |
| 形 | 丸 2.75rem（44px）の塗り + 輪 4px。矢印 1.75rem | チュートリアルと同じ大きさ（上流の 2 つの見た目がそろっている形） |
| 矢印 | 上流の `cards/icon--prev.svg` / `icon--next.svg`（白） | 上流の絵を使う。新しく描かない |
| 色 | 地 `$color-primary`（紫）・輪 `$color-primary-transparent`。押したとき `$color-primary-dark`。**ヘッダーが緑の画面でも紫** | 送るのは「操作」なので、主ボタンと同じ紫（接続のモーダルもヘッダーは緑・ボタンは紫）。白い矢印は紫の上で 4.7:1（明るい緑の上は 2.4:1） |
| 置き場所 | 本文の中で `[前へ] [中身] [次へ]` の横並び（flex）。丸は中身の高さの真ん中・左右対称 | 共有の `Modal` の枠ははみ出しを隠す（`overflow: hidden`）ので、ふちの外には出せない。横並びなら中身と重ならず、右から左の言葉でも自動で入れかわる |
| 狭いとき | ページ送りの欄の幅が 25rem（約 400px）未満なら、中身を上に全幅で置き、その下に `[前へ] …… [次へ]` を左右の端に並べる（コンテナクエリ + `order`） | 狭い本文で横並びにすると、中身の幅が 300px を切って読みにくい。下に並べても左右の向きはそのまま |
| 押せないとき | **消さない**。`aria-disabled="true"` にして、地を淡い紫（`$color-primary-transparent`）にする。押しても何もしない | 消すと、キーボードで押していた人のフォーカスが失われ、横並びの幅も変わる。淡い紫は主ボタンの押せない形（[`README.md`](README.md)）と同じ |
| ホバー | 輪が 6px・1.125 倍（`$transition-standard`）。押せないときは変えない | チュートリアルと同じ（上流にある、ただ 1 つのページ送りのホバー）。主ボタン・副ボタンは「ホバーの見た目を付けない」きまり（[`README.md`](README.md)）だが、ページ送りはその**例外**にする |
| フォーカス | `:focus-visible` で 2px の紫の線を、輪の外（`outline-offset: 4px`）に | [`README.md`](README.md) の「フォーカス」のきまり（2px の紫の線）。ほかの部品の 2px と違い 4px なのは、輪（4px）と重ならないようにするため |
| いまどこか | 2〜8 ページなら、中身の下に点を並べる（接続のモーダルの点と同じ色: 今 `$color-primary`・ほか `$color-primary-transparent`・0.5rem）。それより多いときは「3 / 12」の文字 | 上流の白の点（チュートリアル）は緑の地の上の色で、白い本文の上では見えない。接続のモーダルの点は白い地の上の紫 |
| キーボードの ← → | `.pager` の `onKeyDown` で ← → を受けて送る。`event.target` が `input`・`textarea`・`contenteditable` のときは何もしない（文字を打つ人のカーソルの移動を奪わない）。右から左の言葉では ← が「次へ」 | 押す場所が 2 つに分かれていても、続けて読める |
| 右から左の言葉 | 横並びは自動で入れかわる。矢印の絵だけ `[dir="rtl"]` で左右を反転 | チュートリアルと同じ結果になる |
| 強制カラーモード | 矢印は `<img>`（上流の白い SVG）のままにし、`@media (forced-colors: active)` で丸に `forced-color-adjust: none` を付けて紫の地を残す。境目に `ButtonText` の枠、フォーカスの線は `Highlight` | 何もしないと、地がシステムの色（白など）に変わり、白い矢印が消える。`mask` + `currentColor` で描く方法は、SVG の読み込み方（`url()`）とシステムの色の指定の両方が要り手間が多い。上流の絵をそのまま使え、紫の地に白い矢印（4.7:1）のまま見えるこちらが簡単で確実 |

### 書き方の例

```jsx
// my-pager.jsx（独自の画面の部品。関数コンポーネント）
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, useIntl } from 'react-intl';

import nextIcon from '../cards/icon--next.svg';
import prevIcon from '../cards/icon--prev.svg';
import styles from './my-pager.css';

// 英語で書き、ja.js / ja-Hira.js で訳す
const messages = defineMessages({
    prev: { id: 'gui.myPager.prev', defaultMessage: 'Previous', description: 'Button to show the previous page' },
    next: { id: 'gui.myPager.next', defaultMessage: 'Next', description: 'Button to show the next page' },
});

// 文字を打っている所では ← → を奪わない
const isTextTarget = (target) =>
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

const MyPager = ({ page, total, onPrev, onNext, children }) => {
    const intl = useIntl();
    const isFirst = page === 0;
    const isLast = page === total - 1;
    const handleKeyDown = useCallback(
        (event) => {
            if (isTextTarget(event.target)) return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl';
            const forward = (event.key === 'ArrowRight') !== isRtl;
            if (forward && !isLast) onNext();
            if (!forward && !isFirst) onPrev();
            event.preventDefault();
        },
        [isFirst, isLast, onPrev, onNext],
    );
    return (
        <div className={styles.pagerFrame}>
            <div
                className={styles.pager}
                onKeyDown={handleKeyDown}
            >
                <button
                    type="button"
                    className={styles.pagerButton}
                    aria-label={intl.formatMessage(messages.prev)}
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
                    aria-label={intl.formatMessage(messages.next)}
                    aria-disabled={isLast}
                    onClick={isLast ? null : onNext}
                    data-testid="my-pager-next"
                >
                    <img className={styles.pagerIcon} src={nextIcon} alt="" draggable={false} />
                </button>
            </div>
        </div>
    );
};

MyPager.propTypes = {
    children: PropTypes.node,
    onNext: PropTypes.func.isRequired,
    onPrev: PropTypes.func.isRequired,
    page: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
};

export default MyPager;
```

```css
/* my-pager.css */
@import '../../css/smalruby-tokens.css';

/* 狭いときの切りかえは、この枠の幅で決める（コンテナクエリ） */
.pager-frame {
    container-type: inline-size;
}

.pager {
    display: flex;
    flex-wrap: wrap;
    align-items: center; /* 丸を中身の高さの真ん中に */
    justify-content: space-between;
    gap: $space-large;
}

.pager-content {
    flex: 1;
    min-width: 0;
}

/* 狭いとき（25rem 未満）: 中身を上に全幅、その下に前へ・次へを左右の端に */
@container (max-width: 25rem) {
    .pager-content {
        flex-basis: 100%;
        order: -1;
    }
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

/* ホバーで大きくする（主ボタン・副ボタンの「ホバーなし」の例外） */
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

/* 強制カラーモード: 地をシステムの色にさせず、白い矢印を残す */
@media (forced-colors: active) {
    .pager-button {
        forced-color-adjust: none;
        border: 2px solid ButtonText;
    }

    .pager-button:focus-visible {
        outline-color: Highlight;
    }
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
