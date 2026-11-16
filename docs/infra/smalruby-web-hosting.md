# smalruby-web-hosting (Web 配信基盤インフラ)

> **🆕 Smalruby 独自** — Smalruby の Web フロントエンドを AWS（S3 + CloudFront）から配信するための基盤。

## 概要

`infra/smalruby-web-hosting/` は、Smalruby の GUI を AWS から配信するための CDK プロジェクト。
最初の用途はブランチプレビュー（`preview.smalruby.app/<slug>/`）。

stg ステージに、`preview.smalruby.app` のホストゾーン（お名前.com から NS 委任済み）と、
プレビューの配信基盤（S3 + CloudFront + ACM 証明書 + CI 用 IAM ロール）を置く。
プレビューを S3 に置くのは CI（下の「CI のプレビュー」。このプロジェクトは置き場所と配信の仕組みだけを作る）。

## ステージごとのリソース

| Stage | スタック名 | リソース |
|---|---|---|
| stg | `SmalrubyWebHostingStack-stg` | パブリックホストゾーン `preview.smalruby.app`、S3 バケット、CloudFront、ACM 証明書（us-east-1）、A / AAAA（ALIAS）、CI 用 IAM ロール |
| prod | `SmalrubyWebHostingStack` | 本番 smalruby.app の配信基盤（S3 バケット、CloudFront、CI 用 IAM ロール）と、パブリックホストゾーン `smalruby.app`（お名前.com のレコードを写したもの）。CloudFront の独自ドメイン・証明書はまだ無い（下の「本番の配信基盤（prod）」「ホストゾーン `smalruby.app`（prod）」） |
| その他（stg2 等） | `SmalrubyWebHostingStack-<stage>` | なし |

- プレビューは stg の API を見るので、プレビュー用の資源は **stg ステージ**に置く。
- `Deploy Infra` は develop へのマージで prod にも出す。prod でプレビュー用のリソースができないよう、
  プレビュー用の資源は stg だけに作る（同じ名前のゾーンが複数あると、どれが委任先か分からなくなる）。
- prod には本番（smalruby.app）の配信基盤と `smalruby.app` のゾーンだけを作る。stg2 などほかのステージでは何も作らない。

## ホストゾーン `preview.smalruby.app`

| 項目 | 値 |
|---|---|
| 種類 | パブリックホストゾーン |
| `removalPolicy` | **`RETAIN`** — 作り直すと NS が変わり、お名前.com に登録した NS と食い違う |
| Output `PreviewHostedZoneNameServers` | NS 4 本（カンマ区切り）。お名前.com の委任に使う |
| Output `PreviewHostedZoneId` | ホストゾーン ID |

`smalruby.app` 自体の DNS はお名前.com で管理している。`preview` サブドメインだけを
お名前.com から Route 53 へ **NS レコードで委任**する。委任するまで誰もこのゾーンを参照しない
ので、本番の DNS には影響しない。

NS は stg デプロイ後に次で確認する:

```bash
aws cloudformation describe-stacks --stack-name SmalrubyWebHostingStack-stg \
  --query "Stacks[0].Outputs" --output table
```

### ゾーンを作り直すとき（RETAIN の後始末）

ゾーンは `RETAIN` なので、スタックを消しても、論理 ID やスタック名が変わって CloudFormation が
「削除 + 新規作成」と判断しても、**古いゾーンは AWS に残る**。Route 53 は同じ名前のゾーンを
いくつでも作れるため、そのまま出し直すと **NS の違う 2 つ目の `preview.smalruby.app` が黙ってできる**。
お名前.com の委任は古いゾーンの NS を向いたままなので、新しいゾーンに足したレコード（証明書の
検証レコードや CloudFront の別名）は外から見えない。

そもそも作り直さないのが基本（論理 ID・スタック名・ゾーン名を変えない）。やむを得ないときは、
まず同名のゾーンがいくつあるかを確かめる:

```bash
aws route53 list-hosted-zones-by-name --dns-name preview.smalruby.app \
  --query "HostedZones[?Name=='preview.smalruby.app.'].[Id,Config.Comment]" --output table
```

