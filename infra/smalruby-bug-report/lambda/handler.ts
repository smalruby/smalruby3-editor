import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import * as crypto from 'crypto';

// --- Configuration ---

const REPORTS_TABLE = process.env.REPORTS_TABLE_NAME || 'BugReports';
const ADMINS_TABLE = process.env.ADMINS_TABLE_NAME || 'BugReportAdmins';
const REPORTS_BUCKET = process.env.REPORTS_BUCKET_NAME || 'smalruby-bug-report';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';
const DEV_BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || '';
const STAGE = process.env.STAGE || 'stg';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

// Emails that are always treated as administrators regardless of the Admins
// table. This bootstraps the very first admin (who cannot otherwise be invited
// because no admin exists yet). Comma-separated, normalized (trim+lowercase).
const BOOTSTRAP_ADMIN_EMAILS = (process.env.BOOTSTRAP_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(e => e.length > 0);

// Reports are kept indefinitely while open; once an admin resolves them they
// are deleted after this many days via DynamoDB TTL (and the S3 lifecycle).
const RESOLVED_TTL_DAYS = parseInt(process.env.RESOLVED_TTL_DAYS || '30', 10);
const RESOLVED_TTL_SECONDS = RESOLVED_TTL_DAYS * 24 * 60 * 60;

const PRESIGNED_URL_UPLOAD_EXPIRY = parseInt(process.env.PRESIGNED_URL_UPLOAD_EXPIRY || '900', 10);
const PRESIGNED_URL_DOWNLOAD_EXPIRY = parseInt(process.env.PRESIGNED_URL_DOWNLOAD_EXPIRY || '600', 10);

const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_PROJECT_NAME_LENGTH = 100;
const MAX_SCREENSHOT_COUNT = 20;
const MAX_DEVELOPER_REPLY_LENGTH = 2000;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_APP_CONTEXT_LENGTH = 2000;

// Every report row carries this constant so the GSI can list all reports
// newest-first regardless of owner or status (admin listing).
const ENTITY_TYPE = 'bugReport';

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'wont_fix'] as const;
type ReportStatus = (typeof VALID_STATUSES)[number];
// Statuses that mean the report is done — TTL is applied so it auto-expires.
const TERMINAL_STATUSES: ReportStatus[] = ['resolved', 'wont_fix'];

// --- AWS clients ---

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});
const s3Client = new S3Client({});

// --- Google Auth ---

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Microsoft JWKS ---

const MICROSOFT_JWKS_URI = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const microsoftJWKS = createRemoteJWKSet(new URL(MICROSOFT_JWKS_URI));

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

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// --- CORS ---

export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowed = origin && CORS_ALLOWED_ORIGINS.includes(origin) ? origin : CORS_ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
}

// --- Auth helpers ---

/** Normalize an email for storage/comparison: trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * A verified user's identity. `sub` is the provider's stable user id
 * (Google sub / Microsoft oid). `email` is the verified, lowercased email
 * claim, or null when the provider did not supply a trustworthy one.
 */
export interface Identity {
  sub: string;
  email: string | null;
  provider: 'google' | 'microsoft' | 'dev';
}

/** Decode a JWT payload without verifying — only to inspect the issuer. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('Malformed token');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

export async function verifyGoogleIdToken(idToken: string): Promise<Identity> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new AuthError('Invalid token payload');
    }
    const email = payload.email && payload.email_verified ? normalizeEmail(payload.email) : null;
    return { sub: payload.sub, email, provider: 'google' };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid or expired Google ID token');
  }
}

export async function verifyMicrosoftIdToken(idToken: string): Promise<Identity> {
  if (!MICROSOFT_CLIENT_ID) {
    throw new AuthError('Microsoft authentication is not configured');
  }
  try {
    const { payload } = await jwtVerify(idToken, microsoftJWKS, {
      audience: MICROSOFT_CLIENT_ID,
    });
    const iss = payload.iss as string;
    if (!iss || !iss.startsWith('https://login.microsoftonline.com/')) {
      throw new AuthError('Invalid Microsoft token issuer');
    }
    const oid = (payload.oid || payload.sub) as string;
    if (!oid) {
      throw new AuthError('Invalid Microsoft token payload');
    }
    const rawEmail = (payload.email || payload.preferred_username) as string | undefined;
    const email = rawEmail && rawEmail.includes('@') ? normalizeEmail(rawEmail) : null;
    return { sub: oid, email, provider: 'microsoft' };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid or expired Microsoft ID token');
  }
}

/**
 * Verify an ID token from either Google or Microsoft. Detects the provider by
 * inspecting the JWT issuer claim. Any authenticated Google/Microsoft user is
 * accepted as a reporter — no pre-registration required.
 */
