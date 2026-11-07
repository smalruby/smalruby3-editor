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

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `infra/smalruby-web-hosting/bin/smalruby-web-hosting.ts` | エントリポイント。stage とスタック名を決める |
| `infra/smalruby-web-hosting/lib/web-hosting-stack.ts` | スタック本体（ホストゾーン） |
| `infra/smalruby-web-hosting/test/web-hosting.test.ts` | スタックのテスト |
