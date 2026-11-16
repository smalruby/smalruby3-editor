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

/**
 * 本番（smalruby.app）の配信を置くステージ。いまの本番は GitHub Pages
 * （外部リポジトリ smalruby/smalruby.app）で、ここに作る S3 + CloudFront は
 * 切り替えまで誰も参照しない（docs/hosting/README.md）。
 */
export const SITE_STAGE = 'prod';

/**
 * 本番の配信を置いてよい GitHub Actions の OIDC subject。本番に出すのは develop への
 * push だけなので、プレビュー（リポジトリの全ブランチ・PR）より狭くする。
 * `environment: prod` のジョブから出すときは subject が environment になるので、それも許す。
 */
export const SITE_DEPLOY_SUBJECTS = [
    `repo:${PREVIEW_GITHUB_REPOSITORY}:ref:refs/heads/develop`,
    `repo:${PREVIEW_GITHUB_REPOSITORY}:environment:prod`,
];

/**
 * 本番バケットで、上書き・削除された古い版を残す日数。CI の `aws s3 sync --delete` の
 * 誤りなどで消えたファイルを戻すための保険（いまの版は消さない）。
 */
export const SITE_NONCURRENT_VERSION_EXPIRATION_DAYS = 30;

/**
 * 本番 CloudFront のアクセスログを残す日数（人間がまだ決めていない。案は 90 日）。
 * ログには利用者の IP アドレスが入るので、必要な間だけ残して消す（docs/hosting/README.md）。
 * 変えるときはこの値だけを変える（バケットのライフサイクルが追従する）。
 */
export const SITE_ACCESS_LOG_RETENTION_DAYS = 90;

