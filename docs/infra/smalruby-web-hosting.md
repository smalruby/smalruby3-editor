# smalruby-web-hosting (Web 配信基盤インフラ)

> **🆕 Smalruby 独自** — Smalruby の Web フロントエンドを AWS（S3 + CloudFront）から配信するための基盤。

## 概要

`infra/smalruby-web-hosting/` は、Smalruby の GUI を AWS から配信するための CDK プロジェクト。
最初の用途はブランチプレビュー（`preview.smalruby.app/<slug>/`）。

現在作っているのは **Route 53 のパブリックホストゾーン `preview.smalruby.app` だけ**。
ACM 証明書と配信基盤（S3 + CloudFront）は、NS 委任が効いたあとに追加する。

## ステージごとのリソース

| Stage | スタック名 | リソース |
|---|---|---|
| stg | `SmalrubyWebHostingStack-stg` | パブリックホストゾーン `preview.smalruby.app` |
| prod | `SmalrubyWebHostingStack` | なし（空のスタック） |
| その他（stg2 等） | `SmalrubyWebHostingStack-<stage>` | なし |

- プレビューは stg の API を見るので、プレビュー用の資源は **stg ステージ**に置く。
- `Deploy Infra` は develop へのマージで prod にも出す。prod でプレビュー用のリソースができないよう、
  stg 以外のステージでは何も作らない（同じ名前のゾーンが複数あると、どれが委任先か分からなくなる）。

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

### 証明書をこのスタックでまだ作らない理由

ACM の DNS 検証は、公開 DNS から検証レコード（CNAME）が引けるまで証明書を発行しない。
委任前にゾーンと証明書を同じデプロイで作ると、CloudFormation が証明書の発行を待ち続けて
タイムアウトし、デプロイが失敗する。そこで「ゾーン → 委任 → 証明書と配信基盤」の順に分けている。

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

### prod の初回デプロイ

prod のテンプレートは `AWS::CDK::Metadata` だけの空のスタック。prod にはまだスタックが無いので、初回の
`cdk diff` は `BootstrapVersion` パラメータの追加を差分として出す（`AWS::CDK::Metadata` は diff から
除かれるが、パラメータは除かれない）。そのため初回の自動デプロイは**空のスタック
`SmalrubyWebHostingStack` を作り**、2 回目からは「差分なし」で何もしない。どちらの場合も削除・置き換えは
含まないので、prod の自動デプロイは止まらず、prod にプレビュー用のリソースはできない。


## テスト

```bash
cd infra/smalruby-web-hosting
npm install
npm test                                  # aws-cdk-lib/assertions によるスタックのテスト
npx cdk synth --context stage=stg
npx cdk synth --context stage=prod
```

テストは「stg にゾーンがあり `RETAIN`」「NS と ID を Output」「証明書を作らない」
「prod / stg2 にはゾーンを作らない」を確かめる。

CI（`.github/workflows/ci-infra.yml` の `[web-hosting] Unit Tests` / `CDK Build & Synth` /
`Security Audit`）が、`infra/**` を変える PR と push で同じテストと、stg / prod 両方の `cdk synth` を行う。

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `infra/smalruby-web-hosting/bin/smalruby-web-hosting.ts` | エントリポイント。stage とスタック名を決める |
| `infra/smalruby-web-hosting/lib/web-hosting-stack.ts` | スタック本体（ホストゾーン） |
| `infra/smalruby-web-hosting/test/web-hosting.test.ts` | スタックのテスト |
