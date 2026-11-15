#!/usr/bin/env npx ts-node
/**
 * Operator CLI: 課題ごとの「返却していない提出の数」(`unreturnedCount`) を、
 * 既存の課題に埋める（issue #1972）。
 *
 * `unreturnedCount` は提出・返却・退室・参加のときに Lambda が増減するが、増減するのは
 * **数を持っている課題だけ**（持っていない課題に足すと、すでにある提出のぶんずれるため）。
 * この項目を足す前に作った課題は数を持たないので、一覧に項目が出ない（GUI は「確認が
 * 必要な課題」の帯を出さない）。このスクリプトで数え、課題の item に書く。
 *
 * 数え方は handler と同じ（lambda/unreturned-count-lib.ts）: 席ごとにいちばん新しい
 * 提出のうち返却していないもので、退室した席（メンバーの行が無い・kicked）は数えない。
 *
 * - 既定: 数を持っていない active / archived の課題だけを埋める
 *   （`attribute_not_exists` の条件付きで書くので、その間に Lambda が数を作った課題は上書きしない）。
 * - `--recount`: 数を持っている課題も数え直して上書きする（ずれを直したいとき）。
 *   数えている間に提出・返却があると、その分だけずれうるので、授業の無い時間に流す。
 *
 * 読み込み: Classrooms を 1 回 Scan（運用作業なので Scan でよい）+ 対象の課題ごとに
 * Memberships と Submissions を Query 1 回ずつ。
 *
 * Usage (from infra/smalruby-classroom, with AWS credentials for the stage):
 *   npx ts-node bin/backfill-unreturned-count.ts                 # dry-run（既定）
 *   npx ts-node bin/backfill-unreturned-count.ts --apply         # 書く
 *   npx ts-node bin/backfill-unreturned-count.ts --apply --recount
 *
 * The stage comes from the .env symlink (STAGE), same as cdk deploy.
 * Runbook: docs/classroom/operations.md
 */
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { resourceNamesForStage } from '../lambda/restore-lib';
import {
  countUnreturnedSubmissions,
  isSeatOccupied,
  needsUnreturnedBackfill,
  parseUnreturnedBackfillArgs,
} from '../lambda/unreturned-count-lib';

const stage = process.env.STAGE || 'stg';
const names = resourceNamesForStage(stage);
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function scanEverything(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: startKey }));
    items.push(...((res.Items || []) as Record<string, unknown>[]));
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

async function queryByClassroom(tableName: string, classroomId: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'classroomId = :cid',
      ExpressionAttributeValues: { ':cid': classroomId },
      ExclusiveStartKey: startKey,
    }));
    items.push(...((res.Items || []) as Record<string, unknown>[]));
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

async function main(): Promise<void> {
  const { apply, recount } = parseUnreturnedBackfillArgs(process.argv.slice(2));
  console.log(`stage=${stage} table=${names.classroomsTable} mode=${apply ? 'APPLY' : 'dry-run'}${recount ? ' recount' : ''}`);

  const classrooms = (await scanEverything(names.classroomsTable)).filter(item => needsUnreturnedBackfill(item, recount));
  console.log(`targets: ${classrooms.length} assignments`);

  let written = 0;
  let skipped = 0;
  for (const item of classrooms) {
    const classroomId = String(item.classroomId);
    const [memberships, submissions] = await Promise.all([
      queryByClassroom(names.membershipsTable, classroomId),
      queryByClassroom(names.submissionsTable, classroomId),
    ]);
    const occupied = new Set(memberships.filter(m => isSeatOccupied(m)).map(m => String(m.memberId)));
    const count = countUnreturnedSubmissions(submissions, occupied);
    console.log(`  ${classroomId} (${item.status}) → ${count}`);
    if (!apply) continue;
    try {
      await docClient.send(new UpdateCommand({
        TableName: names.classroomsTable,
        Key: { classroomId },
        UpdateExpression: 'SET #u = :n',
        ConditionExpression: recount ? 'attribute_exists(classroomId)' : 'attribute_exists(classroomId) AND attribute_not_exists(#u)',
        ExpressionAttributeNames: { '#u': 'unreturnedCount' },
        ExpressionAttributeValues: { ':n': count },
      }));
      written++;
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
        skipped++;
        continue;
      }
      throw err;
    }
  }
  if (!apply) {
    console.log('dry-run: nothing written. re-run with --apply');
    return;
  }
  console.log(`wrote ${written} assignments (skipped ${skipped}: deleted or already counted meanwhile)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
