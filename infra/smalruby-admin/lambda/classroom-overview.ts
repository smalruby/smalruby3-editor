/**
 * Pure aggregation for the クラス・課題 俯瞰ダッシュボード (Admin, EPIC #1073).
 *
 * The operator wants to grasp "どんな課題がどれくらい作られているか" along three
 * axes (chosen in the design interview): creation trend, content richness and
 * theme tendency — NOT popularity/engagement. Kept pure so the whole shape is
 * unit-tested without DynamoDB.
 */

/** A classroom row as stored (only the fields we aggregate on). */
export interface ClassroomRow {
  classroomId?: unknown;
  className?: unknown;
  assignmentName?: unknown;
  teacherSub?: unknown;
  status?: unknown; // 'active' | 'archived'
  createdAt?: unknown;
  // 課題コンテンツは classroom item の `assignment` 属性（`content` は
  // SharedAssignments 側のフィールド名 — 取り違えると richness が常に 0 で
  // 有益候補が空になるバグだった #1106）。
  assignment?: { pages?: { text?: string; imageKey?: string }[]; starterKey?: string };
  // 共有推奨 (#1106): admin が立てるフラグ。候補一覧に「推奨済み」を出す。
  recommendedForSharingAt?: unknown;
}

/** Quota rows reuse the classrooms key space; never count them. */
export function isRealClassroom(row: ClassroomRow): boolean {
  return typeof row.classroomId === 'string' && !row.classroomId.includes('-quota#');
}

/**
 * Content richness score (0-4): 1 for having any page, +1 for multiple pages,
 * +1 for any page image, +1 for a starter project. Higher = more ready to
 * share as-is to みんなの課題.
 * @param row - classroom row
 * @returns {score, pageCount, hasImages, hasStarter}
 */
export function richness(row: ClassroomRow): {
  score: number; pageCount: number; hasImages: boolean; hasStarter: boolean;
} {
  const pages = row.assignment?.pages || [];
  const pageCount = pages.length;
  const hasImages = pages.some(p => typeof p?.imageKey === 'string' && p.imageKey.length > 0);
  const hasStarter = typeof row.assignment?.starterKey === 'string' && row.assignment.starterKey.length > 0;
  let score = 0;
  if (pageCount >= 1) score += 1;
  if (pageCount >= 2) score += 1;
  if (hasImages) score += 1;
  if (hasStarter) score += 1;
  return { score, pageCount, hasImages, hasStarter };
}

/** Split a Japanese/English title into rough keyword tokens for tallying. */
export function tokenizeTitle(title: string): string[] {
  return title
    .normalize('NFKC')
    .toLowerCase()
    // split on whitespace, punctuation and common separators (keep JP/EN/digits)
    .split(/[\s、。・,.\/|:：;；\-—_（）()「」『』［］\[\]{}!！?？]+/u)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !/^\d+$/.test(t));
}

const MONTH_KEY = (iso: string): string => iso.slice(0, 7); // YYYY-MM

/**
 * Build the whole overview payload from every classroom row.
 * @param rows - raw classroom items (quota rows are filtered out here)
 * @param sharedTitles - normalized assignment titles already on みんなの課題
 *   (to flag "likely already shared" candidates); pass [] if unknown
 * @param nowMs - current time (injectable for deterministic tests)
 * @returns the dashboard aggregation
 */
