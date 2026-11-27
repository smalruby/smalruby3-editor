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
| `classroom-phase-teacher-dashboard` | 先生: 課題ダッシュボード（クラス選択後）。クラスを選んでいないときは「クラスの一覧からクラスを選んでください」と［クラスの一覧へ］（`classroom-teacher-empty-class-list`）を出す |
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
| `classroom-google-login` | button | Google ログイン（Google のボタンが出るまでの代わり。出たあとは消える） |
| `google-signin-slot` | div | GIS が描画するサインインボタンのホスト（不具合報告モーダルにも同 testid で存在） |
| `google-signin-button` | div | 上記スロット内に GIS 用に生成されるノード |
| `classroom-microsoft-login` | button | Microsoft ログイン |
| `classroom-login-carousel` | section | ログインの画面の右のカルーセル（クラス管理でできることの紹介。← → で送る） |
| `classroom-login-carousel-prev` | button | カルーセルの前へ（最初のスライドでは `aria-disabled="true"`） |
| `classroom-login-carousel-next` | button | カルーセルの次へ（最後のスライドでは `aria-disabled="true"`） |
| `classroom-login-carousel-pause` | button | カルーセルの［一時停止］／［再生］（動きを減らす設定のときは出ない） |
| `classroom-login-carousel-slide` | div | いま見えているスライド（見出しは中の `h3`） |
| `classroom-login-carousel-dots` | div | いまどこかを示す点（押せない） |
| `classroom-back` | button | 戻る |
| `classroom-refresh` | button | 更新 (↻)。`aria-label` / `title` は「読み込み直す」 |
| `classroom-google-import` | button | Google Classroom からインポート |
| `classroom-google-import-confirm` | button | GC コース一覧の「インポート」（未選択時は disabled） |
| `classroom-avatar-button` | button | アカウントメニュー（ヘッダー右端・メール頭文字 + ▼） |
| `classroom-teacher-logout` | button | ログアウト（アカウントメニュー内） |

### 課題作成

| data-testid | 要素 | 説明 |
|------------|------|------|


### 課題詳細 (先生)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-detail-assignment-name` | input[type=text] | 課題名（1 行・blur / Enter で保存） |
| `classroom-detail-assignment-name-save-hint` | div | 課題名の欄の下の「Enter か欄の外をクリックで保存」（欄にカーソルがある間だけ） |
| `classroom-detail-assignment-name-saved` | span | 課題名の欄の横の「✓ 保存しました」（`role="status"`・保存後 2 秒ほど） |
| `classroom-detail-assignment-name-save-error` | span | 課題名の欄の横の赤い「保存できませんでした」（`role="alert"`・保存に失敗したとき） |
| `classroom-detail-expires-at` | div | 保存期限（ふだんは灰色。残り 7 日以内は `classroom-retention-banner` を含む） |
| `classroom-detail-project` | button | タブの行の右の［⛶ 映す］（tablist の外）。`classroom-projection` を開く |
| `classroom-detail-more-menu` | button | タブの行の右端の⋮（tablist の外。一覧は `classroom-detail-more-menu-list`） |
| `classroom-download-progress` | span | ⋮の左の全作品ダウンロードの進み具合（`n/m`・ダウンロード中のみ） |
| `classroom-tab-members` | button | 「メンバー」タブ（凡例 + 人数 + 更新 + 座席グリッド） |
| `classroom-view-assignment` | a | 「課題を確認」（配信済みのとき・新しいタブ。生徒のステータス画面にもある） |
| `classroom-detail-join-code` | div | 参加コード |
| `classroom-detail-expand-code` | button | 参加コードの横の［⛶ 全画面］。［⛶ 映す］と同じ `classroom-projection` を開く |
| `classroom-members-grid` | div | 座席グリッド |
| `classroom-seat-color-legend` | div | 座席の色の凡例（空席・参加済み・提出済み ✓・返却済み ↩。状態アイコンの凡例より前） |
| `classroom-seat-color-legend-{kind}` | span | 凡例の 1 項目（`kind` = `empty` / `joined` / `submitted` / `returned`） |
| `classroom-status-legend` | div | 状態アイコンの凡例（各項目 `classroom-status-legend-{status}`） |
| `classroom-status-icons` | span | 1 セル内の着席系 + 提出系アイコンのまとまり |
| `classroom-status-icon-{status}` | span[role=img] | 状態アイコン（`data-status` と `aria-label` を持つ。status は `seated` / `notSeated` / `notJoined` / `submitted` / `notSubmitted` / `returned` / `kickRequested` / `occupied`） |
| `classroom-members-count` | span | メンバー数 |
| `classroom-delete-classroom` | button (menuitem) | ⋮の「課題をアーカイブ」（歴史的経緯で testid は delete のまま。soft-delete・復元可能） |
| `classroom-delete-confirm` | button | アーカイブ確認 |
| `classroom-delete-cancel` | button | アーカイブキャンセル |
| `classroom-download-all` | button (menuitem) | ⋮の「全作品ダウンロード」 |

### レッスンの進み具合 (先生・レッスンの課題だけ)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-tab-progress` | button | 「進み具合」タブ（レッスンを紐付けた課題だけ） |
| `classroom-member-{memberId}` | button | 座席。`data-seat-color` = `empty` / `joined` / `submitted` / `returned`（レッスンの課題では代わりに `data-lesson-state` = `notJoined` / `notStarted` / `inProgress` / `cleared`） |
| `classroom-lesson-seat-legend` | div | 座席の色の凡例（空席・まだ・とちゅう・課題クリア ★・「!」）。レッスンの課題では `classroom-seat-color-legend` の代わりに出る |
| `classroom-lesson-seat-legend-{kind}` | span | 凡例の 1 項目（`kind` = `empty` / `notStarted` / `inProgress` / `cleared`） |
| `classroom-lesson-seat-cleared-{n}` | span | 課題クリアした席の ★ |
| `classroom-lesson-cleared-summary` | span | 「クリア N / 参加 N」 |
| `classroom-lesson-seat-count-{seat}` | span[role=img] | タイルの「できた数 / 条件の数」（できた数は条件の数で止める） |
| `classroom-lesson-seat-required-{seat}` | span | タイルの「★ あと n」（必須が残っているときだけ。`role="img"`・`aria-label` は「★ あと n」。中に下の 2 つがあり、CSS がどちらかを出す） |
| `classroom-lesson-seat-required-full-{seat}` | span | 「★ あと n」（ふつうの高さのタイル） |
| `classroom-lesson-seat-required-short-{seat}` | span | 「★n」（高さ 52px 以下のタイル。1300×600 で 40 席を 4 行に収めたとき） |
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
| `classroom-lesson-progress-row-{memberId}` | tr | 席の行 |
| `classroom-lesson-progress-seat-{memberId}` | button | 席番号（押すと右にメンバーの詳細） |
| `classroom-lesson-progress-cell-{memberId}-{challengeId}` | span | セル（`data-kind` = `done` / `before` / `current` / `stuck` / `todo`） |
| `classroom-lesson-progress-readiness-{memberId}` | span | じゅんび・おさらいの列の「じゅんび ✓」/「じゅんび △ …」（結果を送った席だけ・`title` に全部の名前） |
| `classroom-lesson-progress-review-{memberId}` | span | じゅんび・おさらいの列の「おさらい中: <チャレンジ>」（おさらい中の席だけ） |
| `classroom-lesson-progress-unknown-course` | p | このスモウルビーに無いコースのとき表の代わりに出す文 |
| `classroom-lesson-progress-csv` | button (menuitem) | ⋮の「進み具合を CSV でダウンロード」（「進み具合」タブのときだけ） |

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
| `classroom-member-detail-open` | button | スモウルビーで開く（副ボタン）。作品を開くとクラス管理を閉じる（隠して残す）。返却していないコメントは消えないので確かめない。エディタに保存していない変更があれば `classroom-teacher-open-work-confirm-box` を先に出す |
| `classroom-member-detail-return` | button | 返却（選んだ席の詳細の主ボタン） |
| `classroom-member-detail-comment-label` | label | コメント欄の上のラベル「生徒へのコメント（返却で届きます）」 |
| `classroom-member-detail-comment` | textarea | コメント入力。下書きは課題と席ごとにクラス管理（container）が持ち、作品を開いても・席を移っても残る |
| `classroom-member-detail-hide-from-peers` | input (checkbox) | 他の生徒に見せない（提出があるときだけ・切り替えで即保存・Issue #1208） |
| `classroom-member-more-menu` | button | メンバー詳細の見出しの右端の ⋮（開くと `classroom-member-more-menu-list`） |
| `classroom-member-remove` | button | ⋮ の中の「退室させる」。押すと確認を開く（すぐには退室させない） |
| `classroom-member-remove-confirm-box` | div | 「退室させますか？」の確認（見出しの下・淡いオレンジ） |
| `classroom-member-remove-confirm-message` | p | 「出席番号 N の生徒を課題から退室させますか？（作品は残ります）」 |
| `classroom-member-remove-cancel` | button | 確認の［キャンセル］ |
| `classroom-member-remove-confirm` | button | 確認の［退室させる］（主ボタン。押すとメンバーを退室させる） |
| `classroom-member-lesson-detail` | div | レッスンの課題の席の詳細（チャレンジの一覧。#1603） |
| `classroom-member-lesson-detail-count` | span | 「できた数 / 条件の数」（課題クリアなら「課題クリア」） |
| `classroom-member-lesson-detail-list` | ul | チャレンジの一覧の枠（この枠の中だけスクロール） |
| `classroom-member-lesson-detail-{challengeId}` | li | チャレンジ 1 行（`data-kind` = `done` / `before` / `current` / `stuck` / `todo`） |

