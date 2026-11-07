import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
    PREVIEW_DEFAULT_TTL_SECONDS,
    PREVIEW_OBJECT_EXPIRATION_DAYS,
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

        template.resourceCountIs('AWS::Route53::HostedZone', 0);
        template.resourceCountIs('AWS::S3::Bucket', 0);
        template.resourceCountIs('AWS::CloudFront::Distribution', 0);
        template.resourceCountIs('AWS::IAM::Role', 0);
        expect(Object.keys(template.findOutputs('*'))).toEqual([]);
    });

    test('stages other than stg create no preview zone (avoid a duplicate zone)', () => {
        const template = synth('stg2');

        template.resourceCountIs('AWS::Route53::HostedZone', 0);
        template.resourceCountIs('AWS::CloudFront::Distribution', 0);
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
