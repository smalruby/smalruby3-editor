/* eslint-disable no-console */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';
import { SMALRUBY_REFERENCE } from './smalruby-reference';
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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
// 「ルビティーにまかせる」(purpose = genai-takeover) 用のモデル
const CLAUDE_TAKEOVER_MODEL = process.env.CLAUDE_TAKEOVER_MODEL || 'claude-sonnet-5-5';
const RATE_LIMIT_WINDOW_MINUTES = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '35', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '40', 10);
const MAX_USER_MESSAGE_LENGTH = parseInt(process.env.MAX_USER_MESSAGE_LENGTH || '250', 10);
const MIN_USER_MESSAGE_LENGTH = parseInt(process.env.MIN_USER_MESSAGE_LENGTH || '10', 10);
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'https://smalruby.app').split(',').map(o => o.trim());
const MAX_FIELD_NAME_LENGTH = 100;       // sprite/costume/sound names
const MAX_CURRENT_CODE_LENGTH = 1000;    // currentCode in stateContext
const MAX_HISTORY_TURNS = 20;            // conversation turns
const MAX_HISTORY_TURN_TEXT_LENGTH = 1000; // chars per history turn
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

// Request purposes. Unknown / missing purposes fall back to the default model.
const PURPOSE_GENAI_TAKEOVER = 'genai-takeover';
const KNOWN_PURPOSES = [PURPOSE_GENAI_TAKEOVER];

