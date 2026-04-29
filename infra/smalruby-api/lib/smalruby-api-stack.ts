import * as cdk from 'aws-cdk-lib/core';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import { Construct } from 'constructs';

export class SmalrubyApiStack extends cdk.Stack {
    public readonly api: apigatewayv2.HttpApi;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
        const stageSuffix = stage === 'prod' ? '' : `-${stage}`;

        const corsOriginsEnv =
            process.env.CORS_ALLOWED_ORIGINS ||
            'https://smalruby.app,https://smalruby.jp,http://localhost:8601';
        const corsAllowOrigins = corsOriginsEnv.split(',').map(o => o.trim());

        const meshZoneSecretKey = process.env.MESH_ZONE_SECRET_KEY || '';
        if (!meshZoneSecretKey) {
            throw new Error(
                'MESH_ZONE_SECRET_KEY is required. Set it in .env (gitignored).',
            );
        }

        cdk.Tags.of(this).add('Project', 'SmalrubyApi');
        cdk.Tags.of(this).add('Stage', stage);
        cdk.Tags.of(this).add('Service', 'Lambda');
        cdk.Tags.of(this).add('ManagedBy', 'CDK');

        // --- Lambda functions ---

        const makeLambda = (
            constructId: string,
            functionName: string,
            entry: string,
            extraEnv: Record<string, string> = {},
            memorySize = 128,
            timeoutSec = 10,
        ): lambdaNodejs.NodejsFunction => {
            const logGroup = new logs.LogGroup(this, `${constructId}LogGroup`, {
                logGroupName: `/aws/lambda/${functionName}`,
                retention:
                    stage === 'prod'
                        ? logs.RetentionDays.ONE_MONTH
                        : logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });

            return new lambdaNodejs.NodejsFunction(this, constructId, {
                functionName,
                runtime: lambda.Runtime.NODEJS_20_X,
                entry: path.join(__dirname, `../lambda/${entry}`),
                handler: 'handler',
                timeout: cdk.Duration.seconds(timeoutSec),
                memorySize,
                logGroup,
                architecture: lambda.Architecture.ARM_64,
                environment: {
                    STAGE: stage,
                    ...extraEnv,
                },
                bundling: {
                    minify: true,
                    sourceMap: stage !== 'prod',
                    externalModules: [],
                },
            });
        };

        const corsProxyFn = makeLambda(
            'CorsProxy',
            `smalruby-api-cors-proxy${stageSuffix}`,
            'cors-proxy.ts',
            {},
            512,
            30,
        );

        const meshZoneGetFn = makeLambda(
            'MeshZoneGet',
            `smalruby-api-mesh-zone${stageSuffix}`,
            'mesh-zone-get.ts',
            { MESH_ZONE_SECRET_KEY: meshZoneSecretKey },
        );

        const scratchProjectsFn = makeLambda(
            'ScratchApiProjects',
            `smalruby-api-scratch-projects${stageSuffix}`,
            'scratch-api-projects.ts',
        );

        const scratchTranslateFn = makeLambda(
            'ScratchApiTranslate',
            `smalruby-api-scratch-translate${stageSuffix}`,
            'scratch-api-translate.ts',
        );

        // --- Custom Domain ---

        const parentZoneName = process.env.ROUTE53_PARENT_ZONE_NAME || 'api.smalruby.app';
        const defaultCustomDomain =
            stage === 'prod' ? parentZoneName : `${stage}.${parentZoneName}`;
        const customDomain =
            process.env.SMALRUBY_API_CUSTOM_DOMAIN === 'false'
                ? undefined
                : process.env.SMALRUBY_API_CUSTOM_DOMAIN || defaultCustomDomain;

        // Optional import of an existing API Gateway custom domain.
        // Used during the prod cutover from the legacy SAM stack: the
        // `api.smalruby.app` custom domain (and its ACM certificate / Route53
        // alias) already exists, so importing it lets us reuse those resources
        // and minimise downtime — only the base path mapping needs to swap.
        const importExistingDomain = process.env.IMPORT_EXISTING_CUSTOM_DOMAIN === 'true';
        const importedRegionalDomainName = process.env.IMPORTED_REGIONAL_DOMAIN_NAME;
        const importedRegionalHostedZoneId = process.env.IMPORTED_REGIONAL_HOSTED_ZONE_ID;

        let domainName: apigatewayv2.IDomainName | undefined;
        let zone: route53.IHostedZone | undefined;
        let manageRoute53Record = false;

