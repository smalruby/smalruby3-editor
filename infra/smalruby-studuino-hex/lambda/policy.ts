/**
 * Studuino の hex を作る Lambda の判断（純粋関数・#2209）。
 *
 * 上限・Origin・回数の窓・応答の形・計測のログをここに集める。I/O（コンパイル・DynamoDB）は
 * compiler.ts / rate-limit.ts に置き、handler.ts がつなぐ。
 */

/** 上限（S12 = C: 推奨の倍からはじめる。環境変数で変えられる）。 */
export interface Limits {
  /** リクエストの本文の上限（バイト）。超えたら 413。 */
  maxRequestBytes: number;
  /** コンパイルを打ち切るまでの時間（ミリ秒）。超えたら 504。 */
  compileTimeoutMs: number;
  /** IP ごとの 1 分の回数。超えたら 429。 */
  perMinute: number;
  /** IP ごとの 1 日の回数。超えたら 429。 */
  perDay: number;
}

export const DEFAULT_LIMITS: Limits = {
  maxRequestBytes: 128 * 1024,
  // S12 の目安は 60 秒だが、API Gateway（HTTP API）の統合は 30 秒で切れる。Lambda の
  // タイムアウト（30 秒）より前に打ち切って 504 を返せるよう、既定は 25 秒にする。
  compileTimeoutMs: 25_000,
  perMinute: 12,
  perDay: 600,
};

const positiveInt = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * 環境変数から上限を読む。壊れた値は既定に戻す（設定の誤りで Lambda を止めない）。
 * @param env - 環境変数
 * @returns 上限
 */
export const parseLimits = (env: Record<string, string | undefined>): Limits => ({
  maxRequestBytes: positiveInt(env.MAX_REQUEST_BYTES, DEFAULT_LIMITS.maxRequestBytes),
  compileTimeoutMs: positiveInt(env.COMPILE_TIMEOUT_MS, DEFAULT_LIMITS.compileTimeoutMs),
  perMinute: positiveInt(env.RATE_LIMIT_PER_MINUTE, DEFAULT_LIMITS.perMinute),
  perDay: positiveInt(env.RATE_LIMIT_PER_DAY, DEFAULT_LIMITS.perDay),
});

/**
 * カンマ区切りの許可オリジンを配列にする。
 * @param value - `CORS_ALLOWED_ORIGINS`
 * @returns 許可オリジン
 */
export const parseOrigins = (value: string | undefined): string[] =>
  (value || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

/**
 * Origin が許可されているか。Origin が無いもの（ブラウザ以外からの呼び出し）も許さない。
 * CORS はブラウザにしか効かないので、ハンドラでも確かめる。
 * @param origin - リクエストの Origin
 * @param allowed - 許可オリジン
 * @returns 許可されていれば true
 */
export const isAllowedOrigin = (origin: string | undefined, allowed: string[]): boolean =>
  !!origin && allowed.includes(origin);

/**
 * 動作確認とコンパイル時間の計測用のサンプル（この段階では任意の C++ は受け付けない）。
 * 大きさの違う 4 つで、コンパイルの打ち切り（既定 25 秒）が足りるかを測る。
 */
export interface Sample {
  name: string;
  /** 大きさの目安（small: コアだけ / Studuino ライブラリ最小、medium: ロボットカー、large: フラッシュの上限近く）。 */
  size: 'small' | 'medium' | 'large';
  /** Studuino ライブラリが要るか（コンテナに入っていなければ library_missing）。 */
  needsStuduinoLib: boolean;
}

export const SAMPLES: Sample[] = [
  { name: 'blink', size: 'small', needsStuduinoLib: false },
  { name: 'studuino-led', size: 'small', needsStuduinoLib: true },
  { name: 'robot-car', size: 'medium', needsStuduinoLib: true },
  { name: 'smalrubot-s1', size: 'large', needsStuduinoLib: true },
];

export const findSample = (name: unknown): Sample | undefined =>
  typeof name === 'string' ? SAMPLES.find(s => s.name === name) : undefined;

/** 回数の窓（固定窓）。 */
export interface RateWindow {
  /** DynamoDB のキー。 */
  key: string;
  limit: number;
  /** 窓が終わる時刻（epoch 秒）。TTL にも使う。 */
  resetAt: number;
}

/**
 * IP ごとの 1 分・1 日の窓を作る。
 * @param ipHash - IP のハッシュ（IP をそのまま表に残さない）
 * @param nowMs - いまの時刻（ms epoch）
 * @param limits - 上限
 * @returns 1 分の窓と 1 日の窓
 */
export const rateWindows = (ipHash: string, nowMs: number, limits: Limits): RateWindow[] => {
  const nowSec = Math.floor(nowMs / 1000);
  const minuteStart = nowSec - (nowSec % 60);
  const dayStart = nowSec - (nowSec % 86_400);
  return [
    { key: `ip#${ipHash}#min#${minuteStart}`, limit: limits.perMinute, resetAt: minuteStart + 60 },
    { key: `ip#${ipHash}#day#${dayStart}`, limit: limits.perDay, resetAt: dayStart + 86_400 },
  ];
};

/**
 * 数えた結果から、通すか・何秒待てばよいかを決める。
 * @param counts - 各窓の数（数えられなかった窓は undefined = fail-open）
 * @param windows - 窓
 * @param nowMs - いまの時刻（ms epoch）
 * @returns 判断
 */
export const rateDecision = (
  counts: (number | undefined)[],
  windows: RateWindow[],
  nowMs: number,
): { allowed: boolean; retryAfter?: number } => {
  const nowSec = Math.floor(nowMs / 1000);
  let retryAfter: number | undefined;
  windows.forEach((w, i) => {
    const c = counts[i];
    if (c !== undefined && c > w.limit) {
      const wait = Math.max(1, w.resetAt - nowSec);
      retryAfter = retryAfter === undefined ? wait : Math.max(retryAfter, wait);
    }
  });
  return retryAfter === undefined ? { allowed: true } : { allowed: false, retryAfter };
};

/** 失敗の種類（docs/studuino-mode/README.md の「Lambda の API」と同じ名前）。 */
export type ErrorCode =
  | 'invalid_request'
  | 'forbidden_origin'
  | 'too_large'
  | 'compile_failed'
  | 'rate_limited'
  | 'timeout'
  | 'internal';

export const STATUS_BY_ERROR: Record<ErrorCode, number> = {
  invalid_request: 400,
  forbidden_origin: 403,
  too_large: 413,
  compile_failed: 422,
  rate_limited: 429,
  timeout: 504,
  internal: 500,
};

export const MESSAGE_BY_ERROR: Record<ErrorCode, string> = {
  invalid_request: 'リクエストの形が正しくありません。',
  forbidden_origin: 'この場所からは呼び出せません。',
  too_large: 'プログラムが大きすぎます。',
  compile_failed: 'プログラムを hex にできませんでした。',
  rate_limited: '短い時間に何度も呼び出しています。しばらく待ってから試してください。',
  timeout: 'hex を作るのに時間がかかりすぎました。',
  internal: 'サーバーでエラーが起きました。',
};

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * JSON の応答を作る。許可された Origin のときだけ CORS のヘッダを付ける。
 * @param statusCode - HTTP ステータス
 * @param body - 本文
 * @param origin - 許可された Origin（許可外なら undefined）
 * @param extraHeaders - 追加のヘッダ
 * @returns 応答
 */
export const jsonResponse = (
  statusCode: number,
  body: unknown,
  origin?: string,
  extraHeaders: Record<string, string> = {},
): HttpResponse => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

/**
 * 失敗の応答を作る。コンパイラの生の出力は返さない（ログにだけ残す）。
 * @param code - 失敗の種類
 * @param origin - 許可された Origin
 * @param extra - 本文に足す値（reason・retryAfter など）
 * @returns 応答
 */
export const errorResponse = (
  code: ErrorCode,
  origin?: string,
  extra: Record<string, unknown> = {},
): HttpResponse => {
  const headers: Record<string, string> = {};
  if (typeof extra.retryAfter === 'number') headers['Retry-After'] = String(extra.retryAfter);
  return jsonResponse(
    STATUS_BY_ERROR[code],
    { error: code, message: MESSAGE_BY_ERROR[code], ...extra },
    origin,
    headers,
  );
};

/**
 * Intel HEX のデータの大きさ（バイト）を数える（データレコード = 種類 00 だけ）。
 * @param hex - Intel HEX の文字列
 * @returns バイト数
 */
export const hexDataBytes = (hex: string): number => {
  let total = 0;
  for (const raw of hex.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith(':') || line.length < 11) continue;
    if (line.slice(7, 9) !== '00') continue;
    total += parseInt(line.slice(1, 3), 16);
  }
  return total;
};

