import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import * as crypto from 'crypto';

// --- Configuration ---

const CLASSROOMS_TABLE = process.env.CLASSROOMS_TABLE_NAME || 'Classrooms';
const MEMBERSHIPS_TABLE = process.env.MEMBERSHIPS_TABLE_NAME || 'ClassroomMemberships';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE_NAME || 'ClassroomSubmissions';
const KICK_REQUESTS_TABLE = process.env.KICK_REQUESTS_TABLE_NAME || 'ClassroomKickRequests';
const GROUPS_TABLE = process.env.GROUPS_TABLE_NAME || 'ClassroomGroups';
const SUBMISSIONS_BUCKET = process.env.SUBMISSIONS_BUCKET_NAME || 'smalruby-classroom-submissions';
// みんなの課題 — nationwide shared assignment library (EPIC #1066)
const SHARED_ASSIGNMENTS_TABLE = process.env.SHARED_ASSIGNMENTS_TABLE_NAME || 'SharedAssignments';
const SHARED_REPORTS_TABLE = process.env.SHARED_REPORTS_TABLE_NAME || 'SharedAssignmentReports';
// お知らせ (notification center, EPIC #1111) — admin → teacher notices. The
// admin stack writes items; this API lists/marks-read for the teacher.
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE_NAME || 'ClassroomNotifications';
const SHARED_BUCKET = process.env.SHARED_BUCKET_NAME || 'smalruby-shared-assignments';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const DEV_BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || '';
const STAGE = process.env.STAGE || 'stg';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

const MAX_CLASS_NAME_LENGTH = 50;
const MAX_STUDENT_COUNT = parseInt(process.env.MAX_STUDENT_COUNT || '50', 10);
const MAX_NICKNAME_LENGTH = 20;
// 6-digit alphanumeric, excluding confusing chars (I, O, 0, 1)
const JOIN_CODE_CHARS = 'abcdefghjklmnpqrstuvwxyz23456789';
const JOIN_CODE_LENGTH = 6;
// Classroom TTL from environment (default 90 days — covers a school term so
// term-end batch evaluation can still read every submission)
const CLASSROOM_TTL_DAYS = parseInt(process.env.CLASSROOM_TTL_DAYS || '90', 10);
const CLASSROOM_TTL_SECONDS = CLASSROOM_TTL_DAYS * 24 * 60 * 60;
// Session and membership TTL matches classroom TTL
const SESSION_TTL_SECONDS = CLASSROOM_TTL_SECONDS;
// Token expiry is validated by each provider's library:
// - Google: google-auth-library checks exp automatically
// - Microsoft: jose jwtVerify checks exp automatically
// No custom ID_TOKEN_MAX_AGE_SECONDS check needed.
// Rate limiting for join endpoint (per IP)
const JOIN_RATE_LIMIT_WINDOW_SECONDS = parseInt(process.env.JOIN_RATE_LIMIT_WINDOW_SECONDS || '60', 10);
const JOIN_RATE_LIMIT_MAX_ATTEMPTS = parseInt(process.env.JOIN_RATE_LIMIT_MAX_ATTEMPTS || '50', 10);
const JOIN_CODE_REGEX = new RegExp(`^[${JOIN_CODE_CHARS}]{${JOIN_CODE_LENGTH}}$`);
// Session activity TTL — determines "seated" status for teachers (default 1 hour)
const SESSION_ACTIVE_TTL_SECONDS = parseInt(process.env.SESSION_ACTIVE_TTL_SECONDS || '3600', 10);
// Submission config (TTL matches classroom TTL)
const SUBMISSION_TTL_SECONDS = CLASSROOM_TTL_SECONDS;
const MAX_PROJECT_NAME_LENGTH = 100;
const PRESIGNED_URL_UPLOAD_EXPIRY = parseInt(process.env.PRESIGNED_URL_UPLOAD_EXPIRY || '300', 10); // default 5 minutes
const PRESIGNED_URL_DOWNLOAD_EXPIRY = parseInt(process.env.PRESIGNED_URL_DOWNLOAD_EXPIRY || '3600', 10); // default 1 hour
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_SCREENSHOT_COUNT = 20;
const MAX_TEACHER_COMMENT_LENGTH = 500;
// Kick request TTL: short-lived (1h) since the student is actively waiting
// for the teacher to act. Expired requests are removed by DynamoDB TTL.
const KICK_REQUEST_TTL_SECONDS = parseInt(process.env.KICK_REQUEST_TTL_SECONDS || '3600', 10);
const MAX_KICK_REQUEST_REASON_LENGTH = 200;
// Group (組) metadata TTL: groups are the teacher's year-long organizing
// concept and carry no student work, so they outlive the 90-day classroom
// retention. 400 days covers a school year (April–March) plus a buffer.
const GROUP_TTL_DAYS = parseInt(process.env.GROUP_TTL_DAYS || '400', 10);
const GROUP_TTL_SECONDS = GROUP_TTL_DAYS * 24 * 60 * 60;
const MAX_GROUP_NAME_LENGTH = 50;
// How many prior lessons of the same group to inspect when looking up the
// student's previous returned comment on join (personalized recap).
const PREVIOUS_COMMENT_LOOKBACK = 3;
// みんなの課題 (EPIC #1066): shared items are permanent (no TTL), so quota
// counters reuse the Classrooms table's reserved key space (TTL-cleaned)
// instead. Retention decisions: spike #1067 D10-D12.
const SHARE_DAILY_LIMIT = parseInt(process.env.SHARE_DAILY_LIMIT || '10', 10);
const REPORT_DAILY_LIMIT = parseInt(process.env.REPORT_DAILY_LIMIT || '20', 10);
const SHARED_STARTER_MAX_BYTES = parseInt(process.env.SHARED_STARTER_MAX_BYTES || String(50 * 1024 * 1024), 10);
const SHARED_REPORT_TTL_SECONDS = 90 * 24 * 60 * 60;
const SHARED_LIST_PAGE_SIZE = 30;
const MAX_SHARED_TITLE_LENGTH = 50;
const MAX_SHARED_SUMMARY_LENGTH = 100;
const MAX_SHARED_TAGS = 5;
const MAX_SHARED_TAG_LENGTH = 20;
const MAX_SUPPLEMENT_URL_LENGTH = 500;
const MAX_AUTHOR_NAME_LENGTH = 30;
const MAX_AUTHOR_AFFILIATION_LENGTH = 50;
const MAX_SHARED_REPORT_REASON_LENGTH = 200;
// お知らせの一覧窓（= mark-read が既読化する範囲）。通知は短命な案内なので
// 直近 50 件で足りる想定（TTL は書き手の admin スタックが付ける）。
const NOTIFICATION_LIST_LIMIT = 50;

// Class (旧組) v2 data model: every assignment (Classrooms record) belongs to
// a class (ClassroomGroups record), and class-level GC linkage / co-teachers /
// studentCount are authoritative. The version is stamped on each group record
// so the client can trigger the one-time bulk migration when it sees older
// (or missing) versions on first class-list view.
const CLASSROOM_SCHEMA_VERSION = 2;
const MAX_TOPICS_PER_CLASS = 20;
const MAX_TOPIC_NAME_LENGTH = 50;
// Assignment content (lesson delivery): teacher-authored pages of
// (short text + optional image) plus an optional starter project, attached to
// a classroom. Objects live under {classroomId}/assignment/ in the
// submissions bucket and share its lifecycle expiry.
const MAX_ASSIGNMENT_PAGES = 10;
const MAX_ASSIGNMENT_PAGE_TEXT_LENGTH = 500;
// Content types accepted for assignment page images (MIME → S3 key extension).
const ASSIGNMENT_IMAGE_CONTENT_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};
// AI evaluation support (teacher-facing): the Lambda relays static-analysis
// results to the Anthropic API and returns grade proposals / comment drafts.
// One call handles at most EVAL_MAX_SUBMISSIONS submissions so the response
// fits API Gateway's hard 30s integration timeout — the client chunks a
// whole class into several calls (the cached system prompt is shared).
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const EVAL_MAX_SUBMISSIONS = parseInt(process.env.EVAL_MAX_SUBMISSIONS || '10', 10);
const EVAL_MAX_PSEUDOCODE_LENGTH = parseInt(process.env.EVAL_MAX_PSEUDOCODE_LENGTH || '4000', 10);
const EVAL_RATE_LIMIT_WINDOW_SECONDS = parseInt(process.env.EVAL_RATE_LIMIT_WINDOW_SECONDS || '3600', 10);
const EVAL_RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.EVAL_RATE_LIMIT_MAX_REQUESTS || '60', 10);
// Durable per-teacher daily cap on Claude API calls (adversarial review):
// the in-memory hourly window resets on cold starts and is per-instance, so
// a DynamoDB counter enforces the real budget. One 35-student class costs
// ~4 chunked calls per run (grade or comment), so 50 calls/day ≈ 5 full
// grade+comment runs. Env-configurable for tests and per-stage tuning.
const EVAL_DAILY_LIMIT = parseInt(process.env.EVAL_DAILY_LIMIT || '50', 10);
const EVAL_GRADES = ['S', 'A', 'B', 'C'];

// --- DynamoDB Client ---

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// --- Paginated reads (#1146) ---

// DynamoDB は 1 回の Query/Scan で最大 1MB しか読まず、続きは
// LastEvaluatedKey で辿る。しかもこの 1MB 上限は **FilterExpression 適用前**
// に効くため、辿らないとテーブルが育った時点でエラーも出さずに黙って
// 取りこぼす。一覧系の読み取りは下の queryAll / scanAll に寄せる。
// 上限は暴走（壊れたページャで無限ループ）を防ぐ保険。
// 不正値（NaN / 0 以下）はそのまま使うと 1 ページも読まずに空配列を返し、
// このヘルパーが無くそうとしている「黙って取りこぼす」挙動そのものになる。
// 既定へフォールバックして、設定ミスが一覧の消失に化けないようにする。
const parsedMaxPages = parseInt(process.env.DDB_MAX_PAGES || '25', 10);
const MAX_PAGES = Number.isFinite(parsedMaxPages) && parsedMaxPages > 0 ? parsedMaxPages : 25;

/**
 * Query / Scan を LastEvaluatedKey が無くなるまで辿って全項目を返す。
 * `Limit` 付き（= 上位 N 件だけ欲しい）の呼び出しには使わない。
 */
async function paginateAll(
  makeCommand: (startKey?: Record<string, unknown>) => QueryCommand | ScanCommand,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await docClient.send(makeCommand(startKey) as QueryCommand);
    items.push(...((result.Items || []) as Record<string, unknown>[]));
    startKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    if (!startKey) {
      return items;
    }
  }
  // ページ上限に達した = 想定より遥かに大きいテーブル。取りこぼしは
  // 起きるが、無限ループよりは検知可能な形（ログ）で止める。
  console.warn('[ddb] pagination truncated at MAX_PAGES', { maxPages: MAX_PAGES, items: items.length });
  return items;
}

/** ページングする Query（GSI 一覧など）。 */
async function queryAll(input: QueryCommand['input']): Promise<Record<string, unknown>[]> {
  return paginateAll(startKey => new QueryCommand({ ...input, ExclusiveStartKey: startKey }));
}

/** ページングする Scan（リスト属性フィルタなど、GSI にできない絞り込み）。 */
async function scanAll(input: ScanCommand['input']): Promise<Record<string, unknown>[]> {
  return paginateAll(startKey => new ScanCommand({ ...input, ExclusiveStartKey: startKey }));
}

// --- S3 Client ---

const s3Client = new S3Client({});

// --- Google Auth ---

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Exported helpers (for testing) ---

export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowed = origin && CORS_ALLOWED_ORIGINS.includes(origin) ? origin : CORS_ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Google-Access-Token',
    'Content-Type': 'application/json',
  };
}

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_CHARS[crypto.randomInt(JOIN_CODE_CHARS.length)];
  }
  return code;
}

export function generateSessionToken(): string {
  return crypto.randomUUID();
}

export function validateClassName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Class name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_CLASS_NAME_LENGTH) {
    throw new ValidationError(`Class name must be ${MAX_CLASS_NAME_LENGTH} characters or less`);
  }
  return trimmed;
}

export function validateStudentCount(count: unknown): number {
  const n = typeof count === 'number' ? count : parseInt(String(count), 10);
  if (isNaN(n) || n < 1 || n > MAX_STUDENT_COUNT) {
    throw new ValidationError(`Student count must be between 1 and ${MAX_STUDENT_COUNT}`);
  }
  return n;
}

export function validateSeatNumber(seat: unknown, maxSeats: number): number {
  const n = typeof seat === 'number' ? seat : parseInt(String(seat), 10);
  if (isNaN(n) || n < 1 || n > maxSeats) {
    throw new ValidationError(`Seat number must be between 1 and ${maxSeats}`);
  }
  return n;
}

export function validateNickname(nickname: unknown): string | undefined {
  if (nickname === undefined || nickname === null || nickname === '') return undefined;
  if (typeof nickname !== 'string') {
    throw new ValidationError('Nickname must be a string');
  }
  const trimmed = nickname.trim();
  if (trimmed.length > MAX_NICKNAME_LENGTH) {
    throw new ValidationError(`Nickname must be ${MAX_NICKNAME_LENGTH} characters or less`);
  }
  return trimmed || undefined;
}

export function validateJoinCode(code: unknown): string {
  if (typeof code !== 'string' || code.trim().length !== JOIN_CODE_LENGTH) {
    throw new ValidationError(`Join code must be ${JOIN_CODE_LENGTH} characters`);
  }
  const lower = code.trim().toLowerCase();
  if (!JOIN_CODE_REGEX.test(lower)) {
    throw new ValidationError('Join code contains invalid characters');
  }
  return lower;
}

// --- Error classes ---

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

class GoogleAPIError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'GoogleAPIError';
    this.statusCode = statusCode;
  }
}

// Tombstone error: the member's row exists but is flagged kicked. Surface this
// to the student so the UI can show a specific "you were removed by the
// teacher" banner instead of the generic "session expired" alert.
class KickedError extends Error {
  joinCode: string;
  className: string;
  seatNumber: number;
  constructor(joinCode: string, className: string, seatNumber: number) {
    super('You were removed from the classroom by the teacher');
    this.name = 'KickedError';
    this.joinCode = joinCode;
    this.className = className;
    this.seatNumber = seatNumber;
  }
}

// Kick tombstone TTL: how long after a teacher kick we keep the row around so
// the kicked student's next verify-session can read the reason. Anything beyond
// this (1 hour) and we don't bother — the student will hit the regular "session
// expired" path. The tombstone is also consumed proactively when another
// student joins the seat.
const KICK_TOMBSTONE_TTL_SECONDS = parseInt(process.env.KICK_TOMBSTONE_TTL_SECONDS || '3600', 10);

// --- Google Classroom API proxy ---

