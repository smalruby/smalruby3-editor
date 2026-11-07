import * as cdk from 'aws-cdk-lib/core';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

/** プレビュー配信用のゾーン名（お名前.com から NS を委任する）。 */
export const PREVIEW_ZONE_NAME = 'preview.smalruby.app';

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

        // ACM 証明書はここで作らない。委任が効いて公開 DNS から検証レコードが見えるまで
        // 発行されず、デプロイが待ち続けて失敗するため（証明書と配信基盤は別 Issue）。
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
    }
}
