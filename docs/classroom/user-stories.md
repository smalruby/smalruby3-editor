# ユーザーストーリー

## ペルソナ

### 先生ペルソナ

- **前提知識**: Google Classroom は日常的に使っている。Google アカウントでのログインや、コースの管理に慣れている
- **はじめて**: Smalruby を使うのは初めて。プログラミング教育ツールの操作経験が少ない
- **目的**: 授業でプログラミングの課題を出し、生徒の作品を確認・返却したい
- **利用シナリオ**: 授業の準備としてクラスを作成し、授業中に生徒の参加状況と提出を確認する

### 生徒ペルソナ

- **前提知識**: Smalruby でブロックプログラミングや Ruby コードを書くことには慣れている
- **はじめて**: クラス機能を使うのは初めて。参加コードやクラスの仕組みを知らない
- **目的**: 先生の指示に従ってクラスに参加し、作品を提出したい
- **利用シナリオ**: 授業の最初に参加コードを入力してクラスに参加し、授業の最後に作品を提出する

---

## 先生ロール

### 1. クラスを作成する

先生は授業の課題ごとにクラスを作成し、生徒に参加コードを伝えます。

```mermaid
sequenceDiagram
    participant T as 先生
    participant UI as Smalruby
    participant API as Backend

    T->>UI: メニューバー「クラス」クリック
    T->>UI: 「先生」を選択
    T->>UI: Google ログイン
    UI->>API: ID Token で認証
    T->>UI: 「クラスをつくる」
    T->>UI: クラス名・人数を入力して作成
    UI->>API: POST /classrooms
    API-->>UI: classroomId, joinCode
    UI-->>T: 参加コード表示
    T->>T: 参加コードを生徒に伝える（口頭/板書/リンク共有）
```

**ポイント:**
- クラス名は**課題名**にすることを推奨（例: 「3時間目: チャットアプリをつくろう」）
- 参加コードは6文字の英数字（紛らわしい文字 I, O, 0, 1 は除外）
- 「招待リンクをコピー」で URL を共有可能

### 2. Google Classroom からインポートする

Google Classroom を使っている場合、コースをインポートして自動的にクラスを作成できます。

```mermaid
sequenceDiagram
    participant T as 先生
    participant UI as Smalruby
    participant API as Backend
    participant GC as Google Classroom

    T->>UI: 「Google Classroom からインポート」
    UI->>T: Google Classroom へのアクセス許可を要求
    T->>UI: 許可
    UI->>API: GET /classrooms/google-courses
    API->>GC: コース一覧取得
    GC-->>API: コース情報
    API-->>UI: コース一覧
    T->>UI: コースを選択して「インポート」
    UI->>API: POST /classrooms/google-import
    API-->>UI: クラス作成完了（生徒数は自動取得）
```

### 3. 提出を確認する

先生はクラス詳細画面で、生徒の参加状況と提出を一覧で確認できます。

```mermaid
sequenceDiagram
    participant T as 先生
    participant UI as Smalruby
    participant API as Backend

    T->>UI: クラス一覧からクラスを選択
    UI->>API: GET /classrooms/{id}/members
    UI->>API: GET /classrooms/{id}/submissions
    API-->>UI: メンバー・提出情報
    UI-->>T: 座席グリッド表示（着席/提出済み/未提出）
    T->>UI: 生徒のセルをクリック
    UI-->>T: 提出の詳細（サムネイル/スクリーンショット）
    T->>UI: 「Smalruby で開く」で作品を確認
    T->>UI: 「返却」ボタン + コメント入力
    UI->>API: PATCH /classrooms/{id}/submissions/{subId}
    API-->>UI: 返却完了
```

**座席グリッド表示:**
- 空席 → グレー
- 着席（未提出）→ 青
- 提出済み → 緑
- 返却済み → オレンジ

### 4. Google Classroom に課題を配信する

Google Classroom にリンクしたクラスでは、Smalruby の課題リンクを Google Classroom に投稿できます。

