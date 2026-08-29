# 管理 SPA（Smalruby Admin）

> **🆕 Smalruby 独自** — upstream に存在しない、運営者向けの管理コンソール（EPIC #1073）。

`https://smalruby.app/admin/` で提供される、**エディタとは完全に別の SPA**。みんなの課題のモデレーション、全ユーザーのクラス・課題の管理（期限切れクラスの復元を含む）、バグ報告の閲覧を 1 画面に集約する。

基本的に単一運営者（管理者はシステム外で AWS を直接操作して登録）で使う前提の、最小・最強権限の面。

## 全体像

| 構成要素 | 場所 | 役割 |
|---|---|---|
| SPA | `packages/admin/` | 独立 React アプリ（scratch-gui とは別ビルド）。GitHub Pages の `destination_dir: admin` で `smalruby.app/admin/` に配信 |
| バックエンド | `infra/smalruby-admin/` | HTTP API v2 + Lambda + DynamoDB（`SmalrubyAdmins` 許可リスト）。`admin.api.smalruby.app`（stg は `stg.admin.api.smalruby.app`） |
| バグ報告（閲覧のみ） | 既存 `infra/smalruby-bug-report/` | Admin スタックは関与せず、SPA が既存 bug-report admin API の **read 系のみ**を直接呼ぶ |

### セクション（3 ドメイン）

1. **みんなの課題**（S3 #1083）: 通報キュー（多い順）/ 全投稿一覧 / **限定公開タブ**（推薦候補の母集団・#1110）/ 詳細（ページ・画像・クレジット）/ 非公開⇄再公開（2 段階確認・audit）/ **推薦する・推薦を取り消す**（#1110。2 段階確認・audit。推薦すると作成した先生のお知らせセンター #1111 に通知が届き、限定公開を全体公開に広げる動線につながる。取り消しは通知なし）
2. **クラス・課題**（S4 #1084 + 俯瞰ダッシュボード）: 3 タブ構成 — ①**俯瞰ダッシュボード**（作成の推移・内容の充実度・テーマ傾向 + みんなの課題の**有益候補**を見える化。候補行には**推奨済みバッジ**）②**クラス検索**（参加コード完全一致・名前部分一致 / 詳細 / アーカイブ切替）③**期限切れ復元**（ddb-archive スナップショットを削除時期・先生でファセット絞り込み → dry-run → 実行。EPIC #1049 の CLI の UI 後継）。クラス詳細には**先生へのお知らせ送信**（EPIC #1111）があり、タイトル + 本文を二段階確認で `POST /admin/notifications` へ送ると、その課題を作成した先生のクラス管理画面右上「お知らせ」🔔 に届く（宛先 teacherSub はサーバー側で classroomId から解決し SPA には出さない。書き込み先 `ClassroomNotifications` テーブルは名前規約 import + write-only grant で、この面が単一の書き手）。さらに**みんなの課題への共有推奨**（EPIC #1106）があり、二段階確認で `POST /admin/classrooms/{id}/recommend-sharing` を実行すると先生へお知らせ（`share_suggestion`）が届き、先生の課題詳細に「この課題、みんなの課題に共有しませんか？」バナーが出る（公開は CC BY 同意を伴う先生本人の共有フローのみ — 代理公開はしない。取り消しは通知なし・audit のみ）
3. **バグ報告**（S5 #1085 + 対応機能追加）: 既存バグ報告の一覧・状態フィルタ・詳細・添付 presigned DL に加え、**状態の変更と進捗コメント（開発者からの返信）**を既存 bug-report admin API の PATCH で行える（2 段階確認・終端ステータスは自動削除 TTL の警告つき。返信は報告者の「私の不具合報告」に表示され、非表示にしていた報告も再表示される — サーバー側の既存挙動）。詳細には**状態に応じた Claude 連携プロンプト**（`/bug-report` スキル向け・受付→Issue 化 / 改修 / 解決返信 / 再開）が表示され、ワンクリックでコピーして Claude Code に貼り付けられる

## 認証・認可モデル（要点）

- **admin 専用 Google OAuth Client ID**（エディタと共用しない・決定 B）。バグ報告 API へは同じトークンで到達できるよう、bug-report Lambda が `ADMIN_GOOGLE_CLIENT_ID` を追加 audience として受理する（決定 F。email レジストリのゲートは不変）
- **deny-by-default 許可リスト**: `SmalrubyAdmins` テーブル（PK: email、RETAIN）への存在照合のみ。登録は AWS コンソール手動操作が唯一の経路（アプリ内に管理者管理 UI は無い・F4）
- **sub 固定**: 初回ログインで Google `sub` を行に固定。以後 email 一致でも sub 不一致は 403（email 再利用防御）
- トークンは**モジュールメモリのみ**（localStorage に保存しない・N1）。リロード時は再ログイン
- **セッション切れ（約 1 時間）**: API が 401 を返すと全画面の再読み込みプロンプトを表示。表示中のセクションは **URL ハッシュ**（`#/classrooms` 等）に保持しているため、再読み込み → 再ログイン後に元のセクションへ復帰する（localStorage 不使用）
- すべての管理操作は `audit()` 構造化ログ（prod の CloudWatch 保持は **1 年**）
- バグ報告の閲覧・対応は bug-report 側の既存レジストリ `BugReportAdmins`（email）で認可される（両方への登録が必要）

