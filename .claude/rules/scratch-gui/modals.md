# Modals (scratch-gui)

共有 `Modal` を使う Smalruby モーダルを追加するときの必須ルール。

## ⚠️ モーダルの本文には必ず背景色を設定する

共有モーダル（`src/containers/modal.jsx` → `src/components/modal/modal.jsx`）の
`.modal-content` と `.box` は **非フルスクリーン時に背景色を持たない**（背景が付くのは
`.full-screen` バリアントの `$ui-secondary` だけ）。ヘッダー (`.header`) には色が付くが、
その下の **本文（children）領域は透明**。

そのため、本文に背景色を設定し忘れると、背後の青いオーバーレイ
(`.modal-overlay` = `$ui-modal-overlay`) が透けて「中身が青い」状態になる。

### 必ずやること

Smalruby モーダルの**本文ラッパー**（`<Box>` など、Modal の children 直下）に
**不透明な背景色**を設定する:

```css
.body {
    background-color: $ui-white;  /* これが無いと青いオーバーレイが透ける */
    /* ... */
}
```

### 既存の正しい例（迷ったらこれに倣う）

| モーダル | 背景設定箇所 |
|---------|-------------|
| `bug-report-modal.css` | `.body { background-color: $ui-white; }` |
| `classroom-modal.css` | `.body { background-color: white; }` |
| `rubytee-modal.css` | `.modal-container { background: white; }` |

### レビュー観点 / DoD

- 新しいモーダルを追加した PR では、**実際にモーダルを開いたスクリーンショット**で
  本文が不透明（青透けが無い）ことを確認する（Playwright MCP で `getComputedStyle(body).backgroundColor`
  が透明でないことも確認できる）。
- フルスクリーンモーダル (`fullScreen` prop) は `.full-screen` が `$ui-secondary` を持つので
  本文背景は必須ではないが、明示しておくと安全。

## 根本対策（共有 Modal 側、検討中）

`.modal-content`（非フルスクリーン）にデフォルト背景 `$ui-white` を与えれば、本文側の
設定漏れがあっても青透けしなくなる。ただし `src/components/modal/modal.css` は **upstream
ファイル**なので、変更には Smalruby マーカーと upstream マージ時の差分管理が伴う。
子要素が自前の背景を持つ既存モーダルには影響しない（後ろに白を敷くだけ）後方互換な変更
だが、適用するかは upstream 追従コストとのトレードオフで判断する。
