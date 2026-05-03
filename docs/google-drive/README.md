# Google Drive 連携

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能
> upstream の Scratch は scratch.mit.edu のクラウドサーバへの保存。Smalruby はサーバを持たないため、ユーザー自身の Google Drive に保存する仕組みを独自実装している。

## 概要

Smalruby のプロジェクト (.sb3 / Ruby スクリプト) を **ユーザー自身の Google Drive** に保存・読み込みできる機能。Google アカウントでログインし、OAuth 2.0 + Google Picker API を使って Drive 内のファイルにアクセスする。

## ユーザーストーリー

- **小学生**として、家のデバイスと学校のデバイスで作品を持ち歩きたいので、Google アカウントでログインして自分の Drive に保存したい
- **教師**として、生徒が作品を提出する際にメール添付ではなく Google Drive のリンクで共有してほしい
- **保護者**として、子どもの作品が消えないように、ローカル保存ではなくクラウドに自動保存される選択肢が欲しい
- **複数台のデバイスを使う子**として、自分のアカウントでログインすればどこでも自分の作品にアクセスできるようにしたい

## UI / 操作フロー

### 保存

1. メニューバーの「ファイル」→ 「Google Drive に保存」を選択
2. 初回はGoogle アカウント認証ダイアログ（OAuth 2.0）
3. 保存先フォルダの選択ダイアログ (`google-drive-save-dialog`)
4. ファイル名を入力して保存

### 読み込み

1. メニューバーの「ファイル」→ 「Google Drive から読み込み」を選択
2. Google Picker API のダイアログでファイルを選択
3. 選択した .sb3 / Ruby ファイルが Smalruby に読み込まれる

## 主要ファイル

### scratch-gui

#### コンテナ (HOC)

- `packages/scratch-gui/src/containers/google-drive-loader-hoc.jsx` — Drive からの読み込み HOC
- `packages/scratch-gui/src/containers/google-drive-saver-hoc.jsx` — Drive への保存 HOC

#### コンポーネント

- `packages/scratch-gui/src/components/google-drive-save-dialog/` — 保存先フォルダ選択ダイアログ

#### ライブラリ

- `packages/scratch-gui/src/lib/google-drive-api.js` — Drive API クライアント
- `packages/scratch-gui/src/lib/google-script-loader.js` — Google API JS の動的ロード
- `packages/scratch-gui/src/lib/google-classroom-auth.js` — Google アカウント認証（Classroom 機能と共有）

#### Redux 状態管理

- `packages/scratch-gui/src/reducers/google-drive-file.js` — 現在開いている Drive ファイルの state（ファイル ID、名前、フォルダ ID）

### scratch-vm

なし（GUI のみ）。

### infra

なし（クライアント側で直接 Google API と通信）。

## 設定・データ永続化

### 環境変数（`.env`）

- `GOOGLE_CLIENT_ID` — OAuth 2.0 クライアント ID
- `GOOGLE_API_KEY` — Google Picker API 用 API キー

### Google Cloud 設定

セットアップ手順の詳細（GCP プロジェクト作成、API 有効化、OAuth 同意画面、認証情報作成）は **[`google-api-setup.md`](google-api-setup.md)** を参照。

必要な GCP API:
- Google Drive API
- Google Picker API
- Generative Language API（Rubytee 旧実装で使用、現在は不要）

### OAuth スコープ

- `https://www.googleapis.com/auth/drive.file` — Smalruby が作成・開いたファイルのみアクセス可能

### Redux state

`google-drive-file` reducer で現在の Drive ファイル情報を保持：

```js
{
    fileId: string | null,
    fileName: string | null,
    folderId: string | null
}
```

## 関連ドキュメント

- **[`google-api-setup.md`](google-api-setup.md)** — GCP プロジェクト作成から認証情報発行までの完全手順
- [`docs/classroom/`](../classroom/) — Google Classroom 連携（同じ Google 認証基盤を共有）
- [`docs/project-management/`](../project-management/) — プロジェクト保存・読込全般 (準備中)

## 関連 Issue / PR

該当 PR はリポジトリの `feat: implement Google Drive` 系のコミット履歴を参照。
