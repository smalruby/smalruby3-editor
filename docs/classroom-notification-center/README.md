# クラス管理 お知らせ通知センター & 課題共有パイプライン（トピック集約）

> **🆕 Smalruby 独自** — topic ブランチ `topic/classroom-notification-center` で実装した 3 つの EPIC を横断的にまとめた紹介ページ。各機能の一次ドキュメントは下記のとおり別にあり、ここは**全体像とスクリーンショットの集約**です。

運営（Admin）が良い課題を見つけ → 作成した先生に届け → 先生が「みんなの課題」へ公開する、という一連の流れを支える 3 機能：

| EPIC | 機能 | 一次ドキュメント |
|------|------|-----------------|
| #1111 | お知らせ通知センター（通知の共通土台） | [`docs/classroom/`](../classroom/ui-ux.md) ・ [`docs/admin/`](../admin/README.md) |
| #1110 | Admin による課題推薦（限定公開 → みんなの課題への発展） | [`docs/assignment-sharing/`](../assignment-sharing/README.md) ・ [`docs/admin/`](../admin/README.md) |
| #1106 | 有益な課題を先生に「みんなの課題へ共有」促す | [`docs/classroom/`](../classroom/ui-ux.md) ・ [`docs/admin/`](../admin/README.md) |

## パイプライン

```
限定公開（合言葉・内輪／先生）
  → 運営が把握（限定公開タブ #1110 / 有益候補ダッシュボード #1106）
  → 推薦・推奨（お知らせ #1111 が先生に届く）
  → 全体公開（CC BY 4.0 同意して先生本人が公開）
```

- 公開は著作権（CC BY 4.0）の都合で**必ず先生本人**が行う（運営は代理公開しない）
- 2 つの「気づき」経路（#1110 の推薦 / #1106 の共有推奨）は、どちらも #1111 のお知らせ🔔 に集約され、クリックで該当画面へジャンプする

## スクリーンショット

| ファイル | 内容 |
|---------|------|
| `screenshots/0101-notification-bell.png` | #1111 タイトルバーの 🔔 + 未読バッジ |
| `screenshots/0102-notification-panel.png` | #1111 お知らせ一覧パネル |
| `screenshots/0103-admin-notify-form.png` | #1111 管理 SPA の先生へのお知らせ送信フォーム |
| `screenshots/0201-mine-recommended-badges.png` | #1110 先生「自分の投稿」の 限定公開 / 推薦 バッジ |
| `screenshots/0202-broaden-form.png` | #1110 全体公開フォーム（編集モード） |
| `screenshots/0203-admin-shared-recommend.png` | #1110 管理 SPA 限定公開タブ + 推薦の確認 |
| `screenshots/0301-share-suggestion-banner.png` | #1106 課題詳細の共有促しバナー |
| `screenshots/0302-board-share-suggested.png` | #1106 課題一覧（ボード）の「共有おすすめ」マーク |
| `screenshots/0303-admin-recommend-sharing.png` | #1106 管理 SPA クラス詳細の共有推奨の確認 |
| `screenshots/0304-admin-overview-candidates.png` | #1106 俯瞰ダッシュボードの有益候補 |

## 機能紹介プレゼン（HTML）

人間が機能を把握するための HTML スライドは **git 管理外の `notes/topic-classroom-notification-center/index.html`** にあります（上記スクリーンショットを相対パスで参照。ブラウザで直接開けます）。