export async function verifyIdToken(idToken: string): Promise<Identity> {
  // Dev bypass: accept DEV_BYPASS_TOKEN in non-production environments only.
  if (DEV_BYPASS_TOKEN && idToken === DEV_BYPASS_TOKEN && STAGE !== 'prod') {
    return { sub: 'dev-test-user', email: 'dev-test-user@example.com', provider: 'dev' };
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

function extractBearerToken(authHeader?: string): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Authorization header with Bearer token is required');
  }
  return authHeader.slice(7);
}

export function isBootstrapAdmin(email: string | null): boolean {
  return !!email && BOOTSTRAP_ADMIN_EMAILS.includes(email);
}

/**
 * Whether the identity is an administrator. Admins are matched by verified
 * email (mirrors the classroom co-teacher model): either the email is in the
 * bootstrap env list, or there is an Admins-table row for it. A user without a
 * verified email can never be an admin.
 */
export async function isAdminIdentity(identity: Identity): Promise<boolean> {
  if (!identity.email) return false;
  if (isBootstrapAdmin(identity.email)) return true;
  const result = await docClient.send(new GetCommand({
    TableName: ADMINS_TABLE,
    Key: { email: identity.email },
  }));
  return !!result.Item;
}

/** Require admin or throw. Returns nothing; throws ForbiddenError (403) for
 * an authenticated non-admin. */
async function requireAdmin(identity: Identity): Promise<void> {
  if (!(await isAdminIdentity(identity))) {
    throw new ForbiddenError('Administrator privileges are required');
  }
}

/** Structured audit log for privileged actions — captured by CloudWatch. */
function audit(action: string, identity: Identity, extra: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({
    audit: true,
    action,
    adminSub: identity.sub,
    adminEmail: identity.email,
    ...extra,
  }));
}

// --- Validators ---

export function validateDescription(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError('description is required');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);
  }
  return trimmed;
}

export function validateProjectName(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new ValidationError('projectName must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_PROJECT_NAME_LENGTH) {
    throw new ValidationError(`projectName must be ${MAX_PROJECT_NAME_LENGTH} characters or less`);
  }
  return trimmed;
}

export function validateScreenshotCount(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(n) || n < 0 || n > MAX_SCREENSHOT_COUNT) {
    throw new ValidationError(`screenshotCount must be between 0 and ${MAX_SCREENSHOT_COUNT}`);
  }
  return n;
}

export function validateUserAgent(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new ValidationError('userAgent must be a string');
  }
  return value.slice(0, MAX_USER_AGENT_LENGTH);
}

export function validateAppContext(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError('appContext must be an object');
  }
  if (JSON.stringify(value).length > MAX_APP_CONTEXT_LENGTH) {
    throw new ValidationError('appContext is too large');
  }
  return value as Record<string, unknown>;
}

export function validateStatus(value: unknown): ReportStatus {
  if (typeof value !== 'string' || !VALID_STATUSES.includes(value as ReportStatus)) {
    throw new ValidationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  return value as ReportStatus;
}

export function validateDeveloperReply(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new ValidationError('developerReply must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_DEVELOPER_REPLY_LENGTH) {
    throw new ValidationError(`developerReply must be ${MAX_DEVELOPER_REPLY_LENGTH} characters or less`);
  }
  return trimmed;
}

/**
 * Validate an admin email supplied when inviting. Lenient shape check (a single
 * `@`, a dot in the domain, no spaces). Returns the normalized email.
 */
export function validateAdminEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('email is required');
  }
  const email = normalizeEmail(value);
  if (email.length === 0 || email.length > 254) {
    throw new ValidationError('email must be between 1 and 254 characters');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('email is not a valid email address');
  }
  return email;
}

// --- S3 key helpers ---

const projectKey = (reportId: string) => `${reportId}/project.sb3`;
const thumbnailKey = (reportId: string) => `${reportId}/thumbnail.png`;
const screenshotKey = (reportId: string, i: number) => `${reportId}/screenshot-${i}.png`;

// --- Reporter handlers ---

