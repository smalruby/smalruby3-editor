// checkExistingGroup Pipeline Function
// hostId + domain の組み合わせで既存のグループをチェック

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { hostId, domain } = ctx.args;
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);
  const ttlSeconds = +(ctx.env.MESH_HOST_HEARTBEAT_TTL_SECONDS || '150');
  const threshold = nowEpoch - ttlSeconds;
  const nowISO = util.time.nowISO8601();

  // 既存グループの検索
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
      expression: 'hostId = :hostId AND heartbeatAt > :threshold AND expiresAt > :now',
      expressionValues: util.dynamodb.toMapValues({
        ':hostId': hostId,
        ':threshold': threshold,
        ':now': nowISO
      })
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  // 既存グループが見つかった場合は最初のものを返す
  // METADATAサフィックスを持つアイテムを抽出
  const existingGroups = ctx.result.items
    .filter(item => item.sk.endsWith('#METADATA'));

  if (existingGroups.length > 0) {
    // ctx.stashに既存グループを保存（次のFunction用）
    ctx.stash.existingGroup = existingGroups[0];

    // 既存グループを次のFunctionに渡す
    return {
      id: existingGroups[0].id,
      domain: existingGroups[0].domain,
      fullId: existingGroups[0].fullId,
      name: existingGroups[0].name,
      hostId: existingGroups[0].hostId,
      expiresAt: existingGroups[0].expiresAt,
      useWebSocket: existingGroups[0].useWebSocket !== false, // デフォルト true
      pollingIntervalSeconds: existingGroups[0].pollingIntervalSeconds
    };
  }

  // 既存グループがない場合はnullを返す
  return null;
}