### ［⛶ 映す］画面（先生）

プロジェクターに映す全画面（`document.body` へのポータル）。生徒の名前は出さない。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-projection` | div[role=dialog] | 映す画面の全体。Esc でも閉じる |
| `classroom-projection-title` | span | 「クラス名 › 課題名」 |
| `classroom-projection-close` | button | ［閉じる］（開いたときにフォーカスがある） |
| `classroom-projection-code` | span | 参加コード（大きく） |
| `classroom-projection-counts` | div | 数の札のまとまり |
| `classroom-projection-joined` | span | 「参加 N / N」 |
| `classroom-projection-submitted` | span | 「提出 N」（ふつうの課題・作品を出すレッスン） |
| `classroom-projection-cleared` | span | 「クリア N」（レッスンの課題） |
| `classroom-projection-legend` | div | 座席の色の凡例（各項目 `classroom-projection-legend-{kind}`） |
| `classroom-projection-seats` | div | 座席（10 列） |
| `classroom-projection-seat-{n}` | span | 1 席（出席番号だけ。`data-seat-color` = `empty` / `joined` / `submitted` / `returned` / `notStarted` / `inProgress` / `cleared` / `loading`（レッスンの進み具合をまだ読み込んでいない）） |
| `classroom-projection-lesson-loading` | span | レッスンの進み具合を読み込み中の「読み込み中…」（凡例の横） |
| `classroom-projection-lesson-error` | p | レッスンの進み具合を読み込めなかったときの短い表示（座席の代わり） |

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
| `classroom-join-code-input` | input | 参加コード入力（見えるラベル「参加コード（先生が見せている 6 文字）」が付く） |
| `classroom-join-submit` | button | 参加コード送信（主ボタン「次へ」） |
| `classroom-join-history` | select | これまでに参加したクラス・課題の参加コード（あるときだけ。見えるラベル「前に参加した課題」が付く） |
| `classroom-join-hint` | div | ヒント（参加コードは先生が黒板や画面に出している） |
| `classroom-join-teacher-hint` | div | ヒントの下の先生向けの小さな案内「あなたは先生ですか？…」 |
| `classroom-teacher-link` | button | 先生向けの「クラス管理を開く」。生徒の「クラス」を閉じて先生のクラス管理を開く |

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
| `classroom-seat-reselect` | button | 「選び直す」（小さなリンク）。座席グリッドに戻る |
| `classroom-confirm-seat` | button | 席番号確定・参加（席を選んだあとの確認ステップにだけ表示） |

### 生徒: 参加完了

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-joined-details` | div | 参加詳細（クラス（学級）名 + 出席番号） |
| `classroom-joined-class-name` | span | クラス（学級）名 |
| `classroom-joined-seat-number` | span | 出席番号（0埋め2桁） |
| `classroom-joined-assignment` | div | 課題名（課題名がある場合のみ） |
| `classroom-joined-lesson-notice` | div | レッスンの課題のゴールのカードの入れ物（レッスンの課題のときだけ） |
| `classroom-joined-goal` | section | ゴールのカード（「チャレンジを N つクリア（★ M つはかならず）」・レッスン・提出）。中の `classroom-joined-goal-count` / `-lessons` / `-next` は課題パネルの `classroom-assignment-goal-*` と同じ |

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
| `classroom-student-refresh` | button | 更新 (↻)。`aria-label` / `title` は「読み込み直す」 |
| `classroom-status-teacher-comment` | div | 先生からのコメントの吹き出し（「先生から」の見出しとアイコン。返却済みのときだけ） |
| `classroom-previous-comment` / `classroom-previous-comment-text` | div | 参加した直後の、前回の課題で先生から届いたコメントの吹き出し / その本文 |
| `classroom-status-continue` | button | 主ボタン「つづける」（何も読み込まずに閉じる。説明の行は `classroom-status-continue-note`）。レッスンの課題では、作品も提出する課題で条件を満たしたあとだけ |
| `classroom-status-continue-current` | button | 主ボタン「この課題で出した作品から続ける」（リロードしたあと、作品が新しい作品のまま・この課題で出した作品がある・このタブでまだ読み込んでいないときだけ。`classroom-status-continue` の代わりに出す）。押すとその提出物を読み込んで閉じる（確認は出さない） |
| `classroom-status-start-starter` | button | 主ボタン「スターターから始める」（リロードしたあと、作品が新しい作品のまま・未提出・課題にスターターがあるときだけ。`classroom-status-continue` の代わりに出す）。押すとスターターを読み込んで閉じる |
| `classroom-status-continue-as-is` | button | 小さなリンク「このまま つづける」（`classroom-status-continue-current` か `classroom-status-start-starter` を出すときだけ）。何も読み込まずに閉じる |
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

1300×600 の収まりは `tools/playwright-verify/verify-classroom-viewport.mjs` が、返却のコメントと長い名前の状態・「作品を読み込み直す」を開いた状態・「クラスから出る」の確認・提出済み・リロードしたあとの「この課題で出した作品から続ける」・リロードしたあとの「スターターから始める」（未提出・スターターあり）・レッスンの課題（「作品を読み込み直す」を開いた状態）で測る（`LOCALE=ja-Hira` でひらがなでも測れる）。

### 生徒: 提出確認

メニューバーの「提出する」/「提出済み ✓」/「返却済み ✓」（`classroom-menu-submit`）から開く。提出済み・返却済みからは再提出の文言になる。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-submit-checking` | div | 「提出の状態を確かめています...」（開いた直後に verify-session を待つ間だけ。このあいだ見出し・サムネイル・主ボタンは出さず、「やめる」だけ押せる） |
| `classroom-submit-preview` | img | サムネイルプレビュー |
| `classroom-submit-teacher-comment` | div | 先生からのコメントの吹き出し（返却済みからの再提出のときだけ） |
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
| `classroom-assignment-page-hint-{n}` | span | 本文の欄の下の書き方の短い説明（1 行目＝見出し・`*ことば*`＝マーカー・箇条書き・`【 】`＝ラベル・空行＝段落） |
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
| `classroom-assignment-save` | button | 課題を保存（「説明」タブのときだけ、課題詳細の「✕ ＋ 課題名」の行の右端） |

### 生徒: 始め方（主ボタン・ほかの始め方）

参加完了（`student-joined`）と、参加した直後の課題パネルの最後のページに出す（[ui-ux.md の「始め方を決める順番」](ui-ux.md#始め方を決める順番)）。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-start-method` | div | 始め方のまとまり。`data-main` = 決めた始め方（`current` この課題で出した作品 / `previous` 前回の作品 / `starter` スターター / `keep` いまの作品のまま / `lesson` レッスン表を開く） |
| `classroom-start-main` | button | 主ボタン（決めた始め方 1 つ）。押すとその作品で始める（読み込んでモーダルを閉じる。`keep` は何も読み込まずに閉じる・`lesson` はレッスン表を開く） |
| `classroom-start-main-note` | small | 主ボタンの 2 行目（何を開くか。提出日時・前回の課題名など） |
| `classroom-start-wait` | span | 参加した直後の課題パネルで、読むのを待つ間の主ボタンの文字「よく読もう… 3」（待つ間は主ボタンと「ほかの始め方」を押せない。待ち終わると消える） |
| `classroom-start-others-toggle` | button | 小さなリンク「ほかの始め方」（`aria-expanded`）。ほかに始め方が無いときは描画しない |
| `classroom-start-others` | div | 開いたときに同じ行に並ぶ残りの始め方 |
| `classroom-start-other-{kind}` | button | 残りの始め方の小さなリンク（`kind` = `current` / `previous` / `starter` / `keep`） |

