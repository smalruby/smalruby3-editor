// checkGroupExists Pipeline Before Function
// グループの存在確認を行う共通Function
// joinGroup, renewHeartbeat, sendMemberHeartbeat, reportDataByNode, fireEventsByNode の前処理として使用
// meshInputError は CDK が末尾に連結する js/shared/meshInputValidation.js で定義される (issue #1267)

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { groupId, domain } = ctx.args;

  // hostId / nodeId の長さと文字を DB に触る前に検査する
  const inputError = meshInputError(ctx.args);
  if (inputError) {
    util.error(inputError, 'ValidationError');
  }

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
