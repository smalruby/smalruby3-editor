# プログラム不具合報告 (Bug Report)

> **🆕 Smalruby 独自** — upstream Scratch に存在しない、Smalruby のために新規追加された機能。

ユーザーが「プログラムの不具合」を、**編集中の作品を添付して**報告できる機能。報告者は
Google / Microsoft アカウントでログインし、開発者 (管理者) が対応した結果 (状態・返信) を
アプリ内で確認できる。機能要望など不具合以外のフィードバックは従来どおり
[Google フォーム](https://docs.google.com/forms/d/e/1FAIpQLSemSOgv8TlJXF6vmFzVm5yUdcNZVMEKBcBcsKHnbW0RFmU3sg/viewform)
を使う (本機能の対象外)。

## 解決する問題

エディタ右下の「フィードバックを送信」(Google フォーム) には次の課題があった:

1. **不具合報告に作品 (プログラム) が添付されない** → 開発側が再現できない
2. **メールアドレスしか得られず、解消結果を報告者に伝えられない**

本機能はこの 2 点を、作品の自動添付とアカウントログイン (＋アプリ内返信) で解消する。

## 使い方 (報告者)

1. エディタ右下の「フィードバックを送信」の隣にある **「不具合を報告」** をクリック
   （`BUG_REPORT_API_ENDPOINT` が設定されているときのみ表示）
2. 初回は **軽いおしらせ** が出る。「作品が開発者に送られる（公開はされない・見えるのは
   本人と開発者だけ）」「直ったら知らせるのでログインが必要」「個人情報は書かない」を案内し、
   **OK で進む**（18歳/保護者同意のチェックは無く、生徒が気軽に進められる。保護者向けの
   1 行は情報提供のみ。1 回だけ表示、`localStorage` に記録）
3. **Google または Microsoft でログイン**
4. 不具合の説明 (何をした / どうなった / どうなってほしかった) を入力して送信。
   今編集している作品 (sb3)・サムネイル・ブロックのスクリーンショットが自動添付される
5. 後日、同じアカウントでログインして **「わたしの不具合報告」** を開くと、状態
   (受付ました / 対応中 / 直りました / 対応終了) と開発者からの返信を確認できる
6. 各報告の **✗（一覧からかくす）** で、不要になった報告を自分の一覧から消せる。✗ を押すと
   即座に一覧から消え、**「けすわけではない」**ことを伝える Undo トースト（「もとにもどす」）が
   数秒表示される。**これは削除ではなく非表示**（サーバーには `hiddenByOwner` フラグで残り、
   開発者は引き続き対応できる）。Undo トーストの「もとにもどす」だけが再表示手段。

## 一覧からかくす（hiddenByOwner）

報告者が ✗ を押すと `PATCH /bug-reports/{reportId}` (`{hidden:true}`、所有者のみ) で
`hiddenByOwner` が立ち、`GET /bug-reports` の結果から除外される。**行は削除されず**、管理者
(`GET /admin/bug-reports`) は `hiddenByOwner` 付きで全件を見られる（クローズ判断の材料）。
「もとにもどす」は `{hidden:false}` で再表示する。サーバーに残すことで「削除したのに残って
いて問題」を防ぐ設計。

**管理者が更新したら自動で再表示**: 報告者が非表示にした後でも、管理者が
`PATCH /admin/bug-reports/{reportId}`（状態変更・返信）を行うと `hiddenByOwner` が
`false` に戻り、報告者の一覧に再び現れる。開発者からの進捗・返信を見逃さないため。

✗ ボタンは Smalruby 標準のクローズアイコン（`components/close-button` と同じ「+」を 45°
回転した白アイコン + 色付き円）を使用。

## アクセス制御・プライバシー

送った作品を見られるのは **報告者本人と管理者だけ**。

- S3 バケットは Block Public Access 全 ON。作品は短命の presigned URL 経由のみ取得可能で、
  **ダウンロード URL は管理者にのみ発行される** (報告者は状態・返信のみ閲覧、作品 DL 不可)
- `GET /bug-reports` は ID Token の `sub` に一致する自分の報告だけを返す。S3 キーや
  DL URL は一切返さない
- 管理者専用 API (`/admin/*`) は管理者以外には 403
- メールアドレスは管理者にのみ表示。GitHub Issue 化する際もマスクする

詳しいセキュリティ重点項目は [Issue #731](https://github.com/smalruby/smalruby3-editor/issues/731) と
`.claude/rules/infra/smalruby-bug-report.md` を参照。

## 複数管理者

管理者は **verified email** で照合される (classroom の co-teacher と同型)。最初の管理者は
`BOOTSTRAP_ADMIN_EMAILS` 環境変数でブートストラップし、以降は既存管理者が
`POST /admin/admins` (または `/bug-report` スキル) で追加する。ブートストラップ管理者は
API では削除できない。

> in-app 管理ダッシュボード UI は段階導入 (別 Issue)。当面の管理は `/bug-report` スキル
> (AWS 直接) で行う。

## アーキテクチャ

```
エディタ (scratch-gui)                         smalruby-bug-report (AWS)
┌──────────────────────────┐                  ┌───────────────────────────┐
│ legalLinks「不具合を報告」 │                  │ API Gateway HTTP API v2    │
│   ↓                       │   ID Token        │   ↓                        │
│ bug-report-modal          │ ───────────────→ │ Lambda (handler.ts)        │
│   consent → login → form  │                  │   verifyIdToken (G/MS)     │
│   ↓ vm.saveProjectSb3()   │  presigned PUT    │   isAdminIdentity          │
│ use-bug-report-submit ────────────────────→  │   DynamoDB: BugReports     │
│ 「わたしの不具合報告」 ←──── status/reply ────  │              BugReportAdmins│
└──────────────────────────┘                  │   S3 (BlockPublicAccess)   │
                                               └───────────────────────────┘
        開発者: /bug-report スキル (AWS 直接) → DynamoDB/S3 → GitHub Issue 化 → 返信書き戻し
```

## 主要ファイル

### フロントエンド (`packages/scratch-gui`)

| ファイル | 役割 |
|---------|------|
| `src/components/gui/gui.jsx` | `legalLinks` の「不具合を報告」リンク + モーダル配置 (Smalruby マーカー) |
| `src/components/bug-report-modal/bug-report-modal.jsx` | モーダル UI (login / form / submitting / success / myReports) |
| `src/components/bug-report-consent/bug-report-consent.jsx` | 初回の軽いおしらせダイアログ（同意ゲートなし） |
| `src/containers/bug-report-modal.jsx` | 状態管理・同意・ログイン・送信・一覧のオーケストレーション |
| `src/containers/use-bug-report-submit.js` | 作品 sb3 + サムネ + スクショの presigned アップロード |
| `src/lib/bug-report-api.js` | API クライアント |
| `src/lib/teacher-auth.js` | Google/Microsoft ログイン (classroom と共用) |
| `src/reducers/bug-report.js` | モーダル表示状態・ビュー |

### バックエンド (`infra/smalruby-bug-report`)

| ファイル | 役割 |
|---------|------|
| `lib/smalruby-bug-report-stack.ts` | CDK スタック (API + Lambda + DynamoDB×2 + S3) |
| `lambda/handler.ts` | 認証・認可・presigned 発行・監査ログ・バリデーション |

### 開発者ツール

| ファイル | 役割 |
|---------|------|
| `.claude/skills/bug-report/SKILL.md` | `/bug-report` トリアージスキル (一覧・DL・Issue 化・返信・管理者管理) |

## 設定・データ永続化

| 種別 | キー | 説明 |
|------|------|------|
| localStorage | `smalruby:bugReportConsent` | 初回共有同意フラグ (`'true'`) |
| 環境変数 (webpack) | `BUG_REPORT_API_ENDPOINT` | バックエンドのエンドポイント。未設定だとリンク非表示 |
| 環境変数 (Lambda) | `BOOTSTRAP_ADMIN_EMAILS` | 初期管理者 (カンマ区切り) |
| 環境変数 (Lambda) | `RESOLVED_TTL_DAYS` | resolved/wont_fix 後の自動削除日数 (stg 1 / prod 30) |

## API エンドポイント

| Path | Method | 認可 | 説明 |
|------|--------|------|------|
| `/bug-reports` | POST | 認証済み | 報告作成 + presigned upload URL |
| `/bug-reports` | GET | 認証済み | 自分の報告一覧 (状態 + 返信、DL URL なし、非表示は除外) |
| `/bug-reports/{reportId}` | PATCH | 認証済み (所有者) | `{hidden}` で一覧からかくす/もどす (削除ではない) |
| `/admin/bug-reports` | GET | 管理者 | 全報告一覧 (非表示含む、`hiddenByOwner` 付き) + サムネ DL |
| `/admin/bug-reports/{reportId}` | GET / PATCH | 管理者 | 詳細 (作品 DL) / 状態・返信更新 |
| `/admin/admins` | GET / POST | 管理者 | 管理者一覧 / 追加 |
| `/admin/admins/{email}` | DELETE | 管理者 | 管理者削除 |

## 画面サイズ / モバイル対応

- モーダルは **全画面表示**（チュートリアル等と同じ `fullScreen` モーダル）。情報量が多い
  ため全画面にし、本文は縦スクロール可能。中身は最大幅 640px で中央寄せ（デスクトップは
  読みやすく、SP は画面幅にフィット）。
- **PC / iPad**: 画面右下 `legalLinks` の「不具合を報告」リンクから開く。
- **スマホ (MobileGui)**: `legalLinks` は非表示のため、**ハンバーガーメニュー → ヘルプ →
  「不具合を報告」**（`mobile-drawer-help-report-bug`）から開く。全画面モーダルでフォーム・
  ボタンが SP でもすべて表示・操作可能。

### ローカル開発でのログイン

Google/Microsoft の OAuth は `http://localhost:8601` が生成元として登録されていないため
ローカルでは通らない。classroom と同様 **`?devlogin=<DEV_BYPASS_TOKEN>`** URL パラメータで
バイパスできる（非 prod のみ。トークンはバンドルに焼き込まず URL から渡す）。