async function handleCreateReport(
  identity: Identity, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  const description = validateDescription(body.description);
  const projectName = validateProjectName(body.projectName);
  const screenshotCount = validateScreenshotCount(body.screenshotCount);
  const userAgent = validateUserAgent(body.userAgent);
  const appContext = validateAppContext(body.appContext);

  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: REPORTS_BUCKET,
      Key: projectKey(reportId),
      ContentType: 'application/octet-stream',
    }),
    { expiresIn: PRESIGNED_URL_UPLOAD_EXPIRY },
  );

  const thumbnailUploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: REPORTS_BUCKET,
      Key: thumbnailKey(reportId),
      ContentType: 'image/png',
    }),
    { expiresIn: PRESIGNED_URL_UPLOAD_EXPIRY },
  );

  const screenshotUploadUrls: string[] = [];
  for (let i = 0; i < screenshotCount; i++) {
    screenshotUploadUrls.push(await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: REPORTS_BUCKET,
        Key: screenshotKey(reportId, i),
        ContentType: 'image/png',
      }),
      { expiresIn: PRESIGNED_URL_UPLOAD_EXPIRY },
    ));
  }

  await docClient.send(new PutCommand({
    TableName: REPORTS_TABLE,
    Item: {
      reportId,
      entityType: ENTITY_TYPE,
      ownerSub: identity.sub,
      ownerEmail: identity.email,
      ownerProvider: identity.provider,
      description,
      projectName,
      userAgent,
      appContext,
      s3KeyProject: projectKey(reportId),
      s3KeyThumbnail: thumbnailKey(reportId),
      screenshotCount,
      status: 'open',
      developerReply: '',
      createdAt: now,
      updatedAt: now,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({
      reportId,
      uploadUrl,
      thumbnailUploadUrl,
      screenshotUploadUrls,
      createdAt: now,
    }),
  };
}

/**
 * List the caller's own reports (status + developer reply only). Never returns
 * S3 keys or download URLs — the reporter cannot download their submission.
 */
async function handleListMyReports(identity: Identity): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await docClient.send(new QueryCommand({
    TableName: REPORTS_TABLE,
    IndexName: 'ownerSub-createdAt-index',
    KeyConditionExpression: 'ownerSub = :sub',
    ExpressionAttributeValues: { ':sub': identity.sub },
    ScanIndexForward: false, // newest first
  }));

  // Reports the owner has hidden from their own list are dropped here. The row
  // is NOT deleted — it stays for the admins (so nothing is lost server-side).
  const reports = (result.Items || [])
    .filter(item => item.hiddenByOwner !== true)
    .map(item => ({
      reportId: item.reportId,
      description: item.description,
      projectName: item.projectName || null,
      status: item.status,
      developerReply: item.developerReply || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

  return { statusCode: 200, body: JSON.stringify({ reports }) };
}

/**
 * Hide/unhide one of the caller's OWN reports from their list. Sets the
 * `hiddenByOwner` flag — never deletes. Ownership is enforced: a report that
 * doesn't exist OR isn't owned by the caller returns 404 (no existence leak).
 */
async function handleSetReportHidden(
  identity: Identity, reportId: string, body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  if (typeof body.hidden !== 'boolean') {
    throw new ValidationError('hidden must be a boolean');
  }

  const result = await docClient.send(new GetCommand({ TableName: REPORTS_TABLE, Key: { reportId } }));
  if (!result.Item || result.Item.ownerSub !== identity.sub) {
    throw new NotFoundError('Report not found');
  }

  await docClient.send(new UpdateCommand({
    TableName: REPORTS_TABLE,
    Key: { reportId },
    UpdateExpression: 'SET hiddenByOwner = :h, updatedAt = :ua',
    ExpressionAttributeValues: { ':h': body.hidden, ':ua': new Date().toISOString() },
  }));

  return { statusCode: 200, body: JSON.stringify({ reportId, hiddenByOwner: body.hidden }) };
}

// --- Admin handlers ---

async function presignDownloadsForReport(item: Record<string, unknown>) {
  const ssCount = typeof item.screenshotCount === 'number' ? item.screenshotCount : 0;
  const reportId = item.reportId as string;
  const projectUrl = item.s3KeyProject
    ? await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: REPORTS_BUCKET, Key: item.s3KeyProject as string }), { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY })
    : null;
  const thumbnailUrl = item.s3KeyThumbnail
    ? await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: REPORTS_BUCKET, Key: item.s3KeyThumbnail as string }), { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY })
    : null;
  const screenshotUrls: string[] = [];
  for (let i = 0; i < ssCount; i++) {
    screenshotUrls.push(await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: REPORTS_BUCKET, Key: screenshotKey(reportId, i) }), { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY }));
  }
  return { projectUrl, thumbnailUrl, screenshotUrls };
}

