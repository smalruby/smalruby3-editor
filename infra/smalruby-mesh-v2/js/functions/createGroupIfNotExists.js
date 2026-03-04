// createGroupIfNotExists Pipeline Function
// 既存グループがない場合のみ新規作成

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  // ctx.stashに既存グループがある場合は、GetItemで取得（有効なoperationを返すため）
  if (ctx.stash.existingGroup) {
    return {
      operation: 'GetItem',
      key: util.dynamodb.toMapValues({
        pk: ctx.stash.existingGroup.pk,
        sk: ctx.stash.existingGroup.sk
      })
    };
  }

  // 新規グループ作成
  const { name, hostId, domain, maxConnectionTimeSeconds, useWebSocket } = ctx.args;

  // Domain文字列のバリデーション（最大256文字）
  if (domain.length > 256) {
    util.error('Domain must be 256 characters or less', 'ValidationError');
  }

  // maxConnectionTimeSeconds のバリデーションと決定
  const envMaxSeconds = +(ctx.env.MESH_MAX_CONNECTION_TIME_SECONDS || '1500');
  let actualMaxSeconds = envMaxSeconds;

  if (maxConnectionTimeSeconds !== undefined && maxConnectionTimeSeconds !== null) {
    if (maxConnectionTimeSeconds < 1) {
      util.error('maxConnectionTimeSeconds must be at least 1', 'ValidationError');
    }
    if (maxConnectionTimeSeconds > envMaxSeconds) {
      util.error(
        `maxConnectionTimeSeconds cannot exceed ${envMaxSeconds}`,
        'ValidationError'
      );
    }
    actualMaxSeconds = maxConnectionTimeSeconds;
  }

  // Polling interval decision
  const pollingInterval = useWebSocket ? null : +(ctx.env.MESH_POLLING_INTERVAL_SECONDS || '2');

  // グループID生成
  const groupId = util.autoId();
  const fullId = `${groupId}@${domain}`;
  const now = util.time.nowISO8601();
  const nowEpoch = Math.floor(util.time.nowEpochMilliSeconds() / 1000);
  const expiresAt = util.time.epochMilliSecondsToISO8601(util.time.nowEpochMilliSeconds() + actualMaxSeconds * 1000);
  const ttlSeconds = +(ctx.env.MESH_HOST_HEARTBEAT_TTL_SECONDS || '150');
  const ttl = nowEpoch + ttlSeconds;

  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({
      pk: `DOMAIN#${domain}`,
      sk: `GROUP#${groupId}#METADATA`
    }),
    attributeValues: util.dynamodb.toMapValues({
      id: groupId,
      domain: domain,
      fullId: fullId,
      name: name,
      hostId: hostId,
      createdAt: now,
      expiresAt: expiresAt,
      heartbeatAt: nowEpoch,
      ttl: ttl,
      useWebSocket: useWebSocket,
      pollingIntervalSeconds: pollingInterval,
      // GSI用（groupId -> domain の逆引き検索）
      gsi_pk: `GROUP#${groupId}`,
      gsi_sk: `DOMAIN#${domain}`
    })
  };
}

export function response(ctx) {
  // エラーチェック
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  // ハートビート間隔を環境変数から取得（ホスト用）
  const heartbeatIntervalSeconds = +(ctx.env.MESH_HOST_HEARTBEAT_INTERVAL_SECONDS || '60');

  // ctx.stashに既存グループがある場合はそれを返す
  if (ctx.stash.existingGroup) {
    return {
      id: ctx.stash.existingGroup.id,
      domain: ctx.stash.existingGroup.domain,
      fullId: ctx.stash.existingGroup.fullId,
      name: ctx.stash.existingGroup.name,
      hostId: ctx.stash.existingGroup.hostId,
      createdAt: ctx.stash.existingGroup.createdAt,
      expiresAt: ctx.stash.existingGroup.expiresAt,
      heartbeatIntervalSeconds: heartbeatIntervalSeconds,
      useWebSocket: ctx.stash.existingGroup.useWebSocket !== false, // デフォルト true
      pollingIntervalSeconds: ctx.stash.existingGroup.pollingIntervalSeconds
    };
  }

  // 新規作成されたグループを返す
  return {
    id: ctx.result.id,
    domain: ctx.result.domain,
    fullId: ctx.result.fullId,
    name: ctx.result.name,
    hostId: ctx.result.hostId,
    createdAt: ctx.result.createdAt,
    expiresAt: ctx.result.expiresAt,
    heartbeatIntervalSeconds: heartbeatIntervalSeconds,
    useWebSocket: ctx.result.useWebSocket,
    pollingIntervalSeconds: ctx.result.pollingIntervalSeconds
  };
}
