/**
 * ブランチプレビューの CORS 許可 (#1342)。
 *
 * ブランチプレビュー（https://preview.smalruby.app）は stg の API を見るので、非 prod では
 * 許可オリジンに足す。stg の env は GitHub secrets 由来で `CORS_ALLOWED_ORIGINS` を明示して
 * いるため、既定値に足すだけでは stg に届かない。そこで env を読んだ後の値に足す。
 * prod は渡された値をそのまま返す（prod の許可オリジンを変えない）。
 */

/** ブランチプレビューのオリジン（非 prod のみで使う）。 */
export const PREVIEW_ORIGINS = ['https://preview.smalruby.app'];

/**
 * カンマ区切りの許可オリジンに、非 prod ならブランチプレビューを足す。
 * @param stage - デプロイ先ステージ
 * @param origins - `CORS_ALLOWED_ORIGINS`（または既定値）のカンマ区切り文字列
 * @returns 許可オリジンのカンマ区切り文字列
 */
export const withPreviewOrigins = (stage: string, origins: string): string => {
    if (stage === 'prod') return origins;
    const present = origins.split(',').map(o => o.trim());
    const missing = PREVIEW_ORIGINS.filter(o => !present.includes(o));
    return [origins, ...missing].join(',');
};
