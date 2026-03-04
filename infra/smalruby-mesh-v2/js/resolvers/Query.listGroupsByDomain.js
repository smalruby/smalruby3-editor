// listGroupsByDomain Query Resolver
// Domain内のグループ一覧を取得するクエリ

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { domain } = ctx.args;
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);
  const ttlSeconds = +(ctx.env.MESH_HOST_HEARTBEAT_TTL_SECONDS || '150');
  const threshold = nowEpoch - ttlSeconds;

  return {
    operation: 'Query',
    query: {
      expression: 'pk = :pk AND begins_with(sk, :sk_prefix)',
      expressionValues: util.dynamodb.toMapValues({
        ':pk': `DOMAIN#${domain}`,
        ':sk_prefix': 'GROUP#'
      })
    },
    filter: {
      expression: 'heartbeatAt > :threshold AND expiresAt > :now',
      expressionValues: util.dynamodb.toMapValues({
        ':threshold': threshold,
        ':now': util.time.nowISO8601()
      })
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  // DynamoDBアイテムをGroup型に変換
  // METADATAサフィックスを持つアイテムのみを抽出
  return ctx.result.items
    .filter(item => item.sk.endsWith('#METADATA'))
    .map(item => ({
      id: item.id,
      domain: item.domain,
      fullId: item.fullId,
      name: item.name,
      hostId: item.hostId,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt
    }));
}
