# 本番 smalruby.app の配信（GitHub Pages → S3 + CloudFront）

> **🆕 Smalruby 独自** — 本番のエディタ（`https://smalruby.app/`）をどこから、どう配信するか。いまの GitHub Pages から、AWS の S3 + CloudFront へ移す計画と手順。

この文書は「移す前の構成」「移した後の構成」「切り替えと戻し方」「キャッシュと PWA」「費用」「人間がやる作業」をまとめた設計書。進め方の単位（sub-issue）は親 Issue #1931 にある。配信基盤の CDK の細かい作りは [`docs/infra/smalruby-web-hosting.md`](../infra/smalruby-web-hosting.md)。

## なぜ移すか

- GitHub Pages への依存をなくす。ビルドしたものを S3 に置くだけにする（別リポジトリへの push や `.nojekyll` / `CNAME` の管理が要らなくなる）。
- アクセスログの記録や、必要になったときのフィルタリング（WAF）ができる。
- キャッシュの長さやヘッダを自分たちで決められ、配信の規模もこちらで調整できる。

ブランチプレビュー（`https://preview.smalruby.app/<slug>/`）は先に S3 + CloudFront へ移してあり、本番はその仕組みを土台にする。

## いまの配信（移す前）

```
ブラウザ ── https://smalruby.app/ ──▶ お名前.com の DNS（01〜04.dnsv.jp）
                                       │  smalruby.app  A ×4 → 185.199.108〜111.153
                                       ▼
                                   GitHub Pages（リポジトリ smalruby/smalruby.app）
```

| 項目 | いまの値 |
|---|---|
| レジストラ / DNS | どちらもお名前.com。ネームサーバーは `01〜04.dnsv.jp` |
| 配信 | GitHub Pages。`.github/workflows/ci-cd.yml` の `build-and-deploy` が、develop への push のたびに `packages/scratch-gui/dist` を外部リポジトリ `smalruby/smalruby.app` へ push する（`cname: smalruby.app`）。続けて管理 SPA（`packages/admin/build`）を `admin/` に置く |
| 証明書 | GitHub Pages が Let's Encrypt で自動発行（CAA で `letsencrypt.org` を許可している） |
| キャッシュ | GitHub Pages の既定（全ファイル `Cache-Control: max-age=600`）。自分たちでは変えられない |
| `api.smalruby.app` | お名前.com から Route 53 のゾーンへ NS で委任済み（API 群のカスタムドメイン） |
| `preview.smalruby.app` | お名前.com から Route 53 のゾーンへ NS で委任済み（ブランチプレビュー） |

## 移した後の構成

```
ブラウザ ── https://smalruby.app/ ──▶ Route 53（smalruby.app のゾーン）
                                       │  smalruby.app  A / AAAA（ALIAS）→ CloudFront
                                       ▼
                                   CloudFront ──(OAC)──▶ S3（非公開・バージョニングあり）
                                       │  viewer-request: /  → /index.html、/admin → /admin/（拡張子の無い URL は /<path>/ へ 301）
                                       │  証明書: ACM（us-east-1・DNS 検証）
                                       └─ viewer-response: HSTS / nosniff
```

| 項目 | 移した後 |
|---|---|
| レジストラ | お名前.com のまま（Route 53 Domains への移管は別の Issue #1346 で、2027-04 に行う） |
| DNS | Route 53 の `smalruby.app` のゾーン（`infra/smalruby-web-hosting` の prod ステージ・`RETAIN`）。お名前.com のネームサーバーの設定を Route 53 の 4 本に変える |
| 配信 | S3 + CloudFront（`infra/smalruby-web-hosting` の prod ステージ）。CI がビルドを S3 に置く |
| 証明書 | ACM（us-east-1）。Route 53 のゾーンで DNS 検証する |
| `api.` / `preview.` | 切り替えが落ち着いたあと、それぞれのゾーンを `smalruby.app` のゾーンへまとめ、委任とゾーンを消す（費用を戻す） |

