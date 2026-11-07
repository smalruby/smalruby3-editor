/**
 * ブランチプレビューの CORS 許可 (#1342)。
 *
 * プレビュー（https://preview.smalruby.app）は stg の API を見るので非 prod では許可するが、
 * prod の許可オリジンは 1 文字も変えない（cdk diff を出さない）ことを固定する。
 */
import { PREVIEW_ORIGINS, withPreviewOrigins } from '../../lib/preview-origins';

describe('withPreviewOrigins', () => {
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
