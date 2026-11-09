/* eslint-disable no-console */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';
import {
  MAX_TAKEOVER_MESSAGE_LENGTH,
  MAX_TAKEOVER_CURRENT_CODE_LENGTH,
  MAX_TAKEOVER_HISTORY_TURN_TEXT_LENGTH,
  MAX_TAKEOVER_REQUEST_BYTES,
  TAKEOVER_JOB_TTL_SECONDS,
  TakeoverWorkerPayload,
  JobItem,
  takeoverRateLimitPlan,
  seatCurrentKey,
  usageKey,
  usageUpdateExpression,
  UsageOutcome,
  UsageTokens,
  isValidJobId,
  jobResponseBody,
} from './takeover';
import {
  SESSION_TOKEN_INDEX_NAME,
  SeatIdentity,
  isSessionTokenFormat,
  seatIdentityFromMembership,
} from './seat-session';

// ---------------------------------------------------------------------------
// Configuration (from environment variables)
// ---------------------------------------------------------------------------
const RATE_LIMIT_TABLE_NAME = process.env.RATE_LIMIT_TABLE_NAME || '';
const RATE_LIMIT_WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '35', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '40', 10);
const MIN_USER_MESSAGE_LENGTH = parseInt(process.env.MIN_USER_MESSAGE_LENGTH || '10', 10);
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'https://smalruby.app').split(',').map(o => o.trim());
const MAX_FIELD_NAME_LENGTH = 100;       // sprite/costume/sound names
const MAX_HISTORY_TURNS = 20;            // conversation turns
// 「ルビティーにまかせる」(takeover) 用
const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME || '';
const USAGE_TABLE_NAME = process.env.USAGE_TABLE_NAME || '';
const TAKEOVER_WORKER_FUNCTION_NAME = process.env.TAKEOVER_WORKER_FUNCTION_NAME || '';
// 1 席あたり（classroom + seat）の上限。今の IP 単位と同じ 40 回
const TAKEOVER_SEAT_MAX_REQUESTS = parseInt(process.env.TAKEOVER_SEAT_MAX_REQUESTS || '40', 10);
// 1 つの教室（同じ IP）から出る席ぶん（40 人 × 40 回）。確かめた席でも IP の上限を重ねる
const TAKEOVER_IP_MAX_REQUESTS = parseInt(process.env.TAKEOVER_IP_MAX_REQUESTS || '1600', 10);
// クラス管理の memberships 表（別スタック・読み取り専用）。sessionToken から席を確かめる (#1317)
const CLASSROOM_MEMBERSHIPS_TABLE_NAME = process.env.CLASSROOM_MEMBERSHIPS_TABLE_NAME || '';

// Request purposes. 受け付けるのは「ルビティーにまかせる」だけ。Ruby タブの旧チャット
// （purpose 未指定）は GUI から外したので 410 で断る (#1405)。
const PURPOSE_GENAI_TAKEOVER = 'genai-takeover';
const KNOWN_PURPOSES = [PURPOSE_GENAI_TAKEOVER];

// ---------------------------------------------------------------------------
// DynamoDB client
// ---------------------------------------------------------------------------
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const lambdaClient = new LambdaClient({});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ContentPart {
  text: string;
}

interface HistoryTurn {
  role: 'user' | 'model';
  parts: ContentPart[];
}

interface SpriteState {
  name: string;
  x: number;
  y: number;
  size: number;
  direction: number;
  costumes: Array<{ name: string }>;
  sounds: Array<{ name: string }>;
  currentCode?: string;
}

interface StageState {
  width: number;
  height: number;
  costumes: Array<{ name: string }>;
  sounds?: Array<{ name: string }>;
}

interface VmState {
  extensions: string[];
}

interface StateContext {
  sprite?: SpriteState;
  stage?: StageState;
  vm?: VmState;
}