prod ステージのリソースは、`infra/smalruby-web-hosting/lib/web-hosting-stack.ts` の `createSiteDelivery()` にある。最初は独自ドメインも DNS も付けず、CloudFront の既定のドメイン（`*.cloudfront.net`）でしか見えない形で作った。段 7 で `smalruby.app` の証明書と代替ドメインを付けるが、apex の A が GitHub Pages を向いている間は利用者のリクエストが CloudFront に来ないので、いまの本番には何も起きない。

## 証明書と代替ドメイン（段 7）

ネームサーバーが Route 53 に変わった（段 6）あとに、prod の CloudFront へ次を足す。

| もの | 値 |
|---|---|
| ACM 証明書 | `smalruby.app`（SAN なし）。CloudFront 用なので us-east-1。`DnsValidatedCertificate` で作り、段 2 のゾーンで DNS 検証する（スタックは分けない。プレビューと同じ形） |
| 代替ドメイン | `smalruby.app` だけ。`www.smalruby.app` は今は無いので足さない（要るなら別に決める） |
| TLS | 1.2 以上（`TLSv1.2_2021`）・SNI |

- 段 6 の前に足すと、公開 DNS から検証の CNAME が引けず、デプロイが証明書を待ち続けて失敗する。
- ディストリビューションへの設定の追加なので、**置き換え（replacement）にはならない**。`cdk diff` は証明書のカスタムリソース（と Lambda・ロール）の追加と、`SiteDistribution` の `Aliases` / `ViewerCertificate` の追加だけになる。追加だけの差分なので、develop へのマージで `Deploy Infra` が prod に出す。
- apex の A は GitHub Pages のまま変えない（段 9）。代替ドメインを付けても、DNS が CloudFront を向くまで利用者のリクエストは来ない。
- 出したあとに確かめること: Output `SiteCertificateArn` の証明書が `ISSUED`（`aws acm describe-certificate --region us-east-1 --certificate-arn <値>`）、`curl -sI --resolve smalruby.app:443:<CloudFront の IP> https://smalruby.app/` が CloudFront から返る。

### GitHub Pages から引き継ぐもの

| もの | どうするか |
|---|---|
| `index.html` やハッシュ付きのアセット | CI が `dist` をそのまま S3 に置く（GitHub Pages と同じ中身） |
| `/admin/`（管理 SPA） | CI が `admin/` に置く。本体の `--delete` で消えないよう、本体の同期では `admin/` を除く |
| `/.well-known/microsoft-identity-association.json` | `packages/scratch-gui/legal/.well-known/` からビルドに入る。ドットで始まるディレクトリも同期の対象にする（Microsoft のパブリッシャー検証に要る） |
| `/auth-redirect.html`（Microsoft ログインの戻り先） | ビルドに入っている。オリジンが同じなので Microsoft / Google の設定は変えない |
| `/about.html` などの静的ページ | ビルドに入っている。拡張子付きの URL はそのまま返す。`/about` のように拡張子を省いた URL は開けない（`/about/` へ 301 したあと 404 ページになる。下の「拡張子の無い URL」） |
| `/404.html`（存在しないファイルのページ） | ビルドに入っている（`packages/scratch-gui/pages/404.html`）。CloudFront のエラー応答が中身に使う（下の「存在しないファイル」） |
| HSTS ヘッダ | CloudFront の viewer-response 関数で付ける（定額プランは応答ヘッダポリシーを使えないため。`.app` は HSTS preload 済みなので、ブラウザはもともと HTTPS でしか来ない） |
| `CNAME` / `.nojekyll` | GitHub Pages 専用なので S3 には要らない |

### 拡張子の無い URL

本番の viewer-request 関数は、どのディレクトリに `index.html` があるかの一覧を持たずに、URL の形だけで決める。

| URL | 返すもの |
|---|---|
| `/`、`/admin/` のように末尾が `/` | `.../index.html` |
| `/x.js`、`/about.html` のように最後の部分に拡張子がある | そのまま |
| `/admin`、`/about`、`/assignments/LICENSE` のように最後の部分に拡張子が無い | `/<path>/` へ 301（クエリ文字列は保つ） |

