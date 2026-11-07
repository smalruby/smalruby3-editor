---
paths:
  - "infra/smalruby-web-hosting/"
  - "infra/smalruby-web-hosting/**"
  - "infra/smalruby-web-hosting/**/*"
---

# smalruby-web-hosting

Smalruby の Web フロントエンドを AWS（Route 53 / 今後 S3 + CloudFront）から配信するための CDK
プロジェクト。最初の用途はブランチプレビュー `https://preview.smalruby.app/<slug>/`（stg の API を見る）。
全体像と運用は `docs/infra/smalruby-web-hosting.md`。

## 不変条件

- **プレビュー用の資源は stg ステージだけに作る**。`Deploy Infra` は develop へのマージで prod にも
  出すので、stg 以外（prod / stg2 など）では何も作らない（`if (stage !== 'stg') return`）。
  同じ名前のゾーンが複数あると、どれが委任先か分からなくなる。この分岐を外さない。
- **ホストゾーン `preview.smalruby.app` は `RemovalPolicy.RETAIN`**。作り直すと NS が変わり、
  お名前.com に登録した委任（NS 4 本）と食い違って `preview.smalruby.app` が引けなくなる。
  このプロジェクトの RETAIN は「データ」ではなく「AWS の外に登録した値」を守るためのもの
  （`.claude/rules/infra/development.md` の「データ保持」）。
- **ゾーンを作り直さない**。論理 ID（`PreviewHostedZone`）の変更・コンストラクトの移動・スタック名の
  変更は、CloudFormation から見ると「削除 + 新規作成」になる。RETAIN なので古いゾーンは残り、
  **同名の 2 つ目のゾーン（別の NS）が黙ってできる**（Route 53 は同名ゾーンを許す）。
  レビューでは、ゾーンの論理 ID・スタック名・`zoneName` が変わる差分を **[Must]** で止める。
  やむを得ず作り直すときの手順は `docs/infra/smalruby-web-hosting.md` の「ゾーンを作り直すとき」。
- **ACM 証明書はゾーンと同じデプロイで作らない**（委任前だと DNS 検証が終わらず、デプロイが
  証明書を待ち続けて失敗する）。証明書・配信基盤は委任が効いたあとに足す。CloudFront 用の証明書は
  us-east-1 に要る点にも注意（スタックは ap-northeast-1）。

## デプロイ

- stg / prod とも `Deploy Infra`（`.github/workflows/deploy-infra-stg.yml`）から出す。worker は
  `cdk deploy` しない（`.claude/rules/autopilot/prompts.md`）。
- 必要な Secrets: repo の `INFRA_STG_DOTENV_SMALRUBY_WEB_HOSTING`、Environment `prod` の
  `INFRA_PROD_DOTENV_SMALRUBY_WEB_HOSTING`（中身は `STAGE=<stage>` だけでよい）。無いとマージ後の
  デプロイがこのプロジェクトだけ失敗する。
- prod は `AWS::CDK::Metadata` だけの空のスタック。初回の自動デプロイは空のスタックを作り、以後は
  「差分なし」で何もしない（`.claude/rules/infra/development.md` の「新しい CDK プロジェクトを足すときの
  チェックリスト」3.）。
- CI（`.github/workflows/ci-infra.yml`）は unit test と、stg / prod 両方の `cdk synth` を行う。
