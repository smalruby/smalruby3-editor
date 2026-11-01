// 「ルビティーにまかせる」(purpose = genai-takeover) 用の上限・プロンプト・キー・ジョブの形。
// 判断は純粋関数に寄せ、DynamoDB / Lambda への I/O は handler.ts と takeover-worker.ts が行う。
import { SMALRUBY_REFERENCE } from './smalruby-reference';

// ---------------------------------------------------------------------------
// Limits (takeover only — the chat path keeps its own limits in handler.ts)
// ---------------------------------------------------------------------------
// 作品全体（Ruby）と困りごとを 1 回で送れるように 1 万字。
export const MAX_TAKEOVER_MESSAGE_LENGTH = 10000;
export const MAX_TAKEOVER_CURRENT_CODE_LENGTH = 10000;
// 作り直しの往復で作品全体を返すため、1 ターンも 1 万字。
export const MAX_TAKEOVER_HISTORY_TURN_TEXT_LENGTH = 10000;
// 答え = 作品全体の書き直し（Ruby）+ 短い説明。1 万字の作品の書き直しに足りる量。
export const TAKEOVER_MAX_TOKENS = 8192;
// Lambda の非同期呼び出しの payload 上限（256KB）に収めるため、リクエスト全体を 200KB までにする。
export const MAX_TAKEOVER_REQUEST_BYTES = 200 * 1024;
// worker の Anthropic 呼び出しの打ち切り（worker の Lambda timeout 180 秒より短く）。
export const TAKEOVER_ANTHROPIC_TIMEOUT_MS = 150 * 1000;
// pending のまま、これより古いジョブは worker が落ちたとみなす。
// 非同期呼び出しのキュー待ち（maxEventAge 60 秒）+ worker の timeout 180 秒。
export const TAKEOVER_JOB_STALE_SECONDS = 240;
// jobs 表の TTL（答えを取りに来る時間の余裕）。
export const TAKEOVER_JOB_TTL_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// System prompt (fixed block first, cached for 1 hour)
// ---------------------------------------------------------------------------
export const COPY_START = '▼▼ ここから下をコピーして、スモウルビーにもどろう ▼▼';
export const COPY_END = '▲▲ ここまで ▲▲';

/**
 * 毎回同じ部分。作品・困りごと・失敗理由を入れないこと（キャッシュの一致が崩れる）。
 */
export const TAKEOVER_FIXED_INSTRUCTION = `You are "Rubytee" (ルビティー), the Smalruby programming assistant. A student asked a general-purpose generative AI to change their Smalruby program, but the answer could not be converted into Scratch blocks. You take over: rewrite the student's program so that it does what the student wants AND converts into blocks without errors.

The student's whole program is given as Ruby, one part per sprite (and the stage), each starting with a line \`# 「スプライト名」\`. The student's trouble, and why the previous answer failed, follow it.

## Smalruby program structure

- Smalruby code is converted into Scratch blocks. Only the methods and syntax below can be used. Anything else makes the conversion fail.
- Each sprite's program is either the top-level form (event handlers and \`def\` at the top level) or one \`class\` definition. Keep the form the student's program already uses for that sprite.
- Inside a \`class\` definition, only event handlers (\`when_xxx do ... end\`), method definitions (\`def\`), \`include\`, and the \`set_xxx\` settings may be placed at the top level.
- \`set_xxx\` settings (\`set_x 0\`, \`set_size 80\`, ...) are valid ONLY at the top level of a \`class\` definition. Elsewhere use \`self.x = 0\`, \`self.size = 80\`, etc.
- Inside \`module\`, only \`def\` is allowed. The stage (\`# 「ステージ」\`) cannot use \`module\` / \`include\`, motion or looks methods for sprites (\`move\`, \`say\`, \`self.x\`, ...).
- Instance variables (\`@score\`) belong to a sprite; global variables (\`$score\`) are shared by all sprites and the stage. Keep the student's variable names.
- Sprites talk to each other with \`broadcast("message")\` and \`when_receive("message") do ... end\`. Keep the student's message names.

${SMALRUBY_REFERENCE}
## How to answer (CRITICAL — the program is read by a machine)

1. First, in Japanese, explain in 1–3 short lines what you changed, using block words (例: 「緑の旗が押されたときのブロックの中に、〜の音を鳴らす命令を足しました」). Do not explain Ruby syntax details.
2. Then write a line \`${COPY_START}\`, then ONE \`\`\`ruby code block, then a line \`${COPY_END}\`.
3. Inside that one code block, for EACH sprite you change, write a line \`# 「スプライト名」\` (the exact name given in the program) followed by that sprite's WHOLE program, including the parts you did not change. Sprites you do not change must not be written. The stage is \`# 「ステージ」\`.
4. Use only sprite names, costume names, sound names, backdrop names, variable names and message names that appear in the student's program or in the lists given with it. Never invent new sprites, costumes or sounds.
5. Before answering, check every line against "Forbidden Methods" and "Critical Syntax Warnings". Prefer the simplest code that works.
6. After the code, write ONE thing the student should try to check that it works.
7. Answer in Japanese that a junior high school student can read. Keep the explanation short.

## Child Safety Guidelines

The student is 6–15 years old. Never ask for or discuss personal information (name, school, address, ...). Only talk about the Smalruby program. If the request is unrelated to Smalruby programming, answer only 「それはスモウルビーに関係がないので答えられません」. If the message contains something worrying (self-harm, abuse, bullying), answer 「心配なことがあったら、おうちの人や先生に相談してね。」 and go back to programming.
`;