そのうえで次のどちらかを選ぶ（どちらも人間が手元で行う）。

- **残ったゾーンを取り込む（NS が変わらない。こちらを優先）**: スタックが無い状態で
  `npx cdk import --context stage=stg` を実行し、`PreviewHostedZone` に残ったゾーンの ID を渡す。
  お名前.com の NS はそのままでよい。取り込んだあとは通常どおり `Deploy Infra` で出す。
- **残ったゾーンを消して作り直す（NS が変わる）**: 残ったゾーンの NS / SOA 以外のレコードを消してから
  ゾーンを消し、`Deploy Infra` で出し直す。新しい NS 4 本（Output `PreviewHostedZoneNameServers`）を
  お名前.com の委任に登録し直す。登録し直すまで `preview.smalruby.app` は引けない。

### 証明書を後から足した理由

ACM の DNS 検証は、公開 DNS から検証レコード（CNAME）が引けるまで証明書を発行しない。
委任前にゾーンと証明書を同じデプロイで作ると、CloudFormation が証明書の発行を待ち続けて
タイムアウトし、デプロイが失敗する。そこで「ゾーン → 委任 → 証明書と配信基盤」の順に分けた。

## プレビューの配信基盤

```
ブラウザ ── https://preview.smalruby.app/<slug>/ ──▶ CloudFront ──(OAC)──▶ S3 (private)
                                                    │  viewer-request: /<slug>/ → /<slug>/index.html
                                                    └─ 証明書: ACM (us-east-1)
```

### S3 バケット

| 項目 | 値 |
|---|---|
| 公開設定 | **Block Public Access 全部 ON**。読めるのは CloudFront（OAC）だけ。`enforceSSL` |
| キー | `<slug>/...`（プレビュー）と、ルートの `auth-redirect.html` / `auth-redirect.js` |
| ライフサイクル | 最後に置いてから **365 日**経ったオブジェクトを消す（消し忘れの保険。主な片付けはブランチ削除時の CI ジョブ）。未完了のマルチパートアップロードは 7 日で破棄 |
| `removalPolicy` | `DESTROY`（CI から作り直せるため。`autoDeleteObjects` は付けないので、オブジェクトが残っている間はバケットの削除が失敗して止まる） |

ライフサイクルはオブジェクト単位（そのオブジェクトを最後に put した日から数える）。CI が
`aws s3 sync` で差分だけ上げると、変わっていないファイルは古い日付のまま残るので、1 年以上
続くブランチでは一部のファイルだけが消えうる。長く続くブランチがあるときは、全ファイルを
置き直す（`aws s3 cp --recursive`）。

### CloudFront

| 項目 | 値 |
|---|---|
| 代替ドメイン | `preview.smalruby.app`（証明書は us-east-1 の ACM。`DnsValidatedCertificate` でこのゾーンを使って DNS 検証する） |
| オリジン | S3 + OAC（Origin Access Control） |
| viewer-request（CloudFront Functions） | `/<slug>/` や `/<slug>/x/` → `.../index.html`。`/<slug>` のように末尾 `/` も拡張子も無いものは `/<slug>/` へ 301（クエリ文字列は保つ）。それ以外はそのまま（`infra/smalruby-web-hosting/lib/functions/preview-viewer-request.js`） |
| キャッシュ | `Cache-Control` の無いオブジェクトはエッジで **60 秒**、`Cache-Control` があればそれに従う（最長 1 年）。キャッシュキーにクエリ文字列・ヘッダ・Cookie を含めない |
| その他 | HTTPS へリダイレクト、TLS 1.2 以上、HTTP/2 と HTTP/3、Price Class 200（日本を含む） |

**CI がアップロードするときの約束**（キャッシュを効かせるため）:

- `index.html` などハッシュの付かないファイル（`auth-redirect.html` / `auth-redirect.js` /
  `sw.js` など）は `Cache-Control: max-age=0, s-maxage=60` を付ける。エッジには 60 秒だけ残り、
  ブラウザは毎回確かめ直す。`Cache-Control` を付けないとエッジは既定の 60 秒になるが、ブラウザが
  `Last-Modified` から勝手に鮮度を見積もって古い `index.html` を使い続けることがある。
  `no-cache` だけを付けるとエッジにも残らない（MinTTL が 0 のため）。
