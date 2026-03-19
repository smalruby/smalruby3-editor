import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const namePrefix = ctx.args.namePrefix;

  if (!namePrefix || namePrefix.length > 6) {
    util.error('namePrefix must be 1-6 characters', 'ValidationError');
  }

  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);
  const ttlSeconds = 150;
  const threshold = nowEpoch - ttlSeconds;

  return {
    operation: 'Query',
    index: 'GroupNameIndex',
    query: {
      expression: 'gsi2_pk = :pk AND begins_with(gsi2_sk, :prefix)',
      expressionValues: util.dynamodb.toMapValues({
        ':pk': 'ALL_GROUPS',
        ':prefix': namePrefix
      })
    },
    filter: {
      expression: 'heartbeatAt > :threshold AND expiresAt > :now',
      expressionValues: util.dynamodb.toMapValues({
        ':threshold': threshold,
        ':now': util.time.nowISO8601()
      })
    },
    limit: 10
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

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