### 課題パネル（生徒）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-phase-student-assignment` | div | 課題パネルフェーズのルート（join 直後に自動表示） |
| `classroom-assignment-joined-notice` | div | 「参加しました！」通知（join 直後のみ） |
| `classroom-assignment-view-page` | div | 現在の課題ページ |
| `classroom-assignment-view-text` | div | ページ本文（先生の文を見出し・マーカー・箇条書き・ラベルで出したもの） |
| `classroom-assignment-text-heading` | p | ページ本文の 1 行目の見出し（先生の画面のプレビュー・みんなの課題の詳細でも同じ） |
| `classroom-assignment-view-image` | img | ページ画像 |
| `classroom-assignment-prev-page` / `classroom-assignment-next-page` | button | ページ送り |
| `classroom-assignment-page-indicator` | span | ページ位置（`1 / 3`） |
| `classroom-assignment-main-next` | button | 主ボタン「つぎのページ」（最後のページより前） |
| `classroom-assignment-close` | button | 主ボタン「とじる」（「課題を見る」から開き直したときの最後のページ。始め方は出さない） |
| `classroom-assignment-lesson-notice` | div | レッスンの課題のゴールのカードの入れ物（最後のページ。開き直したときも出す） |
| `classroom-assignment-goal` | section | ゴールのカード |
| `classroom-assignment-goal-count` | p | 「チャレンジを N つクリア（★ M つはかならず）」（★ が 0 なら括弧は出さない） |
| `classroom-assignment-goal-lessons` | p | 「レッスン: レッスン 1「…」、レッスン 2「…」」（課題のチャレンジがあるレッスン） |
| `classroom-assignment-goal-next` | p | 作品も提出する課題は「そのあと、自分のプログラムをつくって提出しよう」、提出しない課題は「クリアしたら課題クリア！」 |

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
| `classroom-class-summary-{groupId}` | span | クラスカードの要約（課題数・生徒数） |
| `classroom-class-band-{groupId}` | span | クラスカードの色の帯（クラス名・年度・セクション。色は `classColorFor`） |
| `classroom-class-next-{groupId}` | span | クラスカードの次の授業日（「次の授業日 11/5「課題名」」・無いとき「次の授業日はありません」・課題が 0 件のとき「まだ課題がありません」） |
| `classroom-class-genai-{groupId}` | span | クラスカードの生成AI の札（「生成AI: Gemini」。使うときだけ） |
| `classroom-class-menu-{groupId}` | button | クラスカードの ⋮（一覧は `classroom-class-menu-{groupId}-list`） |
| `classroom-class-archive-{groupId}` | button (`role="menuitem"`) | ⋮ の「アーカイブ」（確認の小さな画面を開く） |
| `classroom-class-archive-dialog` | div (`role="dialog"`) | カードの ⋮ からのアーカイブの確認（Esc で閉じる） |
| `classroom-class-archive-confirm-message` | p | その確認の説明 |
| `classroom-class-archive-cancel` / `classroom-class-archive-confirm` | button | その確認の［アーカイブしない］（開いたときにフォーカス）/［アーカイブする］ |
| `classroom-review-band` | section | 「確認が必要な課題」の帯（どの課題にも `unreturnedCount` が無いとき（古い API）・課題が無いときは出ない。数の無い課題（レッスンなど）は帯に出ない） |
| `classroom-review-item-{classroomId}` | li | 帯の 1 件（クラス名・課題名・「返却していない {数}」） |
| `classroom-review-open-{classroomId}` | button | 帯の［開く］（その課題の詳細を［メンバー］で開く＝返却する画面） |
| `classroom-review-none` | span | 帯の「返却していない提出はありません。」（全部の課題の数がそろって 0 のときだけ） |
| `classroom-class-list` | ul | クラス一覧（カード 4 列。クラスが 0 件のときは出ない） |
| `classroom-class-list-scroll` | div | カードの一覧の枠（9 クラス目からこの枠の中だけがスクロールする） |
| `classroom-class-list-empty` | p | クラス一覧の空メッセージ |
| `classroom-class-card-{groupId}` | li | クラスカード |
| `classroom-class-open-{groupId}` | button | クラスカード本体（クリックでクラスをひらく） |
| `classroom-class-evaluate-{groupId}` | button | クラスカードの「採点」 |
| `classroom-class-import-gc` | button | クラス一覧の「Google Classroom からインポート」（Google ログイン時のみ） |
| `classroom-avatar-button` / `classroom-avatar-initials` / `classroom-avatar-email` | button/span | アカウントメニュー（右上・メール頭文字 + ▼。クリックでメール表示 + ログアウト） |
| `classroom-teacher-logout` | button | ログアウト（アカウントメニュー内。#1111 レビューでタイトルバー常時表示から移動）。採点の画面の下書きがあれば採点の確認、メンバーのタブの返却していないコメントがあれば `classroom-teacher-logout-confirm-box` を先に出す |
| `classroom-teacher-logout-confirm-box` / `classroom-teacher-logout-confirm-message` | div / p | ログアウトの前の確認「返却していないコメントは消えます。ログアウトしますか？」（ヘッダーの下・右に重ねて出す。メニューバーの「ログアウト」からでも出る） |
| `classroom-teacher-logout-cancel` / `classroom-teacher-logout-confirm` | button | 確認の［とどまる］（コメントを残す）/［ログアウトする］ |
| `classroom-teacher-open-work-confirm-box` / `classroom-teacher-open-work-confirm-message` | div / p | 生徒の作品を開く前の確認（#1983。ヘッダーの下・右に重ねて出す）。エディタに保存していない変更があるときだけ出る。message の `data-kind` が `own`（先生自身の作品「エディタにある先生の作品に、保存していない変更があります。…」）か `opened`（前に開いた生徒の作品を先生が変えた「…生徒の作品の上の変更で、どこにも保存されていません。…」） |
| `classroom-teacher-open-work-cancel` / `classroom-teacher-open-work-confirm` | button | 確認の［やめる］（開かない）/［開く］（エディタの作品を置きかえて開く） |
| `classroom-class-create-section` | input | 作成: セクション（オプション） |
| `classroom-class-settings-open-{groupId}` | button | クラスカードの「⚙ 設定」（クラスの設定の画面を開く） |
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
| `classroom-show-archived` | button | 見出しの行の「アーカイブ済みのクラス（{count}）」（アーカイブ済みが 1 件以上のとき表示）。押すとカードがアーカイブ済みに切りかわり、文言が「クラスに戻る」になる（`aria-expanded`） |
| `classroom-archived-class-list` | ul | アーカイブ済みクラスのカード一覧 |
| `classroom-class-restore-{groupId}` | button | アーカイブ済みクラスカードの「元に戻す」 |
| `classroom-board` | div | 課題管理ボード（クラス内のメイン領域） |
| `classroom-class-tabs` | div (tablist) | クラスの中のタブの行（クラスの画面と採点の画面の両方に出る） |
| `classroom-board-tab-stream` / `classroom-board-tab-classwork` / `classroom-board-tab-grading` | button (tab) | クラスの中の［ストリーム］［授業］［採点］タブ（`aria-selected`。最初は［ストリーム］。採点の画面では［採点］が選ばれる。採点の画面からほかのタブへ移るときは離れる確認を通る） |
| `classroom-board-class-settings` | button | タブの行の右端の［⚙ クラスの設定］（ストリーム・授業のとき） |
| `classroom-board-settings-view` | div | クラスの中で開いたクラスの設定の画面（中のフォームは `classroom-class-settings-{groupId}`） |
| `classroom-board-stream-band` | div | ［ストリーム］の上のクラスの色の帯（クラス名・年度・セクション・人数） |
| `classroom-board-current` | section | ストリームの左の「いまの課題」カード（授業日が今日の課題、無ければ授業日がいちばん近い課題） |
| `classroom-board-current-name` | button | いまの課題の名前（押すと課題詳細へ） |
| `classroom-board-current-date` | span | いまの課題の「授業日」（ラベル付き） |
| `classroom-board-current-code` | span | いまの課題の参加コード（大きく） |
| `classroom-board-current-fullscreen` | button | ［⛶ 全画面で映す］（ストリームの主ボタン。いまの課題を開き、その［⛶ 映す］画面 `classroom-projection` を出す。閉じるとストリームに戻る） |
| `classroom-board-current-counts-{classroomId}` | span | いまの課題の「参加 N / N・提出 N」（レッスンの課題は「クリア N」）。読み込み中は「読み込み中…」、失敗は「-」 |
| `classroom-board-current-empty` | p | 課題が無いクラスのいまの課題カードの案内 |
| `classroom-board-retention-card` | section | ストリームの左の「保存期限」カード。`data-urgent="true"` は 7 日以内に消える課題があるとき（赤） |
| `classroom-board-retention-card-item-{classroomId}` | button | 7 日以内に消える課題（押すとストリームの行と同じく［授業］でその課題へ） |
| `classroom-board-retention-card-none` | p | 「7 日以内に消える課題はありません。」（灰色） |
| `classroom-board-retention-card-next` | p | 次の保存期限（灰色。7 日以内のものが無いとき） |
| `classroom-board-stream` | div | ［ストリーム］の右の記録の枠（件数が多いときはこの中だけスクロール） |
| `classroom-board-stream-item-{type}-{classroomId}` | button | ストリームの 1 行。`{type}` は `created`（作成）/ `archived`（アーカイブ）/ `expiring`（残り 7 日以内の自動削除の予定。ほかの行と同じ灰色・赤い警告は `classroom-board-retention-card`）。押すと［授業］でその課題へ |
| `classroom-board-stream-date-{type}-{classroomId}` | span | ストリームの行の右端の日付とラベル（「作成日」／「アーカイブした日」）。`expiring` の行には無い（日付は文中） |
| `classroom-board-stream-empty` | p | ストリームが空のときの案内 |
| `classroom-board-create-menu` | button | ［＋ 作成 ▾］（主ボタン）。開いた一覧は `classroom-board-create-menu-list`（`role="menu"`） |
| `classroom-board-create` | button (menuitem) | 作成メニューの「課題」（課題の作成画面へ） |
| `classroom-board-create-lesson` | button (menuitem) | 作成メニューの「レッスン」（「課題」のすぐ下。同じ作成画面へ。作ると説明タブでレッスン欄が開き、最初のコースの最初のレッスンが選ばれる） |
| `classroom-board-create-topic` | button (menuitem) | 作成メニューの「トピック」（トピックを追加の小さな画面へ） |
| `classroom-board-more-menu` | button | 右上の ⋮（中に `classroom-board-download-class`） |
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
| `classroom-board-row-date-{classroomId}` | span | 閉じた行の「授業日」（ラベル付き。利用者の時間帯の日付） |
| `classroom-board-row-tags-{classroomId}` | span | 行の数の札のまとまり（出す札が無い行には無い） |
| `classroom-board-row-tag-joined-{classroomId}` / `classroom-board-row-tag-submitted-{classroomId}` / `classroom-board-row-tag-cleared-{classroomId}` | span | 「参加 N/N」「提出 N」（レッスンの課題は「クリア N」）。行を開いたか、いまの課題カードで数を読み込んだ課題だけ |
| `classroom-board-row-tag-unreturned-{classroomId}` | span | 「返却していない N」（課題の一覧の `unreturnedCount` が 1 以上の課題） |
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
| `classroom-board-download-class` | button (menuitem) | ⋮の「全課題の提出物をダウンロード」（active + アーカイブ済みを 1 つの zip に） |
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
| `classroom-teacher-header` | header | 紫のヘッダー（「← エディタに戻る｜クラス管理 › …」・ベル・アバター） |
| `classroom-teacher-back-to-editor` | button | ヘッダー左の「← エディタに戻る」（クラス管理を閉じる。共有モーダルの「戻る」の代わり） |
| `classroom-breadcrumbs` | nav | ヘッダーの中のいまいる所（クラス管理 › {クラス名} › 課題を作成などのサブビュー｜{課題名}）。いまの画面は `aria-current="page"` |
| `classroom-breadcrumb-class-list` / `classroom-breadcrumb-assignments` | button | いまいる所の「クラス管理」（クラス一覧へ）/ {クラス名}（クラスの画面へ）のリンク |
| `classroom-breadcrumb-assignment-name` | span | 課題詳細のいまいる所の末尾（課題名） |
| `classroom-breadcrumb-assignment-detail` | button | Google Classroom に共有の画面で、課題名（課題詳細へ戻る） |
| `classroom-board-create-name` / `classroom-board-create-submit` | input / button | インライン課題作成（課題名） |
| `classroom-board-reuse` | button (menuitem) | 作成メニューの「課題を再利用」 |
| `classroom-board-reuse-view` | div | 再利用ビュー（全課題を日付降順） |
| `classroom-board-reuse-filter` | select | 再利用ビューのクラスフィルタ |
| `classroom-board-reuse-copy-{classroomId}` | button | このクラスに複製 |
| `classroom-tab-description` | button | 課題詳細の「説明」タブ（新しく作った課題の初回のみアクティブ。それ以外は `classroom-tab-members` が既定） |
| `classroom-description-editor` | div | 説明タブの課題編集フォーム（埋め込み） |
| `classroom-description-preview` | div | 右ペインの生徒視点プレビュー |
| `classroom-description-preview-body` | div | プレビュー本文（テキスト+画像） |
| `classroom-description-preview-text` | div | プレビューのページ本文（生徒の課題パネルと同じ書式） |
| `classroom-description-preview-empty` | p | どのページも空のときの 1 行「ページを書くとここに出ます」（本文・ページ送り・「参加したとき」の代わり） |
| `classroom-description-preview-prev` / `-next` | button | プレビューのページ送り |
| `classroom-description-preview-start` | div | プレビュー下の「参加したとき: …」（スターターの有無で文言が変わる） |
| `classroom-description-preview-lesson` | div | プレビュー下のゴールのカードの入れ物（レッスンを紐付けたときだけ） |
| `classroom-description-preview-goal` | section | 生徒に出るのと同じゴールのカード（中は `-count` / `-lessons` / `-next`。保存前の設定で出す） |
| `classroom-avatar-email` | span | アカウントメニュー内のユーザーメール（OIDC トークンに email がある場合のみ。旧 `classroom-teacher-email` は廃止） |
| `classroom-board-create-cancel` / `classroom-board-reuse-cancel` | button | インラインフォームのキャンセル |
| `classroom-google-course-imported-{courseId}` | span | GC コースの「インポート済み」バッジ |
| `classroom-breadcrumb-assignments` | button | いまいる所のクラス名リンク（クラスの画面へ戻る。testid は「課題一覧」だった頃の名前のまま。クラスに属さない古い課題では「課題一覧」） |
| `classroom-ungrouped-list` | div | クラス未所属の課題のフォールバック一覧（develop 互換） |
| `classroom-ungrouped-open-{classroomId}` | button | 未所属課題をひらく |
| `classroom-phase-teacher-group-manage` | div | 組管理フェーズのルート |

