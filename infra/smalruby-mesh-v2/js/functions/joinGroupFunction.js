// joinGroup Function
// ノードをグループに参加させる（TransactWriteItemsでアトミック実行）
// checkGroupExists Pipeline Function の後に実行されることを想定

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain, nodeId } = ctx.args;
  const now = util.time.nowISO8601();

  // Read member TTL from environment variable
  const ttlSeconds = +(ctx.env.MESH_MEMBER_HEARTBEAT_TTL_SECONDS || '600');
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);
  const ttl = nowEpoch + ttlSeconds;

  return {
    operation: 'TransactWriteItems',
    transactItems: [
      // 1. グループ内のノード情報を追加
      {
        table: ctx.env.TABLE_NAME,
        operation: 'PutItem',
        key: util.dynamodb.toMapValues({
          pk: `DOMAIN#${domain}`,
          sk: `GROUP#${groupId}#NODE#${nodeId}`
        }),
        attributeValues: util.dynamodb.toMapValues({
          id: nodeId,
          nodeId: nodeId,
          groupId: groupId,
          domain: domain,
          name: `Node ${nodeId}`,
          joinedAt: now,
          ttl: ttl
        })
      },
      // 2. ノードの所属情報を作成（逆引き用）
      {
        table: ctx.env.TABLE_NAME,
        operation: 'PutItem',
        key: util.dynamodb.toMapValues({
          pk: `NODE#${nodeId}`,
          sk: 'METADATA'
        }),
        attributeValues: util.dynamodb.toMapValues({
          id: nodeId,
          nodeId: nodeId,
          groupId: groupId,
          domain: domain,
          name: `Node ${nodeId}`,
          joinedAt: now,
          ttl: ttl
        })
      }
    ]
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  // TransactWriteItemsは個別のアイテムを返さないため、
  // リクエストパラメータからNode型を構築
  const { groupId, domain, nodeId } = ctx.args;
  const group = ctx.stash.group;

  return {
    id: nodeId,
    name: `Node ${nodeId}`,
    groupId: groupId,
    domain: domain,
    expiresAt: group ? group.expiresAt : null,
    heartbeatIntervalSeconds: +(ctx.env.MESH_MEMBER_HEARTBEAT_INTERVAL_SECONDS || '120'),
    useWebSocket: group ? group.useWebSocket !== false : true,
    pollingIntervalSeconds: group ? group.pollingIntervalSeconds : null
  };
}