- ファイル名にハッシュが付いたもの（`*.<hash>.js`、`static/assets/*.<hash>.*`。Workbox の
  `dontCacheBustURLsMatching` と同じ `/\.[0-9a-f]{8,}\./`）は
  `Cache-Control: public, max-age=31536000, immutable` を付ける。
- 置き直したら `/<slug>/*` を invalidation する（すぐに反映させたいとき）。

### Microsoft ログインの戻り先 `/auth-redirect.html`

Microsoft ログインは `window.location.origin + '/auth-redirect.html'` に戻る
（`packages/scratch-gui/src/lib/microsoft-auth.js`）。プレビューでは origin が
`https://preview.smalruby.app` なので、**バケットのルート**に `auth-redirect.html` と、それが読む
`auth-redirect.js` を置けば配信される（CloudFront Function は拡張子付きのパスを素通しする）。
置くのは CI の役目。

### DNS

`preview.smalruby.app`（ゾーンの頂点）に A / AAAA の ALIAS レコード（→ CloudFront）を置く。
**ワイルドカードは作らない**（`docs/security/github-pages-subdomain-takeover.md`）。

### CI 用 IAM ロール（GitHub OIDC）

| 項目 | 値 |
|---|---|
| 信頼 | アカウントに作成済みの OIDC プロバイダ `token.actions.githubusercontent.com`（`Deploy Infra` と共用。アカウントに 1 つしか作れないので参照するだけ）。`aud = sts.amazonaws.com` かつ `sub` が `repo:smalruby/smalruby3-editor:*` |
| 権限 | このバケットの `s3:ListBucket` / `s3:PutObject` / `s3:DeleteObject`、このディストリビューションの `cloudfront:CreateInvalidation` / `cloudfront:GetInvalidation` だけ |
| セッション | 最長 1 時間 |

### Output

| Output | 用途 |
|---|---|
| `PreviewDeployRoleArn` | CI が AssumeRole するロール（Environment `stg` の Variables に登録する） |
| `PreviewBucketName` | プレビューを置くバケット |
| `PreviewDistributionId` | invalidation の対象 |
| `PreviewDistributionDomainName` | CloudFront のドメイン（ALIAS の向き先。確認用） |

```bash
aws cloudformation describe-stacks --stack-name SmalrubyWebHostingStack-stg \
  --query "Stacks[0].Outputs" --output table
```

### 動作確認（手で置いて見る）

```bash
BUCKET=<PreviewBucketName>
echo '<h1>preview test</h1>' > /tmp/index.html
aws s3 cp /tmp/index.html "s3://$BUCKET/test/index.html" --content-type text/html
curl -sI https://preview.smalruby.app/test/   # 200
curl -sI https://preview.smalruby.app/test    # 301 → /test/
aws s3 rm "s3://$BUCKET/test/index.html"
```

## 本番の配信基盤（prod）

本番 `https://smalruby.app/` を GitHub Pages から移すための置き場所。計画・切り替えの手順・戻し方・費用は
[`docs/hosting/README.md`](../hosting/README.md)。いまは**作るだけ**で、独自ドメイン（`smalruby.app`）・
証明書・DNS は付けていない。CloudFront の既定のドメイン（`*.cloudfront.net`）でしか見えないので、
いまの本番（GitHub Pages）には影響しない。

