// listNodesInGroup Query Resolver
// グループ内に所属しているノード一覧を取得する

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain } = ctx.args;
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

  // Node情報を抽出（#STATUSで終わらない、かつNODE#を含むアイテム）
  return ctx.result.items
    .filter(item => item.sk.includes('#NODE#') && !item.sk.endsWith('#STATUS'))
    .map(item => ({
      id: item.nodeId,
      name: item.name || `Node ${item.nodeId}`,
      groupId: item.groupId,
      domain: item.domain
    }));
}
