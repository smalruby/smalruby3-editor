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
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';

// --- Configuration ---

const CLASSROOMS_TABLE = process.env.CLASSROOMS_TABLE_NAME || 'Classrooms';
const MEMBERSHIPS_TABLE = process.env.MEMBERSHIPS_TABLE_NAME || 'ClassroomMemberships';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

const MAX_CLASS_NAME_LENGTH = 50;
const MAX_STUDENT_COUNT = 50;
const MAX_NICKNAME_LENGTH = 20;
// 6-digit alphanumeric, excluding confusing chars (I, O, 0, 1)
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;
// Session token validity: 30 days (for classroom sessions spanning a semester)
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
// Classroom TTL: 1 year
const CLASSROOM_TTL_SECONDS = 365 * 24 * 60 * 60;

// --- DynamoDB Client ---

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// --- Google Auth ---

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// --- Exported helpers (for testing) ---

export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowed = origin && CORS_ALLOWED_ORIGINS.includes(origin) ? origin : CORS_ALLOWED_ORIGINS[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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
  return code.trim().toUpperCase();
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
  const studentCount = validateStudentCount(body.studentCount);

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

  await docClient.send(new PutCommand({
    TableName: CLASSROOMS_TABLE,
    Item: {
      classroomId,
      teacherSub,
      className,
      joinCode,
      studentCount,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ttl: Math.floor(Date.now() / 1000) + CLASSROOM_TTL_SECONDS,
    },
  }));

  return {
    statusCode: 201,
    body: JSON.stringify({ classroomId, className, joinCode, studentCount, status: 'active', createdAt: now }),
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
      joinCode: item.joinCode,
      studentCount: item.studentCount,
      createdAt: item.createdAt,
    }));

  return { statusCode: 200, body: JSON.stringify({ classrooms }) };
}

async function handleGetClassroom(classroomId: string): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await docClient.send(new GetCommand({
    TableName: CLASSROOMS_TABLE,
    Key: { classroomId },
  }));

  if (!result.Item || result.Item.status !== 'active') {
    throw new NotFoundError('Classroom not found');
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      classroomId: result.Item.classroomId,
      className: result.Item.className,
      joinCode: result.Item.joinCode,
      studentCount: result.Item.studentCount,
      status: result.Item.status,
      createdAt: result.Item.createdAt,
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
      joinCode: result.Attributes?.joinCode,
      studentCount: result.Attributes?.studentCount,
      status: result.Attributes?.status,
    }),
  };
}

async function handleJoinClassroom(body: Record<string, unknown>): Promise<APIGatewayProxyStructuredResultV2> {
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

  // Check if seat is already taken
  const existingMember = await docClient.send(new GetCommand({
    TableName: MEMBERSHIPS_TABLE,
    Key: { classroomId: classroom.classroomId, memberId },
  }));

  if (existingMember.Item) {
    throw new ConflictError(`Seat ${seatNumber} is already taken`);
  }

  const sessionToken = generateSessionToken();
  const now = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: MEMBERSHIPS_TABLE,
    Item: {
      classroomId: classroom.classroomId,
      memberId,
      displayName: nickname,
      role: 'student',
      sessionToken,
      joinedAt: now,
      ttl: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    },
  }));

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

  const result = await docClient.send(new QueryCommand({
    TableName: MEMBERSHIPS_TABLE,
    KeyConditionExpression: 'classroomId = :cid',
    ExpressionAttributeValues: { ':cid': classroomId },
  }));

  const members = (result.Items || []).map(item => ({
    memberId: item.memberId,
    displayName: item.displayName,
    role: item.role,
    joinedAt: item.joinedAt,
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ members, studentCount: classroom.Item.studentCount }),
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
      result = await handleJoinClassroom(body);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+$/.test(path)) {
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleGetClassroom(classroomId);

    } else if (method === 'PATCH' && /^\/classrooms\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleUpdateClassroom(teacherSub, classroomId, body);

    } else if (method === 'GET' && /^\/classrooms\/[^/]+\/members$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      result = await handleListMembers(teacherSub, classroomId);

    } else if (method === 'DELETE' && /^\/classrooms\/[^/]+\/members\/[^/]+$/.test(path)) {
      const token = extractBearerToken(event.headers?.authorization);
      const teacherSub = await verifyGoogleIdToken(token);
      const classroomId = event.pathParameters?.classroomId || '';
      const memberId = event.pathParameters?.memberId || '';
      result = await handleDeleteMember(teacherSub, classroomId, memberId);

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
    if (err instanceof SyntaxError) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
