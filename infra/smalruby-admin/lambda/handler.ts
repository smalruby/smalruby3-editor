/**
 * Smalruby Admin API (EPIC #1073, S1 #1081).
 *
 * The highest-privilege surface in the fleet, so the model is deliberately
 * strict and small:
 *
 * - Google Sign-In only, verified against the ADMIN-DEDICATED client ID
 *   (decision B) — editor/classroom tokens carry a different `aud` and are
 *   rejected before any authorization lookup.
 * - Deny-by-default allowlist (decision C/F4): the SmalrubyAdmins table is
 *   populated by a human in the AWS console (verified email). On the first
 *   successful login the Google `sub` is pinned onto the row; afterwards a
 *   token whose sub differs from the pinned one is rejected even if the
 *   email matches (email-reuse defense). There is no in-app admin
 *   management.
 * - Every mutation is audit-logged (bug-report audit() pattern); prod log
 *   retention is one year (set in the stack).
 *
 * S1 exposes only GET /admin/me (authorization probe for the SPA). The
 * management domains (みんなの課題 / classroom / restore) land in S3/S4.
 */
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { OAuth2Client } from 'google-auth-library';
import {
  buildRestorePlan, matchSnapshot, PlannedItem, RestorePlanInput, Snapshot,
} from './restore-plan';

// --- Configuration ---

const ADMINS_TABLE = process.env.ADMINS_TABLE_NAME || 'SmalrubyAdmins';
const ADMIN_GOOGLE_CLIENT_ID = process.env.ADMIN_GOOGLE_CLIENT_ID || '';
const DEV_BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || '';
const STAGE = process.env.STAGE || 'stg';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
// Managed services, resolved by the fleet's stage naming convention (N2:
// the classroom stack is never touched).
const SHARED_ASSIGNMENTS_TABLE = process.env.SHARED_ASSIGNMENTS_TABLE_NAME || 'SharedAssignments';
const SHARED_REPORTS_TABLE = process.env.SHARED_REPORTS_TABLE_NAME || 'SharedAssignmentReports';
const SHARED_BUCKET = process.env.SHARED_BUCKET_NAME || 'smalruby-shared-assignments';
const CLASSROOMS_TABLE = process.env.CLASSROOMS_TABLE_NAME || 'Classrooms';
const MEMBERSHIPS_TABLE = process.env.MEMBERSHIPS_TABLE_NAME || 'ClassroomMemberships';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE_NAME || 'ClassroomSubmissions';
const GROUPS_TABLE = process.env.GROUPS_TABLE_NAME || 'ClassroomGroups';
const SUBMISSIONS_BUCKET = process.env.SUBMISSIONS_BUCKET_NAME || 'smalruby-classroom-submissions';
const PRESIGNED_URL_DOWNLOAD_EXPIRY = parseInt(process.env.PRESIGNED_URL_DOWNLOAD_EXPIRY || '3600', 10);

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});
const googleClient = new OAuth2Client(ADMIN_GOOGLE_CLIENT_ID);

// --- Errors (bug-report conventions: authn 401 / authz 403) ---

class AuthError extends Error {}
class ForbiddenError extends Error {}
class NotFoundError extends Error {}
class ValidationError extends Error {}

// --- Identity ---

export interface AdminIdentity {
  sub: string;
  email: string;
  name: string | null;
}

function extractBearerToken(header: string | undefined): string {
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthError('Missing bearer token');
  }
  return header.slice('Bearer '.length);
}

async function verifyGoogleIdToken(idToken: string): Promise<AdminIdentity> {
  // Dev bypass (stg only; the stack refuses to deploy it to prod).
  if (DEV_BYPASS_TOKEN && STAGE !== 'prod' && idToken === DEV_BYPASS_TOKEN) {
    return { sub: 'dev-admin', email: 'dev-admin@example.com', name: 'Dev Admin' };
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      // Admin-dedicated audience (decision B): tokens minted for the editor
      // client ID fail here by design.
      audience: ADMIN_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
      throw new AuthError('Token payload is missing a verified email');
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || null,
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid ID token');
  }
}