/** 1 回ごとの計測（構造化ログ）。 */
export interface RequestRecord {
  outcome: 'ok' | ErrorCode;
  /** 失敗の細かい理由（library_missing・flash_overflow など）。 */
  reason?: string;
  sample?: string;
  requestBytes: number;
  compileMs?: number;
  hexBytes?: number;
  totalMs: number;
  coldStart: boolean;
  /** 回数を数えられなかった（DynamoDB の障害で fail-open した）。 */
  rateLimitFailOpen?: boolean;
}

export const METRICS_NAMESPACE = 'Smalruby/StuduinoHex';

/**
 * CloudWatch Embedded Metric Format のログを作る。ログに出すだけで、メトリクス
 * （回数・失敗・拒否・コンパイル時間・hex の大きさ）が CloudWatch にできる（SDK を呼ばない）。
 * @param record - 1 回の計測
 * @param stage - ステージ
 * @param nowMs - いまの時刻（ms epoch）
 * @returns ログに出すオブジェクト
 */
export const metricLog = (
  record: RequestRecord,
  stage: string,
  nowMs: number,
): Record<string, unknown> => {
  const rejected = ['forbidden_origin', 'too_large', 'rate_limited', 'invalid_request'].includes(
    record.outcome,
  );
  const failed = !rejected && record.outcome !== 'ok';
  const metrics: { Name: string; Unit: string }[] = [
    { Name: 'Requests', Unit: 'Count' },
    { Name: 'Succeeded', Unit: 'Count' },
    { Name: 'Failed', Unit: 'Count' },
    { Name: 'Rejected', Unit: 'Count' },
    { Name: 'RequestBytes', Unit: 'Bytes' },
    { Name: 'TotalTime', Unit: 'Milliseconds' },
  ];
  const values: Record<string, number> = {
    Requests: 1,
    Succeeded: record.outcome === 'ok' ? 1 : 0,
    Failed: failed ? 1 : 0,
    Rejected: rejected ? 1 : 0,
    RequestBytes: record.requestBytes,
    TotalTime: record.totalMs,
  };
  if (record.compileMs !== undefined) {
    metrics.push({ Name: 'CompileTime', Unit: 'Milliseconds' });
    values.CompileTime = record.compileMs;
  }
  if (record.hexBytes !== undefined) {
    metrics.push({ Name: 'HexBytes', Unit: 'Bytes' });
    values.HexBytes = record.hexBytes;
  }
  return {
    _aws: {
      Timestamp: nowMs,
      CloudWatchMetrics: [{ Namespace: METRICS_NAMESPACE, Dimensions: [['Stage']], Metrics: metrics }],
    },
    Stage: stage,
    event: 'studuino_hex_request',
    ...record,
    ...values,
  };
};
