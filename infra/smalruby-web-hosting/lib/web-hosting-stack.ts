import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/** プレビュー配信用のゾーン名（お名前.com から NS を委任する）。 */
export const PREVIEW_ZONE_NAME = 'preview.smalruby.app';

/** プレビューを出してよい GitHub リポジトリ（OIDC の信頼をここに絞る）。 */
export const PREVIEW_GITHUB_REPOSITORY = 'smalruby/smalruby3-editor';

/**
 * 更新の無いオブジェクトを消すまでの日数。主な片付けはブランチ削除時の CI ジョブで、
 * これは消し忘れの保険。S3 のライフサイクルはオブジェクト単位（最後に put した日から数える）
 * なので、生きているプレビューを消さないよう長めにとる。
 */
export const PREVIEW_OBJECT_EXPIRATION_DAYS = 365;

/**
 * Cache-Control の無いオブジェクト（index.html など）をエッジに置く秒数。
 * ハッシュ付きアセットは CI が `Cache-Control: max-age=31536000, immutable` を付けて置き、
 * キャッシュポリシーの MaxTTL（1 年）まで長く持つ。
 */
export const PREVIEW_DEFAULT_TTL_SECONDS = 60;

/** GitHub Actions の OIDC プロバイダ（アカウントに 1 つだけ。Deploy Infra 用に作成済みのものを使う）。 */
const GITHUB_OIDC_HOST = 'token.actions.githubusercontent.com';

export interface SmalrubyWebHostingStackProps extends cdk.StackProps {
    stage: string;
}

export class SmalrubyWebHostingStack extends cdk.Stack {
    public readonly previewZone?: route53.PublicHostedZone;

    constructor(scope: Construct, id: string, props: SmalrubyWebHostingStackProps) {
        super(scope, id, props);

        const { stage } = props;

        cdk.Tags.of(this).add('Project', 'SmalrubyWebHosting');
        cdk.Tags.of(this).add('Stage', stage);
        cdk.Tags.of(this).add('Service', 'Route53');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');

        // プレビュー配信は stg の資源として持つ（preview は stg API を見る）。
        // Deploy Infra は develop へのマージで prod にも出すので、prod（と stg2 など他ステージ）では
        // 何も作らない。同じ名前のゾーンを複数作ると、どれが委任先か分からなくなる。
        if (stage !== 'stg') {
            return;
        }

        this.previewZone = new route53.PublicHostedZone(this, 'PreviewHostedZone', {
            zoneName: PREVIEW_ZONE_NAME,
            comment: 'Smalruby branch previews (delegated from onamae.com)',
        });
        // 作り直すと NS が変わり、お名前.com に登録した NS と食い違うので残す。
        this.previewZone.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

        new cdk.CfnOutput(this, 'PreviewHostedZoneId', {
            value: this.previewZone.hostedZoneId,
            description: `Route 53 hosted zone id of ${PREVIEW_ZONE_NAME}`,
        });
        new cdk.CfnOutput(this, 'PreviewHostedZoneNameServers', {
            value: cdk.Fn.join(',', this.previewZone.hostedZoneNameServers!),
            description: `NS records to register at onamae.com for ${PREVIEW_ZONE_NAME}`,
        });

        this.createPreviewDelivery(this.previewZone);
    }

    /**
     * `https://preview.smalruby.app/<slug>/` の配信基盤（S3 + CloudFront + 証明書 + CI 用ロール）。
     * ゾーンの委任が効いてから足している（委任前だと証明書の DNS 検証が終わらない）。
     */
    private createPreviewDelivery(zone: route53.IHostedZone): void {
        const bucket = new s3.Bucket(this, 'PreviewBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
            // プレビューは CI から作り直せるので RETAIN にしない（.claude/rules/infra/development.md の
            // 「データ保持」）。autoDeleteObjects は付けないので、中身が残っている間は削除が失敗して止まる。
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            lifecycleRules: [
                {
                    id: 'ExpireStalePreviews',
                    expiration: cdk.Duration.days(PREVIEW_OBJECT_EXPIRATION_DAYS),
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
                },
            ],
        });

        // CloudFront 用の証明書は us-east-1 に要る。スタックは ap-northeast-1 なので、
        // mesh-v2 と同じく DnsValidatedCertificate で us-east-1 に作り、このゾーンで検証する
        // （スタックを分けると cdk deploy に --all が要り、Deploy Infra の呼び方と合わない）。
        const certificate = new acm.DnsValidatedCertificate(this, 'PreviewCertificate', {
            domainName: PREVIEW_ZONE_NAME,
            hostedZone: zone,
            region: 'us-east-1',
        });