// --- Authorization (deny-by-default allowlist) ---

/**
 * Decide the authorization outcome for a verified identity against the
 * allowlist row (pure — the pin/deny matrix is unit-tested directly).
 * @param row - the SmalrubyAdmins item for the identity's email (or null)
 * @param identity - the verified Google identity
 * @returns 'denied' | 'pin' (first login: pin the sub) | 'ok'
 */
export function authorizationOutcome(
  row: Record<string, unknown> | null,
  identity: AdminIdentity,
): 'denied' | 'pin' | 'ok' {
  if (!row) return 'denied';
  const pinned = row.sub;
  if (typeof pinned !== 'string' || pinned.length === 0) return 'pin';
  return pinned === identity.sub ? 'ok' : 'denied';
}

async function requireAdmin(identity: AdminIdentity): Promise<void> {
  const result = await docClient.send(new GetCommand({
    TableName: ADMINS_TABLE,
    Key: { email: identity.email },
  }));
  const outcome = authorizationOutcome((result.Item as Record<string, unknown>) || null, identity);

  if (outcome === 'denied') {
    audit('admin.denied', identity, {});
    throw new ForbiddenError('Not an administrator');
  }
  if (outcome === 'pin') {
    // First login: pin the Google sub so a later token with the same email
    // but a different account is rejected (email-reuse defense).
    await docClient.send(new UpdateCommand({
      TableName: ADMINS_TABLE,
      Key: { email: identity.email },
      UpdateExpression: 'SET #sub = :sub, firstLoginAt = :now',
      // Never overwrite an existing pin (raced first logins).
      ConditionExpression: 'attribute_not_exists(#sub)',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': identity.sub, ':now': new Date().toISOString() },
    }));
    audit('admin.subPinned', identity, {});
  }
}

// --- Audit log (structured, CloudWatch; bug-report pattern) ---

function audit(action: string, identity: AdminIdentity, extra: Record<string, unknown>): void {
  console.log(JSON.stringify({
    audit: true,
    action,
    adminSub: identity.sub,
    adminEmail: identity.email,
    ...extra,
  }));
}

// --- CORS ---

function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = origin && CORS_ALLOWED_ORIGINS.includes(origin)
    ? origin
    : CORS_ALLOWED_ORIGINS[0] || '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

// --- Handlers ---

async function handleMe(identity: AdminIdentity): Promise<APIGatewayProxyStructuredResultV2> {
  return {
    statusCode: 200,
    body: JSON.stringify({
      email: identity.email,
      name: identity.name,
      stage: STAGE,
    }),
  };
}

// --- みんなの課題 management (S3 #1083, moderation per EPIC #1066 D3) ---

interface SharedPage {
  text: string;
  imageKey?: string;
}

/**
 * Admin projection of a shared item. authorSub stays internal even for
 * operators — the public author profile (name/affiliation) is what matters
 * for moderation.
 */
