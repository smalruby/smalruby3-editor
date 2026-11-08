/* eslint-disable no-console */
// 「ルビティーにまかせる」の worker。API Lambda から非同期（InvocationType: Event）で呼ばれ、
// Claude を呼んで結果を jobs 表に書く。HTTP のルートは持たない（外から直接呼べない）。
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type Anthropic from '@anthropic-ai/sdk';
import { classifyAnthropicError, createAnthropicClient, describeAnthropicError } from './anthropic-client';
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
const CLAUDE_TAKEOVER_MODEL = process.env.CLAUDE_TAKEOVER_MODEL || 'claude-sonnet-5-5';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
// WIF の値がそろっていれば短期トークン、無ければ ANTHROPIC_API_KEY（#1437）。
const { client: anthropicClient } = createAnthropicClient({
  env: process.env,
  timeout: TAKEOVER_ANTHROPIC_TIMEOUT_MS,
  logLabel: 'takeover-worker',
});

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

/** Claude を呼ぶ（150 秒で打ち切り。client の timeout）。例外は投げず結果にする。 */
export async function callClaudeForTakeover(
  requestBody: Record<string, unknown>,
  client: Anthropic | null = anthropicClient,
): Promise<TakeoverResult> {
  if (!client) {
    console.error('[Takeover] Claude is not configured (no API key or federation settings)');
    return { status: 'error', error: 'AI_API_ERROR' };
  }
  try {
    const message = await client.messages.create(
      requestBody as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );
    const text = message.content
      .map(c => (c.type === 'text' ? c.text : ''))
      .join('');
    const tokens: UsageTokens = {
      inputTokens: message.usage?.input_tokens || 0,
      outputTokens: message.usage?.output_tokens || 0,
      cacheCreationTokens: message.usage?.cache_creation_input_tokens || 0,
      cacheReadTokens: message.usage?.cache_read_input_tokens || 0,
    };
    return { status: 'done', text, outputTokens: tokens.outputTokens, tokens };
  } catch (err) {
    console.error('[Takeover] Claude call failed:', describeAnthropicError(err));
    const c = classifyAnthropicError(err);
    if (c.kind === 'timeout') return { status: 'error', error: 'AI_TIMEOUT' };
    if (c.kind === 'api') return { status: 'error', error: anthropicErrorCode(c.status) };
    if (c.kind === 'federation') return { status: 'error', error: 'AI_API_ERROR' };
    return { status: 'error', error: 'INTERNAL_ERROR' };
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
