# 管理 SPA（Smalruby Admin）

> **🆕 Smalruby 独自** — upstream に存在しない、運営者向けの管理コンソール（EPIC #1073）。

`https://smalruby.app/admin/` で提供される、**エディタとは完全に別の SPA**。みんなの課題のモデレーション、全ユーザーの課題の管理（期限切れ課題の復元を含む）、バグ報告の閲覧を 1 画面に集約する。

基本的に単一運営者（管理者はシステム外で AWS を直接操作して登録）で使う前提の、最小・最強権限の面。

## 全体像

| 構成要素 | 場所 | 役割 |
|---|---|---|
| SPA | `packages/admin/` | 独立 React アプリ（scratch-gui とは別ビルド）。GitHub Pages の `destination_dir: admin` で `smalruby.app/admin/` に配信 |
| バックエンド | `infra/smalruby-admin/` | HTTP API v2 + Lambda + DynamoDB（`SmalrubyAdmins` 許可リスト）。`admin.api.smalruby.app`（stg は `stg.admin.api.smalruby.app`） |
| バグ報告（閲覧のみ） | 既存 `infra/smalruby-bug-report/` | Admin スタックは関与せず、SPA が既存 bug-report admin API の **read 系のみ**を直接呼ぶ |

### セクション（3 ドメイン）

1. **みんなの課題**（S3 #1083）: 通報キュー（多い順）/ 全投稿一覧 / **限定公開タブ**（推薦候補の母集団・#1110）/ 詳細（ページ・画像・クレジット）/ 非公開⇄再公開（2 段階確認・audit）/ **推薦する・推薦を取り消す**（#1110。2 段階確認・audit。推薦すると作成した先生のお知らせセンター #1111 に通知が届き、限定公開を全体公開に広げる動線につながる。取り消しは通知なし）
2. **クラス・課題**（S4 #1084 + 俯瞰ダッシュボード）: 4 タブ構成 — ①**俯瞰ダッシュボード**（作成の推移・内容の充実度・テーマ傾向 + みんなの課題の**有益候補**を見える化。候補行には**推奨済みバッジ**）②**課題検索**（参加コード完全一致・名前部分一致 / 詳細 / アーカイブ切替。対象は課題のみで、親のクラス（学級）は変わらない。親クラスがアーカイブ中の課題には「先生には表示されません」警告が出る — 下記「課題が `active` でも先生に見えているとは限らない」）③**クラス（学級）検索**（クラス名・年度・組・中の課題名で検索 → 詳細 → アーカイブ解除。下記「クラス（学級）検索・アーカイブ解除」）④**期限切れ復元**（ddb-archive スナップショットを削除時期・先生でファセット絞り込み → dry-run → 実行。EPIC #1049 の CLI の UI 後継）。課題詳細には**先生へのお知らせ送信**（EPIC #1111）があり、タイトル + 本文を二段階確認で `POST /admin/notifications` へ送ると、その課題を作成した先生のクラス管理画面右上「お知らせ」🔔 に届く（宛先 teacherSub はサーバー側で classroomId から解決し SPA には出さない。書き込み先 `ClassroomNotifications` テーブルは名前規約 import + write-only grant で、この面が単一の書き手）。さらに**みんなの課題への共有推奨**（EPIC #1106）があり、二段階確認で `POST /admin/classrooms/{id}/recommend-sharing` を実行すると先生へお知らせ（`share_suggestion`）が届き、先生の課題詳細に「この課題、みんなの課題に共有しませんか？」バナーが出る（公開は CC BY 同意を伴う先生本人の共有フローのみ — 代理公開はしない。取り消しは通知なし・audit のみ）
3. **バグ報告**（S5 #1085 + 対応機能追加）: 既存バグ報告の一覧・状態フィルタ・詳細・添付 presigned DL に加え、**状態の変更と進捗コメント（開発者からの返信）**を既存 bug-report admin API の PATCH で行える（2 段階確認・終端ステータスは自動削除 TTL の警告つき。返信は報告者の「私の不具合報告」に表示され、非表示にしていた報告も再表示される — サーバー側の既存挙動）。詳細には**状態に応じた Claude 連携プロンプト**（`/bug-report` スキル向け・受付→Issue 化 / 改修 / 解決返信 / 再開）が表示され、ワンクリックでコピーして Claude Code に貼り付けられる

