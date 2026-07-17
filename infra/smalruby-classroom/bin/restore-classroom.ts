#!/usr/bin/env npx ts-node
/**
 * Operator CLI: restore an expired (TTL-swept) classroom from the
 * ddb-archive snapshots (issue #1054, EPIC #1049 D6).
 *
 * Dry-run by default — prints the restore plan and the S3 file check
 * without writing anything. Re-run with --apply to execute.
 *
 * Usage (from infra/smalruby-classroom, with AWS credentials for the stage):
 *   npx ts-node bin/restore-classroom.ts --join-code abc234           # search + dry-run
 *   npx ts-node bin/restore-classroom.ts --classroom-id <uuid>        # dry-run
 *   npx ts-node bin/restore-classroom.ts --classroom-id <uuid> --apply
 *
 * Flags:
 *   --classroom-id <id> | --join-code <code> | --class-name <substring>
 *   --apply              actually write (default: dry-run)
 *   --ttl-days <n>       new retention for the restored data (default 90)
 *   --group-ttl-days <n> new retention for the restored group (default 400)
 *
 * The stage comes from the .env symlink (STAGE), same as cdk deploy.
 * Full runbook: docs/classroom/operations.md
 */
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  buildRestorePlan,
  matchClassroomSnapshot,
  parseRestoreArgs,
  resourceNamesForStage,
  type PlannedItem,
  type Snapshot,
} from '../lambda/restore-lib';

const stage = process.env.STAGE || 'stg';
const names = resourceNamesForStage(stage);
const s3 = new S3Client({});
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const ARCHIVE_PREFIX = 'ddb-archive';

async function readSnapshot(key: string): Promise<Snapshot | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: names.bucket, Key: key }));
    const body = await res.Body?.transformToString();
    return body ? (JSON.parse(body) as Snapshot) : null;
  } catch (err) {
    // Missing snapshot is an expected outcome; anything else (credentials,
    // region, permissions) must be surfaced, not mistaken for "not found".
    const name = err instanceof Error ? err.name : '';
    if (name === 'NoSuchKey' || name === 'NotFound') return null;
    throw err;
  }
}

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: names.bucket,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const obj of res.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function findClassroomSnapshot(args: ReturnType<typeof parseRestoreArgs>): Promise<Snapshot | null> {
  if (args.classroomId) {
    return readSnapshot(`${ARCHIVE_PREFIX}/classrooms/${args.classroomId}.json`);
  }
  // Search: classroom snapshots are small JSON files; the fleet is tiny
  // (single org), so a linear scan is fine.
  const keys = await listKeys(`${ARCHIVE_PREFIX}/classrooms/`);
  const matches: Snapshot[] = [];
  for (const key of keys) {
    const snapshot = await readSnapshot(key);
    if (snapshot && matchClassroomSnapshot(snapshot, args)) {
      matches.push(snapshot);
    }
  }
  if (matches.length > 1) {
    console.log(`複数のスナップショットが一致しました (${matches.length} 件)。--classroom-id で特定してください:`);
    for (const m of matches) {
      console.log(`  - ${m.item.classroomId}  ${m.item.className}  ${m.item.assignmentName || ''}  deletedAt=${m.deletedAt}`);
    }
    return null;
  }
  return matches[0] || null;
}

async function liveClassroomExists(classroomId: string): Promise<Record<string, unknown> | null> {
  const res = await docClient.send(new GetCommand({
    TableName: names.classroomsTable,
    Key: { classroomId },
  }));
  return (res.Item as Record<string, unknown>) || null;
}

async function collectChildren(kind: string, classroomId: string): Promise<Record<string, unknown>[]> {
  const keys = await listKeys(`${ARCHIVE_PREFIX}/${kind}/${classroomId}/`);
  const items: Record<string, unknown>[] = [];
  for (const key of keys) {
    const snapshot = await readSnapshot(key);
    if (snapshot?.item) items.push(snapshot.item);
  }
  return items;
}