async function callGoogleClassroomAPI(
  accessToken: string,
  path: string,
  method: string = 'GET',
  body?: unknown,
): Promise<unknown> {
  const url = `https://classroom.googleapis.com/v1/${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new GoogleAPIError(response.status, `Google Classroom API error: ${response.status}`);
  }
  return response.json();
}

function extractGoogleAccessToken(headers: Record<string, string | undefined>): string {
  const token = headers['x-google-access-token'];
  if (!token) {
    throw new AuthError('X-Google-Access-Token header is required');
  }
  return token;
}

// --- Microsoft JWKS ---

const MICROSOFT_JWKS_URI = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const microsoftJWKS = createRemoteJWKSet(new URL(MICROSOFT_JWKS_URI));

// --- Auth helpers ---

/**
 * Decode a JWT payload without verification to inspect the issuer claim.
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('Malformed token');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

/**
 * A verified teacher's identity. `sub` is the provider's stable user id
 * (Google sub / Microsoft oid) and is the classroom owner key. `email` is the
 * verified email claim (lowercased), used to match co-teacher invitations.
 * `email` may be null when the provider does not supply one.
 */
export interface TeacherIdentity {
  sub: string;
  email: string | null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<TeacherIdentity> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new AuthError('Invalid token payload');
    }
    // Only trust the email when Google marks it verified.
    const email = payload.email && payload.email_verified ? normalizeEmail(payload.email) : null;
    return { sub: payload.sub, email };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid or expired Google ID token');
  }
}

export async function verifyMicrosoftIdToken(idToken: string): Promise<TeacherIdentity> {
  if (!MICROSOFT_CLIENT_ID) {
    throw new AuthError('Microsoft authentication is not configured');
  }
  try {
    const { payload } = await jwtVerify(idToken, microsoftJWKS, {
      audience: MICROSOFT_CLIENT_ID,
    });
    // Validate issuer: must be Microsoft login endpoint
    const iss = payload.iss as string;
    if (!iss || !iss.startsWith('https://login.microsoftonline.com/')) {
      throw new AuthError('Invalid Microsoft token issuer');
    }
    // Use oid (object ID) as the unique identifier for the user
    const oid = (payload.oid || payload.sub) as string;
    if (!oid) {
      throw new AuthError('Invalid Microsoft token payload');
    }
    // Microsoft puts the email in `email` or, failing that, `preferred_username`
    // (which is the UPN, normally an email address).
    const rawEmail = (payload.email || payload.preferred_username) as string | undefined;
    const email = rawEmail && rawEmail.includes('@') ? normalizeEmail(rawEmail) : null;
    return { sub: oid, email };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid or expired Microsoft ID token');
  }
}

/**
 * Verify a teacher ID token from either Google or Microsoft.
 * Detects the provider by inspecting the JWT issuer claim.
 */
export async function verifyTeacherIdToken(idToken: string): Promise<TeacherIdentity> {
  // Dev bypass: accept DEV_BYPASS_TOKEN in non-production environments only
  if (DEV_BYPASS_TOKEN && idToken === DEV_BYPASS_TOKEN && STAGE !== 'prod') {
    return { sub: 'dev-test-teacher', email: 'dev-test-teacher@example.com' };
  }

  let payload: Record<string, unknown>;
  try {
    payload = decodeJwtPayload(idToken);
  } catch {
    throw new AuthError('Invalid token format');
  }

  const iss = payload.iss as string;
  if (iss && iss.startsWith('https://login.microsoftonline.com/')) {
    return verifyMicrosoftIdToken(idToken);
  }
  return verifyGoogleIdToken(idToken);
}

/** Normalize an email for storage/comparison: trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate a co-teacher email supplied by a teacher when inviting. Returns the
 * normalized email or throws ValidationError. Intentionally lenient (a single
 * `@` with non-empty local/domain parts and a dot in the domain) — exact
 * deliverability is not checked; a wrong address is recoverable via removal.
 */
export function validateCoTeacherEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('email is required');
  }
  const email = normalizeEmail(value);
  if (email.length === 0 || email.length > 254) {
    throw new ValidationError('email must be between 1 and 254 characters');
  }
  // Basic shape check: local@domain.tld, no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('email is not a valid email address');
  }
  return email;
}

/**
 * Whether `email` appears in a stored co-teacher list. Both sides are
 * normalized: writes go through validateCoTeacherEmail, but older records (and
 * hand-edited items) may hold mixed case, and a case difference must never
 * decide authorization.
 */
function emailInCoTeacherList(list: unknown, email: string | null): boolean {
  if (!email || !Array.isArray(list)) return false;
  const target = normalizeEmail(email);
  return list.some(entry => typeof entry === 'string' && normalizeEmail(entry) === target);
}

/**
 * Whether the given teacher identity may manage the classroom: either they are
 * the owner (teacherSub) or their verified email is in the classroom's
 * coTeacherEmails list. Used by every teacher-facing ownership check.
 */
export function canManageClassroom(
  classroom: Record<string, unknown> | undefined,
  identity: TeacherIdentity,
): boolean {
  if (!classroom) return false;
  if (classroom.teacherSub === identity.sub) return true;
  return emailInCoTeacherList(classroom.coTeacherEmails, identity.email);
}

/**
 * Whether the teacher may manage the class (group): its owner, or a
 * class-level co-teacher. Shared by the group gate and by the assignment-level
 * check so a co-teacher never sees a class through one door and a 404 through
 * another (issue #1138).
 */
export function canManageGroup(
  group: Record<string, unknown> | undefined,
  identity: TeacherIdentity,
): boolean {
  if (!group) return false;
  if (group.teacherSub === identity.sub) return true;
  return emailInCoTeacherList(group.coTeacherEmails, identity.email);
}

/**
 * Class-aware manage check: classroom-level owner/co-teacher first (cheap,
 * no I/O), then the owning class (group) — its owner and class-level
 * co-teachers may manage every assignment inside it. Classroom-level
 * coTeacherEmails stay honored for pre-v2 records.
 */
async function canManageViaGroup(
  item: Record<string, unknown>,
  identity: TeacherIdentity,
): Promise<boolean> {
  if (canManageClassroom(item, identity)) {
    return true;
  }
  if (typeof item.groupId === 'string' && item.groupId) {
    const groupResult = await docClient.send(new GetCommand({
      TableName: GROUPS_TABLE,
      Key: { groupId: item.groupId },
    }));
    return canManageGroup(groupResult.Item, identity);
  }
  return false;
}

function extractBearerToken(authHeader?: string): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Authorization header with Bearer token is required');
  }
  return authHeader.slice(7);
}

// --- Route handlers ---

async function handleCreateClassroom(identity: TeacherIdentity, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  const className = validateClassName(body.className);
  let assignmentName = validateClassName(body.assignmentName); // reuse same validator (1-50 chars)
  const googleClassroomCourseId = typeof body.googleClassroomCourseId === 'string' ? body.googleClassroomCourseId.trim() : undefined;

  // Optional group (クラス) assignment — must be a class this teacher owns or co-manages.
  let groupId: string | undefined;
  let group: Record<string, unknown> | undefined;
  if (typeof body.groupId === 'string' && body.groupId) {
    group = await getManageableGroup(identity, body.groupId);
    groupId = body.groupId;
  }
  // v2: the class's studentCount is the source of truth — an assignment
  // created inside a class inherits it when the request omits the count.
  const studentCount = body.studentCount === undefined && group && typeof group.studentCount === 'number'
    ? group.studentCount
    : validateStudentCount(body.studentCount);
  const topic = body.topic !== undefined && body.topic !== null && body.topic !== ''
    ? validateTopicName(body.topic)
    : undefined;
  if (topic && groupId) {
    await ensureGroupTopic(groupId, group, topic);
  }
  const sortDate = body.sortDate !== undefined ? validateSortDate(body.sortDate) : undefined;

  // Auto-number duplicate assignment names within the same class. Paginated:
  // a truncated read would miss an existing name and hand out a duplicate.
  const existingClassrooms = await queryAll({
    TableName: CLASSROOMS_TABLE,
    IndexName: 'teacherSub-index',
    KeyConditionExpression: 'teacherSub = :ts',
    ExpressionAttributeValues: { ':ts': identity.sub },
  });
  const sameClassAssignments = existingClassrooms
    .filter(item => item.className === className && item.status === 'active')
    .map(item => item.assignmentName as string);
  if (sameClassAssignments.includes(assignmentName)) {
    let suffix = 2;
    while (sameClassAssignments.includes(`${assignmentName} (${suffix})`)) {
      suffix++;
    }
    assignmentName = `${assignmentName} (${suffix})`;
  }

  // Generate unique join code (retry up to 5 times)
  let joinCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateJoinCode();
    const existing = await docClient.send(new QueryCommand({
      TableName: CLASSROOMS_TABLE,
      IndexName: 'joinCode-index',
      KeyConditionExpression: 'joinCode = :jc',
      ExpressionAttributeValues: { ':jc': candidate },
      Limit: 1,
    }));
    if (!existing.Items || existing.Items.length === 0) {
      joinCode = candidate;
      break;
    }
  }
  if (!joinCode) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate unique join code' }) };
  }

  const now = new Date().toISOString();
  const classroomId = crypto.randomUUID();
  const ttl = Math.floor(Date.now() / 1000) + CLASSROOM_TTL_SECONDS;
  const expiresAt = new Date(ttl * 1000).toISOString();

  await docClient.send(new PutCommand({
    TableName: CLASSROOMS_TABLE,
    Item: {
      classroomId,
      teacherSub: identity.sub,
      className,
      assignmentName,
      joinCode,
      studentCount,
      googleClassroomCourseId: googleClassroomCourseId || undefined,
      groupId,
      topic,
      sortDate: sortDate || now,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ttl,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({ classroomId, className, assignmentName, joinCode, studentCount, googleClassroomCourseId: googleClassroomCourseId || null, groupId: groupId || null, topic: topic || null, sortDate: sortDate || now, status: 'active', createdAt: now, expiresAt }),
  };
}

/** Read the coTeacherEmails list from a classroom item, defaulting to []. */
function readCoTeacherEmails(item: Record<string, unknown>): string[] {
  return Array.isArray(item.coTeacherEmails) ? (item.coTeacherEmails as string[]) : [];
}

/**
 * Classes (組) shared with this teacher as a class-level co-teacher. DynamoDB
 * cannot index a list attribute, so this is a Scan + filter — the groups table
 * is small (one row per class) and this runs on list-style requests only.
 */
async function listCoManagedGroups(identity: TeacherIdentity): Promise<Record<string, unknown>[]> {
  if (!identity.email) {
    return [];
  }
  const scanned = await scanAll({
    TableName: GROUPS_TABLE,
    FilterExpression: 'contains(coTeacherEmails, :email)',
    ExpressionAttributeValues: { ':email': normalizeEmail(identity.email) },
  });
  return scanned.filter(item => item.teacherSub !== identity.sub);
}

/**
 * Ids of every class (組) this teacher may manage: the ones they own plus the
 * ones they co-manage. Used to collect the assignments inside them (#1138).
 */
async function listManageableGroupIds(identity: TeacherIdentity): Promise<string[]> {
  const owned = await queryAll({
    TableName: GROUPS_TABLE,
    IndexName: 'teacherSub-index',
    KeyConditionExpression: 'teacherSub = :ts',
    ExpressionAttributeValues: { ':ts': identity.sub },
  });
  const ids = new Set<string>();
  for (const group of [...owned, ...(await listCoManagedGroups(identity))]) {
    if (typeof group.groupId === 'string') {
      ids.add(group.groupId);
    }
  }
  return [...ids];
}

// DynamoDB は IN のオペランドを 100 個までしか受け付けない。
const IN_OPERAND_LIMIT = 100;

/**
 * Assignments the teacher may see but does not own: the ones shared with them
 * assignment-by-assignment (`coTeacherEmails`) plus the ones filed under a
 * class they manage (`groupId`). The classrooms table can index neither a list
 * attribute nor groupId, so both are Scan filters — and RCU is charged on the
 * items read *before* the filter, so the two predicates share **one** Scan
 * instead of scanning the whole table twice (#1146).
 *
 * Chunked when the teacher manages more than 100 classes, since DynamoDB caps
 * an IN list at 100 operands; the email predicate rides on the first chunk
 * only so it is never evaluated twice.
 */
async function listSharedAssignments(
  email: string | null,
  groupIds: string[],
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  const chunks: string[][] = [];
  for (let i = 0; i < groupIds.length; i += IN_OPERAND_LIMIT) {
    chunks.push(groupIds.slice(i, i + IN_OPERAND_LIMIT));
  }
  if (chunks.length === 0) {
    chunks.push([]);
  }
  for (const [chunkIndex, chunk] of chunks.entries()) {
    const values: Record<string, string> = {};
    const clauses: string[] = [];
    if (email && chunkIndex === 0) {
      values[':email'] = email;
      clauses.push('contains(coTeacherEmails, :email)');
    }
    const placeholders = chunk.map((id, index) => {
      values[`:g${index}`] = id;
      return `:g${index}`;
    });
    if (placeholders.length > 0) {
      clauses.push(`groupId IN (${placeholders.join(', ')})`);
    }
    if (clauses.length === 0) {
      continue;
    }
    items.push(...(await scanAll({
      TableName: CLASSROOMS_TABLE,
      FilterExpression: clauses.join(' OR '),
      ExpressionAttributeValues: values,
    })));
  }
  return items;
}

/** Assignments filed under any of the given classes, whoever created them. */
async function listAssignmentsInGroups(groupIds: string[]): Promise<Record<string, unknown>[]> {
  return listSharedAssignments(null, groupIds);
}

/** Fetch the owning class (group) of an assignment, or undefined (pre-v2). */
async function getOwningGroup(
  classroom: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  if (typeof classroom.groupId !== 'string' || !classroom.groupId) {
    return undefined;
  }
  const result = await docClient.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId: classroom.groupId },
  }));
  return result.Item;
}

/**
 * v2 seat count: the class's studentCount is authoritative, but only ever
 * grows the grid — max() with the assignment's own snapshot so an older
 * lesson never loses occupied seats when the class count is set smaller.
 */
function seatCountFor(
  classroom: Record<string, unknown>,
  group: Record<string, unknown> | undefined,
): number {
  const own = typeof classroom.studentCount === 'number' ? classroom.studentCount : 0;
  const groupCount = group && typeof group.studentCount === 'number' ? group.studentCount : 0;
  return Math.max(own, groupCount);
}

/**
 * Shape a classroom item for the teacher-facing list/detail responses, adding
 * the co-teacher list and the requesting teacher's role (owner vs co-teacher).
 */
function mapClassroomSummary(item: Record<string, unknown>, identity: TeacherIdentity) {
  return {
    classroomId: item.classroomId,
    className: item.className,
    assignmentName: item.assignmentName || null,
    joinCode: item.joinCode,
    studentCount: item.studentCount,
    googleClassroomCourseId: item.googleClassroomCourseId || null,
    googleClassroomAlternateLink: item.googleClassroomAlternateLink || null,
    createdAt: item.createdAt,
    expiresAt: item.ttl ? new Date((item.ttl as number) * 1000).toISOString() : null,
    coTeacherEmails: readCoTeacherEmails(item),
    groupId: item.groupId || null,
    topic: item.topic || null,
    sortDate: item.sortDate || item.createdAt || null,
    hasAssignment: hasAssignmentContent(item),
    // 共有推奨 (#1106): 書き込みは admin スタックのみ。boolean へ投影する
    // （recommendedForSharingBy = admin email は内部情報）。
    recommendedForSharing: !!item.recommendedForSharingAt,
    status: item.status,
    role: item.teacherSub === identity.sub ? 'owner' : 'co-teacher',
  };
}

async function handleListClassrooms(identity: TeacherIdentity, includeArchived = false): Promise<APIGatewayProxyStructuredResultV2> {
  // Assignments the teacher owns — fast GSI query on teacherSub.
  const owned = await queryAll({
    TableName: CLASSROOMS_TABLE,
    IndexName: 'teacherSub-index',
    KeyConditionExpression: 'teacherSub = :ts',
    ExpressionAttributeValues: { ':ts': identity.sub },
  });

  // Everything else the teacher may see, in a single Scan of the classrooms
  // table (#1146):
  //   - assignments co-taught one by one, matched by verified email
  //     (DynamoDB cannot index a list attribute with a GSI);
  //   - assignments living inside a class (組) the teacher may manage, whether
  //     they own that class or co-manage it. Managing a class grants access to
  //     everything inside it regardless of who created each assignment, so this
  //     covers both directions (issue #1138): a co-teacher must see the owner's
  //     assignments, and the owner must see assignments a co-teacher created.
  //     Keying off teacherSub would miss the other party, so filter by groupId.
  const shared = await listSharedAssignments(
    identity.email ? normalizeEmail(identity.email) : null,
    await listManageableGroupIds(identity),
  );

  // Merge by classroomId (owned wins). Archived classes are excluded unless
  // the caller opts in with ?includeArchived=1 (the archive-list / restore UI,
  // issue #1050) — the default stays active-only so already-deployed frontends
  // never see archived items reappear.
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of [...owned, ...shared]) {
    const id = item.classroomId as string;
    const visible = item.status === 'active' || (includeArchived && item.status === 'archived');
    if (visible && !byId.has(id)) {
      byId.set(id, item);
    }
  }

  const classrooms = Array.from(byId.values()).map(item => mapClassroomSummary(item, identity));
  return { statusCode: 200, body: JSON.stringify({ classrooms }) };
}

async function handleGetClassroom(identity: TeacherIdentity, classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));

  if (!result.Item || result.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }
  if (!(await canManageViaGroup(result.Item, identity))) {
    throw new AuthError('Not authorized to view this classroom');
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      classroomId: result.Item.classroomId,
      className: result.Item.className,
      assignmentName: result.Item.assignmentName || null,
      joinCode: result.Item.joinCode,
      studentCount: result.Item.studentCount,
      googleClassroomCourseId: result.Item.googleClassroomCourseId || null,
      googleClassroomAlternateLink: result.Item.googleClassroomAlternateLink || null,
      status: result.Item.status,
      createdAt: result.Item.createdAt,
      expiresAt: result.Item.ttl ? new Date((result.Item.ttl as number) * 1000).toISOString() : null,
      coTeacherEmails: readCoTeacherEmails(result.Item),
      groupId: result.Item.groupId || null,
      topic: result.Item.topic || null,
      sortDate: result.Item.sortDate || result.Item.createdAt || null,
      hasAssignment: hasAssignmentContent(result.Item),
      recommendedForSharing: !!result.Item.recommendedForSharingAt,
      role: result.Item.teacherSub === identity.sub ? 'owner' : 'co-teacher',
    }),
  };
}

// --- Co-teacher management ---
// A classroom is owned by one teacher (teacherSub) and may be co-managed by
// additional teachers identified by email (coTeacherEmails). Co-teachers are
// fully equal to the owner for every operation. The owner is NOT stored in
// coTeacherEmails, so these endpoints can never add/remove the owner — the
// creator always retains management (no "zero admins" state).

const MAX_CO_TEACHERS = 10;

async function handleListCoTeachers(identity: TeacherIdentity, classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!result.Item || result.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }
  if (!(await canManageViaGroup(result.Item, identity))) {
    throw new AuthError('Not authorized to view co-teachers for this classroom');
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      ownerSub: result.Item.teacherSub,
      coTeacherEmails: readCoTeacherEmails(result.Item),
    }),
  };
}

async function handleAddCoTeacher(identity: TeacherIdentity, classroomId: string, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  const email = validateCoTeacherEmail(body.email);

  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!result.Item || result.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }
  if (!(await canManageViaGroup(result.Item, identity))) {
    throw new AuthError('Not authorized to manage co-teachers for this classroom');
  }

  const existing = readCoTeacherEmails(result.Item);
  if (existing.includes(email)) {
    // Idempotent: already invited.
    return { statusCode: 200, body: JSON.stringify({ coTeacherEmails: existing }) };
  }
  if (existing.length >= MAX_CO_TEACHERS) {
    throw new ValidationError(`A classroom may have at most ${MAX_CO_TEACHERS} co-teachers`);
  }

  const updated = [...existing, email];
  await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
    UpdateExpression: 'SET coTeacherEmails = :list, updatedAt = :now',
    ExpressionAttributeValues: { ':list': updated, ':now': new Date().toISOString() },
  }));

  return { statusCode: 200, body: JSON.stringify({ coTeacherEmails: updated }) };
}

async function handleRemoveCoTeacher(identity: TeacherIdentity, classroomId: string, emailParam: string): Promise<APIGatewayProxyStructuredResultV2> {
  const email = normalizeEmail(decodeURIComponent(emailParam));

  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!result.Item || result.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }
  if (!(await canManageViaGroup(result.Item, identity))) {
    throw new AuthError('Not authorized to manage co-teachers for this classroom');
  }

  const existing = readCoTeacherEmails(result.Item);
  const updated = existing.filter(e => e !== email);
  if (updated.length !== existing.length) {
    await docClient.send(new UpdateCommand({
      TableName: CLASSROOMS_TABLE,
      Key: { classroomId },
      UpdateExpression: 'SET coTeacherEmails = :list, updatedAt = :now',
      ExpressionAttributeValues: { ':list': updated, ':now': new Date().toISOString() },
    }));
  }

  return { statusCode: 200, body: JSON.stringify({ coTeacherEmails: updated }) };
}

async function handleUpdateClassroom(identity: TeacherIdentity, classroomId: string, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to update this classroom');
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.className !== undefined) {
    updates.className = validateClassName(body.className);
  }
  if (body.assignmentName !== undefined) {
    updates.assignmentName = validateClassName(body.assignmentName);
  }
  if (body.studentCount !== undefined) {
    updates.studentCount = validateStudentCount(body.studentCount);
  }
  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'archived') {
      throw new ValidationError('Status must be "active" or "archived"');
    }
    updates.status = body.status;
  }
  if (body.regenerateJoinCode === true) {
    updates.joinCode = generateJoinCode();
  }
  // Assign to / remove from a group (クラス). `groupId: null` clears the
  // assignment; a string must be a class this teacher owns or co-manages.
  if (body.groupId !== undefined) {
    if (body.groupId === null || body.groupId === '') {
      updates.groupId = null;
    } else if (typeof body.groupId === 'string') {
      await getManageableGroup(identity, body.groupId);
      updates.groupId = body.groupId;
    } else {
      throw new ValidationError('groupId must be a string or null');
    }
  }
  if (body.topic !== undefined) {
    if (body.topic === null || body.topic === '') {
      updates.topic = null;
    } else {
      updates.topic = validateTopicName(body.topic);
      // A new topic used on an assignment becomes part of the class's list.
      const effectiveGroupId = (updates.groupId !== undefined ? updates.groupId : classroom.Item.groupId) as
        string | null | undefined;
      if (effectiveGroupId) {
        await ensureGroupTopic(effectiveGroupId, undefined, updates.topic as string);
      }
    }
  }
  if (body.sortDate !== undefined) {
    updates.sortDate = validateSortDate(body.sortDate);
  }

  const expressionParts: string[] = [];
  const expressionValues: Record<string, unknown> = {};
  const expressionNames: Record<string, string> = {};

  let i = 0;
  for (const [key, value] of Object.entries(updates)) {
    const attrName = `#attr${i}`;
    const attrValue = `:val${i}`;
    expressionNames[attrName] = key;
    expressionValues[attrValue] = value;
    expressionParts.push(`${attrName} = ${attrValue}`);
    i++;
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      classroomId: result.Attributes?.classroomId,
      className: result.Attributes?.className,
      assignmentName: result.Attributes?.assignmentName,
      joinCode: result.Attributes?.joinCode,
      studentCount: result.Attributes?.studentCount,
      status: result.Attributes?.status,
    }),
  };
}

// Simple in-memory rate limiter for join endpoint (per Lambda instance)
const joinAttempts = new Map<string, { count: number; windowStart: number }>();

function checkJoinRateLimit(sourceIp: string): void {
  const now = Math.floor(Date.now() / 1000);
  const entry = joinAttempts.get(sourceIp);
  if (entry && (now - entry.windowStart) < JOIN_RATE_LIMIT_WINDOW_SECONDS) {
    if (entry.count >= JOIN_RATE_LIMIT_MAX_ATTEMPTS) {
      throw new ValidationError('Too many join attempts. Please try again later.');
    }
    entry.count++;
  } else {
    joinAttempts.set(sourceIp, { count: 1, windowStart: now });
  }
  // Clean up old entries periodically
  if (joinAttempts.size > 1000) {
    for (const [ip, e] of joinAttempts) {
      if ((now - e.windowStart) >= JOIN_RATE_LIMIT_WINDOW_SECONDS) {
        joinAttempts.delete(ip);
      }
    }
  }
}

async function handleJoinClassroom(sourceIp: string, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  checkJoinRateLimit(sourceIp);
  const joinCode = validateJoinCode(body.joinCode);

  // Look up classroom by join code
  const classroomResult = await docClient.send(new QueryCommand({
    TableName: CLASSROOMS_TABLE,
    IndexName: 'joinCode-index',
    KeyConditionExpression: 'joinCode = :jc',
    ExpressionAttributeValues: { ':jc': joinCode },
    Limit: 1,
  }));

  if (!classroomResult.Items || classroomResult.Items.length === 0) {
    throw new NotFoundError('Invalid join code');
  }

  const classroom = classroomResult.Items[0];
  if (classroom.status !== 'active') {
    throw new NotFoundError('This classroom is no longer active');
  }

  const owningGroup = await getOwningGroup(classroom);
  const seatNumber = validateSeatNumber(body.seatNumber, seatCountFor(classroom, owningGroup));
  const nickname = validateNickname(body.nickname);
  const memberId = `seat-${String(seatNumber).padStart(2, '0')}`;

  const sessionToken = generateSessionToken();
  const now = new Date().toISOString();

  // Atomic put with condition to prevent race condition on seat assignment.
  // We allow overwriting a row that the teacher previously kicked (kicked=true)
  // so the seat opens up immediately after a kick — the tombstone is consumed
  // here. The new row deliberately omits the kick attributes; verifying the
  // old session token afterwards will fall through to the standard 401 path
  // because the row no longer matches that sessionToken in the GSI.
  try {
    await docClient.send(new PutCommand({
      TableName: MEMBERSHIPS_TABLE,
      Item: {
        classroomId: classroom.classroomId,
        memberId,
        displayName: nickname,
        role: 'student',
        sessionToken,
        joinedAt: now,
        lastActiveAt: now,
        ttl: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      },
      ConditionExpression: 'attribute_not_exists(memberId) OR kicked = :kicked',
      ExpressionAttributeValues: { ':kicked': true },
    }));
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ConditionalCheckFailedException') {
      throw new ConflictError(`Seat ${seatNumber} is already taken`);
    }
    throw err;
  }

  // Personalized recap: when the lesson belongs to a group (組), surface the
  // returned teacher comment this seat received in the most recent prior
  // lesson of the same group. Best-effort — joining must never fail on this.
  let previousComment: Record<string, unknown> | null = null;
  if (classroom.groupId) {
    try {
      const siblings = await queryAll({
        TableName: CLASSROOMS_TABLE,
        IndexName: 'teacherSub-index',
        KeyConditionExpression: 'teacherSub = :ts',
        ExpressionAttributeValues: { ':ts': classroom.teacherSub },
      });
      const prior = selectPriorClassrooms(
        siblings,
        classroom.groupId as string,
        classroom.classroomId as string,
      );
      for (const priorClassroom of prior) {
        const subResult = await docClient.send(new QueryCommand({
          TableName: SUBMISSIONS_TABLE,
          IndexName: 'classroomId-memberId-index',
          KeyConditionExpression: 'classroomId = :cid AND memberId = :mid',
          ExpressionAttributeValues: {
            ':cid': priorClassroom.classroomId,
            ':mid': memberId,
          },
          Limit: 1,
        }));
        const sub = subResult.Items?.[0];
        if (sub && sub.status === 'returned' && sub.teacherComment) {
          previousComment = {
            assignmentName: priorClassroom.assignmentName || null,
            teacherComment: sub.teacherComment,
            submittedAt: sub.submittedAt || null,
          };
          break;
        }
      }
    } catch (err) {
      console.error('previousComment lookup failed (ignored):', err);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      sessionToken,
      classroomId: classroom.classroomId,
      // Students see the class name + school year (e.g. 技術 2026年度) —
      // the owning class is authoritative so renames follow; pre-v2
      // assignments fall back to their own snapshot with no year.
      className: (owningGroup && owningGroup.name) || classroom.className,
      classYear: owningGroup && typeof owningGroup.year === 'number' ? owningGroup.year : null,
      assignmentName: classroom.assignmentName || null,
      seatNumber,
      memberId,
      hasAssignment: hasAssignmentContent(classroom),
      previousComment,
    }),
  };
}

