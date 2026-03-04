// createGroup Mutation Resolver
// グループを作成し、Domain対応のメタデータを保存

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { name, hostId, domain, maxConnectionTimeSeconds } = ctx.args;

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
      // GSI用（groupId -> domain の逆引き検索）
      gsi_pk: `GROUP#${groupId}`,
      gsi_sk: `DOMAIN#${domain}`
    })
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  // DynamoDB PutItemの結果から直接Group型を返却
  return {
    id: ctx.result.id,
    domain: ctx.result.domain,
    fullId: ctx.result.fullId,
    name: ctx.result.name,
    hostId: ctx.result.hostId,
    createdAt: ctx.result.createdAt,
    expiresAt: ctx.result.expiresAt
  };
}