| リソース | 内容 |
|---|---|
| S3 バケット `SiteBucket` | Block Public Access 全部 ON・`enforceSSL`・**バージョニングあり**。上書き・削除された古い版は 30 日で消し、残った削除マーカーも片付ける。**いまの版は期限で消さない**（プレビューとの違い）。`removalPolicy` は **`RETAIN`**（下の「本番のバケットを RETAIN にする理由」） |
| CloudFront `SiteDistribution` | オリジンは S3 + OAC。viewer-request はプレビューと同じ関数（`/` → `/index.html`、`/admin` → `/admin/` へ 301）。キャッシュポリシーもプレビューと同じ値。応答ヘッダポリシーで HSTS（1 年）と `X-Content-Type-Options: nosniff` を付ける。HTTP/2 と HTTP/3、Price Class 200 |
| CI 用ロール `SiteDeployRole` | 既存の GitHub OIDC プロバイダを参照。信頼は `repo:smalruby/smalruby3-editor:ref:refs/heads/develop` と `...:environment:prod` だけ（プレビューより狭い）。権限はこのバケットの `ListBucket` / `PutObject` / `DeleteObject` と、このディストリビューションの invalidation だけ |

### 本番のバケットを RETAIN にする理由

データ保持の決まり（`.claude/rules/infra/development.md`）では、ビルドから作り直せるバケットは `DESTROY` に
する。本番の配信バケットはその**例外**で `RETAIN` にする。中身は作り直せるが、切り替え後に消えると
smalruby.app がその場で止まるため、スタックの削除や論理 ID の変更（CloudFormation から見ると削除 + 新規作成）
で消えないようにする。

- 残ったバケットを使い直すときは、スタックが無い状態で `npx cdk import --context stage=prod` を実行し、
  `SiteBucket` に残ったバケットの名前を渡す（人間が手元で行う）。
- 要らなくなって消すときは、中身（古い版と削除マーカーを含む）を空にしてから、人間がコンソールか CLI で消す。
- 古い版を残す日数（いまは 30 日）は人間が決める値。案: 切り替えから 1 か月は 30 日のまま、落ち着いたら
  7〜14 日に縮めて保存の費用を抑える。

TLS 1.2 以上の指定（`minimumProtocolVersion`）は既定の証明書では効かないので、`smalruby.app` の
証明書を付けるときに一緒に足す。

| Output | 用途 |
|---|---|
| `SiteDeployRoleArn` | CI が AssumeRole するロール（repo の Variables `SITE_DEPLOY_ROLE_ARN` に登録する） |
| `SiteBucketName` | ビルドを置くバケット（`SITE_BUCKET_NAME`） |
| `SiteDistributionId` | invalidation の対象（`SITE_DISTRIBUTION_ID`） |
| `SiteDistributionDomainName` | CloudFront のドメイン（切り替え前の確認用） |

```bash
aws cloudformation describe-stacks --stack-name SmalrubyWebHostingStack \
  --query "Stacks[0].Outputs" --output table
```

手で置いて確かめる（prod のバケットなので、確かめたら消す）:

```bash
BUCKET=<SiteBucketName>
DOMAIN=<SiteDistributionDomainName>
echo '<h1>site test</h1>' > /tmp/index.html
aws s3 cp /tmp/index.html "s3://$BUCKET/index.html" --content-type text/html \
  --cache-control 'max-age=0, s-maxage=60'
curl -sI "https://$DOMAIN/"   # 200・strict-transport-security が付く
aws s3 rm "s3://$BUCKET/index.html"
```

## ホストゾーン `smalruby.app`（prod）

本番のドメイン `smalruby.app` の DNS を、お名前.com から Route 53 へ移すためのゾーン（`docs/hosting/README.md` の段 2）。
お名前.com のネームサーバーを、このゾーンの NS 4 本に変えるまで（人間が夜間に行う）、誰もこのゾーンを引かない。
だから作っただけでは、いまの本番には何も起きない。

| 項目 | 値 |
|---|---|
| 種類 | パブリックホストゾーン（論理 ID `SiteHostedZone`） |
| `removalPolicy` | **`RETAIN`** — 作り直すと NS が変わり、お名前.com に登録したネームサーバーと食い違う |
| Output `SiteHostedZoneNameServers` | NS 4 本（カンマ区切り）。お名前.com のネームサーバーの設定に使う |
| Output `SiteHostedZoneId` | ホストゾーン ID |

写したレコード（値は `infra/smalruby-web-hosting/lib/site-zone-records.ts`。お名前.com のエクスポートと同じ値）:

