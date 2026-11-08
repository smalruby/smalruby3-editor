/**
 * CORS 許可オリジンの決定ロジック (#1160 / #1342)。
 *
 * ローカルの dev server は 8601 から順に使うため非 prod では範囲で許可するが、
 * その緩和が prod に漏れないことが本質。ここが崩れると本番 API が localhost から
 * 叩けてしまうので、範囲そのものより「prod に入らない」ことを厚めに固定する。
 *
 * 正本は `infra/shared/tests/cors-origins.test.ts`。各プロジェクトの `lambda/tests/` にあるのは
 * コピーなので直接編集しない（`node infra/shared/sync.js` で配る）。
 */
import {
  LOCAL_DEV_PORT_FIRST,
  LOCAL_DEV_PORT_LAST,
  PREVIEW_ORIGINS,
  isLocalOrigin,
  localDevOrigins,
  resolveCorsOrigins,
  withPreviewOrigins,
} from '../../lib/cors-origins';

const PROD_ORIGINS = ['https://smalruby.app', 'https://smalruby.jp'];

describe('localDevOrigins', () => {
  test('8601 から 8610 までを両端込みで並べる', () => {
    const origins = localDevOrigins();

    expect(origins).toHaveLength(LOCAL_DEV_PORT_LAST - LOCAL_DEV_PORT_FIRST + 1);
    expect(origins[0]).toBe('http://localhost:8601');
    expect(origins[origins.length - 1]).toBe('http://localhost:8610');
  });

  test('範囲外のポートは含まない', () => {
    const origins = localDevOrigins();

    expect(origins).not.toContain('http://localhost:8600');
    expect(origins).not.toContain('http://localhost:8611');
  });
});

describe('isLocalOrigin', () => {
  test.each([
    'http://localhost:8601',
    'http://localhost',
    'https://localhost:8602',
    'http://127.0.0.1:8601',
    'http://[::1]:8601',
  ])('%s はローカル扱い', (origin) => {
    expect(isLocalOrigin(origin)).toBe(true);
  });

  test.each([
    'https://smalruby.app',
    'https://smalruby.jp',
    // ホスト名の一部に localhost を含むだけの別ドメインを取り違えない。
    'https://localhost.example.com',
    'https://notlocalhost',
  ])('%s は本番オリジン扱い', (origin) => {
    expect(isLocalOrigin(origin)).toBe(false);
  });
});

describe('resolveCorsOrigins', () => {
  test('非 prod は本番オリジン + ローカル範囲 + ブランチプレビュー', () => {
    const origins = resolveCorsOrigins('stg', PROD_ORIGINS);

    expect(origins).toEqual([...PROD_ORIGINS, ...localDevOrigins(), ...PREVIEW_ORIGINS]);
  });

  test('prod はローカルを一切含まない', () => {
    const origins = resolveCorsOrigins('prod', PROD_ORIGINS);

    expect(origins).toEqual(PROD_ORIGINS);
    expect(origins.some(isLocalOrigin)).toBe(false);
  });

  test('prod はブランチプレビューを含まない（プレビューは stg の API を見る）', () => {
    expect(resolveCorsOrigins('prod', PROD_ORIGINS)).not.toContain('https://preview.smalruby.app');
    expect(resolveCorsOrigins('prod', PROD_ORIGINS, 'https://smalruby.app')).not.toContain(
      'https://preview.smalruby.app',
    );
  });

  test('env の指定が既定より優先される', () => {
    const origins = resolveCorsOrigins('stg', PROD_ORIGINS, 'https://example.com, http://localhost:9999');

    expect(origins).toEqual(['https://example.com', 'http://localhost:9999', ...PREVIEW_ORIGINS]);
  });

  // stg の env は GitHub secrets 由来で CORS_ALLOWED_ORIGINS を明示しているため、
  // env を指定してもプレビューが落ちないことを固定する。
  test('非 prod では env を指定してもブランチプレビューを足す（重複はしない）', () => {
    expect(resolveCorsOrigins('stg', PROD_ORIGINS, 'https://smalruby.app')).toEqual([
      'https://smalruby.app',
      'https://preview.smalruby.app',
    ]);
    expect(
      resolveCorsOrigins('stg', PROD_ORIGINS, 'https://preview.smalruby.app,https://smalruby.app'),
    ).toEqual(['https://preview.smalruby.app', 'https://smalruby.app']);
  });

  test('prod に localhost を渡した env は deploy させない', () => {
    expect(() =>
      resolveCorsOrigins('prod', PROD_ORIGINS, 'https://smalruby.app,http://localhost:8601'),
    ).toThrow(/must not contain local origins in prod/);
  });

  test('prod でも本番オリジンだけの env は通る', () => {
    expect(resolveCorsOrigins('prod', PROD_ORIGINS, 'https://smalruby.app')).toEqual([
      'https://smalruby.app',
    ]);
  });

  test('env の空要素・余分な空白を落とす', () => {
    expect(resolveCorsOrigins('stg', PROD_ORIGINS, ' https://a.example , , https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
      ...PREVIEW_ORIGINS,
    ]);
  });
});

describe('withPreviewOrigins（prod の許可オリジンは 1 文字も変えない）', () => {
  test('非 prod では末尾にブランチプレビューを足す', () => {
    expect(withPreviewOrigins('stg', 'https://smalruby.app,http://localhost:8601')).toBe(
      'https://smalruby.app,http://localhost:8601,https://preview.smalruby.app',
    );
    expect(PREVIEW_ORIGINS).toEqual(['https://preview.smalruby.app']);
  });

  test('非 prod ですでに含まれていれば重複させない', () => {
    expect(withPreviewOrigins('stg', 'https://smalruby.app, https://preview.smalruby.app')).toBe(
      'https://smalruby.app, https://preview.smalruby.app',
    );
  });

  test('prod は渡された値をそのまま返す', () => {
    const value = 'https://smalruby.app,https://smalruby.jp,http://localhost:8601';

    expect(withPreviewOrigins('prod', value)).toBe(value);
  });
});