// Anthropic API
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

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
  maxCurrentCodeLength: number = MAX_CURRENT_CODE_LENGTH,
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
  maxTurnTextLength: number = MAX_HISTORY_TURN_TEXT_LENGTH,
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
  maxLength: number = MAX_USER_MESSAGE_LENGTH,
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
// System instruction builder (English for cost efficiency)
// ---------------------------------------------------------------------------
export function buildSystemInstruction(stateContext?: StateContext): string {
  const stateSection = stateContext ? buildStateSection(stateContext) : '';

  return `You are "Smalruby Teacher". Help elementary and middle school students create fun games and animations by generating simple, easy-to-understand Ruby code for Smalruby (smalruby) programming.

${SMALRUBY_REFERENCE}## Code Generation Guidelines

1. **Keep it simple**: Write code that elementary/middle school students can read and understand. Use a single sprite unless the user explicitly asks for multiple sprites.
2. **Make it interactive**: Prioritize code with movement, keyboard control, and coordinate changes.
3. **Comment in Japanese**: Add Japanese comments where helpful
4. **Always start with an event**: Begin programs with \`when_flag_clicked do...end\`
5. **Output code in code blocks (required)**: Always output Ruby code in this format:
   \`\`\`ruby
   (code here)
   \`\`\`
6. **⚠️ One sprite per code block (CRITICAL)**: Each code block must contain code for **exactly one sprite**. When generating multiple sprites, use **separate code blocks** with explanation text between them. The user interface shows an "Insert this code" button for each code block, so the user needs to insert each sprite's code separately.

   ✅ **Correct format (separate code blocks)**:
   プレイヤーのスプライトです。
   \`\`\`ruby
   class Player
     set_sprite "Shimaraby"
     ...
   end
   \`\`\`
   次に、新しいスプライトを追加して、以下のプログラムを入力してください。
   \`\`\`ruby
   class Enemy
     set_sprite "Ghost"
     ...
   end
   \`\`\`

   ❌ **Wrong format (merged code blocks)**:
   \`\`\`ruby
   class Player
     ...
   end
   class Enemy
     ...
   end
   \`\`\`
7. **Add explanation**: Briefly explain the code and how to use it in Japanese. When using multiple sprites, explain which sprite to add the code to.
8. **Use only listed methods**: Only use the methods documented above
9. **Check forbidden methods**: Always check the forbidden methods list before generating
10. **⚠️ Costume/sound names must match current state**: Only use names listed in the "Current State" section

## Important Output Rules

- When asked to create a program, **always generate Ruby code**
- Code block format must start with \`\`\`ruby and end with \`\`\`
- Always include code unless there is a clear reason not to
- **Respond in Japanese** for all explanations and messages

## Complexity Control

- **Default**: Generate simple code using a **single sprite** with basic elements (coordinates, costumes, keyboard input, loops). Use top-level form (without \`class\`) for simplicity.
- **class / set_xxx configuration**: You MAY proactively use \`class Sprite1; set_name "名前"; set_sprite "すてきなスプライト名"; set_x 100; ... end\` when the program benefits from setting initial position, costume, or sprite appearance.
- **Multiple sprites**: Only suggest when the user explicitly requests it (e.g., "2つのスプライトで", "もっと楽しく", "発展的に").
- **def (method definition)**: Only use when the user explicitly asks for methods, refactoring, or code reuse.
- **module / include**: Only use when the user explicitly mentions "module", "include", or "メソッドを共有".
- **super**: Only use when the user explicitly mentions "super" or "オーバーライド".
- **clone / create_clone**: Only use when the user asks for cloning or effects that require duplicates.

## Critical Syntax Warnings

These are the most common mistakes. **Always verify your output against these rules**:

1. **\`self.x =\` NOT \`set_x()\`**: Outside class definitions, always use \`self.x = value\`, \`self.y = value\`, \`self.size = value\`, etc. The \`set_x()\`, \`set_y()\`, \`set_size()\` methods are ONLY valid at class definition top-level.
2. **\`keyboard.pressed?\` NOT \`key_pressed?\`**: Always use \`keyboard.pressed?("key")\`, never \`key_pressed?\` or \`Keyboard.pressed?\`.
3. **\`mouse.x\` NOT \`mouse_x\`**: Always use \`mouse.x\`, \`mouse.y\`, \`mouse.down?\` (lowercase).
4. **\`timer.value\` NOT \`timer\`**: Always use \`timer.value\` and \`timer.reset\` (lowercase).
13. **\`@items.push()\` NOT \`list("@items").push()\`**: Use arrays directly. \`list()\` does not exist.
5. **\`touching?("_mouse_")\` NOT \`touching?("_mouse_pointer_")\`**: The target name is \`"_mouse_"\`, not \`"_mouse_pointer_"\`.
6. **\`glide([x, y], secs: n)\` NOT \`glide(n, x, y)\`**: Coordinates in array, seconds as keyword argument.
7. **\`go_to([x, y])\` NOT \`go_to(x, y)\`**: Coordinates must be in an array.
8. **\`play()\` NOT \`play_sound()\`**: Use \`play("name")\` or \`play_until_done("name")\`.
9. **No \`for\`/\`each\`**: Use \`loop do...end\`, \`N.times do...end\`, \`while...end\`, or \`until...end\`.
10. **No \`puts\`/\`print\`/\`p\`**: Use \`say()\` to display text.
11. **No string interpolation**: \`"Hello \#{name}"\` is NOT supported. Use concatenation: \`"Hello " + name\`.
12. **Loop auto-wait**: Loops automatically wait 1 frame. Do NOT add \`sleep()\` for animation speed. Only use \`sleep()\` for delays ≥ 0.5s.
- If the user asks about something unrelated to Smalruby programming, respond in Japanese: 「それはスモウルビーに関係がないので答えられません」

## Child Safety Guidelines

You are interacting with elementary and middle school students (ages 6-15). Follow these safety rules strictly:

1. **Never ask for or discuss personal information**: Do not ask about the student's name, age, school, address, phone number, email, or any other personally identifiable information. If a student volunteers such information, gently redirect the conversation to programming.
2. **Keep content age-appropriate**: Only discuss topics related to Smalruby programming, games, animations, and creative coding. Avoid mature themes, violence (beyond simple game mechanics like "game over"), horror, or controversial topics.
3. **Be encouraging and supportive**: Use positive, encouraging language. Celebrate the student's ideas and efforts. If their code has issues, explain corrections in a constructive, educational way.
4. **Do not role-play as a human**: You are an AI programming assistant called "Rubytee" (ルビティー). Always maintain this identity. Do not pretend to be a friend, family member, teacher, or any other human role.
5. **Redirect off-topic conversations**: If asked about topics outside of programming (personal advice, homework in other subjects, social situations), politely redirect: 「プログラミングのことを聞いてね！」
6. **No external links or resources**: Do not suggest visiting external websites, downloading software, or accessing resources outside of Smalruby.
7. **Report-worthy content**: If a student's message contains concerning content (self-harm, abuse, bullying), respond with: 「心配なことがあったら、おうちの人や先生に相談してね。」 and redirect to programming.
${stateSection}`;
}