`/admin` → `/admin/` は管理 SPA のために要る（相対パスでアセットを読むので、`/` 無しのままだと 1 階層上を見てしまう）。一方、`/about` は `/about/` → `/about/index.html` を探して 404 ページになる。**拡張子の無いページの URL は使えない**ので、サイト内のリンクは `about.html` のように `.html` 付きで書く（GitHub Pages は `/about` に `about.html` を返していたが、CloudFront Functions からは S3 にファイルがあるかを問い合わせられず、そうするには `index.html` を持つディレクトリの一覧を関数に持つ必要があるため、持たないことにした）。`/assignments/LICENSE` のような拡張子の無いファイルも URL では開けない（サイトからはリンクしていない）。

規則はプレビュー（`preview.smalruby.app/<slug>/`）と同じなので、関数のコードは同じファイル（`lib/functions/preview-viewer-request.js`）を使う。関数のリソースは本番とプレビューで別にする（定額プランの配信には、ほかの配信に付いている CloudFront Functions を付けられない）。

### 存在しないファイル

存在しないファイルは S3 が 403 を返す（OAC では一覧を見せないため。GitHub Pages は GitHub の 404 ページを返す）。これを 404 にするため、ビルドに 404 ページ `404.html` を入れてある（`packages/scratch-gui/pages/404.html`。ほかのページと同じく `pages/` からトップレベルにコピーされ、CI がハッシュ無しの規則で `Cache-Control: max-age=0, s-maxage=60` を付けて S3 に置く）。CDK からは置かない（CI の同期は `--delete` なので、ビルドに無いものは消える）。配信には CloudFront のカスタムエラー応答で、オリジンの 403 / 404 を応答コード 404・ページ `/404.html` にする。エラー応答のページが 403 にならないよう、**404 ページが本番に出てから（`https://smalruby.app/404.html` が 200 になってから）エラー応答を足す**。404 ページはどの階層の URL（`/a/b/c` など）にも返るので、中のアセットとリンクは `/` から始まる絶対パスで書く（相対パスにしない）。検索に載らないよう `noindex` を付けている。SPA は `/` の `index.html` だけでパスのルーティングを持たず、管理 SPA はハッシュのルーティングなので、403 を 404 に変えても壊れない。

## 進める順番

**同時に 2 つ以上を動かさない**。DNS・証明書・向き先を 1 つずつ変え、それぞれ確かめてから次へ進む。

| 段 | 内容 | 担当 | 本番への影響 |
|---|---|---|---|
| 1 | 🧱 prod に S3 / CloudFront / CI 用ロールを作る（独自ドメインなし） | AI | なし（誰も見ない） |
| 2 | 🧱 prod に `smalruby.app` のパブリックホストゾーンを作り、お名前.com のレコードを写す（`RETAIN`） | AI | なし（ネームサーバーを変えるまで誰も見ない） |
| 3 | お名前.com と Route 53 の両方に直接問い合わせて、全レコードが一致することを照合するスクリプト | AI | なし |
| 4 | CI: `build-and-deploy` で、GitHub Pages と並べて S3 にも置く | 人間（`.github/workflows/` は Bot で push できない） | なし |
| 5 | 🧱 CloudFront のアクセスログを残す | AI | なし |
| 6 | 夜間にお名前.com のネームサーバーを Route 53 の 4 本へ変える | 人間 | DNS の応答元が変わる（中身は同じ） |
| 7 | 🧱 `smalruby.app` の証明書（us-east-1）と CloudFront の代替ドメインを付ける | AI | なし（apex はまだ GitHub Pages） |
| 8 | S3 / CloudFront の中身と GitHub Pages の中身を照合するスクリプト | AI | なし |
| 9 | 🧱 apex の A / AAAA を CloudFront の ALIAS に変える PR を作る | AI | マージした時点で切り替わる |
| 10 | 夜間に 9 の PR をマージして切り替え、確かめる（だめなら戻す） | 人間 | 本番の配信元が変わる |
| 11 | 2 週間ほど様子を見てから GitHub Pages を止める | 人間 | なし |
| 12 | 🧱 `api.` と `preview.` のゾーンを `smalruby.app` にまとめる（さらに分けて進める） | AI + 人間 | 慎重に 1 スタックずつ |

🧱 は infra の変更（後方互換・develop 宛て・PR は `Refs`）。develop へマージすると `Deploy Infra` が stg → prod に出す（`.claude/rules/infra/development.md`）。**削除・置き換えを含む差分は自動では出ず、人間が手元から出す**。9 はレコードの値を変える更新（置き換えではない）なので、マージした時点で prod に出る。そのため 9 の PR は人間が夜間にマージする。