function mapAdminReport(item: Record<string, unknown>) {
  return {
    reportId: item.reportId,
    ownerEmail: item.ownerEmail || null,
    ownerProvider: item.ownerProvider || null,
    description: item.description,
    projectName: item.projectName || null,
    userAgent: item.userAgent || null,
    appContext: item.appContext || null,
    screenshotCount: item.screenshotCount || 0,
    status: item.status,
    developerReply: item.developerReply || '',
    hiddenByOwner: item.hiddenByOwner === true,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function handleAdminListReports(identity: Identity, query: Record<string, string | undefined>): Promise<APIGatewayProxyStructuredResultV2> {
  await requireAdmin(identity);
  audit('admin.listReports', identity, { status: query.status });

  const result = await docClient.send(new QueryCommand({
    TableName: REPORTS_TABLE,
    IndexName: 'entityType-createdAt-index',
    KeyConditionExpression: 'entityType = :et',
    ExpressionAttributeValues: { ':et': ENTITY_TYPE },
    ScanIndexForward: false,
  }));

  let items = result.Items || [];
  if (query.status) {
    const wanted = validateStatus(query.status);
    items = items.filter(i => i.status === wanted);
  }

  // List view: metadata + thumbnail only (project DL fetched per-report on detail).
  const reports = await Promise.all(items.map(async item => {
    const thumbnailUrl = item.s3KeyThumbnail
      ? await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: REPORTS_BUCKET, Key: item.s3KeyThumbnail as string }), { expiresIn: PRESIGNED_URL_DOWNLOAD_EXPIRY })
      : null;
    return { ...mapAdminReport(item), thumbnailUrl };
  }));

  return { statusCode: 200, body: JSON.stringify({ reports }) };
}

async function handleAdminGetReport(identity: Identity, reportId: string): Promise<APIGatewayProxyStructuredResultV2> {
  await requireAdmin(identity);

  const result = await docClient.send(new GetCommand({ TableName: REPORTS_TABLE, Key: { reportId } }));
  if (!result.Item) {
    throw new NotFoundError('Report not found');
  }
  audit('admin.getReport', identity, { reportId });

  const downloads = await presignDownloadsForReport(result.Item);
  return {
    statusCode: 200,
    body: JSON.stringify({ ...mapAdminReport(result.Item), ...downloads }),
  };
}

