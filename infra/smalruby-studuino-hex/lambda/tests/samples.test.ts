import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { compileSketch, readSample } from '../compiler';
import { SAMPLES } from '../policy';

const samplesDir = path.resolve(__dirname, '../../container/samples');

describe('サンプル', () => {
  test('policy の SAMPLES とフォルダが一致し、どれも <名前>.ino を持つ', () => {
    const dirs = fs.readdirSync(samplesDir).sort();
    expect(dirs).toEqual(SAMPLES.map(s => s.name).sort());
    for (const s of SAMPLES) {
      expect(Object.keys(readSample(samplesDir, s.name))).toContain(`${s.name}.ino`);
    }
  });

  test('小・中・大がそろっている', () => {
    expect(new Set(SAMPLES.map(s => s.size))).toEqual(new Set(['small', 'medium', 'large']));
  });

  test('一緒にコンパイルする .cpp / .h も読み、LICENSE は読まない', () => {
    const files = Object.keys(readSample(samplesDir, 'smalrubot-s1'));
    expect(files).toEqual(expect.arrayContaining(['smalrubot-s1.ino', 'Smalrubot.cpp', 'SrStuduino.h']));
    expect(files).not.toContain('LICENSE');
  });
});

describe('compileSketch', () => {
  test('フォルダの外を指すファイル名は書かない', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studuino-test-'));
    await expect(
      compileSketch({
        cliPath: '/bin/false',
        fqbn: 'x',
        sketchName: 'a',
        files: { '../evil.h': '' },
        timeoutMs: 1000,
        tmpDir,
      }),
    ).rejects.toThrow(/invalid sketch file name/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('arduino-cli が失敗したら compile_failed（作業場所は消す）', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studuino-test-'));
    const res = await compileSketch({
      cliPath: '/bin/false',
      fqbn: 'x',
      sketchName: 'a',
      files: { 'a.ino': 'void setup(){}' },
      timeoutMs: 5000,
      tmpDir,
    });
    expect(res).toMatchObject({ ok: false, reason: 'compile_failed' });
    expect(fs.readdirSync(tmpDir).filter(n => n.startsWith('studuino-'))).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