| 名前 | 型 | 数 | TTL | 内容 |
|---|---|---|---|---|
| `smalruby.app` | A | 4 | 300 | GitHub Pages（185.199.108〜111.153）。お名前.com は 3600 だが、切り替えと戻しを早く効かせるため 300 にする |
| `smalruby.app` | TXT | 1 | 300 | `google-site-verification=...`（Search Console の所有確認） |
| `_github-pages-challenge-smalruby.smalruby.app` | TXT | 1 | 3600 | GitHub の組織のドメイン検証。**消さない**（`docs/security/github-pages-subdomain-takeover.md`） |
| `smalruby.app` | CAA | 6 | 3600 | `issue` amazon.com / amazonaws.com / amazontrust.com / awstrust.com / letsencrypt.org、`issuewild ";"` |
| `api.smalruby.app` | NS | 4 | 900 | API 群のゾーンへの委任（いまの NS のまま） |
| `preview.smalruby.app` | NS | 4 | 900 | stg の `PreviewHostedZone` への委任（いまの NS のまま） |

写さないもの: apex の NS / SOA（Route 53 のものになる）、`everdiary.smalruby.app` A（使っていない）。ワイルドカードは作らない。

- お名前.com 側のレコードを変えたら、ここも同じ値にする（ネームサーバーを変えるまでは両方に書いておく決まり）。
  照合は `scripts/hosting/dns-compare.mjs`（`docs/hosting/verify-scripts.md`）で、お名前.com のエクスポートと
  `cdk synth` の結果、または両方のネームサーバーへの問い合わせを比べる。
- NS の値は末尾に `.` を付けて書く（ゾーン名を足した相対名と読まれないように）。
- apex の A を CloudFront の ALIAS に変えるのは別の変更（本番の向き先が変わるので、人間が夜間にマージする）。

NS はデプロイ後に次で確認する:

```bash
aws cloudformation describe-stacks --stack-name SmalrubyWebHostingStack \
  --query "Stacks[0].Outputs[?starts_with(OutputKey, 'SiteHostedZone')]" --output table
```

### `smalruby.app` のゾーンを作り直すとき（RETAIN の後始末）

考え方は上の「ゾーンを作り直すとき」（`preview.smalruby.app`）と同じ。作り直さないのが基本
（論理 ID `SiteHostedZone`・スタック名 `SmalrubyWebHostingStack`・ゾーン名を変えない）。やむを得ないときは、
まず同名のゾーンがいくつあるかを確かめる:

```bash
aws route53 list-hosted-zones-by-name --dns-name smalruby.app \
  --query "HostedZones[?Name=='smalruby.app.'].[Id,Config.Comment]" --output table
```

そのうえで次のどちらかを選ぶ（どちらも人間が手元で行う）。

- **残ったゾーンを取り込む（NS が変わらない。こちらを優先）**: スタックが無い状態で
  `npx cdk import --context stage=prod` を実行し、`SiteHostedZone` に残ったゾーンの ID を渡す。
  お名前.com のネームサーバーはそのままでよい。
- **残ったゾーンを消して作り直す（NS が変わる）**: お名前.com のネームサーバーをまだ変えていないときだけ選ぶ。
  変えたあとに消すと、`smalruby.app` も `api.` / `preview.` も引けなくなる。残ったゾーンの NS / SOA 以外の
  レコードを消してからゾーンを消し、`Deploy Infra` で出し直す。新しい NS 4 本（Output `SiteHostedZoneNameServers`）を
  使う。

## CI のプレビュー

| 何を | どこで |
|---|---|
| ビルドして置く | `.github/workflows/ci-cd.yml` の `preview-deploy`（PR と develop への push） |
| 片付ける | `.github/workflows/preview-cleanup.yml`（PR を閉じたとき・週 1 回・手動） |
| slug | `scripts/preview-slug.mjs`（テストは `scripts/preview-slug.test.mjs`。ジョブの中でも走らせる） |

`preview-deploy` の流れ:

1. **エンドポイントが stg を向いているか確かめる**。Environment `stg` に値が無いと repo の値（prod）で
   黙ってビルドされ、プレビューが本番のデータを読み書きしてしまう。`MESH_GRAPHQL_ENDPOINT` /
   `RUBYTEE_RELAY_ENDPOINT` / `CLASSROOM_API_ENDPOINT` / `BUG_REPORT_API_ENDPOINT` /
   `SCRATCH_API_PROXY_ENDPOINT` のホストが 1 つでも `stg.` で始まらなければ、ビルドせずにジョブを失敗させる
   （値は secret なので出さず、名前だけを出す）。
2. ブランチ名から slug を作る（`develop` は `develop`。正規化で名前が変わるブランチには元の名前の
   ハッシュ 8 桁が付く。規則は `.claude/rules/infra/development.md` の「ブランチプレビューで確かめる」）。
3. **stg の値**で `npm run build` する。ジョブは `environment: stg` で動くので、Environment `stg` に置いた
   Secrets / Variables（エンドポイント・メッシュの API キー・`SCRATCH_API_PROXY_ENDPOINT`）が repo の
   同名の値より優先される。prod と同じ値（Google / Microsoft のクライアント ID・メッセージ長・メッシュの
   間隔）は repo の値をそのまま使う。値の一覧は `docs/infra/stg-prod-differences.md` の「GUI のビルド値」。
4. `PUBLIC_PATH=/<slug>/` で `postbuild.mjs` を走らせ、fetch-worker のパスを絶対パスにする
   （ビルド自体は相対パスなので、置き場所を選ばない）。
5. GitHub OIDC で `PreviewDeployRoleArn` を AssumeRole し、`s3://<bucket>/<slug>/` に置く。上の
   「CI がアップロードするときの約束」どおり、ハッシュ付きのファイルとそれ以外で `Cache-Control` を
   分けて 2 回 sync し、最後に `--delete --size-only` で新しいビルドに無いものを消す。
6. **develop のときだけ**、バケットのルートに `auth-redirect.html` / `auth-redirect.js` を置く
   （全プレビューが共有するので、ブランチからは上書きしない）。
7. `/<slug>/*` を invalidation し、PR なら 1 回だけ URL をコメントする。

GitHub Pages へのプレビュー（`smalruby.jp/smalruby3-editor/<branch>/`・prod の API）と develop 版
（`smalruby.jp/smalruby3-editor/`）の出力はやめた。gh-pages ブランチに残っている内容は消さずに置いてあり、
もう更新されない。本番（smalruby.app）は従来どおり `build-and-deploy` が `smalruby/smalruby.app` へ出す。

- ブランチ単位の `concurrency` はワークフロー全体のまま（プレフィックスが分かれているので、
  ブランチ間で競合しない）。
- fork からの PR・`dependabot/` / `renovate/`・`hotfix/` / `main` / `master` では出さない。
- Environment `stg` の Variables `PREVIEW_DEPLOY_ROLE_ARN` / `PREVIEW_BUCKET_NAME` /
  `PREVIEW_DISTRIBUTION_ID`（上の Output の値）が未設定なら、警告を出してプレビューを飛ばす
  （PR は失敗させない）。登録は `bin/gh-admin variable set <NAME> --env stg --body <value>`。

片付け（`preview-cleanup.yml`）:

- PR を閉じたら、その head ブランチの `<slug>/` を消して invalidation する。
- 週 1 回（月曜 03:00 JST）、`git ls-remote --heads` に無いブランチのプレフィックスを消す。
  `develop` とルートのファイル（`auth-redirect.*`）は消さない。消し漏れの保険は上のライフサイクル（365 日）。

## デプロイ

stg / prod とも GitHub Actions の `Deploy Infra`（`.github/workflows/deploy-infra-stg.yml`）から出す
（`.claude/rules/infra/development.md`）。この workflow は repo Secrets の `.env` を使うので、
次の 2 つを登録しておく:

| Secret | 置き場所 | 内容 |
|---|---|---|
| `INFRA_STG_DOTENV_SMALRUBY_WEB_HOSTING` | repo Secrets | `infra/smalruby-web-hosting/.env.stg` |
| `INFRA_PROD_DOTENV_SMALRUBY_WEB_HOSTING` | Environment `prod` の Secrets | `infra/smalruby-web-hosting/.env.prod` |

