import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import { Construct } from 'constructs';

import { resolveCorsOrigins } from './cors-origins';

export class ClassroomStack extends cdk.Stack {
  public readonly classroomsTable: dynamodb.Table;
  public readonly membershipsTable: dynamodb.Table;
  public readonly submissionsTable: dynamodb.Table;
  public readonly kickRequestsTable: dynamodb.Table;
  public readonly groupsTable: dynamodb.Table;
  public readonly coTeacherIndexTable: dynamodb.Table;
  public readonly sharedAssignmentsTable: dynamodb.Table;
  public readonly sharedReportsTable: dynamodb.Table;
  public readonly notificationsTable: dynamodb.Table;
  public readonly submissionsBucket: s3.Bucket;
  public readonly sharedBucket: s3.Bucket;
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stage = this.node.tryGetContext('stage') || process.env.STAGE || 'stg';
    const stageSuffix = stage === 'prod' ? '' : `-${stage}`;

    // CORS設定。非 prod ではローカル dev server の範囲（8601-8610）も許可する。
    const corsAllowOrigins = resolveCorsOrigins(
      stage,
      ['https://smalruby.app', 'https://smalruby.jp'],
      process.env.CORS_ALLOWED_ORIGINS,
    );
    const corsOriginsEnv = corsAllowOrigins.join(',');

    // Google Client ID for id_token verification
    const googleClientId = process.env.GOOGLE_CLIENT_ID || '';

    // Microsoft Client ID for id_token verification (optional)
    const microsoftClientId = process.env.MICROSOFT_CLIENT_ID || '';

    // Dev bypass token (stg only — allows skipping Google auth for automated testing)
    const devBypassToken = process.env.DEV_BYPASS_TOKEN || '';
    if (stage === 'prod' && devBypassToken) {
      throw new Error('DEV_BYPASS_TOKEN must not be set in production. Remove it from .env.prod.');
    }

    // Classroom TTL in days (default 90 — covers a school term so term-end
    // batch evaluation can still read every submission; configurable via env)
    const classroomTtlDays = parseInt(process.env.CLASSROOM_TTL_DAYS || '90', 10);

    // Last-resort retention (issue #1053, EPIC #1049 D7): S3 keeps submission
    // files and DynamoDB delete-snapshots for this many days so operators can
    // restore an expired classroom on request. Must not be shorter than the
    // classroom TTL — the presigned download URLs assume the S3 object
    // outlives the metadata.
    const archiveRetentionDays = parseInt(process.env.ARCHIVE_RETENTION_DAYS || '365', 10);
    if (archiveRetentionDays < classroomTtlDays) {
      throw new Error(
        `ARCHIVE_RETENTION_DAYS (${archiveRetentionDays}) must be >= CLASSROOM_TTL_DAYS (${classroomTtlDays}).`,
      );
    }

    // Tags
    cdk.Tags.of(this).add('Project', 'Classroom');
    cdk.Tags.of(this).add('Stage', stage);
    cdk.Tags.of(this).add('Service', 'Lambda');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // --- DynamoDB Tables ---

    // Classrooms table
    this.classroomsTable = new dynamodb.Table(this, 'ClassroomsTable', {
      tableName: `Classrooms${stageSuffix}`,
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      // Delete-snapshot stream for the archiver (issue #1053)
      stream: dynamodb.StreamViewType.OLD_IMAGE,
      timeToLiveAttribute: 'ttl',
    });

