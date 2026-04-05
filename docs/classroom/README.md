# Smalruby Classroom

Smalruby Classroom は、日本の学校の授業で Smalruby を使うための**クラス管理・作品提出機能**です。

先生が Google アカウントでログインしてクラスを作り、生徒は参加コードと席番号でクラスに参加します。生徒はプロジェクトをワンクリックで提出でき、先生はリアルタイムで一覧・確認・返却できます。

## 目次

| ドキュメント | 内容 |
|-------------|------|
| [システム構成](architecture.md) | AWS / GCP サービス、API ルート、データモデル |
| [ユーザーストーリー](user-stories.md) | 先生・生徒それぞれの利用フロー |
| [UI/UX](ui-ux.md) | 画面遷移、各フェーズの説明 |
| [費用見積もり](cost-estimate.md) | AWS / GCP の想定費用 |
| [ソースコード](source-code.md) | 関連ファイル一覧 |
| [テスト](testing.md) | data-testid 一覧、Playwright / 結合テスト |

![Smalruby メニューバーの「クラス」ボタン](images/01-menu-bar.png)

## クイックスタート

### 先生

1. Smalruby を開く（`https://smalruby.app?features=classroom`）
2. メニューバーの「クラス」をクリック
3. 「先生」を選択 → Google ログイン
4. 「クラスをつくる」→ クラス名と人数を入力
5. 生成された**参加コード**を生徒に伝える

### 生徒

1. 先生から参加コードを受け取る
2. Smalruby を開く（参加リンク or `?features=classroom`）
3. 「生徒」→ 参加コード入力 → 席番号を選択
4. プロジェクトを作成し「提出」ボタンで提出

## 前提条件

- Google アカウント（先生のログインに必要）
- モダンブラウザ（Chrome / Edge / Firefox / Safari）
- インターネット接続

## 機能フラグ

クラス機能は `?features=classroom` URL パラメータで有効化されます。将来的にデフォルト有効に切り替える予定です。
