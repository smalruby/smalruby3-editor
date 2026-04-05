import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

// --- Configuration ---

const CLASSROOMS_TABLE = process.env.CLASSROOMS_TABLE_NAME || 'Classrooms';
const MEMBERSHIPS_TABLE = process.env.MEMBERSHIPS_TABLE_NAME || 'ClassroomMemberships';
const SUBMISSIONS_TABLE = process.env.SUBMISSIONS_TABLE_NAME || 'ClassroomSubmissions';
const SUBMISSIONS_BUCKET = process.env.SUBMISSIONS_BUCKET_NAME || 'smalruby-classroom-submissions';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

const MAX_CLASS_NAME_LENGTH = 50;
const MAX_STUDENT_COUNT = 50;
const MAX_NICKNAME_LENGTH = 20;
// 6-digit alphanumeric, excluding confusing chars (I, O, 0, 1)
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;
// Classroom TTL from environment (default 30 days)
const CLASSROOM_TTL_DAYS = parseInt(process.env.CLASSROOM_TTL_DAYS || '30', 10);
const CLASSROOM_TTL_SECONDS = CLASSROOM_TTL_DAYS * 24 * 60 * 60;
// Session and membership TTL matches classroom TTL
const SESSION_TTL_SECONDS = CLASSROOM_TTL_SECONDS;
// Rate limiting for join endpoint (per IP)
const JOIN_RATE_LIMIT_WINDOW_SECONDS = parseInt(process.env.JOIN_RATE_LIMIT_WINDOW_SECONDS || '60', 10);
const JOIN_RATE_LIMIT_MAX_ATTEMPTS = parseInt(process.env.JOIN_RATE_LIMIT_MAX_ATTEMPTS || '50', 10);
const JOIN_CODE_REGEX = new RegExp(`^[${JOIN_CODE_CHARS}]{${JOIN_CODE_LENGTH}}$`);
// Session activity TTL — determines "seated" status for teachers (default 1 hour)
const SESSION_ACTIVE_TTL_SECONDS = parseInt(process.env.SESSION_ACTIVE_TTL_SECONDS || '3600', 10);
// Submission config (TTL matches classroom TTL)
const SUBMISSION_TTL_SECONDS = CLASSROOM_TTL_SECONDS;
const MAX_PROJECT_NAME_LENGTH = 100;
const PRESIGNED_URL_UPLOAD_EXPIRY = parseInt(process.env.PRESIGNED_URL_UPLOAD_EXPIRY || '900', 10); // default 15 minutes
const PRESIGNED_URL_DOWNLOAD_EXPIRY = parseInt(process.env.PRESIGNED_URL_DOWNLOAD_EXPIRY || '3600', 10); // default 1 hour
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_SCREENSHOT_COUNT = 20;
const MAX_TEACHER_COMMENT_LENGTH = 500;

// --- DynamoDB Client ---

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// --- S3 Client ---

const s3Client = new S3Client({});

// --- Google Auth ---

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Exported helpers (for testing) ---

export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowed = origin && CORS_ALLOWED_ORIGINS.includes(origin) ? origin : CORS_ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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
  const upper = code.trim().toUpperCase();
  if (!JOIN_CODE_REGEX.test(upper)) {
    throw new ValidationError('Join code contains invalid characters');
  }
  return upper;
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

// --- Auth helpers ---

export async function verifyGoogleIdToken(idToken: string): Promise<string> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new AuthError('Invalid token payload');
    }
    return payload.sub;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid or expired Google ID token');
  }
}

function extractBearerToken(authHeader?: string): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Authorization header with Bearer token is required');
  }
  return authHeader.slice(7);
}

// --- Route handlers ---

async function handleCreateClassroom(teacherSub: string, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  const className = validateClassName(body.className);
  const assignmentName = validateClassName(body.assignmentName); // reuse same validator (1-50 chars)
  const studentCount = validateStudentCount(body.studentCount);
  const googleClassroomCourseId = typeof body.googleClassroomCourseId === 'string' ? body.googleClassroomCourseId.trim() : undefined;

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
      teacherSub,
      className,
      assignmentName,
      joinCode,
      studentCount,
      googleClassroomCourseId: googleClassroomCourseId || undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ttl,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({ classroomId, className, assignmentName, joinCode, studentCount, googleClassroomCourseId: googleClassroomCourseId || null, status: 'active', createdAt: now, expiresAt }),
  };
}

