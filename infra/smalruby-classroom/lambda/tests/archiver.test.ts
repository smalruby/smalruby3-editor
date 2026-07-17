/**
 * Delete-snapshot archiver tests (issue #1053).
 *
 * The decision matrix (which stream records become S3 snapshots, and where)
 * is pure — snapshotPlanForRecord / tableSpecFromArn — so it is pinned
 * exhaustively here. The handler is exercised with the S3 client mocked to
 * prove the retry contract: malformed records are skipped, S3 failures throw.
 */

const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: mockS3Send })),
  };
});

import { handler, snapshotPlanForRecord, tableSpecFromArn } from '../archiver';

const arn = (tableName: string) =>
  `arn:aws:dynamodb:ap-northeast-1:123456789012:table/${tableName}/stream/2026-07-17T00:00:00.000`;

const removeRecord = (tableName: string, oldImage: Record<string, unknown>) => ({
  eventID: 'evt-1',
  eventName: 'REMOVE' as const,
  eventSourceARN: arn(tableName),
  dynamodb: {
    ApproximateCreationDateTime: 1789000000,
    OldImage: oldImage,
  },
});

const classroomImage = {
  classroomId: { S: 'c1' },
  className: { S: '2年1組' },
  studentCount: { N: '30' },
  ttl: { N: '1790000000' },
};

describe('tableSpecFromArn', () => {
  test('resolves stage-suffixed and prod table names', () => {
    expect(tableSpecFromArn(arn('Classrooms-stg'))?.kind).toBe('classrooms');
    expect(tableSpecFromArn(arn('Classrooms'))?.kind).toBe('classrooms');
    expect(tableSpecFromArn(arn('ClassroomMemberships-stg'))?.kind).toBe('memberships');
    expect(tableSpecFromArn(arn('ClassroomSubmissions'))?.kind).toBe('submissions');
    expect(tableSpecFromArn(arn('ClassroomGroups-stg'))?.kind).toBe('groups');
  });

  test('ignores unknown tables and malformed ARNs', () => {
    expect(tableSpecFromArn(arn('ClassroomKickRequests-stg'))).toBeNull();
    expect(tableSpecFromArn('not-an-arn')).toBeNull();
    expect(tableSpecFromArn(undefined)).toBeNull();
  });
});

describe('snapshotPlanForRecord', () => {
  test('archives a removed classroom with metadata', () => {
    const plan = snapshotPlanForRecord(removeRecord('Classrooms-stg', classroomImage) as never);
    expect(plan?.key).toBe('ddb-archive/classrooms/c1.json');
    const body = JSON.parse(plan!.body);
    expect(body.table).toBe('classrooms');
    expect(body.deletedAt).toBe(new Date(1789000000 * 1000).toISOString());
    expect(body.eventId).toBe('evt-1');
    expect(body.item).toEqual({
      classroomId: 'c1',
      className: '2年1組',
      studentCount: 30,
      ttl: 1790000000,
    });
  });

  test('uses pk/sk two-level keys for memberships and submissions', () => {
    const membership = snapshotPlanForRecord(removeRecord('ClassroomMemberships-stg', {
      classroomId: { S: 'c1' },
      memberId: { S: 'seat-05' },
      displayName: { S: 'たろう' },
    }) as never);
    expect(membership?.key).toBe('ddb-archive/memberships/c1/seat-05.json');

    const submission = snapshotPlanForRecord(removeRecord('ClassroomSubmissions', {
      classroomId: { S: 'c1' },
      submissionId: { S: 'sub-1' },
      s3Key: { S: 'c1/sub-1/project.sb3' },
    }) as never);
    expect(submission?.key).toBe('ddb-archive/submissions/c1/sub-1.json');
  });

  test('skips eval-quota counter rows in the Classrooms table', () => {
    const plan = snapshotPlanForRecord(removeRecord('Classrooms-stg', {
      classroomId: { S: 'eval-quota#teacher#2026-07-17' },
      count: { N: '3' },
    }) as never);
    expect(plan).toBeNull();
  });

  test('skips non-REMOVE events, unknown tables, and missing images', () => {
    const insert = { ...removeRecord('Classrooms-stg', classroomImage), eventName: 'INSERT' as const };
    expect(snapshotPlanForRecord(insert as never)).toBeNull();

    expect(snapshotPlanForRecord(removeRecord('ClassroomKickRequests-stg', {
      classroomId: { S: 'c1' },
      requestId: { S: 'r1' },
    }) as never)).toBeNull();

    const noImage = { eventName: 'REMOVE' as const, eventSourceARN: arn('Classrooms-stg'), dynamodb: {} };
    expect(snapshotPlanForRecord(noImage as never)).toBeNull();
  });

  test('sanitizes path separators in key values', () => {
    const plan = snapshotPlanForRecord(removeRecord('Classrooms-stg', {
      classroomId: { S: 'a/b' },
    }) as never);
    expect(plan?.key).toBe('ddb-archive/classrooms/a_b.json');
  });
});

describe('handler', () => {
  beforeEach(() => {
    mockS3Send.mockReset();
  });

  test('writes one snapshot per archivable record and skips the rest', async () => {
    mockS3Send.mockResolvedValue({});
    await handler({
      Records: [
        removeRecord('Classrooms-stg', classroomImage),
        { ...removeRecord('Classrooms-stg', classroomImage), eventName: 'INSERT' },
        removeRecord('ClassroomKickRequests-stg', { classroomId: { S: 'c1' }, requestId: { S: 'r1' } }),
      ],
    } as never);

    expect(mockS3Send).toHaveBeenCalledTimes(1);
    const putInput = mockS3Send.mock.calls[0][0].input;
    expect(putInput.Key).toBe('ddb-archive/classrooms/c1.json');
    expect(putInput.ContentType).toBe('application/json');
  });

  test('throws when an S3 write fails so the stream retries', async () => {
    mockS3Send.mockRejectedValue(new Error('boom'));
    await expect(handler({
      Records: [removeRecord('Classrooms-stg', classroomImage)],
    } as never)).rejects.toThrow('1 snapshot write(s) failed');
  });
});
