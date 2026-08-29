/**
 * Pure planning logic for the expired-classroom restore (EPIC #1073 S4 —
 * the UI successor to classroom's bin/restore-classroom.ts, EPIC #1049 D6).
 *
 * Adapted from infra/smalruby-classroom/lambda/restore-lib.ts (infra
 * projects are independent, so the ~40 lines of pure planning are
 * deliberately duplicated rather than cross-imported; keep the two in sync
 * when the snapshot format changes).
 */

/** A ddb-archive snapshot body (written by classroom's archiver Lambda). */
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
 * Build the write plan for one classroom restore: fresh TTLs from "now"
 * (the archived ones are in the past), status forced back to active and a
 * restoredAt stamp, group first so the classroom never references a
 * missing group.
 * @param input - snapshot items grouped by table
 * @param nowMs - current time in ms (injectable for tests)
 * @param ttlDays - new retention for classroom/memberships/submissions
 * @param groupTtlDays - new retention for the group (school-year scale)
 * @returns items to write, in dependency order
 */
export function buildRestorePlan(
  input: RestorePlanInput,
  nowMs: number,
  ttlDays = 90,
  groupTtlDays = 400,
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
 * Does a classroom snapshot match the operator's search text? Matches the
 * join code exactly (case-insensitive) or the class/assignment name by
 * substring.
 * @param snapshot - parsed classroom snapshot
 * @param q - operator search text
 * @returns true when it matches
 */
export function matchSnapshot(snapshot: Snapshot, q: string): boolean {
  const item = snapshot.item || {};
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  if (typeof item.joinCode === 'string' && item.joinCode.toLowerCase() === needle) return true;
  if (typeof item.className === 'string' && item.className.toLowerCase().includes(needle)) return true;
  if (typeof item.assignmentName === 'string' && item.assignmentName.toLowerCase().includes(needle)) return true;
  return false;
}
