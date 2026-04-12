# セキュリティレビュー コンテキスト

## 目的

個人情報の漏洩を防ぎ、認可の不備による不正アクセスを検出する。静的なコードレビュー（CDK, Lambda）と動的な API テスト（本番エンドポイント）の両方を実施する。

## 絶対に守るべきルール

- **生徒の氏名・年齢・学校名が漏れないこと**
- 別の Google ユーザーが他人のクラス情報を閲覧できないこと
- 生徒が他のクラスや他の生徒のデータにアクセスできないこと
- 認証なしで保護されたエンドポイントにアクセスできないこと

**先生アカウントが乗っ取られた場合のリスクは対象外** — 先生自身のアカウント保護は Google 側の責任範囲。

## レビュー手順

### Step 1: 静的コードレビュー（CDK + Lambda）

#### 1a. CDK スタックの確認

`infra/<feature>/lib/` の CDK スタックを読み込み、以下を確認する:

**API Gateway:**
- [ ] CORS の allowOrigins が適切か（本番では `https://smalruby.app` と `https://smalruby.jp` のみ）
- [ ] 不要なメソッド（OPTIONS 以外）が許可されていないか
- [ ] レート制限が設定されているか

**Lambda:**
- [ ] 実行ロールが最小権限の原則に従っているか
- [ ] 環境変数にシークレットが平文で含まれていないか（SSM Parameter Store や Secrets Manager を使用すべき）
- [ ] タイムアウトが適切か（30秒以内）

**DynamoDB:**
- [ ] テーブルの暗号化が有効か（デフォルト: AWS owned key）
- [ ] TTL が設定されているか（データの自動削除）
- [ ] GSI の射影が必要最小限か（不要な属性を含んでいないか）

**S3:**
- [ ] パブリックアクセスがブロックされているか
- [ ] バケットポリシーが Lambda からのアクセスのみ許可しているか
- [ ] CORS が適切に設定されているか
- [ ] ライフサイクルルールで古いオブジェクトが自動削除されるか

**CloudWatch Logs:**
- [ ] ログの保持期間が適切か
- [ ] ログに個人情報（メールアドレス、氏名等）が含まれていないか

#### 1b. Lambda ハンドラーの確認

`infra/<feature>/lambda/` のハンドラーコードを読み込み、以下を確認する:

**認証・認可:**
- [ ] 先生用エンドポイントが全て Google ID Token 検証を行っているか
- [ ] 生徒用エンドポイントが Session Token 検証を行っているか
- [ ] 認証不要エンドポイント（lookup, join）が限定されているか
- [ ] 先生が自分のクラスのみ操作できるか（teacherSub でフィルタ）
- [ ] 生徒が自分のクラスのみ操作できるか（classroomId + memberId でフィルタ）

**入力検証:**
- [ ] 全入力フィールドの長さ制限があるか
- [ ] SQL インジェクション/NoSQL インジェクションの防止（DynamoDB の場合はパラメータバインディング）
- [ ] パストラバーサルの防止（S3 キーの構築時）

**情報漏洩:**
- [ ] エラーレスポンスにスタックトレースが含まれていないか
- [ ] lookup エンドポイントが存在しないコードに対して情報を漏らさないか（タイミング攻撃）
- [ ] S3 Presigned URL の有効期限が短いか（15分以内推奨）
- [ ] API レスポンスに不要なフィールド（teacherSub, sessionToken 等）が含まれていないか

**レート制限:**
- [ ] 参加コードの総当たり攻撃を防ぐレート制限があるか
- [ ] レート制限がバイパスできないか（X-Forwarded-For 偽装等）

### Step 2: 動的 API テスト（本番エンドポイント）

本番の API エンドポイントに対してテストリクエストを送り、セキュリティを検証する。

**テスト実行前の注意:**
- テストで作成したクラスやメンバーは必ず削除する
- テストデータには識別可能なプレフィックス（例: `__security_test_`）を使う
- API の費用やレート制限に注意しつつ、十分な網羅性を確保する

#### 2a. 認証テスト

```bash
# API エンドポイントの取得
# docs/<feature>/architecture.md のカスタムドメインを参照

# 認証なしで先生用エンドポイントにアクセス（403 を期待）
curl -s -o /dev/null -w "%{http_code}" \
  https://<domain>/classrooms

# 不正なトークンで先生用エンドポイントにアクセス（401 を期待）
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer invalid-token" \
  https://<domain>/classrooms

# 不正なセッショントークンで生徒用エンドポイントにアクセス（401 を期待）
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer invalid-session-token" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://<domain>/classrooms/verify-session
```

#### 2b. 認可テスト（クロスユーザーアクセス）

