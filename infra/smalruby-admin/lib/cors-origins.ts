/**
 * CORS 許可オリジンの組み立て (#1160)。
 *
 * ローカルの dev server は 8601 から順に使う（scratch-gui = 8601 / Admin SPA = 8602）。
 * devpod で worktree を並行起動すると 8603 以降も割り当てられるため、非 prod では
 * 範囲でまとめて許可する。HTTP API v2 の `allowOrigins` は**完全一致**で、ポートに
 * ワイルドカードは使えないので列挙する。
 *
 * 各 infra プロジェクトは独立した npm パッケージで共有モジュールを持てないため、
 * 同じ内容のファイルが他プロジェクトにもある。変更するときは揃えること。
 */

/** ローカル dev server に割り当てるポートの範囲（両端を含む）。 */
export const LOCAL_DEV_PORT_FIRST = 8601;
export const LOCAL_DEV_PORT_LAST = 8610;

/** ローカル開発で許可するオリジン（非 prod のみで使う）。 */
export const localDevOrigins = (): string[] => {
  const origins: string[] = [];
  for (let port = LOCAL_DEV_PORT_FIRST; port <= LOCAL_DEV_PORT_LAST; port += 1) {
    origins.push(`http://localhost:${port}`);
  }
  return origins;
};

/** そのオリジンがローカル開発用（本番に出してはいけないもの）か。 */
export const isLocalOrigin = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin.trim());

/**
 * ステージに応じた許可オリジンを決める。
 *
 * env `CORS_ALLOWED_ORIGINS` が最優先。prod にローカルオリジンが混ざっていたら
 * **deploy させない**（`DEV_BYPASS_TOKEN` の prod ガードと同じ考え方。CORS は
 * 「開発中は緩めて戻し忘れる」が起きやすいので、戻し忘れを検知する側に倒す）。
 * @param stage - デプロイ先ステージ
 * @param productionOrigins - どのステージでも許可する本番オリジン
 * @param envValue - `CORS_ALLOWED_ORIGINS` の値（未設定なら undefined）
 * @returns 許可オリジンの配列
 */
export const resolveCorsOrigins = (
  stage: string,
  productionOrigins: string[],
  envValue?: string,
): string[] => {
  const origins = envValue
    ? envValue.split(',').map(o => o.trim()).filter(Boolean)
    : [...productionOrigins, ...(stage === 'prod' ? [] : localDevOrigins())];

  if (stage === 'prod') {
    const local = origins.filter(isLocalOrigin);
    if (local.length > 0) {
      throw new Error(
        `CORS_ALLOWED_ORIGINS must not contain local origins in prod: ${local.join(', ')}`,
      );
    }
  }
  return origins;
};
