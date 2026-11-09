/* eslint-disable no-console */
// Claude（Anthropic API）の client を作る。Workload Identity Federation（WIF）で、AWS STS の JWT を
// 交換した短期トークンで呼ぶ（#1437）。静的な API キーの経路は持たない（#1438）。
// smalruby-classroom の lambda/anthropic-client.ts と同じ内容（Lambda の bundling が読むコードなので
// infra/shared ではなく各プロジェクトに持つ）。片方を直したらもう片方も直す。
import Anthropic, { APIConnectionTimeoutError, APIError } from '@anthropic-ai/sdk';
import { oidcFederationProvider } from '@anthropic-ai/sdk/lib/credentials/oidc-federation';
import { WorkloadIdentityError } from '@anthropic-ai/sdk/lib/credentials/types';
import { GetWebIdentityTokenCommand, STSClient } from '@aws-sdk/client-sts';

const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

export interface AnthropicAuthEnv {
  ANTHROPIC_FEDERATION_RULE_ID?: string;
  ANTHROPIC_ORGANIZATION_ID?: string;
  ANTHROPIC_SERVICE_ACCOUNT_ID?: string;
  ANTHROPIC_WORKSPACE_ID?: string;
}

export type AnthropicAuthMode = 'federation' | 'none';

/**
 * WIF の値がそろっているか。rule / organization / service account がすべてそろったときだけ
 * federation（workspace は任意）。一部だけなら none（呼ばない）。
 */
export function resolveAnthropicAuthMode(env: AnthropicAuthEnv): AnthropicAuthMode {
  if (env.ANTHROPIC_FEDERATION_RULE_ID && env.ANTHROPIC_ORGANIZATION_ID && env.ANTHROPIC_SERVICE_ACCOUNT_ID) {
    return 'federation';
  }
  return 'none';
}

/**
 * Lambda の実行ロールで AWS STS から Anthropic 向けの JWT を取る。
 * GetWebIdentityToken はグローバルエンドポイントに無いので、リージョンの STS を使う。
 * jti の再利用を避けるため毎回取り直す（キャッシュは交換後のアクセストークンを SDK が持つ）。
 */
export function awsWebIdentityTokenProvider(
  sts: Pick<STSClient, 'send'> = new STSClient({ region: process.env.AWS_REGION }),
): () => Promise<string> {
  return async () => {
    let token: string | undefined;
    try {
      const res = await sts.send(new GetWebIdentityTokenCommand({
        Audience: [ANTHROPIC_BASE_URL],
        SigningAlgorithm: 'RS256',
        DurationSeconds: 300,
      }));
      token = res.WebIdentityToken;
    } catch (err) {
      // STS の失敗（アカウントで Outbound web identity federation が無効・権限不足など）も
      // WIF の経路の失敗として扱う（呼び出し側のエラーコードを交換の失敗とそろえる）。
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      throw new WorkloadIdentityError(`STS GetWebIdentityToken failed: ${detail}`);
    }
    if (!token) {
      throw new WorkloadIdentityError('STS GetWebIdentityToken returned no token');
    }
    return token;
  };
}

export interface CreateAnthropicClientOptions {
  env: AnthropicAuthEnv;
  /** 1 回の呼び出しの上限（ms）。 */
  timeout: number;
  /** ログの識別子（どの Lambda か）。 */
  logLabel: string;
  /** テスト用の差し替え。 */
  fetch?: typeof fetch;
  identityTokenProvider?: () => string | Promise<string>;
}

/**
 * client を作る（値が無ければ null）。maxRetries は 0: タイムアウトの再送で二重に課金したり
 * Lambda の時間を超えたりしないため（今までの fetch と同じくリトライしない）。
 * 交換・キャッシュ・期限前の更新は SDK に任せ、TokenCache で二重に包まない。
 * SDK は credentials を渡すと ANTHROPIC_API_KEY 環境変数を読まない。
 */
export function createAnthropicClient(opts: CreateAnthropicClientOptions): {
  client: Anthropic | null;
  mode: AnthropicAuthMode;
} {
  const mode = resolveAnthropicAuthMode(opts.env);
  console.log(JSON.stringify({ event: 'anthropic_auth', lambda: opts.logLabel, mode }));
  const common = { maxRetries: 0, timeout: opts.timeout, ...(opts.fetch ? { fetch: opts.fetch } : {}) };
  if (mode === 'federation') {
    const credentials = oidcFederationProvider({
      identityTokenProvider: opts.identityTokenProvider || awsWebIdentityTokenProvider(),
      federationRuleId: opts.env.ANTHROPIC_FEDERATION_RULE_ID as string,
      organizationId: opts.env.ANTHROPIC_ORGANIZATION_ID as string,
      serviceAccountId: opts.env.ANTHROPIC_SERVICE_ACCOUNT_ID,
      workspaceId: opts.env.ANTHROPIC_WORKSPACE_ID || undefined,
      baseURL: ANTHROPIC_BASE_URL,
      fetch: opts.fetch || globalThis.fetch,
    });
    return { client: new Anthropic({ ...common, credentials }), mode };
  }
  return { client: null, mode };
}

export type AnthropicErrorKind =
  | { kind: 'timeout' }
  | { kind: 'api'; status: number }
  | { kind: 'federation'; status: number | null }
  | { kind: 'other' };

/** SDK の例外を今のエラーコードに対応させるための分類。 */
export function classifyAnthropicError(err: unknown): AnthropicErrorKind {
  if (err instanceof APIConnectionTimeoutError) return { kind: 'timeout' };
  if (err instanceof WorkloadIdentityError) return { kind: 'federation', status: err.statusCode };
  if (err instanceof APIError && typeof err.status === 'number') return { kind: 'api', status: err.status };
  return { kind: 'other' };
}

/**
 * ログ用の短い説明。トークンや JWT・応答本文を含めない。API のエラーは種類と request-id だけ
 * （stg での切り分けと Console での照会に使う）。交換の応答が無い失敗（STS・接続・JWT の大きさ）は
 * 手元で作った文言なので理由を残す。
 */
export function describeAnthropicError(err: unknown): string {
  const c = classifyAnthropicError(err);
  if (c.kind === 'timeout') return 'timeout';
  if (c.kind === 'api') {
    const e = err as APIError;
    return `api status ${c.status}${e.type ? ` ${e.type}` : ''}${e.requestID ? ` (request-id ${e.requestID})` : ''}`;
  }
  if (c.kind === 'federation') {
    if (c.status === null) return `federation token exchange failed: ${(err as Error).message}`;
    return `federation token exchange failed (status ${c.status})`;
  }
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
