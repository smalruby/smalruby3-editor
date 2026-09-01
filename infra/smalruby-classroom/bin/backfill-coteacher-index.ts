#!/usr/bin/env npx ts-node
/**
 * Operator CLI: 既存データから共同管理者の逆引き索引
 * (`ClassroomCoTeacherIndex{suffix}`) を作り直す一回限りのバックフィル
 * (issue #1146)。
 *
 * `GET /classrooms` が索引を読むようになったので、**索引に行が無い共同管理者
 * には資源が見えない**。索引は #1146 で追加したため、それ以前に登録された
 * 共同管理者の行は存在しない。したがってデプロイ順は:
 *
 *   1. テーブル + GSI を作る（このスクリプトの前提。cdk deploy）
 *   2. **このスクリプトを --apply で実行**
 *   3. 読み取りを索引に切り替えた Lambda を反映（cdk deploy）
 *
 * 1 と 3 が同じ cdk deploy に乗る場合は、deploy 直後に速やかに 2 を実行する
 * （その間は共同管理の資源が一覧に出ない。認可は item 上の coTeacherEmails を
 * 見ているので、権限そのものは落ちない）。
 *
 * 冪等: 索引行のキーは (email, resourceKey) なので、何度実行しても同じ行を
 * 上書きするだけ。夜間などに再実行して差分を埋めても安全。
 *
 * Usage (from infra/smalruby-classroom, with AWS credentials for the stage):
 *   npx ts-node bin/backfill-coteacher-index.ts             # dry-run（既定）
 *   npx ts-node bin/backfill-coteacher-index.ts --apply     # 実際に書く
 *
 * The stage comes from the .env symlink (STAGE), same as cdk deploy.
 * Full runbook: docs/classroom/operations.md
 */
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { resourceNamesForStage } from '../lambda/restore-lib';
import {
  chunkIndexWrites,
  indexRowsForResource,
  parseBackfillArgs,
  type CoTeacherIndexRow,
} from '../lambda/coteacher-index-lib';

const stage = process.env.STAGE || 'stg';
const names = resourceNamesForStage(stage);
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * テーブル全件を読む。バックフィルは「全部読む」以外に手が無いので、ここは
 * 意図的に Scan（一回限りの運用作業であり、リクエスト経路ではない）。
 * @param tableName - 読むテーブル
 */
async function scanEverything(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: startKey,
    }));
    items.push(...((res.Items || []) as Record<string, unknown>[]));
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

async function writeRows(rows: CoTeacherIndexRow[]): Promise<number> {
  let written = 0;
  for (const chunk of chunkIndexWrites(rows)) {
    let pending = chunk.map(Item => ({ PutRequest: { Item } }));
    for (let attempt = 0; pending.length > 0 && attempt < 10; attempt++) {
      const res = await docClient.send(new BatchWriteCommand({
        RequestItems: { [names.coTeacherIndexTable]: pending },
      }));
      written += pending.length;
      // DynamoDB はスロットリングをエラーではなく「未処理分の返却」で表すので、
      // ここを捨てると静かに一部だけ書かれた索引になる。
      const unprocessed = (res.UnprocessedItems?.[names.coTeacherIndexTable] || []) as typeof pending;
      written -= unprocessed.length;
      pending = unprocessed;
    }
    if (pending.length > 0) {
      throw new Error(`failed to write ${pending.length} index rows after retries`);
    }
  }
  return written;
}

async function main(): Promise<void> {
  const { apply } = parseBackfillArgs(process.argv.slice(2));
  console.log(`stage=${stage} index=${names.coTeacherIndexTable} mode=${apply ? 'APPLY' : 'dry-run'}`);

  const [classrooms, groups] = await Promise.all([
    scanEverything(names.classroomsTable),
    scanEverything(names.groupsTable),
  ]);

  const rows = [
    ...classrooms.flatMap(item => indexRowsForResource('assignment', item)),
    ...groups.flatMap(item => indexRowsForResource('group', item)),
  ];
  const emails = new Set(rows.map(r => r.coTeacherEmail));
  console.log(
    `scanned: ${classrooms.length} assignments / ${groups.length} groups`
    + ` → ${rows.length} index rows for ${emails.size} co-teacher emails`,
  );

  if (!apply) {
    for (const row of rows.slice(0, 20)) {
      console.log(`  would put ${row.coTeacherEmail} ${row.resourceKey}`);
    }
    if (rows.length > 20) {
      console.log(`  ... and ${rows.length - 20} more`);
    }
    console.log('dry-run: nothing written. re-run with --apply');
    return;
  }

  const written = await writeRows(rows);
  console.log(`wrote ${written} index rows`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
