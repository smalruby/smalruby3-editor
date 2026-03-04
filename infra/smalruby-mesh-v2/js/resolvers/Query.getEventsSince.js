// Query.getEventsSince Resolver
// 前回取得日時以降のイベントを取得する（ポーリング用）

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
    scanIndexForward: true // timestamp で昇順にソート
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return ctx.result.items.map(item => ({
    name: item.eventName,
    firedByNodeId: item.firedByNodeId,
    groupId: item.groupId,
    domain: item.domain,
    payload: item.payload,
    timestamp: item.timestamp,
    cursor: item.sk
  }));
}
