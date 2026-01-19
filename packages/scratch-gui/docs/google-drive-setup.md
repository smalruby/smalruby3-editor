# Google Drive連携機能のセットアップ手順

このドキュメントでは、Smalruby3-GUIでGoogle Driveからファイルを読み込むための機能を有効にするために必要なGoogle Cloud Platform (GCP)の設定手順を説明します。

## 前提条件

- Googleアカウントを持っていること
- Google Cloud Platformへのアクセス権限があること

## 1. Google Cloud Platformプロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 画面上部の「プロジェクトを選択」をクリック
3. 「新しいプロジェクト」をクリック
4. プロジェクト名を入力（例: `smalruby3-gui`）
5. 「作成」をクリック

## 2. 必要なAPIの有効化

### Google Drive APIを有効化

1. Google Cloud Consoleで作成したプロジェクトを選択
2. 左側のメニューから「APIとサービス」→「ライブラリ」を選択
3. 検索ボックスに「Google Drive API」と入力
4. 「Google Drive API」を選択
5. 「有効にする」をクリック

### Google Picker APIを有効化

1. 同じく「ライブラリ」画面で検索ボックスに「Google Picker API」と入力
2. 「Google Picker API」を選択
3. 「有効にする」をクリック

## 3. OAuth 2.0 認証情報の作成

### OAuth同意画面の設定

1. 左側のメニューから「APIとサービス」→「OAuth同意画面」を選択
2. ユーザータイプで「外部」を選択（テスト用途の場合）
3. 「作成」をクリック
4. アプリ情報を入力:
   - **アプリ名**: `Smalruby3 GUI`
   - **ユーザーサポートメール**: あなたのメールアドレス
   - **デベロッパーの連絡先情報**: あなたのメールアドレス
5. 「保存して次へ」をクリック
6. 「スコープ」画面で「スコープを追加または削除」をクリック
7. 以下のスコープを追加:
   - `https://www.googleapis.com/auth/drive.file` （**推奨**: ファイルの読み込みとアップロードの両方に対応）
8. 「更新」→「保存して次へ」をクリック
9. テストユーザー画面で「保存して次へ」をクリック
10. 確認画面で「ダッシュボードに戻る」をクリック

### OAuth 2.0 クライアントIDの作成

1. 左側のメニューから「APIとサービス」→「認証情報」を選択
2. 画面上部の「認証情報を作成」→「OAuth クライアント ID」をクリック
3. アプリケーションの種類で「ウェブアプリケーション」を選択
4. 名前を入力（例: `Smalruby3 GUI Web Client`）
5. 「承認済みのJavaScript生成元」に以下を追加:
   - `http://localhost:8601` (開発環境)
   - 本番環境のURL（例: `https://smalruby.github.io`）
6. 「承認済みのリダイレクトURI」は空欄でOK（Picker APIでは不要）
7. 「作成」をクリック
8. 表示されたダイアログで「クライアントID」をコピーして保存

**重要**: クライアントシークレットは今回の実装では使用しません（フロントエンドのみの実装のため）

## 4. APIキーの作成（Picker API用）

1. 「認証情報」画面で「認証情報を作成」→「APIキー」をクリック
2. APIキーが作成されるので、コピーして保存
3. （推奨）「キーを制限」をクリック
4. 「アプリケーションの制限」で「HTTPリファラー（ウェブサイト）」を選択
5. 「ウェブサイトの制限」に以下を追加:
   - `http://localhost:8601/*`
   - 本番環境のURL（例: `https://smalruby.github.io/*`）
6. 「APIの制限」で「キーを制限」を選択
7. 「Google Picker API」を選択
8. 「保存」をクリック

## 5. 環境変数の設定

### 開発環境（Docker使用時）

**重要**: このプロジェクトはDockerを使用しているため、プロジェクトルート（`smalruby3-develop/`）に `.env` ファイルを作成します。

1. プロジェクトルートに `.env` ファイルを作成:

```bash
# Google Drive API設定
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_API_KEY=your-api-key
```

2. **注意事項**:
   - `.env` ファイルは `.gitignore` に含まれているため、Gitにコミットされません
   - `docker-compose.yml` がこの `.env` ファイルを自動的に読み込みます
   - 環境変数を変更した場合は、`docker compose restart gui` でサービスを再起動してください

3. サービスの再起動:

```bash
# 環境変数を反映させるため再起動
docker compose restart gui
```

### 開発環境（Dockerを使用しない場合）

Dockerを使用せず、直接npmコマンドを実行する場合:

```bash
# gui/smalruby3-gui/ ディレクトリに .env ファイルを作成
cd gui/smalruby3-gui
cat > .env << 'EOF'
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_API_KEY=your-api-key
EOF

# 開発サーバー起動
npm start
```

### 本番環境

本番環境では、ビルド時に環境変数を設定します:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com \
GOOGLE_API_KEY=your-api-key \
npm run build
```

または、GitHub ActionsなどのCI/CD環境では、シークレット変数として設定します。

## 6. セキュリティに関する注意事項

### クライアントIDとAPIキーの管理

- **クライアントID**: 公開しても問題ありませんが、承認済みのJavaScript生成元で制限することを推奨
- **APIキー**: HTTPリファラーで制限し、API制限を有効にすることを強く推奨
- **クライアントシークレット**: フロントエンドでは使用しないこと（セキュリティリスク）

### OAuth 2.0 スコープの選択

このアプリケーションでは以下のスコープを使用します:

- `drive.file` (**推奨・使用中**):
  - アプリが作成したファイルの読み書き
  - ユーザーがGoogle Pickerで選択したファイルへのアクセス
  - ファイルのアップロード機能に必要
  - 完全なDriveアクセスより制限されているため安全

**注意**: `drive.readonly`（読み取り専用）では、Google Pickerのアップロードタブが機能しません。

## 7. 動作確認

1. 開発サーバーを起動:
   ```bash
   docker compose up gui
   ```

2. ブラウザで `http://localhost:8601` を開く

3. ファイルメニューから「Google ドライブから読み込む」を選択

4. Google認証画面が表示されることを確認

5. 認証後、Google Driveのファイル選択画面が表示されることを確認

## トラブルシューティング

### "Access blocked: This app's request is invalid"

- OAuth同意画面の設定が完了していない可能性があります
- テストユーザーに自分のアカウントが追加されているか確認してください

### "API key not valid. Please pass a valid API key."

- APIキーが正しく設定されていない可能性があります
- APIキーの制限設定を確認してください
- Picker APIが有効になっているか確認してください

### "The origin http://localhost:8601 is not allowed"

- OAuth クライアントIDの「承認済みのJavaScript生成元」に `http://localhost:8601` が追加されているか確認してください

### 動的スクリプトのロードエラー

- ブラウザのコンソールでエラー内容を確認してください
- Content Security Policy (CSP) の設定を確認してください

## 参考リンク

- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Picker API Documentation](https://developers.google.com/picker/api)
- [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/overview)
- [Google Drive API v3](https://developers.google.com/drive/api/v3/about-sdk)