async function handleListMembers(identity: TeacherIdentity, classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to view this classroom');
  }

  // Fetch members and submissions in parallel. Kicked rows are tombstones
  // (kicked=true) — filter them out so the teacher's seat grid sees the seat
  // as empty immediately after the kick.
  const [membersResult, submissionsResult] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      KeyConditionExpression: 'classroomId = :cid',
      FilterExpression: 'attribute_not_exists(kicked) OR kicked <> :true',
      ExpressionAttributeValues: { ':cid': classroomId, ':true': true },
    })),
    docClient.send(new QueryCommand({
      TableName: SUBMISSIONS_TABLE,
      KeyConditionExpression: 'classroomId = :cid',
      ExpressionAttributeValues: { ':cid': classroomId },
    })),
  ]);

  // Build submission map: memberId → latest submission
  const submissionMap = new Map<string, { submittedAt: string; status: string }>();
  for (const sub of (submissionsResult.Items || [])) {
    const existing = submissionMap.get(sub.memberId as string);
    if (!existing || (sub.submittedAt as string) > existing.submittedAt) {
      submissionMap.set(sub.memberId as string, {
        submittedAt: sub.submittedAt as string,
        status: sub.status as string,
      });
    }
  }

  const members = (membersResult.Items || []).map(item => {
    const submission = submissionMap.get(item.memberId as string);
    return {
      memberId: item.memberId,
      displayName: item.displayName,
      role: item.role,
      joinedAt: item.joinedAt,
      lastActiveAt: item.lastActiveAt || null,
      hasSubmission: !!submission,
      submissionStatus: submission?.status || null,
      submittedAt: submission?.submittedAt || null,
    };
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ members, studentCount: classroom.Item.studentCount }),
  };
}

async function handleDeleteClassroom(identity: TeacherIdentity, classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to delete this classroom');
  }
  if (classroom.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }

  // Soft-delete: set status to 'archived'. Memberships are deliberately kept
  // (issue #1050, D1): student access is blocked by status guards
  // (join/lookup/verify-session/submission all reject non-active classrooms),
  // and keeping the seat/nickname/session rows makes a later restore
  // (PATCH {status:'active'}) lossless — students resume without rejoining.
  await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': 'archived', ':now': new Date().toISOString() },
  }));

  return { statusCode: 204, body: '' };
}

async function handleLookupClassroom(sourceIp: string, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  checkJoinRateLimit(sourceIp);
  const joinCode = validateJoinCode(body.joinCode);

  const classroomResult = await docClient.send(new QueryCommand({
    TableName: CLASSROOMS_TABLE,
    IndexName: 'joinCode-index',
    KeyConditionExpression: 'joinCode = :jc',
    ExpressionAttributeValues: { ':jc': joinCode },
    Limit: 1,
  }));

  if (!classroomResult.Items || classroomResult.Items.length === 0) {
    throw new NotFoundError('Invalid join code');
  }

  const classroom = classroomResult.Items[0];
  if (classroom.status !== 'active') {
    throw new NotFoundError('This classroom is no longer active');
  }

  // Get taken seats. Exclude kicked tombstones so a freshly kicked seat
  // appears available immediately to a new student picking from the grid.
  const membersResult = await docClient.send(new QueryCommand({
    TableName: MEMBERSHIPS_TABLE,
    KeyConditionExpression: 'classroomId = :cid',
    FilterExpression: 'attribute_not_exists(kicked) OR kicked <> :true',
    ExpressionAttributeValues: { ':cid': classroom.classroomId, ':true': true },
    ProjectionExpression: 'memberId',
  }));

  const takenSeats = (membersResult.Items || []).map(item => {
    const match = (item.memberId as string).match(/^seat-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter(n => n > 0);

  // Active kick request IDs for the classroom. The student polls this list
  // alongside takenSeats so it can tell "the teacher rejected my request /
  // the TTL ran out" (my requestId is no longer in the list AND my target
  // seat is still occupied) from "the teacher approved" (my target seat is
  // now free). Without this round-trip, a rejected student would just watch
  // the pending banner for up to an hour.
  const kickRequestResult = await docClient.send(new QueryCommand({
    TableName: KICK_REQUESTS_TABLE,
    KeyConditionExpression: 'classroomId = :cid',
    ExpressionAttributeValues: { ':cid': classroom.classroomId },
    ProjectionExpression: 'requestId',
  }));
  const activeKickRequestIds = (kickRequestResult.Items || []).map(item => item.requestId as string);
  const lookupGroup = await getOwningGroup(classroom);

  return {
    statusCode: 200,
    body: JSON.stringify({
      classroomId: classroom.classroomId,
      className: (lookupGroup && lookupGroup.name) || classroom.className,
      classYear: lookupGroup && typeof lookupGroup.year === 'number' ? lookupGroup.year : null,
      assignmentName: classroom.assignmentName || null,
      studentCount: seatCountFor(classroom, lookupGroup),
      takenSeats,
      activeKickRequestIds,
      expiresAt: classroom.ttl ? new Date((classroom.ttl as number) * 1000).toISOString() : null,
      hasAssignment: hasAssignmentContent(classroom),
    }),
  };
}

async function handleDeleteMember(identity: TeacherIdentity, classroomId: string, memberId: string): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to modify this classroom');
  }

  // Soft-kick: mark the row as kicked instead of hard-deleting so the next
  // verify-session call can return reason='kicked'. Hard-delete would yield
  // the same 401 as a TTL expiry and the student would see a generic message.
  // The tombstone TTL is shortened to KICK_TOMBSTONE_TTL_SECONDS (1h) so we
  // don't keep dead rows around forever; the seat is freed immediately because
  // handleLookupClassroom / handleListMembers / handleJoinClassroom all treat
  // `kicked === true` as "gone".
  const seatMatch = memberId.match(/^seat-(\d+)$/);
  const seatNumber = seatMatch ? parseInt(seatMatch[1], 10) : 0;
  try {
    await docClient.send(new UpdateCommand({
      TableName: MEMBERSHIPS_TABLE,
      Key: { classroomId, memberId },
      UpdateExpression:
        'SET kicked = :true, kickedAt = :now, kickJoinCode = :jc, kickClassName = :cn, kickSeatNumber = :sn, #ttl = :ttl',
      ConditionExpression: 'attribute_exists(memberId)',
      ExpressionAttributeNames: { '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString(),
        ':jc': classroom.Item.joinCode,
        ':cn': classroom.Item.className,
        ':sn': seatNumber,
        ':ttl': Math.floor(Date.now() / 1000) + KICK_TOMBSTONE_TTL_SECONDS,
      },
    }));
  } catch (err: unknown) {
    // If the row was already gone (e.g. student left first), nothing to do.
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      err.name === 'ConditionalCheckFailedException'
    ) {
      return { statusCode: 204, body: '' };
    }
    throw err;
  }

  return { statusCode: 204, body: '' };
}

// --- Kick request handlers ---

export function validateKickRequestReason(reason: unknown): string | undefined {
  if (reason === undefined || reason === null || reason === '') return undefined;
  if (typeof reason !== 'string') {
    throw new ValidationError('Kick request reason must be a string');
  }
  const trimmed = reason.trim();
  if (trimmed.length > MAX_KICK_REQUEST_REASON_LENGTH) {
    throw new ValidationError(`Kick request reason must be ${MAX_KICK_REQUEST_REASON_LENGTH} characters or less`);
  }
  return trimmed || undefined;
}

// Lookup classroom by joinCode + ensure a non-kicked occupant exists at the
// given seat. Used by handleCreateKickRequest to refuse requests for seats
// that are already empty (so the teacher doesn't see noise from misclicks
// or stale UI). Returns the classroom row.
async function findClassroomWithSeatOccupied(
  joinCode: string,
  seatNumber: number,
): Promise<Record<string, unknown>> {
  const classroomResult = await docClient.send(new QueryCommand({
    TableName: CLASSROOMS_TABLE,
    IndexName: 'joinCode-index',
    KeyConditionExpression: 'joinCode = :jc',
    ExpressionAttributeValues: { ':jc': joinCode },
    Limit: 1,
  }));
  if (!classroomResult.Items || classroomResult.Items.length === 0) {
    throw new NotFoundError('Invalid join code');
  }
  const classroom = classroomResult.Items[0];
  if (classroom.status !== 'active') {
    throw new NotFoundError('This classroom is no longer active');
  }
  if (seatNumber < 1 || seatNumber > (classroom.studentCount as number)) {
    throw new ValidationError(`Seat number must be between 1 and ${classroom.studentCount}`);
  }
  const memberId = `seat-${String(seatNumber).padStart(2, '0')}`;
  const memberResult = await docClient.send(new GetCommand({
    TableName: MEMBERSHIPS_TABLE,
    Key: { classroomId: classroom.classroomId, memberId },
  }));
  if (!memberResult.Item || memberResult.Item.kicked === true) {
    // Seat already empty (or only holds a kick tombstone) — nothing to free up.
    throw new NotFoundError(`Seat ${seatNumber} is not currently occupied`);
  }
  return classroom;
}

async function handleCreateKickRequest(
  sourceIp: string,
  body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  // Reuse the join endpoint's IP-based rate limit — same threat model
  // (anonymous endpoint, abuse risk if open). The body fields are validated
  // independently below so we surface friendlier errors than the limit.
  checkJoinRateLimit(sourceIp);
  const joinCode = validateJoinCode(body.joinCode);
  const seatRaw = body.seatNumber;
  const seatNumber =
    typeof seatRaw === 'number' ? seatRaw : parseInt(String(seatRaw), 10);
  if (isNaN(seatNumber)) {
    throw new ValidationError('Seat number is required');
  }
  const reason = validateKickRequestReason(body.reason);
  const classroom = await findClassroomWithSeatOccupied(joinCode, seatNumber);
  if (seatNumber < 1 || seatNumber > (classroom.studentCount as number)) {
    throw new ValidationError(`Seat number must be between 1 and ${classroom.studentCount}`);
  }

  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: KICK_REQUESTS_TABLE,
    Item: {
      classroomId: classroom.classroomId,
      requestId,
      seatNumber,
      reason: reason || null,
      sourceIpHash: crypto.createHash('sha256').update(sourceIp).digest('hex').slice(0, 16),
      createdAt: now,
      ttl: Math.floor(Date.now() / 1000) + KICK_REQUEST_TTL_SECONDS,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({
      requestId,
      classroomId: classroom.classroomId,
      seatNumber,
    }),
  };
}

async function handleListKickRequests(
  identity: TeacherIdentity,
  classroomId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership: only the owning teacher may list requests.
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to view kick requests for this classroom');
  }

  const result = await docClient.send(new QueryCommand({
    TableName: KICK_REQUESTS_TABLE,
    KeyConditionExpression: 'classroomId = :cid',
    ExpressionAttributeValues: { ':cid': classroomId },
  }));
  const requests = (result.Items || []).map(item => ({
    requestId: item.requestId,
    seatNumber: item.seatNumber,
    reason: item.reason || null,
    createdAt: item.createdAt,
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ requests }),
  };
}

async function handleApproveKickRequest(
  identity: TeacherIdentity,
  classroomId: string,
  requestId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership and read the request to learn which seat to kick.
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to modify kick requests for this classroom');
  }
  const reqResult = await docClient.send(new GetCommand({
    TableName: KICK_REQUESTS_TABLE,
    Key: { classroomId, requestId },
  }));
  if (!reqResult.Item) {
    // Request already gone (TTL or someone else acted on it). Treat as success.
    return { statusCode: 204, body: '' };
  }
  const seatNumber = reqResult.Item.seatNumber as number;
  const memberId = `seat-${String(seatNumber).padStart(2, '0')}`;

  // Reuse the existing kick logic so kicked students get the same
  // 410 reason='kicked' from verify-session that a direct DELETE
  // /members/{memberId} would produce.
  await handleDeleteMember(identity, classroomId, memberId);

  // Delete all requests targeting this seat (including the approved one
  // and any duplicates the same seat may have accumulated). Otherwise
  // the teacher would see ghost rows asking to kick a seat that is now
  // empty.
  const siblings = await docClient.send(new QueryCommand({
    TableName: KICK_REQUESTS_TABLE,
    IndexName: 'classroomId-seatNumber-index',
    KeyConditionExpression: 'classroomId = :cid AND seatNumber = :sn',
    ExpressionAttributeValues: { ':cid': classroomId, ':sn': seatNumber },
    ProjectionExpression: 'requestId',
  }));
  if (siblings.Items && siblings.Items.length > 0) {
    for (let i = 0; i < siblings.Items.length; i += 25) {
      const batch = siblings.Items.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [KICK_REQUESTS_TABLE]: batch.map(item => ({
            DeleteRequest: { Key: { classroomId, requestId: item.requestId as string } },
          })),
        },
      }));
    }
  }

  return { statusCode: 204, body: '' };
}

async function handleRejectKickRequest(
  identity: TeacherIdentity,
  classroomId: string,
  requestId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to modify kick requests for this classroom');
  }
  await docClient.send(new DeleteCommand({
    TableName: KICK_REQUESTS_TABLE,
    Key: { classroomId, requestId },
  }));
  return { statusCode: 204, body: '' };
}

// --- Session Token Auth ---

export async function verifySessionToken(sessionToken: string): Promise<{ classroomId: string; memberId: string }> {
  const result = await docClient.send(new QueryCommand({
    TableName: MEMBERSHIPS_TABLE,
    IndexName: 'sessionToken-index',
    KeyConditionExpression: 'sessionToken = :st',
    ExpressionAttributeValues: { ':st': sessionToken },
    Limit: 1,
  }));

  if (!result.Items || result.Items.length === 0) {
    throw new AuthError('Invalid or expired session token');
  }

  const item = result.Items[0];
  // Surface kick tombstones as a distinct error so callers can return 410
  // with the reason. Non-verify-session callers (e.g. submission endpoints)
  // also benefit: a kicked student shouldn't be able to submit any more.
  if (item.kicked === true) {
    throw new KickedError(
      (item.kickJoinCode as string) || '',
      (item.kickClassName as string) || '',
      (item.kickSeatNumber as number) || 0,
    );
  }
  return { classroomId: item.classroomId as string, memberId: item.memberId as string };
}

// --- Submission handlers ---

export function validateProjectName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Project name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_PROJECT_NAME_LENGTH) {
    throw new ValidationError(`Project name must be ${MAX_PROJECT_NAME_LENGTH} characters or less`);
  }
  return trimmed;
}

export function validateScreenshotCount(count: unknown): number {
  const n = typeof count === 'number' ? count : parseInt(String(count), 10);
  if (isNaN(n) || n < 0) return 0;
  if (n > MAX_SCREENSHOT_COUNT) {
    throw new ValidationError(`Screenshot count must be ${MAX_SCREENSHOT_COUNT} or less`);
  }
  return n;
}

export function validateTeacherComment(comment: unknown): string {
  if (comment === undefined || comment === null) return '';
  if (typeof comment !== 'string') {
    throw new ValidationError('Comment must be a string');
  }
  const trimmed = comment.trim();
  if (trimmed.length > MAX_TEACHER_COMMENT_LENGTH) {
    throw new ValidationError(`Comment must be ${MAX_TEACHER_COMMENT_LENGTH} characters or less`);
  }
  return trimmed;
}

async function handleCreateSubmission(
  classroomId: string, memberId: string, body: Record<string, unknown>
): Promise<APIGatewayProxyStructuredResultV2> {
  const projectName = validateProjectName(body.projectName);
  const screenshotCount = validateScreenshotCount(body.screenshotCount);

  // Reject submissions to archived / expired classrooms. Memberships survive
  // an archive (issue #1050, D1), so the session token may still resolve —
  // this status guard is the actual lockout.
  const classroomResult = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroomResult.Item || classroomResult.Item.status !== 'active') {
    throw new NotFoundError('This classroom is no longer active');
  }

  // Single-submission model: find and clean up previous submission
  const prevResult = await docClient.send(new QueryCommand({
    TableName: SUBMISSIONS_TABLE,
    IndexName: 'classroomId-memberId-index',
    KeyConditionExpression: 'classroomId = :cid AND memberId = :mid',
    ExpressionAttributeValues: { ':cid': classroomId, ':mid': memberId },
    Limit: 1,
  }));
  if (prevResult.Items && prevResult.Items.length > 0) {
    const prev = prevResult.Items[0];
    const prevId = prev.submissionId as string;
    const prevScreenshots = (prev.screenshotCount as number) || 0;
    // Delete old S3 objects (best-effort)
    const deleteKeys = [
      `${classroomId}/${prevId}/project.sb3`,
      `${classroomId}/${prevId}/thumbnail.png`,
      ...Array.from({ length: prevScreenshots }, (_, i) => `${classroomId}/${prevId}/screenshot-${i}.png`),
    ];
    await Promise.allSettled(
      deleteKeys.map(key => s3Client.send(new DeleteObjectCommand({ Bucket: SUBMISSIONS_BUCKET, Key: key }))),
    );
    // Delete old DynamoDB record
    await docClient.send(new DeleteCommand({
      TableName: SUBMISSIONS_TABLE,
      Key: { classroomId, submissionId: prevId },
    }));
  }

  const submissionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const s3KeyProject = `${classroomId}/${submissionId}/project.sb3`;
  const s3KeyThumbnail = `${classroomId}/${submissionId}/thumbnail.png`;

  // Generate presigned URLs for upload
  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: SUBMISSIONS_BUCKET,
      Key: s3KeyProject,
      ContentType: 'application/octet-stream',
    }),
    { expiresIn: PRESIGNED_URL_UPLOAD_EXPIRY },
  );

  const thumbnailUploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: SUBMISSIONS_BUCKET,
      Key: s3KeyThumbnail,
      ContentType: 'image/png',
    }),
    { expiresIn: PRESIGNED_URL_UPLOAD_EXPIRY },
  );

  // Generate presigned URLs for screenshots
  const screenshotUploadUrls: string[] = [];
  for (let i = 0; i < screenshotCount; i++) {
    const ssUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: SUBMISSIONS_BUCKET,
        Key: `${classroomId}/${submissionId}/screenshot-${i}.png`,
        ContentType: 'image/png',
      }),
      { expiresIn: PRESIGNED_URL_UPLOAD_EXPIRY },
    );
    screenshotUploadUrls.push(ssUrl);
  }

  // Save submission record
  await docClient.send(new PutCommand({
    TableName: SUBMISSIONS_TABLE,
    Item: {
      classroomId,
      submissionId,
      memberId,
      projectName,
      s3Key: s3KeyProject,
      thumbnailS3Key: s3KeyThumbnail,
      screenshotCount,
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
      ttl: Math.floor(Date.now() / 1000) + SUBMISSION_TTL_SECONDS,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({
      submissionId,
      uploadUrl,
      thumbnailUploadUrl,
      screenshotUploadUrls,
      projectName,
      submittedAt: now,
    }),
  };
}

async function handleListSubmissions(
  identity: TeacherIdentity, classroomId: string
): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to view submissions');
  }

  const result = await docClient.send(new QueryCommand({
    TableName: SUBMISSIONS_TABLE,
    KeyConditionExpression: 'classroomId = :cid',
    ExpressionAttributeValues: { ':cid': classroomId },
  }));

  const submissions = await Promise.all(
    (result.Items || []).map(async item => {
      let thumbnailUrl: string | null = null;
      let projectUrl: string | null = null;
      if (item.thumbnailS3Key) {
        thumbnailUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: SUBMISSIONS_BUCKET,
            Key: item.thumbnailS3Key as string,
          }),
          { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY },
        );
      }
      if (item.s3Key) {
        projectUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: SUBMISSIONS_BUCKET,
            Key: item.s3Key as string,
          }),
          { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY },
        );
      }
      // Generate presigned URLs for screenshots
      const ssCount = typeof item.screenshotCount === 'number' ? item.screenshotCount : 0;
      const screenshotUrls: string[] = [];
      for (let i = 0; i < ssCount; i++) {
        const ssUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: SUBMISSIONS_BUCKET,
            Key: `${item.classroomId}/${item.submissionId}/screenshot-${i}.png`,
          }),
          { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY },
        );
        screenshotUrls.push(ssUrl);
      }

      return {
        submissionId: item.submissionId,
        memberId: item.memberId,
        projectName: item.projectName,
        status: item.status,
        submittedAt: item.submittedAt,
        teacherComment: item.teacherComment || null,
        thumbnailUrl,
        projectUrl,
        screenshotUrls,
      };
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ submissions }),
  };
}

