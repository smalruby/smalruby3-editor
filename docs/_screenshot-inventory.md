# Screenshot Inventory: 既存未追跡 PNG の棚卸し

Issue #616 時点で、リポジトリ root に **130 枚の未追跡 PNG** が放置されていた。これらは過去 Issue (#572, #599, #600, #602) の Playwright 作業時の中間ファイル。本ドキュメントで棚卸しと処理方針を示す。

> **本リストは 2026-05-03 時点のスナップショット**。掃除後はこのドキュメント自体を削除して構わない（または Issue #616 への参照リンクのみ残す）。

## 結論サマリ

| 処理 | 件数 | 説明 |
|---|---|---|
| **削除推奨** | 約 122 件 | 過去 Issue の中間ファイル。実装は既にコミット済み、視覚的価値なし |
| **採用検討** | 約 8 件 | 完成済みの UI を映していて、機能 docs に転用できる可能性あり |

> **本 PR では削除を実行しない**。ユーザーが各候補を確認の上、別途 `rm` する。

## 削除推奨 (約 122 件)

### Issue #572 (Mobile UI Phase 2/3 関連) — 約 90 件

`phase-2*-*.png`, `phase3c-*.png`, `phase3d-*.png` 系統。中間バージョン (`v2`, `v3`, `v4`) が大量にある。

完成版の Mobile UI スクショは既に `docs/mobile-ui/screenshots/` に整理済み (Issue #572 完了時に実施)。

該当ファイル例:
```
phase-2c-fullscreen.png
phase-2c-v2-fullscreen.png
phase-2c-v3-fullscreen-shifted.png
phase-2c-v4-no-overflow.png
phase-2d-initial.png
phase-2d-palette-open.png
phase-2d-v2-existing-toggle.png
... (合計 54 件の phase-2* + 12 件の phase3c-* + 8 件の phase3d-*)
```

### Issue #599, #600, #602 (iPad portrait, narrow-height, ruby tab fix) — 約 24 件

`599-*.png`, `600-*.png`, `602-*.png` 系統。バグ修正の before/after 比較画像。

該当ファイル例:
```
599-baseline-768x1024.png
599-below-threshold-720.png
599-final-ipad-mini-744.png
600-after-improvements-1024x768.png
600-baseline-1024x768.png
600-phase2-*.png  (7 件)
602-code-tab-1024.png
602-fixed-ruby-tab-1024.png
602-ruby-tab-1280.png
602-ruby-tab-768.png
```

### その他の中間ファイル — 約 8 件

- `cleanup-1024x768.png`, `cleanup-844x390.png`
- `revert-touch-button-1024.png`
- `stage-button-icon-fixed-1024.png`, `stage-toggle-fixed-1024.png`
- `auto-mobile-*.png` × 4 (auto-mobile prefix)
- `mobile-drawer-3a-*.png`, `mobile-drawer-expanded.png`

## 採用検討 (約 8 件)

完成済みの UI を映しており、機能ドキュメントに転用できる可能性あり。実物を確認した上で判断。

| ファイル | 候補ドキュメント | 備考 |
|---|---|---|
| `tutorials-modal-fullscreen.png` | `docs/tutorial/screenshots/` | チュートリアルモーダル全画面 |
| `classroom-modal-fullscreen.png` | `docs/classroom/images/` | 既存 classroom docs に追加 |
| `classroom-management-fullscreen.png` | `docs/classroom/images/` | クラス管理画面 |
| `classroom-mgmt-300h.png` | (削除候補) | 中間状態か |
| `classroom-mgmt-scrollreset.png` | (削除候補) | バグ修正中間か |
| `url-loader-modal.png` | `docs/project-management/screenshots/` | URL ローダーモーダル |
| `url-loader-200h-scrolled.png` | (削除候補) | 中間状態か |
| `narrow-warning-with-link.png` | `docs/mobile-ui/screenshots/` | 縦持ち警告 |
| `backpack-opened.png`, `backpack-closed.png`, `backpack-expanded.png`, `backpack-auto-expanded.png`, `backpack-on-costume-real.png`, `backpack-on-costume-tab.png`, `pc-backpack-open.png` | `docs/backpack/screenshots/` | バックパック UI |
| `sprite-drag-during.png` | `docs/sprite/screenshots/` | スプライトドラッグ中 |
| `ipad-portrait-baseline.png` | (削除候補) | issue #572 ベースライン |

## 処理コマンド (参考)

ユーザーが判断後に実行する例：

```bash
# 削除推奨をすべて削除
cd /Users/kouji/work/smalruby/smalruby3-editor
rm phase-2*.png phase3c-*.png phase3d-*.png
rm 599-*.png 600-*.png 602-*.png
rm cleanup-*.png revert-*.png stage-button-*.png stage-toggle-*.png
rm auto-mobile-*.png mobile-drawer-3a-*.png mobile-drawer-expanded.png
rm ipad-portrait-baseline.png
rm classroom-mgmt-300h.png classroom-mgmt-scrollreset.png url-loader-200h-scrolled.png

# 採用検討の移動例（採用と判断したものだけ）
mkdir -p docs/backpack/screenshots
mv backpack-opened.png docs/backpack/screenshots/01-backpack-opened.png
mv backpack-expanded.png docs/backpack/screenshots/02-backpack-expanded.png
# ... 他も同様
mv tutorials-modal-fullscreen.png docs/tutorial/screenshots/01-tutorials-modal.png
mv classroom-modal-fullscreen.png docs/classroom/images/classroom-modal-fullscreen.png
mv url-loader-modal.png docs/project-management/screenshots/01-url-loader-modal.png
mv narrow-warning-with-link.png docs/mobile-ui/screenshots/12-narrow-warning-with-link.png
mv sprite-drag-during.png docs/sprite/screenshots/01-sprite-drag-during.png
```

## 今後の運用

Phase A 完了後（本 PR マージ後）は **`tmp/` が `.gitignore` 対象**になるため、Playwright スクリーンショットは `tmp/` に出力すれば repo を汚染しない。詳細は [`_screenshot-guidelines.md`](_screenshot-guidelines.md) 参照。
