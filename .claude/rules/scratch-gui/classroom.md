---
paths:
  - "packages/scratch-gui/src/components/classroom-modal/**"
  - "packages/scratch-gui/src/containers/classroom-modal.jsx"
  - "packages/scratch-gui/src/lib/classroom-api.js"
  - "packages/scratch-gui/src/lib/google-classroom-auth.js"
  - "packages/scratch-gui/src/reducers/classroom.js"
---

# Classroom Feature (scratch-gui)

クラス機能（Classroom）は、先生がクラスを作成し、生徒が参加コードで参加して作品を提出する機能。

## ドキュメント

クラス機能の仕様は `docs/classroom/` 以下のドキュメントに詳しく記載されている:

| ドキュメント | 参照すべき場面 |
|-------------|-------------|
| `docs/classroom/README.md` | 概要・クイックスタート |
| `docs/classroom/architecture.md` | API ルート、データモデル、認証フローの確認 |
| `docs/classroom/user-stories.md` | ユーザーフローの理解 |
| `docs/classroom/ui-ux.md` | **UI パーツ・data-testid の完全な一覧**（Playwright テストで参照） |
| `docs/classroom/cost-estimate.md` | AWS/GCP 費用 |
| `docs/classroom/source-code.md` | ファイル・関数の一覧 |
| `docs/classroom/testing.md` | data-testid 一覧、テスト実行方法 |

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| `src/containers/classroom-modal.jsx` | コンテナ: 状態管理、API 呼び出し、フェーズ遷移 |
| `src/components/classroom-modal/classroom-modal.jsx` | コンポーネント: 13 フェーズの UI 描画 |
| `src/components/classroom-modal/classroom-modal.css` | スタイル |
| `src/lib/classroom-api.js` | API クライアント (20 メソッド、リトライ付き) |
| `src/lib/google-classroom-auth.js` | Google Classroom OAuth (access token 取得) |
| `src/reducers/classroom.js` | Redux: セッション永続化 (localStorage) |

## 機能フラグ

- URL パラメータ `?features=classroom` で有効化
- `?classcode=XXXXXX` で参加コード入力をスキップして自動参加

## UI フェーズ

13 フェーズの詳細は `docs/classroom/ui-ux.md` を参照。各フェーズには `data-testid` が付与されている（例: `classroom-phase-role-select`）。

## Playwright テスト

`docs/classroom/ui-ux.md` に各画面のスクリーンショットと全 UI パーツの `data-testid` を記載している。テストを書く際はこのドキュメントを参照すること。

テスト用 URL:
```
http://localhost:8601?no_beforeunload=1&features=classroom
```
