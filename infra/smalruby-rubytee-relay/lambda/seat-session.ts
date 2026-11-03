// 席（classroom + 出席番号）の確かめ方の純粋な部分 (#1317)。
// リクエストの classroom / seat は自己申告で、他の生徒の席の枠・先生に見せる aiUsage・集計表を
// 動かせてしまう。そこで生徒がクラスに参加したときにもらう sessionToken を、クラス管理の
// ClassroomMemberships{suffix} の GSI `sessionToken-index` で引き、行の classroomId / memberId だけを
// 席として信じる。DynamoDB への問い合わせ（I/O）は handler.ts の verifySeatSession が行う。
import { isSeatCountable, normalizeSeat } from './takeover';

/** クラス管理の memberships 表の GSI 名（infra/smalruby-classroom の classroom-stack.ts と対）。 */
export const SESSION_TOKEN_INDEX_NAME = 'sessionToken-index';

// クラス管理の sessionToken は crypto.randomUUID()。形の違うものは表を引かずに捨てる。
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSessionTokenFormat(token: unknown): token is string {
  return typeof token === 'string' && SESSION_TOKEN_PATTERN.test(token);
}

export interface SeatIdentity {
  classroom: string;
  seat: string;
}

/**
 * memberships の 1 行から、席として数えてよい classroom / seat を取り出す。
 * クラス管理の verifySessionToken と同じく、kicked の行（退室させた生徒の墓標）は認めない。
 * memberId は `seat-03` の形（出席番号を 2 桁にしたもの）なので、数字だけを席にする。
 */
export function seatIdentityFromMembership(item: Record<string, unknown> | undefined): SeatIdentity | null {
  if (!item || item.kicked === true) return null;
  const classroom = item.classroomId;
  const memberId = item.memberId;
  if (typeof classroom !== 'string' || typeof memberId !== 'string') return null;
  const m = /^seat-(\d+)$/.exec(memberId);
  if (!m) return null;
  const seat = normalizeSeat(m[1]);
  return isSeatCountable(classroom, seat) ? { classroom, seat } : null;
}
