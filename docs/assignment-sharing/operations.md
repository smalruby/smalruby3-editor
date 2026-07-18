# みんなの課題 運用手順書（通報対応）

> **🆕 Smalruby 独自** — みんなの課題（共有課題ライブラリ、EPIC #1066）の通報対応を行う運用者向け手順。

対象読者: AWS クレデンシャル（SSO）を持つ運用者。設計の背景は EPIC #1066 / スパイク #1067 の Decision Log（D3: 事後対応型モデレーション）。

> **将来**: Admin SPA（EPIC #1073）が完成したら通報対応は管理画面に移行する。本 CLI はそれまでの最小ツール兼フォールバック。

## モデレーション方針

- **事後対応型**: 投稿は即公開（投稿には先生ログイン + CC BY 4.0 同意が必須）。先生からの通報を受けて運用者が確認・対応する
- **物理削除はしない**: 対応は `unpublish`（`status: 'unlisted'` = カタログから非表示）。誤対応は `republish` で復元できる
- **投稿者への連絡手段は保持していない**（D6: 個人情報最小化のため email を持たない）。対応は非公開化のみで完結させる
- 通報レコードは 90 日で自動削除（TTL）。通報者の識別子（reporterSub）は悪用対策の内部データで、CLI にも表示されない

## 前提条件

```bash
cd infra/smalruby-classroom

# ステージを .env symlink で選択（deploy と同じ流儀）
ls -la .env            # -> .env.stg または .env.prod

# AWS クレデンシャル（コンテナ内 SSO）
aws sso login --sso-session smalruby --use-device-code   # 失効時のみ
export AWS_PROFILE=smalruby AWS_REGION=ap-northeast-1
eval "$(aws configure export-credentials --profile smalruby --format env)"
```

## 通報対応フロー

```text
1. 通報キューを確認
   npx ts-node bin/shared-assignments-admin.ts list-reports
   → 通報の多い投稿から順に、タイトル・status・通報理由が並ぶ

2. 内容を確認
   npx ts-node bin/shared-assignments-admin.ts show <sharedId>
   → 説明ページ全文・補足 URL・投稿者表示名・属性を表示
   （補足 URL の先はブラウザで確認。リンク先は投稿者管理のため慎重に）

3. 判断
   ├─ 問題あり（下記基準）→ 非公開化:
   │    npx ts-node bin/shared-assignments-admin.ts unpublish <sharedId>          # dry-run
   │    npx ts-node bin/shared-assignments-admin.ts unpublish <sharedId> --apply  # 実行
   └─ 問題なし → 対応不要（通報は 90 日で自動消滅）

4. 誤対応の復元
   npx ts-node bin/shared-assignments-admin.ts republish <sharedId> --apply
```

## 非公開化の判断基準（目安）

| 該当 | 対応 |
|------|------|
| 個人情報（生徒名・学校の内部情報等）が含まれる | 即 unpublish |
| 補足 URL が課題と無関係・不適切なサイト | 即 unpublish |
| 著作権侵害の疑い（第三者の教材の丸写し等） | unpublish して様子見 |
| 授業として低品質・単なる好みの問題 | 対応しない（通報理由に返答する術はない） |

## 補足

- 取り込み済みの課題は各先生のクラス内のスナップショットなので、**unpublish しても既に取り込んだ先生には影響しない**
- 投稿の実体（S3 `shared/{sharedId}/`）は unpublish でも残る（復元可能性のため）。完全削除が必要な法的要請の場合のみ AWS コンソールで S3 オブジェクトと DynamoDB アイテムを手動削除する