```bash
bin/gh-admin secret set INFRA_STG_DOTENV_SMALRUBY_WEB_HOSTING < infra/smalruby-web-hosting/.env.stg
bin/gh-admin secret set INFRA_PROD_DOTENV_SMALRUBY_WEB_HOSTING --env prod < infra/smalruby-web-hosting/.env.prod
```

`.env` の中身は `STAGE` だけでよい（`infra/smalruby-web-hosting/.env.example`）。

Secrets が無いままマージすると、`Deploy Infra` のこのプロジェクトのジョブだけが「何を登録すべきか」を
示して失敗する（ほかのプロジェクトは進む）。

### prod のデプロイ

prod には本番の配信基盤（上の「本番の配信基盤（prod）」）と `smalruby.app` のゾーンがある。追加だけの差分なので、develop への
マージで `Deploy Infra` が自動で出す。削除・置き換えを含む差分は自動では出ず、人間が確かめて手元から出す。
prod にプレビュー用のリソースはできない。


## テスト

```bash
cd infra/smalruby-web-hosting
npm install
npm test                                  # aws-cdk-lib/assertions によるスタックのテスト
npx cdk synth --context stage=stg
npx cdk synth --context stage=prod
```

テストは「stg にゾーンがあり `RETAIN`・論理 ID が変わらない」「NS と ID を Output」
「バケットが非公開・SSL 必須・ライフサイクルあり」「証明書が us-east-1」「CloudFront が OAC・
代替ドメイン・viewer-request 関数つき」「ALIAS にワイルドカードが無い」「CI 用ロールの信頼と権限が
最小」「prod にはプレビュー用の資源が無く、本番の配信基盤（非公開・バージョニングあり・いまの版を消さない・
独自ドメインも証明書も無い・develop だけを信頼するロール）がある」「stg2 には何も作らない」を確かめる。`test/site-zone.test.ts` は「prod に `smalruby.app` のゾーンが 1 つあり `RETAIN`・論理 ID が変わらない」「写した
レコードがお名前.com の値と同じ（apex の A だけ TTL 300）」「apex の NS / SOA・`everdiary`・ワイルドカードが無い」
「stg / stg2 にはこのゾーンが無い」を確かめる。`test/preview-viewer-request.test.ts` は
CloudFront Function の実コードを評価して URI の書き換えを確かめる。

CI（`.github/workflows/ci-infra.yml` の `[web-hosting] Unit Tests` / `CDK Build & Synth` /
`Security Audit`）が、`infra/**` を変える PR と push で同じテストと、stg / prod 両方の `cdk synth` を行う。

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `infra/smalruby-web-hosting/bin/smalruby-web-hosting.ts` | エントリポイント。stage とスタック名を決める |
| `infra/smalruby-web-hosting/lib/web-hosting-stack.ts` | スタック本体（stg: ホストゾーン・プレビューの配信基盤・CI 用ロール / prod: 本番の配信基盤 `createSiteDelivery()`・ゾーン `createSiteZone()`） |
| `infra/smalruby-web-hosting/lib/site-zone-records.ts` | `smalruby.app` のゾーンに写すレコードの値（お名前.com と同じ） |
| `infra/smalruby-web-hosting/lib/functions/preview-viewer-request.js` | CloudFront Function（ディレクトリの URL → `index.html`）。プレビューと本番で共用 |
| `infra/smalruby-web-hosting/test/web-hosting.test.ts` | スタックのテスト |
| `infra/smalruby-web-hosting/test/site-zone.test.ts` | `smalruby.app` のゾーンのテスト（写したレコードの一覧・`RETAIN`・prod だけに作る） |
| `infra/smalruby-web-hosting/test/preview-viewer-request.test.ts` | CloudFront Function のテスト |
| `.github/workflows/ci-cd.yml`（`preview-deploy`） | プレビューを stg の値でビルドして置く |
| `.github/workflows/preview-cleanup.yml` | プレビューの片付け |
| `scripts/preview-slug.mjs` | ブランチ名 → slug |
