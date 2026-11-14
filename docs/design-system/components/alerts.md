# アラート

上流の値は tag `v13.7.2`。ファイルは `packages/scratch-gui/src/components/alerts/alert.css`（並びは `alerts/alerts.css`）。

画面の上に出る横長の知らせ。種類は `src/lib/alerts/index.jsx` の `level` で決まる。見本: [`0507-alerts.png`](../screenshots/0507-alerts.png)（上から注意・成功・お知らせ）。

## 形

| 部分 | 値 | トークン | 実測 |
|---|---|---|---|
| 枠（`.alert`） | 幅 100%・角丸 `$space`・余白 `.875rem 1rem`・下に 7px・最小の高さ 1.5rem | `$radius-medium` | 一致（8px・14px 16px） |
| アイコン（`.icon-section`） | 1.25rem・右に 1rem | | |
| 文（`.alert-message`） | `#555`・太字・.8125rem・行の高さ .875rem | 直書き（トークンに無い色） | 一致（`rgb(85, 85, 85)`・13px・700） |
| つなぐボタン（`.alert-connection-button`） | 地 `$data-primary`・白・角丸 0.35rem・0.77rem の 700・幅 6.5rem | `$color-warning` | （撮っていない） |
| 閉じるボタン | [`buttons.md`](buttons.md) の閉じるボタン `.large.orange` | | 一致 |

## 種類

| 種類（`level`） | 地 | 枠 | 輪 | トークン | 実測（出した `alertId`） |
|---|---|---|---|---|---|
| 注意（`.warn`） | `$ui-alert-orange` | `1px solid $data-primary` | `0 0 0 2px rgba(255, 140, 26, 0.25)`（直書き） | `$color-warning-background`・`$color-warning` | 一致（`creatingError`） |
| 成功（`.success`） | `$extensions-light` | `1px solid $extensions-tertiary` | `0 0 0 2px $extensions-light` | `$color-success-background`・`$color-success` | 一致（`createSuccess`） |
| お知らせ（`.info-blue`） | `$ui-primary` | `1px solid $motion-primary` | なし | `$color-info-background`・`$color-info` | 一致（`settingThumbnail`） |

`level` の `INFO`（保存中など）はインラインの知らせ（`alerts/inline-message.css`）で、この枠を使わない。

## 状態

アラート自体にはホバー・押した・選ばれた・押せない・フォーカスの状態は無い。閉じるボタンのホバーだけ（`scale(1.1)`・輪 4px）。

独自の画面の知らせは、この 3 種類の色の組（別名 `$color-warning*`・`$color-success*`・`$color-info*`）を使う。文の色は `#555` ではなく `$color-text` にしてよい（上流でも `#555` はここだけ）。
