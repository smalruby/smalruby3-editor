// Pipeline Function: fetchNodeStatusesForPoll
//
// pollGroupData の 2 段階目。listGroupStatuses と同じロジックで
// `pk = DOMAIN#{domain}` 配下の `GROUP#{groupId}#NODE#*` から
// `#STATUS` で終わるアイテム（ノードのセンサーデータ）のみを抽出する。
//
// issue #554: ctx.stash.events と組み合わせて PollGroupData を構築する。

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain } = ctx.arguments;

  if (!domain || !groupId) {
    util.error('groupId and domain are required', 'ValidationError');
  }
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);

  return {
    operation: 'Query',
    query: {
      expression: 'pk = :pk AND begins_with(sk, :sk_prefix)',
      expressionValues: util.dynamodb.toMapValues({
        ':pk': `DOMAIN#${domain}`,
        ':sk_prefix': `GROUP#${groupId}#NODE#`
      })
    },
    filter: {
      expression: 'attribute_not_exists(#ttl) OR #ttl > :now',
      expressionNames: {
        '#ttl': 'ttl'
      },
      expressionValues: util.dynamodb.toMapValues({
        ':now': nowEpoch
      })
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  const nodeStatuses = ctx.result.items
    .filter(item => item.sk && item.sk.endsWith('#STATUS'))
    .map(item => ({
      nodeId: item.nodeId,
      groupId: item.groupId,
      domain: item.domain,
      data: item.data || [],
      timestamp: item.timestamp
    }));

  // PollGroupData 型を構築 (前段の stash.events と結合)
  return {
    events: ctx.stash.events || [],
    nodeStatuses: nodeStatuses
  };
}
