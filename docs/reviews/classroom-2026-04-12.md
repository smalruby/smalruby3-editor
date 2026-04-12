# 機能レビュー: Classroom

**レビュー日**: 2026-04-12
**レビュー観点**: 機能面 / UI/UX / セキュリティ
**テスト環境**: ローカル (localhost:8601) + stg API (stg.classroom.api.smalruby.app)
**ペルソナ**: 先生（Google Classroom 経験者、Smalruby 初心者）/ 生徒（Smalruby 経験者、クラス機能初心者）

## サマリー

| 観点 | 発見数 | Critical | Warning | Info |
|------|--------|----------|---------|------|
| 機能面 | 2 | 0 | 1 | 1 |
| UI/UX | 3 | 0 | 1 | 2 |
| セキュリティ | 3 | 0 | 2 | 1 |

## 発見事項

---

### 機能面

#### [Warning] レート制限が Lambda インメモリ Map のため、インスタンス間で共有されない

- **場所**: `POST /classrooms/lookup`, `POST /classrooms/join`
- **期待**: docs/classroom/architecture.md に「IPベースのレート制限があります」と記載。prod: 60秒で50回、stg: 30秒で100回
- **実際**: Lambda の **インメモリ Map** で実装されているため、Lambda インスタンスが複数起動すると各インスタンスが独立にカウントする。結果として、同時に複数インスタンスが起動している場合にレート制限が事実上無効になる。stg 環境での動的テストでも 15連続リクエストで 429 は返されなかった
- **補足**: API Gateway 側にも `ThrottlingRateLimit: 10` (prod) が設定されているため、API Gateway レベルでは一定の保護がある。また参加コードの空間は約22億通り（30^6）のため、総当たりは現実的ではない
- **再現手順**: `for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" -H "Content-Type: application/json" -d "{\"joinCode\": \"TEST$(printf '%02d' $i)\"}" https://stg.classroom.api.smalruby.app/classrooms/lookup; done`

#### [Info] devlogin URL パラメータのドキュメント更新

- **場所**: docs/classroom/testing.md
- **対応**: `classrole` URL パラメータを廃止。`devlogin=<token>` のみで先生認証をバイパスし、「設定 → クラス管理」から手動でアクセスするフローに統一

---

### UI/UX

#### [Warning] 先生ペルソナ: 「クラス管理」への導線が見つけにくい

- **ペルソナ**: 先生（Smalruby 初心者）
- **場所**: メニューバー
- **問題**: 先生がクラスを管理するには「⚙ 設定 → クラス管理」をクリックする必要がある。しかし、メニューバーには「クラス」ボタンが目立つ位置にあり、先生がそこをクリックすると**生徒向けの参加コード入力画面**が表示される。Smalruby 初心者の先生は「クラス」ボタンで管理画面にアクセスできると期待するが、実際は異なるフローに入る
- **改善案**: 「クラス」ボタンのクリック時に、先生/生徒を選択するステップを設けるか、先生がログイン済みの場合はダッシュボードに直接遷移する。または、生徒の参加コード入力画面のヒントに「先生はこちら」のリンクを追加する
- **スクリーンショット**: review-01-student-join.png（ヒントに「設定 → クラス管理」の記載はあるが、目立たない）

#### [Info] 生徒ペルソナ: 参加コード入力で大文字/小文字の混乱

- **ペルソナ**: 生徒
- **場所**: 参加コード入力画面 (`student-join`)
- **問題**: 先生のクラス詳細画面では参加コードが小文字の装飾フォントで表示される（例: `f y 4 l f z`）。生徒が大文字で入力すると「次へ」ボタンが disabled のままになる場合がある（Playwright テストで確認: `FY4LFZ` では disabled、`fy4lfz` では enabled）。バックエンドは `.toUpperCase()` で正規化するが、フロントエンドのバリデーションが大文字を拒否している可能性がある
- **改善案**: フロントエンドの入力バリデーションで大文字/小文字を区別しないようにする。入力フィールドで自動的に小文字変換するか、両方を受け入れる

#### [Info] 先生ダッシュボード: サイドバーのクラス名と課題名の区別

