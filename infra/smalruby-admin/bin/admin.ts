#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { SmalrubyAdminStack } from '../lib/admin-stack';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file (.env provides defaults; environment variables take priority)
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = new cdk.App();

// Stage (priority: --context stage=..., .env STAGE, default: stg)
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'stg';
const stackName = stage === 'prod' ? 'AdminStack' : `AdminStack-${stage}`;

new SmalrubyAdminStack(app, stackName, {
  stackName: stackName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1',
  },
});