async function handleUpdateSubmission(
  identity: TeacherIdentity, classroomId: string, submissionId: string, body: Record<string, unknown>
): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || !(await canManageViaGroup(classroom.Item, identity))) {
    throw new AuthError('Not authorized to update submissions');
  }

  // Verify submission exists
  const submission = await docClient.send(new GetCommand({
    TableName: SUBMISSIONS_TABLE,
    Key: { classroomId, submissionId },
  }));
  if (!submission.Item) {
    throw new ValidationError('Submission not found');
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  const exprParts: string[] = [];
  const exprNames: Record<string, string> = {};
  const exprValues: Record<string, unknown> = {};

  if (body.teacherComment !== undefined) {
    const comment = validateTeacherComment(body.teacherComment);
    updates.teacherComment = comment;
    exprParts.push('#tc = :tc');
    exprNames['#tc'] = 'teacherComment';
    exprValues[':tc'] = comment;
  }

  if (body.status !== undefined) {
    if (body.status !== 'returned') {
      throw new ValidationError('Status can only be set to "returned"');
    }
    updates.status = 'returned';
    exprParts.push('#st = :st');
    exprNames['#st'] = 'status';
    exprValues[':st'] = 'returned';
  }

  if (exprParts.length === 0) {
    throw new ValidationError('No fields to update');
  }

  exprParts.push('#ua = :ua');
  exprNames['#ua'] = 'updatedAt';
  exprValues[':ua'] = updates.updatedAt;

  await docClient.send(new UpdateCommand({
    TableName: SUBMISSIONS_TABLE,
    Key: { classroomId, submissionId },
    UpdateExpression: `SET ${exprParts.join(', ')}`,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      submissionId,
      ...updates,
    }),
  };
}

// --- Google Classroom handlers ---

async function handleListGoogleCourses(accessToken: string): Promise<APIGatewayProxyStructuredResultV2> {
  const data = await callGoogleClassroomAPI(accessToken, 'courses?teacherId=me&courseStates=ACTIVE&pageSize=100') as {
    courses?: Array<{ id: string; name: string; section?: string }>;
  };
  const courses = data.courses || [];

  // Get student count for each course (in parallel, max 10 at a time)
  const enriched = await Promise.all(
    courses.map(async (course) => {
      try {
        const students = await callGoogleClassroomAPI(accessToken, `courses/${course.id}/students?pageSize=0`) as {
          students?: unknown[];
        };
        return {
          courseId: course.id,
          name: course.name,
          section: course.section || null,
          studentCount: students.students?.length || 0,
        };
      } catch {
        return {
          courseId: course.id,
          name: course.name,
          section: course.section || null,
          studentCount: 0,
        };
      }
    }),
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ courses: enriched }),
  };
}

async function handleImportGoogleClassroom(
  identity: TeacherIdentity,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const courseId = body.courseId;
  if (typeof courseId !== 'string' || !courseId) {
    throw new ValidationError('courseId is required');
  }

  // Fetch course info
  const course = await callGoogleClassroomAPI(accessToken, `courses/${courseId}`) as {
    id: string;
    name: string;
    section?: string;
  };

  // Fetch student count
  let studentCount = 0;
  try {
    const students = await callGoogleClassroomAPI(accessToken, `courses/${courseId}/students?pageSize=100`) as {
      students?: unknown[];
    };
    studentCount = students.students?.length || 0;
  } catch {
    // If roster access fails, default to 0
  }
  if (studentCount === 0) {
    studentCount = 35; // default class size
  }
  studentCount = Math.min(studentCount, MAX_STUDENT_COUNT);

  // Generate unique join code
  let joinCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateJoinCode();
    const existing = await docClient.send(new QueryCommand({
      TableName: CLASSROOMS_TABLE,
      IndexName: 'joinCode-index',
      KeyConditionExpression: 'joinCode = :jc',
      ExpressionAttributeValues: { ':jc': candidate },
      Limit: 1,
    }));
    if (!existing.Items || existing.Items.length === 0) {
      joinCode = candidate;
      break;
    }
  }
  if (!joinCode) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate unique join code' }) };
  }

  const now = new Date().toISOString();
  const classroomId = crypto.randomUUID();
  const ttl = Math.floor(Date.now() / 1000) + CLASSROOM_TTL_SECONDS;
  const expiresAt = new Date(ttl * 1000).toISOString();

  await docClient.send(new PutCommand({
    TableName: CLASSROOMS_TABLE,
    Item: {
      classroomId,
      teacherSub: identity.sub,
      className: course.name + (course.section ? ` (${course.section})` : ''),
      joinCode,
      studentCount,
      googleClassroomCourseId: courseId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ttl,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({
      classroomId,
      className: course.name + (course.section ? ` (${course.section})` : ''),
      joinCode,
      studentCount,
      googleClassroomCourseId: courseId,
      status: 'active',
      createdAt: now,
      expiresAt,
    }),
  };
}

/**
 * Resolve the Google Classroom course an assignment should be posted to.
 *
 * v2 moved the GC link from the assignment (classroom) to the class (group),
 * so an assignment usually has no courseId of its own. The assignment's own
 * field is kept only as a pre-v2 fallback and, when present, wins. Returns an
 * empty string when neither is linked.
 */
export function resolveGoogleCourseId(
  classroomItem: Record<string, unknown> | undefined,
  groupItem: Record<string, unknown> | undefined,
): string {
  const own = classroomItem?.googleClassroomCourseId;
  if (typeof own === 'string' && own) return own;
  const group = groupItem?.googleClassroomCourseId;
  if (typeof group === 'string' && group) return group;
  return '';
}

async function handlePostAssignment(
  identity: TeacherIdentity,
  accessToken: string,
  classroomId: string,
  body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify classroom ownership and get googleClassroomCourseId
  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!result.Item || !(await canManageViaGroup(result.Item, identity))) {
    throw new NotFoundError('Classroom not found');
  }
  // v2: the GC link lives on the class (group); the assignment's own field
  // remains as a pre-v2 fallback. Only look the group up when the assignment
  // itself carries no courseId.
  let courseId = resolveGoogleCourseId(result.Item, undefined);
  if (!courseId && typeof result.Item.groupId === 'string' && result.Item.groupId) {
    const groupResult = await docClient.send(new GetCommand({
      TableName: GROUPS_TABLE,
      Key: { groupId: result.Item.groupId },
    }));
    courseId = resolveGoogleCourseId(result.Item, groupResult.Item);
  }
  if (!courseId) {
    throw new ValidationError('This classroom is not linked to Google Classroom');
  }

  const title = body.title;
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new ValidationError('Assignment title is required');
  }
  const link = body.link;
  if (typeof link !== 'string' || !link.startsWith('http')) {
    throw new ValidationError('Assignment link is required');
  }
  try {
    const linkUrl = new URL(link);
    const allowedHosts = ['smalruby.app', 'smalruby.jp', 'localhost'];
    if (!allowedHosts.some(h => linkUrl.hostname === h || linkUrl.hostname.endsWith(`.${h}`))) {
      throw new ValidationError('Assignment link must be a Smalruby URL');
    }
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    throw new ValidationError('Assignment link is not a valid URL');
  }
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  const courseWork = await callGoogleClassroomAPI(accessToken, `courses/${courseId}/courseWork`, 'POST', {
    title: title.trim(),
    description: description || undefined,
    workType: 'ASSIGNMENT',
    state: 'PUBLISHED',
    materials: [{ link: { url: link, title: 'スモウルビーで開く' } }],
  }) as { id: string; alternateLink: string };

  // Persist courseWork info to prevent duplicate posting
  await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
    UpdateExpression: 'SET googleClassroomCourseWorkId = :cwId, googleClassroomAlternateLink = :link',
    ExpressionAttributeValues: {
      ':cwId': courseWork.id,
      ':link': courseWork.alternateLink,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({
      courseWorkId: courseWork.id,
      alternateLink: courseWork.alternateLink,
    }),
  };
}

async function handleVerifySession(sessionToken: string): Promise<APIGatewayProxyStructuredResultV2> {
  // verifySessionToken throws AuthError for unknown/expired tokens and
  // KickedError when the row exists but the teacher removed the student.
  // KickedError is caught in the top-level handler and converted to a 410
  // response with reason='kicked' + joinCode/className/seatNumber so the
  // student UI can navigate back to seat selection with the right context.
  const session = await verifySessionToken(sessionToken);

  // Look up latest submission for this member, plus the classroom item so the
  // student UI knows whether assignment content exists (panel / starter
  // reload) without an extra round-trip.
  let submission: Record<string, unknown> | null = null;
  const [subResult, classroomResult] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: SUBMISSIONS_TABLE,
      IndexName: 'classroomId-memberId-index',
      KeyConditionExpression: 'classroomId = :cid AND memberId = :mid',
      ExpressionAttributeValues: {
        ':cid': session.classroomId,
        ':mid': session.memberId,
      },
      ScanIndexForward: false,
      Limit: 1,
    })),
    docClient.send(new GetCommand({
      TableName: CLASSROOMS_TABLE,
      Key: { classroomId: session.classroomId },
    })),
  ]);

  // Archived (or TTL-expired) classrooms end the session. Memberships are no
  // longer purged on archive (issue #1050, D1), so this status guard is what
  // locks students out — and what lets them resume when the teacher restores
  // the classroom. Checked before the TTL extend so dead classrooms do not
  // keep refreshing their membership rows.
  if (!classroomResult.Item || classroomResult.Item.status !== 'active') {
    throw new AuthError('This classroom is no longer active');
  }

  // Update lastActiveAt and extend TTL on each verify call
  const now = new Date().toISOString();
  await docClient.send(new UpdateCommand({
    TableName: MEMBERSHIPS_TABLE,
    Key: { classroomId: session.classroomId, memberId: session.memberId },
    UpdateExpression: 'SET lastActiveAt = :now, #ttl = :ttl',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':now': now,
      ':ttl': Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
  }));

  if (subResult.Items && subResult.Items.length > 0) {
    const item = subResult.Items[0];
    submission = {
      status: item.status,
      submittedAt: item.submittedAt,
      teacherComment: item.teacherComment || null,
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      valid: true,
      submission,
      hasAssignment: hasAssignmentContent(classroomResult.Item),
    }),
  };
}

// --- Group (組) handlers ---
// A group is the teacher-side organizing concept: one school class (組) that
// owns many lesson classrooms over the year. Students never see groups —
// their model (join code per lesson, anonymous seat) is unchanged.

export function validateGroupName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Group name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_GROUP_NAME_LENGTH) {
    throw new ValidationError(`Group name must be ${MAX_GROUP_NAME_LENGTH} characters or less`);
  }
  return trimmed;
}

export function validateGroupYear(year: unknown): number {
  const n = typeof year === 'number' ? year : parseInt(String(year), 10);
  if (isNaN(n) || n < 2000 || n > 2100) {
    throw new ValidationError('Year must be between 2000 and 2100');
  }
  return n;
}

/** Optional class section (GC-style, e.g. 2年1組). Empty/null clears it. */
export function validateSection(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError('Section must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_GROUP_NAME_LENGTH) {
    throw new ValidationError(`Section must be ${MAX_GROUP_NAME_LENGTH} characters or less`);
  }
  return trimmed;
}

export function validateTopicName(name: unknown): string {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Topic name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_TOPIC_NAME_LENGTH) {
    throw new ValidationError(`Topic name must be ${MAX_TOPIC_NAME_LENGTH} characters or less`);
  }
  return trimmed;
}

/**
 * Sort key for assignments inside a class. Meaning-free by design (teacher
 * interview): defaults to createdAt, freely editable, never shown to students.
 */
export function validateSortDate(value: unknown): string {
  if (typeof value !== 'string' || isNaN(Date.parse(value))) {
    throw new ValidationError('sortDate must be an ISO 8601 date string');
  }
  return new Date(value).toISOString();
}

/**
 * Japanese school year (April boundary) for a timestamp, evaluated in JST —
 * a lesson created 2026-01-15 belongs to school year 2025. Used to name the
 * classes auto-created by the v2 migration. Pure — exported for unit tests.
 */
export function schoolYearFromIso(iso: string): number {
  const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const month = jst.getUTCMonth() + 1;
  return month >= 4 ? jst.getUTCFullYear() : jst.getUTCFullYear() - 1;
}

export interface GroupMigrationPlan {
  /** Classes to auto-create, keyed so assignments can reference them before IDs exist. */
  createGroups: { key: string; name: string; year: number }[];
  /** groupKey is either an existing groupId or a createGroups key. */
  assignments: { classroomId: string; groupKey: string }[];
  /** Field lifts + schemaVersion stamp per group (existing id or create key). */
  groupUpdates: { groupKey: string; set: Record<string, unknown> }[];
}

/**
 * Plan the v1→v2 migration for one teacher: adopt ungrouped assignments into
 * classes auto-created per className (school year estimated from creation
 * date), then lift assignment-level GC courseId (earliest wins) /
 * co-teachers (union) / studentCount (max) up to each class. Idempotent by
 * construction: a second run finds nothing ungrouped and produces lifts that
 * only stamp schemaVersion. Pure — exported for unit tests.
 */
export function planGroupMigration(
  classrooms: Record<string, unknown>[],
  groups: Record<string, unknown>[],
): GroupMigrationPlan {
  const active = classrooms.filter(c => c.status === 'active');
  const createGroups: GroupMigrationPlan['createGroups'] = [];
  const assignments: GroupMigrationPlan['assignments'] = [];
  const groupKeyByClassroomId = new Map<string, string>();

  for (const classroom of active) {
    if (typeof classroom.groupId === 'string' && classroom.groupId) {
      groupKeyByClassroomId.set(String(classroom.classroomId), classroom.groupId);
      continue;
    }
    const name = String(classroom.className || '');
    const year = schoolYearFromIso(String(classroom.createdAt || new Date(0).toISOString()));
    // Prefer an existing class with the same name (same year first, else the
    // newest) so a teacher's manual class is reused instead of duplicated.
    const sameName = groups.filter(g => g.name === name && g.status === 'active');
    const existing = sameName.find(g => g.year === year)
      || sameName.sort((a, b) => Number(b.year || 0) - Number(a.year || 0))[0];
    let groupKey: string;
    if (existing) {
      groupKey = String(existing.groupId);
    } else {
      groupKey = `new:${name}:${year}`;
      if (!createGroups.some(g => g.key === groupKey)) {
        createGroups.push({ key: groupKey, name, year });
      }
    }
    assignments.push({ classroomId: String(classroom.classroomId), groupKey });
    groupKeyByClassroomId.set(String(classroom.classroomId), groupKey);
  }

  // Lift assignment-level fields up to each class (including classes that
  // gain no new assignments — they still need the schemaVersion stamp).
  const allKeys = new Set<string>([
    ...groups.map(g => String(g.groupId)),
    ...createGroups.map(g => g.key),
  ]);
  const groupUpdates: GroupMigrationPlan['groupUpdates'] = [];
  for (const groupKey of allKeys) {
    const existing = groups.find(g => String(g.groupId) === groupKey);
    const members = active
      .filter(c => groupKeyByClassroomId.get(String(c.classroomId)) === groupKey)
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const set: Record<string, unknown> = {};
    if (!existing || existing.schemaVersion !== CLASSROOM_SCHEMA_VERSION) {
      set.schemaVersion = CLASSROOM_SCHEMA_VERSION;
    }
    if (!(existing && existing.googleClassroomCourseId)) {
      const withCourse = members.find(c => c.googleClassroomCourseId);
      if (withCourse) {
        set.googleClassroomCourseId = withCourse.googleClassroomCourseId;
      }
    }
    const emailUnion = new Set<string>(
      existing && Array.isArray(existing.coTeacherEmails) ? (existing.coTeacherEmails as string[]) : [],
    );
    const before = emailUnion.size;
    for (const c of members) {
      for (const email of (Array.isArray(c.coTeacherEmails) ? (c.coTeacherEmails as string[]) : [])) {
        emailUnion.add(email);
      }
    }
    if (emailUnion.size > before) {
      set.coTeacherEmails = [...emailUnion];
    }
    const maxCount = Math.max(
      existing && typeof existing.studentCount === 'number' ? existing.studentCount : 0,
      ...members.map(c => (typeof c.studentCount === 'number' ? c.studentCount : 0)),
    );
    const existingCount = existing && typeof existing.studentCount === 'number' ? existing.studentCount : 0;
    if (maxCount > 0 && maxCount !== existingCount) {
      set.studentCount = maxCount;
    }
    if (Object.keys(set).length > 0) {
      groupUpdates.push({ groupKey, set });
    }
  }

  return { createGroups, assignments, groupUpdates };
}

/**
 * Sort prior lessons of a group (excluding the one being joined) newest
 * first, capped to the recap lookback. Pure — exported for unit tests.
 */
export function selectPriorClassrooms(
  items: Record<string, unknown>[],
  groupId: string,
  excludeClassroomId: string,
  limit: number = PREVIOUS_COMMENT_LOOKBACK,
): Record<string, unknown>[] {
  return items
    .filter(item => item.groupId === groupId && item.classroomId !== excludeClassroomId && item.status === 'active')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);
}

/**
 * Rewrite assignment S3 keys from the source classroom prefix to the
 * duplicated classroom's prefix. Pure — exported for unit tests.
 * @returns the new assignment plus the list of {from, to} copies to perform
 */
export function buildDuplicatedAssignment(
  assignment: AssignmentContent | undefined,
  sourceClassroomId: string,
  newClassroomId: string,
): { assignment: AssignmentContent | undefined; copies: { from: string; to: string }[] } {
  if (!assignment || ((!assignment.pages || assignment.pages.length === 0) && !assignment.starterKey)) {
    return { assignment: undefined, copies: [] };
  }
  const copies: { from: string; to: string }[] = [];
  const rewriteKey = (key: string): string => {
    const to = `${newClassroomId}/assignment/${key.split('/').pop()}`;
    copies.push({ from: key, to });
    return to;
  };
  const pages = (assignment.pages || []).map(page =>
    page.imageKey ? { text: page.text, imageKey: rewriteKey(page.imageKey) } : { text: page.text },
  );
  const starterKey = assignment.starterKey ? rewriteKey(assignment.starterKey) : undefined;
  return {
    assignment: { pages, starterKey, updatedAt: new Date().toISOString() },
    copies,
  };
}

/**
 * Decide which topic (if any) the target class must list before a duplicated
 * classroom lands in it. Reuse carries the source topic along, but a topic is
 * only meaningful when the copy is filed under a target group — an ungrouped
 * duplicate has nowhere to register it. Returns the topic to ensure, or
 * undefined when there is nothing to add.
 */
export function topicToEnsureForDuplicate(
  source: Record<string, unknown>,
  groupId: string | undefined,
): string | undefined {
  const topic = typeof source.topic === 'string' && source.topic ? source.topic : undefined;
  return topic && groupId ? topic : undefined;
}

/**
 * Fetch a class (group) and assert the teacher may manage it — its owner or a
 * class-level co-teacher (issue #1138). Teachers with no relationship to the
 * class still get the existence-hiding 404, same policy as classrooms.
 */
async function getManageableGroup(identity: TeacherIdentity, groupId: string): Promise<Record<string, unknown>> {
  const result = await docClient.send(new GetCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
  }));
  if (!canManageGroup(result.Item, identity)) {
    // Existence-hiding 404, same policy as classrooms.
    throw new NotFoundError('Group not found');
  }
  return result.Item as Record<string, unknown>;
}

/**
 * Add a topic to the class's list when an assignment starts using it (the
 * dropdown's "create new topic" path). No-op when already present.
 */
