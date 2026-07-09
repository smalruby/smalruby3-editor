# Playwright での SP/iPad 確認

[`docs/mobile-ui/ui-ux.md`](ui-ux.md) と対になるドキュメント。**SP/iPad 対応のリグレッション確認** や **新規 SP 機能の動作確認** を Playwright (MCP / 通常 CLI どちらでも) で行うときに参照する。

このドキュメントの目的:

1. **要素の指し方を統一**: 後から触る人が XPath や title 属性に頼らないよう、`data-testid` を一括検索できる。
2. **viewport プリセットを共有**: 「iPad mini」「iPhone 14 横」など実機サイズの代表値を一箇所にまとめる。
3. **MobileGui / desktop GUI どちらが出るかを事前に判断できる**: ui-ux.md §1 の切替表とセットで使う。

---

## 1. URL パラメータ

`packages/scratch-gui/src/lib/url-params.js` で扱われる Smalruby 独自パラメータ。

| Parameter        | Values                            | 用途                                                       |
| ---------------- | --------------------------------- | ---------------------------------------------------------- |
| `no_beforeunload` | `1`                              | beforeunload ダイアログ無効化 (Playwright では必須)         |
| `tab`            | `code` / `costumes` / `sounds` / `ruby` | 初期タブ                                              |
| `ruby_version`   | `1` / `2`                         | Ruby バージョン強制 (localStorage に依存しない)             |
| `rubyMode`       | `ruby` / `furigana` / `dncl`      | Ruby タブの初期モード                                       |
| `features`       | カンマ区切り                      | 隠し機能の有効化 (現在は未使用)                             |

MobileGui への切替は viewport サイズで自動判定される (URL パラメータでのオプトインは存在しない)。

ベース URL 例:

```
http://localhost:8601?no_beforeunload=1&tab=ruby&ruby_version=2
```

クラスルーム機能は `CLASSROOM_API_ENDPOINT` 環境変数があれば常時有効 (`?features=classroom` は不要)。

---

## 2. Viewport プリセット

[`docs/mobile-ui/ui-ux.md`](ui-ux.md) の §1 にある切替表とセットで使うプリセット。

| プリセット名             | サイズ      | 出るモード                  | スクリーンショット番号 |
| ------------------------ | ----------- | --------------------------- | ---------------------- |
| iPhone 14 横             | 844×390     | MobileGui                   | 02–10                  |
| iPhone 14 縦             | 390×844     | MobileGui + 縦持ちゲート    | 11                     |
| iPad mini portrait       | 744×1133    | desktop GUI (iPad 調整)    | 23                     |
| iPad portrait            | 768×1024    | desktop GUI (iPad 調整)    | 20                     |
| iPad landscape           | 1024×768    | desktop GUI (高さ調整)     | 21–22                  |
| Desktop reference        | 1280×800    | desktop GUI (upstream)     | 24                     |

```js
// Playwright (test runner)
await page.setViewportSize({ width: 844, height: 390 });   // iPhone 14 横
await page.setViewportSize({ width: 768, height: 1024 });  // iPad portrait
await page.setViewportSize({ width: 1024, height: 768 });  // iPad landscape
```

```js
// Playwright MCP
await mcp.browser_resize({ width: 844, height: 390 });
```

リサイズ後 `useIsNarrowScreen` の matchMedia listener が即座に反応するので、特に reload は不要 (再描画は自動)。

---

## 3. data-testid 一覧

すべて `<component>-<element>` のケバブケース。命名規則は `.claude/rules/scratch-gui/e2e-test.md` を参照。

### 3.1 MobileSideRail (`mobile-side-rail.jsx`)

| data-testid                          | 要素   | 役割                                            |
| ------------------------------------ | ------ | ----------------------------------------------- |
| `mobile-side-rail`                   | div    | サイドレール全体                                |
| `mobile-side-rail-menu`              | button | ハンバーガー (☰) → ドロワーを開く                |
| `mobile-side-rail-play`              | button | 実行/停止 (▶ / ⏹)                                |
| `mobile-side-rail-code`              | button | コードタブに切替                                |
| `mobile-side-rail-costume`           | button | コスチュームタブに切替                          |
| `mobile-side-rail-sound`             | button | 音タブに切替                                    |
| `mobile-side-rail-ruby`              | button | ルビータブに切替                                |
| `mobile-side-rail-sprite`            | button | スプライトパネル overlay の開閉                 |
| `mobile-side-rail-backpack`          | button | バックパックの開閉                              |