## 用語辞典（クラス / 課題）

Admin が扱うドメインは 2 階層で、**日本語の呼び方を次の表に固定する**。運用者が「クラスを復元した」と思ったのに実際は課題だけを戻していた、という誤認が実際に起きたため（EPIC #1129）、以降この表以外の呼び方を UI に出さない。

| 概念（英語） | 日本語（正） | テーブル | 主キー | 意味 |
|---|---|---|---|---|
| Group | **クラス（学級）** | `ClassroomGroups` | `groupId` | 先生が持つ学級。課題を束ねる親。アーカイブすると中の課題ごと先生の画面から消える |
| Classroom | **課題（1 授業）** | `Classrooms` | `classroomId` | 1 回の授業＝生徒が参加コードで参加する単位。提出・評価はここに紐づく |

### 揺れの扱い（採用しない語）

| 語 | 扱い |
|---|---|
| 組 | **使わない**（v1 の名残）。「クラス（学級）」と書く。データ移行の歴史的説明の中でのみ許容 |
| 学級 | 単独では使わない。曖昧さを消したいときだけ「クラス（学級）」と括弧で補う |
| クラスルーム | **使わない**。サービス名を指すときのみ「Google Classroom」と正式名で書く |
| クラス | **クラス（学級）専用**。課題を指して「クラス」と呼ばない（Admin の面はほぼ課題を操作しているので特に注意） |

`packages/admin/test/unit/terminology-audit.test.js` が `packages/admin/src/**` を走査して、この揺れの再発（課題を「クラス」と呼ぶ既知パターン）を失敗させる。

### 画面に出す識別子には必ずラベルを付ける

呼び方を正すだけでは足りない。**クラス（学級）名と課題名が同じ画面に並ぶ**ので、無ラベルで置くと読み手がどちらか判断できない（Admin の一覧は行の主タイトルが `Classrooms.className` = クラス（学級）名なので、そのままでは「これが課題名だ」と読まれる）。課題検索・期限切れ復元の行、課題詳細の見出し、俯瞰の候補行はいずれも `クラス: <学級名>` / `課題: <課題名>` の形でラベルを付ける。

### 変更しない識別子と、その理由

「課題を指しているのに `class` / `classroom` と名乗る」ねじれは**識別子には残す**。改名は破壊的変更のわりに得るものが無く、ねじれは日本語の文言とコメントで吸収する。

| 識別子 | 実体 | 変えない理由 |
|---|---|---|
| API パス `/admin/classrooms`, `/admin/classrooms/{id}/restore-plan` ほか | 課題 | `infra/smalruby-admin/lambda/handler.ts` のルーティング・運用手順・E2E と一体。改名は同時デプロイを強いる破壊的変更 |
| `Classrooms-{stage}` テーブル名 | 課題 | 物理テーブル名。改名はデータ移行そのもの |
| `classroomId` | 課題 ID | DynamoDB の PK であり、ddb-archive スナップショットのキー（`ddb-archive/classrooms/{classroomId}.json`）でもある。過去に書き出した JSON と互換が切れる |
| `data-testid="classroom-admin-*"` | 課題の画面要素 | `tools/playwright-verify/verify-admin.mjs` と `packages/admin/test/unit/**` が参照。文言統一と同時に壊す必要が無い |
| SPA の `fetchClassrooms` / `setClassroomStatus` など | 課題 | 対応する API パスに合わせている。パスを変えない以上、関数名だけ変えると対応が読み取れなくなる |
| `Classrooms.className` 属性 | 課題に保存された**クラス（学級）名の写し** | v1 の名残。v2 ではクラス側の `name` が真実で、生徒向け lookup は group の名前を優先する（`infra/smalruby-classroom/lambda/handler.ts`）。後方互換のため属性自体は残る。Admin の検索・表示はこの属性も対象にするので、入力欄の「クラス名」表記はこの属性を指す |

teacher / student UI（`packages/scratch-gui/src/components/classroom-modal/**`）にも同種の揺れが数件残っており、生徒向けの分かりやすさとの兼ね合いを含めて別 Issue で整理する。

