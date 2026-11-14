# テスト

## data-testid 一覧

Playwright MCP および Selenium integration tests で使用する `data-testid` 属性の完全な一覧です。

> **クラス管理の data-testid はこの一覧だけに書く。** 画面ごとの見た目・文言・操作は [ui-ux.md](ui-ux.md) にあり、そちらには testid を書かない（`.claude/rules/scratch-gui/e2e-test.md` もここを参照する）。testid を追加・変更したら、この一覧だけを更新する。

### フェーズ検出

各フェーズのルート要素に付与されます。現在表示中のフェーズを判定するのに使います。

| data-testid | フェーズ |
|------------|---------|
| `classroom-modal` | モーダル全体 |
| `classroom-phase-teacher-login` | 先生: ログイン (Google / Microsoft) |
| `classroom-phase-teacher-class-list` | 先生: クラス一覧（ログイン後の入口。v2 landing） |
| `classroom-phase-teacher-dashboard` | 先生: 課題ダッシュボード（クラス選択後） |
| `classroom-phase-teacher-create` | 先生: 課題作成 |
| `classroom-phase-teacher-detail` | 先生: 課題詳細 |
| `classroom-phase-teacher-google-courses` | 先生: GC コース一覧 |
| `classroom-phase-teacher-post-assignment` | 先生: 課題配信 |
| `classroom-phase-student-join` | 生徒: 参加コード入力 |
| `classroom-phase-student-seat` | 生徒: 席番号選択 |
| `classroom-phase-student-joined` | 生徒: 参加完了 |
| `classroom-phase-student-status` | 生徒: ステータス |
| `classroom-phase-submit-confirm` | 生徒: 提出確認 |
| `classroom-phase-submit-done` | 生徒: 提出できました |

### 操作ボタン

| data-testid | 要素 | 説明 |
|------------|------|------|
| `settings-menu` | div | 設定メニュー（⚙ アイコン） |
| `settings-classroom-management` | MenuItem | 設定 → クラス管理 |
| `classroom-menu-button` | div | メニューバーのクラスボタン |
| `classroom-google-login` | button | Google ログイン |
| `google-signin-slot` | div | GIS が描画するサインインボタンのホスト（不具合報告モーダルにも同 testid で存在） |
| `google-signin-button` | div | 上記スロット内に GIS 用に生成されるノード |
| `classroom-microsoft-login` | button | Microsoft ログイン |
| `classroom-back` | button | 戻る |
| `classroom-refresh` | button | 更新 (↻) |
| `classroom-google-import` | button | Google Classroom からインポート |
| `classroom-google-import-confirm` | button | GC コース一覧の「インポート」（未選択時は disabled） |
| `classroom-avatar-button` | button | アカウントメニュー（タイトルバー右上・メール頭文字 + ▼） |
| `classroom-teacher-logout` | button | ログアウト（アカウントメニュー内） |

### 課題作成

| data-testid | 要素 | 説明 |
|------------|------|------|


### サイドバー (先生・常時表示、login 以外のフェーズで visible)

サイドバーはクラス管理モーダル左側に常時表示される（teacher-login 以外）。「クラス一覧 (ダッシュボード)」ではなく **サイドバー** に登録済みの課題がクラス（学級）ごとにリスト表示される。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-sidebar-group-{className}` | div | クラス（学級）名でグルーピングされたヘッダ（例: 「6年A組」）|
| `classroom-sidebar-item-{classroomId}` | li | サイドバーの個別の課題項目。`data-classroom-id` 属性も持つ。クリックで `selectedClassroom` が更新され `teacher-class-detail` フェーズへ遷移。表示テキストは `assignmentName · 人数 · 参加コード(小文字)` |

### 課題詳細 (先生)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-detail-name` | div | 課題が属するクラス（学級）名 |
| `classroom-detail-assignment-name` | input[type=text] | 課題名（1 行・blur / Enter で保存） |
| `classroom-detail-assignment-name-save-hint` | div | 課題名の欄の下の「Enter か欄の外をクリックで保存」（欄にカーソルがある間だけ） |
| `classroom-detail-assignment-name-saved` | span | 課題名の欄の横の「✓ 保存しました」（`role="status"`・保存後 2 秒ほど） |
| `classroom-detail-assignment-name-save-error` | span | 課題名の欄の横の赤い「保存できませんでした」（`role="alert"`・保存に失敗したとき） |
| `classroom-detail-expires-at` | div | 保存期限（ふだんは灰色。残り 7 日以内は `classroom-retention-banner` を含む） |
| `classroom-detail-more-menu` | button | タブの行の右端の「…」（一覧は `classroom-detail-more-menu-list`） |
| `classroom-download-progress` | span | 「…」の左の全作品ダウンロードの進み具合（`n/m`・ダウンロード中のみ） |
| `classroom-tab-members` | button | 「メンバー」タブ（凡例 + 人数 + 更新 + 座席グリッド） |
| `classroom-view-assignment` | a | 「課題を確認」（配信済みのとき・新しいタブ。生徒のステータス画面にもある） |
| `classroom-detail-join-code` | div | 参加コード |
| `classroom-detail-expand-code` | button | コード拡大表示 |
| `classroom-members-grid` | div | 座席グリッド |
| `classroom-seat-color-legend` | div | 座席の色の凡例（灰色＝参加済み・青＝まだ参加していない。状態アイコンの凡例より前） |
| `classroom-status-legend` | div | 状態アイコンの凡例（各項目 `classroom-status-legend-{status}`） |
| `classroom-status-icons` | span | 1 セル内の着席系 + 提出系アイコンのまとまり |
| `classroom-status-icon-{status}` | span[role=img] | 状態アイコン（`data-status` と `aria-label` を持つ。status は `seated` / `notSeated` / `notJoined` / `submitted` / `notSubmitted` / `returned` / `kickRequested` / `occupied`） |
| `classroom-members-count` | span | メンバー数 |
| `classroom-delete-classroom` | button (menuitem) | 「…」の「課題をアーカイブ」（歴史的経緯で testid は delete のまま。soft-delete・復元可能） |
| `classroom-delete-confirm` | button | アーカイブ確認 |
| `classroom-delete-cancel` | button | アーカイブキャンセル |
| `classroom-download-all` | button (menuitem) | 「…」の「全作品ダウンロード」 |

### レッスンの進み具合 (先生・レッスンの課題だけ)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-tab-progress` | button | 「進み具合」タブ（レッスンを紐付けた課題だけ） |
| `classroom-member-{memberId}` | button | 座席（レッスンの課題では `data-lesson-state` = `notJoined` / `notStarted` / `inProgress` / `cleared`） |
| `classroom-lesson-seat-legend` | div | 座席の色の凡例（まだ・とちゅう・課題クリア・未参加・「!」）。レッスンの課題では `classroom-seat-color-legend` の代わりに出る |
| `classroom-lesson-cleared-summary` | span | 「クリア N / 参加 N」 |
| `classroom-lesson-seat-count-{seat}` | span[role=img] | タイルの「できた数 / 条件の数」（できた数は条件の数で止める） |
| `classroom-lesson-seat-required-{seat}` | span | タイルの「★ あと n」（必須が残っているときだけ） |
| `classroom-lesson-seat-stuck-{seat}` | span[role=img] | タイルの「!」（同じチャレンジに 10 分以上・最後の送信から 35 分未満のときだけ） |
| `classroom-lesson-progress` | div | 「進み具合」タブの中身 |
| `classroom-lesson-progress-legend` | div | 記号の凡例（✓・前・▶・!・・・★） |
| `classroom-lesson-progress-sort` | select | 並べ方（`seat` / `progress` / `stuck`） |
| `classroom-lesson-progress-frame` | div | 表の枠（この枠の中だけスクロールする。見出しと席の列は固定） |
| `classroom-lesson-progress-head-{challengeId}` | th | チャレンジの見出し（縦書き・`title` に全文） |
| `classroom-lesson-progress-totals` | tr | 見出しの中の「できた人」の行 |
| `classroom-lesson-progress-total-{challengeId}` | th | 列のできた人の数（上の線がチャレンジの色・`title` に詳しく） |
| `classroom-lesson-progress-current-{challengeId}` | sup | 列のいまやっている人の数（右肩の青い数。いるときだけ） |
| `classroom-lesson-progress-loading` | p | はじめの取得が終わるまでの「進み具合を読み込み中…」（メンバータブ・「進み具合」タブ） |
| `classroom-lesson-progress-error` | p | はじめの取得から失敗したときの「進み具合を読み込めませんでした。…」 |
| `classroom-detail-compact-code` | div | 「進み具合」タブでの小さな 1 行の参加コード（課題名の欄と保存期限の行の代わり） |
| `classroom-lesson-progress-row-{memberId}` | tr | 席の行 |
| `classroom-lesson-progress-seat-{memberId}` | button | 席番号（押すと右にメンバーの詳細） |
| `classroom-lesson-progress-cell-{memberId}-{challengeId}` | span | セル（`data-kind` = `done` / `before` / `current` / `stuck` / `todo`） |
| `classroom-lesson-progress-unknown-course` | p | このスモウルビーに無いコースのとき表の代わりに出す文 |
| `classroom-lesson-progress-csv` | button (menuitem) | 「…」の「進み具合を CSV でダウンロード」（「進み具合」タブのときだけ） |

