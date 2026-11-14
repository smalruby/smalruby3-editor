# Playwright 手動検証スクリプト

機能の end-to-end 動作確認を Playwright で自動化したスクリプト群です。CI には組み込まれていません（手動で `node <script>.mjs` で実行）。複数タブ間の連動 (Mesh v2 ↔ クラス管理など) のように unit / integration テストでは網羅しづらい挙動を、ローカルでサッと回すための場所です。

## 前提

1. **dev server が起動中**: `docker compose up -d app` で http://localhost:8601 が応答する状態
2. **`.env` の `DEV_BYPASS_TOKEN`**: 教師の Google ログインをバイパスするためのトークンが設定されている（stg / ローカル前提）
3. **このディレクトリで `npm install`** 済み（最初の 1 回のみ）

```bash
cd tools/playwright-verify
npm install            # 初回のみ
npx playwright install chromium   # 初回のみ（OS の Playwright cache が無い場合）
```

## 実行

```bash
node <script>.mjs
```

ヘッドフルブラウザが 2 つ立ち上がります。スクリプトは Redux store / DOM testid の両方を経由して状態を確認し、最後にスクリーンショットを `.screenshots/` に保存します。

ブラウザプロファイルは `.profiles/teacher` `.profiles/student` に永続化されます (両方 gitignore 済み)。永続化されているのは Chromium の cookie / cache / IndexedDB のみ — 教師 idToken は in-memory なのでリロード/再起動で再ログインが必要です。プロファイルをリセットしたい場合:

```bash
rm -rf .profiles
```

## 目視確認（ホストの Chrome で見ながら動かす）

devpod コンテナは画面を持たない（`DISPLAY` 未設定）ので、コンテナ内で `headless:false`
にしてもウィンドウは出ない。**ブラウザはホスト（Mac）側で開き、dev サーバはコンテナで動かす**
構成にする。`/app` はホストのバインドマウントなので、ここのスクリプトはそのままホストにもある。

前提:
- dev サーバはコンテナ内で起動（`set -a; . ./.env; set +a; SMALRUBY3_HOST=0.0.0.0 PORT=8601 npm start`）
- `devcontainer.json` の `forwardPorts: [8601]` により **ホストから `localhost:8601` に到達可能**
  （普段ホストのブラウザでエディタを見ているのと同じ経路）

ホスト（Mac）側で実行:

```bash
cd <repo>/tools/playwright-verify
# 初回のみ: ホスト用のブラウザを用意（どちらか）
#   a) 既存の Google Chrome を使う → 追加インストール不要（CHANNEL=chrome）
#   b) Playwright 同梱 Chromium を使う → npx playwright install chromium

# 目視モードで実行（実 Chrome ウィンドウが開く・ゆっくり動く・最後まで開いたまま）
HEADLESS=false CHANNEL=chrome SLOWMO=300 KEEP_OPEN=1 node smoke-teacher-dashboard.mjs
```

同じスクリプトをコンテナ内では `node smoke-teacher-dashboard.mjs`（headless 既定）で回せる。
env トグル: `HEADLESS=false` 表示 / `CHANNEL=chrome` 実 Chrome / `SLOWMO=<ms>` 低速 /
`KEEP_OPEN=1` 終了後も開いたまま / `BASE_URL=...` 接続先上書き。

> メモ: ホスト node が Linux 用に入った `node_modules` を読んで不具合が出たら、ホストで
> `npm install` し直す（playwright 本体は JS なので通常はそのまま動く。ブラウザバイナリは OS 別キャッシュ）。

## スクリプト一覧