interface RelayRequest {
  userMessage: string;
  history?: HistoryTurn[];
  stateContext?: StateContext;
  // Optional (all backward compatible): what the request is for, and who in a class sent it.
  purpose?: unknown;
  // 生徒がクラスに参加したときにもらうトークン。席はここから relay が確かめる (#1317)
  sessionToken?: unknown;
  // 自己申告の classroom / seat は信じない（送られてきても無視する）
  classroom?: unknown;
  seat?: unknown;
}

interface UsageContext {
  purpose?: string;
  classroom?: string;
  seat?: string;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
// 単語の境目で照合する。境目なしだと `interact as` / `exact as` / `you are nowhere` のような
// 普通の英文（生成AIの答えのコメントなど）にも当たり、相談が INVALID_INPUT になる (#1335)。
// 末尾が活用・複数形になりうるもの（prompts / jailbreaking / personas / pretend your）は
// 判定を弱めないよう末尾の境目を付けない。
const DANGEROUS_PATTERNS = [
  /\bignore previous instructions\b/i,
  /\bforget everything\b/i,
  /\byou are now\b/i,
  /\bact as\b/i,
  /\bpretend you/i,
  /\bnew persona/i,
  /\bsystem prompt/i,
  /\bjailbreak/i,
];

export function validateStateContext(
  stateContext?: StateContext,
  maxCurrentCodeLength: number = MAX_TAKEOVER_CURRENT_CODE_LENGTH,
): { valid: boolean; error?: string } {
  if (!stateContext) return { valid: true };

  const isInvalidName = (name: string) =>
    name.length > MAX_FIELD_NAME_LENGTH || /[\r\n]/.test(name);

  if (stateContext.sprite) {
    const s = stateContext.sprite;
    if (s.name && isInvalidName(s.name)) {
      return { valid: false, error: 'INVALID_STATE_CONTEXT' };
    }
    for (const c of s.costumes || []) {
      if (c.name && isInvalidName(c.name)) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
    }
    for (const snd of s.sounds || []) {
      if (snd.name && isInvalidName(snd.name)) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
    }
    if (s.currentCode) {
      if (s.currentCode.length > maxCurrentCodeLength) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(s.currentCode)) {
          return { valid: false, error: 'INVALID_STATE_CONTEXT' };
        }
      }
    }
  }

  if (stateContext.stage) {
    const st = stateContext.stage;
    for (const c of st.costumes || []) {
      if (c.name && isInvalidName(c.name)) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
    }
    for (const snd of st.sounds || []) {
      if (snd.name && isInvalidName(snd.name)) {
        return { valid: false, error: 'INVALID_STATE_CONTEXT' };
      }
    }
  }

  for (const ext of stateContext.vm?.extensions || []) {
    if (isInvalidName(ext)) {
      return { valid: false, error: 'INVALID_STATE_CONTEXT' };
    }
  }

  return { valid: true };
}

export function validateHistory(
  history?: HistoryTurn[],
  maxTurnTextLength: number = MAX_TAKEOVER_HISTORY_TURN_TEXT_LENGTH,
): { valid: boolean; error?: string } {
  if (!history) return { valid: true };
  if (history.length > MAX_HISTORY_TURNS) {
    return { valid: false, error: 'HISTORY_TOO_LONG' };
  }
  for (const turn of history) {
    for (const part of turn.parts) {
      if (part.text && part.text.length > maxTurnTextLength) {
        return { valid: false, error: 'HISTORY_TOO_LONG' };
      }
    }
  }
  return { valid: true };
}