### メンバー詳細パネル (先生)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-member-detail` | div | 詳細パネル |
| `classroom-member-detail-name` | span | ニックネーム |
| `classroom-member-detail-seat` | span | 出席番号 |
| `classroom-member-detail-seated` | span | 着席状態（着席中 / 未着席アイコン付き） |
| `classroom-member-detail-not-submitted` | span | 未提出表示（提出が無いときのみ） |
| `classroom-member-detail-submitted` | span | 提出状態 |
| `classroom-member-detail-thumbnail` | img | サムネイル |
| `classroom-member-detail-image-index` | span | 画像インデックス |
| `classroom-member-detail-prev` | button | 前の画像 |
| `classroom-member-detail-next` | button | 次の画像 |
| `classroom-member-detail-open` | button | Smalruby で開く |
| `classroom-member-detail-return` | button | 返却 |
| `classroom-member-detail-comment` | textarea | コメント入力 |
| `classroom-member-detail-hide-from-peers` | input (checkbox) | 他の生徒に見せない（提出があるときだけ・切り替えで即保存・Issue #1208） |
| `classroom-member-remove` | button | メンバー削除 |
| `classroom-member-lesson-detail` | div | レッスンの課題の席の詳細（チャレンジの一覧。#1603） |
| `classroom-member-lesson-detail-count` | span | 「できた数 / 条件の数」（課題クリアなら「課題クリア」） |
| `classroom-member-lesson-detail-list` | ul | チャレンジの一覧の枠（この枠の中だけスクロール） |
| `classroom-member-lesson-detail-{challengeId}` | li | チャレンジ 1 行（`data-kind` = `done` / `before` / `current` / `stuck` / `todo`） |

### コード表示

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-code-display-copy-link` | button | 招待リンクをコピー |
| `classroom-code-display-expand` | button | 全画面表示 |
| `classroom-code-display-shrink` | button | 全画面解除 |
| `classroom-code-display-close` | button | コード表示を閉じる |

### 生徒: 共通の部品（進む順の帯・主ボタン・小さなリンク）

[ui-ux.md の「生徒の画面の決まり」](ui-ux.md#生徒の画面の決まり参加から提出まで)の部品。帯は生徒の画面（`classroom-modal`）のいちばん上に出る。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-step-band` | ol | 進む順の帯。`data-complete` = `true`（提出済み・返却済みなどで全部すんだ。⑤ に ✓）/ `false` |
| `classroom-step-band-{step}` | span | 帯の札（`step` = `join` / `seat` / `start` / `make` / `submit`）。`data-state` = `done`（すんだ・薄い緑）/ `now`（いま・青・`aria-current="step"`）/ `todo`（まだ・灰色）。押せない |
| `classroom-step-band-{step}-state` | span | 札の状態の文字（「（済み）」「（いま）」「（まだ）」）。画面には見えず、読み上げだけに出す |

主ボタン（`StudentMainButton`）と小さな文字のリンク（`StudentTextLink`）は、使う画面が `dataTestId` で data-testid を決める。主ボタンの説明の小さい字は `<主ボタンの data-testid>-note`。

### 生徒: 参加

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-join-code-input` | input | 参加コード入力 |
| `classroom-join-submit` | button | 参加コード送信 |

### 生徒: 席番号選択

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-seat-grid` | div | 席番号グリッド |
| `classroom-seat-heading` | div | 見出しの行（「出席番号を選んでください」と、あれば `classroom-seat-previous`） |
| `classroom-seat-previous` | div | 見出しと同じ行の「前回は NN 番でした」（この PC で同じクラスに前に入った番号があるときだけ。localStorage `smalruby:classroom:lastSeats`） |
| `classroom-seat-{n}` | button | 席番号 n のボタン。使用中は `classroom-status-icon-occupied` と「使用中」の字を含み、`data-occupied="1"`（押せる。押すと退室依頼ダイアログ）。前回の番号は `data-previous="1"`（光る枠だけで、選ばれない。`aria-describedby` で `classroom-seat-previous` を指す）。30 秒たったときに 1 回光る使用中の席は `data-flash="1"` |
| `classroom-selected-seat` | div (hidden) | 選択中の席番号 |
| `classroom-seat-number-toggle` | button | 「番号が見つからないとき」（グリッドの下）。押すと番号入力フォームが開く（開いたあとは消える） |
| `classroom-seat-number-form` | form | 出席番号の数値入力フォーム（`classroom-seat-number-toggle` を押したときだけ、グリッドの下） |
| `classroom-seat-number-input` | input | 出席番号の入力欄（1〜定員。全角数字も可）。入力した番号のセルは `data-typed` で強調 |
| `classroom-seat-number-submit` | button | 「この番号にする」。空席なら選択→確認、使用中なら退室依頼ダイアログ |
| `classroom-seat-number-error` | div | 範囲外・数字以外の入力エラー |
| `classroom-seat-idle-guide` | div | 右の列の案内の枠（使用中ボタンの小さな絵つき）。`data-variant="idle"` = グリッドが出てから 30 秒選ばれないとき（使用中の席があるときだけ）、`data-variant="previousTaken"` = 前回の番号が使用中のとき（すぐ出る）。確認・退室依頼ダイアログ・依頼の承認待ちの間は出ない |
| `classroom-seat-confirm` | div | 席を選んだあとの確認ステップ（座席グリッドの代わりに表示。確認文・［選び直す］・［参加する］を含む） |
| `classroom-seat-confirm-message` | div | 参加確定前の大きな確認「出席番号 NN で参加します」 |
| `classroom-seat-reselect` | button | 「選び直す」。座席グリッドに戻る |
| `classroom-confirm-seat` | button | 席番号確定・参加（席を選んだあとの確認ステップにだけ表示） |

### 生徒: 参加完了

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-joined-details` | div | 参加詳細（クラス（学級）名 + 出席番号） |
| `classroom-joined-class-name` | span | クラス（学級）名 |
| `classroom-joined-seat-number` | span | 出席番号（0埋め2桁） |
| `classroom-joined-assignment` | div | 課題名（課題名がある場合のみ） |
| `classroom-joined-lesson-notice` | div | レッスンの課題の 1 行のお知らせ（レッスンの課題であることと提出のタイミング。レッスンの課題のときだけ） |

### 生徒: ステータス（おかえりなさい）

参加中にクラスの画面を開いたとき（同じクラスに入り直したときもふくむ）の画面。主ボタンは 1 つ（`classroom-status-continue`、レッスンの課題のとちゅうは `classroom-continue-lesson-button`）。提出のボタンは無い（メニューバーの `classroom-menu-submit` から）。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-status-title` | div | 見出し「おかえりなさい」 |
| `classroom-status-info` | div | 1 行の情報（クラス ・ 出席番号 ・ 課題 ・ 提出状況 ・ ↻）。長いクラス名・課題名は「…」で切る |
| `classroom-status-class-name` | span | クラス（学級）名（`title` に全体） |
| `classroom-status-seat-number` | span | 「出席番号03」（0埋め2桁） |
| `classroom-status-assignment` | span | 課題名（`title` に全体） |
| `classroom-submit-status` | span | 提出状況（未提出 / ✓ 提出済み (時刻) / ↩ 返却済み (時刻)）。作品を提出しないレッスンの課題では出さない |
| `classroom-student-refresh` | button | 更新 (↻) |
| `classroom-status-teacher-comment` | div | 先生からのコメント（返却済みのときだけ） |
| `classroom-status-continue` | button | 主ボタン「つづける」（何も読み込まずに閉じる。説明の行は `classroom-status-continue-note`）。レッスンの課題では、作品も提出する課題で条件を満たしたあとだけ |
| `classroom-continue-lesson-button` | button | 「レッスンを続ける」（レッスンの課題だけ。レッスン表を課題のチャレンジだけで開く）。条件を満たすまでは主ボタン、作品も提出する課題で条件を満たしたあとは小さなリンク |
| `classroom-view-assignment-button` | button | 小さなリンク「課題を見る」（hasAssignment 時のみ） |
| `classroom-peer-view-button` | button | 小さなリンク「みんなの作品を見る」（他者参照が有効なとき。押すとモーダルを閉じてパネルを開く） |
| `classroom-peer-view-locked` | span | 「提出すると見られます」（`自分が提出したら` で未提出のとき。リンクの代わりの押せない文字） |
| `classroom-status-wrong-seat` | button | 小さなリンク「出席番号がちがう」（いまの席を空けて同じ課題の番号選びへ。空けた番号は前回の番号として残さない） |
| `classroom-status-reload-toggle` | button | 小さなリンク「作品を読み込み直す ▾」（読み込めるものが 1 つ以上あるときだけ。`aria-expanded`） |
| `classroom-status-reload-options` | div | 開いたときに並ぶリンクのまとまり（同じ行に並ぶ） |
| `classroom-status-reload-{kind}` | button | 読み込めるもの（`kind` = `current` この課題で出した作品 / `previous` 前回の作品 / `starter` スターター。この順）。押すとその作品を開いてモーダルを閉じる（編集中は confirm） |
| `classroom-leave` | button | 小さなリンク「クラスから出る」（右下。押すと確認） |
| `classroom-leave-dialog` | div (`role="alertdialog"`) | 確認「クラスから出ますか？ 出ても、提出した作品は残ります。」（主ボタンとリンクの代わりに出る。名前は質問の文（`aria-labelledby`）。開くとフォーカスは `classroom-leave-confirm`、Esc は確認だけを閉じる） |
| `classroom-leave-confirm` | button | 確認の主ボタン「出る」（→ student-join） |
| `classroom-leave-cancel` | button | 確認の小さなリンク「やめる」 |
| `classroom-status-lesson-progress` | div | レッスンの課題の「進み具合」の行（丸は `lesson-assignment-dot`、`lesson-assignment-done-count`・`lesson-assignment-remaining`・`lesson-assignment-required-remaining`・`lesson-assignment-cleared`） |
| `classroom-status-lesson-submit-guide` | div | 作品も提出する課題で課題クリアのあと（または、この版に無いチャレンジがあるとき）の案内。はじめて提出するまで |
| `classroom-status-lesson-unknown` | span | 「新しいレッスンがあります。ページを読み込み直してね」（この版のコースに無いチャレンジがあるとき） |
| `lesson-progress-confirm` | div | 本人の確認の本文（レッスンの課題ではじめて送るとき、端末に課題のチャレンジの記録があれば出る。gui の直下・クラスの画面の上に重なる） |
| `lesson-progress-confirm-list` | ul | 端末にある課題のチャレンジの記録の一覧（名前・できた日） |
| `lesson-progress-confirm-mine` | button | 「わたしの記録です」（「前」として送る） |
| `lesson-progress-confirm-not-mine` | button | 「ちがう（記録を消す）」（2 つめの確認へ） |
| `lesson-progress-confirm-back` | button | 2 つめの確認の［戻る］（1 つめに戻る） |
| `lesson-progress-confirm-clear` | button | 2 つめの確認の［消す］（送らずに端末のレッスンの記録を空にする） |
| `classroom-error-action` | button | セッション切れ時のアクションリンク |

