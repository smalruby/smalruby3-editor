# smalruby-web-hosting

CDK project for hosting Smalruby's web frontend on AWS (S3 + CloudFront).

現在の範囲は **ブランチプレビュー用の Route 53 パブリックホストゾーン `preview.smalruby.app`** だけ。
ACM 証明書と配信基盤（S3 + CloudFront）は、お名前.com からの NS 委任が効いたあとに追加する。

全体像・運用は [`docs/infra/smalruby-web-hosting.md`](../../docs/infra/smalruby-web-hosting.md) を参照。

## Stages

| Stage | Stack | 作るもの |
|-------|-------|----------|
| stg | `SmalrubyWebHostingStack-stg` | `preview.smalruby.app` のホストゾーン（`RETAIN`）。NS 4 本とゾーン ID を Output |
| prod | `SmalrubyWebHostingStack` | 何も作らない（空のスタック） |

## Commands

```bash
npm install
npm test                                  # stack のテスト (aws-cdk-lib/assertions)
npx cdk synth --context stage=stg
npx cdk synth --context stage=prod
```

デプロイは GitHub Actions（`Deploy Infra`）から行う。stg は PR に `deploy-stg` ラベル、
prod は develop へのマージで自動（`.claude/rules/infra/development.md`）。

## NS の確認

```bash
aws cloudformation describe-stacks --stack-name SmalrubyWebHostingStack-stg \
  --query "Stacks[0].Outputs" --output table
```
