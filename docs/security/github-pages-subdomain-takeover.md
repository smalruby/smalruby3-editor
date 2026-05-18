# GitHub Pages サブドメイン乗っ取り対策

> **🆕 Smalruby 独自** — smalruby 組織が管理する全 GitHub Pages ドメインのサブドメイン乗っ取り (Subdomain takeover) 対策の運用ドキュメント。stretch3 の乗っ取り事例 (2026-05-18) を受けて整備。

## 目的

`smalruby.app` / `smalruby.jp` および関連サブドメインで、stretch3 と同種の GitHub Pages サブドメイン乗っ取りを受けないよう、防御の現状を記録し、平常時運用と緊急時対応を定義する。

## Threat Model

### 攻撃ベクトル

GitHub Pages のサブドメイン乗っ取りは以下の流れで成立する:

1. ドメイン所有者の DNS が GitHub Pages の共有 IP (`185.199.108-111.153`) または `<user>.github.io` への CNAME を指す
2. その先で配信していたリポジトリの Pages 設定が**何らかの理由で外れる**:
   - リポジトリが削除される / private 化される
   - リポジトリの Pages カスタムドメイン設定が削除される
   - Org の billing 状態変更で Pages が止まる
3. 別の GitHub アカウントが自分のリポジトリで **同じカスタムドメイン**を Pages に設定 → claim 成立
4. 攻撃者は元のドメインで任意のコンテンツを配信できる

最大のポイント: **DNS は GitHub Pages の共有 IP を指しているだけで、「どの GitHub アカウント宛か」は GitHub のリポジトリ Pages 設定で決まる**。

### 影響

