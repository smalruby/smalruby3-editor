// listGroupStatuses Query Resolver
// グループ内の全NodeStatusを取得するクエリ

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain } = ctx.args;

  // domainとgroupIdは必須
  if (!domain || !groupId) {
    util.error('groupId and domain are required', 'ValidationError');
  }
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);

  // DynamoDB Query: DOMAIN#${domain} 配下の GROUP#${groupId}#NODE#*#STATUS を取得
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

  // DynamoDBアイテムをNodeStatus型に変換
  // sk が #STATUS で終わるアイテムのみを抽出
  const statuses = ctx.result.items
    .filter(item => item.sk && item.sk.endsWith('#STATUS'))
    .map(item => ({
      nodeId: item.nodeId,
      groupId: item.groupId,
      domain: item.domain,
      data: item.data || [],
      timestamp: item.timestamp
    }));

  // 配列を返す（空配列も許容）
  return statuses;
}