### 採点（採点簿・課題ごとの採点・AI 採点支援）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-gradebook-switch-book` / `classroom-gradebook-switch-overall` | button | 採点簿の上の［採点簿］［総合評価］（`aria-pressed`） |
| `classroom-gradebook` | table | 採点簿（列 = 課題・新しい課題が左、行 = 出席番号。表の枠の中だけ縦にも横にもスクロール） |
| `classroom-gradebook-col-{classroomId}` | th | 列の見出し（状態「未採点」「AI の案 N 件・未確定」「確定 N 件」、基準があれば「基準あり・」が前に付く） |
| `classroom-gradebook-open-{classroomId}` | button | 列の見出しの課題名。押すとその課題の採点を開く |
| `classroom-gradebook-counts-{classroomId}` | td | いちばん上の行の S/A/B/C の人数（「S3 A28 B5 C0」。評価が無ければ「—」） |
| `classroom-gradebook-cell-{seat}-{classroomId}` | td | セル（中のボタンを押すと、その席を選んで課題の採点を開く。確定していない AI の案はボタンが `data-draft="true"` で点線・薄く。`aria-label` は「出席番号 N・{課題名}: {点}」・AI の案は「（AI の案）」を足す） |
| `classroom-gradebook-empty` | p | まだ採点した課題が無いときの案内 |
| `classroom-gradebook-no-assignments` | p | クラスに課題が無いとき |
| `classroom-legacy-import-open` | button | 採点簿の「以前の採点結果 CSV を読み込む」 |
| `classroom-legacy-import-file` | input[type=file] | 取り込む CSV を選ぶ（隠し） |
| `classroom-legacy-import-preview` | div | 取り込みのプレビュー |
| `classroom-legacy-import-run` | button | ［取り込む］ |
| `classroom-legacy-import-cancel` | button | ［やめる］ |
| `classroom-legacy-import-result` | p | 取り込みの結果 |
| `classroom-gradebook-overall` | p | 総合評価（準備中の置き場） |
| `classroom-evaluation-cancel` | button | 採点簿のキャンセル（クラス一覧へ戻る。返却していないコメント・保存できなかった採点があるとき・処理の途中は先に確認を出す） |
| `classroom-eval-back-to-book` | button | 課題の採点の［‹ 採点簿］（何も消えないので確かめない） |
| `classroom-breadcrumb-gradebook` | button | 課題の採点のヘッダーのクラス名（採点簿へ戻る） |
| `classroom-eval-assignment-title` | h3 | 課題の採点の課題名 |
| `classroom-eval-confirmed` | span | 「確定」（確定した課題） |
| `classroom-eval-save-state` | span | 採点の保存の状態（`data-state` は `pending`「保存しています…」/ `failed`「保存できていません」） |
| `classroom-eval-unconfirmed` | span | 確定のあとに評価を変えたので確定を取り消したことの知らせ |
| `classroom-eval-ai-quota` | span | 課題の採点の上の行の右の「今日の AI の残り: {残り} / {上限} 回」。課題を開いたときに `GET /teacher/evaluation-quota` を 1 回読み、AI を使うたびに答えの `quota` で更新する。20 回以下は `data-low="true"`（確認の色）、0 回は「日付が変わると（0 時）また使えます。」を添える。読めないとき（404・通信の失敗）は出さない |
| `classroom-eval-seat-list` | ul | 左の席の一覧（メンバー全員。枠の中だけスクロール） |
| `classroom-eval-cell-button-{seat}-{classroomId}` | button | 席の一覧の 1 行（出席番号と評価。未提出は「未提出」、評価が無ければ —、確定していない AI の案は `data-draft="true"` で点線。要確認は「!」、返却済みは「↩」、コメントがあれば「💬」。レッスンの課題はレッスンの点も出す。押すと［生徒］に出す・`aria-pressed`）。`aria-label` は「出席番号 N・{課題名}: {点}」で、点が無いときは「未採点」、未提出は「未提出」、印があれば「（要確認・返却済み・コメントあり・AI の下書き）」を足す（要確認は理由つき: 「要確認: AI が迷った」など） |
| `classroom-eval-counts` | div | 右の上の人数 |
| `classroom-eval-count-notSubmitted` / `-drafts` / `-confirmed` / `-returned` | div | 未提出・AI の案・確定・返却済みの数（読み込む前の未提出は「—」） |
| `classroom-eval-distribution` | div | 人数の下の評価の分布（#2457。左に横棒のグラフ、右に S+A・S の %） |
| `classroom-eval-dist-grade-S` / `-A` / `-B` / `-C` | span | S/A/B/C の人数（数は中の `b`） |
| `classroom-eval-dist-bars` | div | S/A/B/C の横棒のグラフ（#2523） |
| `classroom-eval-dist-bar-S` / `-A` / `-B` / `-C` | span | 評価ごとの棒。`style.width` が評価のついた人のうちの割合、`data-count` が人数 |
| `classroom-eval-dist-sa` / `classroom-eval-dist-s` | span | S+A・S の人数と %、目標・目安。`data-ok="false"` で目安から外れている（注意の色と「!」） |
| `classroom-eval-dist-base` | span | % の分母（評価のついた人数）と、数えない未提出の人数 |
| `classroom-eval-tab-rubric` / `classroom-eval-tab-student` | button (tab) | 右の［基準］［生徒］（`aria-selected`。作品を出さないレッスンの課題では出さない） |
| `classroom-eval-tab-shape` | button (tab) | 右の［形］（形の札でまとめて採点。`aria-selected`） |
| `classroom-eval-shapes` | div | ［形］の一覧 |
| `classroom-eval-shapes-lead` | p | ［形］の冒頭の説明（このタブでできること） |
| `classroom-eval-shapes-todo` | p | ［形］の冒頭の説明（先生がここでやるとよいこと） |
| `classroom-eval-shapes-arrived` | p (status) | 基準（2-4）を保存して［形］へ移ったときだけ出る、移った理由の一言。タブを選び直すか、ほかの課題へ移ると消える |
| `classroom-eval-shape-<i>` | li | 形（人数の多い順に 0 から）。札・人数・いまの評価 |
| `classroom-eval-shape-mixed-<i>` | span | 「同じ形なのに評価が分かれています」 |
| `classroom-eval-shape-grade-<i>` / `classroom-eval-shape-apply-<i>` | select / button | 「この形は」の評価と［{n} 人にまとめて付ける］ |
| `classroom-eval-shape-works-<i>` | summary | ［作品を見る（n）］ |
| `classroom-eval-shape-work-<seat>` | button | 形の中の作品（押すと［生徒］で開く） |
| `classroom-eval-shape-tags` | div | ［生徒］の形の札 |
| `classroom-eval-same-shape-<seat>` | button | ［生徒］の「同じ形の作品」の席 |
| `classroom-eval-rubric-pane` | div | ［基準］の中身（課題の説明・基準） |
| `classroom-eval-description` | p | 課題の説明（AI に渡す。無ければその旨） |
| `classroom-eval-rubric-levels` | table | 課題の基準（S/A/B/C の文） |
| `classroom-eval-rubric-levels-no-example-<S\|A\|B\|C>` | span | 保存した基準で、正解の例に無い段の「正解の例が無い（AI の推測）」 |
| `classroom-eval-no-rubric` | p | 基準がまだ無いときの文 |
| `classroom-eval-not-loaded` | p | 読み込む前の［生徒］の案内 |
| `classroom-eval-detail` | aside | ［生徒］の中の選んだ席の点・根拠・コメント |
| `classroom-eval-added` | div | ［生徒］のスターターから足した台本（無ければ「動く台本は足していません」） |
| `classroom-eval-group` | span | その席のまとまり（「まとまり: LED だけ」） |
| `classroom-eval-steps` | div | フッターの手順（1〜6 のボタンと矢印。作品を出さないレッスンの課題のときは 1〜3） |
| `classroom-eval-rubric` | button | 手順 2「基準をつくる」（いまは［基準］のタブを開くだけ。押すと手順 3 へ進む） |
| `classroom-eval-run-grade` | button | 手順 3「全員を採点」（AI） |
| `classroom-eval-confirm` | button | 手順 4「確定」（評価が 1 つも無いときは押せない） |
| `classroom-eval-run-comment` | button | 手順 5「コメントを下書き」 |
| `classroom-eval-return-comments` | button | 手順 6「返却」 |
| `classroom-eval-load-running` / `classroom-eval-run-grade-running` / `classroom-eval-confirm-running` / `classroom-eval-run-comment-running` / `classroom-eval-return-comments-running` | span | 処理中の手順のボタンの中のスピナーと短い言葉（ボタンは `aria-busy="true"`） |
| `classroom-eval-leave-confirm-message` | p | 離れる確認の文。消えるもの（「保存できなかった採点は消えます。」／「返却していないコメントは消えます。」／両方）と入口の問い（「戻りますか？」／「この画面を離れますか？」／「読み込み直しますか？」）。読み込み・AI・返却の途中なら先頭に「処理の途中です。離れると、そこで止まります。」。`data-kind` は `back` / `leave` / `reload`、`data-lost` は消えるもの（`grades` / `comments` を空白区切り）。出ている間は手順のボタンと書き出しメニューを隠す |
| `classroom-eval-leave-export` | button | 離れる確認の［採点結果を書き出す］（課題の採点のときだけ。その課題の CSV） |
| `classroom-phase-teacher-evaluation` | div | 採点フェーズのルート |
| `classroom-eval-hint-text` | span | 説明の 1 行（タブの行の右。長いときは「…」・全文は `title`） |
| `classroom-eval-hint-toggle` | button | 説明の「詳しく / 閉じる」（`aria-expanded`） |
| `classroom-eval-hint-detail` | span | 「詳しく」で開く説明の残り |
| `classroom-eval-lesson-only-hint` | span | 作品を出さないレッスンの課題だけのときの説明（タブの行の右・「…自動で採点します。AI の採点は使いません」） |
| `classroom-eval-lesson-scoring` | div | 採点の画面の「レッスンの点」の欄のまとまり（設定を読めたレッスンの課題だけ） |
| `classroom-eval-lesson-scoring-{classroomId}` | div | 課題ごとのレッスンの点の欄（課題名 + `classroom-lesson-scoring`。変えるとすぐ保存） |
| `classroom-eval-progress` | div | 処理中の表示（スピナー + 何をしているかの文・`role="status"`・`aria-busy`） |
| `classroom-eval-progress-text` | span | 処理中の文（「02_LED の提出を読み込んでいます（3/28）」など） |
| `classroom-eval-progress-bar` | div | 件数が分かるときの細い進み具合のバー（`data-percent`） |
| `classroom-eval-result` | div | 手順が終わったあとの短い結果（`data-failed="true"` は失敗。赤い地） |
| `classroom-eval-load-running` / `classroom-eval-run-grade-running` / `classroom-eval-run-comment-running` / `classroom-eval-return-comments-running` | span | 処理中の手順のボタンの中のスピナーと短い言葉（ボタンは `aria-busy="true"`） |
| `classroom-eval-matrix` | table | 採点簿の表（点だけ。表の枠の中だけ縦にも横にもスクロール・出席番号の列は左に留まる） |
| `classroom-eval-cell-{seat}-{classroomId}` | td | セル（未提出は ×、要確認はオレンジ） |
| `classroom-eval-cell-button-{seat}-{classroomId}` | button | 提出したセルの点のボタン（まだ無いときは —・押すと右の列に出す・選んだセルは `aria-pressed="true"`）。要確認は「!」、返却済みは「↩」、コメントがあれば「💬」。`aria-label` は「出席番号 N・{課題名}: {点}」で、点が無いときは「未採点」、印があれば「（要確認・返却済み・コメントあり）」を足す |
| `classroom-eval-detail` | aside | 右の列（選んだ席の点・根拠・コメント） |
| `classroom-gradebook-overall` | div | 総合評価の画面（採点簿の上の［総合評価］） |
| `classroom-overall-export` | button | ［総合評価の CSV を書き出す］（確定していない課題が入っていると disabled） |
| `classroom-overall-settings` | div | 左の設定（入れる課題と重み・点・区切り） |
| `classroom-overall-include-{classroomId}` / `classroom-overall-weight-{classroomId}` | input | 課題を入れるチェック / 重み |
| `classroom-overall-point-{S\|A\|B\|C\|none}` / `classroom-overall-cut-{S\|A\|B}` | input | 評価の点（none = 未提出）/ 総合の区切り |
| `classroom-overall-reset` | button | 設定を既定に戻す |
| `classroom-overall-unconfirmed` | p | 確定していない課題の注意（`role="status"`） |
| `classroom-overall-open-{classroomId}` | button | 確定していない課題へのリンク（その課題の採点を開く） |
| `classroom-overall-loading` / `classroom-overall-no-columns` / `classroom-overall-no-seats` | p | 読み込み中 / 課題が入っていない / 採点した席が無い |
| `classroom-overall-table` | table | 結果の表（`classroom-overall-row-{seat}`・`classroom-overall-average-{seat}`・`classroom-overall-grade-{seat}`） |
| `classroom-overall-chart` | div | 表の上の分布のグラフ（#2458） |
| `classroom-overall-chart-sab` | span | S+A+B の人数と %（`data-ok`。75% 未満で `false`） |
| `classroom-overall-chart-band` / `classroom-overall-chart-band-before` | div | 100% の積み上げ帯（いま / 開いたときの薄い帯）。中の `-{S\|A\|B\|C}` が評価ごとの部分（`data-count`・人数 0 の評価は出さない） |
| `classroom-overall-chart-dots` / `classroom-overall-chart-dot-{seat}` | div / span | 平均の点の分布の枠 / 席ごとの点 |
| `classroom-overall-chart-cut-{S\|A\|B}` | div | 区切りの線（`role="slider"`・ドラッグか矢印のキーで動かす） |
| `classroom-eval-detail-title` | h3 | 右の列の見出し「出席番号 NN」 |
| `classroom-eval-detail-lesson` | span | 右の列の課題名 |
| `classroom-eval-detail-open-work` | button | 右の列の課題名の右の［作品を開く］。選んだ席の作品をエディタで開き、クラス管理を閉じる（課題の詳細の［スモウルビーで開く］と同じ処理）。採点の下書きについては確かめずに開く（採点の画面は隠して残る・下の戻る帯）。エディタに保存していない変更があれば `classroom-teacher-open-work-confirm-box` を先に出す。開いている間は押せず「開いています…」と出す |
| `classroom-teacher-work-bar` | div | 先生がクラス管理から作品を開いている間、メニューバーの下に出す戻る帯（クラス管理が閉じている間だけ。生徒の画面には出ない） |
| `classroom-teacher-work-bar-text` | span | 戻る帯の「出席番号 N・課題名 の作品を見ています」（生徒の名前は出さない） |
| `classroom-teacher-work-bar-expired` | span | ログインが切れたときだけ出す「ログインが切れました。戻ってログインし直してください。」 |
| `classroom-teacher-work-bar-back` | button | ［‹ 採点に戻る］／［‹ 課題に戻る］。クラス管理を開き直す（隠して残してある画面・下書きのまま） |
| `classroom-eval-detail-prev` / `classroom-eval-detail-next` | button | 同じ課題を提出した前 / 次の席へ（「‹ NN」/「NN ›」。端では押せない）。`aria-label` は「前の出席番号 NN」/「次の出席番号 NN」（端では番号なし） |
| `classroom-eval-detail-needs-review` | span | 右の列の「要確認」。理由があれば添える（「要確認: AI が迷った」「要確認: 同じ形なのに評価が違う」「要確認: 作品を読めなかった」）。`data-reason` は `ai` / `shape` / `analysis`（理由が分からない＝保存から読み戻しただけのときは空） |
| `classroom-eval-detail-ai-draft` | span | 「AI の下書き」（AI が出した点を先生がまだ変えていないとき。根拠だけを直したときは残る） |
| `classroom-eval-detail-empty` | p | 提出が 1 つも無いときの「提出された作品はありません。」 |
| `classroom-eval-grade-{seat}-{classroomId}` | select | 右の列の点（S/A/B/C。手動変更は較正サンプルになる）。見えるラベル「点」。選んだ席の分だけ出る |
| `classroom-eval-reason-{seat}-{classroomId}` | textarea | 右の列の根拠。見えるラベル「根拠（先生だけ）」 |
| `classroom-eval-comment-{seat}-{classroomId}` | textarea | 右の列の生徒へのコメント。見えるラベル「生徒へのコメント」 |
| `classroom-eval-load` | button | 手順 1「提出を読み込む」（sb3 をブラウザ内で静的解析）。レッスンだけの課題のときは「進み具合を読み込む」 |
| `classroom-eval-check-points` | button | レッスンだけの課題の手順 2「点を確かめる」（レッスンの点の欄へ） |
| `classroom-eval-export-lesson` | button | レッスンだけの課題の手順 3「書き出す」（採点結果（CSV）） |
| `classroom-eval-export-menu` | button | 「書き出し ▾」（`aria-expanded`。読み込む前は押せない） |
| `classroom-eval-export` / `classroom-eval-export-audit` | button | 書き出しメニューの「採点結果（CSV）」/「検証用データ（CSV）」 |
| `classroom-eval-leave-cancel` | button | 離れる確認の［採点を続ける］ |
| `classroom-eval-leave-confirm` | button | 離れる確認の確定（［戻る］／［離れる］／［読み込み直す］・赤） |
| `grading-rubric` | div | ［基準］のタブの中身（#2425） |
| `grading-rubric-steps` | section | 基準づくりの縦のステッパー（手順 2 の中の 2-1〜2-4・#2455）。小手順は `grading-rubric-steps-step-<describe\|examples\|fairness\|sentences>`（`data-state` = `done` / `now` / `todo`）、見出しは `grading-rubric-steps-head-<id>`（押すと開く）、たたんだ 1 行は `grading-rubric-steps-summary-<id>` |
| `grading-rubric-description` / `grading-rubric-description-text` | div / p | 2-1 課題の説明 |
| `grading-rubric-describe-ai` / `grading-rubric-describe-ai-button` | div / button | 2-1 の「AI に相談」／［AI に説明の案を書いてもらう］（説明があるときは［AI に説明を作り直してもらう］。一度実行したら押せない） |
| `grading-rubric-describe-proposal` / `grading-rubric-describe-text` | div / textarea | AI の説明の案（直せる）／下書きの文（AI の案・コピーした説明） |
| `grading-rubric-describe-copied` | div | ほかの課題からコピーした説明の下書き（答えのボタンは AI の案と同じ `grading-rubric-describe-ok` など） |
| `grading-rubric-describe-ok` / `-fix` / `-only-here` | button | ［合っている（課題に保存）］／［直して保存］／［保存せず、この採点だけで使う］ |
| `grading-rubric-running` | p | 保存・コピー・スターターの読み込みの間の表示（AI が動いている間は、その「AI に相談」のボタンが `aria-busy="true"`） |
| `grading-rubric-saved` / `grading-rubric-edit` | div / button | 保存した基準／［基準をつくり直す］ |
| `grading-rubric-no-s-example` / `grading-rubric-draft-no-s-example` / `grading-rubric-copy-no-s-example` | p | S の正解の例が無いときの注意（保存した基準／基準づくりの途中／コピーで選んだ基準） |
| `grading-rubric-reps` | div | 2-2 代表の作品の一覧 |
| `grading-rubric-propose-ai` / `grading-rubric-propose-ai-button` | div / button | 2-2 の上の「AI に相談」／［AI に代表 N 件の案を出してもらう］（代表すべてをまとめて。一度実行したら押せない） |
| `grading-rubric-rep-<席>` / `grading-rubric-rep-body-<席>` | button / div | 代表の行（押すと開く）／開いた中身 |
| `grading-rubric-rep-grade-<席>-<S\|A\|B\|C>` / `grading-rubric-rep-reason-<席>` / `grading-rubric-rep-open-<席>` | button / input / button | 正解・理由・［作品を開く］ |
| `grading-rubric-proposed-notice` | p (status) | 2-2 の AI の案が出終わったときの知らせ「AI の案が出ました。正解を選んでください。」（代表すべてに正解が付くまで） |
| `grading-rubric-rep-hint-<席>` | span (tooltip) | AI の案が出終わったとき、開いた代表の正解のボタンのそばに約 4 秒だけ出る「正解を選ぶ」 |
| `grading-rubric-fairness` | div | 2-3 フェアの確認 |
| `grading-rubric-fairness-ai` / `grading-rubric-fairness-ai-button` | div / button | 2-3 の「AI に相談」／［AI にフェアか確かめてもらう］（一度実行したら押せない） |
| `grading-rubric-fairness-next` | button | 2-3 で聞くことが無い（くらべる作品が無い）ときの［次へ］。押すと 2-3 が済みになり 2-4 へ移る |
| `grading-rubric-check-<i>` / `-option-<j>` / `-compare` | li / button / button | 質問・選択肢・［作品を並べて見る］ |
| `grading-rubric-sentences` / `grading-rubric-level-<S\|A\|B\|C>` / `grading-rubric-save` | div / input / button | 2-4 基準の文・文の欄・［基準を保存］ |
| `grading-rubric-draft-ai` / `grading-rubric-draft-ai-button` | div / button | 2-4 の「AI に相談」／［AI に基準の文の案を書いてもらう］（一度実行したら押せない） |
| `grading-rubric-copy` / `grading-rubric-copy-dialog` | button / div | ［説明と基準をコピー…］／コピーの小さな画面 |
| `grading-rubric-copy-class` / `grading-rubric-copy-assignment` | select | コピー元のクラス・課題 |
| `grading-rubric-copy-preview` / `grading-rubric-copy-description` / `grading-rubric-copy-levels` / `grading-rubric-copy-none` | div / p / table / p | コピー元の中身／その説明／その基準／説明も基準も無い |
| `grading-rubric-copy-levels-no-example-<S\|A\|B\|C>` | span | コピー元の基準で、正解の例に無い段の「正解の例が無い（AI の推測）」 |
| `grading-rubric-copy-do` / `grading-rubric-copy-cancel` | button | ［コピーする］／［やめる］ |
| `grading-group-prompt` / `-yes` / `-no` | div / button / button | 1 件を直したあとの「同じまとまりも変えますか？」と［{n} 件も変える］［この 1 件だけ］（［生徒］のタブ） |

