/**
 * 課題ごとの「返却していない提出の数」(`unreturnedCount`) の数え方と増減の判断
 * (issue #1972)。
 *
 * クラス一覧の「確認が必要な課題」を、課題ごとに提出の一覧を読み直さずに出すため、
 * 数を課題 (Classrooms の item) に持たせ、提出の作成・返却のときに増減する。
 * 数え方（GUI の課題ボードの集計 `summarizeAssignmentRow` / `enrichMembers` と同じ見方）:
 * - 席 (memberId) ごとにいちばん新しい提出だけを見る（出し直しを 2 回数えない）。
 * - `status !== 'returned'` を数える。
 * - **退室した席（left）の提出は数えない**。「退室」= その席にいまメンバーの行が無いか、
 *   先生に退室させられた（kicked=true の墓標）こと。同じ席に次の生徒が入ると、その席の
 *   提出はまた数える（GUI もその席のメンバーに提出を結びつけるため）。
 * - レッスンの課題（提出・返却の流れが無い）は、一覧で数を返さない（handler 側）。
 *
 * 数が動くのは: 提出（同じ席の前の提出を置きかえる）・返却・退室（自分で / 先生が）・
 * 空いた席への参加。それぞれの増減をここで決め、handler が課題の item の数を増減する。
 *
 * I/O は handler.ts / bin/backfill-unreturned-count.ts に置き、ここは判断だけを持つ。
 */

/** 提出 1 件のうち、数えるのに要る項目。 */
export interface SubmissionForCount {
  memberId?: unknown;
  status?: unknown;
  submittedAt?: unknown;
}

/**
 * その席にいまメンバーがいるか（退室していないか）。
 * @param membership - Memberships の行（無ければ undefined）
 * @returns いれば true
 */
export function isSeatOccupied(membership: Record<string, unknown> | null | undefined): boolean {
  return !!membership && membership.kicked !== true;
}

/**
 * 返却していない提出の数。席ごとにいちばん新しい提出だけを見る
 * （出し直した生徒を 2 回数えない）。`occupiedMemberIds` を渡すと、そこに無い席
 * （退室した席）の提出は数えない。
 * @param submissions - 1 つの課題の提出
 * @param occupiedMemberIds - いまメンバーがいる席の memberId（省略時は全部の席を数える）
 * @returns 数
 */
export function countUnreturnedSubmissions(
  submissions: SubmissionForCount[],
  occupiedMemberIds?: Set<string>,
): number {
  const latest = new Map<string, SubmissionForCount>();
  for (const sub of submissions || []) {
    if (!sub || !sub.memberId) continue;
    const key = String(sub.memberId);
    const prev = latest.get(key);
    if (!prev || String(sub.submittedAt || '') > String(prev.submittedAt || '')) {
      latest.set(key, sub);
    }
  }
  let count = 0;
  for (const [memberId, sub] of latest) {
    if (occupiedMemberIds && !occupiedMemberIds.has(memberId)) continue;
    if (sub.status !== 'returned') count++;
  }
  return count;
}

/**
 * その席のいちばん新しい提出が、返却していないものか。
 * @param seatSubmissions - その席の提出（ふつうは 0 か 1 件）
 * @returns 返却していない提出があれば true
 */
export function hasUnreturnedSubmission(seatSubmissions: SubmissionForCount[]): boolean {
  return countUnreturnedSubmissions(seatSubmissions) > 0;
}

/**
 * 席の在・不在が変わるときの数の増減（参加 = 空席→在席、退室 = 在席→空席）。
 * その席に返却していない提出があるときだけ動く。
 * @param wasOccupied - 変わる前に在席だったか
 * @param isOccupied - 変わったあとに在席か
 * @param seatHasUnreturned - その席に返却していない提出があるか
 * @returns 増減
 */
export function unreturnedDeltaOnOccupancy(
  wasOccupied: boolean,
  isOccupied: boolean,
  seatHasUnreturned: boolean,
): number {
  if (!seatHasUnreturned || wasOccupied === isOccupied) return 0;
  return isOccupied ? 1 : -1;
}

/**
 * 提出を作るときの数の増減。新しい提出はいつも「返却していない」なので +1。
 * 同じ席の前の提出を消したなら、それが返却していないものだったぶん -1。
 * @param deletedPrevious - 消した前の提出（無ければ null / undefined）
 * @returns 増減
 */
export function unreturnedDeltaOnSubmit(deletedPrevious: SubmissionForCount | null | undefined): number {
  if (deletedPrevious && deletedPrevious.status !== 'returned') return 0;
  return 1;
}

/**
 * 提出を更新するときの数の増減。在席の席の、返却していないものを返却したときだけ -1
 * （返却済みをもう一度返却しても、コメントだけ変えても、退室した席の提出を返却しても
 * 数は変わらない。退室した席の提出はもともと数えていないため）。
 * @param oldStatus - 更新前の status
 * @param newStatus - 更新後の status（status を変えないときは undefined）
 * @param seatOccupied - その提出の席にいまメンバーがいるか
 * @returns 増減
 */
export function unreturnedDeltaOnUpdate(oldStatus: unknown, newStatus: unknown, seatOccupied: boolean): number {
  if (seatOccupied && newStatus === 'returned' && oldStatus !== 'returned') return -1;
  return 0;
}

/**
 * 課題の item が持っている数。数を持っていない課題（この項目を足す前に作った課題で、
 * まだ数を埋めていないもの）は undefined。
 * @param item - Classrooms の item
 * @returns 数、または undefined
 */
export function unreturnedCountOf(item: Record<string, unknown> | undefined): number | undefined {
  const value = item?.unreturnedCount;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
}

/** バックフィルの引数。 */
export interface UnreturnedBackfillArgs {
  apply: boolean;
  /** 数を持っている課題も数え直して上書きする。 */
  recount: boolean;
  /** 書かずに、持っている数と数え直した数の食い違いだけを表示する。 */
  verify: boolean;
}

/**
 * `bin/backfill-unreturned-count.ts` の引数を読む。
 * @param argv - process.argv.slice(2)
 * @returns 引数
 */
export function parseUnreturnedBackfillArgs(argv: string[]): UnreturnedBackfillArgs {
  const args: UnreturnedBackfillArgs = { apply: false, recount: false, verify: false };
  for (const arg of argv) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--recount') args.recount = true;
    else if (arg === '--verify') args.verify = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (args.verify && (args.apply || args.recount)) {
    throw new Error('--verify only reads; do not combine it with --apply / --recount');
  }
  return args;
}

/**
 * バックフィルで数える課題か。既定では数を持っていない課題だけ。
 * 論理削除（status=deleted など）の課題は一覧に出ないので数えない。
 * @param item - Classrooms の item
 * @param recount - 持っている課題も数え直す
 * @returns 数えるなら true
 */
export function needsUnreturnedBackfill(item: Record<string, unknown>, recount: boolean): boolean {
  if (!item.classroomId) return false;
  if (item.status !== 'active' && item.status !== 'archived') return false;
  return recount || unreturnedCountOf(item) === undefined;
}

/**
 * `--verify` で食い違いを確かめる課題か（数を持っている active / archived の課題）。
 * @param item - Classrooms の item
 * @returns 確かめるなら true
 */
export function needsUnreturnedVerify(item: Record<string, unknown>): boolean {
  if (!item.classroomId) return false;
  if (item.status !== 'active' && item.status !== 'archived') return false;
  return unreturnedCountOf(item) !== undefined;
}
