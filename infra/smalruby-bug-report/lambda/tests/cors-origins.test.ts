/**
 * CORS 許可オリジンの決定ロジック (#1160)。
 *
 * ローカルの dev server は 8601 から順に使うため非 prod では範囲で許可するが、
 * その緩和が prod に漏れないことが本質。ここが崩れると本番 API が localhost から
 * 叩けてしまうので、範囲そのものより「prod に入らない」ことを厚めに固定する。
 */
import {
  LOCAL_DEV_PORT_FIRST,
  LOCAL_DEV_PORT_LAST,
  isLocalOrigin,
  localDevOrigins,
  resolveCorsOrigins,
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
  test('非 prod は本番オリジン + ローカル範囲', () => {
    const origins = resolveCorsOrigins('stg', PROD_ORIGINS);

    expect(origins).toEqual([...PROD_ORIGINS, ...localDevOrigins()]);
  });

  test('prod はローカルを一切含まない', () => {
    const origins = resolveCorsOrigins('prod', PROD_ORIGINS);

    expect(origins).toEqual(PROD_ORIGINS);
    expect(origins.some(isLocalOrigin)).toBe(false);
  });

  test('env の指定が既定より優先される', () => {
    const origins = resolveCorsOrigins('stg', PROD_ORIGINS, 'https://example.com, http://localhost:9999');

    expect(origins).toEqual(['https://example.com', 'http://localhost:9999']);
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
    ]);
  });
});
