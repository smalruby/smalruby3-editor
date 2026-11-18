import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import {
    PREVIEW_DEFAULT_TTL_SECONDS,
    PREVIEW_OBJECT_EXPIRATION_DAYS,
    SITE_ACCESS_LOG_PREFIX,
    SITE_ACCESS_LOG_RETENTION_DAYS,
    SITE_NONCURRENT_VERSION_EXPIRATION_DAYS,
    SmalrubyWebHostingStack,
} from '../lib/web-hosting-stack';

const env = { account: '123456789012', region: 'ap-northeast-1' };

const synth = (stage: string): Template => {
    const app = new cdk.App();
    const stack = new SmalrubyWebHostingStack(app, `TestStack-${stage}`, { env, stage });
    return Template.fromStack(stack);
};

describe('SmalrubyWebHostingStack', () => {
    test('stg creates the public hosted zone preview.smalruby.app', () => {
        const template = synth('stg');

        template.resourceCountIs('AWS::Route53::HostedZone', 1);
        template.hasResourceProperties('AWS::Route53::HostedZone', {
            Name: 'preview.smalruby.app.',
        });
    });

    test('stg retains the hosted zone so its NS records never change', () => {
        const template = synth('stg');

        template.hasResource('AWS::Route53::HostedZone', {
            DeletionPolicy: 'Retain',
            UpdateReplacePolicy: 'Retain',
        });
    });

    test('stg outputs the name servers and zone id for the delegation', () => {
        const template = synth('stg');
        const outputs = template.findOutputs('*');

        expect(Object.keys(outputs)).toEqual(
            expect.arrayContaining(['PreviewHostedZoneNameServers', 'PreviewHostedZoneId']),
        );
    });

    test('prod creates no preview resources', () => {
        const template = synth('prod');

        // prod のゾーンは smalruby.app だけ（preview.smalruby.app は stg にある）。
        const zoneNames = Object.values(template.findResources('AWS::Route53::HostedZone')).map(
            (r) => r.Properties.Name,
        );
        expect(zoneNames).toEqual(['smalruby.app.']);
        expect(
            Object.keys(template.findResources('*')).filter((id) => id.startsWith('Preview')),
        ).toEqual([]);
        expect(
            Object.keys(template.findOutputs('*')).filter((id) => id.startsWith('Preview')),
        ).toEqual([]);
    });

    test('stages other than stg and prod create nothing (avoid duplicate zones and sites)', () => {
        const template = synth('stg2');

        template.resourceCountIs('AWS::Route53::HostedZone', 0);
        template.resourceCountIs('AWS::S3::Bucket', 0);
        template.resourceCountIs('AWS::CloudFront::Distribution', 0);
        template.resourceCountIs('AWS::IAM::Role', 0);
        expect(Object.keys(template.findOutputs('*'))).toEqual([]);
    });

    test('stg creates no production site resources', () => {
        const template = synth('stg');

        expect(
            Object.keys(template.findResources('*')).filter((id) => id.startsWith('Site')),
        ).toEqual([]);
    });

    describe('production site delivery (prod)', () => {
        let template: Template;

        // 本番の配信元（SiteBucket）とアクセスログ（SiteLogBucket）の 2 つがある。
        const bucketById = (prefix: string) => {
            const found = Object.entries(template.findResources('AWS::S3::Bucket')).filter(([id]) =>
                id.startsWith(prefix),
            );
            expect(found).toHaveLength(1);
            return found[0][1];
        };
        const siteBucket = () => bucketById('SiteBucket');
        const logBucket = () => bucketById('SiteLogBucket');

        beforeAll(() => {
            template = synth('prod');
        });

        test('creates the site bucket and the access log bucket only', () => {
            template.resourceCountIs('AWS::S3::Bucket', 2);
            siteBucket();
            logBucket();
        });

        test('creates one private, SSL-only, versioned site bucket', () => {
            expect(siteBucket().Properties).toEqual(
                expect.objectContaining({
                    PublicAccessBlockConfiguration: {
                        BlockPublicAcls: true,
                        BlockPublicPolicy: true,
                        IgnorePublicAcls: true,
                        RestrictPublicBuckets: true,
                    },
                    VersioningConfiguration: { Status: 'Enabled' },
                }),
            );
            template.hasResourceProperties('AWS::S3::BucketPolicy', {
                PolicyDocument: {
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Effect: 'Deny',
                            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
                        }),
                    ]),
                },
            });
        });

        test('retains the bucket (the production origin is never deleted with the stack)', () => {
            expect(siteBucket()).toEqual(
                expect.objectContaining({
                    DeletionPolicy: 'Retain',
                    UpdateReplacePolicy: 'Retain',
                }),
            );
        });

        test('never expires the current objects, only old versions', () => {
            const rules = siteBucket().Properties.LifecycleConfiguration.Rules;
            for (const rule of rules) {
                expect(rule.ExpirationInDays).toBeUndefined();
                expect(rule.ExpirationDate).toBeUndefined();
            }
            expect(rules).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        Status: 'Enabled',
                        NoncurrentVersionExpiration: {
                            NoncurrentDays: SITE_NONCURRENT_VERSION_EXPIRATION_DAYS,
                        },
                        ExpiredObjectDeleteMarker: true,
                    }),
                ]),
            );
        });

        test('distribution serves smalruby.app from the bucket through OAC with TLS 1.2+', () => {
            template.resourceCountIs('AWS::CloudFront::Distribution', 1);
            template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
            const distribution = Object.values(
                template.findResources('AWS::CloudFront::Distribution'),
            )[0];
            const config = distribution.Properties.DistributionConfig;
            // www.smalruby.app は今は無いので代替ドメインは apex だけ。
            expect(config.Aliases).toEqual(['smalruby.app']);
            expect(config.ViewerCertificate).toEqual(
                expect.objectContaining({
                    AcmCertificateArn: expect.anything(),
                    SslSupportMethod: 'sni-only',
                    MinimumProtocolVersion: 'TLSv1.2_2021',
                }),
            );
            expect(config.DefaultCacheBehavior).toEqual(
                expect.objectContaining({
                    ViewerProtocolPolicy: 'redirect-to-https',
                    FunctionAssociations: [
                        expect.objectContaining({ EventType: 'viewer-request' }),
                        expect.objectContaining({ EventType: 'viewer-response' }),
                    ],
                }),
            );
        });

        // CloudFront の定額プラン（Pro）は、カスタムのキャッシュポリシー・レスポンスヘッダーポリシーを
        // 使う配信を入れられず、料金クラスも持たない。
        describe('fits the CloudFront flat-rate plan (Pro)', () => {
            const behavior = () =>
                Object.values(template.findResources('AWS::CloudFront::Distribution'))[0].Properties
                    .DistributionConfig.DefaultCacheBehavior;

            test('uses the AWS managed CachingOptimized cache policy', () => {
                expect(behavior().CachePolicyId).toBe(
                    cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
                );
                expect(behavior().CachePolicyId).toBe('658327ea-f89d-4fab-a63d-7e88639e58f6');
            });

            test('attaches no response headers policy', () => {
                expect(behavior().ResponseHeadersPolicyId).toBeUndefined();
            });

            test('uses PriceClass_All (flat-rate plans have no price class)', () => {
                template.hasResourceProperties('AWS::CloudFront::Distribution', {
                    DistributionConfig: Match.objectLike({ PriceClass: 'PriceClass_All' }),
                });
            });

            test('adds HSTS and nosniff with a viewer-response function', () => {
                const assoc = behavior().FunctionAssociations.find(
                    (a: { EventType: string }) => a.EventType === 'viewer-response',
                );
                const fnId = assoc.FunctionARN['Fn::GetAtt'][0];
                expect(fnId).toMatch(/^SiteViewerResponse/);
                const fn = template.findResources('AWS::CloudFront::Function')[fnId];
                expect(fn.Properties.FunctionConfig.Runtime).toBe('cloudfront-js-2.0');
                expect(fn.Properties.FunctionCode).toContain('strict-transport-security');
                expect(fn.Properties.FunctionCode).toContain('x-content-type-options');
            });

            // 消すと cdk diff に削除が出て Deploy Infra の prod 自動デプロイが止まるので、
            // 配信から外しても定義は残す（follow-up で消す）。
            test('keeps the old cache policy and response headers policy (not deleted yet)', () => {
                expect(Object.keys(template.findResources('AWS::CloudFront::CachePolicy'))).toEqual(
                    [expect.stringMatching(/^SiteCachePolicy/)],
                );
                expect(
                    Object.keys(template.findResources('AWS::CloudFront::ResponseHeadersPolicy')),
                ).toEqual([expect.stringMatching(/^SiteResponseHeaders/)]);
            });
        });

        test('access log bucket is private, encrypted, SSL only and accepts CloudFront logs', () => {
            const bucket = logBucket();
            expect(bucket.Properties).toEqual(
                expect.objectContaining({
                    PublicAccessBlockConfiguration: {
                        BlockPublicAcls: true,
                        BlockPublicPolicy: true,
                        IgnorePublicAcls: true,
                        RestrictPublicBuckets: true,
                    },
                    BucketEncryption: {
                        ServerSideEncryptionConfiguration: [
                            { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
                        ],
                    },
                    // 標準ログは ACL で書き込まれるので ACL を無効にしない（持ち主はこのアカウント）。
                    OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerPreferred' }] },
                }),
            );
            expect(bucket.Properties.VersioningConfiguration).toBeUndefined();
            const policies = Object.values(template.findResources('AWS::S3::BucketPolicy')).filter(
                (p) => JSON.stringify(p.Properties.Bucket).includes('SiteLogBucket'),
            );
            expect(policies).toHaveLength(1);
            expect(policies[0].Properties.PolicyDocument.Statement).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        Effect: 'Deny',
                        Condition: { Bool: { 'aws:SecureTransport': 'false' } },
                    }),
                ]),
            );
        });

        test('access logs are deleted after the retention period', () => {
            // 人間が決めた保持期間（30 日）。変えるときは docs/hosting/README.md も直す。
            expect(SITE_ACCESS_LOG_RETENTION_DAYS).toBe(30);
            const rules = logBucket().Properties.LifecycleConfiguration.Rules;
            expect(rules).toEqual([
                expect.objectContaining({
                    Status: 'Enabled',
                    ExpirationInDays: SITE_ACCESS_LOG_RETENTION_DAYS,
                }),
            ]);
        });

        test('access log bucket is not retained (logs are not needed to keep serving)', () => {
            expect(logBucket()).toEqual(
                expect.objectContaining({
                    DeletionPolicy: 'Delete',
                    UpdateReplacePolicy: 'Delete',
                }),
            );
        });

        test('distribution writes standard logs to the log bucket without cookies', () => {
            const distribution = Object.values(
                template.findResources('AWS::CloudFront::Distribution'),
            )[0];
            const logging = distribution.Properties.DistributionConfig.Logging;
            expect(logging).toEqual({
                Bucket: {
                    'Fn::GetAtt': [expect.stringMatching(/^SiteLogBucket/), 'RegionalDomainName'],
                },
                IncludeCookies: false,
                Prefix: SITE_ACCESS_LOG_PREFIX,
            });
        });

        test('deploy role cannot touch the access log bucket', () => {
            const statements = Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
                (p) => p.Properties.PolicyDocument.Statement,
            );
            expect(JSON.stringify(statements)).not.toContain('SiteLogBucket');
        });

        test('keeps the distribution logical id so CloudFront is updated, not replaced', () => {
            expect(Object.keys(template.findResources('AWS::CloudFront::Distribution'))).toEqual([
                expect.stringMatching(/^SiteDistribution[0-9A-F]{8}$/),
            ]);
        });

        test('certificate for smalruby.app is DNS validated in us-east-1 with the site zone', () => {
            // DnsValidatedCertificate は us-east-1 の証明書をカスタムリソースで作る（スタックは分けない）。
            template.resourceCountIs('AWS::CertificateManager::Certificate', 0);
            template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
            const zoneId = Object.keys(template.findResources('AWS::Route53::HostedZone'))[0];
            template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
                DomainName: 'smalruby.app',
                Region: 'us-east-1',
                HostedZoneId: { Ref: zoneId },
            });
            // www は今は無いので SAN に足さない。
            const cert = Object.values(
                template.findResources('AWS::CloudFormation::CustomResource'),
            )[0];
            expect(cert.Properties.SubjectAlternativeNames).toBeUndefined();
        });

        test('apex still points to GitHub Pages (no alias to CloudFront yet)', () => {
            const records = Object.values(template.findResources('AWS::Route53::RecordSet'));
            expect(records.filter((r) => r.Properties.AliasTarget)).toEqual([]);
            const apexA = records.filter(
                (r) => r.Properties.Type === 'A' && r.Properties.Name === 'smalruby.app.',
            );
            expect(apexA).toHaveLength(1);
            expect([...apexA[0].Properties.ResourceRecords].sort()).toEqual([
                '185.199.108.153',
                '185.199.109.153',
                '185.199.110.153',
                '185.199.111.153',
            ]);
            expect(records.filter((r) => r.Properties.Type === 'AAAA')).toEqual([]);
        });

        test('cache policy keeps index.html short and lets hashed assets stay long', () => {
            template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
                CachePolicyConfig: Match.objectLike({
                    MinTTL: 0,
                    DefaultTTL: PREVIEW_DEFAULT_TTL_SECONDS,
                    MaxTTL: 365 * 24 * 60 * 60,
                }),
            });
        });

        test('response headers keep HSTS like GitHub Pages', () => {
            template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
                ResponseHeadersPolicyConfig: Match.objectLike({
                    SecurityHeadersConfig: Match.objectLike({
                        StrictTransportSecurity: Match.objectLike({
                            AccessControlMaxAgeSec: 365 * 24 * 60 * 60,
                        }),
                        ContentTypeOptions: Match.anyValue(),
                    }),
                }),
            });
        });

        test('deploy role trusts only develop (or the prod environment) of this repository', () => {
            template.resourceCountIs('Custom::AWSCDKOpenIdConnectProvider', 0);
            template.resourceCountIs('AWS::IAM::OIDCProvider', 0);
            // OIDC で引き受けるロールは CI 用の 1 つだけ（もう 1 つは証明書のカスタムリソースの Lambda 用）。
            const oidcRoles = Object.values(template.findResources('AWS::IAM::Role')).filter((r) =>
                JSON.stringify(r.Properties.AssumeRolePolicyDocument).includes(
                    'sts:AssumeRoleWithWebIdentity',
                ),
            );
            expect(oidcRoles).toHaveLength(1);
            template.hasResourceProperties('AWS::IAM::Role', {
                AssumeRolePolicyDocument: {
                    Statement: [
                        Match.objectLike({
                            Action: 'sts:AssumeRoleWithWebIdentity',
                            Condition: {
                                StringEquals: {
                                    'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                                },
                                StringLike: {
                                    'token.actions.githubusercontent.com:sub': [
                                        'repo:smalruby/smalruby3-editor:ref:refs/heads/develop',
                                        'repo:smalruby/smalruby3-editor:environment:prod',
                                    ],
                                },
                            },
                        }),
                    ],
                },
            });
        });

        test('deploy role can only touch this bucket and invalidate this distribution', () => {
            const roleId = Object.keys(template.findResources('AWS::IAM::Role')).find((id) =>
                id.startsWith('SiteDeployRole'),
            );
            const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter(
                (p) => JSON.stringify(p.Properties.Roles) === JSON.stringify([{ Ref: roleId }]),
            );
            expect(policies).toHaveLength(1);
            const statements = policies.flatMap((p) => p.Properties.PolicyDocument.Statement);
            const actions = statements.flatMap((s: { Action: string | string[] }) =>
                Array.isArray(s.Action) ? s.Action : [s.Action],
            );
            expect(actions.sort()).toEqual(
                [
                    'cloudfront:CreateInvalidation',
                    'cloudfront:GetInvalidation',
                    's3:DeleteObject',
                    's3:ListBucket',
                    's3:PutObject',
                ].sort(),
            );
            for (const s of statements) {
                expect(JSON.stringify(s.Resource)).not.toContain('"*"');
            }
        });

        test('outputs the role ARN, bucket name, distribution id and domain for CI', () => {
            expect(Object.keys(template.findOutputs('*')).sort()).toEqual(
                [
                    'SiteBucketName',
                    'SiteCertificateArn',
                    'SiteDeployRoleArn',
                    'SiteDistributionDomainName',
                    'SiteDistributionId',
                    // smalruby.app のゾーン（test/site-zone.test.ts）
                    'SiteHostedZoneId',
                    'SiteHostedZoneNameServers',
                    'SiteLogBucketName',
                ].sort(),
            );
        });
    });

    describe('preview delivery (stg)', () => {
        let template: Template;

        beforeAll(() => {
            template = synth('stg');
        });

        test('keeps the hosted zone logical id so the zone is never recreated', () => {
            expect(Object.keys(template.findResources('AWS::Route53::HostedZone'))).toEqual([
                expect.stringMatching(/^PreviewHostedZone/),
            ]);
        });

        test('bucket is private (block public access all on) and SSL only', () => {
            template.resourceCountIs('AWS::S3::Bucket', 1);
            template.hasResourceProperties('AWS::S3::Bucket', {
                PublicAccessBlockConfiguration: {
                    BlockPublicAcls: true,
                    BlockPublicPolicy: true,
                    IgnorePublicAcls: true,
                    RestrictPublicBuckets: true,
                },
            });
            template.hasResourceProperties('AWS::S3::BucketPolicy', {
                PolicyDocument: {
                    Statement: Match.arrayWith([
                        Match.objectLike({
                            Effect: 'Deny',
                            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
                        }),
                    ]),
                },
            });
        });

        test('bucket expires long-untouched objects as a safety net', () => {
            template.hasResourceProperties('AWS::S3::Bucket', {
                LifecycleConfiguration: {
                    Rules: Match.arrayWith([
                        Match.objectLike({
                            Status: 'Enabled',
                            ExpirationInDays: PREVIEW_OBJECT_EXPIRATION_DAYS,
                        }),
                    ]),
                },
            });
            expect(PREVIEW_OBJECT_EXPIRATION_DAYS).toBeGreaterThanOrEqual(180);
        });

        test('certificate for preview.smalruby.app is DNS validated in us-east-1', () => {
            template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
                DomainName: 'preview.smalruby.app',
                Region: 'us-east-1',
            });
        });

        test('distribution serves preview.smalruby.app from S3 through OAC', () => {
            template.resourceCountIs('AWS::CloudFront::Distribution', 1);
            template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
            template.hasResourceProperties('AWS::CloudFront::Distribution', {
                DistributionConfig: Match.objectLike({
                    Aliases: ['preview.smalruby.app'],
                    ViewerCertificate: Match.objectLike({
                        SslSupportMethod: 'sni-only',
                    }),
                    DefaultCacheBehavior: Match.objectLike({
                        ViewerProtocolPolicy: 'redirect-to-https',
                        FunctionAssociations: [
                            Match.objectLike({ EventType: 'viewer-request' }),
                        ],
                    }),
                }),
            });
        });

        test('preview keeps its own cache policy and Price Class 200 (not on a flat-rate plan)', () => {
            const config = Object.values(template.findResources('AWS::CloudFront::Distribution'))[0]
                .Properties.DistributionConfig;
            expect(config.PriceClass).toBe('PriceClass_200');
            expect(config.DefaultCacheBehavior.CachePolicyId).toEqual({
                Ref: expect.stringMatching(/^PreviewCachePolicy/),
            });
            template.resourceCountIs('AWS::CloudFront::Function', 1);
        });

        test('cache policy keeps index.html short and lets hashed assets stay long', () => {
            template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
                CachePolicyConfig: Match.objectLike({
                    MinTTL: 0,
                    DefaultTTL: PREVIEW_DEFAULT_TTL_SECONDS,
                    MaxTTL: 365 * 24 * 60 * 60,
                }),
            });
            expect(PREVIEW_DEFAULT_TTL_SECONDS).toBeLessThanOrEqual(300);
        });

        test('alias records point preview.smalruby.app to CloudFront (no wildcard)', () => {
            for (const type of ['A', 'AAAA']) {
                template.hasResourceProperties('AWS::Route53::RecordSet', {
                    Name: 'preview.smalruby.app.',
                    Type: type,
                    AliasTarget: Match.objectLike({ HostedZoneId: Match.anyValue() }),
                });
            }
            const names = Object.values(template.findResources('AWS::Route53::RecordSet')).map(
                (r) => r.Properties.Name,
            );
            expect(names.some((n: unknown) => typeof n === 'string' && n.includes('*'))).toBe(
                false,
            );
        });

        test('deploy role trusts only this repository via the existing GitHub OIDC provider', () => {
            template.resourceCountIs('Custom::AWSCDKOpenIdConnectProvider', 0);
            template.resourceCountIs('AWS::IAM::OIDCProvider', 0);
            template.hasResourceProperties('AWS::IAM::Role', {
                AssumeRolePolicyDocument: {
                    Statement: [
                        Match.objectLike({
                            Action: 'sts:AssumeRoleWithWebIdentity',
                            Condition: {
                                StringEquals: {
                                    'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
                                },
                                StringLike: {
                                    'token.actions.githubusercontent.com:sub':
                                        'repo:smalruby/smalruby3-editor:*',
                                },
                            },
                        }),
                    ],
                },
            });
        });

        test('deploy role can only touch this bucket and invalidate this distribution', () => {
            const roleId = Object.keys(template.findResources('AWS::IAM::Role')).find((id) =>
                id.startsWith('PreviewDeployRole'),
            );
            const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter(
                (p) => JSON.stringify(p.Properties.Roles) === JSON.stringify([{ Ref: roleId }]),
            );
            expect(policies).toHaveLength(1);
            const statements = policies.flatMap(
                (p) => p.Properties.PolicyDocument.Statement,
            );
            const actions = statements.flatMap((s: { Action: string | string[] }) =>
                Array.isArray(s.Action) ? s.Action : [s.Action],
            );
            expect(actions.sort()).toEqual(
                [
                    'cloudfront:CreateInvalidation',
                    'cloudfront:GetInvalidation',
                    's3:DeleteObject',
                    's3:ListBucket',
                    's3:PutObject',
                ].sort(),
            );
            for (const s of statements) {
                expect(JSON.stringify(s.Resource)).not.toContain('"*"');
            }
        });

        test('outputs the role ARN, bucket name and distribution id for CI', () => {
            expect(Object.keys(template.findOutputs('*'))).toEqual(
                expect.arrayContaining([
                    'PreviewDeployRoleArn',
                    'PreviewBucketName',
                    'PreviewDistributionId',
                ]),
            );
        });
    });
});