async function handleAdminUpdateReport(identity: Identity, reportId: string, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  await requireAdmin(identity);

  const existing = await docClient.send(new GetCommand({ TableName: REPORTS_TABLE, Key: { reportId } }));
  if (!existing.Item) {
    throw new NotFoundError('Report not found');
  }

  const setParts: string[] = ['updatedAt = :ua'];
  const removeParts: string[] = [];
  const exprNames: Record<string, string> = {};
  const exprValues: Record<string, unknown> = { ':ua': new Date().toISOString() };

  let nextStatus: ReportStatus | undefined;
  if (body.status !== undefined) {
    nextStatus = validateStatus(body.status);
    setParts.push('#st = :st');
    exprNames['#st'] = 'status';
    exprValues[':st'] = nextStatus;
  }

  if (body.developerReply !== undefined) {
    const reply = validateDeveloperReply(body.developerReply);
    setParts.push('developerReply = :dr');
    exprValues[':dr'] = reply;
  }

  if (setParts.length === 1) {
    throw new ValidationError('No fields to update');
  }

  // Terminal status → apply TTL so the report (and its files) auto-expire.
  // Re-opening clears the TTL so it is kept again.
  if (nextStatus) {
    if (TERMINAL_STATUSES.includes(nextStatus)) {
      setParts.push('#ttl = :ttl');
      exprNames['#ttl'] = 'ttl';
      exprValues[':ttl'] = Math.floor(Date.now() / 1000) + RESOLVED_TTL_SECONDS;
    } else {
      removeParts.push('#ttl');
      exprNames['#ttl'] = 'ttl';
    }
  }

  let updateExpression = `SET ${setParts.join(', ')}`;
  if (removeParts.length > 0) {
    updateExpression += ` REMOVE ${removeParts.join(', ')}`;
  }

  await docClient.send(new UpdateCommand({
    TableName: REPORTS_TABLE,
    Key: { reportId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: Object.keys(exprNames).length > 0 ? exprNames : undefined,
    ExpressionAttributeValues: exprValues,
  }));

  audit('admin.updateReport', identity, { reportId, status: nextStatus });

  return {
    statusCode: 200,
    body: JSON.stringify({ reportId, status: nextStatus, updatedAt: exprValues[':ua'] }),
  };
}

async function handleListAdmins(identity: Identity): Promise<APIGatewayProxyStructuredResultV2> {
  await requireAdmin(identity);

  const result = await docClient.send(new ScanCommand({ TableName: ADMINS_TABLE }));
  const tableAdmins = (result.Items || []).map(item => ({
    email: item.email,
    displayName: item.displayName || null,
    addedBy: item.addedBy || null,
    addedAt: item.addedAt || null,
    isBootstrap: false,
  }));

  // Bootstrap admins always exist (env-driven) even without a table row.
  const tableEmails = new Set(tableAdmins.map(a => a.email));
  const bootstrapAdmins = BOOTSTRAP_ADMIN_EMAILS
    .filter(e => !tableEmails.has(e))
    .map(email => ({ email, displayName: null, addedBy: null, addedAt: null, isBootstrap: true }));

  return { statusCode: 200, body: JSON.stringify({ admins: [...bootstrapAdmins, ...tableAdmins] }) };
}

async function handleAddAdmin(identity: Identity, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  await requireAdmin(identity);
  const email = validateAdminEmail(body.email);

  await docClient.send(new PutCommand({
    TableName: ADMINS_TABLE,
    Item: {
      email,
      displayName: typeof body.displayName === 'string' ? body.displayName.slice(0, 100) : undefined,
      addedBy: identity.email,
      addedAt: new Date().toISOString(),
    },
  }));

  audit('admin.addAdmin', identity, { addedEmail: email });
  return { statusCode: 200, body: JSON.stringify({ email }) };
}

async function handleRemoveAdmin(identity: Identity, emailParam: string): Promise<APIGatewayProxyStructuredResultV2> {
  await requireAdmin(identity);
  const email = normalizeEmail(decodeURIComponent(emailParam));

  if (isBootstrapAdmin(email)) {
    throw new ValidationError('Bootstrap administrators cannot be removed via the API');
  }

  await docClient.send(new DeleteCommand({ TableName: ADMINS_TABLE, Key: { email } }));
  audit('admin.removeAdmin', identity, { removedEmail: email });
  return { statusCode: 200, body: JSON.stringify({ email }) };
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
    const body = event.body ? JSON.parse(event.body) : {};
    const query = event.queryStringParameters || {};

    let result: APIGatewayProxyStructuredResultV2;

    if (method === 'POST' && path === '/bug-reports') {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      result = await handleCreateReport(identity, body);

    } else if (method === 'GET' && path === '/bug-reports') {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      result = await handleListMyReports(identity);

    } else if (method === 'PATCH' && /^\/bug-reports\/[^/]+$/.test(path)) {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      const reportId = event.pathParameters?.reportId || '';
      result = await handleSetReportHidden(identity, reportId, body);

    } else if (method === 'GET' && path === '/admin/bug-reports') {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      result = await handleAdminListReports(identity, query);

    } else if (method === 'GET' && /^\/admin\/bug-reports\/[^/]+$/.test(path)) {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      const reportId = event.pathParameters?.reportId || '';
      result = await handleAdminGetReport(identity, reportId);

    } else if (method === 'PATCH' && /^\/admin\/bug-reports\/[^/]+$/.test(path)) {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      const reportId = event.pathParameters?.reportId || '';
      result = await handleAdminUpdateReport(identity, reportId, body);

    } else if (method === 'GET' && path === '/admin/admins') {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      result = await handleListAdmins(identity);

    } else if (method === 'POST' && path === '/admin/admins') {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      result = await handleAddAdmin(identity, body);

    } else if (method === 'DELETE' && /^\/admin\/admins\/.+$/.test(path)) {
      const identity = await verifyIdToken(extractBearerToken(event.headers?.authorization));
      const email = event.pathParameters?.email || '';
      result = await handleRemoveAdmin(identity, email);

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
    if (err instanceof ForbiddenError) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof NotFoundError) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof SyntaxError) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