async function ensureGroupTopic(
  groupId: string,
  group: Record<string, unknown> | undefined,
  topic: string,
): Promise<void> {
  let topics: string[];
  if (group && Array.isArray(group.topics)) {
    topics = group.topics as string[];
  } else {
    const result = await docClient.send(new GetCommand({ TableName: GROUPS_TABLE, Key: { groupId } }));
    topics = result.Item && Array.isArray(result.Item.topics) ? (result.Item.topics as string[]) : [];
  }
  if (topics.includes(topic)) {
    return;
  }
  if (topics.length >= MAX_TOPICS_PER_CLASS) {
    throw new ValidationError(`A class can have at most ${MAX_TOPICS_PER_CLASS} topics`);
  }
  await docClient.send(new UpdateCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
    UpdateExpression: 'SET topics = :topics, updatedAt = :now',
    ExpressionAttributeValues: { ':topics': [...topics, topic], ':now': new Date().toISOString() },
  }));
}

function mapGroupSummary(item: Record<string, unknown>) {
  return {
    groupId: item.groupId,
    name: item.name,
    year: item.year,
    status: item.status,
    section: item.section || null,
    schemaVersion: typeof item.schemaVersion === 'number' ? item.schemaVersion : 1,
    topics: Array.isArray(item.topics) ? item.topics : [],
    googleClassroomCourseId: item.googleClassroomCourseId || null,
    studentCount: typeof item.studentCount === 'number' ? item.studentCount : null,
    coTeacherEmails: readCoTeacherEmails(item),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function handleCreateGroup(identity: TeacherIdentity, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  const name = validateGroupName(body.name);
  const year = validateGroupYear(body.year);

  const now = new Date().toISOString();
  const groupId = crypto.randomUUID();
  const item: Record<string, unknown> = {
    groupId,
    teacherSub: identity.sub,
    name,
    year,
    status: 'active',
    schemaVersion: CLASSROOM_SCHEMA_VERSION,
    topics: [],
    createdAt: now,
    updatedAt: now,
    ttl: Math.floor(Date.now() / 1000) + GROUP_TTL_SECONDS,
  };
  if (body.studentCount !== undefined) {
    item.studentCount = validateStudentCount(body.studentCount);
  }
  if (body.section !== undefined) {
    const section = validateSection(body.section);
    if (section) {
      item.section = section;
    }
  }
  if (typeof body.googleClassroomCourseId === 'string' && body.googleClassroomCourseId.trim()) {
    item.googleClassroomCourseId = body.googleClassroomCourseId.trim();
  }
  await docClient.send(new PutCommand({ TableName: GROUPS_TABLE, Item: item }));

  return { statusCode: 201, body: JSON.stringify(mapGroupSummary(item)) };
}

async function handleListGroups(identity: TeacherIdentity): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await queryAll({
    TableName: GROUPS_TABLE,
    IndexName: 'teacherSub-index',
    KeyConditionExpression: 'teacherSub = :ts',
    ExpressionAttributeValues: { ':ts': identity.sub },
  });
  const coManaged = await listCoManagedGroups(identity);
  const groups = [...result, ...coManaged].map(item => ({
    ...mapGroupSummary(item),
    role: item.teacherSub === identity.sub ? 'owner' : 'co-teacher',
  }));
  return { statusCode: 200, body: JSON.stringify({ groups }) };
}

async function handleUpdateGroup(identity: TeacherIdentity, groupId: string, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  const group = await getManageableGroup(identity, groupId);
  // A class co-teacher works inside the class like its owner, but the
  // membership list itself stays owner-only — otherwise a co-teacher could
  // invite others or remove themselves out of the owner's control (#1138).
  if (body.coTeacherEmails !== undefined && group.teacherSub !== identity.sub) {
    throw new AuthError('Only the class owner can change the co-teacher list');
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) {
    updates.name = validateGroupName(body.name);
  }
  if (body.year !== undefined) {
    updates.year = validateGroupYear(body.year);
  }
  if (body.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'archived') {
      throw new ValidationError('Status must be "active" or "archived"');
    }
    updates.status = body.status;
  }
  if (body.studentCount !== undefined) {
    updates.studentCount = validateStudentCount(body.studentCount);
  }
  if (body.section !== undefined) {
    updates.section = validateSection(body.section);
  }
  if (body.googleClassroomCourseId !== undefined) {
    if (body.googleClassroomCourseId === null || body.googleClassroomCourseId === '') {
      updates.googleClassroomCourseId = null;
    } else if (typeof body.googleClassroomCourseId === 'string') {
      updates.googleClassroomCourseId = body.googleClassroomCourseId.trim();
    } else {
      throw new ValidationError('googleClassroomCourseId must be a string or null');
    }
  }
  if (body.coTeacherEmails !== undefined) {
    if (!Array.isArray(body.coTeacherEmails)) {
      throw new ValidationError('coTeacherEmails must be an array');
    }
    updates.coTeacherEmails = [...new Set(body.coTeacherEmails.map(validateCoTeacherEmail))];
  }

  const expressionParts: string[] = [];
  const expressionValues: Record<string, unknown> = {};
  const expressionNames: Record<string, string> = {};
  let i = 0;
  for (const [key, value] of Object.entries(updates)) {
    expressionNames[`#attr${i}`] = key;
    expressionValues[`:val${i}`] = value;
    expressionParts.push(`#attr${i} = :val${i}`);
    i++;
  }
  const result = await docClient.send(new UpdateCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  }));

  // The class's studentCount is authoritative, so a change must flow down to
  // its existing assignments (classrooms) — otherwise growing/shrinking the
  // class leaves old assignments on their creation-time snapshot. Increasing
  // adds seats (safe); decreasing drops seats — the teacher UI warns first
  // that submissions on the removed seats stop showing.
  if (updates.studentCount !== undefined) {
    await propagateStudentCountToClassrooms(
      String((result.Attributes as Record<string, unknown>)?.teacherSub ?? identity.sub),
      groupId,
      updates.studentCount as number,
    );
  }

  return { statusCode: 200, body: JSON.stringify(mapGroupSummary(result.Attributes || {})) };
}

/**
 * Set every active classroom (assignment) in a class to the class's new seat
 * count. Enumerates via teacherSub-index + a groupId filter (no groupId GSI on
 * the classrooms table), the same pattern topic cascades use.
 * @param teacherSub - owning teacher (partition key of teacherSub-index)
 * @param groupId - the class whose assignments to update
 * @param studentCount - the new seat count to write
 */
async function propagateStudentCountToClassrooms(
  teacherSub: string, groupId: string, studentCount: number,
): Promise<void> {
  const now = new Date().toISOString();
  // Paginated: the 1MB cap applies before the groupId filter, so a truncated
  // read would leave some assignments in the class on the old seat count.
  const result = await queryAll({
    TableName: CLASSROOMS_TABLE,
    IndexName: 'teacherSub-index',
    KeyConditionExpression: 'teacherSub = :ts',
    FilterExpression: 'groupId = :gid AND #status = :active',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':ts': teacherSub, ':gid': groupId, ':active': 'active' },
  });
  for (const item of result) {
    await docClient.send(new UpdateCommand({
      TableName: CLASSROOMS_TABLE,
      Key: { classroomId: item.classroomId },
      UpdateExpression: 'SET studentCount = :sc, updatedAt = :now',
      ExpressionAttributeValues: { ':sc': studentCount, ':now': now },
    }));
  }
}

/**
 * One-time (but idempotent) v1→v2 bulk migration for the calling teacher.
 * Runs the pure plan against the teacher's classrooms + groups, then executes
 * it: create classes, adopt ungrouped assignments, lift class-level fields.
 * Safe to call on every class-list view — a fully migrated account produces
 * an empty plan.
 */
async function handleMigrateGroups(identity: TeacherIdentity): Promise<APIGatewayProxyStructuredResultV2> {
  // Paginated: the plan drives writes (create classes, adopt assignments), so
  // a truncated read would silently leave part of the account unmigrated.
  const [classroomsResult, groupsResult] = await Promise.all([
    queryAll({
      TableName: CLASSROOMS_TABLE,
      IndexName: 'teacherSub-index',
      KeyConditionExpression: 'teacherSub = :ts',
      ExpressionAttributeValues: { ':ts': identity.sub },
    }),
    queryAll({
      TableName: GROUPS_TABLE,
      IndexName: 'teacherSub-index',
      KeyConditionExpression: 'teacherSub = :ts',
      ExpressionAttributeValues: { ':ts': identity.sub },
    }),
  ]);
  const plan = planGroupMigration(classroomsResult, groupsResult);

  const now = new Date().toISOString();
  const groupIdByKey = new Map<string, string>();
  for (const create of plan.createGroups) {
    const groupId = crypto.randomUUID();
    groupIdByKey.set(create.key, groupId);
    await docClient.send(new PutCommand({
      TableName: GROUPS_TABLE,
      Item: {
        groupId,
        teacherSub: identity.sub,
        name: create.name,
        year: create.year,
        status: 'active',
        schemaVersion: CLASSROOM_SCHEMA_VERSION,
        topics: [],
        createdAt: now,
        updatedAt: now,
        ttl: Math.floor(Date.now() / 1000) + GROUP_TTL_SECONDS,
      },
    }));
  }
  const resolveKey = (key: string): string => groupIdByKey.get(key) || key;

  for (const assign of plan.assignments) {
    await docClient.send(new UpdateCommand({
      TableName: CLASSROOMS_TABLE,
      Key: { classroomId: assign.classroomId },
      UpdateExpression: 'SET groupId = :gid, updatedAt = :now',
      ExpressionAttributeValues: { ':gid': resolveKey(assign.groupKey), ':now': now },
    }));
  }

  for (const update of plan.groupUpdates) {
    const groupId = resolveKey(update.groupKey);
    // Freshly created groups already carry the v2 shape; skip pure stamps.
    if (groupIdByKey.has(update.groupKey)) {
      const rest = { ...update.set };
      delete rest.schemaVersion;
      if (Object.keys(rest).length === 0) continue;
    }
    const parts: string[] = ['updatedAt = :now'];
    const values: Record<string, unknown> = { ':now': now };
    const names: Record<string, string> = {};
    let i = 0;
    for (const [key, value] of Object.entries(update.set)) {
      names[`#m${i}`] = key;
      values[`:m${i}`] = value;
      parts.push(`#m${i} = :m${i}`);
      i++;
    }
    await docClient.send(new UpdateCommand({
      TableName: GROUPS_TABLE,
      Key: { groupId },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
      ExpressionAttributeValues: values,
    }));
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      createdGroups: plan.createGroups.length,
      assignedClassrooms: plan.assignments.length,
      updatedGroups: plan.groupUpdates.length,
      schemaVersion: CLASSROOM_SCHEMA_VERSION,
    }),
  };
}

/**
 * Manage the class's topic list. Renaming (and removing) a topic cascades to
 * the assignments inside the class so their topic strings never dangle
 * (teacher interview: rename must follow through).
 */
async function handleUpdateGroupTopics(
  identity: TeacherIdentity, groupId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const group = await getManageableGroup(identity, groupId);
  const topics: string[] = Array.isArray(group.topics) ? [...(group.topics as string[])] : [];
  const action = body.action;
  const now = new Date().toISOString();

  // Enumerated by groupId, not by the class owner's teacherSub: a class
  // co-teacher can file assignments in this class too (#1138) and those rows
  // carry their own teacherSub, so keying off the owner would leave them
  // pointing at a topic the class no longer has.
  const cascadeAssignments = async (fromTopic: string, toTopic: string | null): Promise<void> => {
    const targets = (await listAssignmentsInGroups([groupId]))
      .filter(assignment => assignment.topic === fromTopic);
    for (const item of targets) {
      await docClient.send(new UpdateCommand({
        TableName: CLASSROOMS_TABLE,
        Key: { classroomId: item.classroomId },
        UpdateExpression: toTopic === null
          ? 'REMOVE topic SET updatedAt = :now'
          : 'SET topic = :to, updatedAt = :now',
        ExpressionAttributeValues: toTopic === null ? { ':now': now } : { ':to': toTopic, ':now': now },
      }));
    }
  };

  if (action === 'add') {
    const name = validateTopicName(body.name);
    if (!topics.includes(name)) {
      if (topics.length >= MAX_TOPICS_PER_CLASS) {
        throw new ValidationError(`A class can have at most ${MAX_TOPICS_PER_CLASS} topics`);
      }
      topics.push(name);
    }
  } else if (action === 'remove') {
    const name = validateTopicName(body.name);
    const index = topics.indexOf(name);
    if (index >= 0) {
      topics.splice(index, 1);
      await cascadeAssignments(name, null);
    }
  } else if (action === 'rename') {
    const from = validateTopicName(body.name);
    const to = validateTopicName(body.to);
    const index = topics.indexOf(from);
    if (index < 0) {
      throw new NotFoundError('Topic not found');
    }
    if (topics.includes(to)) {
      throw new ValidationError('A topic with the new name already exists');
    }
    topics[index] = to;
    await cascadeAssignments(from, to);
  } else {
    throw new ValidationError('action must be "add", "remove", or "rename"');
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: GROUPS_TABLE,
    Key: { groupId },
    UpdateExpression: 'SET topics = :topics, updatedAt = :now',
    ExpressionAttributeValues: { ':topics': topics, ':now': now },
    ReturnValues: 'ALL_NEW',
  }));
  return { statusCode: 200, body: JSON.stringify(mapGroupSummary(result.Attributes || {})) };
}

/**
 * Duplicate a classroom (lesson) — className/assignmentName/studentCount and
 * the assignment content (pages + starter, S3 objects copied) — into the
 * same or another group, with a fresh join code and no members/submissions.
 * This is how a teacher reuses a lesson for another 組 or the next year.
 */
async function handleDuplicateClassroom(
  identity: TeacherIdentity, classroomId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const sourceResult = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!sourceResult.Item || sourceResult.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }
  const source = sourceResult.Item;
  if (!(await canManageViaGroup(source, identity))) {
    throw new AuthError('Not authorized to duplicate this classroom');
  }

  // Optional target group (defaults to no group; duplicating keeps things
  // explicit rather than silently inheriting the source group).
  let groupId: string | undefined;
  if (typeof body.groupId === 'string' && body.groupId) {
    await getManageableGroup(identity, body.groupId);
    groupId = body.groupId;
  }

  const className = body.className !== undefined ? validateClassName(body.className) : (source.className as string);
  const assignmentName = body.assignmentName !== undefined
    ? validateClassName(body.assignmentName)
    : (source.assignmentName as string);

  // Fresh unique join code (same retry policy as creation).
  let joinCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateJoinCode();
    const existing = await docClient.send(new QueryCommand({
      TableName: CLASSROOMS_TABLE,
      IndexName: 'joinCode-index',
      KeyConditionExpression: 'joinCode = :jc',
      ExpressionAttributeValues: { ':jc': candidate },
      Limit: 1,
    }));
    if (!existing.Items || existing.Items.length === 0) {
      joinCode = candidate;
      break;
    }
  }
  if (!joinCode) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate unique join code' }) };
  }

  const newClassroomId = crypto.randomUUID();
  const { assignment, copies } = buildDuplicatedAssignment(
    source.assignment as AssignmentContent | undefined,
    classroomId,
    newClassroomId,
  );

  // Copy assignment objects first so the new record never references
  // missing objects. A failed copy aborts the duplication (502 from S3).
  for (const { from, to } of copies) {
    await s3Client.send(new CopyObjectCommand({
      Bucket: SUBMISSIONS_BUCKET,
      CopySource: `${SUBMISSIONS_BUCKET}/${encodeURIComponent(from)}`,
      Key: to,
    }));
  }

  // Reuse carries the topic along; make sure the target class lists it so
  // the assignment lands in a visible section (cross-class reuse included).
  const topic = typeof source.topic === 'string' && source.topic ? source.topic : undefined;
  const topicToEnsure = topicToEnsureForDuplicate(source, groupId);
  if (topicToEnsure) {
    await ensureGroupTopic(groupId as string, undefined, topicToEnsure);
  }

  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + CLASSROOM_TTL_SECONDS;
  await docClient.send(new PutCommand({
    TableName: CLASSROOMS_TABLE,
    Item: {
      classroomId: newClassroomId,
      teacherSub: identity.sub,
      className,
      assignmentName,
      joinCode,
      studentCount: source.studentCount,
      groupId,
      topic,
      sortDate: now,
      assignment,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ttl,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({
      classroomId: newClassroomId,
      className,
      assignmentName,
      joinCode,
      studentCount: source.studentCount,
      groupId: groupId || null,
      topic: topic || null,
      sortDate: now,
      hasAssignment: !!assignment,
      status: 'active',
      createdAt: now,
      expiresAt: new Date(ttl * 1000).toISOString(),
    }),
  };
}

// --- Assignment content handlers ---
// A classroom may carry assignment content: pages of (short text + optional
// image) plus an optional starter project. The teacher edits it; students
// read it after joining so the lesson starts without manual file
// distribution.

/** An assignment page as stored in DynamoDB. */
interface AssignmentPage {
  text: string;
  imageKey?: string;
}

interface AssignmentContent {
  pages?: AssignmentPage[];
  starterKey?: string;
  updatedAt?: string;
}

/**
 * Validate the `pages` array of a set-assignment request. Each page carries a
 * short text and optionally either an existing `imageKey` (kept as-is; must
 * belong to this classroom's assignment prefix) or `newImage` (a MIME type
 * from ASSIGNMENT_IMAGE_CONTENT_TYPES requesting a fresh upload URL).
 */
export function validateAssignmentPages(
  pages: unknown,
  classroomId: string,
): { text: string; imageKey?: string; newImage?: string }[] {
  if (pages === undefined || pages === null) return [];
  if (!Array.isArray(pages)) {
    throw new ValidationError('pages must be an array');
  }
  if (pages.length > MAX_ASSIGNMENT_PAGES) {
    throw new ValidationError(`Assignment may have at most ${MAX_ASSIGNMENT_PAGES} pages`);
  }
  return pages.map((page, i) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      throw new ValidationError(`pages[${i}] must be an object`);
    }
    const { text, imageKey, newImage } = page as Record<string, unknown>;
    if (typeof text !== 'string') {
      throw new ValidationError(`pages[${i}].text is required`);
    }
    if (text.length > MAX_ASSIGNMENT_PAGE_TEXT_LENGTH) {
      throw new ValidationError(`pages[${i}].text must be ${MAX_ASSIGNMENT_PAGE_TEXT_LENGTH} characters or less`);
    }
    if (imageKey !== undefined && newImage !== undefined) {
      throw new ValidationError(`pages[${i}] cannot have both imageKey and newImage`);
    }
    if (imageKey !== undefined) {
      if (typeof imageKey !== 'string' || !imageKey.startsWith(`${classroomId}/assignment/`)) {
        throw new ValidationError(`pages[${i}].imageKey does not belong to this classroom`);
      }
      return { text, imageKey };
    }
    if (newImage !== undefined) {
      if (typeof newImage !== 'string' || !ASSIGNMENT_IMAGE_CONTENT_TYPES[newImage]) {
        throw new ValidationError(
          `pages[${i}].newImage must be one of: ${Object.keys(ASSIGNMENT_IMAGE_CONTENT_TYPES).join(', ')}`,
        );
      }
      return { text, newImage };
    }
    return { text };
  });
}

/** Whether a classroom item carries assignment content (pages or a starter). */
export function hasAssignmentContent(item: Record<string, unknown> | undefined): boolean {
  if (!item) return false;
  const assignment = item.assignment as AssignmentContent | undefined;
  if (!assignment) return false;
  return (Array.isArray(assignment.pages) && assignment.pages.length > 0) || !!assignment.starterKey;
}