- ブラウザ側からは `smalruby.app` のコンテンツとして見えるため、信用を悪用したフィッシング / マルウェア配布が可能
- 既に有効な HTTPS 証明書 (Let's Encrypt) が新所有者にも自動発行される
- SEO 上の被害 (悪意のあるコンテンツがインデックスされる)
- ブランド毀損

## 防御の現状

5 つのレイヤーで防御している。**Layer 1 が抜けると他のレイヤーだけでは止められない**ので最優先。

### Layer 1: GitHub Organization レベルでのドメイン検証 (最重要)

`smalruby.app` と `smalruby.jp` を **Verified custom domain** として GitHub に登録済み。

- 設定場所: https://github.com/organizations/smalruby/settings/pages
- 検証用 TXT レコード (DNS に**永続留置必須**、削除すると検証無効化):
  - `_github-pages-challenge-smalruby.smalruby.app`
  - `_github-pages-challenge-smalruby.smalruby.jp`
- 確認方法:
  ```bash
  dig +short _github-pages-challenge-smalruby.smalruby.app TXT
  dig +short _github-pages-challenge-smalruby.smalruby.jp TXT
  gh api repos/smalruby/smalruby.app/pages --jq .protected_domain_state          # "verified"
  gh api repos/smalruby/smalruby.github.com/pages --jq .protected_domain_state   # "verified"
  ```

効果: smalruby org 以外の GitHub アカウントは `smalruby.app` / `smalruby.jp` および任意の **immediate subdomain (1 段下)** を Pages のカスタムドメインに設定できない。仮に乗っ取りが先行発生していた場合、検証から **7 日後に GitHub が侵害側を強制解除**する。

**制約**: immediate subdomain しか保護されない。`a.smalruby.app` は保護されるが、`b.a.smalruby.app` のような 2 段下のサブドメインは別途保護が必要。

### Layer 2: HTTPS 強制化

全 Pages リポジトリで `https_enforced: true`。HTTP アクセスは自動的に HTTPS にリダイレクトされ、平文での MITM を防ぐ。

### Layer 3: Wildcard DNS の禁止

`*.smalruby.app` / `*.smalruby.jp` の wildcard DNS レコードは **設定しない**。理由:

- wildcard があると任意の深いサブドメインが GitHub Pages の共有 IP を指す形になる
- GitHub のドメイン検証は wildcard 経由のレコードを保護対象外とする
- 結果として attacker は `random-string.smalruby.app` のような任意名で claim 可能になる

### Layer 4: Org の 2FA 必須化

- メンバー全員に 2FA を強制 (`two_factor_requirement_enabled: true`)
- メンバーアカウント乗っ取り → リポジトリ Pages 設定改ざん → 配信内容侵害 という経路を遮断

### Layer 5: 不要 fork の archive

役目を終えた fork は archive する。
- archive 中は push / Issue / PR / Actions すべて停止 → アカウント乗っ取り経由でも push 不可
- Pages は archive 後も配信継続 (止めたいなら別途 Pages を Unpublish)
- unarchive で完全復元可能 (admin/owner 権限)

### Layer 6: CAA レコードによる証明書発行 CA の制限

`smalruby.app` / `smalruby.jp` の DNS apex に CAA レコードを設定し、**Smalruby が実際に使う CA 以外からの証明書発行を CA 側でブロック**させる深層防御。仮に DNS をのっとられても、攻撃者が任意の CA で `smalruby.app` 名義の証明書を取得する難易度を上げる。

| ドメイン | CAA |
|---|---|
| `smalruby.app` | `0 issue "letsencrypt.org"` (GitHub Pages 用) |
| `smalruby.app` | `0 issue "amazon.com"` `0 issue "amazontrust.com"` `0 issue "awstrust.com"` `0 issue "amazonaws.com"` (AWS ACM 用、4 識別子すべて) |
| `smalruby.app` | `0 issuewild ";"` (wildcard 証明書を全 CA で禁止) |
| `smalruby.jp` | `0 issue "letsencrypt.org"` (GitHub Pages 用) |
| `smalruby.jp` | `0 issuewild ";"` (wildcard 証明書を全 CA で禁止) |

確認方法:
```bash
dig +short smalruby.app CAA
dig +short smalruby.jp CAA
```

**新しい CA や wildcard 証明書を使いたくなったときの注意**: `smalruby.jp` 配下に AWS リソースを追加するときは Amazon 系 4 識別子を CAA に追加する。wildcard 証明書 (例: `*.example.smalruby.app`) を取得したくなったら `issuewild` のホワイトリストを CA 名で追加する。**変更を忘れると証明書発行・更新がサイレントに失敗してサービスが停止する**ので、CAA 変更が必要なときは本ドキュメントを更新すること。

## ドメイン / リポジトリ棚卸し

### smalruby が管理するドメイン

| ドメイン | DNS 管理 | 用途 | サービス |
|---|---|---|---|
| `smalruby.app` (apex) | dnsv.jp | プロダクト本体 | GitHub Pages (`smalruby/smalruby.app`) |
| `api.smalruby.app` + `*.api.smalruby.app` | AWS Route53 | バックエンド API | AWS API Gateway / AppSync / Lambda |
| `smalruby.jp` (apex) | dnsv.jp | プロダクト本体 (旧) + 各 repo 配信中継 | GitHub Pages (`smalruby/smalruby.github.com`) |

### GitHub Pages を持つリポジトリ

| Repo | cname | 配信 URL | 状態 |
|---|---|---|---|
| `smalruby.app` | `smalruby.app` | https://smalruby.app/ | 🟢 現役 — smalruby3-editor から CI/CD で gh-pages push |
| `smalruby.github.com` | `smalruby.jp` | https://smalruby.jp/ | 🟢 現役 — 静的ランディング |
| `smalruby3-editor` | (なし) | smalruby.jp/smalruby3-editor/ | 🟢 現役 — エディタ本体配信 |
| `smalruby3-gui` | (なし) | smalruby.jp/smalruby3-gui/ | 🟡 archive 済 — smalruby3-editor monorepo 統合後の後継誘導ページ |
| `dxruby_sdl` | (なし) | smalruby.jp/dxruby_sdl/ | 🟡 active だが長期放置 — 歴史的資産として配信維持 (HTTPS 強制化のみ実施) |

cname なしの 3 つは `smalruby.github.io/<repo>/` 経由で配信される。`smalruby.github.io` は smalruby org 専用 namespace なので別組織が claim できない。

## 平常時の運用ルール

### 新しい Pages サイトを立ち上げるとき

1. 使うドメインが Org level で verified か確認 (apex / immediate subdomain のみ自動保護)
2. 孫サブドメイン以下を使う場合、新たに Org settings で verify を追加
3. `https_enforced: true` を必ず設定
4. CI/CD で gh-pages push する場合、`peaceiris/actions-gh-pages` の `cname` パラメータを設定

### 既存 Pages サイトを廃止するとき

**順序を間違えると dangling 状態になる**。必ずこの順:

1. **先に DNS を切り離す** — A レコード / CNAME を削除
2. **次にリポジトリ側の Pages 設定を削除** — Settings → Pages → "Unpublish site"
3. しばらく様子を見て再起動の見込みがなければ、Org settings の verified-domains からも該当ドメインを削除可 (TXT レコード自体は残してよい)

逆順 (リポジトリ側を先に消す) で進めると、DNS が dangling 状態になる時間ができる。Org verification があれば数日は守られるが、その間に外部 probe される可能性は残る。

### リポジトリを削除 / archive するとき

- **削除する場合**: Pages 設定があるならまず DNS を切り離してから削除する
- **archive する場合**: Pages は配信継続するため DNS 操作不要。upstream 追従の自動 Actions は停止する

### メンバー追加・削除時

- 新メンバー追加時は 2FA 設定済みであることを確認 (Org policy で必須化済みなので自動的にブロックされる)
- メンバー離脱時は org からも removed されていることを確認:
  ```bash
  gh api orgs/smalruby/members --jq '[.[] | .login]'
  ```

## 定期チェック

### 自動化されているチェック

`.github/workflows/security-monitor.yml` で毎日 04:00 JST に以下を自動チェックし、異常があれば `smalruby/smalruby3-editor` リポジトリに Issue を起票:

- DNS verification TXT の残存
- CAA レコードの内容
- 全 Pages リポジトリの `https_enforced` と `protected_domain_state`
- `smalruby.app` / `smalruby.jp` のコンテンツに `Smalruby` 文字列が含まれるか (改竄検知)

手動実行: GitHub Actions の "security-monitor" workflow → "Run workflow"

### 月次の手動チェック (自動化されていない項目)

```bash
# Pages リポジトリ棚卸し (新規追加・削除を検知)
gh api orgs/smalruby/repos --paginate \
  --jq '.[] | select(.has_pages == true) | "\(.name)\tarchived=\(.archived)\tpushed=\(.pushed_at)"'

# Org の 2FA enforcement (API 経由は admin:org PAT が必要)
gh api orgs/smalruby --jq '.two_factor_requirement_enabled'

# Outside collaborators (常に 0 であるべき)
gh api orgs/smalruby/outside_collaborators --jq 'length'

# Pending invitations (古い招待が残っていないか)
gh api orgs/smalruby/invitations --jq '[.[] | {login, role, created_at}]'
```

期待値:
- Pages リポジトリ数: 5 (新規追加があれば本ドキュメントに追記)
- `two_factor_requirement_enabled: true`
- outside_collaborators: 0
- pending invitations: 0 件 or 業務に必要なもののみ

### 四半期

- DNS 管理画面 (dnsv.jp) で `smalruby.app` / `smalruby.jp` のレコード一覧を確認:
  - 不要な CNAME / A レコードを削除
  - wildcard レコードが追加されていないか確認
  - `_github-pages-challenge-smalruby.*` の TXT レコードが残っているか確認
- AWS Route53 で `api.smalruby.app` の hosted zone を確認:
  - 不要なサブドメインがないか
  - CNAME の指す先 (S3 / CloudFront / API Gateway / AppSync) が実在するか (= AWS リソース dangling 確認)

### 年次

- PAT の expiration 前に再発行 (admin:org 系の権限を保持しているトークン)
- 本 Runbook の内容が現状と乖離していないか見直し
- ブランチ保護ルール / Actions secrets / Webhooks の棚卸し

## 緊急時対応 — takeover 検知時

### 検知シグナル

- `https://smalruby.app/` または `https://smalruby.jp/` が見覚えのないコンテンツを返す
- ユーザ報告 / SNS / フィードバック経由で異常コンテンツの指摘
- Google Search Console の異常な検索結果
- 監視 Action (将来実装) が content-mismatch を検知

### 一次対応

1. **影響範囲確認** — どのドメイン / サブドメインが乗っ取られたか:
   ```bash
   curl -sI https://smalruby.app/ | head -10
   curl -sI https://smalruby.jp/ | head -10
   gh api repos/smalruby/smalruby.app/pages --jq .
   gh api repos/smalruby/smalruby.github.com/pages --jq .
   ```
2. **DNS を一時切り離し** — 該当ドメインの A レコード / CNAME を削除。ブラウザでは到達不可になる (DNS TTL 分は残る)。これにより被害が拡大しないようにする。
3. **GitHub Pages リポジトリの状態確認**:
   - 自分の管理リポジトリの Pages 設定が消えていないか
   - 消えていれば再設定 (cname 再投入)
   - `cname` 設定が他の値に書き換わっていないか
4. **乗っ取られた相手リポジトリの特定**:
   - 可能なら GitHub Support に通報
   - verified-domain 機能による自動解除 (検証から 7 日後) を待つのが基本路線
5. **公式アナウンス** — SNS / Discord / メール等で乗っ取り発生中であることをユーザに告知。アクセスを促さない。

### 二次対応

- 検証済みドメイン (`protected_domain_state: "verified"`) であれば **検証から 7 日後に GitHub が侵害側を強制解除**する
- 7 日以内に元の状態に戻したいなら GitHub Support に escalate

### 復旧

1. DNS を元に戻す (smalruby が運用する正しいリポジトリの Pages を指すよう A レコード再設定)
2. リポジトリ Pages 設定でカスタムドメインを再設定 + verify
3. CI/CD でコンテンツを再デプロイ
4. インシデント記録 (経緯 / 原因 / 復旧手段 / 再発防止) を本ドキュメントに追記

## 関連リンク

- [Verifying your custom domain for GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [About custom domains and GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)
- [Archiving repositories — GitHub Docs](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories)
- [Can I take over XYZ? — EdOverflow](https://github.com/EdOverflow/can-i-take-over-xyz)

## TODO (将来実装)

- [ ] `*.api.smalruby.app` の AWS dangling 確認スクリプト — S3 / CloudFront / API Gateway / AppSync の取り違え検知
- [ ] ACM 未使用証明書の自動クリーンアップ (CDK で新しい証明書を発行するたびに古いものが残る、運用上のノイズ削減)