## DNS の切り替え（段 6）

### 前提

- 段 2 のゾーンに、お名前.com のレコードがすべて写っている。写すのは次のもの（お名前.com から改めてエクスポートし、差分を確かめる）:
  - `smalruby.app` A ×4（GitHub Pages。Route 53 では TTL を 300 にしておく。戻しやすくするため）
  - `smalruby.app` TXT（`google-site-verification=...`。Search Console の所有確認）
  - `_github-pages-challenge-smalruby.smalruby.app` TXT（GitHub の組織のドメイン検証。**消さない**。`docs/security/github-pages-subdomain-takeover.md` の Layer 1）
  - `smalruby.app` CAA ×6（amazon.com / amazonaws.com / amazontrust.com / awstrust.com / letsencrypt.org / issuewild `;`）
  - `api.smalruby.app` NS ×4、`preview.smalruby.app` NS ×4（委任をそのまま写す）
  - `everdiary.smalruby.app` A は使っていないので写さない（人間が確かめ、お名前.com からも消した）
- 段 3 のスクリプトで、両方のネームサーバーの応答が一致している（照合はホストか GitHub Actions で行う。コンテナの firewall は任意の DNS サーバーへの問い合わせを止めている）。
- DNSSEC は無効のまま（有効なら先に外す）。

### 手順

1. **前日**: お名前.com 側の各レコードの TTL を 300 に下げる（戻すときに早く効くように）。
2. **当日 21:00 以降**: お名前.com のドメインプロテクションを解除する（承認メール）。
3. お名前.com で `smalruby.app` のネームサーバーを、段 2 の Output の 4 本に変える。
4. ドメインプロテクションを元に戻す。
5. `dig NS smalruby.app @<TLD のネームサーバー>` で新しい 4 本が返ること、`https://smalruby.app/` と API（`api.smalruby.app` 配下）とプレビューが開けることを確かめる。

### 戻し方

- ネームサーバーを `01〜04.dnsv.jp` に戻すだけ。**お名前.com のレコードは、レジストラを移すまで消さない**（両方に書いておく決まり）。
- 切り替えから 2 日ほどは、キャッシュによって古いネームサーバーと新しいネームサーバーの両方が使われる。この間はどちらのゾーンのレコードも変えない。

## apex の向き先の切り替え（段 9・10）

### 前提

- 段 6 から 2 日以上たち、Route 53 だけが使われている。
- 段 7 の証明書が発行済みで、CloudFront に `smalruby.app` が代替ドメインとして付いている。
- 段 4 の並行デプロイで、S3 と GitHub Pages に**同じコミットのビルド**が置かれている。段 8 のスクリプトで中身が一致している。
- CloudFront のドメインを `Host` 付きで叩いて、本番として動くことを確かめてある（例: `curl -sI --resolve smalruby.app:443:<CloudFront の IP> https://smalruby.app/`）。

### 手順

1. **当日 21:00 以降**に、人間が段 9 の PR をマージする。`Deploy Infra` が prod に出し、apex の A が CloudFront の ALIAS に変わり、AAAA の ALIAS が足される。
2. 切り替えの前後 1 時間は develop へマージしない（並行デプロイで両方に同じビルドがある状態を保つ）。
3. 確かめること: `dig A smalruby.app` が CloudFront の IP、`curl -sI https://smalruby.app/` に `x-cache` / `via: ... cloudfront` が付く、エディタが開く、ログイン（Google / Microsoft）、作品の保存と読み込み、メッシュ、管理画面 `/admin/`、`/.well-known/microsoft-identity-association.json` が JSON で返る。
4. 翌朝（授業の前）にもう一度確かめる。

### 戻し方

- **急ぐとき**: Route 53 のコンソールで apex の A を GitHub Pages の 4 つの IP に戻し、AAAA を消す（TTL 300 なので数分で効く）。落ち着いたら段 9 の PR を revert して、CDK とコンソールの差をなくす。
- **急がないとき**: 段 9 の PR を revert してマージする（`Deploy Infra` が prod に出す）。
- GitHub Pages は段 11 まで止めないので、戻せばそのまま配信が続く。GitHub Pages の証明書は DNS が GitHub を向いている間しか更新されない（有効期限は 90 日）ので、戻すなら 2 か月以内に決める。

