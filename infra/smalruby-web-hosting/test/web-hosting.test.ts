import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { SmalrubyWebHostingStack } from '../lib/web-hosting-stack';

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

    test('stg does not create a certificate yet (needs the delegation first)', () => {
        const template = synth('stg');

        template.resourceCountIs('AWS::CertificateManager::Certificate', 0);
    });

    test('prod creates no preview resources', () => {
        const template = synth('prod');

        template.resourceCountIs('AWS::Route53::HostedZone', 0);
        expect(Object.keys(template.findOutputs('*'))).toEqual([]);
    });

    test('stages other than stg create no preview zone (avoid a duplicate zone)', () => {
        const template = synth('stg2');

        template.resourceCountIs('AWS::Route53::HostedZone', 0);
    });
});