export function buildOverview(
  rows: ClassroomRow[],
  sharedTitles: string[],
  nowMs: number,
): {
  summary: { total: number; active: number; archived: number; recent30d: number };
  creationTrend: { month: string; count: number }[];
  richnessDistribution: { score: number; count: number }[];
  candidates: {
    classroomId: string; className: string; assignmentName: string;
    teacherSub: string; score: number; pageCount: number;
    hasImages: boolean; hasStarter: boolean; createdAt: string; likelyShared: boolean;
    recommendedForSharing: boolean;
  }[];
  themeKeywords: { keyword: string; count: number }[];
} {
  const classrooms = rows.filter(isRealClassroom);
  const sharedSet = new Set(sharedTitles.map(t => t.normalize('NFKC').trim().toLowerCase()));
  const cutoff30 = nowMs - 30 * 24 * 60 * 60 * 1000;

  let active = 0;
  let archived = 0;
  let recent30d = 0;
  const byMonth = new Map<string, number>();
  const byScore = new Map<number, number>();
  const keywordCount = new Map<string, number>();
  const candidates: ReturnType<typeof buildOverview>['candidates'] = [];

  for (const row of classrooms) {
    const status = String(row.status || '');
    if (status === 'archived') archived += 1; else active += 1;

    const createdAt = typeof row.createdAt === 'string' ? row.createdAt : '';
    if (createdAt) {
      byMonth.set(MONTH_KEY(createdAt), (byMonth.get(MONTH_KEY(createdAt)) || 0) + 1);
      if (Date.parse(createdAt) >= cutoff30) recent30d += 1;
    }

    const r = richness(row);
    byScore.set(r.score, (byScore.get(r.score) || 0) + 1);

    const assignmentName = typeof row.assignmentName === 'string' ? row.assignmentName : '';
    const className = typeof row.className === 'string' ? row.className : '';
    for (const token of [...tokenizeTitle(assignmentName), ...tokenizeTitle(className)]) {
      keywordCount.set(token, (keywordCount.get(token) || 0) + 1);
    }

    // 有益候補: reasonably rich (>=3) content. Flag likely-already-shared so
    // the operator focuses on the unshared ones.
    if (r.score >= 3) {
      const likelyShared = sharedSet.has(assignmentName.normalize('NFKC').trim().toLowerCase());
      candidates.push({
        classroomId: String(row.classroomId),
        className,
        assignmentName,
        teacherSub: typeof row.teacherSub === 'string' ? row.teacherSub : '',
        score: r.score,
        pageCount: r.pageCount,
        hasImages: r.hasImages,
        hasStarter: r.hasStarter,
        createdAt,
        likelyShared,
        recommendedForSharing: !!row.recommendedForSharingAt,
      });
    }
  }

  const creationTrend = [...byMonth.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const richnessDistribution = [0, 1, 2, 3, 4]
    .map(score => ({ score, count: byScore.get(score) || 0 }));

  // Unshared candidates first, then richer, then newer.
  candidates.sort((a, b) =>
    Number(a.likelyShared) - Number(b.likelyShared) ||
    b.score - a.score ||
    b.createdAt.localeCompare(a.createdAt));

  const themeKeywords = [...keywordCount.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .filter(k => k.count >= 2)
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, 30);

  return {
    summary: { total: classrooms.length, active, archived, recent30d },
    creationTrend,
    richnessDistribution,
    candidates: candidates.slice(0, 50),
    themeKeywords,
  };
}

/**
 * Facet buckets for the restore tab (削除済みスナップショット). Groups a large
 * candidate list by deletion month and by teacher so the operator can narrow
 * down like the みんなの課題 catalog.
 * @param snapshots - matched snapshot summaries
 * @returns facet counts
 */
export function buildRestoreFacets(
  snapshots: { deletedAt?: string | null; teacherSub?: string }[],
): { byMonth: { month: string; count: number }[]; byTeacher: { teacherSub: string; count: number }[] } {
  const byMonth = new Map<string, number>();
  const byTeacher = new Map<string, number>();
  for (const s of snapshots) {
    const month = s.deletedAt ? s.deletedAt.slice(0, 7) : '(不明)';
    byMonth.set(month, (byMonth.get(month) || 0) + 1);
    const t = s.teacherSub || '(不明)';
    byTeacher.set(t, (byTeacher.get(t) || 0) + 1);
  }
  return {
    byMonth: [...byMonth.entries()].map(([month, count]) => ({ month, count }))
      .sort((a, b) => b.month.localeCompare(a.month)),
    byTeacher: [...byTeacher.entries()].map(([teacherSub, count]) => ({ teacherSub, count }))
      .sort((a, b) => b.count - a.count),
  };
}