const TABLE_FOR: Record<PlannedItem['table'], string> = {
  classrooms: names.classroomsTable,
  memberships: names.membershipsTable,
  submissions: names.submissionsTable,
  groups: names.groupsTable,
};

async function main(): Promise<number> {
  const args = parseRestoreArgs(process.argv.slice(2));
  console.log(`stage=${stage} bucket=${names.bucket} mode=${args.apply ? 'APPLY' : 'dry-run'}`);

  const classroomSnapshot = await findClassroomSnapshot(args);
  if (!classroomSnapshot) {
    console.log('該当するクラス（課題）のスナップショットが見つかりませんでした。');
    console.log('- 誤アーカイブの場合はデータがまだ生きています: 先生の UI（アーカイブ済みの課題）から復元できます。');
    console.log(`- スナップショットの保持期間（ARCHIVE_RETENTION_DAYS）を過ぎている場合、復元はできません。`);
    return 1;
  }

  const classroom = classroomSnapshot.item;
  const classroomId = String(classroom.classroomId);
  console.log(`スナップショット: ${classroom.className} / ${classroom.assignmentName || '(課題名なし)'} (${classroomId}) deletedAt=${classroomSnapshot.deletedAt}`);

  const live = await liveClassroomExists(classroomId);
  if (live) {
    console.log(`このクラス（課題）はまだ DynamoDB に存在します (status=${live.status})。`);
    console.log('復元スクリプトは不要です — アーカイブ状態なら先生の UI から「元に戻す」で復元してください。');
    return 1;
  }

  const memberships = await collectChildren('memberships', classroomId);
  const submissions = await collectChildren('submissions', classroomId);

  // Restore the owning group too when it was swept.
  let group: Record<string, unknown> | null = null;
  if (typeof classroom.groupId === 'string' && classroom.groupId) {
    const liveGroup = await docClient.send(new GetCommand({
      TableName: names.groupsTable,
      Key: { groupId: classroom.groupId },
    }));
    if (!liveGroup.Item) {
      const groupSnapshot = await readSnapshot(`${ARCHIVE_PREFIX}/groups/${classroom.groupId}.json`);
      group = groupSnapshot?.item || null;
      if (!group) {
        console.log(`注意: 所属クラス（group ${classroom.groupId}）は生きておらずスナップショットも無いため、課題は「クラス未所属」として復元されます。`);
      }
    }
  }

  const plan = buildRestorePlan({ classroom, memberships, submissions, group }, Date.now(), args.ttlDays, args.groupTtlDays);

  // Verify the submission binaries still exist in S3.
  let missingFiles = 0;
  for (const submission of submissions) {
    const s3Key = submission.s3Key;
    if (typeof s3Key !== 'string') continue;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: names.bucket, Key: s3Key }));
    } catch {
      missingFiles++;
      console.log(`  ⚠ 提出ファイル欠落: ${s3Key}`);
    }
  }

  console.log('復元プラン:');
  console.log(`  - クラス（課題）: 1 件（status=active, TTL +${args.ttlDays}日）`);
  console.log(`  - 所属クラス（group）: ${group ? `1 件（TTL +${args.groupTtlDays}日）` : '対象なし'}`);
  console.log(`  - メンバー: ${memberships.length} 件`);
  console.log(`  - 提出メタ: ${submissions.length} 件（S3 実体欠落 ${missingFiles} 件）`);

  if (!args.apply) {
    console.log('dry-run のため書き込みは行いませんでした。実行するには --apply を付けてください。');
    return 0;
  }

  for (const planned of plan) {
    const put: ConstructorParameters<typeof PutCommand>[0] = {
      TableName: TABLE_FOR[planned.table],
      Item: planned.item,
    };
    if (planned.table === 'classrooms') {
      // Never clobber a live classroom (raced restore / stale plan).
      put.ConditionExpression = 'attribute_not_exists(classroomId)';
    }
    await docClient.send(new PutCommand(put));
  }
  console.log(`復元完了: ${plan.length} アイテムを書き込みました。`);
  console.log('先生に「クラス一覧を再読み込みして確認してください」と連絡してください（参加コード・席番号・セッションは元のまま有効です）。');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
