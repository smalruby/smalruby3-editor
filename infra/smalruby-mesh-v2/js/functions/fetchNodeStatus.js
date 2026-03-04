// fetchNodeStatus Pipeline Function
// nodeMetadataから取得したグループ情報を元にステータスを取得する

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const metadata = ctx.stash.nodeMetadata;
  if (!metadata) {
    // 前のステップで見つからなかった場合、operationをスキップしてnullを返す
    return {
      operation: 'GetItem',
      key: util.dynamodb.toMapValues({
        pk: 'NONE',
        sk: 'NONE'
      })
    };
  }

  const { groupId, domain, nodeId } = metadata;

  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      pk: `DOMAIN#${domain}`,
      sk: `GROUP#${groupId}#NODE#${nodeId}#STATUS`
    })
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  if (!ctx.result) {
    return null;
  }

  return {
    nodeId: ctx.result.nodeId,
    groupId: ctx.result.groupId,
    domain: ctx.result.domain,
    data: ctx.result.data,
    timestamp: ctx.result.timestamp
  };
}
