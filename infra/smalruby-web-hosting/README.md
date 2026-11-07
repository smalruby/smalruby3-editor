# smalruby-web-hosting

CDK project for hosting Smalruby's web frontend on AWS (S3 + CloudFront).

現在の範囲は **ブランチプレビュー `https://preview.smalruby.app/<slug>/`** の基盤（stg のみ）:
Route 53 ホストゾーン、S3（非公開）+ CloudFront（OAC）、ACM 証明書（us-east-1）、CI 用 IAM ロール（GitHub OIDC）。

全体像・運用は [`docs/infra/smalruby-web-hosting.md`](../../docs/infra/smalruby-web-hosting.md) を参照。

## Stages

| Stage | Stack | 作るもの |
|-------|-------|----------|
| stg | `SmalrubyWebHostingStack-stg` | `preview.smalruby.app` のホストゾーン（`RETAIN`）と配信基盤。NS・ゾーン ID・CI 用ロール ARN・バケット名・ディストリビューション ID を Output |
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

## Output の確認

```bash
aws cloudformation describe-stacks --stack-name SmalrubyWebHostingStack-stg \
  --query "Stacks[0].Outputs" --output table
```
