/**
 * Pure planning logic for the operator restore CLI (issue #1054).
 *
 * bin/restore-classroom.ts owns all I/O (S3 snapshot reads, DynamoDB
 * liveness checks and writes); everything decidable without I/O lives here
 * so the restore behavior is unit-testable: argument parsing, snapshot
 * matching, and the restore plan (which items get written, with what TTL).
 */

export interface RestoreArgs {
  classroomId: string | null;
  joinCode: string | null;
  className: string | null;
  apply: boolean;
  ttlDays: number;
  groupTtlDays: number;
}

/** A snapshot file's parsed body (written by lambda/archiver.ts). */
export interface Snapshot {
  table: string;
  deletedAt: string | null;
  eventId: string | null;
  item: Record<string, unknown>;
}

export interface RestorePlanInput {
  classroom: Record<string, unknown>;
  memberships: Record<string, unknown>[];
  submissions: Record<string, unknown>[];
  group?: Record<string, unknown> | null;
}

export interface PlannedItem {
  table: 'classrooms' | 'memberships' | 'submissions' | 'groups';
  item: Record<string, unknown>;
}

/**
 * Parse CLI arguments. Throws on unknown flags or missing target so a typo
 * never silently restores the wrong thing.
 * @param argv - process.argv.slice(2)
 * @returns parsed arguments (dry-run by default)
 */
export function parseRestoreArgs(argv: string[]): RestoreArgs {
  const args: RestoreArgs = {
    classroomId: null,
    joinCode: null,
    className: null,
    apply: false,
    ttlDays: 90,
    groupTtlDays: 400,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case '--classroom-id':
        args.classroomId = argv[++i] || null;
        break;
      case '--join-code':
        args.joinCode = (argv[++i] || '').toLowerCase() || null;
        break;
      case '--class-name':
        args.className = argv[++i] || null;
        break;
      case '--apply':
        args.apply = true;
        break;
      case '--ttl-days':
        args.ttlDays = parseInt(argv[++i] || '', 10);
        break;
      case '--group-ttl-days':
        args.groupTtlDays = parseInt(argv[++i] || '', 10);
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }
  if (!args.classroomId && !args.joinCode && !args.className) {
    throw new Error('Specify a target: --classroom-id <id> | --join-code <code> | --class-name <name>');
  }
  if (!Number.isInteger(args.ttlDays) || args.ttlDays <= 0) {
    throw new Error('--ttl-days must be a positive integer');
  }
  if (!Number.isInteger(args.groupTtlDays) || args.groupTtlDays <= 0) {
    throw new Error('--group-ttl-days must be a positive integer');
  }
  return args;
}

/**
 * Does a classroom snapshot match the operator's search?
 * classroomId is exact; joinCode is case-insensitive exact; className is a
 * substring match (teachers rarely remember the exact string).
 * @param snapshot - parsed classroom snapshot
 * @param target - parsed CLI arguments
 * @returns true when the snapshot is the classroom being searched for
 */
export function matchClassroomSnapshot(
  snapshot: Snapshot,
  target: Pick<RestoreArgs, 'classroomId' | 'joinCode' | 'className'>,
): boolean {
  const item = snapshot.item || {};
  if (target.classroomId) {
    return item.classroomId === target.classroomId;
  }
  if (target.joinCode) {
    return typeof item.joinCode === 'string' && item.joinCode.toLowerCase() === target.joinCode;
  }
  if (target.className) {
    return typeof item.className === 'string' && item.className.includes(target.className);
  }
  return false;
}

/**
 * Build the write plan for one classroom restore: every item gets a fresh
 * TTL from "now" (the original ones are in the past — restoring them as-is
 * would just get swept again), and the classroom is stamped restoredAt and
 * forced back to active so it reappears in the teacher UI immediately.
 * @param input - snapshot items grouped by table
 * @param nowMs - current time in ms (injectable for tests)
 * @param ttlDays - new retention for classroom/memberships/submissions
 * @param groupTtlDays - new retention for the group (school-year scale)
 * @returns items to write, in dependency order (group -> classroom -> rest)
 */
export function buildRestorePlan(
  input: RestorePlanInput,
  nowMs: number,
  ttlDays: number,
  groupTtlDays: number,
): PlannedItem[] {
  const nowSeconds = Math.floor(nowMs / 1000);
  const ttl = nowSeconds + ttlDays * 24 * 60 * 60;
  const groupTtl = nowSeconds + groupTtlDays * 24 * 60 * 60;
  const restoredAt = new Date(nowMs).toISOString();

  const plan: PlannedItem[] = [];
  if (input.group) {
    plan.push({ table: 'groups', item: { ...input.group, ttl: groupTtl, status: 'active', restoredAt } });
  }
  plan.push({
    table: 'classrooms',
    item: { ...input.classroom, ttl, status: 'active', restoredAt },
  });
  for (const membership of input.memberships) {
    plan.push({ table: 'memberships', item: { ...membership, ttl } });
  }
  for (const submission of input.submissions) {
    plan.push({ table: 'submissions', item: { ...submission, ttl } });
  }
  return plan;
}

/**
 * Table / bucket names for a stage, matching lib/classroom-stack.ts
 * (prod has no suffix; every other stage appends `-{stage}`).
 * @param stage - deployment stage
 * @returns resource names for the stage
 */
export function resourceNamesForStage(stage: string): {
  classroomsTable: string;
  membershipsTable: string;
  submissionsTable: string;
  groupsTable: string;
  coTeacherIndexTable: string;
  bucket: string;
} {
  const suffix = stage === 'prod' ? '' : `-${stage}`;
  return {
    classroomsTable: `Classrooms${suffix}`,
    membershipsTable: `ClassroomMemberships${suffix}`,
    submissionsTable: `ClassroomSubmissions${suffix}`,
    groupsTable: `ClassroomGroups${suffix}`,
    coTeacherIndexTable: `ClassroomCoTeacherIndex${suffix}`,
    bucket: `smalruby-classroom-submissions${suffix}`,
  };
}