function mapSharedItemForAdmin(item: Record<string, unknown>) {
  const content = (item.content || {}) as { pages?: SharedPage[]; starterKey?: string };
  return {
    sharedId: item.sharedId,
    title: item.title,
    summary: item.summary || null,
    schoolLevel: item.schoolLevel,
    grades: item.grades || [],
    subject: item.subject,
    tags: item.tags || [],
    supplementUrl: item.supplementUrl || null,
    authorName: item.authorName,
    authorAffiliation: item.authorAffiliation || null,
    status: item.status,
    reuseCount: (item.reuseCount as number) || 0,
    pageCount: (content.pages || []).length,
    hasStarter: !!content.starterKey,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/** Scan a whole (small) table — admin listings are fleet-wide by design. */
async function scanAll(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const page = await docClient.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...((page.Items as Record<string, unknown>[]) || []));
    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

/**
 * Group reports by sharedId (most-reported first, newest first inside).
 * Pure and exported for tests. reporterSub is never exposed.
 * @param reports - raw report items
 * @returns per-item report summaries
 */
export function buildReportQueue(reports: Record<string, unknown>[]): {
  sharedId: string;
  count: number;
  reports: { reason: string; createdAt: string }[];
}[] {
  const byId = new Map<string, { reason: string; createdAt: string }[]>();
  for (const report of reports) {
    const sharedId = String(report.sharedId);
    const list = byId.get(sharedId) || [];
    list.push({
      reason: String(report.reason || ''),
      createdAt: String(report.createdAt || ''),
    });
    byId.set(sharedId, list);
  }
  return [...byId.entries()]
    .map(([sharedId, list]) => ({
      sharedId,
      count: list.length,
      reports: list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }))
    .sort((a, b) => b.count - a.count);
}

async function handleListSharedReports(identity: AdminIdentity): Promise<APIGatewayProxyStructuredResultV2> {
  audit('shared.listReports', identity, {});
  const reports = await scanAll(SHARED_REPORTS_TABLE);
  const queue = buildReportQueue(reports);

  // Join the reported items so the operator sees titles/status inline.
  const withItems = await Promise.all(queue.map(async entry => {
    const result = await docClient.send(new GetCommand({
      TableName: SHARED_ASSIGNMENTS_TABLE,
      Key: { sharedId: entry.sharedId },
    }));
    return {
      ...entry,
      item: result.Item ? mapSharedItemForAdmin(result.Item as Record<string, unknown>) : null,
    };
  }));

  return { statusCode: 200, body: JSON.stringify({ queue: withItems }) };
}

async function handleListSharedAssignments(
  identity: AdminIdentity, query: Record<string, string | undefined>,
): Promise<APIGatewayProxyStructuredResultV2> {
  audit('shared.list', identity, { q: query.q || null, status: query.status || null });
  let items = (await scanAll(SHARED_ASSIGNMENTS_TABLE)).map(mapSharedItemForAdmin);
  if (query.status) {
    items = items.filter(item => item.status === query.status);
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    items = items.filter(item =>
      String(item.title).toLowerCase().includes(q) ||
      String(item.authorName).toLowerCase().includes(q));
  }
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { statusCode: 200, body: JSON.stringify({ items }) };
}

async function handleGetSharedAssignment(
  identity: AdminIdentity, sharedId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  audit('shared.get', identity, { sharedId });
  const result = await docClient.send(new GetCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    Key: { sharedId },
  }));
  if (!result.Item) {
    throw new NotFoundError('Shared assignment not found');
  }
  const item = result.Item as Record<string, unknown>;
  const content = (item.content || {}) as { pages?: SharedPage[]; starterKey?: string };
  const pages = await Promise.all((content.pages || []).map(async page => ({
    text: page.text,
    imageUrl: page.imageKey
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: SHARED_BUCKET, Key: page.imageKey }),
          { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY },
        )
      : null,
  })));
  // The starter project is part of what gets moderated — let the operator
  // download and inspect the actual .sb3.
  const starterUrl = content.starterKey
    ? await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: SHARED_BUCKET, Key: content.starterKey }),
        { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY },
      )
    : null;

  return {
    statusCode: 200,
    body: JSON.stringify({ ...mapSharedItemForAdmin(item), pages, starterUrl }),
  };
}

async function handleSetSharedStatus(
  identity: AdminIdentity, sharedId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (body.status !== 'published' && body.status !== 'unlisted') {
    throw new ValidationError('Status must be "published" or "unlisted"');
  }
  const result = await docClient.send(new GetCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    Key: { sharedId },
  }));
  if (!result.Item) {
    throw new NotFoundError('Shared assignment not found');
  }

  await docClient.send(new UpdateCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    Key: { sharedId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': body.status, ':now': new Date().toISOString() },
  }));
  audit('shared.setStatus', identity, { sharedId, status: body.status });

  return {
    statusCode: 200,
    body: JSON.stringify(mapSharedItemForAdmin({ ...result.Item, status: body.status })),
  };
}

