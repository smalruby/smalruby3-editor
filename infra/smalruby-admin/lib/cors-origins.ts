/**
 * CORS 許可オリジンの組み立て (#1160 / #1342 / #1373)。
 *
 * **正本は `infra/shared/cors-origins.ts`**。各 CDK プロジェクトの `lib/cors-origins.ts` は
 * そのコピーなので直接編集しない。正本を直してから `node infra/shared/sync.js` で配る
 * （ずれていると各プロジェクトの `lambda/tests/shared-copies.test.ts` が落ちる）。
 * 各プロジェクトが自分のディレクトリにコピーを持つのは、`Deploy Infra` が差分に
 * `infra/<project>/` が現れたプロジェクトだけをデプロイするため（共有ディレクトリだけを
 * 直すと、どのプロジェクトにも出ない）。
 *
 * ローカルの dev server は 8601 から順に使う（scratch-gui = 8601 / Admin SPA = 8602）。
 * devpod で worktree を並行起動すると 8603 以降も割り当てられるため、非 prod では
 * 範囲でまとめて許可する。HTTP API v2 の `allowOrigins` は**完全一致**で、ポートに
 * ワイルドカードは使えないので列挙する。
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

/**
 * ブランチプレビューのオリジン（非 prod のみで使う・#1342）。
 * プレビューは stg の API を見るので、stg 側でだけ許可する。prod には足さない。
 */
export const PREVIEW_ORIGINS = ['https://preview.smalruby.app'];

/** そのオリジンがローカル開発用（本番に出してはいけないもの）か。 */
export const isLocalOrigin = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin.trim());

/**
 * ステージに応じた許可オリジンを決める（classroom / bug-report / admin が使う）。
 *
 * env `CORS_ALLOWED_ORIGINS` が最優先。prod にローカルオリジンが混ざっていたら
 * **deploy させない**（`DEV_BYPASS_TOKEN` の prod ガードと同じ考え方。CORS は
 * 「開発中は緩めて戻し忘れる」が起きやすいので、戻し忘れを検知する側に倒す）。
 *
 * 非 prod ではブランチプレビューのオリジンを **env を指定していても**足す。stg の env は
 * GitHub secrets 由来で `CORS_ALLOWED_ORIGINS` を明示しているため、既定値に足すだけでは
 * stg に届かない。
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
  const base = envValue
    ? envValue.split(',').map(o => o.trim()).filter(Boolean)
    : [...productionOrigins, ...(stage === 'prod' ? [] : localDevOrigins())];
  const origins =
    stage === 'prod' ? base : [...base, ...PREVIEW_ORIGINS.filter(o => !base.includes(o))];

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

/**
 * カンマ区切りの許可オリジンに、非 prod ならブランチプレビューを足す（api / rubytee-relay が使う）。
 *
 * この 2 プロジェクトは `resolveCorsOrigins` を使わず、既定値も `http://localhost:8601` だけで
 * prod のローカルオリジン検査も無い（`resolveCorsOrigins` へ寄せると既定の許可オリジンが変わる
 * ため、挙動を変えない共通化では寄せていない）。prod は渡された値をそのまま返す。
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
