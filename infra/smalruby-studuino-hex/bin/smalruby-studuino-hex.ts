#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { StuduinoHexStack } from '../lib/studuino-hex-stack';

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'stg';
const stackName = stage === 'prod' ? 'StuduinoHexStack' : `StuduinoHexStack-${stage}`;

new StuduinoHexStack(app, stackName, {
    stackName,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
        region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1',
    },
});
