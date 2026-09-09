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