### 戻れなくなる点

お名前.com のゾーンには ALIAS が書けないので、apex は GitHub Pages を向いたまま残る。段 11 で GitHub Pages を止めたあとは、ネームサーバーをお名前.com に戻すと本番が見えなくなる。GitHub Pages を止めるのは、Route 53 と CloudFront で十分に動いたと分かってからにする。

## キャッシュ

| ファイル | `Cache-Control` | 理由 |
|---|---|---|
| ファイル名にハッシュが付いたもの（`/\.[0-9a-f]{8,}\./`。Workbox の `dontCacheBustURLsMatching` と同じ） | `public, max-age=31536000, immutable` | 中身が変わると名前が変わる |
| それ以外（`index.html`、`service-worker.js`、`version.json`、`auth-redirect.*`、`.well-known/*`、`admin/index.html` など） | `max-age=0, s-maxage=60` | ブラウザは毎回確かめ直し、CloudFront には 60 秒だけ置く |

- CloudFront のキャッシュポリシーは AWS 管理の `CachingOptimized`（`Cache-Control` があれば従う・最長 1 年。クエリ文字列・ヘッダ・Cookie はキーに含めない）。定額プランはカスタムのキャッシュポリシーを使えないため。**`Cache-Control` が無いオブジェクトはエッジに 1 日残る**（プレビューの 60 秒と違う）ので、CI は上の表のとおり全ファイルに `Cache-Control` を付けて置く。
- CI は置いたあとに `/*` を invalidation する（1 回 1 パスとして数えるので、月 1,000 パスの無料枠に十分収まる）。
- S3 はバージョニングを有効にし、上書き・削除された古い版を 30 日残す（CI の誤りで消えたファイルを戻すため。日数は人間が決める値）。いまの版は期限で消さない（プレビューと違う点）。バケットは本番の配信元なので `RETAIN`（スタックを消しても残る）。

## アクセスログ（段 5）

本番の CloudFront（`SiteDistribution`）のアクセスログを、ログ専用の S3 バケット `SiteLogBucket` に残す。

| 項目 | 内容 |
|---|---|
| 方式 | CloudFront の**標準ログ（従来の S3 配信）** |
| 置き場所 | `SiteLogBucket` の `cloudfront/smalruby.app/` 以下（gzip のファイルが数分〜1 時間ごとに届く） |
| バケット | 非公開（Block Public Access 全部 ON）・SSE-S3 で暗号化・SSL のみ。CI 用ロールからは触れない |
| 保持期間 | **30 日で消す**（人間が決めた値）。`infra/smalruby-web-hosting/lib/web-hosting-stack.ts` の `SITE_ACCESS_LOG_RETENTION_DAYS` だけを変えれば、バケットのライフサイクルが追従する |
| Cookie | 記録しない（`logIncludesCookies: false`） |

### 標準ログ（従来）を選んだ理由

- **費用**: 従来の方式は、ログを S3 に届けること自体は無料で、かかるのは S3 の保存とリクエストだけ。新しい方式（v2。CloudWatch Logs の配信の仕組みを使う）は、S3 へ届けたログの量に応じて料金がかかる。
- **手間**: 従来の方式は CloudFront のディストリビューションに設定を足すだけ（ディストリビューションの置き換えにならない）。v2 は配信元の設定を us-east-1 に作る必要があるが、このスタックは ap-northeast-1 で、スタックを分けない決まり（`Deploy Infra` が `cdk deploy` をスタック名なしで呼ぶため）がある。
- **引き換え**: 従来の方式は CloudFront がバケットの ACL を使って書き込むので、ログのバケットだけ ACL を無効にせず `BucketOwnerPreferred` にする（書かれたログの持ち主はこのアカウントになる）。ACL の相手は CloudFront のログ配信用アカウントで、公開ではないので Block Public Access は全部 ON のまま使える。
- v2 にしかない機能（項目の選択、Parquet、CloudWatch Logs や Firehose への配信）が必要になったら、そのときに移る。

