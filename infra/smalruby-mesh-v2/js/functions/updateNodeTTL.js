// updateNodeTTL Pipeline Function
// Updates Node TTL for member heartbeat

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain, nodeId } = ctx.args;
  const ttlSeconds = +(ctx.env.MESH_MEMBER_HEARTBEAT_TTL_SECONDS || '600');
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);
  const ttl = nowEpoch + ttlSeconds;

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      pk: `DOMAIN#${domain}`,
      sk: `GROUP#${groupId}#NODE#${nodeId}`
    }),
    update: {
      expression: 'SET #ttl = :ttl',
      expressionNames: {
        '#ttl': 'ttl'
      },
      expressionValues: util.dynamodb.toMapValues({
        ':ttl': ttl
      })
    },
    condition: {
      expression: 'attribute_exists(pk)'
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('Node not found', 'NodeNotFound');
    }
    util.error(ctx.error.message, ctx.error.type);
  }

  const { groupId, domain, nodeId } = ctx.args;
  const ttlSeconds = +(ctx.env.MESH_MEMBER_HEARTBEAT_TTL_SECONDS || '600');
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);

  return {
    nodeId: nodeId,
    groupId: groupId,
    domain: domain,
    expiresAt: util.time.epochMilliSecondsToISO8601((nowEpoch + ttlSeconds) * 1000),
    heartbeatIntervalSeconds: +(ctx.env.MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS || '120')
  };
}