# Screenshot Inventory: 既存未追跡 PNG の棚卸し（処理済み）

Issue #616 時点で、リポジトリ root に **130 枚の未追跡 PNG** が放置されていた（過去 Issue #572, #599, #600, #602 の Playwright 作業時の中間ファイル）。本 PR で棚卸しに従って処理を実行した。

> **本ドキュメントは作業履歴**。今後 Phase B 以降ではこのドキュメントを参照することはないため、Phase D 完了後に削除して構わない。

## 処理結果

| 処理 | 件数 | 結果 |
|---|---|---|
| **削除実施** | 117 件 | 過去 Issue (#572/#599/#600/#602) の中間ファイル。視覚的価値なし |
| **機能 docs に転用** | 13 件 | 完成済みの UI、4 桁命名で移動 |
| **`docs/classroom/images/` → `screenshots/` 改名** | 13 件 | 4 桁命名にリネーム |

## 実施内容

### A. `docs/classroom/images/` → `docs/classroom/screenshots/` に統一

中項目: 01 全般 / 02 先生フロー / 03 生徒フロー

| Before | After |
|---|---|
| `images/01-menu-bar.png` | `screenshots/0101-menu-bar.png` |
| `images/04-teacher-login.png` | `screenshots/0201-teacher-login.png` |
| `images/05-teacher-dashboard.png` | `screenshots/0202-teacher-dashboard.png` |
| `images/06-teacher-create.png` | `screenshots/0203-teacher-create.png` |
| `images/07-teacher-detail.png` | `screenshots/0204-teacher-detail.png` |
| `images/13-teacher-detail-submitted.png` | `screenshots/0205-teacher-detail-submitted.png` |
| `images/14-teacher-member-detail.png` | `screenshots/0206-teacher-member-detail.png` |
| `images/03-student-join.png` | `screenshots/0301-student-join.png` |
| `images/08-student-seat.png` | `screenshots/0302-student-seat.png` |
| `images/09-student-joined.png` | `screenshots/0303-student-joined.png` |
| `images/10-student-status.png` | `screenshots/0304-student-status.png` |
| `images/12-student-submitted.png` | `screenshots/0305-student-submitted.png` |
| `images/11-student-submit-confirm.png` | `screenshots/0306-student-submit-confirm.png` |

`docs/classroom/README.md` および `docs/classroom/ui-ux.md` の参照もすべて更新済み。`docs/classroom/images/` ディレクトリは空になったので削除。

### B. 機能 docs に転用 (13 件)

#### `docs/backpack/screenshots/` (7 件)

中項目: 01 メイン状態 / 02 コスチュームタブ上 / 03 PC 表示

| Before | After |
|---|---|
| `backpack-closed.png` | `0101-backpack-closed.png` |
| `backpack-opened.png` | `0102-backpack-opened.png` |
| `backpack-expanded.png` | `0103-backpack-expanded.png` |
| `backpack-auto-expanded.png` | `0104-backpack-auto-expanded.png` |
| `backpack-on-costume-tab.png` | `0201-on-costume-tab.png` |
| `backpack-on-costume-real.png` | `0202-on-costume-tab-real.png` |
| `pc-backpack-open.png` | `0301-pc-open.png` |

#### `docs/tutorial/screenshots/` (1 件)

| Before | After |
|---|---|
| `tutorials-modal-fullscreen.png` | `0101-tutorials-modal.png` |

#### `docs/classroom/screenshots/` (2 件追加)

| Before | After |
|---|---|
| `classroom-modal-fullscreen.png` | `0102-modal-fullscreen.png` (中項目 01 全般) |
| `classroom-management-fullscreen.png` | `0207-management-fullscreen.png` (中項目 02 先生フロー) |

#### `docs/project-management/screenshots/` (1 件)

| Before | After |
|---|---|
| `url-loader-modal.png` | `0101-url-loader-modal.png` |

#### `docs/mobile-ui/screenshots/` (1 件追加)

| Before | After |
|---|---|
| `narrow-warning-with-link.png` | `0101-narrow-warning-with-link.png` |

#### `docs/sprite/screenshots/` (1 件)

| Before | After |
|---|---|
| `sprite-drag-during.png` | `0101-sprite-drag-during.png` |

### C. 削除 (117 件)

過去 Issue の中間ファイル群を削除：

- `599-*.png` × 6 (Issue #599 iPad mini portrait)
- `600-*.png` × 14 (Issue #600 narrow-height)
- `602-*.png` × 4 (Issue #602 ruby-tab fix)
- `phase-2*-*.png` × 54 (Issue #572 Mobile UI Phase 2 各ステップ)
- `phase3c-*.png` × 12 (Issue #572 Phase 3-C iPad portrait)
- `phase3d-*.png` × 8 (Issue #572 Phase 3-D palette toggle)
- `auto-mobile-*.png` × 4
- `mobile-drawer-3a-*.png` × 5, `mobile-drawer-3a.png`, `mobile-drawer-expanded.png`
- `cleanup-*.png` × 2
- `revert-touch-button-1024.png`, `stage-button-icon-fixed-1024.png`, `stage-toggle-fixed-1024.png`
- `ipad-portrait-baseline.png`
- `classroom-mgmt-300h.png`, `classroom-mgmt-scrollreset.png`
- `url-loader-200h-scrolled.png`

合計 **117 件削除**。

## 今後の運用

本 PR で `.gitignore` に `/tmp/` を追加したため、Phase B 以降の Playwright 撮影は `tmp/` に出力する運用とする。詳細は [`_screenshot-guidelines.md`](_screenshot-guidelines.md) 参照。

転用した 13 件は **画像ファイルとしてリポジトリに追加** したのみで、機能ドキュメント (`README.md`) からの参照リンクはまだ張られていない。Phase B（視覚価値の高い機能の撮影）で各機能の本格的な撮影を進めながら、転用ファイルを README.md から参照するか、不要なら削除する判断を行う。