課題の採点の手順のボタンのうち、いまの手順だけが `aria-current="step"`（主ボタン）。読み込む前 → 1、読み込んだら → 2、
基準がある・基準を見たら → 3、評価が 1 つでも入ったら → 4、確定したら → 5、コメントの下書きが 1 つでもあれば → 6（`currentGradingStep`）。
採点簿 → 課題の採点 → 確定 → 採点簿の流れと 1300×600 の収まりは `tools/playwright-verify/verify-classroom-gradebook.mjs` が測る。以前の採点結果 CSV の取り込み・［基準］タブ・確定の取り消し・総合評価・返却と失敗の表示は `tools/playwright-verify/verify-classroom-grading.mjs` が測る。タブを切りかえてもタブの行が上下に動かないことは `tools/playwright-verify/verify-classroom-tab-offsets.mjs` が測る。

### メニューバー

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-menu-button` | div | クラスボタン（コンテナ） |
| `classroom-menu-label` | span | メニューバーのクラス表示テキスト全体（参加中は「クラス:出席番号NN」、未参加時は「クラス」）|
| `classroom-menu-seat-number` | span | 出席番号（0埋め2桁、参加中のみレンダリングされる） |
| `classroom-menu-submission-status` | span | ラベルの横の印の入れ物（参加中のみ）。レッスンの課題では中に進み具合の印。ふつうの課題では空（提出の状態は `classroom-menu-submit` が表す） |
| `classroom-menu-submit` | button | 参加中はいつも出す提出のボタン。`data-kind` = `submit`（オレンジ「提出する」）/ `submitted`（緑「提出済み ✓」）/ `returned`（緑「返却済み ✓」）。押すと提出確認を開く。送信中は disabled の「提出中...」（`aria-busy="true"`）。作品を提出しないレッスンの課題・条件をまだ満たしていないレッスンの課題では描画しない。`data-placement` = `menu-bar`（PC・iPad）/ `drawer`（スマホ。ドロワー `mobile-drawer` のいちばん上に同じ data-testid で出る・高さ 48px） |
| `classroom-submit-reminder` | div | 「提出しよう」の吹き出し（未提出のまま 25 分たったとき。消したら 10 分ごと）。`data-placement` = `menu-bar`（メニューバーの「提出する」の下に浮かべる）/ `drawer`（スマホのドロワーの「提出する」の下。ドロワーを開いているときだけ） |
| `classroom-submit-reminder-close` | button | 吹き出しの ×（消す。10 分後にもう一度出る） |
| `classroom-submit-reminder-dot` | span | メニューバーで、下へ 56px ずらしても操作に重なって吹き出しを置けないときの代わりの点（「提出する」の右上。読み上げ用に同じ文言を持つ） |
| `mobile-side-rail-menu-dot` | span | スマホのサイドレールの ☰ の右上の点（吹き出しを出す時だけ） |
| `classroom-menu-lesson-mark` | span | レッスンの課題の進み具合の印（`data-kind` = `notStarted` ○ / `inProgress` 「2/4」 / `cleared` ✓）。作品も提出する課題で提出したら横に `classroom-status-icon-submitted` |

「提出する」の収まり（1300×600・iPad・スマホのドロワー（844×390・667×375・740×360）・3 言語）と提出の流れ（遅い verify・送信中に閉じられないこと）は `tools/playwright-verify/verify-classroom-menu-submit.mjs` が測る。「提出しよう」の吹き出しの収まり（同じ画面の大きさ・3 言語・ほかの操作と重ならない・☰ の点）は `tools/playwright-verify/verify-classroom-submit-reminder.mjs` が測る。

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
| `classroom-teacher-panel-refresh` | button | 手動更新（↻。`aria-label` / `title` は「読み込み直す」） |
| `classroom-teacher-panel-minimize` | button | 最小化 / 元に戻す |
| `classroom-teacher-panel-close` | button | 閉じる |
| `classroom-teacher-panel-body` | div | 本文（最小化中は無い） |
| `classroom-teacher-panel-assignment` | select | 課題の切り替え |
| `classroom-teacher-panel-seated` | span | 着席（目安） N / 定員 |
| `classroom-teacher-panel-submitted` | span | 提出 N / 参加数 |
| `classroom-teacher-panel-kick-count` | span | 退室依頼 N（この課題の退室依頼があるときだけ。数の札の行） |
| `classroom-teacher-panel-grid` | div | 座席ミニグリッド |
| `classroom-teacher-panel-seat-<N>` | button | 座席 N（`data-member-id`。押すとメンバー詳細へ。色は `data-seat-color`、レッスンの課題は `data-lesson-state`） |
| `classroom-teacher-panel-seat-stuck-<N>` | span | 座席 N の「!」（同じチャレンジに 10 分以上・レッスンの課題だけ） |
| `classroom-teacher-panel-lesson-summary` | div | レッスンの課題の 2 行目の数（#1603） |
| `classroom-teacher-panel-lesson-cleared` | span | 課題クリア N / 参加 N |
| `classroom-teacher-panel-lesson-stuck` | span | 止まっている N |
| `classroom-teacher-panel-seat-legend` | div | レッスンの課題の座席の色の凡例（空席・まだ・とちゅう・課題クリア ★・!）。項目は `classroom-teacher-panel-seat-legend-{kind}` |
| `classroom-teacher-panel-seat-color-legend` | div | ふつうの課題の座席の色の凡例（空席・参加済み・提出済み ✓・返却済み ↩）。座席のすぐ下。項目は `classroom-teacher-panel-seat-color-legend-{kind}` |
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
| `classroom-peer-panel-refresh` | button | 手動更新（一覧と画像 URL を取り直す。↻ の名前は「読み込み直す」） |
| `classroom-peer-panel-minimize` | button | 最小化 / 元に戻す |
| `classroom-peer-panel-close` | button | 閉じる |
| `classroom-peer-panel-body` | div | 本文（最小化中は無い） |
| `classroom-peer-panel-hint` | p | 「まねするのではなく、よいところを見つけて…」 |
| `classroom-peer-panel-count` | div | 提出: N 人（自分を除く） |
| `classroom-peer-panel-grid` | div | 座席ミニグリッド |
| `classroom-peer-panel-seat-<N>` | button | 座席 N。提出済みのクラスメイトだけ押せる（未提出・自分の席は disabled）。`data-seat-color` = `submitted` / `notSubmitted` |
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
| `classroom-kick-request-approve-{requestId}` | button | 承認（kick + リクエスト削除）。色はトースト・状況のパネルの［承認］と同じ濃いオレンジ（`$color-attention-action`）。確認を挟まずに退室させる |
| `classroom-kick-request-reject-{requestId}` | button | 却下（リクエストのみ削除）|

### お知らせセンター (先生)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-notifications-button` | button | ベル（クリックでパネル開閉） |
| `classroom-notifications-badge` | span | 未読数（10 以上は「9+」。未読 0 で非表示） |
| `classroom-notifications-panel` | div | 一覧パネル（先頭 5 件プレビュー） |
| `classroom-notifications-menu-button` | button | パネルヘッダー右の ⋮ |
| `classroom-notifications-menu` | div | ⋮ メニュー |
| `classroom-notifications-mark-all-read` | button | すべて既読にする（未読 0 で無効） |
| `classroom-notifications-open-all` | button | お知らせを開く（全件一覧ページへ） |
| `classroom-notification-item-{notificationId}` | button | パネル内のお知らせ 1 件（クリックでリンク先へ + パネルを閉じる） |
| `classroom-notification-unread-dot` | span | 未読ドット（未読アイテムのみ） |
| `classroom-notifications-empty` | div | お知らせ 0 件のとき |
| `classroom-notifications-page` | div | 全件一覧ページ（`teacher-notifications` フェーズ） |
| `classroom-breadcrumb-top` | button | お知らせの一覧ページのいまいる所の「クラス管理」（トップ = クラス一覧へ） |
| `classroom-notifications-back` | button | 左下の「戻る」（クラス一覧へ） |
| `classroom-notification-page-item-{notificationId}` | button | 一覧ページ内のお知らせ 1 件 |
| `classroom-notifications-pager` / `-prev` / `-next` | div / button | ページャ（10 件/ページ） |

