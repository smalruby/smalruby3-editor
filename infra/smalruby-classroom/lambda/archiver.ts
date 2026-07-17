/**
 * DynamoDB delete-snapshot archiver (issue #1053 / EPIC #1049 D7).
 *
 * The classroom tables are TTL-swept (90 days) with PITR disabled, so an
 * expired classroom used to leave no trace — and no way to honor a
 * "please restore it anyway" support request. This Lambda listens to the
 * tables' streams and, for every REMOVE (TTL sweep or explicit delete),
 * writes the deleted item as JSON into the submissions bucket under
 * `ddb-archive/…`. The bucket's lifecycle keeps everything for
 * ARCHIVE_RETENTION_DAYS (default 365), giving operators a one-year window
 * to rehydrate a classroom with bin/restore-classroom (issue #1054).
 *
 * Layout (values are UUIDs / seat-NN, sanitized defensively):
 *   ddb-archive/classrooms/<classroomId>.json
 *   ddb-archive/memberships/<classroomId>/<memberId>.json
 *   ddb-archive/submissions/<classroomId>/<submissionId>.json
 *   ddb-archive/groups/<groupId>.json
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import type { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';

const s3Client = new S3Client({});
const ARCHIVE_BUCKET = process.env.ARCHIVE_BUCKET_NAME || '';
const ARCHIVE_PREFIX = 'ddb-archive';

interface TableSpec {
  kind: string;
  pk: string;
  sk?: string;
}

/** Table base name (without the stage suffix) → snapshot layout. */
export const TABLE_SPECS: Record<string, TableSpec> = {
  Classrooms: { kind: 'classrooms', pk: 'classroomId' },
  ClassroomMemberships: { kind: 'memberships', pk: 'classroomId', sk: 'memberId' },
  ClassroomSubmissions: { kind: 'submissions', pk: 'classroomId', sk: 'submissionId' },
  ClassroomGroups: { kind: 'groups', pk: 'groupId' },
};

/**
 * Resolve the table spec from a stream record's eventSourceARN.
 * Handles both prod names (`Classrooms`) and suffixed stage names
 * (`Classrooms-stg`). Unknown tables (e.g. KickRequests — 1h ephemera)
 * return null and are ignored.
 */
export function tableSpecFromArn(eventSourceARN?: string): TableSpec | null {
  const match = /:table\/([^/]+)\//.exec(eventSourceARN || '');
  if (!match) return null;
  const tableName = match[1];
  for (const [base, spec] of Object.entries(TABLE_SPECS)) {
    if (tableName === base || tableName.startsWith(`${base}-`)) {
      return spec;
    }
  }
  return null;
}

/** Keep snapshot keys one-segment-per-value even for hostile inputs. */
const pathSegment = (value: string): string => value.replace(/\//g, '_');

/**
 * Decide whether and where to snapshot one stream record.
 * Pure (no I/O) so the decision matrix is unit-testable.
 * @returns the S3 put plan, or null when the record is not archived
 */
export function snapshotPlanForRecord(record: DynamoDBRecord): { key: string; body: string } | null {
  if (record.eventName !== 'REMOVE') return null;
  const spec = tableSpecFromArn(record.eventSourceARN);
  if (!spec) return null;
  const oldImage = record.dynamodb?.OldImage;
  if (!oldImage) return null;

  const item = unmarshall(oldImage as Record<string, AttributeValue>);
  const pkValue = item[spec.pk];
  if (typeof pkValue !== 'string' || pkValue.length === 0) return null;
  // The Classrooms table reuses its key-space for eval-quota counters
  // (classroomId = "eval-quota#<sub>#<day>") — operational data, skip.
  if (pkValue.startsWith('eval-quota#')) return null;

  let key: string;
  if (spec.sk) {
    const skValue = item[spec.sk];
    if (typeof skValue !== 'string' || skValue.length === 0) return null;
    key = `${ARCHIVE_PREFIX}/${spec.kind}/${pathSegment(pkValue)}/${pathSegment(skValue)}.json`;
  } else {
    key = `${ARCHIVE_PREFIX}/${spec.kind}/${pathSegment(pkValue)}.json`;
  }

  const approximate = record.dynamodb?.ApproximateCreationDateTime;
  const body = JSON.stringify({
    table: spec.kind,
    deletedAt: typeof approximate === 'number' ? new Date(approximate * 1000).toISOString() : null,
    eventId: record.eventID || null,
    item,
  });
  return { key, body };
}

/**
 * Stream handler. Malformed records are logged and skipped (never block the
 * shard on bad data); S3 failures throw so the event source retries with
 * bisectBatchOnError — losing a snapshot would defeat the safety net.
 */
export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  let failures = 0;
  for (const record of event.Records || []) {
    let plan: { key: string; body: string } | null;
    try {
      plan = snapshotPlanForRecord(record);
    } catch (err) {
      console.error('archiver: skipping malformed record', record.eventID, err);
      continue;
    }
    if (!plan) continue;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: ARCHIVE_BUCKET,
        Key: plan.key,
        Body: plan.body,
        ContentType: 'application/json',
      }));
    } catch (err) {
      console.error('archiver: snapshot write failed', plan.key, err);
      failures++;
    }
  }
  if (failures > 0) {
    throw new Error(`archiver: ${failures} snapshot write(s) failed`);
  }
};