async function handleSetAssignment(
  identity: TeacherIdentity, classroomId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const classroomResult = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroomResult.Item || classroomResult.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }
  if (!(await canManageViaGroup(classroomResult.Item, identity))) {
    throw new AuthError('Not authorized to edit this classroom');
  }

  const pagesInput = validateAssignmentPages(body.pages, classroomId);
  const keepStarter = body.keepStarter === true;
  const newStarter = body.newStarter === true;
  if (keepStarter && newStarter) {
    throw new ValidationError('keepStarter and newStarter are mutually exclusive');
  }

  const existing = (classroomResult.Item.assignment || {}) as AssignmentContent;

  let starterKey: string | undefined;
  let starterUploadUrl: string | null = null;
  if (newStarter) {
    // Fresh key per upload so an edited starter never fights browser caches
    // and a failed upload never corrupts the previous one.
    starterKey = `${classroomId}/assignment/starter-${crypto.randomUUID()}.sb3`;
    starterUploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: SUBMISSIONS_BUCKET,
        Key: starterKey,
        ContentType: 'application/octet-stream',
      }),
      { expiresIn: PRESIGNED_URL_UPLOAD_EXPIRY },
    );
  } else if (keepStarter) {
    if (!existing.starterKey) {
      throw new ValidationError('No existing starter project to keep');
    }
    starterKey = existing.starterKey;
  }

  const pages: AssignmentPage[] = [];
  const imageUploadUrls: (string | null)[] = [];
  for (const page of pagesInput) {
    if (page.newImage) {
      const ext = ASSIGNMENT_IMAGE_CONTENT_TYPES[page.newImage];
      const imageKey = `${classroomId}/assignment/image-${crypto.randomUUID()}.${ext}`;
      const url = await getSignedUrl(
        s3Client,
        new PutObjectCommand({ Bucket: SUBMISSIONS_BUCKET, Key: imageKey, ContentType: page.newImage }),
        { expiresIn: PRESIGNED_URL_UPLOAD_EXPIRY },
      );
      pages.push({ text: page.text, imageKey });
      imageUploadUrls.push(url);
    } else {
      pages.push(page.imageKey ? { text: page.text, imageKey: page.imageKey } : { text: page.text });
      imageUploadUrls.push(null);
    }
  }

  // Best-effort cleanup of replaced objects (same pattern as re-submission):
  // previously stored assignment objects no longer referenced get deleted.
  const keptKeys = new Set<string>([
    ...pages.map(p => p.imageKey).filter((k): k is string => !!k),
    ...(starterKey ? [starterKey] : []),
  ]);
  const orphanedKeys = [
    ...(existing.pages || []).map(p => p.imageKey).filter((k): k is string => !!k),
    ...(existing.starterKey ? [existing.starterKey] : []),
  ].filter(key => !keptKeys.has(key));
  if (orphanedKeys.length > 0) {
    await Promise.allSettled(
      orphanedKeys.map(key => s3Client.send(new DeleteObjectCommand({ Bucket: SUBMISSIONS_BUCKET, Key: key }))),
    );
  }

  const now = new Date().toISOString();
  if (pages.length === 0 && !starterKey) {
    // An empty request clears the assignment entirely.
    await docClient.send(new UpdateCommand({
      TableName: CLASSROOMS_TABLE,
      Key: { classroomId },
      UpdateExpression: 'REMOVE assignment SET updatedAt = :now',
      ExpressionAttributeValues: { ':now': now },
    }));
    return { statusCode: 200, body: JSON.stringify({ assignment: null }) };
  }

  await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
    UpdateExpression: 'SET assignment = :assignment, updatedAt = :now',
    ExpressionAttributeValues: {
      ':assignment': { pages, starterKey, updatedAt: now },
      ':now': now,
    },
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({
      assignment: { pages, starterKey: starterKey || null, updatedAt: now },
      imageUploadUrls,
      starterUploadUrl,
    }),
  };
}

/**
 * Read the assignment content with download URLs. Dual-auth: students use
 * their opaque session token (UUID — no dots) and may only read their own
 * classroom's assignment; teachers use a JWT ID token (contains dots) and
 * must pass canManageClassroom. The DEV_BYPASS_TOKEN is opaque too, so it is
 * routed to the teacher path explicitly.
 */
async function handleGetAssignment(rawToken: string, classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  const classroomResult = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroomResult.Item || classroomResult.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }

  const isDevBypass = DEV_BYPASS_TOKEN !== '' && rawToken === DEV_BYPASS_TOKEN && STAGE !== 'prod';
  if (isDevBypass || rawToken.includes('.')) {
    const identity = await verifyTeacherIdToken(rawToken);
    if (!(await canManageViaGroup(classroomResult.Item, identity))) {
      throw new AuthError('Not authorized to view this classroom');
    }
  } else {
    const session = await verifySessionToken(rawToken);
    if (session.classroomId !== classroomId) {
      throw new AuthError('Session does not match this classroom');
    }
  }

  const assignment = classroomResult.Item.assignment as AssignmentContent | undefined;
  if (!hasAssignmentContent(classroomResult.Item)) {
    return { statusCode: 200, body: JSON.stringify({ assignment: null }) };
  }

  // imageKey is echoed back so the teacher editor can round-trip unchanged
  // pages ({imageKey} instead of re-uploading) on the next PUT.
  const pages = await Promise.all((assignment?.pages || []).map(async page => {
    let imageUrl: string | null = null;
    if (page.imageKey) {
      imageUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: SUBMISSIONS_BUCKET, Key: page.imageKey }),
        { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY },
      );
    }
    return { text: page.text, imageKey: page.imageKey || null, imageUrl };
  }));

  let starterUrl: string | null = null;
  if (assignment?.starterKey) {
    starterUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: SUBMISSIONS_BUCKET, Key: assignment.starterKey }),
      { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY },
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      assignment: {
        pages,
        starterKey: assignment?.starterKey || null,
        starterUrl,
        updatedAt: assignment?.updatedAt || null,
      },
    }),
  };
}

// --- AI evaluation handlers ---
// Grade proposals / positive comment drafts from static-analysis results.
// The AI is a proposal engine, never the grader: every result carries a
// reason quoting machine signals, an explicit needsReview flag, and the
// teacher confirms everything in the UI before anything is recorded.

interface EvalSubmission {
  seatNumber: number;
  signals: Record<string, unknown>;
  pseudocode: string;
}

interface EvalRubricAxis {
  name: string;
  description: string;
}

interface EvalSample {
  seatNumber: number;
  grade: string;
  reason?: string;
}

interface EvaluateRequest {
  mode: 'grade' | 'comment';
  assignmentName: string;
  assignmentText: string;
  rubricAxes: EvalRubricAxis[];
  strictness: 'lenient' | 'standard' | 'strict';
  samples: EvalSample[];
  submissions: EvalSubmission[];
}

/**
 * Validate + normalize an evaluate request body. Exported for unit tests.
 */
export function validateEvaluateRequest(body: Record<string, unknown>): EvaluateRequest {
  const mode = body.mode === 'comment' ? 'comment' : body.mode === 'grade' ? 'grade' : null;
  if (!mode) throw new ValidationError('mode must be "grade" or "comment"');

  const assignmentName = typeof body.assignmentName === 'string' ? body.assignmentName.slice(0, 100) : '';
  const assignmentText = typeof body.assignmentText === 'string' ? body.assignmentText.slice(0, 3000) : '';

  const rawAxes = Array.isArray(body.rubricAxes) ? body.rubricAxes : [];
  if (mode === 'grade' && (rawAxes.length < 1 || rawAxes.length > 6)) {
    throw new ValidationError('rubricAxes must have 1 to 6 entries');
  }
  const rubricAxes: EvalRubricAxis[] = rawAxes.map((axis, i) => {
    const a = axis as Record<string, unknown>;
    if (typeof a?.name !== 'string' || a.name.trim().length === 0) {
      throw new ValidationError(`rubricAxes[${i}].name is required`);
    }
    return {
      name: String(a.name).slice(0, 50),
      description: typeof a.description === 'string' ? a.description.slice(0, 300) : '',
    };
  });

  const strictness =
    body.strictness === 'lenient' || body.strictness === 'strict' ? body.strictness : 'standard';

  const rawSamples = Array.isArray(body.samples) ? body.samples : [];
  if (rawSamples.length > 5) throw new ValidationError('samples must have at most 5 entries');
  const samples: EvalSample[] = rawSamples.map((sample, i) => {
    const s = sample as Record<string, unknown>;
    const seatNumber = typeof s?.seatNumber === 'number' ? s.seatNumber : NaN;
    if (isNaN(seatNumber)) throw new ValidationError(`samples[${i}].seatNumber is required`);
    if (typeof s.grade !== 'string' || !EVAL_GRADES.includes(s.grade)) {
      throw new ValidationError(`samples[${i}].grade must be one of ${EVAL_GRADES.join('/')}`);
    }
    return {
      seatNumber,
      grade: s.grade,
      reason: typeof s.reason === 'string' ? s.reason.slice(0, 200) : undefined,
    };
  });

  const rawSubmissions = Array.isArray(body.submissions) ? body.submissions : [];
  if (rawSubmissions.length < 1 || rawSubmissions.length > EVAL_MAX_SUBMISSIONS) {
    throw new ValidationError(`submissions must have 1 to ${EVAL_MAX_SUBMISSIONS} entries`);
  }
  const submissions: EvalSubmission[] = rawSubmissions.map((submission, i) => {
    const s = submission as Record<string, unknown>;
    const seatNumber = typeof s?.seatNumber === 'number' ? s.seatNumber : NaN;
    if (isNaN(seatNumber)) throw new ValidationError(`submissions[${i}].seatNumber is required`);
    let pseudocode = typeof s.pseudocode === 'string' ? s.pseudocode : '';
    if (pseudocode.length > EVAL_MAX_PSEUDOCODE_LENGTH) {
      pseudocode = `${pseudocode.slice(0, EVAL_MAX_PSEUDOCODE_LENGTH)}\n…(以降省略)`;
    }
    const signals =
      s.signals && typeof s.signals === 'object' && !Array.isArray(s.signals)
        ? (s.signals as Record<string, unknown>)
        : {};
    return { seatNumber, signals, pseudocode };
  });

  return { mode, assignmentName, assignmentText, rubricAxes, strictness, samples, submissions };
}

/**
 * Build the Anthropic system + user prompts. Pure — exported for unit tests.
 */
export function buildEvaluationPrompt(request: EvaluateRequest): { system: string; user: string } {
  const strictnessLabel = {
    lenient: 'やや甘め（迷ったら上の評価に寄せる）',
    standard: '標準',
    strict: 'やや厳しめ（迷ったら下の評価に寄せる）',
  }[request.strictness];

  const commonHeader = [
    'あなたは日本の中学校技術科の先生を支援する採点補助AIです。',
    '提出された Scratch/スモウルビー作品の静的解析結果（機械シグナルと、全スクリプトを日本語テキスト化した擬似コード）を読み取ります。',
    '◆ の付いたスクリプトはイベントに接続されていて実行されます。◇ は接続されておらず実行されません（この区別は重要です）。',
    '',
  ];

  let system: string[];
  if (request.mode === 'grade') {
    system = [
      ...commonHeader,
      '先生が設定した評価軸に照らして、各生徒の評価案（S / A / B / C の4段階）を作ります。',
      '',
      '原則:',
      '- 評価はあくまで「提案」です。最終判断は先生が行います。',
      '- reason は100文字以内の日本語で、必ず機械シグナルまたは擬似コードの具体的な事実を引用してください。',
      '- 判断に迷う場合、シグナルと擬似コードが矛盾する場合、作品が課題と無関係に見える場合は needsReview を true にしてください。',
      `- 評価の厳しさ: ${strictnessLabel}`,
      '',
      '評価軸:',
      ...request.rubricAxes.map((axis, i) => `${i + 1}. ${axis.name}${axis.description ? ` — ${axis.description}` : ''}`),
      '',
      '出力は次の JSON のみ（説明文・コードフェンス禁止）:',
      '{"results":[{"seatNumber":1,"grade":"A","reason":"…","needsReview":false}]}',
    ];
  } else {
    system = [
      ...commonHeader,
      '各生徒に返す「ポジティブな返却コメント」の下書きを作ります。次の授業へのモチベーションにつなげるのが目的です。',
      '',
      '原則:',
      '- 読み手は中学生です。やさしい言葉で、45〜120文字。',
      '- 必ずその生徒の作品の具体的な良い点（擬似コードから読み取れる工夫）を1つ挙げて褒めてください。',
      '- 次にやってみたくなる一言を添えてください。評点・順位・他の生徒との比較は書かないでください。',
      '- 作品が空・断片のみの場合も、取り組みを認めて次の一歩を示してください。',
      '',
      '出力は次の JSON のみ（説明文・コードフェンス禁止）:',
      '{"results":[{"seatNumber":1,"comment":"…"}]}',
    ];
  }

  const user: string[] = [
    `課題名: ${request.assignmentName || '(未設定)'}`,
    request.assignmentText ? `課題の内容:\n${request.assignmentText}` : '',
    '',
  ];
  if (request.samples.length > 0) {
    user.push('先生が採点した較正サンプル（この基準に厳しさを合わせること）:');
    for (const sample of request.samples) {
      user.push(`- 出席番号${sample.seatNumber}: ${sample.grade}${sample.reason ? `（${sample.reason}）` : ''}`);
    }
    user.push('');
  }
  user.push('提出作品:');
  for (const submission of request.submissions) {
    user.push(`--- 出席番号${submission.seatNumber} ---`);
    user.push(`機械シグナル: ${JSON.stringify(submission.signals)}`);
    user.push('擬似コード:');
    user.push(submission.pseudocode || '(提出なし/空)');
    user.push('');
  }

  return { system: system.join('\n'), user: user.filter(line => line !== null).join('\n') };
}

/**
 * Parse + validate the model's JSON response. Pure — exported for unit
 * tests. Tolerates code fences and stray text around the JSON object.
 */
export function parseEvaluationResponse(
  text: string,
  mode: 'grade' | 'comment',
  expectedSeats: number[],
): Record<string, unknown>[] {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI response contains no JSON object');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('AI response JSON is malformed');
  }
  const results = (parsed as Record<string, unknown>)?.results;
  if (!Array.isArray(results)) throw new Error('AI response has no results array');

  const bySeat = new Map<number, Record<string, unknown>>();
  for (const result of results) {
    const r = result as Record<string, unknown>;
    if (typeof r?.seatNumber !== 'number') continue;
    if (mode === 'grade') {
      if (typeof r.grade !== 'string' || !EVAL_GRADES.includes(r.grade)) continue;
      bySeat.set(r.seatNumber, {
        seatNumber: r.seatNumber,
        grade: r.grade,
        reason: typeof r.reason === 'string' ? r.reason.slice(0, 200) : '',
        needsReview: r.needsReview === true,
      });
    } else {
      if (typeof r.comment !== 'string' || r.comment.length === 0) continue;
      bySeat.set(r.seatNumber, {
        seatNumber: r.seatNumber,
        comment: r.comment.slice(0, MAX_TEACHER_COMMENT_LENGTH),
      });
    }
  }

  // Every requested seat must come back — a missing seat is flagged for
  // review rather than silently dropped.
  return expectedSeats.map(seatNumber => {
    const found = bySeat.get(seatNumber);
    if (found) return found;
    return mode === 'grade'
      ? { seatNumber, grade: 'C', reason: 'AI応答に含まれず（要確認）', needsReview: true }
      : { seatNumber, comment: '' };
  });
}

// Per-teacher rate limiter for the evaluation endpoint (in-memory, same
// pattern as the join limiter — best-effort per Lambda instance).
const evalAttempts = new Map<string, { count: number; windowStart: number }>();

/**
 * Durable daily quota: an atomic counter item per teacher per UTC day in the
 * Classrooms table (reuses the table key space with a reserved prefix; TTL
 * cleans it up after two days). Throws when the day's budget is exhausted.
 */
async function checkEvalDailyLimit(teacherSub: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const result = await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId: `eval-quota#${teacherSub}#${day}` },
    UpdateExpression: 'ADD #c :one SET #ttl = if_not_exists(#ttl, :ttl)',
    ExpressionAttributeNames: { '#c': 'count', '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':one': 1,
      ':ttl': Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60,
    },
    ReturnValues: 'UPDATED_NEW',
  }));
  const count = (result.Attributes?.count as number) || 0;
  if (count > EVAL_DAILY_LIMIT) {
    throw new ValidationError(
      `Daily AI evaluation limit reached (${EVAL_DAILY_LIMIT} calls/day). Please continue tomorrow.`,
    );
  }
}

function checkEvalRateLimit(teacherSub: string): void {
  const now = Math.floor(Date.now() / 1000);
  const entry = evalAttempts.get(teacherSub);
  if (entry && (now - entry.windowStart) < EVAL_RATE_LIMIT_WINDOW_SECONDS) {
    if (entry.count >= EVAL_RATE_LIMIT_MAX_REQUESTS) {
      throw new ValidationError('Too many evaluation requests. Please try again later.');
    }
    entry.count++;
  } else {
    evalAttempts.set(teacherSub, { count: 1, windowStart: now });
  }
}

async function handleEvaluateSubmissions(
  identity: TeacherIdentity, classroomId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 503, body: JSON.stringify({ error: 'AI evaluation is not configured' }) };
  }
  const classroomResult = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroomResult.Item || !(await canManageViaGroup(classroomResult.Item, identity))) {
    throw new AuthError('Not authorized to evaluate this classroom');
  }
  checkEvalRateLimit(identity.sub);
  await checkEvalDailyLimit(identity.sub);

  const request = validateEvaluateRequest(body);
  const { system, user } = buildEvaluationPrompt(request);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    const status = response.status === 529 ? 502 : 502;
    console.error('Anthropic API error:', response.status, await response.text().catch(() => ''));
    return { statusCode: status, body: JSON.stringify({ error: 'AI_API_ERROR' }) };
  }

  const data = (await response.json()) as Record<string, unknown>;
  const content = Array.isArray(data.content) ? (data.content[0] as Record<string, unknown>) : null;
  const text = typeof content?.text === 'string' ? content.text : '';
  const usage = (data.usage || {}) as Record<string, unknown>;
  console.log(JSON.stringify({
    event: 'classroom_evaluate',
    mode: request.mode,
    submissionCount: request.submissions.length,
    model: CLAUDE_MODEL,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationTokens: usage.cache_creation_input_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
  }));

  let results: Record<string, unknown>[];
  try {
    results = parseEvaluationResponse(text, request.mode, request.submissions.map(s => s.seatNumber));
  } catch (err) {
    console.error('Evaluation response parse error:', err, text.slice(0, 500));
    return { statusCode: 502, body: JSON.stringify({ error: 'AI_RESPONSE_INVALID' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ mode: request.mode, results }) };
}

// --- みんなの課題 (shared assignment library, EPIC #1066) ---
// Teachers publish an assignment snapshot (pages + starter + supplement URL
// + minimal author profile) under CC BY 4.0; other teachers browse, filter,
// and import it into their own class. Shared items are permanent (no TTL,
// D7) and live in their own bucket so the classroom lifecycle never sweeps
// them. Design canon: spike #1067 (D1-D12).

export const SHARED_SCHOOL_LEVELS = ['elementary', 'junior-high', 'high', 'other'] as const;

/** Controlled subject vocabulary per school level (D5). 'other' is free text. */
export const SHARED_SUBJECTS: Record<string, readonly string[]> = {
  elementary: ['総合的な学習の時間', '算数', '理科', '図画工作', '特別活動・クラブ', 'その他'],
  'junior-high': ['技術・家庭（技術分野）', '数学', '理科', '総合的な学習の時間', 'その他'],
  high: ['情報Ⅰ', '情報Ⅱ', 'その他'],
  other: [],
};

const SHARED_MAX_GRADE: Record<string, number> = {
  elementary: 6,
  'junior-high': 3,
  high: 3,
  other: 6,
};

interface SharedAttributes {
  schoolLevel: string;
  grades: number[];
  subject: string;
  tags: string[];
  lessonCount: number | null;
}

/**
 * Validate the school attributes of a share/update request (D5).
 * @param body - request body
 * @returns normalized attributes
 */
export function validateSharedAttributes(body: Record<string, unknown>): SharedAttributes {
  const schoolLevel = body.schoolLevel;
  if (typeof schoolLevel !== 'string' || !(SHARED_SCHOOL_LEVELS as readonly string[]).includes(schoolLevel)) {
    throw new ValidationError(`schoolLevel must be one of: ${SHARED_SCHOOL_LEVELS.join(', ')}`);
  }

  const subject = body.subject;
  if (typeof subject !== 'string' || subject.trim().length === 0) {
    throw new ValidationError('subject is required');
  }
  const vocabulary = SHARED_SUBJECTS[schoolLevel];
  if (vocabulary.length > 0 && !vocabulary.includes(subject)) {
    throw new ValidationError(`subject must be one of: ${vocabulary.join(' / ')}`);
  }
  if (vocabulary.length === 0 && subject.trim().length > MAX_SHARED_TAG_LENGTH) {
    throw new ValidationError(`subject must be ${MAX_SHARED_TAG_LENGTH} characters or less`);
  }

  const maxGrade = SHARED_MAX_GRADE[schoolLevel];
  let grades: number[] = [];
  if (body.grades !== undefined) {
    if (!Array.isArray(body.grades)) {
      throw new ValidationError('grades must be an array');
    }
    grades = [...new Set(body.grades)].map(g => {
      if (typeof g !== 'number' || !Number.isInteger(g) || g < 1 || g > maxGrade) {
        throw new ValidationError(`grades must be integers between 1 and ${maxGrade}`);
      }
      return g;
    }).sort((a, b) => a - b);
  }

  let tags: string[] = [];
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      throw new ValidationError('tags must be an array');
    }
    tags = [...new Set(body.tags.map(t => {
      if (typeof t !== 'string' || t.trim().length === 0 || t.trim().length > MAX_SHARED_TAG_LENGTH) {
        throw new ValidationError(`each tag must be 1-${MAX_SHARED_TAG_LENGTH} characters`);
      }
      return t.trim();
    }))];
    if (tags.length > MAX_SHARED_TAGS) {
      throw new ValidationError(`at most ${MAX_SHARED_TAGS} tags are allowed`);
    }
  }

  let lessonCount: number | null = null;
  if (body.lessonCount !== undefined && body.lessonCount !== null) {
    if (typeof body.lessonCount !== 'number' || !Number.isInteger(body.lessonCount) ||
        body.lessonCount < 1 || body.lessonCount > 20) {
      throw new ValidationError('lessonCount must be an integer between 1 and 20');
    }
    lessonCount = body.lessonCount;
  }

  return { schoolLevel, grades, subject: subject.trim(), tags, lessonCount };
}