// --- Classroom management + expired restore (S4 #1084) ---
// The restore UI supersedes classroom's ops CLI (EPIC #1049 D6 update):
// snapshots written by the classroom archiver under
// s3://<submissions-bucket>/ddb-archive/ are searched, planned and
// rehydrated from here, all audited.

const ARCHIVE_PREFIX = 'ddb-archive';

function mapClassroomForAdmin(item: Record<string, unknown>) {
  return {
    classroomId: item.classroomId,
    className: item.className,
    assignmentName: item.assignmentName || null,
    joinCode: item.joinCode,
    studentCount: item.studentCount,
    groupId: item.groupId || null,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || null,
    restoredAt: item.restoredAt || null,
    expiresAt: item.ttl ? new Date((item.ttl as number) * 1000).toISOString() : null,
  };
}

async function handleListClassrooms(
  identity: AdminIdentity, query: Record<string, string | undefined>,
): Promise<APIGatewayProxyStructuredResultV2> {
  audit('classroom.list', identity, { q: query.q || null });
  const q = (query.q || '').trim().toLowerCase();
  let items = (await scanAll(CLASSROOMS_TABLE))
    // The classrooms table reuses its key space for quota counters.
    .filter(item => typeof item.classroomId === 'string' && !String(item.classroomId).includes('-quota#'))
    .map(mapClassroomForAdmin);
  if (q) {
    items = items.filter(item =>
      String(item.joinCode || '').toLowerCase() === q ||
      String(item.className || '').toLowerCase().includes(q) ||
      String(item.assignmentName || '').toLowerCase().includes(q));
  }
  items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return { statusCode: 200, body: JSON.stringify({ items: items.slice(0, 100) }) };
}

async function handleGetClassroom(
  identity: AdminIdentity, classroomId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  audit('classroom.get', identity, { classroomId });
  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!result.Item) {
    throw new NotFoundError('Classroom not found');
  }
  const [members, submissions] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      KeyConditionExpression: 'classroomId = :cid',
      ExpressionAttributeValues: { ':cid': classroomId },
      Select: 'COUNT',
    })),
    docClient.send(new QueryCommand({
      TableName: SUBMISSIONS_TABLE,
      KeyConditionExpression: 'classroomId = :cid',
      ExpressionAttributeValues: { ':cid': classroomId },
      Select: 'COUNT',
    })),
  ]);
  return {
    statusCode: 200,
    body: JSON.stringify({
      ...mapClassroomForAdmin(result.Item as Record<string, unknown>),
      memberCount: members.Count || 0,
      submissionCount: submissions.Count || 0,
    }),
  };
}

async function handleSetClassroomStatus(
  identity: AdminIdentity, classroomId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (body.status !== 'active' && body.status !== 'archived') {
    throw new ValidationError('Status must be "active" or "archived"');
  }
  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!result.Item) {
    throw new NotFoundError('Classroom not found');
  }
  await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': body.status, ':now': new Date().toISOString() },
  }));
  audit('classroom.setStatus', identity, { classroomId, status: body.status });
  return {
    statusCode: 200,
    body: JSON.stringify(mapClassroomForAdmin({ ...result.Item, status: body.status })),
  };
}

// --- ddb-archive snapshot helpers ---

async function readSnapshot(key: string): Promise<Snapshot | null> {
  try {
    const result = await s3Client.send(new GetObjectCommand({ Bucket: SUBMISSIONS_BUCKET, Key: key }));
    const body = await result.Body?.transformToString();
    return body ? (JSON.parse(body) as Snapshot) : null;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NoSuchKey' || name === 'NotFound') return null;
    throw err;
  }
}