- **ペルソナ**: 先生
- **場所**: 先生ダッシュボード（サイドバー）
- **問題**: サイドバーにクラス名（太字、グループヘッダー）と課題名（通常フォント）が表示されるが、同じクラス名で複数の課題がある場合（例: 「テスト8年1組」に「第１回チャットアプリを作ろう」が2つ）、どちらが目的の課題か区別しにくい
- **改善案**: 作成日時や参加コードを副情報として表示する（現在は `35 · phsjhf` で表示されており、実際にはある程度区別可能）

---

### セキュリティ

#### [Warning] CORS: OPTIONS プリフライトでヘッダーが返されない

- **カテゴリ**: CORS
- **場所**: API Gateway (`stg.classroom.api.smalruby.app`)
- **問題**: 動的テストで `curl -D - -H "Origin: https://evil.example.com" -X OPTIONS` を送信した結果、`Access-Control-*` ヘッダーが返されなかった。許可オリジン (`smalruby.app`) でも同様。CDK スタックでは `corsPreflight` が設定されているが、API Gateway HTTP API の CORS 設定がルートレベルで正しく適用されていない可能性がある
- **再現手順**: `curl -s -D - -H "Origin: https://evil.example.com" -X OPTIONS https://stg.classroom.api.smalruby.app/classrooms 2>&1 | grep -i "access-control"`
- **影響**: ブラウザからのクロスオリジンリクエストが失敗する可能性がある。ただし、実際のブラウザテストでは正常に動作しているため、API Gateway が内部的にプリフライトを処理している可能性もある
- **修正案**: API Gateway の CORS 設定を確認し、OPTIONS レスポンスに正しい `Access-Control-*` ヘッダーが含まれることを検証する

#### [Warning] DEV_BYPASS_TOKEN が Lambda 環境変数に平文で保存

- **カテゴリ**: 認証
- **場所**: `infra/smalruby-classroom/lib/classroom-stack.ts:204`, `lambda/handler.ts:24`
- **問題**: `DEV_BYPASS_TOKEN` が CDK の環境変数として平文で Lambda に渡されている。prod 環境では空文字列が設定される想定だが、`.env.prod` の設定ミスでトークンが prod に入ると、Google 認証をバイパスできる
- **影響**: prod に DEV_BYPASS_TOKEN が設定された場合、誰でも `Authorization: Bearer <token>` で先生としてログインでき、全クラスの情報にアクセスできる
- **修正案**: (1) prod デプロイ時に `DEV_BYPASS_TOKEN` が空であることを CDK レベルで保証する（例: `if (stage === 'prod' && devBypassToken) throw new Error()`）。(2) SSM Parameter Store に移行する

#### [Info] GSI ProjectionType.ALL で不要な属性が含まれる

- **カテゴリ**: 情報漏洩（潜在的）
- **場所**: `infra/smalruby-classroom/lib/classroom-stack.ts:72-74,112-114`
- **問題**: `joinCode-index`, `teacherSub-index`, `sessionToken-index` の全 GSI が `ProjectionType.ALL` を使用しており、インデックスに全属性がコピーされる。現時点では不要な属性の漏洩リスクは低いが、将来テーブルにセンシティブな属性（例: メールアドレス）が追加された場合、GSI 経由で意図せず露出する可能性がある
- **修正案**: 各 GSI の射影を必要な属性のみに制限する（`ProjectionType.INCLUDE` + `nonKeyAttributes`）

---

## 静的コードレビュー結果（セキュリティ）

### 確認済み項目（問題なし）