1300×600 の収まりは `tools/playwright-verify/verify-classroom-viewport.mjs` が、返却のコメントと長い名前の状態・「作品を読み込み直す」を開いた状態・「クラスから出る」の確認・提出済み・レッスンの課題（「作品を読み込み直す」を開いた状態）で測る（`LOCALE=ja-Hira` でひらがなでも測れる）。

### 生徒: 提出確認

メニューバーの「提出する」/「提出済み ✓」/「返却済み ✓」（`classroom-menu-submit`）から開く。提出済み・返却済みからは再提出の文言になる。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-submit-checking` | div | 「提出の状態を確かめています...」（開いた直後に verify-session を待つ間だけ。このあいだ見出し・サムネイル・主ボタンは出さず、「やめる」だけ押せる） |
| `classroom-submit-preview` | img | サムネイルプレビュー |
| `classroom-submit-teacher-comment` | div | 先生のコメント（返却済みからの再提出のときだけ） |
| `classroom-submit-cancel` | button | 「やめる」（小さなリンク。モーダルを閉じる） |
| `classroom-submit-confirm` | button | 主ボタン「提出する」（再提出では「もう一度提出する」。送信中だけ「提出中...」で押せない。送信中はクラスの画面も閉じられない） |

### 生徒: 提出できました

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-submit-done-title` | div | 大きな「提出できました ✓」 |
| `classroom-submit-done-continue` | button | 主ボタン「つづける」（モーダルを閉じる） |

### 課題配信

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-post-assignment` | button | 課題配信ボタン (詳細画面) |
| `classroom-post-assignment-blocked` | div | 共有できない理由 (連携した先生以外) |
| `classroom-post-assignment-verify` | button | 「自分もこの Google Classroom のクラスの先生です（確認する）」 |
| `classroom-post-assignment-title` | input | タイトル |
| `classroom-post-assignment-description` | textarea | 説明 |
| `classroom-post-assignment-submit` | button | 配信実行 |
| `classroom-post-assignment-success` | div | 配信成功メッセージ |

### 課題エディタ（課題コンテンツ）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-assignment-page-{n}` | div | ページ n（0-indexed）のカード |
| `classroom-assignment-page-text-{n}` | textarea | ページ n の本文（最大500文字） |
| `classroom-assignment-page-up-{n}` / `classroom-assignment-page-down-{n}` | button | ページの並べ替え |
| `classroom-assignment-page-remove-{n}` | button | ページ削除 |
| `classroom-assignment-page-image-attach-{n}` | button | 画像を追加（png/jpeg） |
| `classroom-assignment-page-image-{n}` | img | 画像プレビュー |
| `classroom-assignment-page-image-remove-{n}` | button | 画像を削除 |
| `classroom-assignment-add-page` | button | ページを追加（最大10） |
| `classroom-assignment-starter-status` | div | スターターの状態表示 |
| `classroom-assignment-starter-current` | button | 今開いているプロジェクトをスターターに設定 |
| `classroom-assignment-starter-file` | button | .sb3 ファイルをスターターに設定 |
| `classroom-assignment-starter-remove` | button | スターターを削除 |
| `classroom-assignment-pages` | div | ページの編集欄の枠（この枠の中だけスクロールする） |
| `classroom-assignment-advanced-toggle` | button | 「詳しい設定」の開閉（`aria-expanded`） |
| `classroom-assignment-advanced-summary` | span | 閉じた「詳しい設定」のいまの値（「前回から: しない・他者参照: しない・メッシュ: 6人まで」） |
| `classroom-assignment-advanced-summary-{previous\|peerView\|mesh}` | span | 要約の各値。保存した値から変えたものは `data-changed="true"`（オレンジ色） |
| `classroom-assignment-advanced-unsaved` | span | 「保存していません」（保存した値から変えた設定があるときだけ） |
| `classroom-assignment-advanced-panel` | div | 開いた「詳しい設定」（下の 3 つの設定はこの中・開いたときだけある） |
| `classroom-assignment-advanced-close` | button | 開いた「詳しい設定」の右上の ✕（`aria-label`「閉じる」。閉じたら開閉ボタンにフォーカスを戻す） |
| `classroom-assignment-start-from-previous` | input (checkbox) | 「前回の提出物から始めさせる」（既定 OFF・保存で反映・Issue #1202） |
| `classroom-assignment-peer-view` | select | 「他者参照」（`none` = しない（既定） / `always` = いつでも見られる / `afterSubmit` = 自分が提出したら見られる・保存で反映・Issue #1208） |
| `classroom-assignment-mesh-group-limit` | select | 「メッシュのグループの人数」（`6` = 6人まで / `0` = 制限なし（この設定より前の課題の表示）・保存で反映・Issue #1257） |
| `classroom-assignment-advanced-summary-scoring` | span | 要約の「レッスンの点: 100 点（★ 70）」（レッスンを紐付けた課題だけ・変えたら `data-changed="true"`） |
| `classroom-lesson-scoring` | div | 「詳しい設定」の中のレッスンの点（レッスンを紐付けた課題だけ）。採点の画面にも同じ欄を出す |
| `classroom-lesson-scoring-total` | input (number) | 満点（1〜1000・既定 100。欄を出る・Enter のときに確定。空なら前の値） |
| `classroom-lesson-scoring-required` | input (number) | 必須（★）を全部こなしたときの点（0〜満点・既定は満点の 70%。欄を出る・Enter のときに確定。空なら既定。必須が 0 個か、必須だけで課題クリアになる（必須の数 = 条件の数）ときは disabled） |
| `classroom-lesson-scoring-required-unused` | span | 必須の点の欄を使わない理由（必須が 0 個 / 必須だけで課題クリア） |
| `classroom-lesson-scoring-each` | span | 1 つの点（「必須 1 つ 35 点・必須でない 1 つ 7.5 点」） |
| `classroom-lesson-settings` | div | 「レッスン」欄（左の列・ページの枠の上） |
| `classroom-lesson-toggle` | button | レッスン欄の開閉（`aria-expanded`） |
| `classroom-lesson-summary` | span | 閉じたレッスン欄のいまの値（「コース: きょうからプログラマー・6 つ（★ 2）・条件: 全部・提出: しない」か「レッスンを使わない」） |
| `classroom-lesson-summary-{course\|challenges\|completion\|submit}` | span | 要約の各値。保存した値から変えたものは `data-changed="true"`（オレンジ色） |
| `classroom-lesson-unsaved` | span | 「保存していません」（レッスンの設定を変えたときだけ） |
| `classroom-lesson-unknown-course` | p | このスモウルビーに無いコースの警告（みんなの課題のコピーなど） |
| `classroom-lesson-missing-challenges` | p | 保存したチャレンジのうち、このスモウルビーのコースに無いものの警告（数えない・保存すると外れる） |
| `classroom-lesson-panel` | div | 開いたレッスン欄（ページの列の上に重ねる・開いたときだけある。高さは中身に合わせる） |
| `classroom-lesson-close` | button | 開いたレッスン欄の右上の ✕（`aria-label`「閉じる」。閉じたら開閉ボタンにフォーカスを戻す） |
| `classroom-lesson-description-question` | div | 「ページの説明をレッスンの説明で上書きしますか？」（レッスン欄を閉じたとき、変えたレッスンの説明文と 1 ページめが違うときだけ） |
| `classroom-lesson-description-yes` / `-no` | button | 上の［はい］（1 ページめの文を説明文にする）/［いいえ］（そのまま） |
| `classroom-lesson-course` | select | コース（`""` = レッスンを使わない / コース id） |
| `classroom-lesson-challenges` | div | レッスンとチャレンジの一覧の枠（この枠の中だけスクロールする） |
| `classroom-lesson-lesson-{lessonId}` | input (checkbox) | レッスン（チェックで中のチャレンジが全部入る。一部だけなら indeterminate） |
| `classroom-lesson-challenge-{challengeId}` | input (checkbox) | チャレンジ |
| `classroom-lesson-required-{challengeId}` | button | ★「必須にする」（`aria-pressed`。名前は「1-2 …を必須にする」。選んだチャレンジだけ押せる） |
| `classroom-lesson-completion-all` / `-count` | input (radio) | 完了の条件「全部」/「n つ（必須をふくむ）」 |
| `classroom-lesson-completion-count-value` | input (number) | 「n つ」の n（必須の数（最低 1）〜選んだ数。名前は「完了の条件の数」。打っている途中は直さず、欄を出る・Enter のときに範囲へ収める） |
| `classroom-lesson-sentence` | span | 生徒に出る文（「6 つのうち 4 つ（★ 2 つをふくむ）」） |
| `classroom-lesson-submit-no` / `-yes` | input (radio) | 「提出しない（レッスンだけ）」（既定）/「最後に作品も提出する」 |
| `classroom-lesson-dropped-notice` | p | 保存したチャレンジを外したときの注意（送られた進み具合は残るが数えない） |
| `classroom-assignment-save` | button | 課題を保存（フォームの最上段） |