        const viewerRequest = new cloudfront.Function(this, 'PreviewViewerRequest', {
            runtime: cloudfront.FunctionRuntime.JS_2_0,
            code: cloudfront.FunctionCode.fromFile({
                filePath: path.join(__dirname, 'functions/preview-viewer-request.js'),
            }),
            comment: 'Resolve /<slug>/ to index.html for branch previews',
        });

        // Cache-Control が無い index.html は短く、CI が長い Cache-Control を付けた
        // ハッシュ付きアセットは最長 1 年まで持つ。クエリ文字列は GUI 側の設定
        // （?tab=ruby など）でアセットには関係ないのでキーに含めない。
        const cachePolicy = new cloudfront.CachePolicy(this, 'PreviewCachePolicy', {
            comment: 'Branch previews: short for index.html, honor Cache-Control for assets',
            minTtl: cdk.Duration.seconds(0),
            defaultTtl: cdk.Duration.seconds(PREVIEW_DEFAULT_TTL_SECONDS),
            maxTtl: cdk.Duration.days(365),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            headerBehavior: cloudfront.CacheHeaderBehavior.none(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        });

        const distribution = new cloudfront.Distribution(this, 'PreviewDistribution', {
            comment: `Smalruby branch previews (${PREVIEW_ZONE_NAME})`,
            domainNames: [PREVIEW_ZONE_NAME],
            certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                compress: true,
                cachePolicy,
                functionAssociations: [
                    {
                        function: viewerRequest,
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                    },
                ],
            },
        });

        // ワイルドカードは作らない（docs/security/github-pages-subdomain-takeover.md）。
        const aliasTarget = route53.RecordTarget.fromAlias(
            new targets.CloudFrontTarget(distribution),
        );
        new route53.ARecord(this, 'PreviewAliasA', { zone, target: aliasTarget });
        new route53.AaaaRecord(this, 'PreviewAliasAAAA', { zone, target: aliasTarget });

        // CI（GitHub Actions）がプレビューを出すためのロール。OIDC プロバイダはアカウントに
        // 1 つしか作れず、Deploy Infra 用に作成済みなので参照する。
        const githubOidc = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
            this,
            'GitHubOidcProvider',
            `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:oidc-provider/${GITHUB_OIDC_HOST}`,
        );
        const deployRole = new iam.Role(this, 'PreviewDeployRole', {
            description: `GitHub Actions (${PREVIEW_GITHUB_REPOSITORY}) deploys branch previews`,
            assumedBy: new iam.WebIdentityPrincipal(githubOidc.openIdConnectProviderArn, {
                StringEquals: { [`${GITHUB_OIDC_HOST}:aud`]: 'sts.amazonaws.com' },
                StringLike: { [`${GITHUB_OIDC_HOST}:sub`]: `repo:${PREVIEW_GITHUB_REPOSITORY}:*` },
            }),
            maxSessionDuration: cdk.Duration.hours(1),
        });
        deployRole.addToPolicy(
            new iam.PolicyStatement({
                actions: ['s3:ListBucket'],
                resources: [bucket.bucketArn],
            }),
        );
        deployRole.addToPolicy(
            new iam.PolicyStatement({
                actions: ['s3:PutObject', 's3:DeleteObject'],
                resources: [bucket.arnForObjects('*')],
            }),
        );
        deployRole.addToPolicy(
            new iam.PolicyStatement({
                actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
                resources: [
                    cdk.Stack.of(this).formatArn({
                        service: 'cloudfront',
                        region: '',
                        resource: 'distribution',
                        resourceName: distribution.distributionId,
                    }),
                ],
            }),
        );

        new cdk.CfnOutput(this, 'PreviewDeployRoleArn', {
            value: deployRole.roleArn,
            description: 'IAM role GitHub Actions assumes (OIDC) to deploy branch previews',
        });
        new cdk.CfnOutput(this, 'PreviewBucketName', {
            value: bucket.bucketName,
            description: 'S3 bucket that stores branch previews (<slug>/...)',
        });
        new cdk.CfnOutput(this, 'PreviewDistributionId', {
            value: distribution.distributionId,
            description: `CloudFront distribution id of ${PREVIEW_ZONE_NAME}`,
        });
        new cdk.CfnOutput(this, 'PreviewDistributionDomainName', {
            value: distribution.distributionDomainName,
            description: 'CloudFront domain name (alias target of the zone apex)',
        });
    }
}
