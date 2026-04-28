// Pipeline Function: fetchEventsForPoll
//
// pollGroupData の最初の段階。getEventsSince と同じロジックで
// `pk = GROUP#{groupId}@{domain}` 配下の `sk > EVENT#${since}` を取得し、
// ctx.stash.events に保存する。次の Function (fetchNodeStatusesForPoll) に
// stash 経由で渡す。
//
// issue #554: 単一クエリ実行のため、ここでは Event 配列だけを stash する。

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain, since } = ctx.arguments;
  const sk = since.startsWith('EVENT#') ? since : `EVENT#${since}`;

  return {
    operation: 'Query',
    query: {
      expression: 'pk = :pk AND sk > :sk',
      expressionValues: util.dynamodb.toMapValues({
        ':pk': `GROUP#${groupId}@${domain}`,
        ':sk': sk
      })
    },
    limit: 100,
    scanIndexForward: true
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  const events = ctx.result.items.map(item => ({
    name: item.eventName,
    firedByNodeId: item.firedByNodeId,
    groupId: item.groupId,
    domain: item.domain,
    payload: item.payload,
    timestamp: item.timestamp,
    cursor: item.sk,
    orderKey: item.orderKey || null
  }));

  // 次の Function に渡すために stash に保存
  ctx.stash.events = events;
  return events;
}
