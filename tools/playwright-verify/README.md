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
| `mesh-v2-classroom-binding.mjs` | クラス管理と Mesh v2 ドメインの連動。教師タブでクラス作成→サイドバーで選択、生徒タブで `?classcode=` 経由参加し、両方の `state.scratchGui.meshV2.domain` が参加コードに揃うこと、接続モーダル入力欄が disabled になること、解除時に元のドメインに戻ることをチェック |

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