async function handleListClassrooms(teacherSub: string): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await docClient.send(new QueryCommand({
    TableName: CLASSROOMS_TABLE,
    IndexName: 'teacherSub-index',
    KeyConditionExpression: 'teacherSub = :ts',
    ExpressionAttributeValues: { ':ts': teacherSub },
  }));

  const classrooms = (result.Items || [])
    .filter(item => item.status === 'active')
    .map(item => ({
      classroomId: item.classroomId,
      className: item.className,
      assignmentName: item.assignmentName || null,
      joinCode: item.joinCode,
      studentCount: item.studentCount,
      googleClassroomCourseId: item.googleClassroomCourseId || null,
      createdAt: item.createdAt,
      expiresAt: item.ttl ? new Date((item.ttl as number) * 1000).toISOString() : null,
    }));

  return { statusCode: 200, body: JSON.stringify({ classrooms }) };
}

async function handleGetClassroom(teacherSub: string, classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));

  if (!result.Item || result.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }
  if (result.Item.teacherSub !== teacherSub) {
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
      status: result.Item.status,
      createdAt: result.Item.createdAt,
      expiresAt: result.Item.ttl ? new Date((result.Item.ttl as number) * 1000).toISOString() : null,
    }),
  };
}

async function handleUpdateClassroom(teacherSub: string, classroomId: string, body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || classroom.Item.teacherSub !== teacherSub) {
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

  const seatNumber = validateSeatNumber(body.seatNumber, classroom.studentCount);
  const nickname = validateNickname(body.nickname);
  const memberId = `seat-${String(seatNumber).padStart(2, '0')}`;

  const sessionToken = generateSessionToken();
  const now = new Date().toISOString();

  // Atomic put with condition to prevent race condition on seat assignment
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
      ConditionExpression: 'attribute_not_exists(classroomId) AND attribute_not_exists(memberId)',
    }));
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ConditionalCheckFailedException') {
      throw new ConflictError(`Seat ${seatNumber} is already taken`);
    }
    throw err;
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      sessionToken,
      classroomId: classroom.classroomId,
      className: classroom.className,
      seatNumber,
      memberId,
    }),
  };
}

async function handleListMembers(teacherSub: string, classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || classroom.Item.teacherSub !== teacherSub) {
    throw new AuthError('Not authorized to view this classroom');
  }

  // Fetch members and submissions in parallel
  const [membersResult, submissionsResult] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: MEMBERSHIPS_TABLE,
      KeyConditionExpression: 'classroomId = :cid',
      ExpressionAttributeValues: { ':cid': classroomId },
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

async function handleDeleteClassroom(teacherSub: string, classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || classroom.Item.teacherSub !== teacherSub) {
    throw new AuthError('Not authorized to delete this classroom');
  }
  if (classroom.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }

  // Soft-delete: set status to 'archived'
  await docClient.send(new UpdateCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
    UpdateExpression: 'SET #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': 'archived', ':now': new Date().toISOString() },
  }));

  // Delete all members (invalidates their sessions)
  const membersResult = await docClient.send(new QueryCommand({
    TableName: MEMBERSHIPS_TABLE,
    KeyConditionExpression: 'classroomId = :cid',
    ExpressionAttributeValues: { ':cid': classroomId },
    ProjectionExpression: 'memberId',
  }));

  if (membersResult.Items && membersResult.Items.length > 0) {
    const items = membersResult.Items;
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [MEMBERSHIPS_TABLE]: batch.map(item => ({
            DeleteRequest: { Key: { classroomId, memberId: item.memberId as string } },
          })),
        },
      }));
    }
  }

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

  // Get taken seats
  const membersResult = await docClient.send(new QueryCommand({
    TableName: MEMBERSHIPS_TABLE,
    KeyConditionExpression: 'classroomId = :cid',
    ExpressionAttributeValues: { ':cid': classroom.classroomId },
    ProjectionExpression: 'memberId',
  }));

  const takenSeats = (membersResult.Items || []).map(item => {
    const match = (item.memberId as string).match(/^seat-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }).filter(n => n > 0);

  return {
    statusCode: 200,
    body: JSON.stringify({
      classroomId: classroom.classroomId,
      className: classroom.className,
      studentCount: classroom.studentCount,
      takenSeats,
    }),
  };
}