/**
 * Validate the supplement URL (D4): https only, parseable, bounded length.
 * @param value - raw URL from the request
 * @returns normalized URL or null when absent
 */
export function validateSupplementUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > MAX_SUPPLEMENT_URL_LENGTH) {
    throw new ValidationError(`supplementUrl must be a string of at most ${MAX_SUPPLEMENT_URL_LENGTH} characters`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError('supplementUrl must be a valid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new ValidationError('supplementUrl must use https');
  }
  return value;
}

/**
 * Validate the minimal public author profile (D6).
 * @param body - request body
 * @returns display name + optional affiliation
 */
export function validateAuthorProfile(body: Record<string, unknown>): {
  authorName: string;
  authorAffiliation: string | null;
} {
  const name = body.authorName;
  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > MAX_AUTHOR_NAME_LENGTH) {
    throw new ValidationError(`authorName is required (at most ${MAX_AUTHOR_NAME_LENGTH} characters)`);
  }
  let affiliation: string | null = null;
  if (body.authorAffiliation !== undefined && body.authorAffiliation !== null && body.authorAffiliation !== '') {
    if (typeof body.authorAffiliation !== 'string' ||
        body.authorAffiliation.trim().length > MAX_AUTHOR_AFFILIATION_LENGTH) {
      throw new ValidationError(`authorAffiliation must be at most ${MAX_AUTHOR_AFFILIATION_LENGTH} characters`);
    }
    affiliation = body.authorAffiliation.trim();
  }
  return { authorName: name.trim(), authorAffiliation: affiliation };
}

/**
 * Build the shared snapshot of an assignment: pages/starter keys rewritten
 * into the shared bucket's `shared/{sharedId}/` prefix plus the copy plan.
 * Mirror of buildDuplicatedAssignment, kept pure for tests.
 * @param assignment - the classroom's assignment content
 * @param sharedId - target shared item id
 * @returns rewritten pages/starterKey and the copy list
 */
export function buildSharedSnapshot(
  assignment: AssignmentContent | undefined,
  sharedId: string,
): { pages: AssignmentPage[]; starterKey?: string; copies: { from: string; to: string }[] } {
  const copies: { from: string; to: string }[] = [];
  const rewriteKey = (key: string): string => {
    const to = `shared/${sharedId}/${key.split('/').pop()}`;
    copies.push({ from: key, to });
    return to;
  };
  const pages = (assignment?.pages || []).map(page =>
    page.imageKey ? { text: page.text, imageKey: rewriteKey(page.imageKey) } : { text: page.text },
  );
  const starterKey = assignment?.starterKey ? rewriteKey(assignment.starterKey) : undefined;
  return { pages, starterKey, copies };
}

/** Public list/detail projection — never exposes authorSub / internal keys. */
/**
 * Public-facing shape of a shared assignment.
 * @param item - the DynamoDB shared item
 * @param opts - includePasscode echoes the 合言葉 (author-only; never in the
 *   public catalog). visibility defaults to 'public' for pre-#1109 items.
 * @returns the summary object sent to clients
 */
function mapSharedSummary(item: Record<string, unknown>, opts: { includePasscode?: boolean } = {}) {
  return {
    sharedId: item.sharedId,
    title: item.title,
    summary: item.summary || null,
    schoolLevel: item.schoolLevel,
    grades: item.grades || [],
    subject: item.subject,
    tags: item.tags || [],
    lessonCount: item.lessonCount || null,
    supplementUrl: item.supplementUrl || null,
    authorName: item.authorName,
    authorAffiliation: item.authorAffiliation || null,
    pageCount: Array.isArray((item.content as AssignmentContent | undefined)?.pages)
      ? (item.content as AssignmentContent).pages!.length
      : 0,
    hasStarter: !!(item.content as AssignmentContent | undefined)?.starterKey,
    reuseCount: (item.reuseCount as number) || 0,
    // 公開範囲: 'public' = みんなの課題カタログ / 'limited' = 合言葉限定公開。
    visibility: (item.visibility as string) || 'public',
    // Admin 推薦 (#1110): 書き込みは admin スタックのみ。boolean へ投影する
    // （recommendedBy = admin email は内部情報なので先生側 API には出さない）。
    recommended: !!item.recommendedAt,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(opts.includePasscode && item.passcode ? { passcode: item.passcode } : {}),
  };
}

/**
 * Generate a shared-assignment 合言葉 (passcode) unique across limited items.
 * Reuses the join-code alphabet/length and the passcode-index GSI for the
 * uniqueness check (same retry policy as classroom join codes).
 * @returns a unique passcode, or '' if none was found after retries
 */
async function generateUniqueSharedPasscode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateJoinCode();
    const existing = await docClient.send(new QueryCommand({
      TableName: SHARED_ASSIGNMENTS_TABLE,
      IndexName: 'passcode-index',
      KeyConditionExpression: 'passcode = :pc',
      ExpressionAttributeValues: { ':pc': candidate },
      Limit: 1,
    }));
    if (!existing.Items || existing.Items.length === 0) {
      return candidate;
    }
  }
  return '';
}

/**
 * Look up a limited-published shared item by its 合言葉 (passcode).
 * @param passcode - the 合言葉
 * @returns the shared item, or null when no limited item matches
 */
async function getSharedItemByPasscode(passcode: string): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(new QueryCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    IndexName: 'passcode-index',
    KeyConditionExpression: 'passcode = :pc',
    ExpressionAttributeValues: { ':pc': passcode },
    Limit: 1,
  }));
  const item = (result.Items && result.Items[0]) as Record<string, unknown> | undefined;
  if (!item || item.status !== 'published' || item.visibility !== 'limited') return null;
  return item;
}

/**
 * Durable daily quota shared by the share/report endpoints (D12): an atomic
 * counter per teacher per UTC day, stored in the Classrooms table's reserved
 * key space (same pattern as eval-quota; TTL cleans it after two days).
 */
async function checkSharedDailyLimit(kind: string, teacherSub: string, limit: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const result = await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId: `${kind}-quota#${teacherSub}#${day}` },
    UpdateExpression: 'ADD #c :one SET #ttl = if_not_exists(#ttl, :ttl)',
    ExpressionAttributeNames: { '#c': 'count', '#ttl': 'ttl' },
    ExpressionAttributeValues: {
      ':one': 1,
      ':ttl': Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60,
    },
    ReturnValues: 'UPDATED_NEW',
  }));
  const count = (result.Attributes?.count as number) || 0;
  if (count > limit) {
    throw new ValidationError(`Daily limit reached (${limit}/day). Please continue tomorrow.`);
  }
}

async function getSharedItem(sharedId: string): Promise<Record<string, unknown> | null> {
  const result = await docClient.send(new GetCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    Key: { sharedId },
  }));
  return (result.Item as Record<string, unknown>) || null;
}

async function handleShareAssignment(
  identity: TeacherIdentity, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  // 公開範囲（#1109）: 'public' = みんなの課題カタログ / 'limited' = 合言葉限定公開。
  const visibility = body.visibility === 'limited' ? 'limited' : 'public';

  const title = body.title;
  if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > MAX_SHARED_TITLE_LENGTH) {
    throw new ValidationError(`title is required (at most ${MAX_SHARED_TITLE_LENGTH} characters)`);
  }
  let summary: string | null = null;
  if (body.summary !== undefined && body.summary !== null && body.summary !== '') {
    if (typeof body.summary !== 'string' || body.summary.trim().length > MAX_SHARED_SUMMARY_LENGTH) {
      throw new ValidationError(`summary must be at most ${MAX_SHARED_SUMMARY_LENGTH} characters`);
    }
    summary = body.summary.trim();
  }

  // 全体公開は CC BY 同意・属性・著者名が必須。限定公開（合言葉）は内輪向けで
  // それらは任意（後で全体公開へ広げるときに必須化する。障壁＝完璧さの圧を下げる）。
  let attributes: Record<string, unknown> = {};
  let profile: Record<string, unknown> = {};
  let supplementUrl: string | null = null;
  if (visibility === 'public') {
    if (body.licenseConsent !== true) {
      throw new ValidationError('licenseConsent (CC BY 4.0) is required');
    }
    attributes = validateSharedAttributes(body) as unknown as Record<string, unknown>;
    supplementUrl = validateSupplementUrl(body.supplementUrl);
    profile = validateAuthorProfile(body) as unknown as Record<string, unknown>;
  } else {
    supplementUrl = validateSupplementUrl(body.supplementUrl);
    if (body.authorName !== undefined && body.authorName !== null && body.authorName !== '') {
      profile = validateAuthorProfile(body) as unknown as Record<string, unknown>;
    }
  }

  // Source classroom: must be the teacher's own, active, with content.
  const classroomId = body.classroomId;
  if (typeof classroomId !== 'string' || !classroomId) {
    throw new ValidationError('classroomId is required');
  }
  const classroomResult = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroomResult.Item || classroomResult.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }
  if (!(await canManageViaGroup(classroomResult.Item, identity))) {
    throw new AuthError('Not authorized to share this classroom');
  }
  const assignment = classroomResult.Item.assignment as AssignmentContent | undefined;
  if (!assignment || ((!assignment.pages || assignment.pages.length === 0) && !assignment.starterKey)) {
    throw new ValidationError('This assignment has no content (pages or starter project) to share');
  }

  // Starter size cap (D11) — checked before any copy.
  if (assignment.starterKey) {
    const head = await s3Client.send(new HeadObjectCommand({
      Bucket: SUBMISSIONS_BUCKET,
      Key: assignment.starterKey,
    }));
    if ((head.ContentLength || 0) > SHARED_STARTER_MAX_BYTES) {
      throw new ValidationError(
        `Starter project exceeds the ${Math.floor(SHARED_STARTER_MAX_BYTES / (1024 * 1024))}MB limit`,
      );
    }
  }

  await checkSharedDailyLimit('share', identity.sub, SHARE_DAILY_LIMIT);

  const sharedId = crypto.randomUUID();
  const { pages, starterKey, copies } = buildSharedSnapshot(assignment, sharedId);

  // Copy content into the shared bucket first so the record never
  // references missing objects (same ordering as duplicate).
  for (const { from, to } of copies) {
    await s3Client.send(new CopyObjectCommand({
      Bucket: SHARED_BUCKET,
      CopySource: `${SUBMISSIONS_BUCKET}/${encodeURIComponent(from)}`,
      Key: to,
    }));
  }

  const now = new Date().toISOString();
  // 限定公開は合言葉（参加コード同型）を発行。全体公開は発行しない。
  let passcode = '';
  if (visibility === 'limited') {
    passcode = await generateUniqueSharedPasscode();
    if (!passcode) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate a unique passcode' }) };
    }
  }
  const item: Record<string, unknown> = {
    sharedId,
    title: title.trim(),
    summary,
    content: { pages, starterKey },
    supplementUrl,
    ...attributes,
    ...profile,
    authorSub: identity.sub,
    visibility,
    ...(passcode ? { passcode } : {}),
    status: 'published',
    reuseCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(new PutCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    Item: item,
  }));

  return { statusCode: 201, body: JSON.stringify(mapSharedSummary(item, { includePasscode: true })) };
}

async function handleListSharedAssignments(
  identity: TeacherIdentity, query: Record<string, string | undefined>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const mine = query.mine === '1' || query.mine === 'true';

  // Optional attribute filters (D8): applied server-side as a
  // FilterExpression on top of the newest-first GSI query.
  const filterParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  if (query.schoolLevel) {
    filterParts.push('#sl = :sl');
    names['#sl'] = 'schoolLevel';
    values[':sl'] = query.schoolLevel;
  }
  if (query.subject) {
    filterParts.push('#sub = :sub');
    names['#sub'] = 'subject';
    values[':sub'] = query.subject;
  }
  if (query.grade) {
    const grade = parseInt(query.grade, 10);
    if (!Number.isNaN(grade)) {
      filterParts.push('contains(#gr, :gr)');
      names['#gr'] = 'grades';
      values[':gr'] = grade;
    }
  }
  if (query.tag) {
    filterParts.push('contains(#tg, :tg)');
    names['#tg'] = 'tags';
    values[':tg'] = query.tag;
  }
  // 公開カタログ（mine 以外）は限定公開（合言葉）を除外する。#1109 より前の
  // 項目は visibility 属性を持たないので「公開」とみなす。mine は両方見せる。
  if (!mine) {
    filterParts.push('(attribute_not_exists(#vis) OR #vis = :pub)');
    names['#vis'] = 'visibility';
    values[':pub'] = 'public';
  }

  let exclusiveStartKey: Record<string, unknown> | undefined;
  if (query.cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
    } catch {
      throw new ValidationError('Invalid cursor');
    }
  }

  // DynamoDB rejects an EMPTY ExpressionAttributeNames map, so the key must
  // be omitted when there is nothing to alias (mine=1 with no filters).
  const expressionNames = {
    ...(mine ? {} : { '#status': 'status' }),
    ...names,
  };
  const result = await docClient.send(new QueryCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    IndexName: mine ? 'authorSub-createdAt-index' : 'status-createdAt-index',
    KeyConditionExpression: mine ? 'authorSub = :pk' : '#status = :pk',
    ...(Object.keys(expressionNames).length > 0 ? { ExpressionAttributeNames: expressionNames } : {}),
    ExpressionAttributeValues: {
      ':pk': mine ? identity.sub : 'published',
      ...values,
    },
    FilterExpression: filterParts.length > 0 ? filterParts.join(' AND ') : undefined,
    ScanIndexForward: false,
    Limit: SHARED_LIST_PAGE_SIZE,
    ExclusiveStartKey: exclusiveStartKey,
  }));

  const cursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url')
    : null;
  return {
    statusCode: 200,
    body: JSON.stringify({
      // mine の一覧は自分の項目なので合言葉を含める（限定公開の共有に使う）。
      items: (result.Items || []).map((it) => mapSharedSummary(it, { includePasscode: mine })),
      cursor,
    }),
  };
}

async function handleGetSharedAssignment(
  identity: TeacherIdentity, sharedId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const item = await getSharedItem(sharedId);
  // Existence-hiding 404. The author may view their own unlisted item.
  // 限定公開（合言葉）は sharedId を知っていても著者以外には見せない
  // （非著者は合言葉ルックアップ経由でのみ取り込む）。
  const isMine = !!item && item.authorSub === identity.sub;
  if (!item || (!isMine && (item.status !== 'published' || item.visibility === 'limited'))) {
    throw new NotFoundError('Shared assignment not found');
  }

  const content = (item.content as AssignmentContent | undefined) || {};
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
  const starterUrl = content.starterKey
    ? await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: SHARED_BUCKET, Key: content.starterKey }),
        { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY },
      )
    : null;

  return {
    statusCode: 200,
    body: JSON.stringify({
      ...mapSharedSummary(item, { includePasscode: isMine }),
      pages,
      starterUrl,
      isMine,
    }),
  };
}

async function handleImportSharedAssignment(
  identity: TeacherIdentity, sharedId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const item = await getSharedItem(sharedId);
  // 全体公開のみ sharedId で取り込める。限定公開（合言葉）は
  // handleImportByPasscode 経由でのみ取り込む（sharedId は非著者に露出しない）。
  if (!item || item.status !== 'published' || item.visibility === 'limited') {
    throw new NotFoundError('Shared assignment not found');
  }
  return importSharedItem(identity, item, body);
}

/**
 * Import a resolved shared item into one of the caller's classes as a new
 * assignment. Copies content into the classroom bucket, mints a fresh join
 * code, and bumps reuseCount. Shared by sharedId-import and passcode-import.
 * @param identity - the importing teacher
 * @param item - the resolved shared assignment item
 * @param body - request body (groupId required, assignmentName optional)
 * @returns the created classroom summary
 */
async function importSharedItem(
  identity: TeacherIdentity, item: Record<string, unknown>, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const sharedId = item.sharedId as string;
  const groupId = body.groupId;
  if (typeof groupId !== 'string' || !groupId) {
    throw new ValidationError('groupId is required');
  }
  const group = await getManageableGroup(identity, groupId);

  const assignmentName = body.assignmentName !== undefined
    ? validateClassName(body.assignmentName)
    : (item.title as string);

  // Fresh unique join code (same retry policy as creation/duplication).
  let joinCode = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateJoinCode();
    const existing = await docClient.send(new QueryCommand({
      TableName: CLASSROOMS_TABLE,
      IndexName: 'joinCode-index',
      KeyConditionExpression: 'joinCode = :jc',
      ExpressionAttributeValues: { ':jc': candidate },
      Limit: 1,
    }));
    if (!existing.Items || existing.Items.length === 0) {
      joinCode = candidate;
      break;
    }
  }
  if (!joinCode) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate unique join code' }) };
  }

  const newClassroomId = crypto.randomUUID();
  const content = (item.content as AssignmentContent | undefined) || {};
  const { assignment, copies } = buildDuplicatedAssignment(content, `shared/${sharedId}`, newClassroomId);

  // Copy shared objects into the classroom bucket first (never reference
  // missing objects). Source is the shared bucket.
  for (const { from, to } of copies) {
    await s3Client.send(new CopyObjectCommand({
      Bucket: SUBMISSIONS_BUCKET,
      CopySource: `${SHARED_BUCKET}/${encodeURIComponent(from)}`,
      Key: to,
    }));
  }

  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + CLASSROOM_TTL_SECONDS;
  const studentCount = typeof group.studentCount === 'number' ? group.studentCount : 40;
  await docClient.send(new PutCommand({
    TableName: CLASSROOMS_TABLE,
    Item: {
      classroomId: newClassroomId,
      teacherSub: identity.sub,
      className: group.name,
      assignmentName,
      joinCode,
      studentCount,
      groupId,
      sortDate: now,
      assignment,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ttl,
    },
  }));

  // Popularity signal (D8 future sort) — best effort, never blocks import.
  try {
    await docClient.send(new UpdateCommand({
      TableName: SHARED_ASSIGNMENTS_TABLE,
      Key: { sharedId },
      UpdateExpression: 'ADD reuseCount :one',
      ExpressionAttributeValues: { ':one': 1 },
    }));
  } catch (err) {
    console.error('Failed to bump reuseCount:', err);
  }

  return {
    statusCode: 201,
    body: JSON.stringify({
      classroomId: newClassroomId,
      className: group.name,
      assignmentName,
      joinCode,
      studentCount,
      groupId,
      sortDate: now,
      hasAssignment: !!assignment,
      status: 'active',
      createdAt: now,
      expiresAt: new Date(ttl * 1000).toISOString(),
    }),
  };
}

/**
 * Look up a limited-published shared assignment by 合言葉 for a preview/confirm
 * step. Does not expose the sharedId (import re-supplies the passcode), so the
 * passcode remains the only access token to a limited item.
 * @param identity - the requesting teacher
 * @param body - request body ({ passcode })
 * @returns the shared summary (no sharedId, no passcode echoed)
 */
async function handleLookupSharedByPasscode(
  identity: TeacherIdentity, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const passcode = validateJoinCode(body.passcode);
  const item = await getSharedItemByPasscode(passcode);
  if (!item) {
    throw new NotFoundError('Shared assignment not found');
  }
  const { sharedId: _omit, ...summary } = mapSharedSummary(item);
  return { statusCode: 200, body: JSON.stringify(summary) };
}

/**
 * Import a limited-published shared assignment by 合言葉 (内輪取り込み).
 * The passcode is the authorization; the sharedId is never surfaced.
 * @param identity - the importing teacher
 * @param body - request body ({ passcode, groupId, assignmentName? })
 * @returns the created classroom summary
 */
async function handleImportSharedByPasscode(
  identity: TeacherIdentity, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const passcode = validateJoinCode(body.passcode);
  const item = await getSharedItemByPasscode(passcode);
  if (!item) {
    throw new NotFoundError('Shared assignment not found');
  }
  return importSharedItem(identity, item, body);
}

