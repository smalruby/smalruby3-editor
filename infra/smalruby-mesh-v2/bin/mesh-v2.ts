#!/opt/homebrew/opt/node/bin/node
import * as cdk from 'aws-cdk-lib/core';
import { MeshV2Stack } from '../lib/mesh-v2-stack';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

const app = new cdk.App();

// Stage取得（優先順位: --context stage=..., .envのSTAGE, デフォルト: stg）
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'stg';
const stackName = stage === 'prod' ? 'MeshV2Stack' : `MeshV2Stack-${stage}`;

new MeshV2Stack(app, stackName, {
  stackName: stackName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-1',
  },
});