async function handleDeleteMember(teacherSub: string, classroomId: string, memberId: string): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || classroom.Item.teacherSub !== teacherSub) {
    throw new AuthError('Not authorized to modify this classroom');
  }

  await docClient.send(new DeleteCommand({
    TableName: MEMBERSHIPS_TABLE,
    Key: { classroomId, memberId },
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
  teacherSub: string, classroomId: string
): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || classroom.Item.teacherSub !== teacherSub) {
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
  teacherSub: string, classroomId: string, submissionId: string, body: Record<string, unknown>
): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify ownership
  const classroom = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!classroom.Item || classroom.Item.teacherSub !== teacherSub) {
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
  teacherSub: string,
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
      teacherSub,
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

async function handlePostAssignment(
  teacherSub: string,
  accessToken: string,
  classroomId: string,
  body: Record<string, unknown>,
): Promise<APIGatewayProxyStructuredResultV2> {
  // Verify classroom ownership and get googleClassroomCourseId
  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));
  if (!result.Item || result.Item.teacherSub !== teacherSub) {
    throw new NotFoundError('Classroom not found');
  }
  const courseId = result.Item.googleClassroomCourseId as string;
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
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  const courseWork = await callGoogleClassroomAPI(accessToken, `courses/${courseId}/courseWork`, 'POST', {
    title: title.trim(),
    description: description || undefined,
    workType: 'ASSIGNMENT',
    state: 'PUBLISHED',
    materials: [{ link: { url: link, title: 'スモウルビーで開く' } }],
  }) as { id: string; alternateLink: string };

  return {
    statusCode: 201,
    body: JSON.stringify({
      courseWorkId: courseWork.id,
      alternateLink: courseWork.alternateLink,
    }),
  };
}

async function handleVerifySession(sessionToken: string): Promise<APIGatewayProxyStructuredResultV2> {
  // verifySessionToken will throw AuthError if invalid
  const session = await verifySessionToken(sessionToken);

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

  // Look up latest submission for this member
  let submission: Record<string, unknown> | null = null;
  const subResult = await docClient.send(new QueryCommand({
    TableName: SUBMISSIONS_TABLE,
    IndexName: 'classroomId-memberId-index',
    KeyConditionExpression: 'classroomId = :cid AND memberId = :mid',
    ExpressionAttributeValues: {
      ':cid': session.classroomId,
      ':mid': session.memberId,
    },
    ScanIndexForward: false,
    Limit: 1,
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
    body: JSON.stringify({ valid: true, submission }),
  };
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
      const teacherSub = await verifyGoogleIdToken(token);
      result = await handleCreateClassroom(teacherSub, body);

    } else if (method === 'GET' && path === '/classrooms') {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      result = await handleListClassrooms(teacherSub);

    } else if (method === 'POST' && path === '/classrooms/join') {
      const sourceIp = event.requestContext.http.sourceIp || 'unknown';
      result = await handleJoinClassroom(sourceIp, body);

    } else if (method === 'POST' && path === '/classrooms/lookup') {
      const sourceIp = event.requestContext.http.sourceIp || 'unknown';
      result = await handleLookupClassroom(sourceIp, body);

    } else if (method === 'POST' && path === '/classrooms/verify-session') {
      const token = extractBearerToken(event.headers?.authorization);
      result = await handleVerifySession(token);

    // --- Google Classroom routes (must be before /classrooms/{classroomId}) ---
    } else if (method === 'GET' && path === '/classrooms/google-courses') {
      const token = extractBearerToken(event.headers?.authorization);
      await verifyGoogleIdToken(token);
      const accessToken = extractGoogleAccessToken(event.headers);
      result = await handleListGoogleCourses(accessToken);

    } else if (method === 'POST' && path === '/classrooms/google-import') {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const accessToken = extractGoogleAccessToken(event.headers);
      result = await handleImportGoogleClassroom(teacherSub, accessToken, body);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleGetClassroom(teacherSub, classroomId);

    } else if (method === 'PATCH' && /^\/classrooms\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleUpdateClassroom(teacherSub, classroomId, body);

    } else if (method === 'DELETE' && /^\/classrooms\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleDeleteClassroom(teacherSub, classroomId);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+\/members$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleListMembers(teacherSub, classroomId);

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
        // Teacher removal via Google ID token
        const token = extractBearerToken(event.headers?.authorization);
        const teacherSub = await verifyGoogleIdToken(token);
        result = await handleDeleteMember(teacherSub, classroomId, memberId);
      }

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
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleListSubmissions(teacherSub, classroomId);

    } else if (method === 'PATCH' && /^\/classrooms\/[^/]+\/submissions\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      const submissionId = event.pathParameters?.submissionId || '';
      result = await handleUpdateSubmission(teacherSub, classroomId, submissionId, body);

    } else if (method === 'POST' && /^\/classrooms\/[^/]+\/google-assignment$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const accessToken = extractGoogleAccessToken(event.headers);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handlePostAssignment(teacherSub, accessToken, classroomId, body);

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
