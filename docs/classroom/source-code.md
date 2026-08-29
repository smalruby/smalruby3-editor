# 関連ソースコード

## ディレクトリ構成

```
smalruby3-editor/
├── infra/smalruby-classroom/          ← AWS CDK インフラ + Lambda
│   ├── lib/classroom-stack.ts         ← CDK スタック定義
│   ├── lambda/handler.ts              ← Lambda ハンドラー (全 API ロジック)
│   ├── lambda/tests/
│   │   └── handler.integration.test.ts ← 結合テスト
│   ├── .env.stg / .env.prod           ← ステージ別環境変数
│   └── package.json
│
├── packages/scratch-gui/
│   ├── src/
│   │   ├── components/
│   │   │   ├── classroom-modal/       ← 生徒用 UI コンポーネント群
│   │   │   │   ├── classroom-modal.jsx
│   │   │   │   ├── classroom-modal.css
│   │   │   │   ├── class-code-display.jsx ← 参加コード表示（全画面対応）
│   │   │   │   ├── google-course-list.jsx ← GC コースタイルグリッド
│   │   │   │   ├── kick-request-confirm-dialog.jsx ← 退室依頼ダイアログ (#692)
│   │   │   │   ├── teacher-class-detail.jsx ← 先生クラス詳細 (退室リクエストバッジ + 退室通知バナー)
│   │   │   │   ├── teacher-member-detail.jsx ← メンバー詳細パネル (承認/却下ボタン)
│   │   │   │   ├── teacher-create-form.jsx ← クラス作成フォーム
│   │   │   │   ├── teacher-assignment-editor.jsx ← 課題エディタ（ページ + スターター）
│   │   │   │   ├── teacher-group-manage.jsx ← 組（グループ）管理
│   │   │   │   ├── teacher-evaluation.jsx ← 学期末評価（席×授業マトリクス）
│   │   │   │   └── teacher-post-assignment.jsx ← 課題配信
│   │   │   ├── classroom-teacher-modal/ ← 先生用フルスクリーンモーダル
│   │   │   │   ├── classroom-teacher-modal.jsx ← メイン（ダッシュボード/詳細/作成等）
│   │   │   │   ├── classroom-teacher-modal.css
│   │   │   │   ├── teacher-login-phase.jsx ← ログイン画面（カルーセル付き）
│   │   │   │   ├── teacher-sidebar.jsx ← サイドバー（クラス一覧ナビ）
│   │   │   │   ├── teacher-google-courses-phase.jsx ← GC コースインポート
│   │   │   │   └── carousel-*.png     ← カルーセル画像
│   │   │   ├── classroom-tutorial/    ← チュートリアルオーバーレイ
│   │   │   └── alerts/alert.jsx       ← セッション切れ Alert（showRejoin 対応）
│   │   ├── containers/
│   │   │   ├── classroom-modal.jsx    ← コンテナ（生徒/先生モードの振り分け）
│   │   │   ├── use-teacher-classroom.js ← 先生用フック統合（他フックを束ねる）
│   │   │   ├── use-teacher-notifications.js ← お知らせセンター (EPIC #1111)
│   │   │   ├── use-teacher-auth.js    ← 認証フック（Google/Microsoft 共通）
│   │   │   ├── use-teacher-classrooms.js ← クラス CRUD + 自動リフレッシュ
│   │   │   ├── use-teacher-submissions.js ← 提出管理・一括ダウンロード
│   │   │   ├── use-teacher-assignment.js ← 課題コンテンツ編集フロー
│   │   │   ├── use-teacher-groups.js ← 組（グループ）管理・複製フロー
│   │   │   ├── use-teacher-evaluation.js ← 学期末評価フロー（読み込み/AI評価/CSV/返却）
│   │   │   ├── use-student-submit.js  ← 生徒提出フロー
│   │   │   ├── use-google-classroom.js ← Google Classroom API 連携
│   │   │   ├── classroom-error-utils.js ← エラーメッセージ変換
│   │   │   └── alert.jsx             ← Alert コンテナ（参加しなおす対応）
│   │   ├── lib/
│   │   │   ├── classroom-api.js       ← API クライアント (リトライ付き)
│   │   │   ├── classroom-assignment-utils.js ← 課題エディタの純粋ヘルパー
│   │   │   ├── classroom-group-utils.js ← サイドバー組階層の純粋ヘルパー
│   │   │   ├── classroom-evaluation/ ← sb3-analyzer（静的解析）+ evaluation-utils（総合評価/CSV）
│   │   │   ├── classroom-kick-request-storage.js ← 退室依頼の localStorage 永続化 (#692)
│   │   │   ├── google-classroom-auth.js ← Google Classroom OAuth
│   │   │   └── alerts/index.jsx       ← Alert 定義（classroomSessionExpired 追加）
│   │   ├── reducers/
│   │   │   ├── classroom.js           ← Redux (セッション永続化, reloginRequested)
│   │   │   ├── classroom-tutorial.js  ← チュートリアル表示済みフラグ
│   │   │   └── alerts.js             ← Alert 状態管理（showRejoin 対応）
│   │   └── locales/
│   │       ├── ja.js                  ← 日本語
│   │       ├── ja-Hira.js             ← ひらがな
│   │       └── en.js                  ← 英語
│   └── test/
│       └── unit/reducers/
│           └── classroom-reducer.test.js
│
└── docs/classroom/                    ← このドキュメント
```