export function validateInput(
  userMessage: string,
  maxLength: number = MAX_TAKEOVER_MESSAGE_LENGTH,
): { valid: boolean; error?: string } {
  if (!userMessage || typeof userMessage !== 'string') {
    return { valid: false, error: 'INPUT_MISSING' };
  }
  if (userMessage.length < MIN_USER_MESSAGE_LENGTH) {
    return { valid: false, error: 'INPUT_TOO_SHORT' };
  }
  if (userMessage.length > maxLength) {
    return { valid: false, error: 'INPUT_TOO_LONG' };
  }
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(userMessage)) {
      return { valid: false, error: 'INVALID_INPUT' };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Rate limiting (DynamoDB fixed window)
// ---------------------------------------------------------------------------
export function getCurrentWindowStart(): number {
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  return Math.floor(Date.now() / windowMs) * windowMs / 1000; // epoch seconds
}

export async function checkAndIncrementRateLimit(
  sourceIp: string,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
): Promise<{
  allowed: boolean;
  resetAfterSeconds?: number;
  // 数えられたとき（DynamoDB が使えたとき）だけ入る
  count?: number;
  resetAt?: number;
}> {
  const windowStart = getCurrentWindowStart();
  const windowDurationSeconds = RATE_LIMIT_WINDOW_MINUTES * 60;
  const ttl = windowStart + windowDurationSeconds;

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: RATE_LIMIT_TABLE_NAME,
      Key: { sourceIp, windowStart },
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl',
      ExpressionAttributeNames: { '#count': 'count', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':ttl': ttl },
      ReturnValues: 'ALL_NEW',
    }));

    const count = result.Attributes?.count as number;
    if (count > maxRequests) {
      const now = Math.floor(Date.now() / 1000);
      const resetAfterSeconds = ttl - now;
      return { allowed: false, resetAfterSeconds: Math.max(0, resetAfterSeconds), count, resetAt: ttl };
    }
    return { allowed: true, count, resetAt: ttl };
  } catch (err) {
    // Fail open: if DynamoDB is unavailable, allow the request
    console.error('[RateLimit] DynamoDB error, failing open:', err);
    return { allowed: true };
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const allowedOrigin = origin && CORS_ALLOWED_ORIGINS.includes(origin) ? origin : CORS_ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ---------------------------------------------------------------------------
// Usage context
// ---------------------------------------------------------------------------
/**
 * Pick the purpose, and the classroom / seat verified from the sessionToken, to record in
 * CloudWatch and the usage table. The request's own classroom / seat are self-declared and
 * are never used (#1317): anyone who knows a classroomId could otherwise spend another
 * student's seat quota or write usage rows for any classroom.
 * Invalid purposes are dropped (not rejected) so that existing clients keep working.
 */
export function extractUsageContext(body: { purpose?: unknown }, seat?: SeatIdentity | null): UsageContext {
  const ctx: UsageContext = {};
  if (typeof body.purpose === 'string' && KNOWN_PURPOSES.includes(body.purpose)) {
    ctx.purpose = body.purpose;
  }
  if (seat) {
    ctx.classroom = seat.classroom;
    ctx.seat = seat.seat;
  }
  return ctx;
}

/**
 * sessionToken をクラス管理の memberships 表（GSI sessionToken-index・読み取り専用）で引き、
 * 席として数えてよい classroom / seat を返す。確かめられないとき（トークンなし・形が違う・
 * 見つからない・kicked・表が読めない）は null = 席として数えず IP だけの上限にする。
 * 不正防止の判定なので fail-open（席として信じる）にはしないが、答えは返す。
 */
export async function verifySeatSession(sessionToken: unknown): Promise<SeatIdentity | null> {
  if (!CLASSROOM_MEMBERSHIPS_TABLE_NAME || !isSessionTokenFormat(sessionToken)) return null;
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CLASSROOM_MEMBERSHIPS_TABLE_NAME,
      IndexName: SESSION_TOKEN_INDEX_NAME,
      KeyConditionExpression: 'sessionToken = :st',
      ExpressionAttributeValues: { ':st': sessionToken },
      // 席の判定に要る属性だけを読む（行には生徒の displayName などもあるが relay には要らない）
      ProjectionExpression: 'classroomId, memberId, kicked',
      Limit: 1,
    }));
    return seatIdentityFromMembership(result.Items?.[0]);
  } catch (err) {
    console.error('[Seat] failed to verify sessionToken, counting by IP only:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Usage (集計表・RETAIN) / seat status / takeover jobs
// ---------------------------------------------------------------------------
/** 集計表に回数（とトークン数）を足し込む。失敗しても答えは返す（fail-open）。 */
export async function recordUsage(
  usageContext: UsageContext,
  outcomes: UsageOutcome[],
  tokens?: UsageTokens,
): Promise<void> {
  if (!USAGE_TABLE_NAME) return;
  try {
    await docClient.send(new UpdateCommand({
      TableName: USAGE_TABLE_NAME,
      Key: usageKey({ ...usageContext, nowMs: Date.now() }),
      ...usageUpdateExpression(outcomes, tokens),
    }));
  } catch (err) {
    console.error('[Usage] DynamoDB error, ignoring:', err);
  }
}

/**
 * 席ごとの「今の状況」の 1 行を上書きする（クラス管理のメンバー一覧が読む）。
 * 上限と窓も書いておき、クラス管理側に計算を持たせない。fail-open。
 */
export async function writeSeatCurrent(params: {
  classroom: string;
  seat: string;
  count: number;
  limit: number;
  resetAt: number;
}): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: RATE_LIMIT_TABLE_NAME,
      Item: {
        ...seatCurrentKey(params.classroom, params.seat),
        count: params.count,
        limit: params.limit,
        windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
        resetAt: params.resetAt,
        ttl: params.resetAt,
      },
    }));
  } catch (err) {
    console.error('[RateLimit] failed to write seat status, ignoring:', err);
  }
}