async function handleUpdateSharedAssignment(
  identity: TeacherIdentity, sharedId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const item = await getSharedItem(sharedId);
  if (!item || item.authorSub !== identity.sub) {
    throw new NotFoundError('Shared assignment not found');
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0 ||
        body.title.trim().length > MAX_SHARED_TITLE_LENGTH) {
      throw new ValidationError(`title must be 1-${MAX_SHARED_TITLE_LENGTH} characters`);
    }
    updates.title = body.title.trim();
  }
  if (body.summary !== undefined) {
    if (body.summary === null || body.summary === '') {
      updates.summary = null;
    } else if (typeof body.summary === 'string' && body.summary.trim().length <= MAX_SHARED_SUMMARY_LENGTH) {
      updates.summary = body.summary.trim();
    } else {
      throw new ValidationError(`summary must be at most ${MAX_SHARED_SUMMARY_LENGTH} characters`);
    }
  }
  if (body.schoolLevel !== undefined || body.subject !== undefined ||
      body.grades !== undefined || body.tags !== undefined || body.lessonCount !== undefined) {
    // Attributes are validated as a set (subject depends on schoolLevel).
    const merged = {
      schoolLevel: body.schoolLevel !== undefined ? body.schoolLevel : item.schoolLevel,
      subject: body.subject !== undefined ? body.subject : item.subject,
      grades: body.grades !== undefined ? body.grades : item.grades,
      tags: body.tags !== undefined ? body.tags : item.tags,
      lessonCount: body.lessonCount !== undefined ? body.lessonCount : item.lessonCount,
    };
    Object.assign(updates, validateSharedAttributes(merged as Record<string, unknown>));
  }
  if (body.supplementUrl !== undefined) {
    updates.supplementUrl = validateSupplementUrl(body.supplementUrl);
  }
  if (body.authorName !== undefined || body.authorAffiliation !== undefined) {
    const profile = validateAuthorProfile({
      authorName: body.authorName !== undefined ? body.authorName : item.authorName,
      authorAffiliation: body.authorAffiliation !== undefined ? body.authorAffiliation : item.authorAffiliation,
    });
    Object.assign(updates, profile);
  }
  if (body.status !== undefined) {
    if (body.status !== 'published' && body.status !== 'unlisted') {
      throw new ValidationError('Status must be "published" or "unlisted"');
    }
    updates.status = body.status;
  }

  // 公開範囲の変更（#1109）。限定公開 → 全体公開に広げるときは、全体公開に
  // 必要な属性・著者名・CC BY 同意（body か既存値）が揃っていることを要求する。
  if (body.visibility !== undefined) {
    if (body.visibility !== 'public' && body.visibility !== 'limited') {
      throw new ValidationError('visibility must be "public" or "limited"');
    }
    const currentVisibility = (item.visibility as string) || 'public';
    if (body.visibility === 'public' && currentVisibility !== 'public') {
      if (body.licenseConsent !== true) {
        throw new ValidationError('licenseConsent (CC BY 4.0) is required to make it public');
      }
      // `??` だと body の明示的な null（= クリア）が既存値へ巻き戻る
      // （例: 発展フォームでコマ数を空にしても旧値が残る）。他の per-field
      // ブロックと同じ「undefined のときだけ既存値」で合成する。
      Object.assign(updates, validateSharedAttributes({
        schoolLevel: body.schoolLevel !== undefined ? body.schoolLevel : item.schoolLevel,
        subject: body.subject !== undefined ? body.subject : item.subject,
        grades: body.grades !== undefined ? body.grades : item.grades,
        tags: body.tags !== undefined ? body.tags : item.tags,
        lessonCount: body.lessonCount !== undefined ? body.lessonCount : item.lessonCount,
      } as Record<string, unknown>));
      Object.assign(updates, validateAuthorProfile({
        authorName: body.authorName !== undefined ? body.authorName : item.authorName,
        authorAffiliation: body.authorAffiliation !== undefined
          ? body.authorAffiliation
          : item.authorAffiliation,
      }));
      updates.visibility = 'public';
    } else if (body.visibility === 'limited' && currentVisibility !== 'limited') {
      updates.visibility = 'limited';
      if (!item.passcode) {
        const pc = await generateUniqueSharedPasscode();
        if (!pc) {
          return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate a unique passcode' }) };
        }
        updates.passcode = pc;
      }
    }
  }

  // Optional content re-snapshot (D10, overwrite semantics): pull the
  // current pages/starter from one of the teacher's own classrooms.
  if (body.classroomId !== undefined) {
    if (typeof body.classroomId !== 'string' || !body.classroomId) {
      throw new ValidationError('classroomId must be a string');
    }
    const classroomResult = await docClient.send(new GetCommand({
      TableName: CLASSROOMS_TABLE,
      Key: { classroomId: body.classroomId },
    }));
    if (!classroomResult.Item || classroomResult.Item.status !== 'active') {
      throw new NotFoundError('Classroom not found');
    }
    if (!(await canManageViaGroup(classroomResult.Item, identity))) {
      throw new AuthError('Not authorized to share this classroom');
    }
    const assignment = classroomResult.Item.assignment as AssignmentContent | undefined;
    if (!assignment || ((!assignment.pages || assignment.pages.length === 0) && !assignment.starterKey)) {
      throw new ValidationError('This assignment has no content (pages or starter project) to share');
    }
    if (assignment.starterKey) {
      const head = await s3Client.send(new HeadObjectCommand({
        Bucket: SUBMISSIONS_BUCKET,
        Key: assignment.starterKey,
      }));
      if ((head.ContentLength || 0) > SHARED_STARTER_MAX_BYTES) {
        throw new ValidationError(
          `Starter project exceeds the ${Math.floor(SHARED_STARTER_MAX_BYTES / (1024 * 1024))}MB limit`,
        );
      }
    }
    const { pages, starterKey, copies } = buildSharedSnapshot(assignment, sharedId);
    for (const { from, to } of copies) {
      await s3Client.send(new CopyObjectCommand({
        Bucket: SHARED_BUCKET,
        CopySource: `${SUBMISSIONS_BUCKET}/${encodeURIComponent(from)}`,
        Key: to,
      }));
    }
    // Best-effort cleanup of orphaned old objects (keys are content-unique).
    const oldContent = (item.content as AssignmentContent | undefined) || {};
    const newKeys = new Set([...pages.map(p => p.imageKey), starterKey].filter(Boolean));
    const oldKeys = [
      ...(oldContent.pages || []).map(p => p.imageKey),
      oldContent.starterKey,
    ].filter((key): key is string => !!key && !newKeys.has(key));
    await Promise.allSettled(oldKeys.map(key =>
      s3Client.send(new DeleteObjectCommand({ Bucket: SHARED_BUCKET, Key: key })),
    ));
    updates.content = { pages, starterKey };
  }

  const expressionParts: string[] = [];
  const expressionValues: Record<string, unknown> = {};
  const expressionNames: Record<string, string> = {};
  let i = 0;
  for (const [key, value] of Object.entries(updates)) {
    expressionNames[`#attr${i}`] = key;
    expressionValues[`:val${i}`] = value;
    expressionParts.push(`#attr${i} = :val${i}`);
    i++;
  }
  const result = await docClient.send(new UpdateCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    Key: { sharedId },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  }));

  return {
    statusCode: 200,
    body: JSON.stringify(mapSharedSummary(result.Attributes || {}, { includePasscode: true })),
  };
}

async function handleUnlistSharedAssignment(
  identity: TeacherIdentity, sharedId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  const item = await getSharedItem(sharedId);
  if (!item || item.authorSub !== identity.sub) {
    throw new NotFoundError('Shared assignment not found');
  }
  await docClient.send(new UpdateCommand({
    TableName: SHARED_ASSIGNMENTS_TABLE,
    Key: { sharedId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': 'unlisted', ':now': new Date().toISOString() },
  }));
  return { statusCode: 204, body: '' };
}

async function handleReportSharedAssignment(
  identity: TeacherIdentity, sharedId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const reason = body.reason;
  if (typeof reason !== 'string' || reason.trim().length === 0 ||
      reason.trim().length > MAX_SHARED_REPORT_REASON_LENGTH) {
    throw new ValidationError(`reason is required (at most ${MAX_SHARED_REPORT_REASON_LENGTH} characters)`);
  }
  const item = await getSharedItem(sharedId);
  if (!item || item.status !== 'published') {
    throw new NotFoundError('Shared assignment not found');
  }

  await checkSharedDailyLimit('report', identity.sub, REPORT_DAILY_LIMIT);

  await docClient.send(new PutCommand({
    TableName: SHARED_REPORTS_TABLE,
    Item: {
      sharedId,
      reportId: crypto.randomUUID(),
      reason: reason.trim(),
      // Internal only (abuse tracing) — never returned by any endpoint.
      reporterSub: identity.sub,
      createdAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + SHARED_REPORT_TTL_SECONDS,
    },
  }));

  return { statusCode: 201, body: JSON.stringify({}) };
}

// --- お知らせ (notification center, EPIC #1111) ---
// Items are written by the admin stack with this shape:
//   { teacherSub, notificationId (createdAt-prefixed for chronological SK),
//     type, title, body, link?, createdBy, createdAt, ttl }
// This API is deliberately read-only for teachers (list + mark-read): the
// single writer stays on the admin side, so notices cannot be forged from
// the editor.

async function handleListNotifications(
  identity: TeacherIdentity,
): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await docClient.send(new QueryCommand({
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'teacherSub = :sub',
    ExpressionAttributeValues: { ':sub': identity.sub },
    // notificationId starts with the ISO createdAt → newest first.
    ScanIndexForward: false,
    Limit: NOTIFICATION_LIST_LIMIT,
  }));
  const notifications = (result.Items || []).map(item => ({
    notificationId: item.notificationId,
    type: item.type || 'admin_message',
    title: item.title,
    body: item.body || null,
    link: item.link || null,
    readAt: item.readAt || null,
    createdAt: item.createdAt,
  }));
  const unreadCount = notifications.filter(n => !n.readAt).length;
  return { statusCode: 200, body: JSON.stringify({ notifications, unreadCount }) };
}

async function handleMarkNotificationsRead(
  identity: TeacherIdentity,
  body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  // A top-level JSON array would read `body.notificationIds` as undefined and
  // silently take the mark-all path — reject it explicitly (review finding).
  if (Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  let ids: string[];
  if (body.notificationIds === undefined || body.notificationIds === null) {
    // No explicit ids = mark everything currently unread, bounded by the
    // same window the list endpoint shows, so "open panel → clear badge"
    // stays consistent with what the teacher actually saw.
    const result = await docClient.send(new QueryCommand({
      TableName: NOTIFICATIONS_TABLE,
      KeyConditionExpression: 'teacherSub = :sub',
      ExpressionAttributeValues: { ':sub': identity.sub },
      ScanIndexForward: false,
      Limit: NOTIFICATION_LIST_LIMIT,
    }));
    ids = (result.Items || [])
      .filter(item => !item.readAt)
      .map(item => String(item.notificationId));
  } else if (
    Array.isArray(body.notificationIds) &&
    body.notificationIds.length <= NOTIFICATION_LIST_LIMIT &&
    // Length-bound each id so a garbage id fails as 400, not as a DynamoDB
    // ValidationException → 500 (real ids are ~61 chars: ISO + '#' + UUID).
    body.notificationIds.every(id => typeof id === 'string' && id.length <= 200)
  ) {
    ids = body.notificationIds as string[];
  } else {
    throw new ValidationError(
      `notificationIds must be an array of at most ${NOTIFICATION_LIST_LIMIT} strings`,
    );
  }

  const now = new Date().toISOString();
  let updated = 0;
  for (const notificationId of ids) {
    try {
      await docClient.send(new UpdateCommand({
        TableName: NOTIFICATIONS_TABLE,
        // The key includes the caller's own teacherSub, so a teacher can
        // never touch another teacher's rows regardless of the ids sent.
        Key: { teacherSub: identity.sub, notificationId },
        UpdateExpression: 'SET readAt = if_not_exists(readAt, :now)',
        // Never create phantom rows for ids that don't exist (TTL races).
        ConditionExpression: 'attribute_exists(notificationId)',
        ExpressionAttributeValues: { ':now': now },
      }));
      updated += 1;
    } catch (err) {
      if ((err as { name?: string }).name !== 'ConditionalCheckFailedException') throw err;
    }
  }
  return { statusCode: 200, body: JSON.stringify({ updated }) };
}

// --- Main handler ---

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  const origin = event.headers?.origin;
  const corsHeaders = getCorsHeaders(origin);

  // OPTIONS preflight
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const body = event.body ? JSON.parse(event.body) : {};

    let result: APIGatewayProxyStructuredResultV2;

    // Route matching
    if (method === 'POST' && path === '/classrooms') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleCreateClassroom(identity, body);

    } else if (method === 'GET' && path === '/classrooms') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const includeArchivedParam = event.queryStringParameters?.includeArchived;
      const includeArchived = includeArchivedParam === '1' || includeArchivedParam === 'true';
      result = await handleListClassrooms(identity, includeArchived);

    } else if (method === 'POST' && path === '/classrooms/join') {
      const sourceIp = event.requestContext.http.sourceIp || 'unknown';
      result = await handleJoinClassroom(sourceIp, body);

    } else if (method === 'POST' && path === '/classrooms/lookup') {
      const sourceIp = event.requestContext.http.sourceIp || 'unknown';
      result = await handleLookupClassroom(sourceIp, body);

    } else if (method === 'POST' && path === '/classrooms/lookup/kick-request') {
      // Student-initiated request to free up a seat occupied by someone else.
      // No auth header: the request only carries joinCode + seatNumber, and
      // the rate limiter prevents abuse. Approving/listing requires teacher
      // auth (separate routes below).
      const sourceIp = event.requestContext.http.sourceIp || 'unknown';
      result = await handleCreateKickRequest(sourceIp, body);

    } else if (method === 'POST' && path === '/classrooms/verify-session') {
      const token = extractBearerToken(event.headers?.authorization);
      result = await handleVerifySession(token);

    // --- お知らせ (notification center #1111) routes (own root path) ---
    } else if (method === 'GET' && path === '/notifications') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleListNotifications(identity);

    } else if (method === 'POST' && path === '/notifications/mark-read') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleMarkNotificationsRead(identity, body);

    // --- みんなの課題 (shared assignment library) routes (own root path) ---
    } else if (method === 'POST' && path === '/shared-assignments') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleShareAssignment(identity, body);

    } else if (method === 'POST' && path === '/shared-assignments/lookup') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleLookupSharedByPasscode(identity, body);

    } else if (method === 'POST' && path === '/shared-assignments/import-by-passcode') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleImportSharedByPasscode(identity, body);

    } else if (method === 'GET' && path === '/shared-assignments') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleListSharedAssignments(identity, event.queryStringParameters || {});

    } else if (method === 'POST' && /^\/shared-assignments\/[^/]+\/import$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const sharedId = event.pathParameters?.sharedId || '';
      result = await handleImportSharedAssignment(identity, sharedId, body);

    } else if (method === 'POST' && /^\/shared-assignments\/[^/]+\/report$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const sharedId = event.pathParameters?.sharedId || '';
      result = await handleReportSharedAssignment(identity, sharedId, body);

    } else if (method === 'GET' && /^\/shared-assignments\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const sharedId = event.pathParameters?.sharedId || '';
      result = await handleGetSharedAssignment(identity, sharedId);

    } else if (method === 'PATCH' && /^\/shared-assignments\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const sharedId = event.pathParameters?.sharedId || '';
      result = await handleUpdateSharedAssignment(identity, sharedId, body);

    } else if (method === 'DELETE' && /^\/shared-assignments\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const sharedId = event.pathParameters?.sharedId || '';
      result = await handleUnlistSharedAssignment(identity, sharedId);

    // --- Group (組) routes (own root path — no conflict with /classrooms) ---
    } else if (method === 'POST' && path === '/classroom-groups') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleCreateGroup(identity, body);

    } else if (method === 'GET' && path === '/classroom-groups') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleListGroups(identity);

    } else if (method === 'POST' && path === '/classroom-groups/migrate') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      result = await handleMigrateGroups(identity);

    } else if (method === 'PATCH' && /^\/classroom-groups\/[^/]+\/topics$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const groupId = event.pathParameters?.groupId || '';
      result = await handleUpdateGroupTopics(identity, groupId, body);

    } else if (method === 'PATCH' && /^\/classroom-groups\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const groupId = event.pathParameters?.groupId || '';
      result = await handleUpdateGroup(identity, groupId, body);

    } else if (method === 'POST' && /^\/classrooms\/[^/]+\/duplicate$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleDuplicateClassroom(identity, classroomId, body);

    // --- Google Classroom routes (must be before /classrooms/{classroomId}) ---
    } else if (method === 'GET' && path === '/classrooms/google-courses') {
      const token = extractBearerToken(event.headers?.authorization);
      await verifyTeacherIdToken(token);
      const accessToken = extractGoogleAccessToken(event.headers);
      result = await handleListGoogleCourses(accessToken);

    } else if (method === 'POST' && path === '/classrooms/google-import') {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const accessToken = extractGoogleAccessToken(event.headers);
      result = await handleImportGoogleClassroom(identity, accessToken, body);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleGetClassroom(identity, classroomId);

    } else if (method === 'PATCH' && /^\/classrooms\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleUpdateClassroom(identity, classroomId, body);

    } else if (method === 'DELETE' && /^\/classrooms\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleDeleteClassroom(identity, classroomId);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+\/co-teachers$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleListCoTeachers(identity, classroomId);

    } else if (method === 'POST' && /^\/classrooms\/[^/]+\/co-teachers$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleAddCoTeacher(identity, classroomId, body);

    } else if (method === 'DELETE' && /^\/classrooms\/[^/]+\/co-teachers\/.+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      const email = event.pathParameters?.email || '';
      result = await handleRemoveCoTeacher(identity, classroomId, email);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+\/members$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleListMembers(identity, classroomId);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+\/kick-requests$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleListKickRequests(identity, classroomId);

    } else if (method === 'POST' && /^\/classrooms\/[^/]+\/kick-requests\/[^/]+\/approve$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      const requestId = event.pathParameters?.requestId || '';
      result = await handleApproveKickRequest(identity, classroomId, requestId);

    } else if (method === 'DELETE' && /^\/classrooms\/[^/]+\/kick-requests\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      const requestId = event.pathParameters?.requestId || '';
      result = await handleRejectKickRequest(identity, classroomId, requestId);

    } else if (method === 'DELETE' && /^\/classrooms\/[^/]+\/members\/[^/]+$/.test(path)) {
      const classroomId = event.pathParameters?.classroomId || '';
      const memberId = event.pathParameters?.memberId || '';

      if (memberId === 'me') {
        // Student self-removal via sessionToken
        const token = extractBearerToken(event.headers?.authorization);
        const session = await verifySessionToken(token);
        if (session.classroomId !== classroomId) {
          throw new AuthError('Session does not match this classroom');
        }
        await docClient.send(new DeleteCommand({
          TableName: MEMBERSHIPS_TABLE,
          Key: { classroomId, memberId: session.memberId },
        }));
        result = { statusCode: 204 };
      } else {
        // Teacher removal via ID token
        const token = extractBearerToken(event.headers?.authorization);
        const identity = await verifyTeacherIdToken(token);
        result = await handleDeleteMember(identity, classroomId, memberId);
      }

    } else if (method === 'POST' && /^\/classrooms\/[^/]+\/evaluate$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleEvaluateSubmissions(identity, classroomId, body);

    } else if (method === 'PUT' && /^\/classrooms\/[^/]+\/assignment$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleSetAssignment(identity, classroomId, body);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+\/assignment$/.test(path)) {
      // Dual-auth (teacher ID token or student session token) — see handler.
      const token = extractBearerToken(event.headers?.authorization);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleGetAssignment(token, classroomId);

    } else if (method === 'POST' && /^\/classrooms\/[^/]+\/submissions$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const session = await verifySessionToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      if (session.classroomId !== classroomId) {
        throw new AuthError('Session does not match this classroom');
      }
      result = await handleCreateSubmission(classroomId, session.memberId, body);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+\/submissions$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleListSubmissions(identity, classroomId);

    } else if (method === 'PATCH' && /^\/classrooms\/[^/]+\/submissions\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      const submissionId = event.pathParameters?.submissionId || '';
      result = await handleUpdateSubmission(identity, classroomId, submissionId, body);

    } else if (method === 'POST' && /^\/classrooms\/[^/]+\/google-assignment$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const identity = await verifyTeacherIdToken(token);
      const accessToken = extractGoogleAccessToken(event.headers);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handlePostAssignment(identity, accessToken, classroomId, body);

    } else {
      result = { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }

    return { ...result, headers: { ...corsHeaders, ...result.headers } };

  } catch (err) {
    console.error('Handler error:', err);

    if (err instanceof ValidationError) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof AuthError) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof NotFoundError) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof ConflictError) {
      return { statusCode: 409, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof KickedError) {
      return {
        statusCode: 410,
        headers: corsHeaders,
        body: JSON.stringify({
          error: err.message,
          reason: 'kicked',
          joinCode: err.joinCode,
          className: err.className,
          seatNumber: err.seatNumber,
        }),
      };
    }
    if (err instanceof GoogleAPIError) {
      if (err.statusCode === 401) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Google access token expired. Please re-authorize.' }) };
      }
      if (err.statusCode === 403) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Insufficient Google Classroom permissions.' }) };
      }
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'Google Classroom API error' }) };
    }
    if (err instanceof SyntaxError) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