### 課題が `active` でも先生に見えているとは限らない

**課題の状態だけでは先生の画面に出ているかは決まらない。** 親のクラス（学級）がアーカイブ中なら、中の課題が `active` でも先生のクラス一覧からは消える（アーカイブ済みのクラスを開かないと辿り着けない）。「課題が利用中＝先生に見えている」という誤読が EPIC #1129 の発端なので、Admin は課題レスポンスに**親クラスの状態**を必ず載せ、実効的な可視性を画面に出す。

| API | 追加フィールド | 意味 |
|---|---|---|
| `GET /admin/classrooms`（一覧・返す 1 ページ分だけ `ClassroomGroups` をバッチ取得して N+1 を避ける） | `groupName` / `groupStatus` | 親クラス名と状態 |
| `GET /admin/classrooms/{id}`（詳細） | `groupName` / `groupStatus` | 同上 |
| `GET /admin/classrooms/{id}/restore-plan` の `alive` 応答 | `groupId` / `groupName` / `groupStatus` | 生存している課題の実効的な可視性 |

`groupStatus` は **親クラス無し = `null`**（v1 の名残の課題）／ **行が消えている = `'missing'`** ／ **引けなかった = `'unknown'`**（一覧のバッチ取得が取り切れなかった場合。行の不在と区別する）／ それ以外は `ClassroomGroups` の `status`（`active` / `archived`）。

**⚠️「先生には表示されません」バッジと注意文を出すのは `archived` のときだけ。** `missing`（親クラスの行が無い）は「見えない」ではない — 先生のクラス一覧には「どのクラスにも入っていない課題」フォールバック（`teacher-class-list.jsx` の ungrouped セクション）があり、**利用中の課題はそこに出る**。`missing` / `unknown` は状態を伝えるだけのグレーのバッジにとどめる（「先生の操作では戻せない」と誤って断定しない）。

課題詳細の「利用中に戻す」確認にも、親クラスがアーカイブ中なら「**戻しても先生の画面には表示されません**」と添える（課題だけ戻して解決したと思い込まないように）。

復元パネルの「まだ存在しています」案内は次のように出し分ける（案内先を間違えると、先生が課題一覧をいくら探しても対象を見つけられない）:

| 状況 | 案内 |
|---|---|
| 親クラスは生きていて課題がアーカイブ済み | 先生自身のクラス管理画面の**課題一覧**から戻せる |
| 親クラスがアーカイブ中 | 先生に「クラス管理 → クラス一覧 → **アーカイブ済みのクラス** → 元に戻す」を案内する（戻すのは課題ではなくクラス（学級））。先生が操作できないときは運用者が「クラス（学級）検索」タブから解除する |
| 親クラスの行が無い + 課題は利用中 | 先生のクラス一覧の「**どのクラスにも入っていない課題**」に出ている |
| 親クラスの行が無い + 課題もアーカイブ済み | 先生の動線からは外れる。Admin の課題詳細で「利用中に戻す」と上記フォールバックに出る |

**Admin の「課題検索」タブと課題詳細のアーカイブ切替は、`Classrooms` にしか書き込まない**。`ClassroomGroups`（クラス（学級））を書き換えるのは下記「クラス（学級）検索・アーカイブ解除」タブと、**期限切れ復元**（削除スナップショットに親のクラスが含まれていればサーバー側で一緒に復元する。その場合だけ dry-run プランに「クラス（学級）も復元します」と出る）の 2 つだけ。

### クラス（学級）検索・アーカイブ解除

アーカイブ済みのクラスを利用中に戻せるのは長らく**先生用 UI だけ**で、先生がその画面に到達できない問い合わせに運用者が対応できなかった。「クラス・課題」セクションの **「クラス（学級）検索」タブ**（`src/components/classroom-groups-view.jsx`）がこれを埋める。

| API | 用途 |
|---|---|
| `GET /admin/classroom-groups?q=&status=` | クラスの検索。`q` は **クラス名・年度・組・`groupId`・中の課題名** に部分一致（運用者は先生から課題名しか聞けていないことが多い）。`status` で 利用中 / アーカイブ を絞る |
| `GET /admin/classroom-groups/{groupId}` | クラスの詳細 + **中の課題一覧**（課題名・参加コード・状態・作成日時） |
| `PATCH /admin/classroom-groups/{groupId}` `{status}` | アーカイブ⇄利用中の切り替え（二段階確認）。`classroomGroup.setStatus` として監査ログに残る |

