/* eslint-disable no-console */
// 「ルビティーにまかせる」の worker。API Lambda から非同期（InvocationType: Event）で呼ばれ、
// Claude を呼んで結果を jobs 表に書く。HTTP のルートは持たない（外から直接呼べない）。
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  TakeoverWorkerPayload,
  TAKEOVER_MAX_TOKENS,
  TAKEOVER_ANTHROPIC_TIMEOUT_MS,
  buildTakeoverSystem,
  anthropicErrorCode,
  usageKey,
  usageUpdateExpression,
  UsageTokens,
  isValidJobId,
} from './takeover';

const JOBS_TABLE_NAME = process.env.JOBS_TABLE_NAME || '';
const USAGE_TABLE_NAME = process.env.USAGE_TABLE_NAME || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_TAKEOVER_MODEL = process.env.CLAUDE_TAKEOVER_MODEL || 'claude-sonnet-5-5';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/** Claude への takeover リクエスト本文（固定部分を system の先頭ブロックに置く）。 */
export function buildTakeoverClaudeRequest(payload: TakeoverWorkerPayload, model: string): Record<string, unknown> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = (payload.history || []).map(turn => ({
    role: turn.role === 'model' ? 'assistant' as const : 'user' as const,
    content: turn.parts[0].text,
  }));
  messages.push({ role: 'user', content: payload.userMessage });
  return {
    model,
    max_tokens: TAKEOVER_MAX_TOKENS,
    system: buildTakeoverSystem(payload.stateContext),
    messages,
  };
}

export interface TakeoverResult {
  status: 'done' | 'error';
  text?: string;
  outputTokens?: number;
  error?: string;
  tokens?: UsageTokens;
}

/** Claude を呼ぶ（150 秒で打ち切り）。例外は投げず結果にする。 */
export async function callClaudeForTakeover(
  requestBody: Record<string, unknown>,
  fetchFn: typeof fetch = fetch,
): Promise<TakeoverResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAKEOVER_ANTHROPIC_TIMEOUT_MS);
  try {
    const res = await fetchFn(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Takeover] Claude API error ${res.status}: ${errText}`);
      return { status: 'error', error: anthropicErrorCode(res.status) };
    }
    const data = await res.json() as {
      content?: Array<{ type: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('');
    const tokens: UsageTokens = {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      cacheCreationTokens: data.usage?.cache_creation_input_tokens || 0,
      cacheReadTokens: data.usage?.cache_read_input_tokens || 0,
    };
    return { status: 'done', text, outputTokens: tokens.outputTokens, tokens };
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    console.error('[Takeover] Claude call failed:', aborted ? 'timeout' : err);
    return { status: 'error', error: aborted ? 'AI_TIMEOUT' : 'INTERNAL_ERROR' };
  } finally {
    clearTimeout(timer);
  }
}

export const handler = async (payload: TakeoverWorkerPayload): Promise<void> => {
  if (!payload || !isValidJobId(payload.jobId)) {
    console.error('[Takeover] invalid payload');
    return;
  }
  // 組み立てで落ちる（壊れた history など）と結果を書かずに終わり、GUI が JOB_TIMEOUT まで待たされる。
  // 例外にせずエラーとして書く。
  let result: TakeoverResult;
  try {
    result = await callClaudeForTakeover(buildTakeoverClaudeRequest(payload, CLAUDE_TAKEOVER_MODEL));
  } catch (err) {
    console.error('[Takeover] failed to build request:', err);
    result = { status: 'error', error: 'INVALID_INPUT' };
  }

  // 入力は保存しない。置くのは状態・答え・エラーコードだけ。
  const names: Record<string, string> = { '#status': 'status' };
  const values: Record<string, unknown> = { ':status': result.status };
  const sets = ['#status = :status'];
  if (result.status === 'done') {
    names['#text'] = 'text';
    names['#outputTokens'] = 'outputTokens';
    values[':text'] = result.text || '';
    values[':outputTokens'] = result.outputTokens || 0;
    sets.push('#text = :text', '#outputTokens = :outputTokens');
  } else {
    names['#error'] = 'error';
    values[':error'] = result.error || 'INTERNAL_ERROR';
    sets.push('#error = :error');
  }
  try {
    await docClient.send(new UpdateCommand({
      TableName: JOBS_TABLE_NAME,
      Key: { jobId: payload.jobId },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  } catch (err) {
    console.error('[Takeover] failed to write job result:', err);
  }

  // 集計（fail-open）
  try {
    const key = usageKey({ ...payload.usageContext, nowMs: Date.now() });
    await docClient.send(new UpdateCommand({
      TableName: USAGE_TABLE_NAME,
      Key: key,
      ...usageUpdateExpression(result.status === 'done' ? 'succeeded' : 'failed', result.tokens),
    }));
  } catch (err) {
    console.error('[Usage] failed to record takeover result:', err);
  }

  console.log(JSON.stringify({
    event: 'rubytee_takeover_response',
    model: CLAUDE_TAKEOVER_MODEL,
    status: result.status,
    error: result.error,
    ...(result.tokens || {}),
    userMessageLength: (payload.userMessage || '').length,
    ...payload.usageContext,
  }));
};