| カテゴリ | 確認内容 | 結果 |
|---------|---------|------|
| 認証 | 先生用エンドポイントが全て `verifyGoogleIdToken` を呼んでいる | OK |
| 認証 | 生徒用エンドポイントが `verifySessionToken` を呼んでいる | OK |
| 認証 | 認証不要エンドポイントは `lookup` と `join` のみ | OK |
| 認可 | `handleGetClassroom` で `teacherSub` チェックがある | OK |
| 認可 | `handleListMembers` で `teacherSub` チェックがある | OK |
| 認可 | `handleDeleteClassroom` で `teacherSub` チェックがある | OK |
| 認可 | `handleListSubmissions` で `teacherSub` チェックがある | OK |
| 認可 | `handleUpdateSubmission` で `teacherSub` チェックがある | OK |
| 認可 | 生徒の提出で `session.classroomId !== classroomId` チェックがある | OK |
| 認可 | 生徒の退出で `session.classroomId !== classroomId` チェックがある | OK |
| 入力検証 | `className` — 最大50文字制限 | OK |
| 入力検証 | `studentCount` — 1-50の範囲チェック | OK |
| 入力検証 | `joinCode` — 6文字、許可文字のみ、正規表現チェック | OK |
| 入力検証 | `nickname` — 最大20文字制限 | OK |
| 入力検証 | `projectName` — 最大100文字制限 | OK |
| 入力検証 | `teacherComment` — 最大500文字制限 | OK |
| 入力検証 | `screenshotCount` — 最大20制限 | OK |
| 情報漏洩 | エラーレスポンスにスタックトレースなし | OK |
| 情報漏洩 | `lookup` が `className`, `teacherSub` を返さない | OK |
| 情報漏洩 | コンソールログにトークンや API キーなし | OK |
| S3 | `BlockPublicAccess.BLOCK_ALL` が設定されている | OK |
| S3 | ライフサイクルルールでオブジェクトが自動削除される | OK |
| S3 | Presigned URL の有効期限が 300秒（5分） | OK |
| S3 | S3 キーのパストラバーサル防止（UUID ベース） | OK |
| DynamoDB | TTL が全テーブルに設定されている | OK |
| DynamoDB | 暗号化がデフォルトで有効 | OK |
| 席の競合 | `ConditionExpression` で二重着席を防止 | OK |
| 参加コード | `crypto.randomInt` で安全な乱数生成 | OK |
| セッション | `crypto.randomUUID` で安全なトークン生成 | OK |
| Lambda | タイムアウト30秒、メモリ256MB（適切） | OK |
| Lambda | 最小権限（DynamoDB ReadWrite + S3 Put/Read のみ） | OK |
| CloudWatch | ログ保持期間が設定されている（prod: 1ヶ月、stg: 1週間） | OK |
| 課題配信 | リンク URL のホスト名チェックがある（smalruby.app/smalruby.jp/localhost のみ許可） | OK |

### 動的テスト結果（stg API）

| テスト | 結果 | 備考 |
|--------|------|------|
| 認証なしアクセス | PASS | 401 が正しく返される |
| 不正トークンアクセス | PASS | 401 が正しく返される |
| クロスユーザーアクセス | PASS | 他人のクラスに 401 |
| 情報漏洩テスト | PASS | 内部情報の漏洩なし |
| 入力検証（長大入力） | PASS | 400 で拒否 |
| NoSQL インジェクション | PASS | 型チェックで拒否 |
| Lookup データ露出 | PASS | classroomId, studentCount, takenSeats のみ |
| S3 Presigned URL 期限 | PASS | 300秒 |
| CORS | 要確認 | OPTIONS ヘッダー未返却 |
| レート制限 | FAIL | 429 未検出 |

---

## 推奨アクション

1. **[Warning] レート制限の改善**: Lambda インメモリ Map の代わりに、DynamoDB や API Gateway のレート制限設定を活用する。現状は API Gateway レベルの throttling (prod: 10 req/s) が一定の保護を提供しているが、IP ベースの制限が効いていない
2. **[Warning] CORS 設定の確認**: stg 環境で OPTIONS プリフライトの `Access-Control-*` ヘッダーが返されない問題を調査する。ブラウザからの実動作に影響がないか確認
3. **[Warning] DEV_BYPASS_TOKEN の prod 保護**: prod デプロイ時にトークンが空であることを保証するガードを追加
4. **[Warning] 先生導線の改善**: 「クラス」ボタンから先生モードへの導線を改善。生徒モーダルに「先生はこちら」リンクを追加するか、ロール選択ステップを設ける
5. **[Info] 参加コードの大文字/小文字**: フロントエンドの入力バリデーションで大文字を受け入れるようにする
6. **[Info] GSI の射影最適化**: 将来のデータモデル変更に備えて `ProjectionType.INCLUDE` に変更を検討
