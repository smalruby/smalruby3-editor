/**
 * メンバー一覧の `aiUsage`（ルビティーの上限と今日の回数）を組み立てる純粋関数 (issue #1311)。
 *
 * データは rubytee relay（infra/smalruby-rubytee-relay）が書く 2 つの表にあり、
 * クラス管理は読むだけ（読み取り権限だけを持つ）:
 * - レート制限表の席ごとの「今の状況」の 1 行
 *   （キー sourceIp = `seat#<classroomId>:<seat>#current`, windowStart = 0）。
 *   上限・窓も relay が書くので、ここで上限の計算はしない（relay で値を変えてもずれない）。
 * - 集計表 RubyteeRelayUsage（pk = `classroom#<classroomId>`,
 *   sk = `<YYYY-MM-DD(JST)>#seat#<seat>#<purpose>`）。
 *
 * キーの形は relay の `lambda/takeover.ts` と対で変えること。
 * I/O（BatchGet / Query）は handler.ts の handleListMembers が行う。
 */

export const PURPOSE_TAKEOVER = 'genai-takeover';
export const PURPOSE_CHAT = 'chat';

/** relay が使う既定の上限（席の行がまだ無いときに見せる値）。 */
export const DEFAULT_TAKEOVER_LIMIT = 40;
export const DEFAULT_WINDOW_MINUTES = 35;

/** `seat-03` → `3`。席でない memberId は null。 */
export function seatFromMemberId(memberId: unknown): string | null {
  if (typeof memberId !== 'string') return null;
  const m = /^seat-(\d+)$/.exec(memberId);
  return m ? String(parseInt(m[1], 10)) : null;
}

export function seatStatusKey(classroomId: string, seat: string): { sourceIp: string; windowStart: number } {
  return { sourceIp: `seat#${classroomId}:${seat}#current`, windowStart: 0 };
}

/** 日本時間の YYYY-MM-DD（relay の集計表の日付と同じ区切り）。 */
export function jstDate(nowMs: number): string {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function usagePk(classroomId: string): string {
  return `classroom#${classroomId}`;
}

export interface UsageCounts {
  requests: number;
  rateLimited: number;
  succeeded: number;
  failed: number;
}

export interface AiUsage {
  takeover: {
    used: number;
    limit: number;
    windowMinutes: number;
    resetAt: string | null;
    limited: boolean;
  };
  today: {
    takeover: UsageCounts;
    chat: UsageCounts;
  };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const emptyCounts = (): UsageCounts => ({ requests: 0, rateLimited: 0, succeeded: 0, failed: 0 });

/** epoch 秒を日本時間の ISO 文字列（+09:00）にする。 */
export function toJstIso(epochSeconds: number): string {
  const jst = new Date(epochSeconds * 1000 + 9 * 60 * 60 * 1000).toISOString();
  return `${jst.slice(0, 19)}+09:00`;
}

/** 集計表の行を席ごと・purpose ごとの今日の回数にまとめる。 */
export function todayCountsBySeat(rows: Array<Record<string, unknown>>): Map<string, AiUsage['today']> {
  const bySeat = new Map<string, AiUsage['today']>();
  for (const row of rows) {
    const m = typeof row.sk === 'string' ? /^\d{4}-\d{2}-\d{2}#seat#([^#]+)#(.+)$/.exec(row.sk) : null;
    if (!m) continue;
    const [, seat, purpose] = m;
    const key = purpose === PURPOSE_TAKEOVER ? 'takeover' : purpose === PURPOSE_CHAT ? 'chat' : null;
    if (!key) continue;
    const today = bySeat.get(seat) || { takeover: emptyCounts(), chat: emptyCounts() };
    today[key] = {
      requests: num(row.requests),
      rateLimited: num(row.rateLimited),
      succeeded: num(row.succeeded),
      failed: num(row.failed),
    };
    bySeat.set(seat, today);
  }
  return bySeat;
}

/**
 * 1 席ぶんの aiUsage。窓が終わった行（TTL の掃除待ち）は「使っていない」と同じに扱う。
 */
export function buildAiUsage(
  statusRow: Record<string, unknown> | undefined,
  today: AiUsage['today'] | undefined,
  nowSeconds: number,
): AiUsage {
  const live = statusRow && num(statusRow.resetAt) > nowSeconds ? statusRow : undefined;
  const used = live ? num(live.count) : 0;
  const limit = statusRow && num(statusRow.limit) > 0 ? num(statusRow.limit) : DEFAULT_TAKEOVER_LIMIT;
  const windowMinutes = statusRow && num(statusRow.windowMinutes) > 0
    ? num(statusRow.windowMinutes) : DEFAULT_WINDOW_MINUTES;
  return {
    takeover: {
      used,
      limit,
      windowMinutes,
      resetAt: live ? toJstIso(num(live.resetAt)) : null,
      limited: used >= limit,
    },
    today: today || { takeover: emptyCounts(), chat: emptyCounts() },
  };
}