### 「✕ ＋ 見出し」の行（先生・1 つの物を編集する画面）

課題詳細・課題を作成・課題を再利用・合言葉で取り込み・課題を共有・Google Classroom への共有・クラスの設定の本文の上に出る。1 画面に 1 つなので、どの画面も同じ testid。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-close-row` | div | 行（課題詳細では課題名の欄・参加コード・［課題を保存］も入る） |
| `classroom-close-row-close` | button | ✕（`aria-label` は行き先: 「課題一覧に戻る」「クラスに戻る」「クラス一覧に戻る」「課題に戻る」） |
| `classroom-close-row-title` | h2 | 見出し（課題詳細は見出しの代わりに課題名の欄 `classroom-detail-assignment-name`） |
| `classroom-close-row-discard-message` | p | 保存していない変更があるときに ✕ を押すと出る「変更を破棄しますか？保存していない変更は消えます。」 |
| `classroom-close-row-discard-cancel` | button | ［キャンセル］（とどまる） |
| `classroom-close-row-discard` | button | ［破棄］（変更を捨てて戻る・赤） |

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

スクリプトを書く際の落とし穴と対処は `tools/playwright-verify/README.md` を参照してください（ログインバイパスの方法、Redux store の取り出し方、tutorial overlay の dismiss 等）。

#### 生徒の参加から提出までの通し（stg・ブランチプレビュー）

生徒の画面（参加 → 番号 → はじめる → つくる → 提出・入り直し・共用の PC・使用中の番号）を、stg の API で先生 1・生徒 3 の通しで確かめるのが `tools/playwright-verify/verify-classroom-student-flow-e2e.mjs` です。

```bash
# 確かめるブランチのプレビュー（stg の API を見る）がブランチの先頭から作られていることを先に確かめる
git ls-remote origin refs/heads/<branch>          # PR の preview-deploy のコメント・CI の run と見比べる
cd tools/playwright-verify
BASE=https://preview.smalruby.app/<slug>/ node verify-classroom-student-flow-e2e.mjs
SKIP_IDLE=1 BASE=... node verify-classroom-student-flow-e2e.mjs   # 30 秒待つ確認を飛ばす
```

- 前提: `.env` の `DEV_BYPASS_TOKEN`（スクリプトが読み、ログに出さない）。headless・同梱の chromium で動く（Playwright MCP は使わない）。
- 見るもの: 各画面の帯の段・主ボタンが 1 つ・1300×600 でページとクラスの画面がスクロールしないこと、メニューバーの「提出する」→「提出済み ✓」→「返却済み ✓」、始め方の主ボタン（いまのまま・前回・スターター・レッスン）、前回の番号・30 秒の案内・退室依頼と承認、クラスから出る、出席番号がちがう、en / ja-Hira、スマホのドロワー。
- 片付け: 作ったクラス（「段2.5検証-」）と課題はアーカイブする。途中で落ちて残ったクラスも次の実行で片付く。
- 結果は `tmp/verify-classroom-student-flow-e2e/results.json`（手順ごとの PASS / FAIL と測った値）とスクショ。
- docs のスクリーンショット（0301〜0346 の生徒の画面）は API をスタブするスクリプトで撮る: `DOCS_SHOTS=1 node verify-classroom-viewport.mjs`（番号選び・参加完了・課題パネル・おかえりなさい）と `DOCS_SHOTS=1 node verify-classroom-menu-submit.mjs`（メニューバー・提出確認・提出できました・提出サムネイルの事前設定）。`BASE` にはプレビューの URL も使える。

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