運用上の約束（壊すと事故になる）:

- **同名クラスが実際に並ぶ**（Google Classroom 連携での二重作成）。一覧の各行はクラス名に加えて **年度・人数・中の課題名・作成日時**を必ず併記する。名前だけでは「どちらを戻すのか」を運用者が判断できない
- **アーカイブ解除は TTL を実行時点から数え直す**（`restoredAt` も刻む）。過去の TTL のまま戻すと即座に再スイープされる（`docs/classroom/operations.md` の既存規約・`restore-plan.ts` と同じ形）
- **中の課題の `status` は変えない**。クラスを戻しても、アーカイブ済みの課題は勝手に復活させない（無関係な課題を先生の画面に戻さないため）。個別に戻すのは「課題検索」タブ
- 先生用 UI の `PATCH /classroom-groups/{groupId}` と**同じ更新形**（`status` + `updatedAt`）で書く。書き手が 2 つになるので、スタンプ規約を揃えて片方だけの独自形式を作らない
- **書き込みは `attribute_exists(groupId)` を条件にする**。`UpdateItem` は upsert なので、条件なしだと確認から書き込みまでの間に TTL でスイープされた行を「`teacherSub` も名前も無い抜け殻」として復活させてしまう（先生には見えず Admin 一覧にだけ残る）。条件が落ちたら 404 を返し、戻せたと誤報しない
- **一覧は 1 レスポンス 200 件で打ち切り、`total` と併せて必ず件数を表示する**。既定の並びは作成日時の新しい順なので、黙って切ると運用者が探している**古いアーカイブ済みクラス**から先に消え、「無い」と誤って結論される

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
| `src/components/classrooms-view.jsx` | 課題の検索・アーカイブ切替 + 期限切れ復元（用語は上記「用語辞典」に従う） |
| `src/components/classroom-groups-view.jsx` | クラス（学級）の検索・詳細・アーカイブ解除（`ClassroomGroups` を書く唯一の画面） |
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
- **ポートは 8601〜8610 のどれでもよい**（`PORT=8603 npm start` など）。非 prod の API は
  この範囲の `http://localhost:<port>` を CORS で許可する（#1160）。devpod で worktree を
  並行起動すると 8601 から順に別ポートが割り当たるため、範囲で許可している。
  **prod はこの範囲を含まない**（含む設定で deploy しようとすると stack が throw する）
- ユニットテスト: `cd packages/admin && npm test`（eslint + jest）/ `cd infra/smalruby-admin && npm test`

## スクリーンショット

| ファイル | 内容 |
|---|---|
| `screenshots/0101-login.png` | ログイン画面（Google Sign-In） |
| `screenshots/0102-shared-queue.png` | みんなの課題: 通報キュー |
| `screenshots/0103-classrooms.png` | クラス・課題: 課題検索の一覧 |
| `screenshots/0104-restore-plan.png` | 期限切れ復元: dry-run プラン |
| `screenshots/0105-bug-reports.png` | バグ報告: 閲覧一覧 |
| `screenshots/0106-classroom-notify.png` | 課題詳細: 先生へのお知らせ送信（EPIC #1111） |
| `screenshots/0107-shared-recommend.png` | みんなの課題: 限定公開の詳細と推薦の確認（EPIC #1110） |
| `screenshots/0108-recommend-sharing.png` | 課題詳細: 共有推奨の確認（EPIC #1106） |
| `screenshots/0109-classroom-group-archived.png` | 課題詳細: 親クラス（学級）がアーカイブ中の警告 |
| `screenshots/0110-restore-alive-group-archived.png` | 期限切れ復元: 課題は生存・親クラスがアーカイブ中のときの案内 |
| `screenshots/0111-classroom-groups.png` | クラス（学級）検索: 同名クラスを年度・人数・課題名で区別する一覧 |
| `screenshots/0112-classroom-group-unarchive.png` | クラス（学級）詳細: アーカイブ解除の二段階確認 |