export interface TakeoverStateContext {
  sprite?: {
    name?: string;
    costumes?: Array<{ name: string }>;
    sounds?: Array<{ name: string }>;
    currentCode?: string;
  };
  stage?: {
    costumes?: Array<{ name: string }>;
    sounds?: Array<{ name: string }>;
  };
  vm?: { extensions?: string[] };
}

const quoteNames = (items?: Array<{ name: string }>) =>
  items && items.length > 0 ? items.map(i => `"${i.name}"`).join(', ') : '(none)';

/**
 * 毎回変わる部分（今のスプライト・名前の一覧）。固定部分の後ろに置く。
 */
export function buildTakeoverStateText(stateContext?: TakeoverStateContext): string {
  const parts: string[] = ['## Current State'];
  const s = stateContext?.sprite;
  if (s) {
    parts.push(`- Sprite the student is editing: "${s.name || ''}"`);
    parts.push(`- Its costumes: ${quoteNames(s.costumes)}`);
    parts.push(`- Its sounds: ${quoteNames(s.sounds)}`);
    if (s.currentCode) {
      parts.push(`- Its current code:\n\`\`\`ruby\n${s.currentCode}\n\`\`\``);
    }
  }
  const st = stateContext?.stage;
  if (st) {
    parts.push(`- Backdrops: ${quoteNames(st.costumes)}`);
    parts.push(`- Stage sounds: ${quoteNames(st.sounds)}`);
  }
  const exts = stateContext?.vm?.extensions || [];
  if (exts.length > 0) parts.push(`- Active extensions: ${exts.join(', ')}`);
  return parts.join('\n');
}

/**
 * takeover の system。先頭ブロック = 固定部分（cache_control ttl 1h）、後ろ = 毎回変わる部分。
 */
export function buildTakeoverSystem(stateContext?: TakeoverStateContext): Array<Record<string, unknown>> {
  return [
    {
      type: 'text',
      text: TAKEOVER_FIXED_INSTRUCTION,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    },
    {
      type: 'text',
      text: buildTakeoverStateText(stateContext),
    },
  ];
}

// ---------------------------------------------------------------------------
// Rate limit keys
// ---------------------------------------------------------------------------
export interface RateLimitPlanEntry {
  key: string;
  limit: number;
  // 席ごとの「今の状況」の 1 行を書くか（クラス管理が読む）
  seat?: boolean;
}

/**
 * takeover のレート制限の数え方。classroom と seat が両方あれば 1 席ごと + IP（クラス全員ぶん）、
 * 無ければ今の IP 単位（chat と同じ行）。
 */
export function takeoverRateLimitPlan(params: {
  sourceIp: string;
  classroom?: string;
  seat?: string;
  seatLimit: number;
  ipLimit: number;
  defaultLimit: number;
}): RateLimitPlanEntry[] {
  if (params.classroom && params.seat) {
    return [
      { key: seatRateLimitKey(params.classroom, params.seat), limit: params.seatLimit, seat: true },
      { key: `takeover-ip#${params.sourceIp}`, limit: params.ipLimit },
    ];
  }
  return [{ key: params.sourceIp, limit: params.defaultLimit }];
}

