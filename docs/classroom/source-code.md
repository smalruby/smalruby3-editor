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
│   │   ├── components/classroom-modal/
│   │   │   ├── classroom-modal.jsx    ← UI コンポーネント (全フェーズ描画)
│   │   │   └── classroom-modal.css    ← スタイル
│   │   ├── containers/
│   │   │   └── classroom-modal.jsx    ← コンテナ (状態管理, API呼び出し)
│   │   ├── lib/
│   │   │   ├── classroom-api.js       ← API クライアント (20メソッド)
│   │   │   └── google-classroom-auth.js ← Google Classroom OAuth
│   │   ├── reducers/
│   │   │   └── classroom.js           ← Redux (セッション永続化)
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

**コンテナコンポーネント** — 状態管理と API 呼び出しを担当。

主要な state:
- `phase` — 現在のフェーズ (`role-select`, `teacher-dashboard`, `student-status`, etc.)
- `classrooms` — 先生のクラス一覧
- `members` — 選択中のクラスのメンバー
- `submissions` — 提出一覧
- `selectedMember` — 詳細表示中のメンバー
- `error` — エラーメッセージ
- `loading` — ローディング状態

主要なハンドラー:
- `handleTeacherLogin()` — Google ログイン
- `handleCreateClassroom()` — クラス作成
- `handleJoinClassroom()` — 生徒参加
- `handleSubmit()` — 作品提出 (サムネイル/スクリーンショット生成 + S3 アップロード)
- `handleReturn()` — 返却
- `handleGoogleImport()` — Google Classroom インポート
- `handlePostAssignment()` — 課題配信

### `packages/scratch-gui/src/components/classroom-modal/classroom-modal.jsx`

**プレゼンテーショナルコンポーネント** — 13フェーズの UI を描画。

サブコンポーネント (同一ファイル内):
- `ClassCodeDisplay` — 参加コード大画面表示 (Portal 使用)
- `SeatGrid` — 座席グリッド
- `MemberDetailPanel` — メンバー詳細パネル (右側)

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
