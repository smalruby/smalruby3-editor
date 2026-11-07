#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { SmalrubyWebHostingStack } from '../lib/web-hosting-stack';

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'stg';
const stackName =
    stage === 'prod' ? 'SmalrubyWebHostingStack' : `SmalrubyWebHostingStack-${stage}`;

new SmalrubyWebHostingStack(app, stackName, {
    stackName,
    stage,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
        region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1',
    },
});