/**
 * 出席番号は数字（"03" と "3" は同じ席）。クラス管理が memberId（seat-03）から
 * 数字にして引くので、キーでは先頭の 0 を落とす。
 */
export function normalizeSeat(seat: string): string {
  return /^\d+$/.test(seat) ? String(parseInt(seat, 10)) : seat;
}

export function seatRateLimitKey(classroom: string, seat: string): string {
  return `seat#${classroom}:${normalizeSeat(seat)}`;
}

/** 席ごとの「今の状況」の 1 行のキー（windowStart = 0 の固定行）。 */
export function seatCurrentKey(classroom: string, seat: string): { sourceIp: string; windowStart: number } {
  return { sourceIp: `${seatRateLimitKey(classroom, seat)}#current`, windowStart: 0 };
}

// ---------------------------------------------------------------------------
// Usage table keys (集計用・RETAIN)
// ---------------------------------------------------------------------------
export const USAGE_PURPOSE_CHAT = 'chat';

/** 日本時間の YYYY-MM-DD。 */
export function jstDate(nowMs: number): string {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function usageKey(params: { classroom?: string; seat?: string; purpose?: string; nowMs: number }): { pk: string; sk: string } {
  const purpose = params.purpose || USAGE_PURPOSE_CHAT;
  return {
    pk: `classroom#${params.classroom || '-'}`,
    sk: `${jstDate(params.nowMs)}#seat#${params.seat ? normalizeSeat(params.seat) : '-'}#${purpose}`,
  };
}

export type UsageOutcome = 'requests' | 'rateLimited' | 'succeeded' | 'failed';

export interface UsageTokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

/** 集計表への ADD 式（各回数に 1 + トークン数）。1 回の書き込みにまとめる。 */
export function usageUpdateExpression(outcomes: UsageOutcome | UsageOutcome[], tokens?: UsageTokens): {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, number>;
} {
  const names: Record<string, string> = {};
  const values: Record<string, number> = { ':one': 1 };
  const adds: string[] = [];
  for (const outcome of Array.isArray(outcomes) ? outcomes : [outcomes]) {
    names[`#${outcome}`] = outcome;
    adds.push(`#${outcome} :one`);
  }
  if (tokens) {
    for (const k of ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheCreationTokens'] as const) {
      names[`#${k}`] = k;
      values[`:${k}`] = tokens[k] || 0;
      adds.push(`#${k} :${k}`);
    }
  }
  return {
    UpdateExpression: `ADD ${adds.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isValidJobId(jobId: unknown): jobId is string {
  return typeof jobId === 'string' && UUID_PATTERN.test(jobId);
}

export interface JobItem {
  jobId: string;
  status: 'pending' | 'done' | 'error';
  createdAt: number; // epoch seconds
  text?: string;
  outputTokens?: number;
  error?: string;
}

/** GET /jobs/{jobId} の応答本文。入力は保存していないので返すのは状態と答えだけ。 */
export function jobResponseBody(job: JobItem, nowSeconds: number): Record<string, unknown> {
  if (job.status === 'pending') {
    if (nowSeconds - job.createdAt > TAKEOVER_JOB_STALE_SECONDS) {
      return { jobId: job.jobId, status: 'error', error: 'JOB_TIMEOUT' };
    }
    return { jobId: job.jobId, status: 'pending' };
  }
  if (job.status === 'done') {
    return { jobId: job.jobId, status: 'done', text: job.text || '', outputTokens: job.outputTokens || 0 };
  }
  return { jobId: job.jobId, status: 'error', error: job.error || 'INTERNAL_ERROR' };
}

/** worker への非同期呼び出しの payload（入力は DynamoDB に置かず、ここだけで渡す）。 */
export interface TakeoverWorkerPayload {
  jobId: string;
  userMessage: string;
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  stateContext?: TakeoverStateContext;
  usageContext: { purpose?: string; classroom?: string; seat?: string };
}

/** Anthropic の HTTP 状態からジョブのエラーコードへ（同期の経路と同じコード）。 */
export function anthropicErrorCode(status: number): string {
  return status === 529 ? 'AI_OVERLOADED' : 'AI_API_ERROR';
}