    // GSI: joinCode lookup (for student joining)
    this.classroomsTable.addGlobalSecondaryIndex({
      indexName: 'joinCode-index',
      partitionKey: {
        name: 'joinCode',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: teacherSub lookup (for listing teacher's classes)
    this.classroomsTable.addGlobalSecondaryIndex({
      indexName: 'teacherSub-index',
      partitionKey: {
        name: 'teacherSub',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: groupId lookup — every assignment filed under a class (組), whoever
    // created it. Replaces the `groupId IN (...)` Scan of the whole table
    // (#1146): a Scan is charged on the items read *before* the filter, so it
    // grows with the table, while this query only reads the matching rows.
    this.classroomsTable.addGlobalSecondaryIndex({
      indexName: 'groupId-index',
      partitionKey: {
        name: 'groupId',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.classroomsTable).add('ResourceType', 'DynamoDB');

    // Memberships table
    this.membershipsTable = new dynamodb.Table(this, 'MembershipsTable', {
      tableName: `ClassroomMemberships${stageSuffix}`,
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'memberId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      // Delete-snapshot stream for the archiver (issue #1053)
      stream: dynamodb.StreamViewType.OLD_IMAGE,
      timeToLiveAttribute: 'ttl',
    });

    // GSI: sessionToken lookup (for student submission auth)
    this.membershipsTable.addGlobalSecondaryIndex({
      indexName: 'sessionToken-index',
      partitionKey: {
        name: 'sessionToken',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.membershipsTable).add('ResourceType', 'DynamoDB');

    // Submissions table
    this.submissionsTable = new dynamodb.Table(this, 'SubmissionsTable', {
      tableName: `ClassroomSubmissions${stageSuffix}`,
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'submissionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      // Delete-snapshot stream for the archiver (issue #1053)
      stream: dynamodb.StreamViewType.OLD_IMAGE,
      timeToLiveAttribute: 'ttl',
    });

    // GSI: lookup submissions by member
    this.submissionsTable.addGlobalSecondaryIndex({
      indexName: 'classroomId-memberId-index',
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'memberId',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.submissionsTable).add('ResourceType', 'DynamoDB');

    // Kick requests table — short-lived (1h TTL) records of students asking
    // the teacher to free up a specific seat. PK is classroomId; SK is the
    // requestId (UUID) so multiple pending requests for the same seat
    // coexist. A GSI on (classroomId, seatNumber) lets the approve handler
    // delete sibling requests for the same seat in one query after kick.
    this.kickRequestsTable = new dynamodb.Table(this, 'KickRequestsTable', {
      tableName: `ClassroomKickRequests${stageSuffix}`,
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'requestId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      timeToLiveAttribute: 'ttl',
    });

    this.kickRequestsTable.addGlobalSecondaryIndex({
      indexName: 'classroomId-seatNumber-index',
      partitionKey: {
        name: 'classroomId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'seatNumber',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.kickRequestsTable).add('ResourceType', 'DynamoDB');

    // Groups (組) table — the teacher-side organizing concept: one school
    // class that owns many lesson classrooms over the year. Carries no
    // student data, so it uses a long TTL (default 400 days ≈ school year +
    // buffer) instead of the 90-day classroom retention.
    this.groupsTable = new dynamodb.Table(this, 'GroupsTable', {
      tableName: `ClassroomGroups${stageSuffix}`,
      partitionKey: {
        name: 'groupId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      // Delete-snapshot stream for the archiver (issue #1053)
      stream: dynamodb.StreamViewType.OLD_IMAGE,
      timeToLiveAttribute: 'ttl',
    });

    this.groupsTable.addGlobalSecondaryIndex({
      indexName: 'teacherSub-index',
      partitionKey: {
        name: 'teacherSub',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.groupsTable).add('ResourceType', 'DynamoDB');

    // Co-teacher reverse index (#1146). DynamoDB cannot index a list
    // attribute, so "which assignments / classes is this email a co-teacher
    // of?" used to be answered by scanning the whole table with
    // `contains(coTeacherEmails, :email)` — a read that grows with the table
    // even though the answer is a handful of rows. This table keeps one row
    // per (co-teacher email × resource), written whenever a co-teacher list
    // changes, so the lookup becomes a Query on the email.
    //
    // Rows carry the ttl of the resource they point at, so they expire with
    // it. A stale row is harmless: the reader fetches the real item and skips
    // the ones that are gone.
    this.coTeacherIndexTable = new dynamodb.Table(this, 'CoTeacherIndexTable', {
      tableName: `ClassroomCoTeacherIndex${stageSuffix}`,
      partitionKey: {
        name: 'coTeacherEmail',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'resourceKey',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      timeToLiveAttribute: 'ttl',
    });

    cdk.Tags.of(this.coTeacherIndexTable).add('ResourceType', 'DynamoDB');

    // --- みんなの課題 (shared assignment library, EPIC #1066) ---
    // Shared items are nationwide teacher contributions: permanent (no TTL)
    // and RETAINed in prod so a stack replacement can never destroy them
    // (deliberately different from the DESTROY classroom tables).

    const sharedRemovalPolicy = stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    this.sharedAssignmentsTable = new dynamodb.Table(this, 'SharedAssignmentsTable', {
      tableName: `SharedAssignments${stageSuffix}`,
      partitionKey: {
        name: 'sharedId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: sharedRemovalPolicy,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: stage === 'prod',
      },
    });

    // Newest-first catalog (D8).
    this.sharedAssignmentsTable.addGlobalSecondaryIndex({
      indexName: 'status-createdAt-index',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // "自分の投稿" tab: an author lists their own items incl. unlisted ones.
    this.sharedAssignmentsTable.addGlobalSecondaryIndex({
      indexName: 'authorSub-createdAt-index',
      partitionKey: {
        name: 'authorSub',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 合言葉（限定公開）での取り込み（#1109）: passcode で一意ルックアップする。
    // limited 項目のみ passcode を持つのでスパースな索引になる。
    this.sharedAssignmentsTable.addGlobalSecondaryIndex({
      indexName: 'passcode-index',
      partitionKey: {
        name: 'passcode',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    cdk.Tags.of(this.sharedAssignmentsTable).add('ResourceType', 'DynamoDB');

    // Reports are ephemeral moderation inputs (90-day TTL, D3).
    this.sharedReportsTable = new dynamodb.Table(this, 'SharedReportsTable', {
      tableName: `SharedAssignmentReports${stageSuffix}`,
      partitionKey: {
        name: 'sharedId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'reportId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      timeToLiveAttribute: 'ttl',
    });

    cdk.Tags.of(this.sharedReportsTable).add('ResourceType', 'DynamoDB');

    // --- お知らせ (notification center, EPIC #1111) ---
    // Admin → teacher notices surfaced in the class management UI. This stack
    // owns the table because teachers read it through this API with their
    // existing ID-token auth; the admin stack imports it by the fleet's stage
    // naming convention and only writes (mirror of the SharedAssignments
    // arrangement — N2: the admin stack never modifies this stack).
    // PK teacherSub / SK notificationId (createdAt-prefixed → chronological),
    // so a single Query serves the per-teacher inbox. Notices are ephemeral
    // guidance, not records: TTL is set by the writer (admin stack).
    this.notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      tableName: `ClassroomNotifications${stageSuffix}`,
      partitionKey: {
        name: 'teacherSub',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'notificationId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false,
      },
      timeToLiveAttribute: 'ttl',
    });

    cdk.Tags.of(this.notificationsTable).add('ResourceType', 'DynamoDB');

    // --- S3 Bucket for submissions ---

    this.submissionsBucket = new s3.Bucket(this, 'SubmissionsBucket', {
      bucketName: `smalruby-classroom-submissions${stageSuffix}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
      lifecycleRules: [
        {
          // Last-resort retention (issue #1053): user-facing access still
          // closes at the classroom TTL (presigned URLs are only minted from
          // live metadata); after that, only operators can reach the files.
          expiration: cdk.Duration.days(archiveRetentionDays),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: corsAllowOrigins,
          allowedHeaders: ['Content-Type'],
          maxAge: 3600,
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    cdk.Tags.of(this.submissionsBucket).add('ResourceType', 'S3');

    // --- S3 Bucket for shared assignments (みんなの課題) ---
    // No lifecycle rule: shared content is permanent (D7). The classroom
    // bucket's retention sweep must never touch these objects, hence the
    // separate bucket. RETAINed in prod like the table.

    this.sharedBucket = new s3.Bucket(this, 'SharedAssignmentsBucket', {
      bucketName: `smalruby-shared-assignments${stageSuffix}`,
      removalPolicy: sharedRemovalPolicy,
      autoDeleteObjects: stage !== 'prod',
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: corsAllowOrigins,
          allowedHeaders: ['Content-Type'],
          maxAge: 3600,
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    cdk.Tags.of(this.sharedBucket).add('ResourceType', 'S3');

    // --- Lambda ---

    const logGroup = new logs.LogGroup(this, 'ClassroomHandlerLogGroup', {
      logGroupName: `/aws/lambda/ClassroomHandler${stageSuffix}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const handlerFn = new lambdaNodejs.NodejsFunction(this, 'ClassroomHandler', {
      functionName: `ClassroomHandler${stageSuffix}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup,
      environment: {
        CLASSROOMS_TABLE_NAME: this.classroomsTable.tableName,
        MEMBERSHIPS_TABLE_NAME: this.membershipsTable.tableName,
        SUBMISSIONS_TABLE_NAME: this.submissionsTable.tableName,
        KICK_REQUESTS_TABLE_NAME: this.kickRequestsTable.tableName,
        GROUPS_TABLE_NAME: this.groupsTable.tableName,
        CO_TEACHER_INDEX_TABLE_NAME: this.coTeacherIndexTable.tableName,
        SHARED_ASSIGNMENTS_TABLE_NAME: this.sharedAssignmentsTable.tableName,
        SHARED_REPORTS_TABLE_NAME: this.sharedReportsTable.tableName,
        NOTIFICATIONS_TABLE_NAME: this.notificationsTable.tableName,
        SUBMISSIONS_BUCKET_NAME: this.submissionsBucket.bucketName,
        SHARED_BUCKET_NAME: this.sharedBucket.bucketName,
        SHARE_DAILY_LIMIT: process.env.SHARE_DAILY_LIMIT || '10',
        REPORT_DAILY_LIMIT: process.env.REPORT_DAILY_LIMIT || '20',
        GOOGLE_CLIENT_ID: googleClientId,
        MICROSOFT_CLIENT_ID: microsoftClientId,
        DEV_BYPASS_TOKEN: devBypassToken,
        CORS_ALLOWED_ORIGINS: corsOriginsEnv,
        CLASSROOM_TTL_DAYS: String(classroomTtlDays),
        MAX_STUDENT_COUNT: process.env.MAX_STUDENT_COUNT || '50',
        SESSION_ACTIVE_TTL_SECONDS: process.env.SESSION_ACTIVE_TTL_SECONDS || '3600',
        PRESIGNED_URL_UPLOAD_EXPIRY: process.env.PRESIGNED_URL_UPLOAD_EXPIRY || '900',
        PRESIGNED_URL_DOWNLOAD_EXPIRY: process.env.PRESIGNED_URL_DOWNLOAD_EXPIRY || '3600',
        JOIN_RATE_LIMIT_WINDOW_SECONDS: process.env.JOIN_RATE_LIMIT_WINDOW_SECONDS || '60',
        JOIN_RATE_LIMIT_MAX_ATTEMPTS: process.env.JOIN_RATE_LIMIT_MAX_ATTEMPTS || '50',
        // Page cap for the paginated list reads (#1146). The Lambda env is an
        // explicit allowlist, so this has to be here for the documented knob
        // to actually be settable from .env.<stage>.
        DDB_MAX_PAGES: process.env.DDB_MAX_PAGES || '25',
        // AI evaluation support (empty key disables the endpoint with 503)
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
        EVAL_MAX_SUBMISSIONS: process.env.EVAL_MAX_SUBMISSIONS || '10',
        EVAL_RATE_LIMIT_WINDOW_SECONDS: process.env.EVAL_RATE_LIMIT_WINDOW_SECONDS || '3600',
        EVAL_RATE_LIMIT_MAX_REQUESTS: process.env.EVAL_RATE_LIMIT_MAX_REQUESTS || '60',
        EVAL_DAILY_LIMIT: process.env.EVAL_DAILY_LIMIT || '50',
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: stage !== 'prod',
        externalModules: [],
      },
    });

    this.classroomsTable.grantReadWriteData(handlerFn);
    this.membershipsTable.grantReadWriteData(handlerFn);
    this.submissionsTable.grantReadWriteData(handlerFn);
    this.kickRequestsTable.grantReadWriteData(handlerFn);
    this.groupsTable.grantReadWriteData(handlerFn);
    this.coTeacherIndexTable.grantReadWriteData(handlerFn);
    this.sharedAssignmentsTable.grantReadWriteData(handlerFn);
    this.sharedReportsTable.grantReadWriteData(handlerFn);
    // お知らせは admin スタックが単一の書き手 (#1111)。この Lambda は一覧
    // (Query) と既読化 (UpdateItem) しか行わないので、PutItem を含む RW では
    // なく必要最小限だけ grant して「エディタからお知らせを偽造できない」を
    // IAM でも担保する（レビュー指摘）。
    this.notificationsTable.grant(handlerFn, 'dynamodb:Query', 'dynamodb:UpdateItem');
    this.submissionsBucket.grantPut(handlerFn);
    this.submissionsBucket.grantRead(handlerFn);
    this.sharedBucket.grantPut(handlerFn);
    this.sharedBucket.grantRead(handlerFn);
    this.sharedBucket.grantDelete(handlerFn);

    // --- Delete-snapshot archiver (issue #1053) ---
    // Streams on the four data tables feed every REMOVE (TTL sweep or
    // explicit delete) into a small Lambda that snapshots the old item to
    // `ddb-archive/…` in the submissions bucket. KickRequests (1h ephemera)
    // is deliberately not archived.

    const archiverLogGroup = new logs.LogGroup(this, 'ClassroomArchiverLogGroup', {
      logGroupName: `/aws/lambda/ClassroomArchiver${stageSuffix}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const archiverFn = new lambdaNodejs.NodejsFunction(this, 'ClassroomArchiver', {
      functionName: `ClassroomArchiver${stageSuffix}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/archiver.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      logGroup: archiverLogGroup,
      environment: {
        ARCHIVE_BUCKET_NAME: this.submissionsBucket.bucketName,
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: stage !== 'prod',
        externalModules: [],
      },
    });

    this.submissionsBucket.grantPut(archiverFn);

    const archivedTables = [
      this.classroomsTable,
      this.membershipsTable,
      this.submissionsTable,
      this.groupsTable,
    ];
    for (const table of archivedTables) {
      archiverFn.addEventSource(new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 100,
        // A failing batch is split and retried a bounded number of times so
        // one poisoned record cannot block the shard forever; the snapshot
        // handler itself skips malformed records and only throws on S3
        // write failures (worth retrying).
        bisectBatchOnError: true,
        retryAttempts: 10,
        // Only deletions carry an image worth archiving.
        filters: [
          lambda.FilterCriteria.filter({ eventName: lambda.FilterRule.isEqual('REMOVE') }),
        ],
      }));
    }

    // --- Custom Domain ---

    const parentZoneName = process.env.ROUTE53_PARENT_ZONE_NAME || 'api.smalruby.app';
    const defaultCustomDomain = stage === 'prod'
      ? `classroom.${parentZoneName}`
      : `${stage}.classroom.${parentZoneName}`;
    const customDomain = process.env.CLASSROOM_CUSTOM_DOMAIN === 'false'
      ? undefined
      : (process.env.CLASSROOM_CUSTOM_DOMAIN || defaultCustomDomain);

    let domainName: apigatewayv2.DomainName | undefined;
    let zone: route53.IHostedZone | undefined;

    if (customDomain) {
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
    }

    // --- API Gateway ---

    this.api = new apigatewayv2.HttpApi(this, 'ClassroomApi', {
      apiName: `ClassroomApi${stageSuffix}`,
      corsPreflight: {
        allowOrigins: corsAllowOrigins,
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Google-Access-Token'],
        maxAge: cdk.Duration.hours(24),
      },
      defaultDomainMapping: domainName ? {
        domainName,
      } : undefined,
    });

    const integration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'ClassroomIntegration',
      handlerFn
    );

    // Routes
    this.api.addRoutes({
      path: '/classrooms',
      methods: [apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PATCH, apigatewayv2.HttpMethod.DELETE],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/join',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/lookup',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/verify-session',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // Co-teacher management — owner or existing co-teacher may invite/remove
    // additional teachers by email.
    this.api.addRoutes({
      path: '/classrooms/{classroomId}/co-teachers',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/co-teachers/{email}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/members',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/members/{memberId}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration,
    });

    // Kick requests — students ask the teacher to free a specific seat.
    this.api.addRoutes({
      path: '/classrooms/lookup/kick-request',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/kick-requests',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/kick-requests/{requestId}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/kick-requests/{requestId}/approve',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // Assignment content — teacher edits (PUT), teacher or joined student
    // reads (GET; dual-auth resolved in the Lambda handler).
    this.api.addRoutes({
      path: '/classrooms/{classroomId}/assignment',
      methods: [apigatewayv2.HttpMethod.PUT, apigatewayv2.HttpMethod.GET],
      integration,
    });

    // みんなの課題 (shared assignment library) — own root path.
    this.api.addRoutes({
      path: '/shared-assignments',
      methods: [apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/shared-assignments/{sharedId}',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.PATCH, apigatewayv2.HttpMethod.DELETE],
      integration,
    });

    this.api.addRoutes({
      path: '/shared-assignments/{sharedId}/import',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/shared-assignments/{sharedId}/report',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // 合言葉（限定公開）による preview / 取り込み（#1109）。POST の literal path
    // なので GET/PATCH/DELETE の /{sharedId} ルートとは衝突しない。
    this.api.addRoutes({
      path: '/shared-assignments/lookup',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/shared-assignments/import-by-passcode',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // お知らせ (notification center #1111) — teacher-facing inbox. Own root
    // path; writes happen from the admin stack, so this API only lists and
    // marks-read for the authenticated teacher.
    this.api.addRoutes({
      path: '/notifications',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/notifications/mark-read',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // Groups (組) — teacher-side organizing concept. Own root path so the
    // /classrooms/{classroomId} patterns never shadow it.
    this.api.addRoutes({
      path: '/classroom-groups',
      methods: [apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/classroom-groups/{groupId}',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration,
    });

    // v1->v2 bulk migration (idempotent) — adopt ungrouped assignments into
    // classes and lift class-level fields. Triggered from the class list.
    this.api.addRoutes({
      path: '/classroom-groups/migrate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // Topic list management (add/remove/rename with cascade to assignments).
    this.api.addRoutes({
      path: '/classroom-groups/{groupId}/topics',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration,
    });

    // Duplicate a lesson (classroom) into the same or another group.
    this.api.addRoutes({
      path: '/classrooms/{classroomId}/duplicate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // AI evaluation support — grade proposals / comment drafts from
    // static-analysis results (teacher auth; relays to the Anthropic API).
    this.api.addRoutes({
      path: '/classrooms/{classroomId}/evaluate',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/submissions',
      methods: [apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/submissions/{submissionId}',
      methods: [apigatewayv2.HttpMethod.PATCH],
      integration,
    });

    // Google Classroom integration routes
    this.api.addRoutes({
      path: '/classrooms/google-courses',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/google-import',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    this.api.addRoutes({
      path: '/classrooms/{classroomId}/google-assignment',
      methods: [apigatewayv2.HttpMethod.POST],
      integration,
    });

    // Throttling
    const defaultStage = this.api.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingRateLimit: stage === 'prod' ? 200 : 50,
        throttlingBurstLimit: stage === 'prod' ? 200 : 50,
      };
      // Stricter rate limiting for unauthenticated join/lookup endpoints
      defaultStage.routeSettings = {
        'POST /classrooms/join': {
          ThrottlingRateLimit: stage === 'prod' ? 10 : 5,
          ThrottlingBurstLimit: stage === 'prod' ? 20 : 10,
        },
        'POST /classrooms/lookup': {
          ThrottlingRateLimit: stage === 'prod' ? 10 : 5,
          ThrottlingBurstLimit: stage === 'prod' ? 20 : 10,
        },
      };
    }

    cdk.Tags.of(this.api).add('ResourceType', 'APIGatewayHTTPAPI');

    // Route53 Alias record for Custom Domain
    if (customDomain && zone && domainName) {
      const subdomain = customDomain.replace(`.${parentZoneName}`, '');

      new route53.ARecord(this, 'ApiAliasRecord', {
        zone,
        recordName: subdomain,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayv2DomainProperties(
            domainName.regionalDomainName,
            domainName.regionalHostedZoneId,
          )
        ),
      });
    }

    // Outputs
    if (customDomain) {
      new cdk.CfnOutput(this, 'CustomDomainUrl', {
        value: `https://${customDomain}`,
        description: 'Classroom API custom domain URL',
      });
    }

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.apiEndpoint,
      description: 'Classroom API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'ClassroomsTableName', {
      value: this.classroomsTable.tableName,
      description: 'DynamoDB table name for classrooms',
    });

    new cdk.CfnOutput(this, 'MembershipsTableName', {
      value: this.membershipsTable.tableName,
      description: 'DynamoDB table name for memberships',
    });

    new cdk.CfnOutput(this, 'SubmissionsTableName', {
      value: this.submissionsTable.tableName,
      description: 'DynamoDB table name for submissions',
    });

    new cdk.CfnOutput(this, 'SubmissionsBucketName', {
      value: this.submissionsBucket.bucketName,
      description: 'S3 bucket name for submission files',
    });
  }
}