### 生徒: 始め方（主ボタン・ほかの始め方）

参加完了（`student-joined`）と、参加した直後の課題パネルの最後のページに出す（[ui-ux.md の「始め方を決める順番」](ui-ux.md#始め方を決める順番)）。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-start-method` | div | 始め方のまとまり。`data-main` = 決めた始め方（`current` この課題で出した作品 / `previous` 前回の作品 / `starter` スターター / `keep` いまの作品のまま / `lesson` レッスン表を開く） |
| `classroom-start-main` | button | 主ボタン（決めた始め方 1 つ）。押すとその作品で始める（読み込んでモーダルを閉じる。`keep` は何も読み込まずに閉じる・`lesson` はレッスン表を開く） |
| `classroom-start-main-note` | small | 主ボタンの 2 行目（何を開くか。提出日時・前回の課題名など） |
| `classroom-start-notice` | div | 先生の「前回の提出物から始めさせる」の 1 行のお知らせ（設定が ON のときだけ。この課題で提出済みのときは、前回の提出物があれば「前回の作品からも始められます」） |
| `classroom-start-others-toggle` | button | 小さなリンク「ほかの始め方」（`aria-expanded`）。ほかに始め方が無いときは描画しない |
| `classroom-start-others` | div | 開いたときに同じ行に並ぶ残りの始め方 |
| `classroom-start-other-{kind}` | button | 残りの始め方の小さなリンク（`kind` = `current` / `previous` / `starter` / `keep`） |

### 課題パネル（生徒）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-phase-student-assignment` | div | 課題パネルフェーズのルート（join 直後に自動表示） |
| `classroom-assignment-joined-notice` | div | 「参加しました！」通知（join 直後のみ） |
| `classroom-assignment-view-page` | div | 現在の課題ページ |
| `classroom-assignment-view-text` | div | ページ本文 |
| `classroom-assignment-view-image` | img | ページ画像 |
| `classroom-assignment-prev-page` / `classroom-assignment-next-page` | button | ページ送り |
| `classroom-assignment-page-indicator` | span | ページ位置（`1 / 3`） |
| `classroom-assignment-main-next` | button | 主ボタン「つぎのページ」（最後のページより前） |
| `classroom-assignment-close` | button | 主ボタン「とじる」（「課題を見る」から開き直したときの最後のページ。始め方は出さない） |
| `classroom-assignment-lesson-notice` | div | レッスンの課題の説明（参加直後の最後のページのみ） |

### 組（グループ）管理

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-class-create` | button | クラス一覧の主ボタン「＋ クラスを作成」（作成ダイアログを開く） |
| `classroom-class-list-loading` | span | 「クラスを作成」の横の「読み込み中…」（処理中のみ） |
| `classroom-class-create-dialog` | form (`role="dialog"`) | 「クラスを作成」の小さな画面（クラス一覧の上に開く。Esc で閉じる） |
| `classroom-class-create-name` | input | 作成: クラス名（必須） |
| `classroom-class-create-year` | input | 作成: 年度 |
| `classroom-class-create-count` | input | 作成: 人数（出席番号の数・必須） |
| `classroom-class-create-cancel` | button | 作成: キャンセル |
| `classroom-class-create-submit` | button | 作成: 作成（文言は固定） |
| `classroom-class-summary-{groupId}` | span | クラスカードの要約（課題数・生徒数・生成AI） |
| `classroom-class-list` | ul | クラス一覧（カード） |
| `classroom-class-list-empty` | p | クラス一覧の空メッセージ |
| `classroom-class-card-{groupId}` | li | クラスカード |
| `classroom-class-open-{groupId}` | button | クラスカード本体（クリックでクラスをひらく） |
| `classroom-class-evaluate-{groupId}` | button | クラスカードの「採点」 |
| `classroom-class-import-gc` | button | クラス一覧の「Google Classroom からインポート」（Google ログイン時のみ） |
| `classroom-avatar-button` / `classroom-avatar-initials` / `classroom-avatar-email` | button/span | アカウントメニュー（右上・メール頭文字 + ▼。クリックでメール表示 + ログアウト） |
| `classroom-teacher-logout` | button | ログアウト（アカウントメニュー内。#1111 レビューでタイトルバー常時表示から移動） |
| `classroom-class-create-section` | input | 作成: セクション（オプション） |
| `classroom-class-settings-open-{groupId}` | button | クラスカードの「設定」（インライン編集を開く） |
| `classroom-class-settings-{groupId}` | form | クラス設定のインライン編集フォーム |
| `classroom-class-settings-name/year/section/count` | input | クラス設定の各フィールド（それぞれ見えるラベル付き） |
| `classroom-class-settings-co-teacher-input` | input | 共同管理者メール入力（クラス単位） |
| `classroom-class-settings-add-co-teacher` | button | 共同管理者を追加 |
| `classroom-class-settings-remove-co-teacher-{email}` | button | 共同管理者を削除 |
| `classroom-class-settings-archive` | button | アーカイブ/もどす（アーカイブは 2 段階確認: 1 回目で確認表示、2 回目で実行） |
| `classroom-class-settings-archive-confirm-message` | p | アーカイブ確認メッセージ |
| `classroom-class-settings-archive-cancel` | button | アーカイブ確認のキャンセル |
| `classroom-class-settings-save` / `classroom-class-settings-cancel` | button | 保存 / キャンセル |
| `classroom-class-settings-save-hint` | button | ［保存］が押せない理由（足りない必須チェック: 生成AI / ルビティー）。押すとそのチェックへスクロールしてフォーカス。足りないチェックが無いときは出ない |
| `classroom-class-ai-settings` | div | クラス設定の「このクラスで使う AI」欄（生成AI とルビティーの 2 行を常に表示） |
| `classroom-class-ai-genai` | div | 「学校の生成AI に相談」の行 |
| `classroom-class-ai-genai-unsaved` | span | 生成AI の行の「未保存」の印（保存済みの値から変わったときだけ） |
| `classroom-class-ai-service-none/gemini/chatgpt/other` | button | 「使わない / Gemini / ChatGPT / その他」（選んでいるものは `aria-pressed="true"`。Claude は出さない） |
| `classroom-class-ai-confirm-panel` | div | 生成AI を選んだときだけ行の下に開く確認（条件・確認チェック・URL） |
| `classroom-class-ai-confirm` | checkbox | 「このクラスは条件を満たしています（必須）」。未チェックだと保存できない。サービスを変えると外れる |
| `classroom-class-ai-url-change` | button | 「生徒が開くページを変える（いまは …）」。必須のチェックと同じ行の右。押すと URL の入力欄を出す（「その他」では出ず、最初から入力欄） |
| `classroom-class-ai-url` | input | 生徒が開くページの URL（Gemini / ChatGPT は既定値入り） |
| `classroom-class-ai-url-error` | span | URL の誤り（空・https 以外・18 歳以上限定サービス）。「試す」と同じ場所に出る |
| `classroom-class-ai-try` | a | 「試す（別タブ）」（URL が正しいときだけ表示） |
| `classroom-class-ai-rubytee-row` | div | ルビティーの行 |
| `classroom-class-ai-rubytee` | checkbox (`role="switch"`) | ルビティーのオン/オフ（既定オフ） |
| `classroom-class-ai-rubytee-unsaved` | span | ルビティーの行の「未保存」の印 |
| `classroom-class-ai-rubytee-confirm-panel` | div | ルビティーをオンにしたときだけ行の下に開く確認（条件・リンク・確認チェック） |
| `classroom-class-ai-rubytee-conditions-summary` | span | ルビティーの条件の 1 行の要約 |
| `classroom-class-ai-rubytee-conditions-toggle` | button | ［詳しく］/［閉じる］（`aria-expanded`）。条件の箇条書きを開く・畳む |
| `classroom-class-ai-rubytee-conditions` | ul | ルビティーの条件の箇条書き（［詳しく］で開いたときだけ） |
| `classroom-class-ai-rubytee-confirm` | checkbox | 「このクラスは上の条件を満たしています（必須）」。オンなのに未チェックだと保存できない。オフにすると外れる |
| `classroom-class-ai-rubytee-terms` / `classroom-class-ai-rubytee-privacy` | a | 利用規約 / プライバシーポリシー（別タブ） |
| `classroom-class-ai-rubytee-unconfirmed` | p | 確認の仕組みより前に有効にしたクラス（`rubytee.confirmed` が無い）の「まだ確認されていません」 |
| `classroom-class-ai-preview` | aside | 「生徒の画面はこうなります」の見本（幅 1100px 未満では `display: none`） |
| `classroom-class-ai-preview-consult` | span | 見本のコード画面の「AI に相談」の顔（生成AI を使うときだけ） |
| `classroom-class-ai-preview-consult-ruby` | span | 見本の Ruby 画面の「AI に相談」の顔（生成AI を使うときだけ） |
| `classroom-class-ai-preview-consult-off` | p | 生成AI を使わないときの説明 |
| `classroom-class-ai-preview-rubytee` | span | 見本の顔のパネルの［ルビティーにまかせる］（生成AI を使うときだけ。`data-on="true/false"`。オフは薄く表示） |
| `classroom-class-ai-preview-rubytee-off` | p | 生成AI を使い、ルビティーがオフのときの説明 |
| `classroom-class-ai-preview-rubytee-no-genai` | p | 生成AI を使わず、ルビティーがオンのときの説明（ルビティーは顔のパネルから使う） |
| `classroom-show-archived` | button | 「アーカイブ済みのクラス（{count}）」トグル（アーカイブ済みが 1 件以上のとき表示） |
| `classroom-archived-class-list` | ul | アーカイブ済みクラスのカード一覧 |
| `classroom-class-restore-{groupId}` | button | アーカイブ済みクラスカードの「元に戻す」 |
| `classroom-board` | div | 課題管理ボード（クラス内のメイン領域） |
| `classroom-board-tab-stream` / `classroom-board-tab-classwork` | button (tab) | クラスの画面の［ストリーム］［授業］タブ（`aria-selected`。最初は［ストリーム］） |
| `classroom-board-stream` | div | ［ストリーム］の枠（件数が多いときはこの中だけスクロール） |
| `classroom-board-stream-item-{type}-{classroomId}` | button | ストリームの 1 行。`{type}` は `created`（作成）/ `archived`（アーカイブ）/ `expiring`（残り 7 日以内の自動削除の予定）。押すと［授業］でその課題へ |
| `classroom-board-stream-date-{type}-{classroomId}` | span | ストリームの行の右端の日付とラベル（「作成日」／「アーカイブした日」）。`expiring` の行には無い（日付は文中） |
| `classroom-board-stream-empty` | p | ストリームが空のときの案内 |
| `classroom-board-create-menu` | button | ［＋ 作成 ▾］（主ボタン）。開いた一覧は `classroom-board-create-menu-list`（`role="menu"`） |
| `classroom-board-create` | button (menuitem) | 作成メニューの「課題」（課題の作成画面へ） |
| `classroom-board-create-lesson` | button (menuitem) | 作成メニューの「レッスン」（「課題」のすぐ下。同じ作成画面へ。作ると説明タブでレッスン欄が開き、最初のコースの最初のレッスンが選ばれる） |
| `classroom-board-create-topic` | button (menuitem) | 作成メニューの「トピック」（トピックを追加の小さな画面へ） |
| `classroom-board-more-menu` | button | 右上の「…」（中に `classroom-board-download-class`） |
| `classroom-board-empty` | p | ボードの空メッセージ |
| `classroom-board-section-{topic}` | div | トピックセクション（未設定は `-none`） |
| `classroom-board-section-title-{topic}` | h3 | セクションの見出し（未設定は `-none` =「トピックなし」） |
| `classroom-topic-menu-{topic}` | button | トピック見出しの ⋮ |
| `classroom-topic-rename-{topic}` | button (menuitem) | 「名前を変更」（見出しがその場の入力欄になる） |
| `classroom-topic-rename-input-{topic}` | input | リネーム入力（Enter/blur で確定） |
| `classroom-topic-remove-{topic}` | button (menuitem) | 「削除」（課題側はトピックなしへ） |
| `classroom-topic-add-dialog` | form (dialog) | 「トピックを追加」の小さな画面 |
| `classroom-topic-add-input` | input | トピック名 |
| `classroom-topic-add-cancel` / `classroom-topic-add` | button | ［キャンセル］［追加］ |
| `classroom-board-row-{classroomId}` | li | 課題行 |
| `classroom-board-row-toggle-{classroomId}` | button | 課題行本体（押すとその場で開く・`aria-expanded`。開く行は 1 つだけ） |
| `classroom-board-row-date-{classroomId}` | span | 閉じた行の「授業日」（ラベル付き） |
| `classroom-board-expiry-mark-{classroomId}` | span | 閉じた行の小さな赤い印（⚠ +「保存期限: 日付」。保存期限 7 日以内のときだけ） |
| `classroom-board-row-menu-{classroomId}` | button | 課題行の ⋮（中にトピック・授業日・共有） |
| `classroom-board-topic-{classroomId}` | select | ⋮ の「トピック」 |
| `classroom-board-date-{classroomId}` | input | ⋮ の「授業日」（並び順キー） |
| `classroom-board-row-detail-{classroomId}` | div | 開いた行の中身 |
| `classroom-board-row-code-{classroomId}` | span | 開いた中の「参加コード」 |
| `classroom-board-retention-{classroomId}` | span | 開いた中の灰色の保存期限（7 日より先） |
| `classroom-board-row-description-{classroomId}` | p | 開いた中の説明の 1 行目（読み込み後・説明があるときだけ） |
| `classroom-board-row-counts-{classroomId}` | span | 開いた中の「提出済み・参加済み（N 人中）」（開いたときに読み込む） |
| `classroom-board-row-lesson-cleared-{classroomId}` | span | 開いた中の「課題クリア N」（レッスンの課題だけ・#1603） |
| `classroom-board-lesson-mark-{classroomId}` | span | 閉じた行の「レッスン」の印（レッスンの課題だけ・#1603） |
| `classroom-board-open-{classroomId}` | button | 開いた中の［課題を開く］（課題詳細へ） |
| `classroom-board-archived-section` | div | アーカイブ済み課題セクション（1 件以上のとき表示） |
| `classroom-board-archived-toggle` | button | 「アーカイブ済みの課題（{count}）」トグル |
| `classroom-board-archived-list` | ul | アーカイブ済み課題の行一覧 |
| `classroom-board-archived-row-{classroomId}` | li | アーカイブ済み課題行（保存期限を表示） |
| `classroom-board-restore-{classroomId}` | button | アーカイブ済み課題の「元に戻す」 |
| `classroom-board-expiry-{classroomId}` | div | 開いた中の自動削除の警告（保存期限 7 日以内のときだけ・赤） |
| `classroom-board-download-{classroomId}` | button | 警告の「全作品ダウンロード」（その課題だけ） |
| `classroom-board-download-class` | button (menuitem) | 「…」の「全課題の提出物をダウンロード」（active + アーカイブ済みを 1 つの zip に） |
| `classroom-retention-banner` | div | 課題詳細の保存期限の赤い警告（残り 7 日以内のときだけ・保存期限の右） |
| `classroom-retention-banner-download` | button | 警告の中の「全作品ダウンロード」 |
| `classroom-share-assignment` | button | 課題詳細の「この課題を共有」（みんなの課題フォームを開く） |
| `shared-form` | form | みんなの課題の共有フォーム |
| `shared-form-title` / `shared-form-summary` | input | タイトル / 短い説明 |
| `shared-form-level` | select | 学校種 |
| `shared-form-subject` | select | 教科（制御語彙。学校種=その他のときは `shared-form-subject-free` input） |
| `shared-form-grade-{n}` | checkbox | 対象学年 |
| `shared-form-tags` | input | タグ（カンマ区切り・最大5） |
| `shared-form-lesson-count` | input | 想定コマ数 |
| `shared-form-url` | input | 補足資料 URL（https のみ。ガイダンス=`shared-form-url-hint`、エラー=`shared-form-url-error`） |
| `shared-form-author-name` / `shared-form-author-affiliation` | input | 表示名 / 所属表記（localStorage 記憶） |
| `shared-form-consent` | checkbox | CC BY 4.0 同意（未チェックだと送信不可） |
| `shared-form-submit` / `shared-form-cancel` | button | 共有する / キャンセル |
| `shared-form-success` | p | 公開完了メッセージ（© 表示名 / CC BY 4.0） |
| `classroom-board-shared-catalog` | button (menuitem) | 作成メニューの「みんなの課題からさがす」 |
| `classroom-board-passcode-import` | button (menuitem) | 作成メニューの「合言葉で取り込み」 |
| `classroom-board-share-{classroomId}` | button (menuitem) | 課題行の ⋮ の「共有」（説明ページかスターターがある課題だけ） |
| `shared-catalog` | div | みんなの課題カタログ（ボード内に展開） |
| `shared-catalog-close` | button | カタログを閉じる |
| `shared-catalog-tab-all` / `shared-catalog-tab-mine` | button | すべて / 自分の投稿 タブ |
| `shared-catalog-filter-level/subject/grade/tag` | select/input | 絞り込み（学校種・教科・学年・タグ） |
| `shared-catalog-filter-apply` | button | 絞り込み実行 |
| `shared-catalog-list` / `shared-catalog-item-{id}` / `shared-catalog-open-{id}` | ul/li/button | カード一覧（属性バッジ・投稿者・取り込み回数） |
| `shared-catalog-load-more` | button | 次ページ読み込み（cursor があるときのみ） |
| `shared-catalog-empty` | p | 空メッセージ |
| `shared-catalog-detail` | div | 詳細プレビュー |
| `shared-detail-close` | button | 一覧に戻る |
| `shared-detail-credit` | p | 「© 表示名（所属） / CC BY 4.0」クレジット行 |
| `shared-detail-starter` | p | スターター付きの説明 |
| `shared-detail-url` | button | 補足資料リンク（クリックで確認表示） |
| `shared-detail-url-confirm` / `shared-detail-url-open` / `shared-detail-url-cancel` | span/a/button | 外部ドメイン名付き確認 →「開く」（rel=noopener・新規タブ） |
| `shared-detail-import` | button | このクラスに取り込む（published のみ表示） |
| `shared-detail-report` | button | 通報フォームを開く（他人の投稿のみ） |
| `shared-report-form` / `shared-report-reason` / `shared-report-submit` | div/textarea/button | 通報理由（必須）と送信 |
| `shared-report-sent` | p | 通報完了メッセージ |
| `shared-detail-unlist` / `shared-detail-republish` | button | 自分の投稿の取り下げ / 再公開 |
| `shared-card-limited-badge` / `shared-card-recommended-badge` | span | カードの 限定公開 / 推薦 バッジ（#1110） |
| `shared-detail-recommended-note` | p | 自分の限定公開が推薦を受けたときの注記（#1110） |
| `shared-detail-broaden` | button | 「みんなの課題に公開する」（自分の限定公開のみ・#1110） |
| `shared-broaden-done` | p | 全体公開の完了メッセージ（#1110） |
| `shared-import-success` | p | 取り込み完了メッセージ（ボード上） |
| `classroom-share-suggestion-banner` / `classroom-share-suggestion-open` | div/button | 共有推奨バナーと「共有フォームを開く」CTA（#1106） |
| `classroom-board-share-suggested-{classroomId}` | span | ボード行の「共有おすすめ」マーク（#1106） |
| `classroom-breadcrumbs` | nav | パンくず（クラス一覧 > {クラス名} > ストリーム｜授業｜課題を作成などのサブビュー｜課題詳細） |
| `classroom-breadcrumb-class-list` / `classroom-breadcrumb-assignments` | button | パンくずリンク |
| `classroom-board-create-name` / `classroom-board-create-submit` | input / button | インライン課題作成（課題名） |
| `classroom-board-reuse` | button (menuitem) | 作成メニューの「課題を再利用」 |
| `classroom-board-reuse-view` | div | 再利用ビュー（全課題を日付降順） |
| `classroom-board-reuse-filter` | select | 再利用ビューのクラスフィルタ |
| `classroom-board-reuse-copy-{classroomId}` | button | このクラスに複製 |
| `classroom-tab-description` | button | 課題詳細の「説明」タブ（新しく作った課題の初回のみアクティブ。それ以外は `classroom-tab-members` が既定） |
| `classroom-description-editor` | div | 説明タブの課題編集フォーム（埋め込み） |
| `classroom-description-preview` | div | 右ペインの生徒視点プレビュー |
| `classroom-description-preview-body` | div | プレビュー本文（テキスト+画像） |
| `classroom-description-preview-empty` | p | どのページも空のときの 1 行「ページを書くとここに出ます」（本文・ページ送り・「参加したとき」の代わり） |
| `classroom-description-preview-prev` / `-next` | button | プレビューのページ送り |
| `classroom-description-preview-start` | div | プレビュー下の「参加したとき: …」（設定「前回の提出物から始めさせる」とスターターの有無で文言が変わる・Issue #1202） |
| `classroom-description-preview-lesson` | div | プレビュー下の「レッスン: 6 つのうち 4 つ（★ 2 つをふくむ）」と丸（★ = 必須）（レッスンを紐付けたときだけ） |
| `classroom-avatar-email` | span | アカウントメニュー内のユーザーメール（OIDC トークンに email がある場合のみ。旧 `classroom-teacher-email` は廃止） |
| `classroom-board-create-cancel` / `classroom-board-reuse-cancel` | button | インラインフォームのキャンセル |
| `classroom-google-course-imported-{courseId}` | span | GC コースの「インポート済み」バッジ |
| `classroom-breadcrumb-assignments` | button | パンくずのクラス名リンク（クラスの画面へ戻る。testid は「課題一覧」だった頃の名前のまま。クラスに属さない古い課題では「課題一覧」） |
| `classroom-ungrouped-list` | div | クラス未所属の課題のフォールバック一覧（develop 互換） |
| `classroom-ungrouped-open-{classroomId}` | button | 未所属課題をひらく |
| `classroom-phase-teacher-group-manage` | div | 組管理フェーズのルート |
| `classroom-sidebar-teachergroup-{groupId}` | li | サイドバーの組ヘッダー |

### 採点（学期末・AI 採点支援）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-phase-teacher-evaluation` | div | 採点フェーズのルート |
| `classroom-eval-hint-toggle` | button | 説明の「詳しく / 閉じる」（`aria-expanded`） |
| `classroom-eval-hint-detail` | span | 「詳しく」で開く説明の残り |
| `classroom-eval-lesson-only-hint` | span | 作品を出さないレッスンの課題だけのときの説明（「…自動で採点します。AI の採点は使いません」） |
| `classroom-eval-mixed-note` | span | 混ぜて選んだとき、レッスンだけの課題には AI を使わないことの注意（採点の設定の行の右） |
| `classroom-eval-lesson-scoring` | div | 採点の画面の「レッスンの点」の欄のまとまり（設定を読めたレッスンの課題だけ） |
| `classroom-eval-lesson-scoring-{classroomId}` | div | 課題ごとのレッスンの点の欄（課題名 + `classroom-lesson-scoring`。変えるとすぐ保存） |
| `classroom-eval-lesson-{classroomId}` | input | 課題の選択チェックボックス |
| `classroom-eval-settings-summary` | div | 採点の設定の 1 行（観点の名前・採点の厳しさ・［変える］） |
| `classroom-eval-settings-toggle` | button | 採点の設定の「変える / 閉じる」（`aria-expanded`） |
| `classroom-eval-settings` | div | 開いた採点の設定（観点の欄・厳しさ） |
| `classroom-eval-axis-name-{i}` / `classroom-eval-axis-desc-{i}` | input | 観点の名前 / どこを見るか（設定を開いたときだけ） |
| `classroom-eval-strictness` | select | 採点の厳しさ（やや甘め/標準/やや厳しめ・設定を開いたときだけ） |
| `classroom-eval-progress` | div | 進捗表示 |
| `classroom-eval-matrix` | table | 席 × 課題の表（表の枠の中だけスクロール） |
| `classroom-eval-cell-{seat}-{classroomId}` | td | セル（未提出は ×、要確認はオレンジ） |
| `classroom-eval-grade-{seat}-{classroomId}` | select | 採点（S/A/B/C。手動変更は較正サンプルになる） |
| `classroom-eval-reason-{seat}-{classroomId}` | input | 根拠 |
| `classroom-eval-comment-{seat}-{classroomId}` | textarea | 生徒向けコメント |
| `classroom-eval-overall-{seat}` | td | 総合 |
| `classroom-eval-lesson-head-{classroomId}` | th | 「レッスン」の列の見出し（レッスンの課題だけ・作品の列の右・#1603） |
| `classroom-eval-lesson-score-{seat}-{classroomId}` | td | 席のレッスンの点（記録が無ければ「—」） |
| `classroom-eval-steps` | div | フッターの手順（1〜4 のボタンと矢印。レッスンだけの課題のときは 1〜3） |
| `classroom-eval-load` | button | 手順 1「提出を読み込む」（sb3 をブラウザ内で静的解析）。レッスンだけの課題のときは「進み具合を読み込む」 |
| `classroom-eval-check-points` | button | レッスンだけの課題の手順 2「点を確かめる」（レッスンの点の欄へ） |
| `classroom-eval-export-lesson` | button | レッスンだけの課題の手順 3「書き出す」（採点結果（CSV）） |
| `classroom-eval-run-grade` | button | 手順 2「AIで採点」 |
| `classroom-eval-run-comment` | button | 手順 3「コメントを下書き」 |
| `classroom-eval-return-comments` | button | 手順 4「コメントを返却」 |
| `classroom-eval-export-menu` | button | 「書き出し ▾」（`aria-expanded`。読み込む前は押せない） |
| `classroom-eval-export` / `classroom-eval-export-audit` | button | 書き出しメニューの「採点結果（CSV）」/「検証用データ（CSV）」 |
| `classroom-evaluation-cancel` | button | キャンセル（クラス一覧へ戻る） |

手順のボタンのうち、いまの手順だけが `aria-current="step"`（主ボタン）。読み込む前 → 1、読み込んだら → 2、
採点が 1 つでも入ったら → 3、コメントの下書きが 1 つでもあれば → 4（`currentEvalStep`）。
1300×600 の収まりと手順の移り方は `tools/playwright-verify/verify-classroom-grading.mjs` が測る。

### メニューバー

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-menu-button` | div | クラスボタン（コンテナ） |
| `classroom-menu-label` | span | メニューバーのクラス表示テキスト全体（参加中は「クラス:出席番号NN」、未参加時は「クラス」）|
| `classroom-menu-seat-number` | span | 出席番号（0埋め2桁、参加中のみレンダリングされる） |
| `classroom-menu-submission-status` | span | ラベルの横の印の入れ物（参加中のみ）。レッスンの課題では中に進み具合の印。ふつうの課題では空（提出の状態は `classroom-menu-submit` が表す） |
| `classroom-menu-submit` | button | 参加中はいつも出す提出のボタン。`data-kind` = `submit`（オレンジ「提出する」）/ `submitted`（緑「提出済み ✓」）/ `returned`（緑「返却済み ✓」）。押すと提出確認を開く。送信中は disabled の「提出中...」（`aria-busy="true"`）。作品を提出しないレッスンの課題・条件をまだ満たしていないレッスンの課題では描画しない。`data-placement` = `menu-bar`（PC・iPad）/ `drawer`（スマホ。ドロワー `mobile-drawer` のいちばん上に同じ data-testid で出る・高さ 48px） |
| `classroom-menu-lesson-mark` | span | レッスンの課題の進み具合の印（`data-kind` = `notStarted` ○ / `inProgress` 「2/4」 / `cleared` ✓）。作品も提出する課題で提出したら横に `classroom-status-icon-submitted` |

「提出する」の収まり（1300×600・iPad・スマホのドロワー（844×390・667×375・740×360）・3 言語）と提出の流れ（遅い verify・送信中に閉じられないこと）は `tools/playwright-verify/verify-classroom-menu-submit.mjs` が測る。

#### 先生メニュー（先生ログイン中のみ）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-teacher-menu-button` | div | 「クラス管理」メニューボタン（先生ログイン中のみ。メニューバー右端の「?」の左。生徒用の `classroom-menu-button` は元の場所に残る） |
| `classroom-teacher-menu-frame` | span | ボタンの白い枠（アイコン・ラベル・バッジ・▾ を囲む） |
| `classroom-teacher-menu-icon` | img | ボタンのアイコン（🎓） |
| `classroom-teacher-menu-caret` | img | ボタンの ▾ |
| `classroom-teacher-menu-label` | span | ボタンのラベル（「クラス管理」） |
| `classroom-teacher-menu-badge` | span | 未読お知らせがあるときの「!」バッジ |
| `classroom-teacher-menu-current-assignment` | span | 「いまの課題を開く」（最後に開いた課題があるときのみ） |
| `classroom-teacher-menu-class-list` | span | 「クラス一覧を開く」 |
| `classroom-teacher-menu-notifications` | span | 「お知らせ」 |
| `classroom-teacher-menu-notifications-badge` | span | 「お知らせ」項目の未読バッジ |
| `classroom-teacher-menu-logout` | span | 「ログアウト」 |
| `classroom-teacher-menu-kick-requests` | span | 「退室依頼（N件）」（未処理の退室依頼があるときのみ。#1200） |
| `classroom-teacher-menu-kick-requests-badge` | span | 「退室依頼」項目のバッジ |
| `classroom-teacher-menu-status-panel` | span | 「いまの課題の状況」（フローティングパネルを開く。#1203） |

#### 退室依頼のトースト（先生ログイン中・#1200）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-teacher-kick-toast` | div | 画面下部のトースト / 一覧（新しい依頼で 30 秒表示。メニューから開くと一覧） |
| `classroom-teacher-kick-toast-request` | div | 依頼 1 件（`data-request-id` に requestId） |
| `classroom-teacher-kick-toast-reason` | div | 依頼のひと言 |
| `classroom-teacher-kick-toast-approve` | button | 承認 |
| `classroom-teacher-kick-toast-reject` | button | 却下 |
| `classroom-teacher-kick-toast-open` | button | 課題を開く |
| `classroom-teacher-kick-toast-show-all` | button | 「ほかN件」（全件の一覧に切り替え） |
| `classroom-teacher-kick-toast-later` | button | あとで（閉じる） |
| `classroom-teacher-kick-toast-error` | div | 承認・却下の失敗表示 |

#### いまの課題の状況パネル（先生ログイン中・#1203）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-teacher-panel` | div | パネル全体（ドラッグ可能） |
| `classroom-teacher-panel-header` | div | ヘッダー（ドラッグハンドル） |
| `classroom-teacher-panel-header-counts` | span | 最小化中の `着席/定員 · 提出/参加`（レッスンの課題は `着席/定員 · ✓課題クリア/参加`） |
| `classroom-teacher-panel-refresh` | button | 手動更新 |
| `classroom-teacher-panel-minimize` | button | 最小化 / 元に戻す |
| `classroom-teacher-panel-close` | button | 閉じる |
| `classroom-teacher-panel-body` | div | 本文（最小化中は無い） |
| `classroom-teacher-panel-assignment` | select | 課題の切り替え |
| `classroom-teacher-panel-seated` | span | 着席（目安） N / 定員 |
| `classroom-teacher-panel-submitted` | span | 提出 N / 参加数 |
| `classroom-teacher-panel-grid` | div | 座席ミニグリッド |
| `classroom-teacher-panel-seat-<N>` | button | 座席 N（`data-member-id`。押すとメンバー詳細へ。レッスンの課題は `data-lesson-state`） |
| `classroom-teacher-panel-seat-stuck-<N>` | span | 座席 N の「!」（同じチャレンジに 10 分以上・レッスンの課題だけ） |
| `classroom-teacher-panel-lesson-summary` | div | レッスンの課題の 2 行目の数（#1603） |
| `classroom-teacher-panel-lesson-cleared` | span | 課題クリア N / 参加 N |
| `classroom-teacher-panel-lesson-stuck` | span | 止まっている N |
| `classroom-teacher-panel-seat-legend` | div | 座席の色の凡例（まだ・とちゅう・課題クリア・!） |
| `classroom-teacher-panel-lesson-bars` | div | チャレンジごとの横棒 |
| `classroom-teacher-panel-bar-legend` | div | 横棒の凡例（できた・いまやっている） |
| `classroom-teacher-panel-bar-{challengeId}` | div | チャレンジ 1 本の横棒（`title` に人数） |
| `classroom-teacher-panel-kick-list` | div | この課題の未処理の退室依頼 |
| `classroom-teacher-panel-kick-request` | div | 依頼 1 件（`data-request-id`） |
| `classroom-teacher-panel-kick-approve` / `-kick-reject` | button | 承認 / 却下 |
| `classroom-teacher-panel-empty` | div | 課題が未選択 |
| `classroom-teacher-panel-error` | div | 取得・承認の失敗表示（ログインの有効期限切れの文言もここ） |
| `classroom-teacher-panel-reauth` | button | 有効期限切れのときの「再認証する」リンク（再認証中は disabled。#1250） |

自動確認: `tools/playwright-verify/verify-teacher-status-panel.mjs`（classroom API をスタブ。1300×600 で 40 席・退室依頼 3 件が画面内に収まる / パネル表示中にブロックをドラッグできる / 位置の記憶 / 最小化 / 承認）。

#### みんなの作品パネル（生徒・他者参照・#1210）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-peer-panel` | div | パネル全体（ドラッグ可能・非モーダル） |
| `classroom-peer-panel-refresh` | button | 手動更新（一覧と画像 URL を取り直す） |
| `classroom-peer-panel-minimize` | button | 最小化 / 元に戻す |
| `classroom-peer-panel-close` | button | 閉じる |
| `classroom-peer-panel-body` | div | 本文（最小化中は無い） |
| `classroom-peer-panel-hint` | p | 「まねするのではなく、よいところを見つけて…」 |
| `classroom-peer-panel-count` | div | 提出: N 人（自分を除く） |
| `classroom-peer-panel-grid` | div | 座席ミニグリッド |
| `classroom-peer-panel-seat-<N>` | button | 座席 N。提出済みのクラスメイトだけ押せる（未提出・自分の席は disabled） |
| `classroom-peer-panel-empty` | div | まだだれも提出していない |
| `classroom-peer-panel-error` | div | 見られない理由（`data-error` = `off` / `notSubmitted` / `ended` / `failed`） |
| `classroom-peer-viewer` | div | 画像ビューアのウィンドウ（ドラッグ・リサイズ可能・非モーダル） |
| `classroom-peer-viewer-close` | button | ビューアを閉じる |

ビューアの中は共通の画像ビューア（#1209）の data-testid を使う。

### 強制退室通知 / 退室リクエスト (Issue #692)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-kicked-banner` | div | 生徒の seat 画面に表示する「先生によって退室させられました」バナー |
| `classroom-kicked-banner-dismiss` | button | バナーの × |
| `kick-request-confirm-dialog` | div | 「使用中の席」をタップしたとき表示される退室依頼ダイアログ |
| `kick-request-reason-input` | textarea | 任意のひと言入力欄（200 字制限）|
| `kick-request-submit` | button | 「先生にお願いする」（依頼を送信・主ボタン） |
| `kick-request-cancel` | button | 「やめる」（小さなリンク。ダイアログを閉じ、30 秒を数え直す） |
| `kick-request-error` | div | 依頼送信エラー表示 |
| `kick-request-pending-banner` | div | 「先生に依頼中です…」バナー（依頼が生きている間・タブ表示中だけ 5 秒ごとに lookupClassroom を polling。承認で席が空いたらその席で自動参加）|
| `kick-request-pending-note` | div | 依頼中バナー内の補足「先生に届いています。先生が確認しに来ます。待つ間スモウルビーを使っていてもかまいません…」 |
| `kick-request-rejected-banner` | div | 「依頼は受理されませんでした」バナー (却下 / TTL 期限切れ検出時に pending と差し替え) |
| `kick-request-rejected-banner-dismiss` | button | × ボタン |
| `classroom-seat-kick-request-{seatNumber}` | span | 先生の課題詳細の座席グリッドに表示する退室依頼アイコン（`classroom-status-icon-kickRequested`）のバッジ |
| `classroom-member-kick-request-panel` | div | 先生メンバー詳細パネルに表示される依頼一覧 |
| `classroom-kick-request-row-{requestId}` | div | 1 リクエストの行 |
| `classroom-kick-request-approve-{requestId}` | button | 承認（kick + リクエスト削除）|
| `classroom-kick-request-reject-{requestId}` | button | 却下（リクエストのみ削除）|

### お知らせセンター (先生)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-notifications-button` | button | ベル（クリックでパネル開閉） |
| `classroom-notifications-badge` | span | 未読数（10 以上は「9+」。未読 0 で非表示） |
| `classroom-notifications-panel` | div | 一覧パネル（先頭 5 件プレビュー） |
| `classroom-notifications-menu-button` | button | パネルヘッダー右の ⋯ |
| `classroom-notifications-menu` | div | ⋯ メニュー |
| `classroom-notifications-mark-all-read` | button | すべて既読にする（未読 0 で無効） |
| `classroom-notifications-open-all` | button | お知らせを開く（全件一覧ページへ） |
| `classroom-notification-item-{notificationId}` | button | パネル内のお知らせ 1 件（クリックでリンク先へ + パネルを閉じる） |
| `classroom-notification-unread-dot` | span | 未読ドット（未読アイテムのみ） |
| `classroom-notifications-empty` | div | お知らせ 0 件のとき |
| `classroom-notifications-page` | div | 全件一覧ページ（`teacher-notifications` フェーズ） |
| `classroom-breadcrumb-top` | button | パンくず先頭「クラス管理」（トップ = クラス一覧へ） |
| `classroom-notifications-back` | button | 左下の「戻る」（クラス一覧へ） |
| `classroom-notification-page-item-{notificationId}` | button | 一覧ページ内のお知らせ 1 件 |
| `classroom-notifications-pager` / `-prev` / `-next` | div / button | ページャ（10 件/ページ） |

### 汎用

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-loading` | div | ローディング表示 |
| `classroom-error` | div | エラーメッセージ |
| `classroom-error-action` | button | エラーアクションリンク |

---

## Playwright MCP でのテスト

### 基本的なテスト URL

```
http://localhost:8601?no_beforeunload=1
```

### devlogin でのテスト（stg 環境）

```
http://localhost:8601?no_beforeunload=1&devlogin=<DEV_BYPASS_TOKEN>
```

`devlogin=<DEV_BYPASS_TOKEN>` を指定すると、Google ログインをバイパスして `DEV_BYPASS_TOKEN` で先生としてログインできます（stg/ローカル環境のみ）。先生ダッシュボードへは「⚙ 設定 → クラス管理」からアクセスしてください。

- **URL からは消える**: エディタは `devlogin` を読み取った直後に、アドレスバーの URL からこのパラメータだけを取り除きます（`history.replaceState`。ほかのパラメータとハッシュは残る）。スクリーンショット・履歴・共有した URL に値が写らないようにするためです。値はページを開いている間だけメモリに残り、保存されないので、**再読み込みするとログインは外れます**。もう一度 `?devlogin=` を付けて開いてください。
- **値を書かない**: トークンの値を PR / Issue のコメント・PR 本文・コミット（コード・テスト・メッセージ）・スクリーンショットの説明に書かないでください。手順は `?devlogin=<DEV_BYPASS_TOKEN>` / `Authorization: Bearer <DEV_BYPASS_TOKEN>` のように**キー名で**書き、値は `.env` から読みます。テストにはダミーの値を使います。
- **コミット前と CI で止まる**: 追跡ファイルに `DEV_BYPASS_TOKEN` の値（16 文字以上）が入っていると（`DEV_BYPASS_TOKEN=<値>` の形も、Playwright スクリプトや docs の手順に書いた `?devlogin=<値>` の URL の形も）、husky の pre-commit と `npm run lint`（CI）が失敗します（`scripts/check-dev-bypass-token.mjs`）。空の値（`.env.example`）や `<DEV_BYPASS_TOKEN>` / `${DEV_BYPASS_TOKEN}` のようなプレースホルダー、`?devlogin=1` のような短いダミーは通ります。autopilot が GitHub に書くエラー文も `sanitizeForSurface` が `DEV_BYPASS_TOKEN=` / `devlogin=` / `Bearer` の値を伏せます。

### tools/playwright-verify/ の手動 E2E スクリプト

クラス管理を絡めた end-to-end の動作確認は [`tools/playwright-verify/`](../../tools/playwright-verify/README.md) にあるスクリプトで自動化されています（CI には組み込まれていません。手動で `node ...` で実行）。

代表例: `tools/playwright-verify/mesh-v2-classroom-binding.mjs` は教師タブで devlogin → クラスを作成 → 課題ボードで課題を作成 → 課題管理ボードの行をクリックして課題を選択、生徒タブで `?classcode=` 経由参加 という 2 タブのフローを自動で回し、Mesh v2 ドメインが課題の参加コードに揃うことを確認します。

スクリプトを書く際の落とし穴と対処は `tools/playwright-verify/README.md` を参照してください（ログインバイパスの方法、Redux store の取り出し方、サイドバー testid、tutorial overlay の dismiss 等）。

### data-testid を使ったテスト例

```javascript
// フェーズの確認
await page.getByTestId('classroom-phase-student-join').waitFor();

// ボタンクリック
await page.getByTestId('classroom-join-submit').click();

// テキスト入力
await page.getByTestId('classroom-join-code-input').fill('ABC123');

// テキスト取得
const className = await page.getByTestId('classroom-status-class-name').textContent();

// data-testid 経由の JavaScript クリック
await page.evaluate(() => {
    document.querySelector('[data-testid="classroom-menu-button"]').click();
});
```

---

## 結合テスト (infra)

### 実行方法

```bash
# 認証なしテスト（バリデーション、CORS等）
docker compose run --rm -w /app/infra/smalruby-classroom infra npm run test:integration

# 教師フロー含む全テスト（DEV_BYPASS_TOKEN を使用）
docker compose run --rm -w /app/infra/smalruby-classroom -e GOOGLE_ID_TOKEN=<DEV_BYPASS_TOKEN> infra npm run test:integration
```

`DEV_BYPASS_TOKEN` は `infra/smalruby-classroom/.env.stg` に記載されています。
