/**
 * arduino-cli でスケッチをコンパイルする（I/O・#2209）。
 *
 * コンテナの /opt/arduino は読み取りだけなので、スケッチ・ビルド・出力・キャッシュはすべて /tmp に置く。
 * コアのキャッシュはイメージを作るときに 1 回作っておき（install-toolchain.sh）、最初の呼び出しで
 * /tmp へ写す（ウォームの間は /tmp のキャッシュがそのまま効く）。
 */
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** コンテナに入っているツールチェーン（toolchain.json）。 */
export interface Toolchain {
  arduinoCli: string;
  avrCore: string;
  servo: string;
  fqbn: string;
  maxFlashBytes: number;
  /** Studuino ライブラリの sha256（入っていなければ null）。 */
  studuinoLib: string | null;
}

export type CompileResult =
  | { ok: true; hex: string; source: string; compileMs: number }
  | { ok: false; reason: 'timeout' | 'compile_failed' | 'flash_overflow'; compileMs: number; log: string };

export interface CompilerOptions {
  cliPath: string;
  fqbn: string;
  /** スケッチのフォルダの名前とソース。 */
  sketchName: string;
  source: string;
  timeoutMs: number;
  /** 作業場所（既定 /tmp）。 */
  tmpDir?: string;
  /** イメージに入れておいたコアのキャッシュ。 */
  prebuiltCacheDir?: string;
}

const LOG_LIMIT = 4000;

/**
 * イメージに入れたコアのキャッシュを /tmp へ写す（1 回だけ）。
 * @param prebuilt - イメージのキャッシュ
 * @param target - /tmp のキャッシュ
 */
const ensureCache = (prebuilt: string | undefined, target: string): void => {
  if (fs.existsSync(target)) return;
  if (prebuilt && fs.existsSync(prebuilt)) {
    fs.cpSync(prebuilt, target, { recursive: true });
  } else {
    fs.mkdirSync(target, { recursive: true });
  }
};

/**
 * スケッチをコンパイルして Intel HEX を返す。
 * @param opts - コンパイルの設定
 * @returns 結果（コンパイラの生の出力は log に入れ、呼び出し側はログにだけ残す）
 */
export const compileSketch = async (opts: CompilerOptions): Promise<CompileResult> => {
  const tmp = opts.tmpDir || '/tmp';
  const id = crypto.randomUUID();
  const work = path.join(tmp, `studuino-${id}`);
  const sketchDir = path.join(work, opts.sketchName);
  const buildDir = path.join(work, 'build');
  const outDir = path.join(work, 'out');
  const cacheDir = path.join(tmp, 'arduino-cache');
  fs.mkdirSync(sketchDir, { recursive: true });
  fs.writeFileSync(path.join(sketchDir, `${opts.sketchName}.ino`), opts.source);
  ensureCache(opts.prebuiltCacheDir, cacheDir);

  const args = [
    'compile',
    '--fqbn',
    opts.fqbn,
    '--build-path',
    buildDir,
    '--output-dir',
    outDir,
    '--build-cache-path',
    cacheDir,
    '--no-color',
    sketchDir,
  ];

  const start = Date.now();
  try {
    const { code, timedOut, log } = await new Promise<{ code: number | null; timedOut: boolean; log: string }>(
      resolve => {
        const child = spawn(opts.cliPath, args, {
          detached: true,
          env: { ...process.env, HOME: tmp },
        });
        let out = '';
        const append = (chunk: Buffer) => {
          if (out.length < LOG_LIMIT * 2) out += chunk.toString();
        };
        child.stdout.on('data', append);
        child.stderr.on('data', append);
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          // avr-gcc などの子プロセスごと止める
          try {
            if (child.pid) process.kill(-child.pid, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
        }, opts.timeoutMs);
        child.on('error', err => {
          clearTimeout(timer);
          resolve({ code: -1, timedOut, log: `${out}\n${String(err)}` });
        });
        child.on('close', code => {
          clearTimeout(timer);
          resolve({ code, timedOut, log: out });
        });
      },
    );
    const compileMs = Date.now() - start;
    const tail = log.slice(-LOG_LIMIT);
    if (timedOut) return { ok: false, reason: 'timeout', compileMs, log: tail };
    if (code !== 0) {
      const overflow = /Sketch too big|text section exceeds available space|region `text' overflowed/i.test(log);
      return { ok: false, reason: overflow ? 'flash_overflow' : 'compile_failed', compileMs, log: tail };
    }
    const hex = fs.readFileSync(path.join(outDir, `${opts.sketchName}.ino.hex`), 'utf8');
    return { ok: true, hex, source: opts.source, compileMs };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
};

/**
 * toolchain.json を読む。無ければ（テストなど）null。
 * @param file - toolchain.json のパス
 * @returns ツールチェーン
 */
export const readToolchain = (file: string | undefined): Toolchain | null => {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Toolchain;
};

/**
 * サンプルのソースを読む。
 * @param samplesDir - サンプルのフォルダ
 * @param name - サンプルの名前
 * @returns ソース
 */
export const readSample = (samplesDir: string, name: string): string =>
  fs.readFileSync(path.join(samplesDir, name, `${name}.ino`), 'utf8');
