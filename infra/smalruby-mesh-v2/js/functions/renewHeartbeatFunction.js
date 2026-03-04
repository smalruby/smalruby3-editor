// renewHeartbeat Pipeline Function
// ホスト認証を行い、ハートビートを更新する

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain, hostId } = ctx.args;
  const group = ctx.stash.group;

  // ホスト認証
  if (group.hostId !== hostId) {
    util.error('Only the host can renew the heartbeat', 'Unauthorized');
  }

  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);
  const ttlSeconds = +(ctx.env.MESH_HOST_HEARTBEAT_TTL_SECONDS || '150');
  const ttl = nowEpoch + ttlSeconds;

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      pk: `DOMAIN#${domain}`,
      sk: `GROUP#${groupId}#METADATA`
    }),
    update: {
      expression: 'SET #heartbeatAt = :now, #ttl = :ttl',
      expressionNames: {
        '#heartbeatAt': 'heartbeatAt',
        '#ttl': 'ttl'
      },
      expressionValues: util.dynamodb.toMapValues({
        ':now': nowEpoch,
        ':ttl': ttl
      })
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  const { groupId, domain } = ctx.args;
  const group = ctx.stash.group;

  return {
    groupId: groupId,
    domain: domain,
    expiresAt: group.expiresAt,
    heartbeatIntervalSeconds: +(ctx.env.MESH_HOST_HEARTBEAT_INTERVAL_SECONDS || '60')
  };
}