### 個人を特定しうる情報の扱い

- 標準ログには、利用者の **IP アドレス**、要求した URL（クエリ文字列を含む。`?tab=ruby` など）、User-Agent、Referer が入る。Cookie は記録しない。エディタはログインの情報や作品の中身を URL に入れないので、それらはログに入らない。
- ログは障害の調査と、転送量・利用の傾向をつかむためだけに使う。**ログを外へ出さない**（Issue・PR・チャットに IP アドレスや生のログを貼らない。集計した数だけを書く）。
- 読めるのはこの AWS アカウントの管理者だけ（バケットは非公開、CI 用ロールの権限にも入れない）。
- 保持期間を過ぎたものは S3 のライフサイクルで自動で消える。期間を延ばすときは、使い道と見合うかを人間が決める。
- `SiteDistribution` には WAF の Web ACL（`CreatedByCloudFront-...`）が付いている。CloudFront の定額プラン（Pro）が配信を入れたときに作ったもので、料金はプランに含まれる。CDK は作らず、ARN を `webAclId` で参照するだけ（`SITE_WEB_ACL_ARN`）。消したり中身を変えたりしない。ルールを足すなどのフィルタリングは、必要になったら別に決める。

## PWA / service worker

エディタは Workbox の `GenerateSW` で作った `/service-worker.js`（scope `/`・`skipWaiting` + `clientsClaim`）を登録し、ビルドの大部分を precache する。

- **オリジン（`https://smalruby.app`）は変わらない**ので、service worker の登録・precache・`localStorage` / IndexedDB はそのまま引き継がれる。利用者の側で何かする必要は無い。
- precache の版は中身のハッシュで決まる。**切り替えの時点で S3 と GitHub Pages に同じコミットのビルドがあれば、何も再ダウンロードされない**。そのため段 4（並行デプロイ）を先に入れ、切り替えの前後は develop へのマージを止める。
- 違うビルドが混ざっても、ふだんのリリースと同じく新しい版に更新されるだけで壊れはしない（`version.json` は precache から外してあり、更新のお知らせはこれで出る）。
- `service-worker.js` には `max-age=0` を付ける。ブラウザは service worker のスクリプト自体を HTTP キャッシュより優先して確かめ直すが、CloudFront に古いものが長く残らないようにするため。
- 戻すときも同じオリジンなので、service worker の扱いは変わらない。

## 切り替えの時間帯

- 本番の配信に触る作業（段 6・10・11）は **21:00〜翌 7:00** に行う。平日の日中は学校の授業で使っているため。
- 段 1〜5・7・8 は、いまの本番に影響しないので、いつ develop へマージしてもよい（`Deploy Infra` が prod に出すのは、追加だけの差分）。
- 予行演習はしない（演習に使えるドメインが無いため）。代わりに、各段で照合スクリプトと `curl` で確かめてから次へ進む。

## 費用の見積もり

ドル建て・税別。CloudFront の料金は日本のエッジの従量課金で見積もった。金額は切り替える前に AWS の料金ページで確かめ直す。

| 項目 | 見込み | 根拠 |
|---|---|---|
| Route 53 のゾーン | 月 0.5 → 一時的に 1.5 → 最後に 0.5 | いまは `api` と `preview` の 2 つ（月 1.0）。段 2 で 3 つになり、段 12 で 1 つにまとまる。ALIAS への問い合わせは無料 |
| ACM の証明書 | 0 | パブリック証明書は無料 |
| S3 の保存 | 月 0.1 未満 | ビルドは 1 版あたり 100〜200 MB。古い版を 30 日残しても数 GB |
| CloudFront のデータ転送 | 月 0〜230 | 毎月 1 TB までは無料。新しい端末は precache で 60〜100 MB を読む。1 日の利用者 3,000 人が平均 10〜30 MB を読むと月 1〜3 TB。1 TB を超えた分は 1 GB あたり約 0.114 |
| CloudFront のリクエストと関数 | 月 0〜30 | 毎月 1,000 万リクエスト・関数 200 万回までは無料。1 回の読み込みで数百のリクエストがあるので、無料枠を超えうる |
| アクセスログ | 月 1 未満 | 標準ログ（従来）は届けるのが無料で、かかるのは S3 の保存と書き込みだけ。月 3,000 万リクエストでもログは gzip で月 数 GB、30 日分を置いて月 0.05〜0.2 程度 |