async function listArchiveKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3Client.send(new ListObjectsV2Command({
      Bucket: SUBMISSIONS_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const object of page.Contents || []) {
      if (object.Key) keys.push(object.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function collectSnapshotChildren(kind: string, classroomId: string): Promise<Record<string, unknown>[]> {
  const keys = await listArchiveKeys(`${ARCHIVE_PREFIX}/${kind}/${classroomId}/`);
  const items: Record<string, unknown>[] = [];
  for (const key of keys) {
    const snapshot = await readSnapshot(key);
    if (snapshot?.item) items.push(snapshot.item);
  }
  return items;
}

async function handleSearchRestoreCandidates(
  identity: AdminIdentity, query: Record<string, string | undefined>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const q = (query.q || '').trim();
  if (!q) {
    throw new ValidationError('q is required');
  }
  audit('classroom.searchSnapshots', identity, { q });

  const keys = await listArchiveKeys(`${ARCHIVE_PREFIX}/classrooms/`);
  const matches: Record<string, unknown>[] = [];
  for (const key of keys) {
    const snapshot = await readSnapshot(key);
    if (snapshot && matchSnapshot(snapshot, q)) {
      matches.push({
        ...mapClassroomForAdmin(snapshot.item),
        deletedAt: snapshot.deletedAt,
      });
    }
  }
  return { statusCode: 200, body: JSON.stringify({ items: matches }) };
}

async function gatherRestoreInput(classroomId: string): Promise<{
  input: RestorePlanInput;
  deletedAt: string | null;
  missingFiles: number;
} | null> {
  const snapshot = await readSnapshot(`${ARCHIVE_PREFIX}/classrooms/${classroomId}.json`);
  if (!snapshot?.item) return null;

  const classroom = snapshot.item;
  const [memberships, submissions] = await Promise.all([
    collectSnapshotChildren('memberships', classroomId),
    collectSnapshotChildren('submissions', classroomId),
  ]);

  // Restore the owning group too when it was swept.
  let group: Record<string, unknown> | null = null;
  if (typeof classroom.groupId === 'string' && classroom.groupId) {
    const liveGroup = await docClient.send(new GetCommand({
      TableName: GROUPS_TABLE,
      Key: { groupId: classroom.groupId },
    }));
    if (!liveGroup.Item) {
      const groupSnapshot = await readSnapshot(`${ARCHIVE_PREFIX}/groups/${classroom.groupId}.json`);
      group = groupSnapshot?.item || null;
    }
  }

  // Verify the submission binaries still exist.
  let missingFiles = 0;
  for (const submission of submissions) {
    if (typeof submission.s3Key !== 'string') continue;
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: SUBMISSIONS_BUCKET, Key: submission.s3Key }));
    } catch {
      missingFiles++;
    }
  }

  return {
    input: { classroom, memberships, submissions, group },
    deletedAt: snapshot.deletedAt,
    missingFiles,
  };
}

async function handleRestorePlan(
  identity: AdminIdentity, classroomId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  audit('classroom.restorePlan', identity, { classroomId });

  const live = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (live.Item) {
    // Still alive — an accidental archive is the teacher's own UI restore.
    return {
      statusCode: 200,
      body: JSON.stringify({ alive: true, status: live.Item.status }),
    };
  }

  const gathered = await gatherRestoreInput(classroomId);
  if (!gathered) {
    throw new NotFoundError('No snapshot found for this classroom');
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      alive: false,
      classroom: mapClassroomForAdmin(gathered.input.classroom),
      deletedAt: gathered.deletedAt,
      memberCount: gathered.input.memberships.length,
      submissionCount: gathered.input.submissions.length,
      restoresGroup: !!gathered.input.group,
      missingFiles: gathered.missingFiles,
    }),
  };
}

const RESTORE_TABLE_FOR: Record<PlannedItem['table'], () => string> = {
  classrooms: () => CLASSROOMS_TABLE,
  memberships: () => MEMBERSHIPS_TABLE,
  submissions: () => SUBMISSIONS_TABLE,
  groups: () => GROUPS_TABLE,
};