**テスト方針:** 2つの異なる先生アカウント（または先生 + 生徒）で、互いのデータにアクセスできないことを確認する。

ローカル環境 + DEV_BYPASS_TOKEN を使う場合:
- テスト用のクラスを作成し、そのクラスに対して別トークンでアクセスを試みる

本番環境の場合:
- ユーザーに2つの Google アカウントでのログインを依頼するか、既存のテストクラスを使用する

```bash
# 先生Aが作ったクラスを先生Bが操作しようとする（403 を期待）
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <teacher_B_token>" \
  https://<domain>/classrooms/<teacher_A_classroom_id>

# 先生Aが作ったクラスのメンバーを先生Bが取得しようとする（403 を期待）
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <teacher_B_token>" \
  https://<domain>/classrooms/<teacher_A_classroom_id>/members

# 生徒が先生用エンドポイントにアクセスしようとする（401/403 を期待）
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <student_session_token>" \
  https://<domain>/classrooms
```

#### 2c. 参加コード総当たり耐性

```bash
# 短時間に大量の lookup リクエストを送り、レート制限が発動するか確認
for i in $(seq 1 60); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Content-Type: application/json" \
    -d "{\"joinCode\": \"TEST$(printf '%02d' $i)\"}" \
    https://<domain>/classrooms/lookup
done
# 途中で 429 が返されることを期待
```

#### 2d. 情報漏洩テスト

```bash
# 存在しない参加コードのレスポンスを確認（具体的なエラー情報が含まれないこと）
curl -s \
  -H "Content-Type: application/json" \
  -d '{"joinCode": "XXXXXX"}' \
  https://<domain>/classrooms/lookup

# エラーレスポンスにスタックトレースや内部情報が含まれないことを確認
curl -s \
  -H "Content-Type: application/json" \
  -d '{"invalid": "body"}' \
  https://<domain>/classrooms

# S3 Presigned URL の有効期限を確認
# (提出フローで取得した Presigned URL の expires パラメータを検査)
```

#### 2e. CORS テスト

```bash
# 許可されていないオリジンからのリクエスト
curl -s -D - \
  -H "Origin: https://evil.example.com" \
  -X OPTIONS \
  https://<domain>/classrooms \
  2>&1 | grep -i "access-control"
# Access-Control-Allow-Origin に evil.example.com が含まれないことを期待

# 許可されたオリジンからのリクエスト
curl -s -D - \
  -H "Origin: https://smalruby.app" \
  -X OPTIONS \
  https://<domain>/classrooms \
  2>&1 | grep -i "access-control"
# Access-Control-Allow-Origin: https://smalruby.app を期待
```

#### 2f. 入力検証テスト

```bash
# 非常に長い入力
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d "{\"className\": \"$(python3 -c 'print("A"*10000)')\"}" \
  https://<domain>/classrooms

# HTML/Script インジェクション
curl -s \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"className": "<script>alert(1)</script>"}' \
  https://<domain>/classrooms

# NoSQL インジェクション
curl -s \
  -H "Content-Type: application/json" \
  -d '{"joinCode": {"$ne": ""}}' \
  https://<domain>/classrooms/lookup
```

### Step 3: フロントエンドのセキュリティ確認

Playwright MCP を使って、ブラウザ側のセキュリティを確認する:

- [ ] localStorage に保存されるセッション情報に不要なデータが含まれていないか
- [ ] コンソールにセンシティブな情報（トークン、API キー）がログ出力されていないか
- [ ] ネットワークリクエストのヘッダーに不要な情報が含まれていないか

```javascript
// localStorage の内容を確認
const session = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('smalruby:classroom') || '{}')
);
// sessionToken 以外のセンシティブ情報が含まれていないことを確認

// コンソールログの確認
const consoleLogs = []; // browser_console_messages で取得
// トークンや API キーが含まれていないことを確認
```

## 発見事項の記録

各発見事項を以下の形式で記録する:

```
### [重要度] <タイトル>
- **カテゴリ**: 認可 / 情報漏洩 / 入力検証 / CORS / レート制限 / 暗号化 / ログ
- **場所**: <API エンドポイント or コード箇所（ファイルパス:行番号）>
- **問題**: <具体的な問題>
- **再現手順**: <curl コマンド or 手順>
- **影響**: <何が起きるか（例: 別のユーザーが生徒一覧を閲覧できる）>
- **修正案**: <具体的な修正提案>
```

## 判定基準

| 重要度 | 基準 |
|--------|------|
| Critical | 個人情報の漏洩が可能。認証/認可のバイパスが可能。データの改ざんが可能 |
| Warning | セキュリティのベストプラクティスに違反。将来の脆弱性につながる可能性 |
| Info | 防御的プログラミングの改善提案。ログや監視の強化提案 |