active 状態は `[data-active="true"]` 属性で表現される。

### 3.2 MobileDrawer (`mobile-drawer.jsx`)

| data-testid                                | 要素     | 役割                                                   |
| ------------------------------------------ | -------- | ------------------------------------------------------ |
| `mobile-drawer`                            | div      | ドロワー本体 (slide-in パネル)                         |
| `mobile-drawer-backdrop`                   | div      | 背景 (タップで閉じる)                                  |
| `mobile-drawer-close`                      | button   | × ボタン                                                |
| `mobile-drawer-new`                        | button   | 新しいプロジェクト                                      |
| `mobile-drawer-open-google-drive`          | button   | Google Drive から開く                                   |
| `mobile-drawer-open-device`                | button   | パソコンから開く                                        |
| `mobile-drawer-open-scratch`               | button   | Scratch URL から開く                                    |
| `mobile-drawer-save`                       | button   | 保存                                                    |
| `mobile-drawer-save-as`                    | button   | 名前を付けて保存                                        |
| `mobile-drawer-turbo-mode`                 | button   | ターボモード on/off                                     |
| `mobile-drawer-classroom`                  | button   | 生徒モードでクラスルーム参加                            |
| `mobile-drawer-mesh`                       | button   | Mesh v2 接続                                             |
| `mobile-drawer-classroom-management`       | button   | クラス管理 (教師モード)                                 |
| `mobile-drawer-toggle-${key}`              | button   | アコーディオン開閉 (`language` / `ruby-version` など)    |
| `mobile-drawer-locale-${code}`             | button   | locale 選択 (`ja` / `ja-Hira` / `en` ほか)               |
| `mobile-drawer-ruby-version-${version}`    | button   | Ruby version 切替 (`1` / `2`)                            |
| `mobile-drawer-switch-to-desktop`          | button   | PC モードに切り替える (表示モードを desktop に固定, #865) |

### 3.3 MobileModeNotice (`mobile-mode-notice.jsx`)

スマホモードで一度だけ表示される案内バー (#865)。「いまはスマホ用の画面である / PC とは違う / メニューから PC モードへ切り替えられる」ことを伝える。閉じると `localStorage['smalruby:mobileModeNoticeDismissed']='true'` に記録し以後出さない。

| data-testid                    | 要素   | 役割                                              |
| ------------------------------ | ------ | ------------------------------------------------- |
| `mobile-mode-notice`           | div    | 案内バー本体 (dismiss 済みなら DOM に無い)        |
| `mobile-mode-notice-switch`    | button | PC モードに切り替える (desktop に固定 + 閉じる)   |
| `mobile-mode-notice-dismiss`   | button | 案内を閉じる (スマホモードのまま)                 |
| `mobile-mode-notice-close`     | button | × で閉じる (dismiss と同じ)                       |

### 3.4 MobileBottomTabs (`mobile-bottom-tabs.jsx`)

旧構成で使っていたボトムタブ。現在は MobileSideRail に統合済みで MobileGui からはレンダリングされないが、コンポーネント本体は残っているため data-testid も保持されている。

| data-testid                          | 要素   | 役割                |
| ------------------------------------ | ------ | ------------------- |
| `mobile-bottom-tabs`                 | div    | ボトムタブコンテナ  |
| `mobile-bottom-tabs-${tab.key}`      | button | 各タブボタン        |

### 3.5 MobileTopBar (`mobile-top-bar.jsx`)

旧フェーズで使っていた上部バー。同じく現在は MobileSideRail 統合済み。

| data-testid             | 要素   | 役割                          |
| ----------------------- | ------ | ----------------------------- |
| `mobile-top-bar`        | div    | 上部バーコンテナ              |
| `mobile-top-bar-menu`   | button | ハンバーガー (現在 MobileSideRail に移動) |
| `mobile-top-bar-title`  | span   | プロジェクト名表示            |
| `mobile-top-bar-play`   | button | 実行/停止 (現在 MobileSideRail に移動) |

### 3.6 MobileSpritePanel (`mobile-sprite-panel.jsx`)

| data-testid             | 要素 | 役割                           |
| ----------------------- | ---- | ------------------------------ |
| `mobile-sprite-panel`   | div  | スプライト overlay コンテナ    |

中身は upstream `<TargetPane>`。スプライト一覧・追加 FAB・ステージ列は upstream のセレクタで指す。

### 3.7 MobileOrientationGate (`mobile-orientation-gate.jsx`)

| data-testid                  | 要素 | 役割                     |
| ---------------------------- | ---- | ------------------------ |
| `mobile-orientation-gate`    | div  | 縦持ち警告オーバーレイ   |

### 3.8 MobilePaintToolbarToggle (`mobile-paint-toolbar-toggle.jsx`)

| data-testid                       | 要素   | 役割                                  |
| --------------------------------- | ------ | ------------------------------------- |
| `mobile-paint-toolbar-toggle`     | button | コスチュームタブの ▼/▲ トグル         |

### 3.9 RubyToolbar (`ruby-toolbar.jsx`)

ルビータブの上部ツールバー。SP/desktop で同じセレクタが使える。

| data-testid                                   | 要素   | 役割                       |
| --------------------------------------------- | ------ | -------------------------- |
| `ruby-toolbar-execute`                        | button | 実行/停止                  |
| `ruby-toolbar-undo`                           | button | 元に戻す                   |
| `ruby-toolbar-redo`                           | button | やり直す                   |
| `ruby-toolbar-search`                         | button | 検索                       |
| `ruby-toolbar-auto-correct`                   | button | 自動置換トグル             |
| `ruby-toolbar-rubytee`                        | button | ルビティー (AI)            |
| `ruby-toolbar-mode-furigana`                  | button | ふりがなモード             |
| `ruby-toolbar-mode-ruby`                      | button | Ruby モード                |
| `ruby-toolbar-mode-dncl`                      | button | 日本語(DNCL)モード         |
| `ruby-toolbar-more-menu`                      | button | その他メニュー             |
| `ruby-toolbar-menu-download`                  | div    | Ruby スクリプト保存        |
| `ruby-toolbar-menu-insert-class`              | div    | クラス挿入                 |
| `ruby-toolbar-menu-preview`                   | div    | プレビュー                 |
| `ruby-toolbar-menu-auto-correct-settings`     | div    | 自動置換設定               |
| `ruby-toolbar-prev-sprite`                    | button | 前のスプライト             |
| `ruby-toolbar-next-sprite`                    | button | 次のスプライト             |
| `ruby-toolbar-sprite-search`                  | input  | スプライト検索 (SP 非表示) |

### 3.10 PaletteToggle (`palette-toggle.jsx`)

ブロックパレットの表示/非表示トグル。SP では紫拡大版のスタイルになるが、同じセレクタが使える。

| data-testid             | 要素   | 役割                                    |
| ----------------------- | ------ | --------------------------------------- |
| `palette-toggle-button` | button | ブロックパレットの表示/非表示 (◀ / ▶) |

---

## 4. 共通操作パターン

### 4.1 SP モードに入って各タブを巡回

```js
await page.setViewportSize({ width: 844, height: 390 });
await page.goto('http://localhost:8601?no_beforeunload=1');

// MobileSideRail が出ているか確認
await expect(page.getByTestId('mobile-side-rail')).toBeVisible();

// 各タブを順に切替
for (const key of ['code', 'costume', 'sound', 'ruby', 'sprite']) {
    await page.getByTestId(`mobile-side-rail-${key}`).click();
    await page.waitForTimeout(300);
}
```

### 4.2 全画面ステージ起動 → 停止

```js
const play = page.getByTestId('mobile-side-rail-play');
await play.click();           // 全画面 + 緑旗
await page.waitForTimeout(500);
await play.click();           // 停止 + 全画面解除
```

### 4.3 ドロワーから locale 切替

```js
await page.getByTestId('mobile-side-rail-menu').click();
await expect(page.getByTestId('mobile-drawer')).toBeVisible();

// 言語アコーディオンを開いて ja-Hira を選択
await page.getByTestId('mobile-drawer-toggle-language').click();
await page.getByTestId('mobile-drawer-locale-ja-Hira').click();
```

### 4.4 縦持ちオーバーレイの出現確認

```js
await page.setViewportSize({ width: 390, height: 844 }); // 縦
await expect(page.getByTestId('mobile-orientation-gate')).toBeVisible();

await page.setViewportSize({ width: 844, height: 390 }); // 横
await expect(page.getByTestId('mobile-orientation-gate')).not.toBeVisible();
```

### 4.5 iPad モード (desktop GUI が出ている) を確認

```js
await page.setViewportSize({ width: 768, height: 1024 });
await page.goto('http://localhost:8601?no_beforeunload=1');

// MobileGui が出ていないこと = MobileSideRail がレンダリングされない
await expect(page.getByTestId('mobile-side-rail')).toHaveCount(0);

// upstream desktop GUI のセレクタが効くこと
await expect(page.locator('[class*="menu-bar_menu-bar"]')).toBeVisible();
```

### 4.6 コスチュームの ▲/▼ トグル

```js
await page.getByTestId('mobile-side-rail-costume').click();
const toggle = page.getByTestId('mobile-paint-toolbar-toggle');
await toggle.click(); // 折りたたみ
await page.waitForTimeout(200);
await toggle.click(); // 展開
```

---

## 5. ブロックパレット文字化け回避

Playwright でルビータブ (またはコスチューム/音タブ) からコードタブに切り替えると、ブロックパレットの文字が乱れることがある。コードタブ非表示中に Blockly が SVG を再構築する際 `getBBox()` が `0` を返してブロックパスの幅が最小値で固定されるのが原因。**通常のブラウザ操作では発生しない (Playwright 環境固有)。**

タブ切替後に `resize` を発火して再描画させる:

```js
await page.locator('[role="tab"]').first().click();
await page.waitForTimeout(500);
await page.evaluate(() => window.dispatchEvent(new Event('resize')));
await page.waitForTimeout(500);
```

---

## 6. Monaco Editor の操作

ルビータブの Monaco エディタを操作する場合:

```js
// 値を設定
await page.evaluate(() => {
    monaco.editor.getEditors()[0].setValue('move(10)\n');
});

// 値を取得
const code = await page.evaluate(() =>
    monaco.editor.getEditors()[0].getValue()
);

// エラーマーカーを取得
const markers = await page.evaluate(() => {
    const model = monaco.editor.getEditors()[0].getModel();
    return monaco.editor.getModelMarkers({ resource: model.uri }).map(m => ({
        line: m.startLineNumber,
        message: m.message,
        severity: m.severity,
    }));
});
```

---

## 7. デバッグ用グローバル

ルビータブを一度開いた後に `window.smalruby` が利用可能になる:

```js
window.smalruby.vm        // VM インスタンス
window.smalruby.sprite    // 現在のターゲット (RenderedTarget)
window.smalruby.blocks    // 現在ターゲットの blocks
window.smalruby.runtime   // VM runtime
window.smalruby.stage     // ステージ
window.smalruby.comments  // コメント
```

詳細は `CLAUDE.md` の「Browser Debugging with Playwright MCP」セクション。

---

## 8. リグレッションチェックリスト (SP 関連 PR をマージ前に通すべきもの)

ui-ux.md §4 「設計原則」に違反していないかをチェック:

- [ ] **MobileGui への切替が 844×390 で発火する**: `mobile-side-rail` が出るか
- [ ] **MobileGui 切替が 768×1024 (iPad portrait) で発火しない**: `mobile-side-rail` が DOM に存在しない
- [ ] **iPad portrait で横スクロールが出ない**: `document.documentElement.scrollWidth <= window.innerWidth`
- [ ] **iPad landscape で menu-bar が圧縮される**: `getComputedStyle(menuBar).height` が 40px 程度
- [ ] **縦持ち時にオーバーレイが出る**: 390×844 で `mobile-orientation-gate` が visible
- [ ] **ドロワーの主要メニューが揃っている**: `mobile-drawer-new` `-save` `-classroom` `-mesh` の visibility
- [ ] **新規追加要素には data-testid がある**: 該当 PR の diff を grep
- [ ] **新規追加 CSS は upstream ファイルではマーカーで囲まれている**: `git diff` で `=== Smalruby:` の有無

検証用スクリーンショットは `docs/mobile-ui/screenshots/` を up-to-date に保つ。命名規則は `docs/_screenshot-guidelines.md` を参照。