function jsonResponse(statusCode: number, corsHeaders: Record<string, string>, payload: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

/** GET /jobs/{jobId}: takeover の答えを取りに来る。レート制限の回数には数えない。 */
export async function handleGetJob(jobId: unknown, corsHeaders: Record<string, string>): Promise<APIGatewayProxyResultV2> {
  if (!isValidJobId(jobId)) {
    return jsonResponse(400, corsHeaders, { error: 'INVALID_JOB_ID' });
  }
  try {
    const result = await docClient.send(new GetCommand({
      TableName: JOBS_TABLE_NAME,
      Key: { jobId },
    }));
    const job = result.Item as JobItem | undefined;
    if (!job) {
      return jsonResponse(404, corsHeaders, { error: 'JOB_NOT_FOUND' });
    }
    return jsonResponse(200, corsHeaders, jobResponseBody(job, Math.floor(Date.now() / 1000)));
  } catch (err) {
    console.error('[Jobs] DynamoDB error:', err);
    return jsonResponse(500, corsHeaders, { error: 'INTERNAL_ERROR' });
  }
}

/**
 * takeover: レート制限（1 席 + IP、または今の IP 単位）→ ジョブを pending で作る →
 * worker を非同期で起動 → 202 { jobId }。入力はジョブに保存せず、worker の payload だけで渡す。
 */
export async function handleTakeover(params: {
  body: RelayRequest;
  usageContext: UsageContext;
  sourceIp: string;
  corsHeaders: Record<string, string>;
}): Promise<APIGatewayProxyResultV2> {
  const { body, usageContext, sourceIp, corsHeaders } = params;
  const plan = takeoverRateLimitPlan({
    sourceIp,
    classroom: usageContext.classroom,
    seat: usageContext.seat,
    seatLimit: TAKEOVER_SEAT_MAX_REQUESTS,
    ipLimit: TAKEOVER_IP_MAX_REQUESTS,
    defaultLimit: RATE_LIMIT_MAX_REQUESTS,
  });
  for (const entry of plan) {
    const result = await checkAndIncrementRateLimit(entry.key, entry.limit);
    if (entry.seat && result.count !== undefined && result.resetAt !== undefined
      && usageContext.classroom && usageContext.seat) {
      await writeSeatCurrent({
        classroom: usageContext.classroom,
        seat: usageContext.seat,
        count: Math.min(result.count, entry.limit),
        limit: entry.limit,
        resetAt: result.resetAt,
      });
    }
    if (!result.allowed) {
      console.log(`[RateLimit] Takeover blocked: ${entry.seat ? 'seat' : 'ip'}, resetAfterSeconds: ${result.resetAfterSeconds}`);
      await recordUsage(usageContext, ['requests', 'rateLimited']);
      return jsonResponse(429, corsHeaders, {
        error: 'RATE_LIMIT_EXCEEDED',
        resetAfterSeconds: result.resetAfterSeconds,
      });
    }
  }

  const jobId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const payload: TakeoverWorkerPayload = {
    jobId,
    userMessage: body.userMessage,
    history: body.history,
    stateContext: body.stateContext,
    usageContext,
  };
  try {
    await docClient.send(new PutCommand({
      TableName: JOBS_TABLE_NAME,
      Item: { jobId, status: 'pending', createdAt: now, ttl: now + TAKEOVER_JOB_TTL_SECONDS },
    }));
    await lambdaClient.send(new InvokeCommand({
      FunctionName: TAKEOVER_WORKER_FUNCTION_NAME,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(payload)),
    }));
  } catch (err) {
    console.error('[Takeover] failed to start job:', err);
    await recordUsage(usageContext, ['requests', 'failed']);
    return jsonResponse(500, corsHeaders, { error: 'INTERNAL_ERROR' });
  }
  await recordUsage(usageContext, ['requests']);
  return jsonResponse(202, corsHeaders, { jobId, status: 'pending' });
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const origin = event.headers?.origin;
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // GET /jobs/{jobId} (takeover の答えを取りに来る)
  if (event.requestContext.http.method === 'GET') {
    return handleGetJob(event.pathParameters?.jobId, corsHeaders);
  }

  // Parse body
  let body: RelayRequest;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'INVALID_JSON' }),
    };
  }

  // 旧チャット（purpose 未指定・未知の purpose）は受け付けない (#1405)。入力の検査・席の確認・
  // レート制限・集計より先に返し、Claude の費用も DynamoDB の書き込みも発生させない。
  if (body.purpose !== PURPOSE_GENAI_TAKEOVER) {
    return jsonResponse(410, corsHeaders, { error: 'CHAT_DISCONTINUED' });
  }

  // Validate input
  const validation = validateInput(body.userMessage);
  if (!validation.valid) {
    return jsonResponse(400, corsHeaders, { error: validation.error });
  }

  // Validate stateContext (prompt injection prevention)
  const stateContextValidation = validateStateContext(body.stateContext);
  if (!stateContextValidation.valid) {
    return jsonResponse(400, corsHeaders, { error: stateContextValidation.error });
  }

  // Validate history
  const historyValidation = validateHistory(body.history);
  if (!historyValidation.valid) {
    return jsonResponse(400, corsHeaders, { error: historyValidation.error });
  }

  // Lambda の非同期呼び出しの payload 上限に収める。各項目の上限を通った後なので、
  // ここで超えるのは往復（history）を重ねたとき（userMessage / currentCode だけでは届かない）。
  if (Buffer.byteLength(event.body || '', 'utf8') > MAX_TAKEOVER_REQUEST_BYTES) {
    return jsonResponse(400, corsHeaders, { error: 'HISTORY_TOO_LONG' });
  }

  const sourceIp = event.requestContext.http.sourceIp || 'unknown';
  const usageContext = extractUsageContext(body, await verifySeatSession(body.sessionToken));

  // 「ルビティーにまかせる」は非同期ジョブ（API Gateway の 30 秒の壁を避ける）
  return handleTakeover({ body, usageContext, sourceIp, corsHeaders });
};
