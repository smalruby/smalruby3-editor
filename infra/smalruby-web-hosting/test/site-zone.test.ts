import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { SmalrubyWebHostingStack } from '../lib/web-hosting-stack';

const env = { account: '123456789012', region: 'ap-northeast-1' };

const synth = (stage: string): Template => {
    const app = new cdk.App();
    const stack = new SmalrubyWebHostingStack(app, `TestStack-${stage}`, { env, stage });
    return Template.fromStack(stack);
};

/**
 * レコードを `名前 型 TTL 値` の 1 行ずつに並べる（照合しやすい形）。ALIAS は TTL を持たないので
 * `名前 型 ALIAS <向き先の論理 ID>` にする。
 */
const recordLines = (template: Template): string[] =>
    Object.values(template.findResources('AWS::Route53::RecordSet'))
        .flatMap((r) => {
            const { Name, Type, TTL, ResourceRecords, AliasTarget } = r.Properties;
            if (AliasTarget) {
                const ref = JSON.stringify(AliasTarget.DNSName).match(/"(\w+?)[0-9A-F]{8}"/);
                return [`${Name} ${Type} ALIAS ${ref ? ref[1] : '?'}`];
            }
            return (ResourceRecords as string[]).map((v) => `${Name} ${Type} ${TTL} ${v}`);
        })
        .sort();

// お名前.com のゾーンのエクスポートから、写すものだけを書き写した期待値（SOA・apex の NS・
// everdiary は写さない）。apex の A / AAAA は CloudFront（SiteDistribution）の ALIAS（#2007）。
const EXPECTED = [
    '_github-pages-challenge-smalruby.smalruby.app. TXT 3600 "a445b86bba88094e49c43b9af4b04d"',
    'api.smalruby.app. NS 900 ns-1254.awsdns-28.org.',
    'api.smalruby.app. NS 900 ns-1861.awsdns-40.co.uk.',
    'api.smalruby.app. NS 900 ns-457.awsdns-57.com.',
    'api.smalruby.app. NS 900 ns-703.awsdns-23.net.',
    'preview.smalruby.app. NS 900 ns-1447.awsdns-52.org.',
    'preview.smalruby.app. NS 900 ns-1984.awsdns-56.co.uk.',
    'preview.smalruby.app. NS 900 ns-233.awsdns-29.com.',
    'preview.smalruby.app. NS 900 ns-857.awsdns-43.net.',
    'smalruby.app. A ALIAS SiteDistribution',
    'smalruby.app. AAAA ALIAS SiteDistribution',
    'smalruby.app. CAA 3600 0 issue "amazon.com"',
    'smalruby.app. CAA 3600 0 issue "amazonaws.com"',
    'smalruby.app. CAA 3600 0 issue "amazontrust.com"',
    'smalruby.app. CAA 3600 0 issue "awstrust.com"',
    'smalruby.app. CAA 3600 0 issue "letsencrypt.org"',
    'smalruby.app. CAA 3600 0 issuewild ";"',
    'smalruby.app. TXT 300 "google-site-verification=IjEgIRcoKO9cJVQAqtwUZH7WfDtA9ujP2zRCJUE8vZA"',
].sort();

describe('smalruby.app hosted zone (prod)', () => {
    let template: Template;

    beforeAll(() => {
        template = synth('prod');
    });

    test('creates one public hosted zone smalruby.app', () => {
        template.resourceCountIs('AWS::Route53::HostedZone', 1);
        template.hasResourceProperties('AWS::Route53::HostedZone', { Name: 'smalruby.app.' });
    });

    test('retains the zone so its name servers never change', () => {
        template.hasResource('AWS::Route53::HostedZone', {
            DeletionPolicy: 'Retain',
            UpdateReplacePolicy: 'Retain',
        });
    });

    test('keeps the zone logical id so the zone is never recreated', () => {
        const ids = Object.keys(template.findResources('AWS::Route53::HostedZone'));
        expect(ids).toHaveLength(1);
        expect(ids[0]).toMatch(/^SiteHostedZone[0-9A-F]{8}$/);
    });

    test('keeps the apex A logical id so switching to CloudFront is an update, not a replacement', () => {
        // 論理 ID が変わると「新しい A を作る + 古い A を消す」になり、Deploy Infra が止まる
        // （同じ名前・型のレコードは同時に 2 つ作れないので、作る側も失敗する）。
        const ids = Object.entries(template.findResources('AWS::Route53::RecordSet'))
            .filter(([, r]) => r.Properties.Name === 'smalruby.app.' && r.Properties.Type === 'A')
            .map(([id]) => id);
        expect(ids).toEqual(['SiteApexA70BFC777']);
    });

    test('copies the onamae.com records with the same values', () => {
        expect(recordLines(template)).toEqual(EXPECTED);
    });

    test('all records belong to the smalruby.app zone', () => {
        const zoneId = Object.keys(template.findResources('AWS::Route53::HostedZone'))[0];
        for (const r of Object.values(template.findResources('AWS::Route53::RecordSet'))) {
            expect(r.Properties.HostedZoneId).toEqual({ Ref: zoneId });
        }
    });

    test('does not copy the apex NS / SOA, everdiary, or any wildcard', () => {
        const sets = Object.values(template.findResources('AWS::Route53::RecordSet'));
        const names = sets.map((r) => r.Properties.Name as string);
        expect(names.some((n) => n.startsWith('*') || n.includes('\\052'))).toBe(false);
        expect(names).not.toContain('everdiary.smalruby.app.');
        expect(
            sets.filter(
                (r) =>
                    r.Properties.Name === 'smalruby.app.' &&
                    ['NS', 'SOA'].includes(r.Properties.Type),
            ),
        ).toEqual([]);
    });

    test('keeps the GitHub Pages domain verification TXT', () => {
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            Name: '_github-pages-challenge-smalruby.smalruby.app.',
            Type: 'TXT',
        });
    });

    test('outputs the zone id and the name servers to register at onamae.com', () => {
        expect(Object.keys(template.findOutputs('*'))).toEqual(
            expect.arrayContaining(['SiteHostedZoneId', 'SiteHostedZoneNameServers']),
        );
    });
});

describe('smalruby.app hosted zone (other stages)', () => {
    test.each(['stg', 'stg2'])('%s does not create the smalruby.app zone', (stage) => {
        const names = Object.values(
            synth(stage).findResources('AWS::Route53::HostedZone'),
        ).map((r) => r.Properties.Name);
        expect(names).not.toContain('smalruby.app.');
    });
});
