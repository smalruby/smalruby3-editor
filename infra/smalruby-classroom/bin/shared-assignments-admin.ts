#!/usr/bin/env npx ts-node
/**
 * Operator CLI: みんなの課題 moderation (issue #1071, EPIC #1066 D3).
 *
 * Post-moderation model: teachers report items; operators review the queue
 * and unpublish (never hard-delete — a mistaken action stays recoverable).
 * Mutations are dry-run by default; re-run with --apply to execute.
 *
 * Usage (from infra/smalruby-classroom, with AWS credentials for the stage):
 *   npx ts-node bin/shared-assignments-admin.ts list-reports
 *   npx ts-node bin/shared-assignments-admin.ts show <sharedId>
 *   npx ts-node bin/shared-assignments-admin.ts unpublish <sharedId> [--apply]
 *   npx ts-node bin/shared-assignments-admin.ts republish <sharedId> [--apply]
 *
 * The stage comes from the .env symlink (STAGE), same as cdk deploy.
 * Full runbook: docs/assignment-sharing/operations.md
 */
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  groupReports,
  parseAdminArgs,
  renderReportQueue,
  renderSharedItem,
  type ReportRecord,
} from '../lambda/shared-admin-lib';

const stage = process.env.STAGE || 'stg';
const suffix = stage === 'prod' ? '' : `-${stage}`;
const SHARED_TABLE = `SharedAssignments${suffix}`;
const REPORTS_TABLE = `SharedAssignmentReports${suffix}`;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function getItem(sharedId: string): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(new GetCommand({
    TableName: SHARED_TABLE,
    Key: { sharedId },
  }));
  return (result.Item as Record<string, unknown>) || null;
}

async function listReports(): Promise<void> {
  // Reports are 90-day-TTL'd and low-volume; a scan is fine.
  const items: ReportRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const page = await docClient.send(new ScanCommand({
      TableName: REPORTS_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    for (const item of page.Items || []) {
      items.push({
        sharedId: String(item.sharedId),
        reason: String(item.reason || ''),
        createdAt: String(item.createdAt || ''),
      });
    }
    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  const grouped = groupReports(items);
  const itemsById = new Map<string, Record<string, unknown>>();
  for (const sharedId of grouped.keys()) {
    const item = await getItem(sharedId);
    if (item) itemsById.set(sharedId, item);
  }
  for (const line of renderReportQueue(grouped, itemsById)) {
    console.log(line);
  }
}

async function setStatus(sharedId: string, status: 'published' | 'unlisted', apply: boolean): Promise<number> {
  const item = await getItem(sharedId);
  if (!item) {
    console.log(`スナップショットが見つかりません: ${sharedId}`);
    return 1;
  }
  console.log(`対象: ${item.title} (現在 status=${item.status}) → ${status}`);
  if (!apply) {
    console.log('dry-run のため変更していません。実行するには --apply を付けてください。');
    return 0;
  }
  await docClient.send(new UpdateCommand({
    TableName: SHARED_TABLE,
    Key: { sharedId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': status, ':now': new Date().toISOString() },
  }));
  console.log('変更しました。');
  return 0;
}

async function main(): Promise<number> {
  const args = parseAdminArgs(process.argv.slice(2));
  console.log(`stage=${stage} table=${SHARED_TABLE} mode=${args.apply ? 'APPLY' : 'dry-run'}`);

  switch (args.command) {
    case 'list-reports':
      await listReports();
      return 0;
    case 'show': {
      const item = await getItem(args.sharedId as string);
      if (!item) {
        console.log(`スナップショットが見つかりません: ${args.sharedId}`);
        return 1;
      }
      for (const line of renderSharedItem(item)) {
        console.log(line);
      }
      return 0;
    }
    case 'unpublish':
      return setStatus(args.sharedId as string, 'unlisted', args.apply);
    case 'republish':
      return setStatus(args.sharedId as string, 'published', args.apply);
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