## バックエンド

### `infra/smalruby-classroom/lib/classroom-stack.ts`

CDK スタック定義。以下のリソースを作成:
- API Gateway HTTP API + カスタムドメイン
- Lambda 関数 (Node.js 20, esbuild バンドル)
- DynamoDB テーブル × 3 (Classrooms, ClassroomMemberships, ClassroomSubmissions)
- S3 バケット (提出ファイル)
- Route53 A レコード
- ACM SSL 証明書

### `infra/smalruby-classroom/lambda/handler.ts`

単一の Lambda ハンドラーに全 API ロジックを実装。

**主要な関数:**

| 関数名 | 説明 |
|--------|------|
| `handler()` | エントリーポイント (ルーティング) |
| `handleCreateClassroom()` | クラス作成 |
| `handleListClassrooms()` | クラス一覧 |
| `handleGetClassroom()` | クラス詳細 |
| `handleUpdateClassroom()` | クラス更新 |
| `handleDeleteClassroom()` | クラス削除 (アーカイブ) |
| `handleListMembers()` | メンバー一覧 |
| `handleDeleteMember()` | メンバー削除 |
| `handleLookupClassroom()` | 参加コードでクラス検索 |
| `handleJoinClassroom()` | クラスに参加 |
| `handleVerifySession()` | セッション検証 |
| `handleCreateSubmission()` | 提出 (Presigned URL 生成) |
| `handleListSubmissions()` | 提出一覧 |
| `handleUpdateSubmission()` | 提出更新 (返却・コメント) |
| `handleSetAssignment()` | 課題コンテンツ設定 (ページ + スターター、Presigned URL 生成) |
| `handleGetAssignment()` | 課題コンテンツ取得 (生徒 Session Token / 先生 ID Token 両対応) |
| `handleListNotifications()` | お知らせ一覧 + 未読数 (EPIC #1111) |
| `handleMarkNotificationsRead()` | お知らせ既読化 (ids 省略で全既読) |
| `handleCreateGroup()` / `handleListGroups()` / `handleUpdateGroup()` | 組（グループ）の作成・一覧・更新/アーカイブ |
| `handleDuplicateClassroom()` | クラス複製（課題の S3 オブジェクトコピー含む） |
| `handleListGoogleCourses()` | Google Classroom コース一覧 |
| `handleImportGoogleClassroom()` | Google Classroom コースインポート |
| `handlePostAssignment()` | Google Classroom に課題投稿 |
| `verifyTeacherToken()` | Google ID Token 検証 |
| `verifySessionToken()` | Session Token 検証 |
| `callGoogleClassroomAPI()` | Google Classroom API プロキシ |
| `getCorsHeaders()` | CORS ヘッダー生成 |
| `checkJoinRateLimit()` | レート制限チェック |
| `generateJoinCode()` | 参加コード生成 (6文字英数字) |

### `infra/smalruby-classroom/lambda/tests/handler.integration.test.ts`

デプロイ済みエンドポイントに対する結合テスト (32テスト)。

```bash
# 実行方法
docker compose run --rm -w /app/infra/smalruby-classroom infra npm run test:integration

# 教師フローのテストには GOOGLE_ID_TOKEN が必要
GOOGLE_ID_TOKEN=eyJ... docker compose run --rm -w /app/infra/smalruby-classroom infra npm run test:integration
```

---

## フロントエンド

### `packages/scratch-gui/src/containers/classroom-modal.jsx`

**コンテナコンポーネント** — 生徒/先生モードの振り分けを担当。

ロジックの大部分はカスタムフックに委譲している:
- `useStudentSubmit()` — 生徒の提出フロー
- `useTeacherClassroom()` — 先生側の統合フック

主要な state:
- `phase` — 現在のフェーズ (`role-select`, `teacher-dashboard`, `student-status`, etc.)
- `error` — エラーメッセージ
- `loading` — ローディング状態

### カスタムフック群 (`src/containers/use-*.js`)

`use-teacher-classroom.js` を頂点に、ドメインごとに分割された5つのフックで構成:

| フック | 責務 |
|--------|------|
| `use-teacher-classroom.js` | **統合フック** — 他の4フックを束ねて先生側の全状態・操作を提供 |
| `use-teacher-auth.js` | 認証 (Google / Microsoft のログイン、サイレント再認証、ログアウト) |
| `use-teacher-classrooms.js` | クラス CRUD、メンバー管理、30秒ごとの自動リフレッシュ |
| `use-teacher-submissions.js` | 提出一覧、返却、コメント、全作品一括ダウンロード |
| `use-google-classroom.js` | Google Classroom コース取得・インポート |
| `use-student-submit.js` | 生徒の提出フロー (サムネイル/スクリーンショット生成 + S3 アップロード) |

### `packages/scratch-gui/src/components/classroom-modal/classroom-modal.jsx`

**プレゼンテーショナルコンポーネント** — 生徒フェーズの UI を描画。

サブコンポーネント (同一ファイル内):
- `ClassCodeDisplay` — 参加コード大画面表示 (Portal 使用)
- `SeatGrid` — 座席グリッド
- `MemberDetailPanel` — メンバー詳細パネル (右側)

### クラス管理画面の共通レイアウト / 共通ボタン

**新しいクラス管理画面は、必ずこの 2 つをベースに作る。** そうすればヘッダー・
マージン・枠・ボタンのスタイルが自動でそろい、画面ごとのズレが起きない。

| ファイル | 責務 |
|---------|------|
| `classroom-modal/teacher-view-layout.jsx` | `TeacherScreen`（パンくずを持つトップレベル画面）と `TeacherSubView`（パネル内サブ画面。`as="form"` で `<form>` になる）。パンくず → タイトル → 説明 → エラー → 本文 → フッター の順を固定する |
| `classroom-modal/classroom-button.jsx` | `ClassroomButton`（`variant="primary" / "secondary" / "danger"`）。ボタンの見た目はここだけが持つ |

画面側で `<h2 className={styles.xxxTitle}>` やボタンのクラスを書き起こさないこと
（それが #1121 / #1122 のズレの発生源だった）。フッターは `footer` スロットに
セカンダリ（左）→ プライマリ（右）の順で渡す。

### 先生用コンポーネント (`src/components/classroom-teacher-modal/`)

| ファイル | 責務 |
|---------|------|
| `classroom-teacher-modal.jsx` | 先生モーダル本体（ダッシュボード、クラス詳細、作成、課題配信） |
| `teacher-login-phase.jsx` | ログイン画面（Google / Microsoft ボタン + カルーセル） |
| `teacher-sidebar.jsx` | サイドバー（クラス一覧ナビゲーション） |
| `teacher-google-courses-phase.jsx` | Google Classroom コースインポート画面 |
| `teacher-notifications.jsx` | お知らせセンター（🔔 + 未読バッジ + 一覧パネル、EPIC #1111） |

### `packages/scratch-gui/src/lib/classroom-api.js`

**API クライアント** — Backend への HTTP リクエストを管理。

特徴:
- Singleton パターン (`ClassroomAPI.getInstance()`)
- 429 レスポンスに対する自動リトライ (3回, 指数バックオフ)
- Bearer Token 認証 (idToken or sessionToken)
- Google Access Token は `X-Google-Access-Token` ヘッダーで送信

### `packages/scratch-gui/src/lib/google-classroom-auth.js`

**Google Classroom 認証** — GIS (Google Identity Services) を使った OAuth フロー。

特徴:
- Google Drive 認証とは独立した tokenClient
- アクセストークンのキャッシュ (60秒バッファ)
- CSRF 防止 (state パラメータ)

### `packages/scratch-gui/src/reducers/classroom.js`

**Redux reducer** — セッション情報の永続化。

Actions:
- `OPEN_MODAL` / `CLOSE_MODAL`
- `SET_SESSION` — 参加情報を保存 (localStorage に永続化)
- `CLEAR_SESSION` — セッションクリア
- `SET_SUBMISSION_STATUS` — 提出状況を更新

---

## 関連する upstream 変更

クラス機能のために upstream (Scratch) ファイルに加えた変更:

| ファイル | 変更内容 | マーカー |
|---------|---------|---------|
| `src/components/menu-bar/menu-bar.jsx` | 「クラス」ボタン追加 | `Smalruby: Classroom` |
| `src/containers/gui.jsx` | `classcode` URL パラメータでの自動参加 | `Smalruby: Classroom auto-join` |

---

## インフラ操作

### CDK コマンド

```bash
# 依存関係インストール
docker compose run --rm -w /app/infra/smalruby-classroom infra npm install

# テンプレート確認
docker compose run --rm -w /app/infra/smalruby-classroom infra npx cdk synth

# 差分確認
docker compose run --rm -w /app/infra/smalruby-classroom infra npx cdk diff

# デプロイ
docker compose run --rm -w /app/infra/smalruby-classroom infra npx cdk deploy
```

### ステージ切り替え

```bash
cd infra/smalruby-classroom

# staging
rm .env && ln -s .env.stg .env

# production
rm .env && ln -s .env.prod .env
```