        if (customDomain) {
            if (importExistingDomain) {
                if (!importedRegionalDomainName || !importedRegionalHostedZoneId) {
                    throw new Error(
                        'IMPORT_EXISTING_CUSTOM_DOMAIN=true requires IMPORTED_REGIONAL_DOMAIN_NAME ' +
                            'and IMPORTED_REGIONAL_HOSTED_ZONE_ID to be set.',
                    );
                }
                // Import the existing custom domain; we do not create a new ACM
                // cert or Route53 record. The Route53 A record already points
                // at this regional endpoint, so traffic continues to flow.
                domainName = apigatewayv2.DomainName.fromDomainNameAttributes(this, 'ApiDomainName', {
                    name: customDomain,
                    regionalDomainName: importedRegionalDomainName,
                    regionalHostedZoneId: importedRegionalHostedZoneId,
                });
            } else {
                zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
                    domainName: parentZoneName,
                });

                const certificate = new acm.Certificate(this, 'ApiCertificate', {
                    domainName: customDomain,
                    validation: acm.CertificateValidation.fromDns(zone),
                });

                domainName = new apigatewayv2.DomainName(this, 'ApiDomainName', {
                    domainName: customDomain,
                    certificate,
                });
                manageRoute53Record = true;
            }
        }

        // --- HTTP API ---

        this.api = new apigatewayv2.HttpApi(this, 'SmalrubyApi', {
            apiName: `SmalrubyApi${stageSuffix}`,
            corsPreflight: {
                allowOrigins: corsAllowOrigins,
                allowMethods: [apigatewayv2.CorsHttpMethod.GET, apigatewayv2.CorsHttpMethod.OPTIONS],
                allowHeaders: ['Content-Type'],
                maxAge: cdk.Duration.hours(24),
            },
            defaultDomainMapping: domainName ? { domainName } : undefined,
        });

        const integrationFor = (constructId: string, fn: lambda.IFunction) =>
            new apigatewayv2Integrations.HttpLambdaIntegration(constructId, fn);

        this.api.addRoutes({
            path: '/cors-proxy',
            methods: [apigatewayv2.HttpMethod.GET],
            integration: integrationFor('CorsProxyIntegration', corsProxyFn),
        });

        this.api.addRoutes({
            path: '/mesh-domain',
            methods: [apigatewayv2.HttpMethod.GET],
            integration: integrationFor('MeshZoneGetIntegration', meshZoneGetFn),
        });

        this.api.addRoutes({
            path: '/scratch-api-proxy/projects/{projectId}',
            methods: [apigatewayv2.HttpMethod.GET],
            integration: integrationFor('ScratchApiProjectsIntegration', scratchProjectsFn),
        });

        this.api.addRoutes({
            path: '/scratch-api-proxy/translate',
            methods: [apigatewayv2.HttpMethod.GET],
            integration: integrationFor('ScratchApiTranslateIntegration', scratchTranslateFn),
        });

        // Throttling
        const defaultStage = this.api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
        if (defaultStage) {
            defaultStage.defaultRouteSettings = {
                throttlingRateLimit: stage === 'prod' ? 200 : 50,
                throttlingBurstLimit: stage === 'prod' ? 200 : 50,
            };
        }

        cdk.Tags.of(this.api).add('ResourceType', 'APIGatewayHTTPAPI');

        // Route53 Alias record (only when CDK manages the custom domain itself).
        // When importing an existing custom domain (prod cutover), the Route53
        // record already exists and is owned by another (or no) stack.
        if (manageRoute53Record && customDomain && zone && domainName) {
            const subdomain = customDomain === parentZoneName
                ? ''
                : customDomain.replace(`.${parentZoneName}`, '');

            new route53.ARecord(this, 'ApiAliasRecord', {
                zone,
                recordName: subdomain || undefined,
                target: route53.RecordTarget.fromAlias(
                    new route53Targets.ApiGatewayv2DomainProperties(
                        domainName.regionalDomainName,
                        domainName.regionalHostedZoneId,
                    ),
                ),
            });
        }

        // Outputs
        new cdk.CfnOutput(this, 'HttpApiEndpoint', {
            value: this.api.apiEndpoint,
            description: 'API Gateway HTTP API default endpoint',
        });

        if (customDomain) {
            new cdk.CfnOutput(this, 'CustomDomainUrl', {
                value: `https://${customDomain}`,
                description: 'Smalruby API custom domain URL',
            });
        }
    }
}