/** アクセスログのオブジェクトキーの接頭辞（ログのバケットを後でほかの用途と分けられるように付ける）。 */
export const SITE_ACCESS_LOG_PREFIX = 'cloudfront/smalruby.app/';

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

        // 本番（smalruby.app）の配信基盤は prod だけに作る。独自ドメインと DNS はまだ付けない
        // （smalruby.app のゾーンを Route 53 に移してから、別の変更で足す）。
        if (stage === SITE_STAGE) {
            this.createSiteDelivery();
            return;
        }

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

        const viewerRequest = this.createViewerRequestFunction(
            'PreviewViewerRequest',
            'Resolve /<slug>/ to index.html for branch previews',
        );
        const cachePolicy = this.createCachePolicy(
            'PreviewCachePolicy',
            'Branch previews: short for index.html, honor Cache-Control for assets',
        );

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

        // CI（GitHub Actions）がプレビューを出すためのロール。PR を含む全ブランチから出す。
        const deployRole = this.createDeployRole(
            'PreviewDeployRole',
            `GitHub Actions (${PREVIEW_GITHUB_REPOSITORY}) deploys branch previews`,
            `repo:${PREVIEW_GITHUB_REPOSITORY}:*`,
            bucket,
            distribution,
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

    /**
     * 本番（smalruby.app）の配信基盤（S3 + CloudFront + CI 用ロール）。
     *
     * いまの本番は GitHub Pages で配信しており、これは切り替え先として並べて作るだけ。
     * 独自ドメイン（smalruby.app）・証明書・DNS はまだ付けないので、CloudFront の既定の
     * ドメイン（`*.cloudfront.net`）でしか見えず、いまの本番には影響しない。
     * 証明書は smalruby.app のゾーンを Route 53 に移してから足す（委任前だと DNS 検証が
     * 終わらないのはプレビューと同じ）。
     */
    private createSiteDelivery(): void {
        const bucket = new s3.Bucket(this, 'SiteBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
            // 本番の配信元なので、スタックの削除や論理 ID の変更があっても消さない（例外の RETAIN。
            // .claude/rules/infra/development.md の「データ保持」）。中身はビルドで作り直せるが、
            // 消えると切り替え後の smalruby.app が止まり、CloudFront の OAC の向き先も失われる。
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            // 本番はプレビューと違い、いまの版を期限で消さない。上書き・削除された古い版だけを
            // しばらく残し、CI の誤りで消えたファイルを戻せるようにする。古い版が消えたあとに残る
            // 削除マーカーも片付ける。
            versioned: true,
            lifecycleRules: [
                {
                    id: 'ExpireNoncurrentVersions',
                    noncurrentVersionExpiration: cdk.Duration.days(
                        SITE_NONCURRENT_VERSION_EXPIRATION_DAYS,
                    ),
                    expiredObjectDeleteMarker: true,
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
                },
            ],
        });

        // `/` → `/index.html`、`/admin/` → `/admin/index.html`、`/admin` → `/admin/` への 301。
        // プレビューと同じ規則で足りるので、同じ関数のコードを使う。
        const viewerRequest = this.createViewerRequestFunction(
            'SiteViewerRequest',
            'Resolve directory URLs to index.html for smalruby.app',
        );
        const cachePolicy = this.createCachePolicy(
            'SiteCachePolicy',
            'smalruby.app: short for index.html, honor Cache-Control for assets',
        );

        // GitHub Pages が返している HSTS をそのまま引き継ぐ（.app は HSTS preload 済みなので
        // ブラウザは常に HTTPS で来るが、ヘッダが消えると診断ツールで差分に見える）。
        const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
            this,
            'SiteResponseHeaders',
            {
                comment: 'smalruby.app: HSTS and nosniff',
                securityHeadersBehavior: {
                    strictTransportSecurity: {
                        accessControlMaxAge: cdk.Duration.days(365),
                        includeSubdomains: false,
                        override: true,
                    },
                    contentTypeOptions: { override: true },
                },
            },
        );

        const logBucket = this.createSiteAccessLogBucket();

        const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
            comment: 'Smalruby production site (smalruby.app, not attached yet)',
            // 標準ログ（従来の S3 配信）。v2（CloudWatch Logs の配信）は S3 へ出すと 1 GB あたりの
            // 料金がかかり、CloudFront の配信元の設定を us-east-1 に置く必要がある（このスタックは
            // ap-northeast-1 で、スタックは分けない）。従来の方式は配信が無料で、プロパティを足すだけで済む。
            enableLogging: true,
            logBucket,
            logFilePrefix: SITE_ACCESS_LOG_PREFIX,
            logIncludesCookies: false,
            // minimumProtocolVersion（TLS 1.2 以上）は既定の証明書では効かないので、
            // smalruby.app の証明書を付けるときに一緒に足す。
            httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                compress: true,
                cachePolicy,
                responseHeadersPolicy,
                functionAssociations: [
                    {
                        function: viewerRequest,
                        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                    },
                ],
            },
        });

        // 本番に出すのは develop への push だけなので、信頼する subject をプレビューより狭くする。
        const deployRole = this.createDeployRole(
            'SiteDeployRole',
            `GitHub Actions (${PREVIEW_GITHUB_REPOSITORY}) deploys smalruby.app`,
            SITE_DEPLOY_SUBJECTS,
            bucket,
            distribution,
        );

        new cdk.CfnOutput(this, 'SiteDeployRoleArn', {
            value: deployRole.roleArn,
            description: 'IAM role GitHub Actions assumes (OIDC) to deploy smalruby.app',
        });
        new cdk.CfnOutput(this, 'SiteBucketName', {
            value: bucket.bucketName,
            description: 'S3 bucket that stores the smalruby.app build',
        });
        new cdk.CfnOutput(this, 'SiteDistributionId', {
            value: distribution.distributionId,
            description: 'CloudFront distribution id for smalruby.app',
        });
        new cdk.CfnOutput(this, 'SiteDistributionDomainName', {
            value: distribution.distributionDomainName,
            description: 'CloudFront domain name (check before attaching smalruby.app)',
        });
        new cdk.CfnOutput(this, 'SiteLogBucketName', {
            value: logBucket.bucketName,
            description: `S3 bucket that keeps CloudFront access logs of smalruby.app (${SITE_ACCESS_LOG_RETENTION_DAYS} days)`,
        });
    }

    /**
     * 本番 CloudFront のアクセスログ専用バケット。非公開・SSE-S3・SSL のみで、
     * `SITE_ACCESS_LOG_RETENTION_DAYS` を過ぎたログは消す。
     *
     * 標準ログ（従来の S3 配信）は CloudFront（awslogsdelivery）がバケットの ACL で書き込むので、
     * ACL を無効にする BUCKET_OWNER_ENFORCED は使えない。BUCKET_OWNER_PREFERRED にして、
     * 書かれたログの持ち主をこのアカウントにする。ACL の付与は特定のアカウント宛てで公開ではないので、
     * Block Public Access は全部 ON のまま使える。
     * ログは取り戻せなくても配信は止まらないので RETAIN にしない（.claude/rules/infra/development.md の
     * 「データ保持」）。autoDeleteObjects は付けないので、中身が残っている間は削除が失敗して止まる。
     */
    private createSiteAccessLogBucket(): s3.Bucket {
        return new s3.Bucket(this, 'SiteLogBucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            lifecycleRules: [
                {
                    id: 'ExpireAccessLogs',
                    expiration: cdk.Duration.days(SITE_ACCESS_LOG_RETENTION_DAYS),
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
                },
            ],
        });
    }

    /**
     * ディレクトリの URL を index.html に解決する viewer-request 関数。S3 は REST
     * エンドポイント（OAC）なので、ディレクトリの index.html を自分で解決しない。
     */
    private createViewerRequestFunction(id: string, comment: string): cloudfront.Function {
        return new cloudfront.Function(this, id, {
            runtime: cloudfront.FunctionRuntime.JS_2_0,
            code: cloudfront.FunctionCode.fromFile({
                filePath: path.join(__dirname, 'functions/preview-viewer-request.js'),
            }),
            comment,
        });
    }

    /**
     * Cache-Control が無い index.html は短く、CI が長い Cache-Control を付けた
     * ハッシュ付きアセットは最長 1 年まで持つ。クエリ文字列は GUI 側の設定
     * （?tab=ruby など）でアセットには関係ないのでキーに含めない。
     */
    private createCachePolicy(id: string, comment: string): cloudfront.CachePolicy {
        return new cloudfront.CachePolicy(this, id, {
            comment,
            minTtl: cdk.Duration.seconds(0),
            defaultTtl: cdk.Duration.seconds(PREVIEW_DEFAULT_TTL_SECONDS),
            maxTtl: cdk.Duration.days(365),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            headerBehavior: cloudfront.CacheHeaderBehavior.none(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
        });
    }

    /**
     * CI（GitHub Actions）が配信物を置くためのロール。OIDC プロバイダはアカウントに
     * 1 つしか作れず、Deploy Infra 用に作成済みなので参照する。権限はこのバケットと
     * このディストリビューションだけ。
     */
    private createDeployRole(
        id: string,
        description: string,
        subjects: string | string[],
        bucket: s3.IBucket,
        distribution: cloudfront.IDistribution,
    ): iam.Role {
        const githubOidc = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
            this,
            'GitHubOidcProvider',
            `arn:${cdk.Aws.PARTITION}:iam::${cdk.Aws.ACCOUNT_ID}:oidc-provider/${GITHUB_OIDC_HOST}`,
        );
        const deployRole = new iam.Role(this, id, {
            description,
            assumedBy: new iam.WebIdentityPrincipal(githubOidc.openIdConnectProviderArn, {
                StringEquals: { [`${GITHUB_OIDC_HOST}:aud`]: 'sts.amazonaws.com' },
                StringLike: { [`${GITHUB_OIDC_HOST}:sub`]: subjects },
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
        return deployRole;
    }
}