async function handleRestoreExecute(
  identity: AdminIdentity, classroomId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const live = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (live.Item) {
    throw new ValidationError('Classroom is still alive — restore it from the teacher UI instead');
  }
  const gathered = await gatherRestoreInput(classroomId);
  if (!gathered) {
    throw new NotFoundError('No snapshot found for this classroom');
  }

  const plan = buildRestorePlan(gathered.input, Date.now());
  for (const planned of plan) {
    const put: { TableName: string; Item: Record<string, unknown>; ConditionExpression?: string } = {
      TableName: RESTORE_TABLE_FOR[planned.table](),
      Item: planned.item,
    };
    if (planned.table === 'classrooms') {
      // Never clobber a live classroom (raced restore).
      put.ConditionExpression = 'attribute_not_exists(classroomId)';
    }
    await docClient.send(new PutCommand(put));
  }
  audit('classroom.restore', identity, {
    classroomId,
    items: plan.length,
    missingFiles: gathered.missingFiles,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      restored: plan.length,
      missingFiles: gathered.missingFiles,
      classroom: mapClassroomForAdmin({ ...gathered.input.classroom, status: 'active' }),
    }),
  };
}

// --- Main handler ---

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  const origin = event.headers?.origin;
  const corsHeaders = getCorsHeaders(origin);

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;

    // Every route requires an authenticated + authorized administrator.
    const token = extractBearerToken(event.headers?.authorization);
    const identity = await verifyGoogleIdToken(token);
    await requireAdmin(identity);

    const body = event.body ? JSON.parse(event.body) : {};

    let result: APIGatewayProxyStructuredResultV2;
    if (method === 'GET' && path === '/admin/me') {
      result = await handleMe(identity);

    } else if (method === 'GET' && path === '/admin/shared-assignments/reports') {
      result = await handleListSharedReports(identity);

    } else if (method === 'GET' && path === '/admin/shared-assignments') {
      result = await handleListSharedAssignments(identity, event.queryStringParameters || {});

    } else if (method === 'GET' && /^\/admin\/shared-assignments\/[^/]+$/.test(path)) {
      const sharedId = event.pathParameters?.sharedId || '';
      result = await handleGetSharedAssignment(identity, sharedId);

    } else if (method === 'PATCH' && /^\/admin\/shared-assignments\/[^/]+$/.test(path)) {
      const sharedId = event.pathParameters?.sharedId || '';
      result = await handleSetSharedStatus(identity, sharedId, body);

    } else if (method === 'GET' && path === '/admin/classrooms') {
      result = await handleListClassrooms(identity, event.queryStringParameters || {});

    // Literal route first — it would otherwise match the {classroomId} shapes.
    } else if (method === 'GET' && path === '/admin/classrooms/restore-candidates') {
      result = await handleSearchRestoreCandidates(identity, event.queryStringParameters || {});

    } else if (method === 'GET' && /^\/admin\/classrooms\/[^/]+\/restore-plan$/.test(path)) {
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleRestorePlan(identity, classroomId);

    } else if (method === 'POST' && /^\/admin\/classrooms\/[^/]+\/restore$/.test(path)) {
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleRestoreExecute(identity, classroomId);

    } else if (method === 'GET' && /^\/admin\/classrooms\/[^/]+$/.test(path)) {
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleGetClassroom(identity, classroomId);

    } else if (method === 'PATCH' && /^\/admin\/classrooms\/[^/]+$/.test(path)) {
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleSetClassroomStatus(identity, classroomId, body);

    } else {
      throw new NotFoundError('Not found');
    }

    return { ...result, headers: { ...corsHeaders, ...result.headers } };
  } catch (err) {
    if (err instanceof AuthError) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof ForbiddenError) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof NotFoundError) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof ValidationError) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    console.error('Handler error:', err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
