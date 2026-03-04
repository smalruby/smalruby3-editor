// checkGroupExists Pipeline Before Function
// グループの存在確認を行う共通Function
// reportDataByNode, fireEventsByNode の前処理として使用

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain } = ctx.args;

  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      pk: `DOMAIN#${domain}`,
      sk: `GROUP#${groupId}#METADATA`
    })
  };
}

export function response(ctx) {
  const { groupId, domain } = ctx.args;
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);
  const ttlSeconds = +(ctx.env.MESH_HOST_HEARTBEAT_TTL_SECONDS || '150');
  const heartbeatThreshold = nowEpoch - ttlSeconds;

  // グループが存在しない
  if (!ctx.result) {
    util.error(
      `Group not found: ${groupId}@${domain}`,
      'GroupNotFound'
    );
  }

  // チェック1: expiresAt（絶対的な有効期限）
  if (ctx.result.expiresAt) {
    const expiresAtEpoch = Math.floor(util.time.parseISO8601ToEpochMilliSeconds(ctx.result.expiresAt) / 1000);
    if (nowEpoch > expiresAtEpoch) {
      util.error(
        `Group expired: ${groupId}@${domain} (expiresAt: ${ctx.result.expiresAt})`,
        'GroupNotFound'
      );
    }
  }

  // チェック2: heartbeatAt（相対的な有効期限）
  if (ctx.result.heartbeatAt && ctx.result.heartbeatAt < heartbeatThreshold) {
    util.error(
      `Group not found: ${groupId}@${domain} (heartbeat expired)`,
      'GroupNotFound'
    );
  }

  // グループ情報をcontextに保存（後続のfunctionで使用可能）
  ctx.stash.group = ctx.result;
  return ctx.result;
}
