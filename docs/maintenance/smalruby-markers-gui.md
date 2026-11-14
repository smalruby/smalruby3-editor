# Smalruby Marker Blocks (scratch-gui)

upstream ファイルに追加した Smalruby 固有コードのマーカー一覧。
マーカーの書式・ルールは `.claude/rules/code-style.md` の「Smalruby Marker Comments」を参照。

> このファイルは `.claude/` の外（`docs/maintenance/`）に置く。実装中に頻繁に編集するため、
> Claude Code の「設定ファイル編集」確認プロンプトで自動実行が止まらないようにするのが目的。

**重要**: Smalruby 固有ファイル（`packages/scratch-gui/.prettierignore` のホワイトリストに含まれるファイル）には
マーカー不要。このファイルに記載するのは **upstream ファイルに埋め込んだマーカーのみ**。

マーカーを追加・削除した場合は、下記の一覧を更新すること。

## 現在のマーカー一覧

| ファイル | 機能名 | 説明 |
|----------|--------|------|
| `src/lib/audio/audio-buffer-player.js` | null-safe AudioContext (issue #633) | `?tab=sounds` 直接遷移時 (user gesture 前) に `SharedAudioContext` が createBuffer を持たない空オブジェクトを返しても crash しないよう、buffer を遅延生成にする。`buffer` getter / `ensureBuffer` / `_hasAudioContext` の追加と `play` のガード。`SharedAudioContext` 自体は変更しない (autoplay policy の既知不具合回避) |
| `src/lib/download-blob.js` | mobile-friendly download strategy (issue #833) | iOS/iPadOS Safari は anchor `download` 属性を無視するため、スクショ等の DL が無反応になる。`isAppleMobile` / `chooseDownloadStrategy` (純粋関数) / `makeFile` / `openBlobInNewTab` を追加し、モバイルでは Web Share API → 新規タブの順でフォールバック。デスクトップは anchor click のまま変更なし |
| `src/lib/detect-locale.js` | case-insensitive locale matching | URL (`?locale=` / `?lang=`) とブラウザの言語を、大文字・小文字を区別せずに対応言語と比べ、対応言語の正しい表記で返す（`ja-hira` → `ja-Hira`）。upstream は小文字にしてから `includes` で比べるため、`ja-Hira` のような大文字を含む言語に一致しない。`findSupportedLocale` の追加と 2 か所の比較（3 ペア） |
| `src/reducers/gui.ts` | Redux state registry | Smalruby reducer の import |
| `src/reducers/gui.ts` | initial state | Smalruby 初期 state の展開 |
| `src/reducers/gui.ts` | reducers | Smalruby reducer の登録 |
| `src/containers/cards.jsx` | tutorial glow animation | チュートリアルのハイライトアニメーション |
| `src/containers/connection-modal.jsx` | smalrubot firmware flash | SmalrubotS1 ファームウェア書き込みの import、ハンドラー、props |
| `src/containers/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 接続初期ステップ |
| `src/containers/connection-modal.jsx` | meshV2 connected message feature | Mesh v2 接続済みメッセージ |
| `src/containers/connection-modal.jsx` | meshV2 back button feature | Mesh v2 戻るボタン |
| `src/components/cards/cards.jsx` | tutorial glow animation | チュートリアル UI のハイライト |
| `src/components/cards/cards.jsx` | external-url button | step の `externalUrl` を新規タブで開くボタン (TryRuby 導線など) |
| `src/components/connection-modal/connection-modal.jsx` | smalrubot firmware flash | SmalrubotS1 ファームウェアボタン propType |
| `src/components/connection-modal/connection-modal.jsx` | network filter detection feature | ネットワークフィルター検出 |
| `src/components/connection-modal/error-step.jsx` | smalrubot firmware flash | エラーステップのファームウェアボタン |
| `src/reducers/modals.js` | smalrubot firmware modal | ファームウェアモーダル開時に接続モーダルを自動で閉じる |
| `src/reducers/modals.js` | lessons library | レッスン表のモーダル `lessonsLibrary`（定数・初期状態・`openLessonsLibrary` / `closeLessonsLibrary` の定義と export。`docs/lessons/README.md`） |
| `src/components/connection-modal/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 初期ステップ UI |
| `src/components/connection-modal/connection-modal.jsx` | smalrubotS1 dedicated flow | SmalrubotS1 専用フロー (PHASES、ステップ振り分け、propTypes) |
| `src/containers/connection-modal.jsx` | smalrubotS1 dedicated flow | SmalrubotS1 専用フロー (initial phase 判定、ハンドラー、props) |
| `src/containers/connection-modal.jsx` | meshV2 seat connect feature | 出席番号でつながる（phase 切り替え・ハンドラー・待ち合わせ中は接続済み画面へ移らない・エラーは番号画面が表示・props） |
| `src/components/connection-modal/connection-modal.jsx` | meshV2 seat connect feature | 出席番号でつながる（PHASES、番号画面の表示、propTypes） |
| `src/components/connection-modal/connected-step.jsx` | meshV2 seat connect feature | 接続済み画面の「そろい具合」の 1 行 |
| `src/components/connection-modal/connected-step.jsx` | meshV2 connected message feature | Mesh v2 接続済みステップ UI |
| `src/components/menu-bar/menu-bar.jsx` | smalrubot firmware menu | SmalrubotS1 メニューの import、ハンドラー、レンダリング、Redux 接続 |
| `src/components/gui/gui.jsx` | smalrubot firmware modal | SmalrubotS1 ファームウェアモーダルの import と配置 |
| `src/components/gui/gui.jsx` | classroom modal | クラスルームモーダルの import と配置（モーダル非表示中は退室依頼の見張り `ClassroomKickRequestWatcher` を代わりにマウント） |
| `src/components/gui/gui.jsx` | bug report modal | プログラム不具合報告モーダルの import、`legalLinks` の「不具合を報告」リンク、`<BugReportModal />` 配置、`handleBugReportClick` ハンドラ、`onOpenBugReportModal` prop/propType、props 伝播防止リスト |
| `src/containers/gui.jsx` | bug report modal | `openBugReportModal` の import、`onOpenBugReportModal` を Redux `openBugReportModal()` にマップ |
| `src/components/modal/modal.css` | default modal background | `.modal-content` (非フルスクリーン) に既定背景 `$ui-white` を付与し、本文背景の設定漏れでも青いオーバーレイが透けないようにする (案X) |
| `src/components/gui/gui.jsx` | meshV2 classroom binding | クラス状態に応じて Mesh v2 ドメインを参加コードに固定する常時マウントの binding |
| `src/components/gui/gui.jsx` | meshV2 self-sensor notice | グローバル変数名と mesh センサーの値の重複を検出し初回のみ通知する常時マウントのバナー (Issue #707) の import と配置 |
| `src/components/gui/gui.jsx` | lesson goal watcher | レッスンモードのあいだ VM を見張り、チャレンジの「できた」を判定して記録・「できた！」を出す常時マウントのコンテナ（`containers/lesson-goal-watcher.jsx`）の import と配置 |
| `src/components/gui/gui.jsx` | welcome modal | 初回訪問者向けウェルカムモーダル HOC の import と配置、`onShowWelcomeModal` prop |
| `src/containers/gui.jsx` | welcome modal | `onShowWelcomeModal` を Redux `openWelcomeModal()` にマップ |
| `src/components/gui/gui.jsx` | DNCL mode notice | DnclModeNotice コンポーネントの import・配置・`onRequestExitDnclMode` prop |
| `src/components/gui/gui.jsx` | lesson mode | レッスンモードのコンテナ `LessonMode`（課題バー + チャレンジを開く流れ）と GA 計測のコンテナ `LessonAnalytics`（描画しない）、クラスの課題へ進み具合を送るコンテナ `LessonProgressSync`（本人の確認のダイアログだけ描画する）の import と、メニューバーと本体（`flexWrapper`）のあいだへの常時マウント（課題バーを画面の幅いっぱいに出す）。`lessonTaskBarVisible` の destructure・propType と、本体に `bodyWrapperWithLessonTaskBar` を付ける classNames（`docs/lessons/README.md`） |
| `src/containers/gui.jsx` | lesson mode | `getCurrentChallenge` の import と、`lessonTaskBarVisible`（チャレンジを開いているか）の state マッピング |
| `src/components/gui/gui.css` | lesson mode | `.body-wrapper-with-lesson-task-bar`: 課題バー（2.5rem）が出ているあいだ本体の高さをその分縮める（narrow-height・メニューバーなしの組み合わせも） |
| `src/components/gui/gui.jsx` | lessons library | レッスン表のコンテナ `LessonsLibrary` の import と、他のモーダルと並ぶ場所（`WelcomeModalHOC` の次）への常時マウント（`docs/lessons/README.md`） |
| `src/containers/gui.jsx` | DNCL mode notice | `onRequestExitDnclMode` を Redux `setDnclMode(false)` + `requestExternalExitDnclMode()` にマップ |
| `src/components/gui/gui.jsx` | genai concierge | 「生成AI に相談」の顔（`GenaiConcierge`）の import とスクリプトエリアへの常時マウント。表示条件はコンテナ側で判定（`docs/genai-consult/README.md`） |
| `src/components/extension-button/extension-button.jsx` | DNCL extension confirm | DNCL モード時の拡張機能ボタンを confirm ダイアログ化（メッセージ定義 + クリックハンドラの 2 箇所）。OK でふりがなモードに戻して拡張機能ライブラリを開く |
| `src/components/extension-button/extension-button.css` | DNCL extension disabled | DNCL モード時の拡張機能ボタンの無効化スタイル |
| `src/components/gui/gui.jsx` | Redux action props prevention | Redux action props の伝播防止 |
| `src/components/gui/gui.jsx` | url loader loading state (#972) | URL ローダーモーダルのローディング状態 `urlLoaderLoading`（URLLoaderHOC 注入）を destructure し、`<URLLoaderModal loading>` 2 箇所へ伝播 + propType。ロード中に「開く」/入力を無効化しスピナー表示する UX 用（1 行インライン ×4） |
| `src/components/gui/gui.jsx` | iPad portrait narrow desktop stage size | 744〜1023px viewport で stage を small に強制 (issue #572 Phase 3-C, #599 で 768→744 拡張) |
| `src/components/gui/gui.css` | iPad portrait narrow desktop layout | 744〜1023px viewport で editor-wrapper の flex-basis を緩める (issue #572 Phase 3-C, #599 で 768→744 拡張) |
| `src/components/gui/gui.css` | iPad portrait legal links cleanup | 744〜1023px viewport でフィードバックリンク + セパレータを非表示 (issue #600, #599 で 768→744 拡張) |
| `src/components/gui/gui.css` | narrow-height vertical chrome compression | max-height: 800px で body-wrapper / tab-list の高さを圧縮 (issue #600) |
| `src/components/menu-bar/menu-bar.css` | narrow-height menu bar compression | max-height: 800px で menu-bar 48→40px に圧縮 (issue #600) |
| `src/components/menu-bar/menu-bar.css` | classroom teacher menu | 右端の「クラス管理」ボタンの余白 |
| `src/playground/index.css` | narrow viewport vertical scroll lock | 狭幅画面で縦スクロールを overflow-y: clip で抑止 (issue #572 Phase 1) |
| `src/playground/index.css` | iPad portrait min-width relax | 744〜1023px viewport の min-width: 1024px を緩めて横スクロールを抑止 (issue #572 Phase 3-C, #599 で 768→744 拡張) |
| `src/containers/gui.jsx` | smalrubot firmware modal | SmalrubotS1 ファームウェアモーダル state マッピング |
| `src/containers/gui.jsx` | classroom modal | クラスルームモーダル state マッピング |
| `src/containers/gui.jsx` | classcode auto-open | クラスコード URL パラメーターによるモーダル自動オープン |
| `src/components/menu-bar/menu-bar.jsx` | classroom button | クラスルームボタンの import、レンダリング、Redux 接続。ラベルの横の印は `ClassroomMenuStatus`（提出状態、レッスンの課題では進み具合の ○ / 2/4 / ✓）。その右に参加中はいつも `ClassroomMenuSubmitButton`（「提出する」/「提出済み ✓」/「返却済み ✓」） |
| `src/components/menu-bar/menu-bar.jsx` | classroom teacher menu | 先生用「クラス管理」メニューを右端（? の左）に置く。先生ログイン中はウェルカムの吹き出しを出さない（welcome tooltip マーカー内）・`classroomTeacherLoggedIn` の Redux 接続 |
| `src/components/menu-bar/menu-bar.jsx` | welcome tooltip | About (`?`) ボタンの左隣にウェルカムバルーンを描画。`buildAboutMenu` 内に `WelcomeTooltip` 配置 + `position: relative` 化、`handleClickWelcomeTooltip` ハンドラ追加、`onShowWelcomeModal` 用 mapDispatchToProps 追加 |
| `src/components/menu-bar/menu-bar.jsx` | help menu | 「チュートリアル」「デバッグ」をメニューバーのボタンから「?」メニューの項目へ移す。`buildAboutMenu` 内に `MenuSection`（`menu-bar-help-tutorials` / `menu-bar-help-debug`）を追加し、upstream の about 項目（`onClickAbout`）も `MenuSection` で囲んで区切り線を入れる、`?` の div に `data-testid="menu-bar-about"`、upstream のボタン群（と先頭の `Divider`）・`helpIcon` / `debugIcon` import を削除 |
| `src/components/menu/menu.jsx` | menu item data-testid | `MenuItem` が `data-testid` prop を `<li>` に渡す（props の分割代入・`<li>` の属性・propTypes の 3 箇所）。integration テスト / Playwright がメニュー項目を直接指せるようにする |
| `src/containers/menu-bar-hoc.jsx` | help menu | 「?」メニューのチュートリアル項目用に `onOpenTipsLibrary` を mapDispatchToProps で供給（upstream は menu-bar.jsx 側で直接 dispatch）。`openLessonsLibrary` の import も同じ行（同一モジュールの二重 import を eslint が禁じるため） |
| `src/components/menu-bar/menu-bar.jsx` | lessons button | upstream の「チュートリアル」ボタンがあった場所（区切り線の間）に「レッスン」ボタン（`menu-bar-lessons`。`lessonsIcon` = `icon--tutorials.svg`）を置く（吹き出しは出さない）。`ariaMessages.lessons`、`onOpenLessonsLibrary` / `lessonModeActive` の propTypes |
| `src/containers/menu-bar-hoc.jsx` | lessons button | `lessonModeActive`（`isLessonMode`。レッスンモード中はウェルカムバルーンを出さない）と `onOpenLessonsLibrary`（`markTutorialSeen` + `openLessonsLibrary`）を供給 |
| `src/components/menu-bar/settings-menu.jsx` | classroom management menu | クラス管理メニューアイテムの import、レンダリング、Redux 接続 |
| `src/components/menu-bar/settings-menu.jsx` | display mode menu | 表示モード (自動/PC/スマホ) 切替。テーマ/Ruby と同じ `PreferenceMenu` サブメニュー形式 + 専用アイコン。`useDisplayMode` hook + `persistDisplayMode` の import、ハンドラ、Redux (open/close) 接続、レンダリング (Issue #865) |
| `src/reducers/menus.js` | display mode menu | `PreferenceMenu` サブメニューの開閉用 Redux state (`displayModeMenu`)。定数/rootMenu への登録/initialState/open・close・selector の追加 (Issue #865) |
| `webpack.config.js` | classroom API | CLASSROOM_API_ENDPOINT 環境変数注入 |
| `webpack.config.js` | scratch api proxy endpoint | SCRATCH_API_PROXY_ENDPOINT 環境変数注入 |
| `webpack.config.js` | self-hosted Monaco Editor (#1171) | Monaco 本体 (`min/vs`) を版付きの `static/monaco/<版>/vs` へコピーする定数（版は monaco-editor の package.json から読む）・CopyWebpackPlugin パターン・`DefinePlugin` の `process.env.MONACO_VS_SUBPATH` 注入と、PWA precache 除外 + runtime caching 設定。マーカーは 2 箇所の `GenerateSW` にも単一行で入る |
| `webpack.config.js` | copy-webpack-plugin 14 (#1320) | dist の `libraries/*.json` コピーで、copy-webpack-plugin 7 で廃止された `flatten: true` の代わりに `to: 'libraries/[name][ext]'` を使う |
| `eslint.config.mjs` | react lifecycle typo detection | `react/no-typos` を error にして getDerivedStateFromProps/Error の static 抜け等を lint で検出 |
| `eslint.config.mjs` | prettier integration | eslintConfigPrettier を最後に置いて prettier と競合する整形ルールを無効化 |
| `src/lib/blocks.js` | gesture recovery import | ジェスチャー復旧モジュールの import |
| `src/lib/blocks.js` | gesture recovery | ジェスチャー復旧ハンドラーのインストール |
| `src/lib/blocks.js` | comment icon patch import | ScratchCommentIcon パッチモジュールの import |
| `src/lib/blocks.js` | comment icon patch | ScratchCommentIcon.fireCreateEvent をオーバーライドして create 後に block_comment_change を re-fire (Blockly v12 の create payload に text が含まれない問題のフォロー) |
| `src/lib/blocks.js` | IME composition patch import | IME 変換ガードモジュールの import (issue #1167) |
| `src/lib/blocks.js` | IME composition patch | `FieldInput.prototype.onHtmlInputKeyDown_` をラップし、IME 変換中の Enter / Escape でフィールドエディタが閉じないようにする (Blockly 12.4.1 のコメント「Trap Enter without IME」が未実装なため) |
| `src/containers/question.jsx` | IME composition guard | 「聞いて待つ」の回答欄で IME 変換確定の Enter が送信にならないようにする (issue #1167) |
| `src/containers/prompt.jsx` | IME composition guard | 変数・リスト・ブロック作成ダイアログで IME 変換確定の Enter が OK にならないようにする (issue #1167) |
| `src/containers/slider-prompt.jsx` | IME composition guard | スライダー範囲設定で IME 変換確定の Enter が OK にならないようにする (issue #1167) |
| `src/containers/list-monitor.jsx` | IME composition guard | ステージ上のリスト編集で IME 変換確定の Enter が新規項目挿入にならないようにする (issue #1167) |
| `src/components/prompt/prompt.jsx` | upstream warning fixes | `Modal` に必須の `id`（`prompt`）を渡す。upstream は渡しておらず prop type 警告が出る (issue #1499) |
| `src/components/record-modal/record-modal.jsx` | upstream warning fixes | `Modal` に必須の `id`（`recordModal`）を渡す (issue #1499) |
| `src/components/monitor/list-monitor-scroller.jsx` | upstream warning fixes | リスト項目の入力欄の `autoComplete={false}`（DOM 属性の警告）を `"off"` にする (issue #1499) |
| `src/containers/list-monitor.jsx` | upstream warning fixes | `value` の prop type に配列（リストの項目）を足す。リストモニターには配列が渡るので警告が出ていた (issue #1499) |
| `src/components/forms/buffered-input-hoc.jsx` | IME composition guard | スプライト名 / x / y / 大きさ / 向きの入力で IME 変換確定の Enter が flush + blur にならないようにする (issue #1167) |
| `src/playground/index.ejs` | interactive-widget viewport for Android keyboard | meta viewport に `interactive-widget=resizes-content` を追加。Android Chrome 108+ でキーボード出現時に layout viewport が縮み、`100dvh` 等の dvh 系単位が追従するようになる |
| `src/playground/render-gui.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/render-gui.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/playground/render-gui.jsx` | MobileGui dispatcher | ResponsiveGui import + GUI を ResponsiveGui に差し替え (issue #572 Phase 2-A) |
| `src/playground/render-gui.jsx` | storage worker timeout HOC | scratch-storage の FetchWorkerTool に 5s タイムアウトを当てる HOC import と compose 配置 (subdir deploy + iOS Safari の Worker hang 対策) |
| `src/components/gui/gui.jsx` | about menu | About メニュー項目（`/about.html` を新規タブで開く + ウェルカムモーダル再表示）の定義と MenuBar への注入 |
| `src/components/sprite-info/sprite-info.jsx` | compact middle sprite info | 中サイズのステージ（`STAGE_DISPLAY_SIZES.middle`。Smalruby 独自）のときだけ別の形で描く: 「スプライト」の字なし・x / y は入力欄の左隣・大きさ / 向きはアイコン（`icon--size.svg` / direction-picker の `icon--all-around.svg`。`title` / `aria-label` は `gui.smalruby3.SpriteInfo.sizeIcon` / `directionIcon`）。icon の import・messages・render の分岐（`docs/sprite/README.md`） |
| `src/components/sprite-info/sprite-info.css` | compact middle sprite info | 上の詰めた形のスタイル（`.compact` / `.compact-name` / `.label-icon`） |
| `src/components/direction-picker/direction-picker.jsx` | compact middle sprite info | `labelIcon` prop: 渡されたら「向き」の字の代わりにそれを Label に出す（propType も） |
| `src/containers/direction-picker.jsx` | compact middle sprite info | `labelIcon` prop をコンポーネントへ渡す（propType も） |
| `src/components/stage-selector/stage-selector.jsx` | middle stage selector without header | `hideHeader` prop: 渡されたら見出し「ステージ」（`.header`）を描かず、`.no-header` のクラスを付ける（分割代入・className・render・propType の 4 ペア。`docs/stage/README.md`） |
| `src/components/stage-selector/stage-selector.css` | middle stage selector without header | 見出しが無いときの背景の絵の上の余白（`.no-header .costume-canvas`） |
| `src/components/target-pane/target-pane.jsx` | middle stage selector without header | 中サイズのステージ（`STAGE_DISPLAY_SIZES.middle`）のとき StageSelector に `hideHeader` を渡す。SP のスプライトのパネルは `keepStageSelectorHeader` で見出しを残す（分割代入・JSX・propType の 3 ペア） |
| `test/integration/backdrops.test.js` / `test/integration/sounds.test.js` | middle stage selector without header | 中サイズのステージ（既定）では見出し「Stage」が無いので、ステージを選ぶのに見出しの代わりに列の「Backdrops」の行（`.label`）を押す |
| `src/components/target-pane/target-pane.jsx` | mobile-sprite-panel suppress-library | MobileSpritePanel が同一ツリーで TargetPane を再描画する際の SpriteLibrary 二重表示を `hideSpriteLibrary` prop で抑止 (issue #572 Phase 2-F) |
| `src/playground/render-gui-standalone.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/render-gui-standalone.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/playground/player.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/player.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/lib/project-saver-hoc.jsx` | URL params for Playwright | URL パラメーター import |
| `src/lib/project-saver-hoc.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/lib/project-saver-hoc.jsx` | classroom beforeunload guard | クラス管理（教師）/生徒参加モーダル表示中はリロード/タブ閉じで beforeunload 確認ダイアログを出す。`mapStateToProps` の `classroomModalOpen` 導出（`teacherModalVisible \|\| modalVisible`、classroom reducer 不在でも安全）、`leavePageConfirm` の OR 条件、propType、props 伝播防止 (issue #1030) |
| `src/lib/project-fetcher-hoc.jsx` | URL params for Playwright | URL パラメーター import |
| `src/lib/project-fetcher-hoc.jsx` | initial tab from URL param | 初期タブ URL パラメーター |
| `src/reducers/editor-tab.js` | initial tab from URL param | 初期タブ URL パラメーター |
| `src/reducers/project-state.js` | restore project state after URL load failure (#972) | Scratch URL 読み込み失敗時に、直前プロジェクトの id + 表示状態へアトミックに復帰する `RESTORE_PROJECT_STATE` アクション/reducer case/`restoreProjectState` action creator（VM 復元内容と redux の projectId 不整合・ERROR 化を防ぐ。4 ペア） |
| `src/reducers/settings.js` | URL params for Playwright | URL パラメーター import |
| `src/reducers/settings.js` | ruby_version URL param | Ruby バージョン URL パラメーター |
| `src/lib/url-params.js` | welcome URL param | `?welcome=1` でウェルカムモーダルを初回ロード時に自動表示 |
| `src/containers/backpack.jsx` | mesh v1 backpack auto-migration | Skyway 停止 (Issue #592) に伴う localStorage バックパックの自動 v1→v2 マイグレーション |
| `src/lib/analytics.js` | extra GA params | `analytics.event` に渡した category / action / label 以外の項目（レッスンの `page` / `seconds` など）を dataLayer の項目として同じ push に入れる（2 ペア: 入れた項目の覚え `pushedExtraKeys` と `event`）。前のイベントで入れた項目は、それを入れないあとのイベントで `undefined` にもどす（GTM は最後の値を覚えるため）。`event` は category で上書きされない（`docs/lessons/README.md` の「GA の計測」） |
| `src/containers/controls.jsx` | block_run analytics | 緑旗クリック時に GA4 イベントを発火 (issue #645 Phase 1) |
| `src/containers/connection-modal.jsx` | mesh_v2/smalrubot_s1 connect analytics | 接続成功時に拡張別カテゴリ (`mesh_v2` / `smalrubot_s1`) で GA4 イベントを発火 (issue #645 Phase 1) |
| `src/containers/connection-modal.jsx` | mesh_v2/smalrubot_s1 disconnect analytics | 切断時に拡張別カテゴリで GA4 イベントを発火 (issue #645 Phase 1) |
| `src/lib/calculatePopupPosition.js` | viewport-aware popup flip | LEFT/RIGHT 配置で配置側にポップアップが収まらない場合、反対側にフリップする (issue #671: SP モードのスプライト削除確認ポップアップが画面外で押せない問題への対策) |
| `src/containers/menu.jsx` | iPad menu item click fix | メニュー項目クリック時の `setTimeout` 遅延を 0 → 100ms に拡大。iPadOS Safari は `pointerup` から `click` 発火まで ~16–32ms 程度のラグがあり、setTimeout(0) で close すると `<li>` が click 発火前に unmount され React onClick が skip される問題への対応 |
| `src/containers/blocks.jsx` | palette-toggle initial render | `componentDidMount` 末尾で `_applyPaletteVisibility` を呼び `forceUpdate()` を起動。`this.workspace` はインスタンス変数なので `inject()` 後に再レンダーが走らず、初回 `render()` で workspace=null のまま PaletteToggle がスキップされる問題への対応 (issue #695) |
| `src/containers/blocks.jsx` | iOS flyout touch bleed fix | MobileGui (SP) で「ブロックを作る」タップ時に iOS の SVG タッチイベントが「変数を作る」にも伝播する問題の修正。`handlePromptStart` を 50ms 遅延して `externalProcedureDefCallback` が先に呼ばれた場合にキャンセル (issue #698) |
| `src/containers/blocks.jsx` | DNCL block filtering | `shouldComponentUpdate` に `dnclMode` を追加して日本語モード切り替え時に即時再レンダリングを保証。import・`getToolboxXML` 内フィルター・`mapStateToProps` への `dnclMode` 追加も含む |
| `src/containers/blocks.jsx` | stale block delete event guard | scratch-blocks v2 の非同期イベント配送で、ワークスペースリロードを跨いで届いた stale な delete イベントが VM のスクリプトを消す問題のガード。`attachVM` で `vm.blockListener` を `createStaleBlockDeleteGuard` でラップ (issue #710)。import も含む |
| `src/containers/blocks.jsx` | Ruby-converted toolbox update deferral | `onWorkspaceUpdate` の fromRuby 分岐の `updateToolbox()` を `Events.disable()` 窓の外 (finally 後) へ移動。窓内では flyout 再構築の create イベントが破棄され、新規変数が `runtime.monitorBlocks` / `flyoutBlocks` に登録されずモニタチェックボックスが無反応になる問題の修正 (issue #719)。フラグ宣言部と実行部の 2 箇所 |
| `src/containers/blocks.jsx` | extension category flyout scroll | `handleExtensionAdded` 末尾で `_pendingScrollToCategoryId` をセット。scratch-blocks v1 は追加カテゴリへ自動でフォーカスしたが v2 continuous toolbox はしないため、post-rebuild で新カテゴリへスクロールさせる (Issue #749 の v13.7.2 再整合で `setBlockStyle` 復元と共存) |
| `src/containers/blocks.jsx` | lesson mode | `getLessonAllowedBlocks` と `allowedBlocksToIds` / `filterDynamicCategoryXmlList` の import と、`mapStateToProps` の `tutorialAllowedBlocks` にレッスンモードのチャレンジの `allowedBlocks` をチュートリアルより優先して渡す（`docs/lessons/README.md`） |
| `src/containers/blocks.jsx` | lesson dynamic category filtering | 「変数」「ブロック定義」のカテゴリコールバックを `allowedBlocks` で絞り、`applyBlockDefaultsToElements` で初期値を入れるラッパー、`getTutorialAllowedBlockIds`、`getToolboxXML` で `onlyBlocks` と `makeToolboxXML` の最後の引数に渡す部分（`docs/lessons/README.md`） |
| `src/containers/blocks.jsx` | lesson palette block defaults | `lib/lessons/block-defaults.js` の import、`getTutorialBlockDefaults`（`allowedBlocks` に書いたブロックの初期値を locale で選ぶ）、`getToolboxXML` の戻り値に `applyBlockDefaultsToToolboxXml` で初期値を入れる部分（`docs/lessons/README.md`） |
| `src/containers/custom-procedures.jsx` | cat-blocks theme for custom procedures | `setBlocks` で `workspaceConfig.scratchTheme` に catblocks/classic を設定し、定義モーダルのブロックをメインエディタと同じテーマにする (Issue #749 の v13.7.2 再整合で upstream の `workspaceConfig.theme = theme` 採用と共存) |
| `src/containers/stage-header.jsx` | classroom submission thumbnail | クラスルーム参加中の生徒にだけ upstream の「提出サムネイルを設定」ボタンを表示。`isStudentJoined` ヘルパー + import、`manuallySaveThumbnails`/`userOwnsProject` を joined 由来の props にマップ、`onUpdateProjectThumbnail` でキャプチャを redux にキャッシュ、`isStudentJoined` の named export (issue #631) |
| `src/lib/vm-manager-hoc.jsx` | koshien mock config wiring | VM 初期化時に `wireKoshienMockConfig(vm)` を呼び、甲子園拡張機能が練習ゲーム設定（マップ/自機サイド/相手AI）を読めるよう runtime に getter を差し込む (import + componentDidMount) |
| `src/lib/titled-hoc.jsx` | start-tutorial button | チュートリアル開始ボタンが設定した保留プロジェクトタイトル（`pendingProjectTitle`）の適用とクリア（6 ペア。`src/reducers/cards.js` と対） |
| `src/reducers/cards.js` | start-tutorial button | `SET_PENDING_PROJECT_TITLE` アクションと `pendingProjectTitle` state — チュートリアル開始時に適用するプロジェクトタイトルの保留（5 ペア） |
| `src/lib/define-dynamic-block.js` | argumentsByMethod support / argumentsByMethod layout / menu field support | 拡張ブロックの `argumentsByMethod`（メソッドごとの引数定義）と menu フィールドのサポート。undo/redo・プロジェクトロードのため複数回の `domToMutation` を許容 |
| `src/lib/sb-file-uploader-hoc.jsx` | clear Google Drive state on file upload | ローカル sb3 ファイルのアップロード時に Google Drive のロード状態をクリア（3 ペア） |
| `src/lib/make-toolbox-xml.js` | DNCL hide extensions | DNCL（日本語）モード時にツールボックスから拡張機能カテゴリを隠す |
| `src/lib/make-toolbox-xml.js` | lesson dynamic category filtering | `isDynamicCategoryAllowed` の import と、引数 `dynamicCategoryIds`（レッスン・チュートリアルの `allowedBlocks`）に変数・ブロック定義の opcode が無ければ「変数」「ブロック定義」のカテゴリを出さない |
| `src/lib/locale-utils.js` | Japanese locale check | 日本語ロケール（ja / ja-Hira）判定ヘルパー |
| `src/lib/legacy-storage.ts` | local sprite assets | スプライトの画像アセットをローカル配信の web store から解決する追加登録 |
| `src/lib/legacy-backpack-storage.ts` | localStorage backpack support | バックパックを localStorage に保存する対応（5 ペア） |
| `src/lib/alerts/index.jsx` | classroom session expired alert | クラスルームのセッション失効アラートの定義 |
| `src/components/alerts/alert.jsx` | classroom session expired | セッション失効アラートの表示側 |
| `src/containers/alert.jsx` | classroom session expired | セッション失効アラートのコンテナ側（3 ペア） |
| `src/lib/libraries/extensions/index.jsx` | TM2Scratch extension / AkaDako extension / Ruby String extension | 拡張機能ライブラリへの Smalruby 拡張エントリ（各 2 ペア。取り外し可能拡張の分離マーカーと同名系列） |
| `src/components/connection-modal/connection-modal.css` | meshV2 name search / network filter detection feature | mesh v2 グループ名検索 UI とネットワークフィルター検出表示のスタイル |
| `src/containers/scanning-step.jsx` | meshV2 name search / meshV2 scanning step / meshV2 seat numbers | mesh v2 のグループ名検索とスキャンステップの拡張、出席番号の受け渡し（計 6 ペア） |
| `src/components/connection-modal/peripheral-tile.jsx` | customizable name label | ペリフェラルタイルの名前ラベルのカスタマイズ対応（2 ペア） |
| `src/components/menu-bar/project-title-input.jsx` | read-only project title for Google Drive | Google Drive の閲覧専用プロジェクトでタイトル入力を read-only 化（4 ペア） |
| `src/components/menu-bar/project-title-input.css` | read-only project title for Google Drive | 同機能のスタイル |
| `src/components/cards/card.css` | insert-code button overlay / tutorial glow animation | チュートリアルカードの「コードを挿入」ボタンのオーバーレイとハイライトアニメーションのスタイル |
| `test/helpers/selenium-helper.js` | getLogs SEVERE filter | `getLogs()` が SEVERE を返さなかった不具合（`entry.level` は `logging.Level` のオブジェクト）を直し、絞り込みと既知の無害なログの一覧を `test/helpers/ignorable-severe-logs.js` の `filterBrowserLogs` に任せる（import と本体の 2 ペア）。他の Smalruby マーカー（extra helpers / no-sandbox など）は従来どおり |

> 注: `src/lib/url-params.js` は Smalruby 固有ファイル（`.prettierignore` ホワイトリスト対象）の
> ため本表の対象外（旧エントリは削除済み。固有ファイル内のマーカーは取り外し可能拡張の
> 分離用で、`.claude/rules/code-style.md` 参照）。

## 機械検査（upstream マージ時に必ず実行）

表は人手で更新するため漏れうる。マージ時は grep での機械検査を併用すること:

```bash
cd packages/scratch-gui
# 1. Start/End ペア整合（数が一致すること）
grep -rl 'Smalruby: Start' src/ webpack.config.js eslint.config.mjs | \
  while read f; do s=$(grep -c 'Smalruby: Start' "$f"); e=$(grep -c 'Smalruby: End' "$f"); \
  [ "$s" != "$e" ] && echo "MISMATCH $f: Start=$s End=$e"; done
# 2. マーカー持ちファイルが本表に載っているか（NOT_IN_DOC のうち
#    .prettierignore ホワイトリスト対象 = Smalruby 固有ファイルは載せなくてよい）
grep -rl 'Smalruby: Start' src/ webpack.config.js eslint.config.mjs | \
  while read f; do grep -q "$f" ../../docs/maintenance/smalruby-markers-gui.md || echo "NOT_IN_DOC: $f"; done
```

## 関連ファイル

マーカーで囲まれたコードが参照するファイル:
- `src/reducers/smalruby-registry.ts` — gui.ts のマーカーから参照
- `src/lib/backpack-mesh-v1-migration.js` — backpack.jsx のマーカーから参照
