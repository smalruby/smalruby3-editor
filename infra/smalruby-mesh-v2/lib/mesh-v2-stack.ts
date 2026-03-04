import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as path from 'path';
import { Construct } from 'constructs';

export class MeshV2Stack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly api: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Stage取得（優先順位: --context stage=..., .envのSTAGE, デフォルト: stg）
    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
    const stageSuffix = stage === 'prod' ? '' : `-${stage}`;

    // Custom Domain configuration from environment variables
    const parentZoneName = process.env.ROUTE53_PARENT_ZONE_NAME || 'api.smalruby.app';
    const defaultCustomDomain = stage === 'prod' ? `graphql.${parentZoneName}` : `${stage}.graphql.${parentZoneName}`;
    const customDomain = process.env.APPSYNC_CUSTOM_DOMAIN === 'false'
      ? undefined
      : (process.env.APPSYNC_CUSTOM_DOMAIN || defaultCustomDomain);

    let domainOptions: appsync.DomainOptions | undefined;
    let zone: route53.IHostedZone | undefined;

    if (customDomain) {
      zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: parentZoneName,
      });

      const certificate = new acm.DnsValidatedCertificate(this, 'ApiCertificate', {
        domainName: customDomain,
        hostedZone: zone,
        region: 'us-east-1',
      });

      domainOptions = {
        certificate,
        domainName: customDomain,
      };
    }

    // Stack全体にタグ付与
    cdk.Tags.of(this).add('Project', 'MeshV2');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Service', 'AppSync');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // DynamoDB Table for Mesh v2
    this.table = new dynamodb.Table(this, 'MeshV2Table', {
      tableName: `MeshV2Table${stageSuffix}`,
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false, // Disable for cost optimization in dev
      },
      timeToLiveAttribute: 'ttl',
    });

    // DynamoDB Tableにタグ付与
    cdk.Tags.of(this.table).add('ResourceType', 'DynamoDB');

    // GSI: GroupIdIndex for reverse lookup (groupId -> domain)
    this.table.addGlobalSecondaryIndex({
      indexName: 'GroupIdIndex',
      partitionKey: {
        name: 'gsi_pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'gsi_sk',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output table name
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name for Mesh v2',
    });

    // Output table ARN
    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN for Mesh v2',
    });

    // Environment variables defaults based on stage
    const defaultMaxConnTimeSeconds = stage === 'prod' ? '1500' : '300';

    // AppSync GraphQL API for Mesh v2
    this.api = new appsync.GraphqlApi(this, 'MeshV2Api', {
      name: `MeshV2Api${stageSuffix}`,
      definition: appsync.Definition.fromFile(path.join(__dirname, '../graphql/schema.graphql')),
      domainName: domainOptions,
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)), // 1 year for development
          },
        },
      },
      environmentVariables: {
        TABLE_NAME: this.table.tableName,
        MESH_HOST_HEARTBEAT_INTERVAL_SECONDS: process.env.MESH_HOST_HEARTBEAT_INTERVAL_SECONDS || '60',
        MESH_HOST_HEARTBEAT_TTL_SECONDS: process.env.MESH_HOST_HEARTBEAT_TTL_SECONDS || '150',
        MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS: process.env.MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS || '120',
        MESH_MEMBER_HEARTBEAT_TTL_SECONDS: process.env.MESH_MEMBER_HEARTBEAT_TTL_SECONDS || '600',
        MESH_MAX_CONNECTION_TIME_SECONDS: process.env.MESH_MAX_CONNECTION_TIME_SECONDS || defaultMaxConnTimeSeconds,
        MESH_EVENT_TTL_SECONDS: process.env.MESH_EVENT_TTL_SECONDS || '10',
        MESH_POLLING_INTERVAL_SECONDS: process.env.MESH_POLLING_INTERVAL_SECONDS || '2',
      },

      xrayEnabled: stage !== 'prod',
      logConfig: {
        fieldLogLevel: stage === 'prod' ? appsync.FieldLogLevel.ERROR : appsync.FieldLogLevel.ALL,
        excludeVerboseContent: stage === 'prod',
      },
    });

    // Route53 Alias record for Custom Domain
    if (customDomain && zone) {
      // Extract subdomain from customDomain (e.g., "graphql.api.smalruby.app" -> "graphql")
      const subdomain = customDomain.replace(`.${parentZoneName}`, '');

      new route53.ARecord(this, 'ApiAliasRecord', {
        zone,
        recordName: subdomain,
        target: route53.RecordTarget.fromAlias(new targets.AppSyncTarget(this.api)),
      });
    }

    // AppSync APIにタグ付与
    cdk.Tags.of(this.api).add('ResourceType', 'GraphQLAPI');

    // DynamoDB Data Source
    const dynamoDbDataSource = this.api.addDynamoDbDataSource(
      'MeshV2TableDataSource',
      this.table
    );

    // None Data Source for event pass-through
    const noneDataSource = this.api.addNoneDataSource('NoneDataSource');

    // Lambda function for complex operations (Dissolve, Leave, RecordEvents, etc.)
    const meshV2Lambda = new lambda.Function(this, 'MeshV2LambdaFunction', {
      functionName: `MeshV2-GraphQL${stageSuffix}`,
      runtime: lambda.Runtime.RUBY_3_4,
      handler: 'handlers/appsync_handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        DYNAMODB_TABLE_NAME: this.table.tableName,
        MESH_SECRET_KEY: process.env.MESH_SECRET_KEY || 'default-secret-key',
        MESH_HOST_HEARTBEAT_INTERVAL_SECONDS: process.env.MESH_HOST_HEARTBEAT_INTERVAL_SECONDS || '60',
        MESH_HOST_HEARTBEAT_TTL_SECONDS: process.env.MESH_HOST_HEARTBEAT_TTL_SECONDS || '150',
        MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS: process.env.MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS || '120',
        MESH_MEMBER_HEARTBEAT_TTL_SECONDS: process.env.MESH_MEMBER_HEARTBEAT_TTL_SECONDS || '600',
        MESH_MAX_CONNECTION_TIME_SECONDS: process.env.MESH_MAX_CONNECTION_TIME_SECONDS || defaultMaxConnTimeSeconds,
        MESH_EVENT_TTL_SECONDS: process.env.MESH_EVENT_TTL_SECONDS || '10',
        MESH_POLLING_INTERVAL_SECONDS: process.env.MESH_POLLING_INTERVAL_SECONDS || '2',
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant Lambda permissions to DynamoDB
    this.table.grantReadWriteData(meshV2Lambda);

    // Lambda Data Source
    const meshV2DataSource = this.api.addLambdaDataSource(
      'MeshV2LambdaDataSource',
      meshV2Lambda
    );

    // Function: checkGroupExists (共通のグループ存在確認)
    const checkGroupExistsFunction = new appsync.AppsyncFunction(this, 'CheckGroupExistsFunction', {
      name: 'checkGroupExists',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/functions/checkGroupExists.js'))
    });

    // Grant additional permissions for TransactWriteItems
    this.table.grantReadWriteData(dynamoDbDataSource.grantPrincipal);

    // Resolvers for Phase 2-1: Group Management

    // Query: listGroupsByDomain
    dynamoDbDataSource.createResolver('ListGroupsByDomainResolver', {
      typeName: 'Query',
      fieldName: 'listGroupsByDomain',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/resolvers/Query.listGroupsByDomain.js'))
    });

    // Query: listGroupStatuses
    dynamoDbDataSource.createResolver('ListGroupStatusesResolver', {
      typeName: 'Query',
      fieldName: 'listGroupStatuses',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/resolvers/Query.listGroupStatuses.js'))
    });

    // Query: getNodeStatus (Pipeline Resolver for better reliability)
    const findNodeMetadataFunction = new appsync.AppsyncFunction(this, 'FindNodeMetadataFunction', {
      name: 'findNodeMetadata',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/functions/findNodeMetadata.js'))
    });

    const fetchNodeStatusFunction = new appsync.AppsyncFunction(this, 'FetchNodeStatusFunction', {
      name: 'fetchNodeStatus',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/functions/fetchNodeStatus.js'))
    });

    new appsync.Resolver(this, 'GetNodeStatusResolver', {
      api: this.api,
      typeName: 'Query',
      fieldName: 'getNodeStatus',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [findNodeMetadataFunction, fetchNodeStatusFunction],
      code: appsync.Code.fromInline(`
        export function request(ctx) {
          return {};
        }
        export function response(ctx) {
          return ctx.prev.result;
        }
      `)
    });

    // Query: listNodesInGroup
    dynamoDbDataSource.createResolver('ListNodesInGroupResolver', {
      typeName: 'Query',
      fieldName: 'listNodesInGroup',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/resolvers/Query.listNodesInGroup.js'))
    });

    // Mutation: createGroup (Pipeline Resolver for idempotency)
    // Function 1: Check if group already exists for this hostId + domain
    const checkExistingGroupFunction = new appsync.AppsyncFunction(this, 'CheckExistingGroupFunction', {
      name: 'checkExistingGroup',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/functions/checkExistingGroup.js'))
    });

    // Function 2: Create group if not exists, or return existing group
    const createGroupIfNotExistsFunction = new appsync.AppsyncFunction(this, 'CreateGroupIfNotExistsFunction', {
      name: 'createGroupIfNotExists',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/functions/createGroupIfNotExists.js'))
    });

    // Pipeline Resolver: createGroup
    new appsync.Resolver(this, 'CreateGroupPipelineResolver', {
      api: this.api,
      typeName: 'Mutation',
      fieldName: 'createGroup',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [checkExistingGroupFunction, createGroupIfNotExistsFunction],
      code: appsync.Code.fromInline(`
        // Pipeline resolver: pass through
        export function request(ctx) {
          return {};
        }
        export function response(ctx) {
          return ctx.prev.result;
        }
      `)
    });

    // Mutation: joinGroup (Pipeline Resolver for consistency and expiresAt validation)
    const joinGroupFunction = new appsync.AppsyncFunction(this, 'JoinGroupFunction', {
      name: 'joinGroupFunction',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/functions/joinGroupFunction.js'))
    });

    this.api.createResolver('JoinGroupResolver', {
      typeName: 'Mutation',
      fieldName: 'joinGroup',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [checkGroupExistsFunction, joinGroupFunction],
      code: appsync.Code.fromInline(`
        // Pipeline resolver: pass through
        export function request(ctx) {
          return {};
        }
        export function response(ctx) {
          return ctx.prev.result;
        }
      `)
    });

    // Resolvers for Phase 2-2: High-Frequency Mutations

    // Mutation: renewHeartbeat
    const renewHeartbeatFunction = new appsync.AppsyncFunction(this, 'RenewHeartbeatFunction', {
      name: 'renewHeartbeatFunction',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/functions/renewHeartbeatFunction.js'))
    });

    new appsync.Resolver(this, 'RenewHeartbeatResolver', {
      api: this.api,
      typeName: 'Mutation',
      fieldName: 'renewHeartbeat',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [checkGroupExistsFunction, renewHeartbeatFunction],
      code: appsync.Code.fromInline(`
        // Pipeline resolver: pass through
        export function request(ctx) {
          return {};
        }
        export function response(ctx) {
          return ctx.prev.result;
        }
      `)
    });

    // Function: updateNodeTTL
    const updateNodeTTLFunction = new appsync.AppsyncFunction(this, 'UpdateNodeTTLFunction', {
      name: 'updateNodeTTL',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/functions/updateNodeTTL.js'))
    });

    // Pipeline Resolver: sendMemberHeartbeat (グループ存在確認 → Node TTL更新)
    new appsync.Resolver(this, 'SendMemberHeartbeatResolver', {
      api: this.api,
      typeName: 'Mutation',
      fieldName: 'sendMemberHeartbeat',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [checkGroupExistsFunction, updateNodeTTLFunction],
      code: appsync.Code.fromInline(`
        // Pipeline resolver: pass through
        export function request(ctx) {
          return {};
        }
        export function response(ctx) {
          return ctx.prev.result;
        }
      `)
    });

    // Function: reportDataByNode (main logic)
    const reportDataByNodeFunction = new appsync.AppsyncFunction(this, 'ReportDataByNodeFunction', {
      name: 'reportDataByNode',
      api: this.api,
      dataSource: dynamoDbDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/resolvers/Mutation.reportDataByNode.js'))
    });

    // Pipeline Resolver: reportDataByNode (グループ存在確認 → データ報告)
    new appsync.Resolver(this, 'ReportDataByNodePipelineResolver', {
      api: this.api,
      typeName: 'Mutation',
      fieldName: 'reportDataByNode',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [checkGroupExistsFunction, reportDataByNodeFunction],
      code: appsync.Code.fromInline(`
        // Pipeline resolver: pass through
        export function request(ctx) {
          return {};
        }
        export function response(ctx) {
          return ctx.prev.result;
        }
      `)
    });

    // Function: fireEventsByNode (main logic for batch)
    const fireEventsByNodeFunction = new appsync.AppsyncFunction(this, 'FireEventsByNodeFunction', {
      name: 'fireEventsByNode',
      api: this.api,
      dataSource: noneDataSource,
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/resolvers/Mutation.fireEventsByNode.js'))
    });

    // Pipeline Resolver: fireEventsByNode (グループ存在確認 → バッチイベント発火)
    new appsync.Resolver(this, 'FireEventsByNodePipelineResolver', {
      api: this.api,
      typeName: 'Mutation',
      fieldName: 'fireEventsByNode',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [checkGroupExistsFunction, fireEventsByNodeFunction],
      code: appsync.Code.fromInline(`
        // Pipeline resolver: pass through
        export function request(ctx) {
          return {};
        }
        export function response(ctx) {
          return ctx.prev.result;
        }
      `)
    });

    // Mutation: recordEventsByNode (Lambda resolver due to BatchPutItem restrictions in JS)
    meshV2DataSource.createResolver('RecordEventsByNodeResolver', {
      typeName: 'Mutation',
      fieldName: 'recordEventsByNode',
    });

    // Query: getEventsSince
    dynamoDbDataSource.createResolver('GetEventsSinceResolver', {
      typeName: 'Query',
      fieldName: 'getEventsSince',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(path.join(__dirname, '../js/resolvers/Query.getEventsSince.js'))
    });

    // Mutation: dissolveGroup (Lambda resolver)
    meshV2DataSource.createResolver('DissolveGroupResolver', {
      typeName: 'Mutation',
      fieldName: 'dissolveGroup',
    });

    // Mutation: createDomain (Lambda resolver)
    meshV2DataSource.createResolver('CreateDomainResolver', {
      typeName: 'Mutation',
      fieldName: 'createDomain',
    });

    // Mutation: leaveGroup (Lambda resolver)
    meshV2DataSource.createResolver('LeaveGroupResolver', {
      typeName: 'Mutation',
      fieldName: 'leaveGroup',
    });

    // Output API endpoint
    new cdk.CfnOutput(this, 'GraphQLApiEndpoint', {
      value: this.api.graphqlUrl,
      description: 'AppSync GraphQL API endpoint',
    });

    // Output API key
    new cdk.CfnOutput(this, 'GraphQLApiKey', {
      value: this.api.apiKey || '',
      description: 'AppSync API Key',
    });

    // Output API ID
    new cdk.CfnOutput(this, 'GraphQLApiId', {
      value: this.api.apiId,
      description: 'AppSync GraphQL API ID',
    });

    // Output Custom Domain URL
    if (customDomain) {
      new cdk.CfnOutput(this, 'CustomDomainUrl', {
        value: `https://${customDomain}/graphql`,
        description: 'AppSync Custom Domain URL',
      });
    }
  }
}