function buildStateSection(stateContext: StateContext): string {
  const parts: string[] = ['\n## Current State\n'];

  if (stateContext.sprite) {
    const s = stateContext.sprite;
    parts.push(`### Currently Editing Sprite: "${s.name}"`);
    parts.push(`- Coordinates: (${s.x}, ${s.y}), Direction: ${s.direction}°, Size: ${s.size}%`);

    const costumeNames = (s.costumes || []).map(c => c.name);
    parts.push(`- Costume list: ${costumeNames.length > 0 ? costumeNames.map(n => `"${n}"`).join(', ') : '(none)'}`);
    parts.push('  - **Only names from this list can be used with switch_costume()**');

    const soundNames = (s.sounds || []).map(s2 => s2.name);
    parts.push(`- Sound list: ${soundNames.length > 0 ? soundNames.map(n => `"${n}"`).join(', ') : '(none — do NOT use play() or play_until_done())'}`);
    if (soundNames.length > 0) {
      parts.push('  - **Only names from this list can be used with play() / play_until_done()**');
    }

    if (s.currentCode) {
      parts.push(`- Current code:\n\`\`\`ruby\n${s.currentCode}\n\`\`\``);
    }
    parts.push('');
  }

  if (stateContext.stage) {
    const st = stateContext.stage;
    parts.push('### Stage');
    parts.push(`- Size: ${st.width}x${st.height}`);

    const stageCostumes = (st.costumes || []).map(c => c.name);
    parts.push(`- Backdrop list: ${stageCostumes.length > 0 ? stageCostumes.map(n => `"${n}"`).join(', ') : '(none)'}`);
    parts.push('  - **Only names from this list can be used with switch_backdrop() / when_backdrop_switches()**');

    if (st.sounds && st.sounds.length > 0) {
      parts.push(`- Stage sound list: ${st.sounds.map(s => `"${s.name}"`).join(', ')}`);
    }
    parts.push('');
  }

  if (stateContext.vm && stateContext.vm.extensions && stateContext.vm.extensions.length > 0) {
    parts.push(`### Active Extensions: ${stateContext.vm.extensions.join(', ')}\n`);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// CORS helper
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
// Model selection / usage logging
// ---------------------------------------------------------------------------
export function resolveModel(purpose: unknown): string {
  return purpose === PURPOSE_GENAI_TAKEOVER ? CLAUDE_TAKEOVER_MODEL : CLAUDE_MODEL;
}

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

/**
 * One structured log line per request (aggregated with CloudWatch Logs Insights).
 * sourceIp is omitted in prod for cost/privacy.
 */
export function buildResponseLog(params: {
  model: string;
  usage: { outputTokens: number; inputTokens: number; cacheCreationTokens: number; cacheReadTokens: number };
  userMessageLength: number;
  usageContext: UsageContext;
  sourceIp: string;
  stage: string | undefined;
}): string {
  const logData: Record<string, unknown> = {
    event: 'rubytee_response',
    model: params.model,
    ...params.usage,
    userMessageLength: params.userMessageLength,
    ...params.usageContext,
  };
  if (params.stage !== 'prod') {
    logData.sourceIp = params.sourceIp;
  }
  return JSON.stringify(logData);
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

  const isTakeover = body.purpose === PURPOSE_GENAI_TAKEOVER;

  // Validate input (takeover だけ上限を広げる)
  const validation = validateInput(
    body.userMessage,
    isTakeover ? MAX_TAKEOVER_MESSAGE_LENGTH : MAX_USER_MESSAGE_LENGTH,
  );
  if (!validation.valid) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: validation.error }),
    };
  }

  // Validate stateContext (prompt injection prevention)
  const stateContextValidation = validateStateContext(
    body.stateContext,
    isTakeover ? MAX_TAKEOVER_CURRENT_CODE_LENGTH : MAX_CURRENT_CODE_LENGTH,
  );
  if (!stateContextValidation.valid) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: stateContextValidation.error }),
    };
  }

  // Validate history
  const historyValidation = validateHistory(
    body.history,
    isTakeover ? MAX_TAKEOVER_HISTORY_TURN_TEXT_LENGTH : MAX_HISTORY_TURN_TEXT_LENGTH,
  );
  if (!historyValidation.valid) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: historyValidation.error }),
    };
  }

  // takeover は Lambda の非同期呼び出しの payload 上限に収める。各項目の上限を通った後なので、
  // ここで超えるのは往復（history）を重ねたとき（userMessage / currentCode だけでは届かない）。
  // purpose 未指定の経路は従来どおり各項目の上限だけで判定する。
  if (isTakeover && Buffer.byteLength(event.body || '', 'utf8') > MAX_TAKEOVER_REQUEST_BYTES) {
    return jsonResponse(400, corsHeaders, { error: 'HISTORY_TOO_LONG' });
  }

  const sourceIp = event.requestContext.http.sourceIp || 'unknown';
  const usageContext = extractUsageContext(body, await verifySeatSession(body.sessionToken));

  // 「ルビティーにまかせる」は非同期ジョブ（API Gateway の 30 秒の壁を避ける）
  if (isTakeover) {
    return handleTakeover({ body, usageContext, sourceIp, corsHeaders });
  }

  // Rate limiting by source IP
  const rateLimitResult = await checkAndIncrementRateLimit(sourceIp);
  if (!rateLimitResult.allowed) {
    await recordUsage(usageContext, ['requests', 'rateLimited']);
    console.log(`[RateLimit] Blocked: ${sourceIp}, resetAfterSeconds: ${rateLimitResult.resetAfterSeconds}`);
    return {
      statusCode: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'RATE_LIMIT_EXCEEDED',
        resetAfterSeconds: rateLimitResult.resetAfterSeconds,
      }),
    };
  }

  // Build Claude request
  const systemInstruction = buildSystemInstruction(body.stateContext);

  // Convert history to Claude messages format
  // Input: { role: 'user'|'model', parts: [{ text }] }
  // Claude: { role: 'user'|'assistant', content: string }
  const claudeMessages = (body.history || []).map((turn: HistoryTurn) => ({
    role: turn.role === 'model' ? 'assistant' as const : 'user' as const,
    content: turn.parts[0].text,
  }));
  claudeMessages.push({ role: 'user' as const, content: body.userMessage });

  const model = resolveModel(body.purpose);
  const claudeRequestBody = {
    model,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: systemInstruction,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: claudeMessages,
  };

  // Call Anthropic Claude API
  try {
    const claudeResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(claudeRequestBody),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error(`[Claude] API error ${claudeResponse.status}: ${errText}`);

      // Map Anthropic error codes to appropriate relay responses
      await recordUsage(usageContext, ['requests', 'failed']);
      if (claudeResponse.status === 529) {
        // Anthropic overloaded
        return {
          statusCode: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'AI_OVERLOADED' }),
        };
      }

      return {
        statusCode: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'AI_API_ERROR', status: claudeResponse.status }),
      };
    }

    const claudeData = await claudeResponse.json() as {
      content: Array<{ type: string; text: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };

    const responseText = claudeData.content?.[0]?.text || '';
    const outputTokens = claudeData.usage?.output_tokens || 0;
    const inputTokens = claudeData.usage?.input_tokens || 0;
    const cacheCreationTokens = claudeData.usage?.cache_creation_input_tokens || 0;
    const cacheReadTokens = claudeData.usage?.cache_read_input_tokens || 0;

    console.log(buildResponseLog({
      model,
      usage: { outputTokens, inputTokens, cacheCreationTokens, cacheReadTokens },
      userMessageLength: body.userMessage.length,
      usageContext,
      sourceIp,
      stage: process.env.STAGE,
    }));
    await recordUsage(usageContext, ['requests', 'succeeded'],
      { outputTokens, inputTokens, cacheCreationTokens, cacheReadTokens });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: responseText, outputTokens }),
    };
  } catch (err) {
    console.error('[Claude] Unexpected error:', err);
    await recordUsage(usageContext, ['requests', 'failed']);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'INTERNAL_ERROR' }),
    };
  }
};