```mermaid
sequenceDiagram
    participant T as 先生
    participant UI as Smalruby
    participant API as Backend
    participant GC as Google Classroom

    T->>UI: クラス詳細画面で「課題を配信」
    T->>UI: タイトル・説明を入力
    T->>UI: 「Google Classroom に配信」
    UI->>API: POST /classrooms/{id}/google-assignment
    API->>GC: POST courseWork
    GC-->>API: 課題作成完了
    API-->>UI: 成功
    UI-->>T: 「配信しました！」
```

### 5. クラスを削除する

授業が終わったクラスは削除（アーカイブ）できます。生徒のセッションは無効化されます。

---

## 生徒ロール

### 1. クラスに参加する

生徒は先生から教えてもらった参加コードと自分の席番号でクラスに参加します。

```mermaid
sequenceDiagram
    participant S as 生徒
    participant UI as Smalruby
    participant API as Backend

    S->>UI: メニューバー「クラス」クリック
    S->>UI: 「生徒」を選択
    S->>UI: 参加コード入力
    UI->>API: POST /classrooms/lookup
    API-->>UI: クラス情報 + 空席リスト
    UI-->>S: クラス名・席番号グリッド表示
    S->>UI: 自分の席番号を選択
    S->>UI: 「参加」ボタン
    UI->>API: POST /classrooms/join
    API-->>UI: sessionToken
    UI-->>S: 「参加しました！」
```

**ポイント:**
- アカウント作成不要（参加コード + 席番号で参加）
- 席番号は出席番号と対応させる想定
- 既に使われている席番号はグレーアウト
- セッションはブラウザに保存され、ページを閉じても有効

### 2. 作品を提出する

参加中の生徒は、現在のプロジェクトをワンクリックで提出できます。

```mermaid
sequenceDiagram
    participant S as 生徒
    participant UI as Smalruby
    participant API as Backend
    participant S3 as S3

    S->>UI: メニューバー「クラス」クリック
    UI-->>S: 提出状況画面
    S->>UI: 「提出」ボタン
    UI-->>S: 確認画面（サムネイルプレビュー）
    S->>UI: 「提出する」
    UI->>API: POST /classrooms/{id}/submissions
    API-->>UI: Presigned URLs
    UI->>UI: プロジェクト保存 + サムネイル/スクリーンショット生成
    UI->>S3: PUT project.sb3 (Presigned URL)
    UI->>S3: PUT thumbnail.png (Presigned URL)
    UI->>S3: PUT screenshot-*.png (Presigned URL)
    UI-->>S: 「提出しました」
```

**ポイント:**
- 提出は何度でもやり直せる（再提出で上書き）
- 先生が「返却」した場合もコメント付きで表示される
- 提出済み/返却済みのステータスはリアルタイムで更新

### 3. 参加リンクから直接参加する

先生が共有した参加リンクからアクセスすると、自動的にクラス参加フローが開始されます。

```
https://smalruby.app?classcode=ABC123
```

URL に `classcode` パラメータがあると、モーダルが自動で開き、参加コード入力をスキップして席番号選択画面に遷移します。

### 4. クラスから退出する

生徒はいつでもクラスから退出できます。退出するとセッションが無効化され、提出データは保持されます。

---

## 典型的な授業の流れ

```mermaid
graph LR
    A["先生: クラス作成"] --> B["先生: 参加コードを板書"]
    B --> C["生徒: 参加コード入力"]
    C --> D["生徒: 席番号選択"]
    D --> E["生徒: プログラミング"]
    E --> F["生徒: 作品を提出"]
    F --> G["先生: 提出を確認"]
    G --> H["先生: コメント付きで返却"]
    H --> I["生徒: コメントを確認"]
    I --> J["生徒: 修正して再提出"]

    style A fill:#4CAF50,color:#fff
    style F fill:#2196F3,color:#fff
    style G fill:#FF9800,color:#fff
    style H fill:#FF9800,color:#fff
```

1. **授業開始前**: 先生がクラスを作成（1分）
2. **授業開始時**: 参加コードを板書、生徒が参加（2-3分）
3. **授業中**: 生徒がプログラミング
4. **授業終盤**: 生徒が作品を提出（30秒）
5. **授業後**: 先生が提出を確認し、コメント付きで返却
