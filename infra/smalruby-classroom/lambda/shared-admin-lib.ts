/**
 * Pure logic for the みんなの課題 moderation CLI (issue #1071, EPIC #1066 D3).
 *
 * bin/shared-assignments-admin.ts owns the I/O; argument parsing, report
 * grouping and the human-readable rendering live here so the moderation
 * behavior is unit-testable. reporterSub is internal abuse-tracing data and
 * is deliberately never rendered.
 */

export type AdminCommand = 'list-reports' | 'show' | 'unpublish' | 'republish';

export interface AdminArgs {
  command: AdminCommand;
  sharedId: string | null;
  apply: boolean;
}

const COMMANDS_NEEDING_ID: AdminCommand[] = ['show', 'unpublish', 'republish'];

/**
 * Parse CLI arguments. Throws on unknown commands/flags so a typo never
 * unpublishes the wrong thing.
 * @param argv - process.argv.slice(2)
 * @returns parsed arguments (dry-run by default for mutations)
 */
export function parseAdminArgs(argv: string[]): AdminArgs {
  const [command, ...rest] = argv;
  if (command !== 'list-reports' && command !== 'show' && command !== 'unpublish' && command !== 'republish') {
    throw new Error('Usage: shared-assignments-admin <list-reports | show | unpublish | republish> [sharedId] [--apply]');
  }
  const args: AdminArgs = { command, sharedId: null, apply: false };
  for (const token of rest) {
    if (token === '--apply') {
      args.apply = true;
    } else if (!token.startsWith('-') && !args.sharedId) {
      args.sharedId = token;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (COMMANDS_NEEDING_ID.includes(command) && !args.sharedId) {
    throw new Error(`${command} requires a sharedId`);
  }
  return args;
}

export interface ReportRecord {
  sharedId: string;
  reason: string;
  createdAt: string;
}

/**
 * Group report rows by sharedId, newest first inside each group.
 * @param reports - raw report items
 * @returns sharedId → reports (sorted), insertion ordered by report count desc
 */
export function groupReports(reports: ReportRecord[]): Map<string, ReportRecord[]> {
  const byId = new Map<string, ReportRecord[]>();
  for (const report of reports) {
    const list = byId.get(report.sharedId) || [];
    list.push(report);
    byId.set(report.sharedId, list);
  }
  for (const list of byId.values()) {
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
  return new Map([...byId.entries()].sort((a, b) => b[1].length - a[1].length));
}

/**
 * Render the report queue: one block per reported item with its title,
 * status and the reasons (reporterSub is never shown).
 * @param grouped - output of groupReports
 * @param itemsById - shared items looked up for the reported ids
 * @returns printable lines
 */
export function renderReportQueue(
  grouped: Map<string, ReportRecord[]>,
  itemsById: Map<string, Record<string, unknown>>,
): string[] {
  if (grouped.size === 0) return ['通報はありません。'];
  const lines: string[] = [];
  for (const [sharedId, reports] of grouped.entries()) {
    const item = itemsById.get(sharedId);
    const title = item ? String(item.title) : '(削除済み/不明)';
    const status = item ? String(item.status) : '-';
    lines.push(`■ ${title} (${sharedId}) status=${status} 通報 ${reports.length} 件`);
    for (const report of reports) {
      lines.push(`  - [${report.createdAt}] ${report.reason}`);
    }
  }
  return lines;
}

/**
 * Render one shared item for the `show` command (public fields only).
 * @param item - the shared assignment item
 * @returns printable lines
 */
export function renderSharedItem(item: Record<string, unknown>): string[] {
  const content = (item.content || {}) as { pages?: { text: string }[]; starterKey?: string };
  const lines = [
    `sharedId:   ${item.sharedId}`,
    `title:      ${item.title}`,
    `status:     ${item.status}`,
    `author:     ${item.authorName}${item.authorAffiliation ? `（${item.authorAffiliation}）` : ''}`,
    `attributes: ${item.schoolLevel} / ${item.subject} / 学年 ${(item.grades as number[] | undefined)?.join('・') || '-'}`,
    `tags:       ${(item.tags as string[] | undefined)?.join(', ') || '-'}`,
    `supplement: ${item.supplementUrl || '-'}`,
    `reuse:      ${item.reuseCount || 0} 回`,
    `created:    ${item.createdAt} / updated: ${item.updatedAt}`,
    `starter:    ${content.starterKey ? 'あり' : 'なし'}`,
    'pages:',
  ];
  for (const [index, page] of (content.pages || []).entries()) {
    lines.push(`  ${index + 1}. ${page.text.slice(0, 120).replace(/\n/g, ' / ')}`);
  }
  return lines;
}