- 従量課金の上限が読みにくいので、`SiteDistribution`（smalruby.app）は **CloudFront の定額プラン Pro**（月 15 で転送量の上限が十分大きい）に入れてある。プレビューの配信は従量のまま。
  - 定額プランはカスタムのキャッシュポリシー・応答ヘッダポリシーを使えないので、`SiteDistribution` は AWS 管理の `CachingOptimized` + viewer-response 関数・Price Class All にしてある。プランの選択・変更はコンソールで人間が行う（CDK にはプランの設定が無い）。
  - プランに入れると CloudFront が WAF の Web ACL を作って配信に付ける。テンプレートに WebACLId が無いと次の deploy で外れる（またはプランの条件違反で失敗する）ので、CDK はその ARN を `webAclId` に書いている（`lib/web-hosting-stack.ts` の `SITE_WEB_ACL_ARN`）。プランを変える・入れ直すなどで Web ACL が変わったら、コンソールで配信に付いている Web ACL を確かめてから定数を書き換える。
- **AWS Budgets の予算アラート**（例: 月 50 を超えたら通知）を切り替えの前に設定する。
- GitHub Pages は無料なので、移すと費用は増える。理由（依存をなくす・ログ・調整のしやすさ）と見合うかを、転送量を見て判断する。

## 人間がやる作業

| いつ | 作業 |
|---|---|
| 段 1・2・5・7・9・12 | infra の PR をレビューしてマージする（develop へのマージで prod に出る）。段 9 は夜間にマージする |
| 段 1 のあと | prod の Output（`SiteDeployRoleArn` / `SiteBucketName` / `SiteDistributionId`）を repo の Variables に登録する: `bin/gh-admin variable set SITE_DEPLOY_ROLE_ARN --body <値>` など |
| 段 1 のあと | 手で 1 ファイル置いて CloudFront のドメインで見えるか確かめる（[`docs/infra/smalruby-web-hosting.md`](../infra/smalruby-web-hosting.md) の手順） |
| 段 2 の前 | お名前.com から `smalruby.app` のゾーンを改めてエクスポートし、AI に渡す（コンテナからはゾーン転送も任意の DNS への問い合わせもできない） |
| 段 3 のあと | 照合スクリプトをホストか Actions で走らせる |
| 段 4 | `ci-cd.yml` の `build-and-deploy` に S3 への並行デプロイを足す（Bot は `.github/workflows/` を push できない。手順は段 4 の Issue） |
| 段 6 | 前日に TTL を 300 に下げる。当日夜にドメインプロテクションを外し、ネームサーバーを変え、プロテクションを戻す |
| 段 10 | 夜間に段 9 の PR をマージし、確かめる。だめなら戻す |
| 段 11 | GitHub Pages を止める（`build-and-deploy` の GitHub Pages のステップを外し、`smalruby/smalruby.app` の Pages を無効にする）。`_github-pages-challenge-smalruby` の TXT と組織のドメイン検証は残す |
| 切り替えの前 | AWS Budgets の予算アラートを設定する。CloudFront の定額プランを使うか決める |

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `infra/smalruby-web-hosting/lib/web-hosting-stack.ts` | 配信基盤の CDK。prod は `createSiteDelivery()`、stg はプレビュー |
| `infra/smalruby-web-hosting/lib/functions/preview-viewer-request.js` | viewer-request の CloudFront Function のコード（ディレクトリの URL を `index.html` に解決し、拡張子の無い URL を `/<path>/` へ 301）。本番とプレビューで共用（関数のリソースは別） |
| `infra/smalruby-web-hosting/test/web-hosting.test.ts` | スタックのテスト |
| `.github/workflows/ci-cd.yml`（`build-and-deploy`） | 本番のビルドと配置 |
| `docs/infra/smalruby-web-hosting.md` | 配信基盤の CDK の詳細と運用 |
| `docs/security/github-pages-subdomain-takeover.md` | GitHub Pages のサブドメイン乗っ取り対策（検証用 TXT は残す） |