| ファイル | 検証対象 |
|---|---|
| `verify-issue-1167-ime-enter.mjs` | IME 変換確定の Enter でブロックの入力欄が閉じる問題（#1167）。dev server のみ前提（stg 不要）。VM 経由で `( ) と ( ) 秒言う` をワークスペースに置き、文字フィールドのエディタを開いて `isComposing: true` の Enter / Escape を dispatch → エディタが残ること、通常の Enter では閉じることを検証。`PORT=8611` で別ポートの dev server を指定可。**本物の IME は再現できない**ので実機（Chrome + 日本語 IME）確認は人間が行う |
| `verify-issue-1149-google-signin-cleanup.mjs` | Google サインインボタンの後片付け（#1149）。GIS を route interception で**スタブ**するので Google セッション不要（dev server 8601 のみ前提）。クラス管理のログイン画面でボタンがモーダル内スロットに描画され body 直下の固定オーバーレイが生えないこと、連打しても増えないこと、モーダルを閉じる/ログイン完了で消え One Tap が cancel されることを検証 |
| `verify-notification-center.mjs` | お知らせセンター（EPIC #1111）。classroom API を route interception で**スタブ**するので stg 不要（dev server 8601 のみ前提）。教師モーダル右上 🔔 + 未読バッジ → パネル開で mark-read が飛びバッジが消える → 未読ドット 1 個 → アイテムクリックでパネルが閉じる |
| `verify-shared-recommendation.mjs` | Admin 推薦 → 全体公開への発展（EPIC #1110）。同じくスタブ式で stg 不要。推薦通知（`link.kind='shared-mine'`）クリック → 自分の投稿へジャンプ → 限定公開/推薦バッジ → 「みんなの課題に公開する」フォーム（初期値・CC BY 同意必須）→ PATCH `visibility='public'` の payload まで検証 |
| `verify-share-suggestion.mjs` | 共有推奨（EPIC #1106）。同じくスタブ式で stg 不要。share_suggestion 通知クリック → 課題詳細へジャンプ → 「共有しませんか？」バナー → CTA でボードの共有ステップが開く → ボード行の「共有おすすめ」マーク |
| `verify-teacher-kick-toast.mjs` | 先生への退室依頼の通知（#1200）。stg に #1200 の API（`GET /kick-requests/pending`）が必要（PR に `deploy-stg`）。dev server は stg の classroom API を向けて起動する（**プレビュー URL は本番 API を見るので、本番デプロイ前は確認できない**）。先生（`?devlogin=`）がクラス + 課題を作ってモーダルを閉じる → 生徒 A が席 1 に着席 → 生徒 B が席 1 に退室依頼 → 先生のメイン画面に**トースト**と先生メニューの「!」→ トーストで承認 → 生徒 B が席 1 に自動で参加。ビューポートは授業 PC の 1300×600。前の実行で残った検証用の依頼はトーストの「却下」で片付ける。`TRACE=1` で先生タブの `kick-requests` の通信を出す。スクショは `tmp/verify-teacher-kick-toast/` |
| `verify-continue-from-submission.mjs` | 提出物から続ける（EPIC #1195 課題 C）の通し。stg の classroom API（`continuable-submissions`）が必要（dev server は stg を向けて起動。**プレビュー URL は本番 API を見る**）。参加しただけでは何も読み込まず、押したときだけ 1 回読み込み上書き確認も出ないことを各場面で確認する。先生がクラス + 課題1 → 生徒(席1)が目印のスプライト名で提出 → おかえりなさいの「作品を読み込み直す」→「この課題で出した作品から続ける」→ 課題2（スターターあり）で席1にスターター / 前回 / いまのまま、席2にスターター / いまのまま が出て、押したものが読み込まれる。生徒は 1300×600。スクショは `tmp/verify-continue-from-submission/` |
| `verify-classroom-mesh-connect.mjs` | クラスで読み込んだメッシュ作品の接続モーダル自動表示 (#1251)。stg の classroom API が必要。先生がメッシュのブロックを使うスターターの課題を作る → 生徒(席1)が「スターターから始める」でクラスのモーダルが閉じて接続モーダル（ドメイン=参加コード）が開く・閉じても再表示しない → おかえりなさいの「作品を読み込み直す」→ スターターでもクラスの画面が閉じてから開く → 上書き確認キャンセルでは出ない → メッシュなしのスターター（席2）では出ない。1300×600。スクショは `tmp/verify-classroom-mesh-connect/` |
| `verify-mesh-v2-seat-connect.mjs` | メッシュの「出席番号でつながる」(#1258)。stg の classroom / mesh API が必要。先生が 5 人のクラスを作る → 生徒(席1・2・4)が参加し席3 は欠席 → 席2 が 1・2・3番を選ぶと「ホストの 1番さんを待っています」→ 席1 がホストとして作ると席2 が自動で入り、3番は「欠席のため待ちません」で両方「そろいました」→ 自動で閉じる → 席4 は従来の 2 つがたたまれていることを確かめ、「従来の方法でつなぐ」を開いて「メッシュに参加する」で同じグループに入る → 接続済み画面の「そろい具合」。各画面が 600px に収まるかも見る。1300×600。スクショは `tmp/verify-mesh-v2-seat-connect/`（`SAVE_DOCS=1` で `docs/mesh-v2/screenshots/0103〜0108・0110` も撮り直す） |
| `verify-classroom-session-alerts.mjs` | 生徒の「セッションが無効になりました」アラートが不要な場面で出ず、必要な場面では出るか。stg の classroom API が必要（dev server は stg を向けて起動）。先生がクラス + 課題A・B → 生徒が A に URL で参加 → 同じブラウザで B の URL（切り替え）→ B に参加 → 同じ B の URL → 普通に開き直して「クラス」→ セッションを壊して B の URL（座席選択に戻るだけ）→ セッションを壊して URL なしで「クラス」（ここだけアラートが出る）。スクショは `tmp/verify-classroom-session-alerts/` |
| `verify-teacher-status-panel.mjs` | 先生の「いまの課題の状況」フローティングパネル（#1203）。classroom API は `page.route` のスタブなので stg 不要（`.env` の `CLASSROOM_API_ENDPOINT` だけ使う）。1300×600 で 40 席・退室依頼 3 件の状態がビューポート内に収まる / パネル表示中にブロックをワークスペースへドラッグできる / ヘッダーのドラッグで位置を記憶 / 最小化・元に戻す / 承認で approve API が呼ばれ一覧から消える / 閉じる。`BASE_URL` で dev server を指定。スクショは `tmp/verify-teacher-status-panel/` |
| `verify-teacher-panel-reauth.mjs` | 「いまの課題の状況」パネルのログイン期限切れ（#1250）。classroom API はスタブで、`expired.token.stub` に 401 を返す。`window.smalruby.forceTeacherPanel401()` + ↻ で期限切れの文言と「再認証する」リンクが出る / 1300×600 に収まる / 期限切れの間は 401 のポーリングを撃たない / 再認証に失敗（`?devlogin=`）でクラス管理が開く / クラス管理を閉じると取り直してエラーが消える。成功する再認証（プロバイダの確認）は headless で通らないので unit テストで確認。スクショは `tmp/verify-teacher-panel-reauth/` |
| `verify-classroom-viewport.mjs` | 授業 PC の画面サイズ 1300×600 に「クラス」の画面が収まるか（#1221）。classroom API は `page.route` のスタブなので stg 不要（dev server のみ前提・`BASE` で URL を指定、既定 `http://localhost:8601`）。生徒は一番長い状態（40 席・kick されたバナー + 退室依頼の待機中 + エラー、却下 + 30 秒後の強調、退室依頼ダイアログ、長いクラス名・課題名・コメント、おかえりなさい（「作品を読み込み直す」を開いた状態・「クラスから出る」の確認）、提出確認、メニューバー）、先生はメニュー・クラス一覧・課題詳細（説明 / メンバー 40 席）・メンバー詳細を開き、モーダルの外形がビューポート内か・本文と `document.scrollingElement` が `scrollHeight <= clientHeight` かを一覧で出す（先生は本文内のスクロールを許容）。1 つでも超えたら exit 1。`VIEWPORT=WxH` でサイズ変更、`SKIP_IDLE=1` で 30 秒待ちの画面を省略、`DOCS_SHOTS=1` で `docs/classroom/screenshots/` を撮り直す。スクショは `tmp/` 配下。**後続の Issue の DoD でも走らせる** |
| `verify-classroom-menu-submit.mjs` | メニューバーの「提出する」（#1795）。参加中のメニューバー（1300×600・iPad 横/縦・iPad mini）とスマホのドロワー（844×390・667×375・740×360。44×44px 以上・サイドレールがはみ出さない）で、「提出する」/「提出済み ✓」/「返却済み ✓」が 3 言語で画面内に収まり、ほかの項目と重ならず、ページがはみ出さないかを測る。続けて 1300×600 で 提出確認 → 「提出できました ✓」→ メニューバーが「提出済み ✓」、「やめる」で閉じる、提出済み・返却済みからの再提出、verify-session が遅いときに「提出中...」も見出しも出さず確かめたあとに正しい確認になること、送信中は Escape・外で閉じずメニューバーも押せず提出が 1 回だけのこと、スマホのドロワーから提出確認が開くこと、作品を提出しないレッスンの課題で出ないこと、を確かめる。classroom API は `page.route` のスタブ（dev server のみ前提・`BASE` で URL を指定）。`DOCS_SHOTS=1` で `docs/classroom/screenshots/` の 0103・0306・0340〜0344 と、提出サムネイルの事前設定の 0310〜0313 を撮り直す |
| `verify-class-ai-settings-viewport.mjs` | 先生のクラス設定「このクラスで使う AI」が 1300×600 でスクロールせずに収まるか（#1439・R6）。AI なし / 生成AI だけ / ルビティーだけ / 両方（＋「その他」・未確認のルビティー）で開き、本文 `[data-testid="classroom-teacher-modal"] main` の `scrollHeight / clientHeight` と［保存］`[data-testid="classroom-class-settings-save"]` の `getBoundingClientRect().bottom` を一覧で出す。1 つでも超えたら exit 1。classroom API は `page.route` のスタブ（dev server のみ前提・`BASE`）。`DOCS_SHOTS=1` で `docs/classroom/screenshots/0230` / `0231` / `0232` / `0242` / `0243` を撮り直す |
| `verify-classroom-grading.mjs` | 先生の採点の画面（#1304）を 1300×600 で手順ごと（読み込む前 → 40 席を読み込んだ → AIで採点 → コメントを下書き、説明の「詳しく」・採点の設定・「書き出し ▾」を開いた状態）に開き、いまの手順のボタン（`aria-current="step"`）が正しいか・その下端が 600 以下か・画面とページがスクロールしないか（表の枠の中は可）を一覧で出す。API はスタブ（dev server のみ前提・`BASE`）。1 つでも外れたら exit 1。`DOCS_SHOTS=1` で `docs/classroom/screenshots/0233〜0238` を撮り直す。`BEFORE=1` は直す前の画面を撮るだけ |
| `verify-classroom-board-classwork.mjs` | クラスの画面の［ストリーム］［授業］タブ（#1301・#1302）を 1300×600 で確かめる。classroom API は `page.route` のスタブ（dev server のみ前提・`BASE` で URL 指定）。［＋ 作成 ▾］の下端・ページと本文がスクロールしないこと・課題の一覧の枠だけがスクロールすること、作成メニューの項目、トピックを追加の画面、行を開いたとき（保存期限 7 日以内は赤・それより先は灰色）、［ストリーム］が最初に開くこと・行の並び（自動削除の予定が先頭・ほかは新しい順）・ページと本文がスクロールしないこと・行を押すと［授業］でその課題（アーカイブ済みは［元に戻す］の行）へ行くことを見る。`DOCS_SHOTS=1` で `docs/classroom/screenshots/`（0211 / 0213 / 0224 / 0225 / 0226）を撮り直す。スクショは `tmp/` 配下 |
| `verify-classroom-assignment-detail.mjs` | 課題詳細（［メンバー］［説明］）と「課題を作成」（#1303）を 1300×600 で確かめる。classroom API は `page.route` のスタブ（dev server のみ前提・`BASE` で URL 指定）。各画面の主ボタン（［作成］・「…」・［課題を保存］）の下端と、ページ・本文（`[data-testid="classroom-teacher-modal"] main`）がスクロールしないこと、作成画面にメッシュの人数が無いこと、保存期限が 7 日以内だけ赤いこと、「詳しい設定」を開いても［課題を保存］が見えること、空の説明のプレビューを見る。`DOCS_SHOTS=1` で `docs/classroom/screenshots/`（0204 / 0212 / 0214 / 0226 / 0227 / 0228 / 0233）を撮り直す。`PREFIX` で `tmp/` のスクショ名を変える |
| `verify-classroom-lesson-settings.mjs` | 課題の説明タブの「レッスン」欄（EPIC #1592）を 1300×600 で確かめる。classroom API は `page.route` のスタブ（dev server のみ前提・`BASE` で URL 指定）。コース・レッスン・チャレンジ・★・完了の条件（生徒に出る文）・作品の提出・レッスンの点を選び、PUT の `lesson`、「保存していません」、外したチャレンジの注意（注意が出た状態でもパネルが切れないこと）、数の欄が打っている途中で直されないこと、このスモウルビーに無いコースの警告（変えなければ `lesson` を送らない）を見る。［課題を保存］の下端と、ページ・本文（`[data-testid="classroom-teacher-modal"] main`）がスクロールせず、チャレンジの一覧の枠だけがスクロールすることを測る。`DOCS_SHOTS=1` で `docs/classroom/screenshots/`（0244 / 0245 / 0246）を撮る |
| `verify-classroom-lesson-create.mjs` | ［＋ 作成 ▾］→「レッスン」とページのレッスンの説明文を 1300×600 で確かめる（classroom API は `page.route` のスタブ・`BASE` で URL 指定）。メニューの並び（「課題」のすぐ下）、作るとすぐ課題が開いてレッスン欄が開き最初のレッスンが選ばれること、空のページに説明文が入りレッスンに追従すること、先生が書いたページは閉じたときにページ内で上書きを聞くこと（`confirm()` を出さない・［いいえ］/［はい］）、PUT の `lesson` と `pages`、［課題を保存］の下端と本文がスクロールしないことを測る。`DOCS_SHOTS=1` で `docs/classroom/screenshots/`（0224 / 0256 / 0257）を撮る |
| `verify-classroom-lesson-progress.mjs` | 先生の進み具合（EPIC #1592）を 1300×600 で確かめる。classroom API は `page.route` のスタブ（dev server のみ前提・`BASE` で URL 指定）。メンバータブの座席の色（まだ・とちゅう・課題クリア・未参加）・できた数（条件で止める）・「!」・「クリア N / 参加 N」、「進み具合」タブの表（見出しと「できた人」の行が固定・表の枠だけがスクロール）・並べ方・「…」の CSV・席を押すとメンバーの詳細を見る。ページ・本文（`[data-testid="classroom-teacher-modal"] main`）がスクロールせず、座席グリッド / 表の枠（`[data-testid="classroom-lesson-progress-frame"]`）だけがスクロールすることを測る。`DOCS_SHOTS=1` で `docs/classroom/screenshots/`（0247 / 0248）を撮る |
| `verify-classroom-lesson-teacher.mjs` | 先生のほかの画面のレッスンの部分（EPIC #1592）を 1300×600 で確かめる。classroom API は `page.route` のスタブ（dev server のみ前提・`BASE` で URL 指定）。「いまの課題の状況」パネル（40 席・11 チャレンジの横棒・課題クリア・止まっている・「!」がパネルの中でスクロールせず画面に収まる）、［授業］の行（「レッスン」の印・「課題クリア N」）、席の詳細（チャレンジごとの行。一覧の枠だけがスクロールし［返却］が見える）、採点（「レッスン」の列・手順のボタンが見える）。`DOCS_SHOTS=1` で `docs/classroom/screenshots/`（0249 / 0250 / 0251）を撮る |
| `verify-classroom-lesson-scoring.mjs` | 採点の画面のレッスンの点（#1778）を 1300×600 で確かめる。classroom API は `page.route` のスタブ（dev server のみ前提・`BASE` で URL 指定）。作品を出さないレッスンの課題だけを選ぶと AI を使わない 3 つの手順になること、条件 6・必須 6 で必須 6 つが 100 点になること、必須の点を変えると説明のページとはじめのプロジェクトを付けて保存し表の点がすぐ変わること、手順のボタンが見えてページがスクロールしないこと。`DOCS_SHOTS=1` で `docs/classroom/screenshots/0252` を撮る |
| `verify-lessons-stage2-e2e.mjs` | 段 2（クラスの課題とレッスン・EPIC #1592）の通し。**stg の classroom API を使う**（ブランチプレビューの URL を `BASE` に渡す。`.env` の `DEV_BYPASS_TOKEN` で先生にログイン）。先生がクラス + 課題 2 つ（レッスンだけ／作品も提出する）を作り、説明タブでコース・チャレンジ・★・「n つ」・作品の提出を選んで保存 → 生徒 A（端末に前の記録あり →「わたしの記録です」で `before` を送る →「はじめる」→ 課題のチャレンジだけのレッスン表と帯 →「押したら話そう」を UI で解く → 課題クリア！ → メニューバーの ✓）・生徒 B（「ちがう」→ 2 つめの確認 →「消す」→ 1 つできた・1/2・★ あと 1）・生徒 C（作品も提出する課題 → 課題クリア！ →［課題を提出する］→ ✓ + 提出の印、ja-Hira / en の画面）→ 先生の座席の色・「クリア N / 参加 N」・「進み具合」タブ・席の詳細・進み具合 CSV・`提出状況.csv`・パネル・［授業］の行・採点のレッスンの列（85 / 15 点）と en / ja-Hira の進み具合タブ。1300×600 で生徒の画面がスクロールしないこと・先生の画面の R6 を測る。最後に作った課題とクラス（と前に失敗した実行で残った「段2検証-」のクラス）をアーカイブする。結果は `tmp/verify-lessons-stage2-e2e/results.json`、スクショと CSV も同じ所 |
| `verify-classroom-student-flow-e2e.mjs` | 段 2.5（生徒の参加から提出まで・EPIC #1790）の通し。**stg の classroom API を使う**（ブランチプレビューの URL を `BASE` に渡す。`.env` の `DEV_BYPASS_TOKEN` で先生にログイン）。先生 1・生徒 3 + 言語・スマホの確認用の生徒を別々のコンテキストで動かす（ブラウザは 1 つ）。課題 1: 参加 → 番号 → はじめる → つくる → メニューバーの「提出する」→ 提出できました ✓ → 提出済み ✓ → 再提出 → 先生が返却 → 入り直し（おかえりなさい・返却済み ✓・先生のコメント）。課題 2（スターターあり）: 前回の番号が光る（自動では選ばない）・前回の作品から続ける / スターターから始める・作品を読み込み直す（この課題・前回・スターター）・クラスから出る（確認・Esc・やめる）・共用の PC で別の生徒・出席番号がちがう（空けた番号を忘れる・空席に戻る）。課題 3（前回から ON）: 前回の番号が使用中ならすぐ案内 → 退室依頼 → 先生がトーストで承認 → その席で自動参加、30 秒たつと案内の枠と光る使用中の席、先生のおすすめ / 見つかりませんでした のお知らせ。課題 4（レッスン）: 「はじめる」でレッスン表・条件を満たすまで「提出する」が出ない。en / ja-Hira の番号 → 参加完了 → 提出確認 → 提出できました、スマホ（667×375）のドロワーの「提出する」も見る。帯の段・主ボタンが 1 つ・1300×600 でスクロールしないことを各画面で測る。最後に作った課題とクラス（と前に失敗した実行で残った「段2.5検証-」のクラス）をアーカイブする。`SKIP_IDLE=1` で 30 秒待ちを飛ばす。結果は `tmp/verify-classroom-student-flow-e2e/results.json`、スクショも同じ所 |
| `verify-classroom-status-icons.mjs` | 着席・提出などの状態アイコン（#1196）。スタブ式で stg 不要。先生メンバーグリッドの凡例 + セルの着席系/提出系/退室依頼アイコン、メンバー詳細、生徒の座席選択の「使用中」、メニューバーの提出状態を確認。`DOCS_SHOTS=1` で `docs/classroom/screenshots/` の 0103/0205/0206/0302 を撮り直す |
| `verify-assignment-sharing.mjs` | みんなの課題（EPIC #1066）の通し。クラス+課題作成→説明ページ保存→共有フォーム（CC BY 同意）→カタログ絞り込み→詳細（© クレジット・外部リンク確認 D4）→このクラスに取り込み→ボードに新行→自分の投稿で取り下げ/再公開。stg に S1 API（#1068）が必要。`LOCALE=ja-JP` で日本語スクリーンショット |
| `verify-admin.mjs` | 管理 SPA（EPIC #1073）の通し。stg API への `/admin/me` プリフライト（403 = allowlist 未登録を明示）→ 8602 の SPA dev server を自前起動（`REUSE_SERVER=1` で再利用）→ ログインゲート → `?devlogin=` バイパス → みんなの課題キュー → 課題検索 + 期限切れ復元タブ → バグ報告一覧（詳細に書き込み UI が無いこと）。前提: AdminStack-stg デプロイ + `SmalrubyAdmins-stg` に `dev-admin@example.com` 登録（docs/admin/operations.md） |
| `verify-classroom-archive-recovery.mjs` | アーカイブ復旧（EPIC #1049）の通し。クラス+課題作成→保存期限バッジ（`あと{days}日`）→課題詳細の期限バナー+全作品DL CTA→クラス全体一括DL（zip 名 `_全課題.zip`）→課題アーカイブ（確認文言が「アーカイブ」であること）→（S1 API デプロイ後）アーカイブ済み課題の復元→クラスの 2 段階アーカイブ確認→アーカイブ済みクラス一覧→復元。`LOCALE=ja-JP` で日本語スクリーンショット（docs 用） |
| `mesh-v2-classroom-binding.mjs` | クラス管理と Mesh v2 ドメインの連動。教師タブでクラス作成→サイドバーで選択、生徒タブで `?classcode=` 経由参加し、両方の `state.scratchGui.meshV2.domain` が参加コードに揃うこと、接続モーダル入力欄が disabled になること、解除時に元のドメインに戻ることをチェック |
| `verify-lesson-support-phase3.mjs` | AI 評価（EPIC #974 Phase 3）の通し。生徒提出→評価画面で読み込み（ブラウザ内 sb3 解析）→AI評価実行（実 Claude via stg）→根拠付き S/A/B/C→コメント下書き→返却→生徒側で表示確認。ポート・CORS の注意は phase1 と同じ |
| `verify-lesson-support-phase2.mjs` | 組（EPIC #974 Phase 2）の UI 通し。組作成→サイドバー階層→クラスの組割当→授業複製（のコピー）→アーカイブでクラス名グルーピングへフォールバック。ポート・CORS の注意は phase1 と同じ |
| `verify-lesson-support-phase1.mjs` | 課題配信（EPIC #974 Phase 1）の通し。教師: クラス作成→課題エディタで2ページ+スターター（今開いているプロジェクト）を保存。生徒: `?classcode=` 参加→課題パネル自動表示→ページ送り→スターターボタン→「はじめる！」→ステータスの「課題を見る」で再表示。8601 以外のポートで動かすときは `DISABLE_WEB_SECURITY=1`（stg の CORS が localhost:8601 のみ許可のため） |

## 自動化のキー知見

スクリプトを書く / 拡張するときの留意点。失敗を踏み抜いた後の蓄積です。

### ログインバイパス

`?devlogin=<DEV_BYPASS_TOKEN>` を URL に付けると教師として自動ログインしてダッシュボードまで到達します（`.env` の `DEV_BYPASS_TOKEN` を使用）。Google OAuth 待ちが不要になり、CI 化の道筋ができます。

### Redux store の取り出し

`window.smalruby` は Ruby タブを訪れた後にしか存在しません。Redux store が必要なら React 18 の Fiber Tree から `memoizedProps.store` または `memoizedProps.value.store` を探すヘルパーを使います（各スクリプトの `findStore()` 参照）。掘り出した store は `window.__store` に貼って後続 evaluate で使い回します。

### data-testid の落とし穴

- **`classroom-phase-teacher-dashboard`**: ダッシュボードフェーズの testid は `components/classroom-teacher-modal/classroom-teacher-modal.jsx` のデフォルト分岐に付けた（旧コードでは login と google-courses 以外に testid が無く、フェーズ検知できなかった）
- **サイドバー項目**: `classroom-sidebar-item-{classroomId}` （`classroom-item-*` ではない）。表示テキストは `assignmentName · 人数 · 参加コード(小文字)`
- **クラス作成**: `classroom-name-input` / `classroom-count-input` / `classroom-assignment-name-input` の **3 つすべて** 必須。1 つでも空だと `classroom-create-submit` は disabled
- **作成後の遷移**: `classroom-create-submit` 押下 → `phase==='teacher-dashboard'` に戻る（自動で詳細画面に遷移しない）。新クラスはサイドバーに追加されるが selectedClassroom は null のまま — テストで `teacherSelection` を埋めたいなら明示的にサイドバー項目をクリック

### 状態の見方

- `state.scratchGui.classroom.role`: student のみ。teacher ログイン中でも null
- `state.scratchGui.classroom.joinCode`: 学生セッションの参加コード
- `state.scratchGui.classroom.teacherSelection.joinCode`: 教師がサイドバーで選んだクラスの参加コード
- `state.scratchGui.meshV2.domain`: Mesh v2 ドメイン（バインディングは小文字化した joinCode を入れる）

### よくある失敗

- **「同じ assignmentName を 2 度使うと前回のクラスが選ばれてしまう」**: `Date.now()` でユニーク化する
- **「全席 taken でテストが進まない」**: 同じクラスに既に上限まで参加している。新規クラスを作成するか、空席を `:not([disabled])` で動的に選ぶ
- **「modal が閉じる」**: persistent context は同じプロファイルを使い回すので、前回のテストで残った state が悪さする場合がある。`rm -rf .profiles` してやり直す

## v2 フロー前提（クラス→課題モデル）

先生ログイン後の landing は **クラス一覧**（`classroom-phase-teacher-class-list`）。各スクリプトは「クラスを作る」（クラス + 最初の課題の同時作成フォーム `classroom-class-create-*`）でセットアップし、クラス内の課題ボード（`classroom-board`）から課題をひらく。旧フロー（サイドバーの `classroom-create` から作成）は存在しない。
