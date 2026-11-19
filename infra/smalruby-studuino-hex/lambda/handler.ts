/**
 * Studuino の hex を作る Lambda（#2209: 土台）。
 *
 * `POST /compile` に `{ "sample": "<名前>" }` を送ると、決まったサンプルをコンパイルして hex を返す。
 * 任意の C++ はまだ受け付けない（構文木の検査と C++ の書き出しは #2210 で足す）。
 * 応答と失敗の形は docs/studuino-mode/README.md の「Lambda の API」に合わせる。
 */
import * as crypto from 'crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { compileSketch, readSample, readToolchain, type CompileResult, type Toolchain } from './compiler';
import {
  errorResponse,
  findSample,
  hexDataBytes,
  isAllowedOrigin,
  jsonResponse,
  metricLog,
  parseLimits,
  parseOrigins,
  rateDecision,
  rateWindows,
  type HttpResponse,
  type Limits,
  type RequestRecord,
} from './policy';
import { incrementWindows } from './rate-limit';

export interface HandlerDeps {
  stage: string;
  allowedOrigins: string[];
  limits: Limits;
  toolchain: Toolchain | null;
  now: () => number;
  /** 各窓の数を増やして返す（数えられない窓は undefined）。 */
  countRequests: (windows: ReturnType<typeof rateWindows>) => Promise<(number | undefined)[]>;
  loadSample: (name: string) => string;
  compile: (sketchName: string, source: string) => Promise<CompileResult>;
  log: (entry: Record<string, unknown>) => void;
}

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

/**
 * 依存を差しこんでハンドラを作る（テストでは compile・DynamoDB を差し替える）。
 * @param deps - 依存
 * @returns Lambda のハンドラ
 */
export const createHandler = (deps: HandlerDeps) => {
  let coldStart = true;

  return async (event: APIGatewayProxyEventV2): Promise<HttpResponse> => {
    const startedAt = deps.now();
    const wasCold = coldStart;
    coldStart = false;
    const headers = event.headers || {};
    const origin = headers.origin || headers.Origin;
    const allowedOrigin = isAllowedOrigin(origin, deps.allowedOrigins) ? origin : undefined;
    const rawBody = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body
      : '';
    const record: RequestRecord = {
      outcome: 'ok',
      requestBytes: Buffer.byteLength(rawBody, 'utf8'),
      totalMs: 0,
      coldStart: wasCold,
    };

    const finish = (response: HttpResponse): HttpResponse => {
      record.totalMs = deps.now() - startedAt;
      deps.log(metricLog(record, deps.stage, deps.now()));
      return response;
    };
    const fail = (
      code: Exclude<RequestRecord['outcome'], 'ok'>,
      extra: Record<string, unknown> = {},
    ): HttpResponse => {
      record.outcome = code;
      if (typeof extra.reason === 'string') record.reason = extra.reason;
      return finish(errorResponse(code, allowedOrigin, extra));
    };

    // CORS はブラウザにしか効かないので、ハンドラでも Origin を確かめる
    if (!allowedOrigin) return fail('forbidden_origin');
    if (record.requestBytes > deps.limits.maxRequestBytes) {
      return fail('too_large', { maxBytes: deps.limits.maxRequestBytes });
    }

    const sourceIp = event.requestContext?.http?.sourceIp || 'unknown';
    const windows = rateWindows(sha256(sourceIp), deps.now(), deps.limits);
    const counts = await deps.countRequests(windows);
    if (counts.some(c => c === undefined)) record.rateLimitFailOpen = true;
    const decision = rateDecision(counts, windows, deps.now());
    if (!decision.allowed) return fail('rate_limited', { retryAfter: decision.retryAfter });

    let body: unknown;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return fail('invalid_request', { reason: 'invalid_json' });
    }
    const sample = findSample((body as { sample?: unknown } | null)?.sample);
    if (!sample) return fail('invalid_request', { reason: 'unknown_sample' });
    record.sample = sample.name;

    const toolchain = deps.toolchain;
    if (!toolchain) return fail('internal', { reason: 'toolchain_missing' });
    if (sample.needsStuduinoLib && !toolchain.studuinoLib) {
      return fail('compile_failed', { reason: 'library_missing' });
    }

    let result: CompileResult;
    try {
      result = await deps.compile(sample.name, deps.loadSample(sample.name));
    } catch (err) {
      deps.log({ event: 'studuino_hex_error', error: String(err) });
      return fail('internal');
    }
    record.compileMs = result.compileMs;
    if (!result.ok) {
      deps.log({ event: 'studuino_hex_compile_log', reason: result.reason, log: result.log });
      if (result.reason === 'timeout') return fail('timeout', { timeoutMs: deps.limits.compileTimeoutMs });
      return fail('compile_failed', { reason: result.reason });
    }

    const size = hexDataBytes(result.hex);
    record.hexBytes = size;
    if (size > toolchain.maxFlashBytes) {
      return fail('compile_failed', { reason: 'flash_overflow' });
    }
    return finish(
      jsonResponse(
        200,
        {
          hex: result.hex,
          size,
          maxSize: toolchain.maxFlashBytes,
          source: result.source,
          toolchain: {
            arduinoCli: toolchain.arduinoCli,
            avrCore: toolchain.avrCore,
            fqbn: toolchain.fqbn,
            studuinoLib: toolchain.studuinoLib,
          },
          compileMs: result.compileMs,
        },
        allowedOrigin,
      ),
    );
  };
};

const env = process.env;
const limits = parseLimits(env);
const toolchain = readToolchain(env.STUDUINO_TOOLCHAIN_FILE);

export const handler = createHandler({
  stage: env.STAGE || 'stg',
  allowedOrigins: parseOrigins(env.CORS_ALLOWED_ORIGINS),
  limits,
  toolchain,
  now: () => Date.now(),
  countRequests: windows => incrementWindows(env.RATE_LIMIT_TABLE_NAME || '', windows),
  loadSample: name => readSample(env.STUDUINO_SAMPLES_DIR || '/opt/arduino/samples', name),
  compile: (sketchName, source) =>
    compileSketch({
      cliPath: env.ARDUINO_CLI || 'arduino-cli',
      fqbn: toolchain?.fqbn || '',
      sketchName,
      source,
      timeoutMs: limits.compileTimeoutMs,
      prebuiltCacheDir: env.STUDUINO_PREBUILT_CACHE,
    }),
  log: entry => console.log(JSON.stringify(entry)),
});