詳細な登録手順・監査ログ検索・デプロイ手順は [operations.md](operations.md)。

## 主要ファイル

### packages/admin（SPA）

| ファイル | 役割 |
|---|---|
| `src/components/app.jsx` | ルート（Google Sign-In → `/admin/me` 認可プローブ → セクションナビ + 各ビュー） |
| `src/components/shared-assignments-view.jsx` | みんなの課題モデレーション |
| `src/components/classrooms-view.jsx` | クラス・課題管理 + 期限切れ復元 |
| `src/components/bug-reports-view.jsx` | バグ報告閲覧（read-only） |
| `src/lib/admin-api.js` | admin API クライアント（トークンはモジュールメモリ） |
| `src/lib/bug-report-api.js` | bug-report API クライアント（一覧・詳細 + 状態/返信の PATCH。既存 API のみ使用） |
| `src/lib/bug-report-prompts.js` | 状態別の Claude 連携プロンプト生成（`/bug-report` スキルにワンクリックコピーで渡す） |
| `src/lib/google-auth.js` | GIS ロード + `?devlogin=` バイパス（stg のみ） |
| `webpack.config.js` | 独立ビルド（publicPath `/admin/`、port 8602、DefinePlugin で endpoint 埋め込み） |

### infra/smalruby-admin

| ファイル | 役割 |
|---|---|
| `lambda/handler.ts` | 認証（aud 検証）→ 認可（許可リスト + sub 固定）→ 各ドメインのハンドラ + `audit()` |
| `lambda/restore-plan.ts` | 復元プランの純関数（classroom の `restore-lib.ts` と意図的に複製。形式変更時は両方を同期） |
| `lib/admin-stack.ts` | SmalrubyAdmins（RETAIN）、Lambda、HTTP API、カスタムドメイン。classroom / shared のテーブル・バケットは**名前規約で import して grant**（classroom スタック不変・N2） |

## 設定

| 変数 | 場所 | 説明 |
|---|---|---|
| `ADMIN_GOOGLE_CLIENT_ID` | `infra/smalruby-admin/.env.*`・`infra/smalruby-bug-report/.env.*`・repo Variables | admin 専用 OAuth Client ID。**prod の admin スタックは未設定だとデプロイが落ちる** |
| `ADMIN_API_ENDPOINT` | repo Variables（CI ビルド埋め込み） | 例 `https://admin.api.smalruby.app` |
| `BUG_REPORT_API_ENDPOINT` | root `.env` / repo Variables | 既存バグ報告 API |
| `DEV_BYPASS_TOKEN` | `.env.stg` のみ | 自動テスト用（prod 設定は throw） |

## ローカル開発・E2E

```bash
# SPA dev server（8602）。webpack は dotenv を読まないので env を明示
cd packages/admin
ADMIN_API_ENDPOINT=https://stg.admin.api.smalruby.app \
BUG_REPORT_API_ENDPOINT=https://stg.bug-report.api.smalruby.app \
npm start

# E2E（stg API・dev bypass。tools/playwright-verify/README.md 参照）
cd tools/playwright-verify && node verify-admin.mjs
```

- `http://localhost:8602/admin/?devlogin=<DEV_BYPASS_TOKEN>` で stg ログインをバイパス（バイパス identity `dev-admin@example.com` の allowlist 登録が前提）
- ユニットテスト: `cd packages/admin && npm test`（eslint + jest）/ `cd infra/smalruby-admin && npm test`

## スクリーンショット

| ファイル | 内容 |
|---|---|
| `screenshots/0101-login.png` | ログイン画面（Google Sign-In） |
| `screenshots/0102-shared-queue.png` | みんなの課題: 通報キュー |
| `screenshots/0103-classrooms.png` | クラス・課題: 検索一覧 |
| `screenshots/0104-restore-plan.png` | 期限切れ復元: dry-run プラン |
| `screenshots/0105-bug-reports.png` | バグ報告: 閲覧一覧 |
| `screenshots/0106-classroom-notify.png` | クラス詳細: 先生へのお知らせ送信（EPIC #1111） |
| `screenshots/0107-shared-recommend.png` | みんなの課題: 限定公開の詳細と推薦の確認（EPIC #1110） |
| `screenshots/0108-recommend-sharing.png` | クラス詳細: 共有推奨の確認（EPIC #1106） |
